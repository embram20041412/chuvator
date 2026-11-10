-- =============================================================================
-- CHUVATOR — MIGRATION PHASE 4.4.2.2
-- CRITICAL POS CHECKOUT SECURITY, ATOMICITY & INTEGRITY HARDENING
-- =============================================================================

-- 1. Idempotency Key Tracking Table with Composite Primary Key (tenant_id, idempotency_key)
CREATE TABLE IF NOT EXISTS public.pos_idempotency_keys (
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  transaction_id UUID,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);

ALTER TABLE public.pos_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_pos_idempotency_isolation ON public.pos_idempotency_keys;
CREATE POLICY tenant_pos_idempotency_isolation ON public.pos_idempotency_keys
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true) OR current_setting('app.current_user_role', true) = 'superadmin');

-- 2. Database Constraints for Inventory Non-Negative & SPP Duplicate Protection
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spp_payments_student_month_completed
ON public.spp_payments (tenant_id, student_id, paid_month)
WHERE status = 'COMPLETED';

-- 3. Fully Schema-Qualified PL/pgSQL Atomic POS Checkout RPC Function
CREATE OR REPLACE FUNCTION public.process_pos_checkout(
  p_tenant_id TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_customer_name TEXT DEFAULT 'Pelanggan',
  p_cashier_name TEXT DEFAULT 'Kasir',
  p_cashier_email TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_authorized INTEGER := 0;
  v_idemp_status TEXT;
  v_existing_result JSONB;
  v_item JSONB;
  v_item_id UUID;
  v_item_qty INTEGER;
  v_db_type TEXT;
  v_db_price NUMERIC;
  v_db_stock INTEGER;
  v_db_name TEXT;
  v_student_id UUID;
  v_student_name TEXT;
  v_student_spp_fee NUMERIC;
  v_student_reg_fee NUMERIC;
  v_paid_month TEXT;
  v_cart_total NUMERIC := 0;
  v_items_count INTEGER := 0;
  v_transaction_id UUID;
  v_receipt_no TEXT;
  v_receipt_id UUID;
  v_ledger_id UUID;
  v_spp_exists INTEGER;
  v_items_summary TEXT := '';
  v_has_academy BOOLEAN := FALSE;
  v_rows_updated INTEGER := 0;
  v_res JSONB;
  v_verified_items JSONB := '[]'::jsonb;
BEGIN
  -- A. TENANT VALIDATION & AUTHORIZATION
  IF p_tenant_id IS NULL OR pg_catalog.trim(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'Tenant ID wajib diisi.';
  END IF;

  -- Validate caller identity via auth.uid()
  IF auth.uid() IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_authorized
    FROM public.users_staff
    WHERE uid = auth.uid()
      AND tenant_id = p_tenant_id
      AND (is_active = true OR status = 'active');

    IF v_user_authorized = 0 THEN
      SELECT COUNT(*) INTO v_user_authorized
      FROM public.tenants
      WHERE id = p_tenant_id
        AND owner_uid = auth.uid();
    END IF;

    IF v_user_authorized = 0 THEN
      SELECT COUNT(*) INTO v_user_authorized
      FROM public.users_staff
      WHERE uid = auth.uid()
        AND role = 'superadmin';
    END IF;

    IF v_user_authorized = 0 THEN
      RAISE EXCEPTION 'Akses ditolak: Pengguna tidak memiliki otorisasi untuk tenant ini.';
    END IF;
  END IF;

  -- B. IDEMPOTENCY RESERVATION PATTERN
  IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
    -- Attempt reservation entry
    INSERT INTO public.pos_idempotency_keys (tenant_id, idempotency_key, status)
    VALUES (p_tenant_id, p_idempotency_key, 'PROCESSING')
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

    -- Lock and check status
    SELECT status, result INTO v_idemp_status, v_existing_result
    FROM public.pos_idempotency_keys
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_idemp_status = 'COMPLETED' AND v_existing_result IS NOT NULL THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  -- C. SERVER-SIDE ITEM VALIDATION, STOCK LOCKING & PRICE COMPUTATION
  IF p_items IS NULL OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Keranjang belanja tidak boleh kosong.';
  END IF;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah item (%) tidak valid.', COALESCE(v_item->>'name', 'Produk');
    END IF;

    -- Case 1: Physical Product or Rental Equipment from Master Products
    IF (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$'
       AND COALESCE(v_item->>'type', '') NOT IN ('spp', 'registration') THEN
      v_item_id := (v_item->>'id')::UUID;

      -- Fetch & Lock official Product row from DB
      SELECT name, price, stock, type INTO v_db_name, v_db_price, v_db_stock, v_db_type
      FROM public.products
      WHERE id = v_item_id AND tenant_id = p_tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk % tidak ditemukan pada tenant ini.', COALESCE(v_item->>'name', v_item_id::text);
      END IF;

      -- Validate physical stock for 'jual' items
      IF v_db_type NOT IN ('sewa', 'rental') AND v_db_stock < v_item_qty THEN
        RAISE EXCEPTION 'Stok produk % tidak mencukupi (Tersedia: %, Diminta: %).', v_db_name, v_db_stock, v_item_qty;
      END IF;

      v_cart_total := v_cart_total + (v_db_price * v_item_qty);

      v_verified_items := v_verified_items || pg_catalog.jsonb_build_object(
        'id', v_item_id,
        'name', v_db_name,
        'price', v_db_price,
        'qty', v_item_qty,
        'type', v_db_type
      );

    -- Case 2: SPP Payment Item
    ELSIF COALESCE(v_item->>'type', '') = 'spp' THEN
      v_has_academy := TRUE;
      v_student_id := NULL;

      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;

      IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'ID Siswa wajib disertakan untuk item SPP.';
      END IF;

      -- Fetch & Lock official Student row from DB
      SELECT student_name, COALESCE(monthly_fee, 0) INTO v_student_name, v_student_spp_fee
      FROM public.students
      WHERE id = v_student_id AND tenant_id = p_tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Data siswa tidak ditemukan pada tenant ini.';
      END IF;

      v_paid_month := COALESCE(v_item->>'paid_month', v_item->>'paidMonth', pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'));

      -- Check duplicate SPP payment
      SELECT COUNT(*) INTO v_spp_exists
      FROM public.spp_payments
      WHERE tenant_id = p_tenant_id
        AND student_id = v_student_id
        AND (paid_month = v_paid_month OR month = v_paid_month)
        AND status = 'COMPLETED';

      IF v_spp_exists > 0 THEN
        RAISE EXCEPTION 'Tagihan SPP bulan % untuk siswa % sudah lunas.', v_paid_month, v_student_name;
      END IF;

      v_db_price := COALESCE(NULLIF(v_student_spp_fee, 0), (v_item->>'price')::NUMERIC, 0);
      v_cart_total := v_cart_total + (v_db_price * v_item_qty);

      v_verified_items := v_verified_items || pg_catalog.jsonb_build_object(
        'id', v_item->>'id',
        'studentId', v_student_id,
        'studentName', v_student_name,
        'name', 'SPP ' || v_paid_month || ' - ' || v_student_name,
        'price', v_db_price,
        'qty', v_item_qty,
        'type', 'spp',
        'paid_month', v_paid_month
      );

    -- Case 3: Registration Fee Item
    ELSIF COALESCE(v_item->>'type', '') = 'registration' THEN
      v_has_academy := TRUE;
      v_student_id := NULL;

      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;

      IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'ID Siswa wajib disertakan untuk pendaftaran.';
      END IF;

      SELECT student_name, COALESCE(registration_fee, 0) INTO v_student_name, v_student_reg_fee
      FROM public.students
      WHERE id = v_student_id AND tenant_id = p_tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Data siswa tidak ditemukan pada tenant ini.';
      END IF;

      v_db_price := COALESCE(NULLIF(v_student_reg_fee, 0), (v_item->>'price')::NUMERIC, 0);
      v_cart_total := v_cart_total + (v_db_price * v_item_qty);

      v_verified_items := v_verified_items || pg_catalog.jsonb_build_object(
        'id', v_item->>'id',
        'studentId', v_student_id,
        'studentName', v_student_name,
        'name', 'Pendaftaran Akademi - ' || v_student_name,
        'price', v_db_price,
        'qty', v_item_qty,
        'type', 'registration'
      );
    ELSE
      -- Custom physical item fallback (if missing UUID, ensure positive price)
      v_db_price := (v_item->>'price')::NUMERIC;
      IF v_db_price IS NULL OR v_db_price < 0 THEN
        RAISE EXCEPTION 'Harga item % tidak valid.', COALESCE(v_item->>'name', 'Item');
      END IF;
      v_cart_total := v_cart_total + (v_db_price * v_item_qty);
      v_verified_items := v_verified_items || v_item;
    END IF;

    v_items_count := v_items_count + v_item_qty;

    IF v_items_summary <> '' THEN
      v_items_summary := v_items_summary || ', ';
    END IF;
    v_items_summary := v_items_summary || (COALESCE(v_item->>'name', 'Item')) || ' (' || v_item_qty || 'x)';
  END LOOP;

  -- D. ATOMIC EXECUTION: STOCK DECREMENT & ACADEMY UPDATES
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(v_verified_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    v_db_type := COALESCE(v_item->>'type', 'jual');

    -- Decrement physical product stock only (not rental / spp / registration)
    IF v_db_type NOT IN ('sewa', 'rental', 'spp', 'registration')
       AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
      v_item_id := (v_item->>'id')::UUID;

      UPDATE public.products
      SET stock = stock - v_item_qty,
          updated_at = pg_catalog.now()
      WHERE id = v_item_id AND tenant_id = p_tenant_id AND stock >= v_item_qty;

      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
      IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'Gagal memperbarui stok produk %. Stok tidak mencukupi.', COALESCE(v_item->>'name', 'Produk');
      END IF;
    END IF;

    -- Update registration status
    IF v_db_type = 'registration' THEN
      v_student_id := (v_item->>'studentId')::UUID;
      UPDATE public.students
      SET registration_fee_paid = TRUE,
          updated_at = pg_catalog.now()
      WHERE id = v_student_id AND tenant_id = p_tenant_id;
    END IF;

    -- Record SPP payment
    IF v_db_type = 'spp' THEN
      v_student_id := (v_item->>'studentId')::UUID;
      v_paid_month := COALESCE(v_item->>'paid_month', pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'));

      UPDATE public.students
      SET spp_status = 'Lunas',
          last_paid_month = v_paid_month,
          updated_at = pg_catalog.now()
      WHERE id = v_student_id AND tenant_id = p_tenant_id;

      INSERT INTO public.spp_payments (
        tenant_id,
        student_id,
        student_name,
        month,
        paid_month,
        year,
        amount,
        payment_method,
        status,
        created_at
      ) VALUES (
        p_tenant_id,
        v_student_id,
        COALESCE(v_item->>'studentName', 'Siswa'),
        v_paid_month,
        v_paid_month,
        EXTRACT(YEAR FROM pg_catalog.now())::INTEGER,
        COALESCE((v_item->>'price')::NUMERIC, 0),
        p_payment_method,
        'COMPLETED',
        pg_catalog.now()
      );
    END IF;
  END LOOP;

  -- E. PERSIST TRANSACTIONS, RECEIPT & LEDGER
  INSERT INTO public.transactions (
    tenant_id,
    item_name,
    item_category,
    amount,
    payment_method,
    items_count,
    items,
    status,
    created_at
  ) VALUES (
    p_tenant_id,
    v_items_summary,
    CASE WHEN v_has_academy THEN 'POS & Tagihan SPP Akademi' ELSE 'Penjualan Retail POS' END,
    v_cart_total,
    p_payment_method,
    v_items_count,
    v_verified_items,
    'COMPLETED',
    pg_catalog.now()
  )
  RETURNING id INTO v_transaction_id;

  v_receipt_no := 'POS-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substring(v_transaction_id::text from 1 for 6);
  INSERT INTO public.pos_transactions (
    tenant_id,
    customer_name,
    cashier_name,
    cashier_email,
    items,
    receipt_no,
    subtotal,
    total,
    amount_paid,
    payment_method,
    transaction_id,
    status,
    created_at
  ) VALUES (
    p_tenant_id,
    p_customer_name,
    p_cashier_name,
    p_cashier_email,
    v_verified_items,
    v_receipt_no,
    v_cart_total,
    v_cart_total,
    v_cart_total,
    p_payment_method,
    v_transaction_id,
    'LUNAS',
    pg_catalog.now()
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.global_ledger (
    tenant_id,
    type,
    source,
    description,
    amount,
    payment_method,
    reference_id,
    status,
    created_at
  ) VALUES (
    p_tenant_id,
    'PEMASUKAN',
    'KASIR_POS',
    'Penjualan POS Kasir (' || v_items_summary || ')',
    v_cart_total,
    p_payment_method,
    v_transaction_id::text,
    'COMPLETED',
    pg_catalog.now()
  )
  RETURNING id INTO v_ledger_id;

  -- Build final output JSON
  v_res := pg_catalog.jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'receipt_id', v_receipt_id,
    'receipt_no', v_receipt_no,
    'ledger_id', v_ledger_id,
    'cart_total', v_cart_total,
    'items_count', v_items_count,
    'payment_method', p_payment_method
  );

  -- Finalize Idempotency Reservation
  IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
    UPDATE public.pos_idempotency_keys
    SET status = 'COMPLETED',
        transaction_id = v_transaction_id,
        result = v_res,
        updated_at = pg_catalog.now()
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_res;
END;
$$;

-- 4. Explicit Role Privileges (GRANT & REVOKE)
REVOKE EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
