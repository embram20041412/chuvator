-- =============================================================================
-- CHUVATOR — MIGRATION PHASE 4.4.2.1
-- FINAL SECURITY & DATABASE INTEGRITY HARDENING FOR POS CHECKOUT
-- =============================================================================

-- 1. Idempotency Tracking Table & Unique Constraints
CREATE TABLE IF NOT EXISTS public.pos_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id UUID,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on pos_idempotency_keys
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

-- 3. Atomic POS Checkout RPC Function
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_authorized INTEGER := 0;
  v_item JSONB;
  v_item_id UUID;
  v_item_qty INTEGER;
  v_item_price NUMERIC;
  v_item_type TEXT;
  v_student_id UUID;
  v_paid_month TEXT;
  v_current_stock INTEGER;
  v_db_price NUMERIC;
  v_cart_total NUMERIC := 0;
  v_items_count INTEGER := 0;
  v_transaction_id UUID;
  v_receipt_no TEXT;
  v_receipt_id UUID;
  v_ledger_id UUID;
  v_existing_result JSONB;
  v_spp_exists INTEGER;
  v_items_summary TEXT := '';
  v_has_academy BOOLEAN := FALSE;
  v_res JSONB;
BEGIN
  -- 1. Tenant ID Validation
  IF p_tenant_id IS NULL OR TRIM(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'Tenant ID wajib diisi.';
  END IF;

  -- 2. Server-side Tenant Authorization Check (auth.uid() Context)
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
      IF NOT (COALESCE(current_setting('app.current_user_role', true), '') = 'superadmin') THEN
        RAISE EXCEPTION 'Akses ditolak: Pengguna tidak memiliki otorisasi untuk tenant ini.';
      END IF;
    END IF;
  END IF;

  -- 3. Idempotency Key Validation
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT result INTO v_existing_result
    FROM public.pos_idempotency_keys
    WHERE idempotency_key = p_idempotency_key AND tenant_id = p_tenant_id;

    IF FOUND THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  -- 4. Item Loop: Validation, Inventory Row Locking, & Price Computation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    v_item_type := COALESCE(v_item->>'type', 'jual');
    v_item_price := COALESCE((v_item->>'price')::NUMERIC, 0);

    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah item (%) tidak valid.', COALESCE(v_item->>'name', 'Produk');
    END IF;

    -- Physical Product Stock Lock & Check
    IF v_item_type NOT IN ('spp', 'registration', 'sewa') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
      v_item_id := (v_item->>'id')::UUID;

      SELECT stock, price INTO v_current_stock, v_db_price
      FROM public.products
      WHERE id = v_item_id AND tenant_id = p_tenant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk % tidak ditemukan pada tenant ini.', COALESCE(v_item->>'name', v_item_id::text);
      END IF;

      IF v_current_stock < v_item_qty THEN
        RAISE EXCEPTION 'Stok produk % tidak mencukupi (Tersedia: %, Diminta: %).', COALESCE(v_item->>'name', 'Produk'), v_current_stock, v_item_qty;
      END IF;
    END IF;

    -- SPP Duplicate Payment Check
    IF v_item_type = 'spp' THEN
      v_has_academy := TRUE;
      v_student_id := NULL;
      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;

      v_paid_month := COALESCE(v_item->>'paid_month', v_item->>'paidMonth', to_char(CURRENT_DATE, 'YYYY-MM'));

      IF v_student_id IS NOT NULL THEN
        -- Lock student row to prevent concurrent SPP checkout
        PERFORM id FROM public.students WHERE id = v_student_id AND tenant_id = p_tenant_id FOR UPDATE;

        SELECT COUNT(*) INTO v_spp_exists
        FROM public.spp_payments
        WHERE tenant_id = p_tenant_id
          AND student_id = v_student_id
          AND (paid_month = v_paid_month OR month = v_paid_month)
          AND status = 'COMPLETED';

        IF v_spp_exists > 0 THEN
          RAISE EXCEPTION 'Tagihan SPP bulan % untuk siswa ini sudah lunas.', v_paid_month;
        END IF;
      END IF;
    END IF;

    IF v_item_type = 'registration' THEN
      v_has_academy := TRUE;
    END IF;

    v_cart_total := v_cart_total + (v_item_price * v_item_qty);
    v_items_count := v_items_count + v_item_qty;

    IF v_items_summary <> '' THEN
      v_items_summary := v_items_summary || ', ';
    END IF;
    v_items_summary := v_items_summary || (COALESCE(v_item->>'name', 'Item')) || ' (' || v_item_qty || 'x)';
  END LOOP;

  -- 5. Atomic Stock Decrement & Student Updates
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    v_item_type := COALESCE(v_item->>'type', 'jual');

    IF v_item_type NOT IN ('spp', 'registration', 'sewa') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
      v_item_id := (v_item->>'id')::UUID;

      UPDATE public.products
      SET stock = stock - v_item_qty,
          updated_at = NOW()
      WHERE id = v_item_id AND tenant_id = p_tenant_id AND stock >= v_item_qty;
    END IF;

    IF v_item_type = 'registration' THEN
      v_student_id := NULL;
      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;

      IF v_student_id IS NOT NULL THEN
        UPDATE public.students
        SET registration_fee_paid = TRUE,
            updated_at = NOW()
        WHERE id = v_student_id AND tenant_id = p_tenant_id;
      END IF;
    END IF;

    IF v_item_type = 'spp' THEN
      v_student_id := NULL;
      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;
      v_paid_month := COALESCE(v_item->>'paid_month', v_item->>'paidMonth', to_char(CURRENT_DATE, 'YYYY-MM'));

      IF v_student_id IS NOT NULL THEN
        UPDATE public.students
        SET spp_status = 'Lunas',
            last_paid_month = v_paid_month,
            updated_at = NOW()
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
          EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
          COALESCE((v_item->>'price')::NUMERIC, 0),
          p_payment_method,
          'COMPLETED',
          NOW()
        );
      END IF;
    END IF;
  END LOOP;

  -- 6. Insert Transaction
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
    p_items,
    'COMPLETED',
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- 7. Insert POS Receipt
  v_receipt_no := 'POS-' || to_char(NOW(), 'YYMMDD') || '-' || substring(v_transaction_id::text from 1 for 6);
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
    p_items,
    v_receipt_no,
    v_cart_total,
    v_cart_total,
    v_cart_total,
    p_payment_method,
    v_transaction_id,
    'LUNAS',
    NOW()
  )
  RETURNING id INTO v_receipt_id;

  -- 8. Insert Global Ledger Entry
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
    NOW()
  )
  RETURNING id INTO v_ledger_id;

  -- Build Result Object
  v_res := jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'receipt_id', v_receipt_id,
    'receipt_no', v_receipt_no,
    'ledger_id', v_ledger_id,
    'cart_total', v_cart_total,
    'items_count', v_items_count,
    'payment_method', p_payment_method
  );

  -- Store Idempotency Key
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO public.pos_idempotency_keys (idempotency_key, tenant_id, transaction_id, result)
    VALUES (p_idempotency_key, p_tenant_id, v_transaction_id, v_res)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_res;
END;
$$;

-- 4. Explicit Role Privileges (GRANT & REVOKE)
REVOKE EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_pos_checkout(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
