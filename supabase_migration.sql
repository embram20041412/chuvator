-- =========================================================================
-- CHUA SPORT CORE - SUPABASE POSTGRESQL SCHEMA MIGRATION & RLS POLICIES
-- Target: Supabase SQL Editor
-- Full Multi-Tenant Database Architecture Migration
-- =========================================================================

-- 0. Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABEL: tenants (Profil GOR / Arena SaaS)
-- =========================================================================
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
    bank_accounts JSONB DEFAULT '[]'::jsonb,
    qris_url TEXT,
    spp_billing_start_day INTEGER DEFAULT 1,
    spp_due_day INTEGER DEFAULT 10,
    receipt_footer_text TEXT,
    academy_pricing JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================
-- 2. TABEL: academies (Master Akademi Olahraga)
-- =========================================================================
CREATE TABLE IF NOT EXISTS academies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_name TEXT NOT NULL,
    sport_category TEXT,
    description TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academies_tenant ON academies(tenant_id);

-- =========================================================================
-- 3. TABEL: academy_classes (Kelas Akademi)
-- =========================================================================
CREATE TABLE IF NOT EXISTS academy_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id TEXT,
    class_name TEXT NOT NULL,
    sport TEXT,
    coach_name TEXT,
    schedules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_tenant ON academy_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_academy ON academy_classes(academy_id);

-- =========================================================================
-- 4. TABEL: coaches (Pelatih Akademi)
-- =========================================================================
CREATE TABLE IF NOT EXISTS coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    sport_category TEXT,
    specialization TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaches_tenant ON coaches(tenant_id);

-- =========================================================================
-- 5. TABEL: students (Siswa / Atlet Akademi)
-- =========================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id TEXT,
    class_id UUID REFERENCES academy_classes(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    birth_date DATE,
    player_role TEXT,
    sport_category TEXT,
    spp_status TEXT DEFAULT 'BELUM LUNAS',
    registration_fee_paid BOOLEAN DEFAULT false,
    registration_fee NUMERIC(12,2) DEFAULT 0,
    monthly_fee NUMERIC(12,2) DEFAULT 0,
    last_paid_month TEXT,
    contact_phone TEXT,
    parent_name TEXT,
    tournaments JSONB DEFAULT '[]'::jsonb,
    growth_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_spp ON students(spp_status);

-- =========================================================================
-- 6. TABEL: academy_evaluations (Evaluasi Rapor Siswa)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_evaluations_tenant ON academy_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_class ON academy_evaluations(class_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON academy_evaluations(student_id);

-- =========================================================================
-- 7. TABEL: academy_attendance (Presensi Sesi Latihan)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON academy_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON academy_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON academy_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON academy_attendance(date DESC);

-- =========================================================================
-- 8. TABEL: courts (Lapangan Venue / Arena)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_courts_tenant ON courts(tenant_id);

-- =========================================================================
-- 9. TABEL: bookings (Booking Lapangan)
-- =========================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
    court_name TEXT,
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
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_court ON bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);

-- =========================================================================
-- 10. TABEL: transactions (Penerimaan Kas / Keuangan Venue)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- =========================================================================
-- 11. TABEL: products (Master Produk Retail / POS Kasir)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

-- =========================================================================
-- 12. TABEL: pos_transactions (Struk Transaksi Kasir POS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant ON pos_transactions(tenant_id);

-- =========================================================================
-- 13. TABEL: global_ledger (Buku Kas Besar Keuangan Global)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_global_ledger_tenant ON global_ledger(tenant_id);

-- =========================================================================
-- 14. TABEL: sponsors (Data Sponsor & CRM Event)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    name TEXT,
    event_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_sponsors_tenant ON sponsors(tenant_id);

-- =========================================================================
-- 15. TABEL: events (Turnamen & Kejuaraan Olahraga)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);

-- =========================================================================
-- 16. TABEL: event_categories (Kategori Nomor Pertandingan Event)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_event_categories_tenant ON event_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_event ON event_categories(event_id);

-- =========================================================================
-- 17. TABEL: event_registrations (Pendaftaran Peserta Turnamen)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_event_registrations_tenant ON event_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);

-- =========================================================================
-- 18. TABEL: event_expenses (Pengeluaran Operasional Event)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_event_expenses_tenant ON event_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON event_expenses(event_id);

-- =========================================================================
-- 19. TABEL: event_documents (Dokumen & Regulasi Event)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_event_documents_tenant ON event_documents(tenant_id);

-- =========================================================================
-- 20. TABEL: event_matches (Bagan & Jadwal Partai Pertandingan)
-- =========================================================================
CREATE TABLE IF NOT EXISTS event_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    category_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_event_matches_tenant ON event_matches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_event ON event_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_category ON event_matches(category_id);

-- =========================================================================
-- 21. TABEL: users_staff (User Staf & Pengelola Arena)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    status TEXT DEFAULT 'active',
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_staff_tenant ON users_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_staff_email ON users_staff(email);

-- =========================================================================
-- 22. TABEL: invitations (Undangan Bergabung Staf / Operator)
-- =========================================================================
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

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT ISOLATION
-- =========================================================================

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'tenants', 'academies', 'academy_classes', 'coaches', 'students',
            'academy_evaluations', 'academy_attendance', 'courts', 'bookings',
            'transactions', 'products', 'pos_transactions', 'global_ledger',
            'sponsors', 'events', 'event_categories', 'event_registrations',
            'event_expenses', 'event_documents', 'event_matches', 'users_staff', 'invitations'
        ])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON %I;', tbl);
        EXECUTE format('CREATE POLICY "Tenant Isolation Policy" ON %I FOR ALL USING (tenant_id::text = auth.uid()::text) WITH CHECK (tenant_id::text = auth.uid()::text);', tbl);
    END LOOP;
END $$;
