-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FASE 1: CRITICAL DATABASE SECURITY HARDENING (REVISI PRESISI)
-- Target: Supabase PostgreSQL (SQL Editor / Direct Migration)
-- Focus: Row Level Security (RLS) Hardening & Trusted Authorization Functions
-- Safe & Non-Destructive: Kompatibel penuh dengan tipe data TEXT/UUID aktual
-- =========================================================================

-- Aktifkan ekstensi pgcrypto jika belum ada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- BAGIAN 1: TABEL PLATFORM SUPERADMINS & HARDENED SEED DATA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.platform_superadmins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Aktifkan RLS pada platform_superadmins
ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;

-- Seed email Super Admin utama (case-insensitive deduplication)
INSERT INTO public.platform_superadmins (email, notes)
VALUES ('erizamaulana.bramantya@gmail.com', 'Primary Platform Superadmin')
ON CONFLICT (email) DO NOTHING;

-- Kebijakan RLS platform_superadmins: Hanya Super Admin yang bisa melihat daftar ini
DROP POLICY IF EXISTS "platform_superadmins_select_policy" ON public.platform_superadmins;
CREATE POLICY "platform_superadmins_select_policy" ON public.platform_superadmins
FOR SELECT USING (
    LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'erizamaulana.bramantya@gmail.com'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
);

-- =========================================================================
-- BAGIAN 2: SKEMA ENHANCEMENT PADA TABEL COACHES (KOMPATIBILITAS AMAN)
-- =========================================================================
-- Pastikan kolom auth_uid ada tanpa merusak tipe data aktual (bisa TEXT atau UUID)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coaches' 
          AND column_name = 'auth_uid'
    ) THEN
        ALTER TABLE public.coaches ADD COLUMN auth_uid UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coaches_auth_uid ON public.coaches(auth_uid);
CREATE INDEX IF NOT EXISTS idx_coaches_tenant_id ON public.coaches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coaches_email_clean ON public.coaches(LOWER(email));

-- =========================================================================
-- BAGIAN 3: FUNGSI OTORISASI DATABASE TEPERCAYA (TRUSTED FUNCTIONS)
-- =========================================================================

-- 1. FUNGSI is_superadmin()
-- PERBAIKAN CRIT-01: Menghapus pengecekan 'user_metadata' ->> 'role'.
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_email TEXT;
    caller_app_role TEXT;
