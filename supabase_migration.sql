-- =========================================================================
-- CHUA SPORT CORE - COMPLETE SUPABASE POSTGRESQL SCHEMA MIGRATION & RLS
-- Target: Supabase SQL Editor
-- Architecture: Single Source of Truth, Multi-Tenant SaaS with RBAC
-- =========================================================================

-- 0. Aktifkan Ekstensi pgcrypto untuk pembuatan UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. FUNGSI PEMBANTU SECURITY & RBAC (Row-Level Security Functions)
-- =========================================================================

-- Fungsi untuk memeriksa apakah pemanggil adalah Superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email') = 'erizamaulana.bramantya@gmail.com'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fungsi untuk memverifikasi hak akses pengguna terhadap tenant tertentu
CREATE OR REPLACE FUNCTION user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  caller_uid UUID;
  caller_email TEXT;
BEGIN
  -- Superadmin memiliki akses universal ke seluruh data tenant
  IF is_superadmin() THEN
    RETURN TRUE;
  END IF;

  caller_uid := auth.uid();
  caller_email := auth.jwt() ->> 'email';

  IF caller_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Cek jika pengguna adalah Owner dari tenant tersebut
  IF EXISTS (
    SELECT 1 FROM tenants 
    WHERE id::text = target_tenant_id 
      AND (owner_uid = caller_uid::text OR id::text = caller_uid::text OR owner_email = caller_email)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Cek jika pengguna adalah Staf aktif di tenant tersebut
  IF EXISTS (
    SELECT 1 FROM users_staff 
    WHERE tenant_id = target_tenant_id 
      AND (uid = caller_uid::text OR id::text = caller_uid::text OR email = caller_email)
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Cek klaim tenantId di JWT user_metadata atau app_metadata
  IF (auth.jwt() -> 'user_metadata' ->> 'tenantId') = target_tenant_id 
     OR (auth.jwt() -> 'app_metadata' ->> 'tenantId') = target_tenant_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 2. DEFINISI TABEL-TABEL UTAMA (23 ENTITAS LENGKAP)
-- =========================================================================

-- 1. TABEL: tenants (Profil GOR / Arena SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    owner_name TEXT,
    owner_email TEXT,
    owner_uid TEXT,
    address TEXT,
    province TEXT,
    regency TEXT,
    district TEXT,
    village TEXT,
    sports_type TEXT,
    courts_count INTEGER DEFAULT 0,
    logo_url TEXT,
    bank_name TEXT,
    bank_account_name TEXT,
    bank_account_number TEXT,
    bank_accounts JSONB DEFAULT '[]'::jsonb,
    qris_url TEXT,
    spp_billing_start_day INTEGER DEFAULT 1,
    spp_due_day INTEGER DEFAULT 10,
    receipt_footer_text TEXT,
    receipt_footer_note TEXT,
    academy_pricing JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABEL: invitations (Undangan Bergabung Staf / Operator)
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    owner_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABEL: users_staff (User Staf, Kasir, & Pelatih Arena)
CREATE TABLE IF NOT EXISTS users_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT UNIQUE,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'kasir',
    status TEXT DEFAULT 'active',
    phone TEXT,
    auth_method TEXT DEFAULT 'express_fullstack_supabase_rbac',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABEL: academies (Master Akademi Olahraga)
CREATE TABLE IF NOT EXISTS academies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_name TEXT NOT NULL,
    name TEXT,
    sport_category TEXT,
    sport TEXT,
    category TEXT,
    category_label TEXT,
    description TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABEL: coaches (Pelatih Akademi Olahraga)
CREATE TABLE IF NOT EXISTS coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    coach_name TEXT,
    nickname TEXT,
    nik TEXT,
    phone TEXT,
    email TEXT,
    sport_category TEXT,
    sport_specialty TEXT,
    specialization TEXT,
    hourly_rate NUMERIC(12,2) DEFAULT 0,
    monthly_salary NUMERIC(12,2) DEFAULT 0,
    photo_url TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABEL: academy_classes (Kelas & Tingkat Usia Akademi)
CREATE TABLE IF NOT EXISTS academy_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id UUID REFERENCES academies(id) ON DELETE CASCADE,
    academy_name TEXT,
    class_name TEXT NOT NULL,
    sport TEXT,
    coach_id UUID REFERENCES coaches(id) ON DELETE SET NULL,
    coach_name TEXT,
    min_age INTEGER,
    max_age INTEGER,
    max_quota INTEGER DEFAULT 20,
    tier_code TEXT,
    tier_label TEXT,
    schedule TEXT,
    schedules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABEL: students (Siswa / Atlet Akademi Olahraga)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
    academy_name TEXT,
    class_id UUID REFERENCES academy_classes(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    name TEXT,
    birth_date DATE,
    player_role TEXT,
    sport_category TEXT,
    sport TEXT,
    photo_url TEXT,
    gender TEXT,
    blood_type TEXT,
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    dominant_foot_hand TEXT,
    school_name TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    contact_phone TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    spp_status TEXT DEFAULT 'BELUM LUNAS',
    registration_fee_paid BOOLEAN DEFAULT false,
    registration_fee NUMERIC(12,2) DEFAULT 0,
    monthly_fee NUMERIC(12,2) DEFAULT 0,
    last_paid_month TEXT,
    tournaments JSONB DEFAULT '[]'::jsonb,
    growth_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABEL: academy_evaluations (Rapor & Evaluasi Siswa)
CREATE TABLE IF NOT EXISTS academy_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    class_id UUID REFERENCES academy_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    active_tier INTEGER DEFAULT 1,
    overall_score INTEGER DEFAULT 0,
    pillar_scores JSONB DEFAULT '{}'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    coach_note TEXT,
    evaluator TEXT,
    main_position TEXT,
    sub_position TEXT,
    playing_role TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABEL: academy_attendance (Presensi Latihan Siswa & Pelatih)
CREATE TABLE IF NOT EXISTS academy_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    class_id UUID REFERENCES academy_classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Hadir',
    students JSONB DEFAULT '[]'::jsonb,
    coach_name TEXT,
    class_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. TABEL: spp_payments (Pembayaran SPP & Pendaftaran Siswa)
CREATE TABLE IF NOT EXISTS spp_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    class_id UUID REFERENCES academy_classes(id) ON DELETE SET NULL,
    academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
    academy_name TEXT,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    type TEXT DEFAULT 'SPP_BULANAN',
    status TEXT DEFAULT 'Lunas',
    payment_method TEXT DEFAULT 'Cash',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TABEL: courts (Lapangan Venue / Arena Olahraga)
CREATE TABLE IF NOT EXISTS courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sport TEXT,
    court_number TEXT,
    price NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    operational_hours JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. TABEL: bookings (Sewa / Reservasi Lapangan)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
    court_name TEXT,
    class_id UUID REFERENCES academy_classes(id) ON DELETE SET NULL,
    event_id UUID,
    reference_id UUID,
    date DATE NOT NULL,
    booking_date DATE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    booking_type TEXT DEFAULT 'REGULAR',
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    status TEXT DEFAULT 'Lunas',
    total_price NUMERIC(12,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. TABEL: transactions (Penerimaan Kas & Arus Kas Keuangan)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    title TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    type TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'success',
    reference_id TEXT,
    reference_number TEXT,
    sponsor_id UUID,
    giro_data JSONB,
    note TEXT,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by TEXT,
    cleared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 14. TABEL: products (Master Katalog Produk POS & Retail)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    type TEXT DEFAULT 'jual',
    barcode TEXT,
    cogs NUMERIC(12,2) DEFAULT 0,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. TABEL: pos_transactions (Struk Transaksi Penjualan Kasir POS)
CREATE TABLE IF NOT EXISTS pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    receipt_no TEXT,
    customer_name TEXT,
    cashier_name TEXT,
    cashier_email TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    change NUMERIC(12,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    source TEXT,
    event_id UUID,
    event_name TEXT,
    category_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. TABEL: global_ledger (Buku Kas Besar Keuangan Multi-Divisi)
CREATE TABLE IF NOT EXISTS global_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    method TEXT,
    payment_method TEXT,
    payment_status TEXT,
    event_id UUID,
    event_name TEXT,
    participant_name TEXT,
    cashier_name TEXT,
    cashier_email TEXT,
    category_name TEXT,
    note TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. TABEL: events (Turnamen, Event & Kejuaraan Olahraga)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sport TEXT,
    sport_category TEXT,
    tournament_format TEXT,
    start_date DATE,
    end_date DATE,
    courts JSONB DEFAULT '[]'::jsonb,
    location TEXT,
    status TEXT DEFAULT 'Pendaftaran Buka',
    registration_fee NUMERIC(12,2) DEFAULT 0,
    total_slots INTEGER DEFAULT 0,
    prize_pool NUMERIC(12,2) DEFAULT 0,
    description TEXT,
    banner_url TEXT,
    poster_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 18. TABEL: sponsors (Data Sponsor & CRM Kemitraan Event)
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    name TEXT,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    event_name TEXT,
    category TEXT,
    contract_value NUMERIC(12,2) DEFAULT 0,
    total_paid NUMERIC(12,2) DEFAULT 0,
    pending_amount NUMERIC(12,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'Unpaid',
    contact_person TEXT,
    whatsapp_number TEXT,
    status TEXT DEFAULT 'Negosiasi',
    crm_status TEXT DEFAULT 'Negosiasi',
    benefits TEXT,
    payment_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 19. TABEL: event_categories (Kategori Nomor Pertandingan Event)
CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_name TEXT,
    max_slots INTEGER DEFAULT 16,
    max_participants INTEGER DEFAULT 16,
    fee NUMERIC(12,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 20. TABEL: event_registrations (Pendaftaran Peserta Turnamen)
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    participant_name TEXT NOT NULL,
    team_name TEXT,
    contact_name TEXT,
    whatsapp_number TEXT,
    payment_status TEXT DEFAULT 'Lunas',
    payment_method TEXT DEFAULT 'Cash',
    amount_paid NUMERIC(12,2) DEFAULT 0,
    sport_category TEXT,
    roster JSONB DEFAULT '[]'::jsonb,
    registered_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 21. TABEL: event_expenses (Pengeluaran Operasional Event)
CREATE TABLE IF NOT EXISTS event_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    amount NUMERIC(12,2) DEFAULT 0,
    date DATE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 22. TABEL: event_documents (Dokumen & Regulasi Event)
CREATE TABLE IF NOT EXISTS event_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    event_name TEXT,
    title TEXT NOT NULL,
    document_type TEXT,
    file_url TEXT,
    file_name TEXT,
    content_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 23. TABEL: event_matches (Bagan & Jadwal Pertandingan Event)
CREATE TABLE IF NOT EXISTS event_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    category_id UUID REFERENCES event_categories(id) ON DELETE CASCADE,
    category_name TEXT,
    round_index INTEGER DEFAULT 1,
    round_name TEXT,
    total_rounds INTEGER DEFAULT 1,
    match_index INTEGER DEFAULT 1,
    next_match_round INTEGER,
    next_match_index INTEGER,
    next_match_slot TEXT,
    participant1 TEXT,
    participant2 TEXT,
    score1 INTEGER DEFAULT 0,
    score2 INTEGER DEFAULT 0,
    sets TEXT,
    court_number INTEGER DEFAULT 1,
    time TEXT,
    status TEXT DEFAULT 'Menunggu',
    winner TEXT,
    format TEXT,
    is_bye BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================
-- 3. INDEXES UNTUK PERFORMA QUERY MULTI-TENANT & RELASI
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_uid);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_users_staff_tenant ON users_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_staff_uid ON users_staff(uid);
CREATE INDEX IF NOT EXISTS idx_users_staff_email ON users_staff(email);

CREATE INDEX IF NOT EXISTS idx_academies_tenant ON academies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coaches_tenant ON coaches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant ON academy_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_academy ON academy_classes(academy_id);
CREATE INDEX IF NOT EXISTS idx_classes_coach ON academy_classes(coach_id);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_academy ON students(academy_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_spp ON students(spp_status);

CREATE INDEX IF NOT EXISTS idx_evaluations_tenant ON academy_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON academy_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON academy_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON academy_attendance(date DESC);

CREATE INDEX IF NOT EXISTS idx_spp_payments_tenant ON spp_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spp_payments_student ON spp_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_spp_payments_month ON spp_payments(month, year);

CREATE INDEX IF NOT EXISTS idx_courts_tenant ON courts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_court ON bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_class ON bookings(class_id);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant ON pos_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_student ON pos_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_global_ledger_tenant ON global_ledger(tenant_id);

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_tenant ON sponsors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_tenant ON event_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_tenant ON event_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_tenant ON event_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_tenant ON event_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_tenant ON event_matches(tenant_id);

-- =========================================================================
-- 4. PENEGAKAN ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Aktifkan RLS untuk semua tabel
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE spp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_matches ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Kebijakan RLS untuk Tabel `tenants`:
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenants_select_policy" ON tenants;
CREATE POLICY "tenants_select_policy" ON tenants
FOR SELECT USING (
  is_superadmin() 
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "tenants_insert_policy" ON tenants;
CREATE POLICY "tenants_insert_policy" ON tenants
FOR INSERT WITH CHECK (
  is_superadmin()
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "tenants_update_policy" ON tenants;
CREATE POLICY "tenants_update_policy" ON tenants
FOR UPDATE USING (
  is_superadmin()
  OR owner_uid = auth.uid()::text
  OR id::text = auth.uid()::text
);

DROP POLICY IF EXISTS "tenants_delete_policy" ON tenants;
CREATE POLICY "tenants_delete_policy" ON tenants
FOR DELETE USING (
  is_superadmin()
);

-- -------------------------------------------------------------------------
-- Kebijakan RLS Generik untuk Tabel-Tabel Berbasis `tenant_id`
-- -------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'invitations', 'users_staff', 'academies', 'coaches', 'academy_classes', 
            'students', 'academy_evaluations', 'academy_attendance', 'spp_payments',
            'courts', 'bookings', 'transactions', 'products', 'pos_transactions', 
            'global_ledger', 'events', 'sponsors', 'event_categories', 
            'event_registrations', 'event_expenses', 'event_documents', 'event_matches'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON %I;', tbl);
        EXECUTE format(
          'CREATE POLICY "tenant_isolation_policy" ON %I FOR ALL 
           USING (user_has_tenant_access(tenant_id::text)) 
           WITH CHECK (user_has_tenant_access(tenant_id::text));', 
          tbl
        );
    END LOOP;
END $$;
