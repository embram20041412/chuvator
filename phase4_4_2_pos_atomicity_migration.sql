-- =============================================================================
-- CHUVATOR — MIGRATION PHASE 4.4.2
-- POS TRANSACTION ATOMICITY & INVENTORY INTEGRITY HARDENING
-- =============================================================================

-- 1. Create Idempotency Key Tracking Table
CREATE TABLE IF NOT EXISTS pos_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id UUID,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on pos_idempotency_keys
ALTER TABLE pos_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_pos_idempotency_isolation ON pos_idempotency_keys;
CREATE POLICY tenant_pos_idempotency_isolation ON pos_idempotency_keys
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true) OR current_setting('app.current_user_role', true) = 'superadmin');

-- 2. Atomic POS Checkout RPC Function
CREATE OR REPLACE FUNCTION process_pos_checkout(
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
  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT result INTO v_existing_result
    FROM pos_idempotency_keys
    WHERE idempotency_key = p_idempotency_key AND tenant_id = p_tenant_id;

    IF FOUND THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  -- 2. Validate Tenant
  IF p_tenant_id IS NULL OR TRIM(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'Tenant ID wajib diisi.';
  END IF;

  -- 3. Loop through items for validation, stock check/lock, and total calculation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    v_item_type := COALESCE(v_item->>'type', 'jual');
    v_item_price := COALESCE((v_item->>'price')::NUMERIC, 0);

    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah item (%) tidak valid.', COALESCE(v_item->>'name', 'Produk');
    END IF;

    -- Physical Product Stock Check & Lock
    IF v_item_type NOT IN ('spp', 'registration', 'sewa') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
      v_item_id := (v_item->>'id')::UUID;

      SELECT stock, price INTO v_current_stock, v_db_price
      FROM products
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
        SELECT COUNT(*) INTO v_spp_exists
        FROM spp_payments
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

  -- 4. Atomic Product Stock Decrement & Student Updates
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'qty')::INTEGER, 1);
    v_item_type := COALESCE(v_item->>'type', 'jual');

    -- Stock decrement ONLY for physical non-rental items
    IF v_item_type NOT IN ('spp', 'registration', 'sewa') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
      v_item_id := (v_item->>'id')::UUID;

      UPDATE products
      SET stock = stock - v_item_qty,
          updated_at = NOW()
      WHERE id = v_item_id AND tenant_id = p_tenant_id;
    END IF;

    -- Registration status update
    IF v_item_type = 'registration' THEN
      v_student_id := NULL;
      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;

      IF v_student_id IS NOT NULL THEN
        UPDATE students
        SET registration_fee_paid = TRUE,
            updated_at = NOW()
        WHERE id = v_student_id AND tenant_id = p_tenant_id;
      END IF;
    END IF;

    -- SPP status update & spp_payments insert
    IF v_item_type = 'spp' THEN
      v_student_id := NULL;
      IF (v_item->>'studentId') IS NOT NULL AND (v_item->>'studentId') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'studentId')::UUID;
      ELSIF (v_item->>'student_id') IS NOT NULL AND (v_item->>'student_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_student_id := (v_item->>'student_id')::UUID;
      END IF;
      v_paid_month := COALESCE(v_item->>'paid_month', v_item->>'paidMonth', to_char(CURRENT_DATE, 'YYYY-MM'));

      IF v_student_id IS NOT NULL THEN
        UPDATE students
        SET spp_status = 'Lunas',
            last_paid_month = v_paid_month,
            updated_at = NOW()
        WHERE id = v_student_id AND tenant_id = p_tenant_id;

        INSERT INTO spp_payments (
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

  -- 5. Insert Transaction
  INSERT INTO transactions (
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

  -- 6. Insert POS Receipt
  v_receipt_no := 'POS-' || to_char(NOW(), 'YYMMDD') || '-' || substring(v_transaction_id::text from 1 for 6);
  INSERT INTO pos_transactions (
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

  -- 7. Insert Global Ledger Entry
  INSERT INTO global_ledger (
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

  -- Store Idempotency Key if provided
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO pos_idempotency_keys (idempotency_key, tenant_id, transaction_id, result)
    VALUES (p_idempotency_key, p_tenant_id, v_transaction_id, v_res);
  END IF;

  RETURN v_res;
END;
$$;