BEGIN
    caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
    caller_app_role := LOWER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', ''));

    -- Cek server-signed app_metadata
    IF caller_app_role = 'superadmin' THEN
        RETURN TRUE;
    END IF;

    -- Fallback email utama
    IF caller_email = 'erizamaulana.bramantya@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- Cek tabel terpercaya public.platform_superadmins
    IF caller_email <> '' AND EXISTS (
        SELECT 1 FROM public.platform_superadmins
        WHERE LOWER(email) = caller_email
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 2. FUNGSI get_user_tenant_role(target_tenant_id TEXT)
-- PERBAIKAN REVISI 2: Normalisasi role 'staff', 'cashier' -> 'kasir' dan 'pelatih' -> 'coach'
CREATE OR REPLACE FUNCTION public.get_user_tenant_role(target_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_uid TEXT;
    caller_email TEXT;
    staff_record_role TEXT;
BEGIN
    IF public.is_superadmin() THEN
        RETURN 'superadmin';
    END IF;

    caller_uid := auth.uid()::text;
    caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

    IF caller_uid IS NULL AND caller_email = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Cek kepemilikan Owner
    IF EXISTS (
        SELECT 1 FROM public.tenants
        WHERE id::text = target_tenant_id
          AND (
            owner_uid::text = caller_uid
            OR id::text = caller_uid
            OR LOWER(COALESCE(owner_email, '')) = caller_email
          )
    ) THEN
        RETURN 'owner';
    END IF;

    -- 2. Cek staf aktif di users_staff
    SELECT LOWER(role) INTO staff_record_role
    FROM public.users_staff
    WHERE tenant_id::text = target_tenant_id
      AND (
        uid::text = caller_uid
        OR id::text = caller_uid
        OR LOWER(COALESCE(email, '')) = caller_email
      )
      AND LOWER(COALESCE(status, 'active')) IN ('active', 'aktif')
    LIMIT 1;

    IF staff_record_role IS NOT NULL THEN
        -- Normalisasi role kasir/staf operasional
        IF staff_record_role IN ('kasir', 'staff', 'cashier') THEN
            RETURN 'kasir';
        END IF;

        -- Normalisasi role pelatih/coach
        IF staff_record_role IN ('coach', 'pelatih') THEN
            RETURN 'coach';
        END IF;

        RETURN staff_record_role;
    END IF;

    -- 3. Cek server-signed app_metadata tenantId
    IF (auth.jwt() -> 'app_metadata' ->> 'tenantId') = target_tenant_id THEN
        RETURN COALESCE(LOWER(auth.jwt() -> 'app_metadata' ->> 'role'), 'kasir');
    END IF;

    RETURN NULL;
END;
$$;

-- 3. FUNGSI user_has_tenant_access(target_tenant_id TEXT)
-- PERBAIKAN CRIT-02: Tidak lagi memeriksa user_metadata ->> 'tenantId'.
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN (public.get_user_tenant_role(target_tenant_id) IS NOT NULL);
END;
$$;

-- 4. FUNGSI get_coach_id_for_user(target_tenant_id TEXT)
-- PERBAIKAN REVISI 1: Mengembalikan TEXT untuk kompatibilitas penuh dengan tipe ID text/uuid
CREATE OR REPLACE FUNCTION public.get_coach_id_for_user(target_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    found_coach_id TEXT;
    caller_uid TEXT;
    caller_email TEXT;
BEGIN
    caller_uid := auth.uid()::text;
    caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

    SELECT id::text INTO found_coach_id
    FROM public.coaches
    WHERE tenant_id::text = target_tenant_id
      AND (
        auth_uid::text = caller_uid
        OR LOWER(COALESCE(email, '')) = caller_email
      )
    LIMIT 1;

    RETURN found_coach_id;
END;
$$;

-- Hak eksekusi fungsi
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_role(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_access(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_coach_id_for_user(TEXT) TO authenticated, anon;

-- =========================================================================
-- BAGIAN 4: PEMBERSIHAN KEBIJAKAN RLS LAMA (DROP BLANKET POLICIES)
-- =========================================================================
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete_policy" ON public.tenants;

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
            'event_registrations', 'event_expenses', 'event_documents', 'event_matches',
            'attendances', 'evaluations', 'audit_logs'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.%I;', tbl);
        END IF;
    END LOOP;
END $$;

-- =========================================================================
-- BAGIAN 5: PENEGAKAN KEBIJAKAN RLS BARU YANG GRANULAR & AMAN
-- =========================================================================

-- A. TABEL: tenants (PERBAIKAN CRIT-03)
CREATE POLICY "tenants_select_hardened" ON public.tenants
FOR SELECT USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
    OR id::text = auth.uid()::text
    OR LOWER(COALESCE(owner_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR id::text IN (
        SELECT s.tenant_id::text FROM public.users_staff s
        WHERE (s.uid::text = auth.uid()::text OR LOWER(COALESCE(s.email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
          AND LOWER(COALESCE(s.status, 'active')) IN ('active', 'aktif')
    )
);

CREATE POLICY "tenants_insert_hardened" ON public.tenants
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR (
        auth.uid() IS NOT NULL 
        AND owner_uid::text = auth.uid()::text
    )
);

CREATE POLICY "tenants_update_hardened" ON public.tenants
FOR UPDATE USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
    OR id::text = auth.uid()::text
    OR LOWER(COALESCE(owner_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
) WITH CHECK (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
    OR id::text = auth.uid()::text
    OR LOWER(COALESCE(owner_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);

CREATE POLICY "tenants_delete_hardened" ON public.tenants
FOR DELETE USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
);

-- B. TABEL: users_staff & invitations
CREATE POLICY "users_staff_select_hardened" ON public.users_staff
FOR SELECT USING (
    public.is_superadmin()
    OR uid::text = auth.uid()::text
    OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (public.get_user_tenant_role(tenant_id::text) IS NOT NULL)
);

CREATE POLICY "users_staff_insert_hardened" ON public.users_staff
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "users_staff_update_hardened" ON public.users_staff
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "users_staff_delete_hardened" ON public.users_staff
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- Invitations
CREATE POLICY "invitations_select_hardened" ON public.invitations
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);

CREATE POLICY "invitations_insert_hardened" ON public.invitations
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "invitations_update_hardened" ON public.invitations
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);

CREATE POLICY "invitations_delete_hardened" ON public.invitations
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- C. TABEL KEUANGAN (PERBAIKAN REVISI 3: KASIR DIBERIKAN UPDATE PADA spp_payments)
-- transactions
CREATE POLICY "transactions_select_hardened" ON public.transactions
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "transactions_insert_hardened" ON public.transactions
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "transactions_update_hardened" ON public.transactions
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "transactions_delete_hardened" ON public.transactions
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- global_ledger
CREATE POLICY "global_ledger_select_hardened" ON public.global_ledger
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "global_ledger_insert_hardened" ON public.global_ledger
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "global_ledger_update_hardened" ON public.global_ledger
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "global_ledger_delete_hardened" ON public.global_ledger
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- pos_transactions
CREATE POLICY "pos_transactions_select_hardened" ON public.pos_transactions
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "pos_transactions_insert_hardened" ON public.pos_transactions
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "pos_transactions_update_hardened" ON public.pos_transactions
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "pos_transactions_delete_hardened" ON public.pos_transactions
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- spp_payments (KASIR DIIZINKAN UPDATE STATUS PELUNASAN KASIR POS)
CREATE POLICY "spp_payments_select_hardened" ON public.spp_payments
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "spp_payments_insert_hardened" ON public.spp_payments
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "spp_payments_update_hardened" ON public.spp_payments
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "spp_payments_delete_hardened" ON public.spp_payments
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- D. FASILITAS & KATALOG PRODUK: courts, bookings, products
CREATE POLICY "courts_select_hardened" ON public.courts
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);

CREATE POLICY "courts_insert_hardened" ON public.courts
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "courts_update_hardened" ON public.courts
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "courts_delete_hardened" ON public.courts
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- bookings
CREATE POLICY "bookings_select_hardened" ON public.bookings
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);

CREATE POLICY "bookings_insert_hardened" ON public.bookings
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "bookings_update_hardened" ON public.bookings
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "bookings_delete_hardened" ON public.bookings
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- products
CREATE POLICY "products_select_hardened" ON public.products
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "products_insert_hardened" ON public.products
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "products_update_hardened" ON public.products
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "products_delete_hardened" ON public.products
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- E. AKADEMI & ATLET: academies, coaches, academy_classes, students, attendance, evaluations
-- PERBAIKAN REVISI 1: Casting ID ke ::text pada seluruh relasi coach
-- PERBAIKAN REVISI 3: Kasir diizinkan UPDATE students untuk pelunasan biaya SPP/pendaftaran
CREATE POLICY "academies_select_hardened" ON public.academies
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);

CREATE POLICY "academies_insert_hardened" ON public.academies
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "academies_update_hardened" ON public.academies
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "academies_delete_hardened" ON public.academies
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- coaches
CREATE POLICY "coaches_select_hardened" ON public.coaches
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);

CREATE POLICY "coaches_insert_hardened" ON public.coaches
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "coaches_update_hardened" ON public.coaches
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND (
            id::text = public.get_coach_id_for_user(tenant_id::text)
            OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND (
            id::text = public.get_coach_id_for_user(tenant_id::text)
            OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
);

CREATE POLICY "coaches_delete_hardened" ON public.coaches
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- academy_classes
CREATE POLICY "academy_classes_select_hardened" ON public.academy_classes
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND (
            coach_id::text = public.get_coach_id_for_user(tenant_id::text)
            OR coach_id IS NULL
        )
    )
);

CREATE POLICY "academy_classes_insert_hardened" ON public.academy_classes
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "academy_classes_update_hardened" ON public.academy_classes
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "academy_classes_delete_hardened" ON public.academy_classes
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- students (KASIR DAPAT MENGUPDATE STATUS PEMBAYARAN SISWA DI KASIR POS)
CREATE POLICY "students_select_hardened" ON public.students
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND (
            class_id::text IN (
                SELECT c.id::text FROM public.academy_classes c
                WHERE c.coach_id::text = public.get_coach_id_for_user(students.tenant_id::text)
            )
            OR class_id IS NULL
        )
    )
);

CREATE POLICY "students_insert_hardened" ON public.students
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

CREATE POLICY "students_update_hardened" ON public.students
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin', 'kasir')
);

CREATE POLICY "students_delete_hardened" ON public.students
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- academy_attendance
CREATE POLICY "academy_attendance_select_hardened" ON public.academy_attendance
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_attendance.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_attendance_insert_hardened" ON public.academy_attendance
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_attendance.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_attendance_update_hardened" ON public.academy_attendance
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_attendance.tenant_id::text)
        )
    )
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_attendance.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_attendance_delete_hardened" ON public.academy_attendance
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- academy_evaluations
CREATE POLICY "academy_evaluations_select_hardened" ON public.academy_evaluations
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_evaluations.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_evaluations_insert_hardened" ON public.academy_evaluations
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_evaluations.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_evaluations_update_hardened" ON public.academy_evaluations
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_evaluations.tenant_id::text)
        )
    )
) WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR (
        public.get_user_tenant_role(tenant_id::text) = 'coach'
        AND class_id::text IN (
            SELECT c.id::text FROM public.academy_classes c
            WHERE c.coach_id::text = public.get_coach_id_for_user(academy_evaluations.tenant_id::text)
        )
    )
);

CREATE POLICY "academy_evaluations_delete_hardened" ON public.academy_evaluations
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

-- F. TURNAMEN & EVENT: events, sponsors, categories, registrations, expenses, documents, matches
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'events', 'sponsors', 'event_categories', 'event_registrations', 
            'event_expenses', 'event_documents', 'event_matches'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format(
                'CREATE POLICY "%s_select_hardened" ON public.%I 
                 FOR SELECT USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL);',
                tbl, tbl
            );

            IF tbl = 'event_registrations' THEN
                EXECUTE format(
                    'CREATE POLICY "%s_insert_hardened" ON public.%I 
                     FOR INSERT WITH CHECK (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin'', ''kasir''));',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_update_hardened" ON public.%I 
                     FOR UPDATE USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin'', ''kasir''))
                     WITH CHECK (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin'', ''kasir''));',
                    tbl, tbl
                );
            ELSE
                EXECUTE format(
                    'CREATE POLICY "%s_insert_hardened" ON public.%I 
                     FOR INSERT WITH CHECK (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin''));',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_update_hardened" ON public.%I 
                     FOR UPDATE USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin''))
                     WITH CHECK (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin''));',
                    tbl, tbl
                );
            END IF;

            EXECUTE format(
                'CREATE POLICY "%s_delete_hardened" ON public.%I 
                 FOR DELETE USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN (''owner'', ''admin''));',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- =========================================================================
-- BAGIAN 6: CAKUPAN TABEL TAMBAHAN (REVISI 4: attendances, evaluations, audit_logs)
-- =========================================================================
DO $$
BEGIN
    -- 1. TABEL: attendances (jika ada sebagai variasi/legacy dari academy_attendance)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendances') THEN
        ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "attendances_select_hardened" ON public.attendances;
        DROP POLICY IF EXISTS "attendances_insert_hardened" ON public.attendances;
        DROP POLICY IF EXISTS "attendances_update_hardened" ON public.attendances;
        DROP POLICY IF EXISTS "attendances_delete_hardened" ON public.attendances;

        CREATE POLICY "attendances_select_hardened" ON public.attendances
        FOR SELECT USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND (
                    class_id::text IN (
                        SELECT c.id::text FROM public.academy_classes c
                        WHERE c.coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                    )
                    OR coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                )
            )
        );

        CREATE POLICY "attendances_insert_hardened" ON public.attendances
        FOR INSERT WITH CHECK (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND (
                    class_id::text IN (
                        SELECT c.id::text FROM public.academy_classes c
                        WHERE c.coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                    )
                    OR coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                )
            )
        );

        CREATE POLICY "attendances_update_hardened" ON public.attendances
        FOR UPDATE USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND (
                    class_id::text IN (
                        SELECT c.id::text FROM public.academy_classes c
                        WHERE c.coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                    )
                    OR coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                )
            )
        ) WITH CHECK (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND (
                    class_id::text IN (
                        SELECT c.id::text FROM public.academy_classes c
                        WHERE c.coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                    )
                    OR coach_id::text = public.get_coach_id_for_user(attendances.tenant_id::text)
                )
            )
        );

        CREATE POLICY "attendances_delete_hardened" ON public.attendances
        FOR DELETE USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
        );
    END IF;

    -- 2. TABEL: evaluations (jika ada sebagai variasi/legacy dari academy_evaluations)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluations') THEN
        ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "evaluations_select_hardened" ON public.evaluations;
        DROP POLICY IF EXISTS "evaluations_insert_hardened" ON public.evaluations;
        DROP POLICY IF EXISTS "evaluations_update_hardened" ON public.evaluations;
        DROP POLICY IF EXISTS "evaluations_delete_hardened" ON public.evaluations;

        CREATE POLICY "evaluations_select_hardened" ON public.evaluations
        FOR SELECT USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND class_id::text IN (
                    SELECT c.id::text FROM public.academy_classes c
                    WHERE c.coach_id::text = public.get_coach_id_for_user(evaluations.tenant_id::text)
                )
            )
        );

        CREATE POLICY "evaluations_insert_hardened" ON public.evaluations
        FOR INSERT WITH CHECK (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND class_id::text IN (
                    SELECT c.id::text FROM public.academy_classes c
                    WHERE c.coach_id::text = public.get_coach_id_for_user(evaluations.tenant_id::text)
                )
            )
        );

        CREATE POLICY "evaluations_update_hardened" ON public.evaluations
        FOR UPDATE USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND class_id::text IN (
                    SELECT c.id::text FROM public.academy_classes c
                    WHERE c.coach_id::text = public.get_coach_id_for_user(evaluations.tenant_id::text)
                )
            )
        ) WITH CHECK (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
            OR (
                public.get_user_tenant_role(tenant_id::text) = 'coach'
                AND class_id::text IN (
                    SELECT c.id::text FROM public.academy_classes c
                    WHERE c.coach_id::text = public.get_coach_id_for_user(evaluations.tenant_id::text)
                )
            )
        );

        CREATE POLICY "evaluations_delete_hardened" ON public.evaluations
        FOR DELETE USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
        );
    END IF;

    -- 3. TABEL: audit_logs (audit log tenant)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "audit_logs_select_hardened" ON public.audit_logs;
        DROP POLICY IF EXISTS "audit_logs_insert_hardened" ON public.audit_logs;
        DROP POLICY IF EXISTS "audit_logs_update_hardened" ON public.audit_logs;
        DROP POLICY IF EXISTS "audit_logs_delete_hardened" ON public.audit_logs;

        CREATE POLICY "audit_logs_select_hardened" ON public.audit_logs
        FOR SELECT USING (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
        );

        CREATE POLICY "audit_logs_insert_hardened" ON public.audit_logs
        FOR INSERT WITH CHECK (
            public.is_superadmin()
            OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
        );

        -- Audit log tidak boleh diubah oleh siapapun
        CREATE POLICY "audit_logs_update_hardened" ON public.audit_logs
        FOR UPDATE USING (
            public.is_superadmin()
        ) WITH CHECK (
            public.is_superadmin()
        );

        -- Audit log hanya boleh dihapus oleh Superadmin
        CREATE POLICY "audit_logs_delete_hardened" ON public.audit_logs
        FOR DELETE USING (
            public.is_superadmin()
        );
    END IF;
END $$;

-- =========================================================================
-- SELESAI: SELURUH RLS & FUNGSI OTORISASI BERHASIL DI-HARDENING
-- =========================================================================
