-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FINAL SUPABASE SECURITY HARDENING MIGRATION (FASE 1AA-HARDENED)
-- Target: Supabase PostgreSQL (SQL Editor / Migration Engine)
-- Architecture: React Client SDK (Cloudflare Pages) -> Supabase PostgreSQL (RLS)
-- Key Guarantees:
--   1. Strict Owner Role Boundary (Tenant ownership derived EXCLUSIVELY from tenants.owner_uid)
--   2. Atomic Tenant Ownership Claim RPC (claim_tenant_ownership) for verified onboarding
--   3. Pure Engine-Level Direct UID Mutation Sealing (PostgreSQL Column Privileges + SECURITY DEFINER Isolation)
--   4. Prevention of Role Escalation (Owner/Admin CANNOT set role to 'owner' or 'superadmin' on users_staff)
--   5. Safe Verified Platform Superadmin Bootstrap (bootstrap_platform_superadmin RPC)
--   6. Hardened Tenant Column Protection Trigger (protect_tenants_columns) protecting id, tenant_id, owner_uid, owner_email
--   7. Canonical Tenant Identity Enforcement (tenants.tenant_id TEXT used everywhere consistently)
--   8. Sealed token_hash on invitations (Column-level SELECT Grant excluding token_hash)
--   9. Strict 24-Tables Existence & Data Integrity Validation (Halts migration if any table or tenant_id mapping fails)
--  10. Least-Privilege Role-Based Access Control (RBAC) RLS policies across ALL 24 tables (Financial access restricted to Superadmin/Owner/Admin/Kasir)
--  11. Explicit SECURITY DEFINER search_path = public, auth, extensions, pg_temp
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- =========================================================================
-- 1. SCHEMAS: PLATFORM SUPERADMINS, TENANTS, INVITATIONS, & USERS_STAFF
-- =========================================================================

-- A. Platform Superadmins Table
CREATE TABLE IF NOT EXISTS public.platform_superadmins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_superadmins (email, notes)
VALUES ('erizamaulana.bramantya@gmail.com', 'Primary Platform Superadmin')
ON CONFLICT (email) DO NOTHING;

-- B. Canonical Tenant Identity Schema
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE public.tenants SET tenant_id = id::text WHERE tenant_id IS NULL OR trim(tenant_id) = '';

-- C. Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    invite_email TEXT NOT NULL,
    email TEXT NOT NULL,
    invite_role TEXT NOT NULL DEFAULT 'staff',
    role TEXT NOT NULL DEFAULT 'staff',
    token_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'revoked', 'expired'
    created_by_uid TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMPTZ,
    accepted_by_uid TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by_uid TEXT
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- D. Users Staff Columns
ALTER TABLE public.users_staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users_staff ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- E. Preflight Check for Duplicate Pending Invitations
DO $$
DECLARE
    v_dup_count INT := 0;
    v_dup_details TEXT := '';
BEGIN
    SELECT COUNT(*), COALESCE(string_agg(tenant_id || ':' || invite_email, ', '), '')
    INTO v_dup_count, v_dup_details
    FROM (
        SELECT tenant_id, LOWER(trim(invite_email)) AS invite_email
        FROM public.invitations
        WHERE status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL
        GROUP BY tenant_id, LOWER(trim(invite_email))
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Terdeteksi % duplikasi undangan pending pada tenant/email berikut: %. Silakan selesaikan duplikasi data secara manual sebelum melanjutkan migrasi.', v_dup_count, v_dup_details
        USING ERRCODE = '23505';
    END IF;
END $$;

-- Partial Unique Index on Invitations (Engine-level 1 pending invitation per tenant/email)
DROP INDEX IF EXISTS public.idx_invitations_pending_unique;
CREATE UNIQUE INDEX idx_invitations_pending_unique 
ON public.invitations (tenant_id, LOWER(invite_email)) 
WHERE status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_invite_email ON public.invitations(tenant_id, invite_email);

-- =========================================================================
-- 2. OTORISASI SUPERADMIN, BOOTSTRAP & TENANT OWNERSHIP CLAIM RPC
-- =========================================================================

-- 1. is_superadmin() - Pure UID-Based Read-Only Function
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    caller_uid TEXT;
BEGIN
    caller_uid := auth.uid()::text;
    IF caller_uid IS NULL OR trim(caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.platform_superadmins
        WHERE auth_uid = caller_uid
    );
END;
$$;

-- 2. bootstrap_platform_superadmin() - Verified One-Time Bootstrap RPC
CREATE OR REPLACE FUNCTION public.bootstrap_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_auth_email TEXT;
    v_email_confirmed TIMESTAMPTZ;
    v_updated INT := 0;
BEGIN
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    SELECT LOWER(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_email_confirmed
    FROM auth.users u
    WHERE u.id::text = v_caller_uid;

    IF v_auth_email IS NULL OR v_email_confirmed IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.platform_superadmins
    SET auth_uid = v_caller_uid
    WHERE LOWER(trim(email)) = v_auth_email
      AND auth_uid IS NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN (v_updated > 0);
END;
$$;

-- 3. claim_tenant_ownership(target_tenant_id TEXT) - Atomic Owner Binding RPC for Onboarding
CREATE OR REPLACE FUNCTION public.claim_tenant_ownership(target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_auth_email TEXT;
    v_email_confirmed TIMESTAMPTZ;
    v_tenant_record RECORD;
    v_updated INT := 0;
BEGIN
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    SELECT LOWER(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_email_confirmed
    FROM auth.users u
    WHERE u.id::text = v_caller_uid;

    IF v_auth_email IS NULL OR v_email_confirmed IS NULL THEN
        RAISE EXCEPTION 'Klaim kepemilikan tenant gagal: Email belum diverifikasi.';
    END IF;

    SELECT t.id, t.tenant_id, t.owner_uid, LOWER(trim(t.owner_email)) AS owner_email
    INTO v_tenant_record
    FROM public.tenants t
    WHERE t.tenant_id::text = target_tenant_id
    FOR UPDATE;

    IF v_tenant_record.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_tenant_record.owner_uid IS NOT NULL AND trim(v_tenant_record.owner_uid) <> '' THEN
        IF v_tenant_record.owner_uid = v_caller_uid THEN
            RETURN TRUE;
        ELSE
            RAISE EXCEPTION 'Klaim kepemilikan ditolak: Tenant ini telah memiliki pemilik terikat.';
        END IF;
    END IF;

    IF v_tenant_record.owner_email <> v_auth_email THEN
        RETURN FALSE;
    END IF;

    UPDATE public.tenants
    SET owner_uid = v_caller_uid
    WHERE tenant_id::text = target_tenant_id AND (owner_uid IS NULL OR trim(owner_uid) = '');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN (v_updated = 1);
END;
$$;

-- Platform Superadmins RLS Policies
DROP POLICY IF EXISTS "platform_superadmins_select_policy" ON public.platform_superadmins;
CREATE POLICY "platform_superadmins_select_policy" ON public.platform_superadmins
FOR SELECT USING (
    public.is_superadmin() OR auth.uid()::text = auth_uid
);

DROP POLICY IF EXISTS "platform_superadmins_insert_policy" ON public.platform_superadmins;
CREATE POLICY "platform_superadmins_insert_policy" ON public.platform_superadmins
FOR INSERT WITH CHECK (
    public.is_superadmin()
);

DROP POLICY IF EXISTS "platform_superadmins_update_policy" ON public.platform_superadmins;
CREATE POLICY "platform_superadmins_update_policy" ON public.platform_superadmins
FOR UPDATE USING (
    public.is_superadmin()
) WITH CHECK (
    public.is_superadmin()
);

DROP POLICY IF EXISTS "platform_superadmins_delete_policy" ON public.platform_superadmins;
CREATE POLICY "platform_superadmins_delete_policy" ON public.platform_superadmins
FOR DELETE USING (
    public.is_superadmin()
);

-- =========================================================================
-- 3. FUNGSI OTORISASI DATABASE TEPERCAYA (SECURITY DEFINER)
-- Parameter: check_tenant_id TEXT (Preserved)
-- =========================================================================

-- 1. get_user_tenant_role(check_tenant_id TEXT)
-- Strict Role Hierarchy: Ownership derived EXCLUSIVELY from tenants.owner_uid
CREATE OR REPLACE FUNCTION public.get_user_tenant_role(check_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    caller_uid TEXT;
    staff_role TEXT;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN NULL;
    END IF;

    IF public.is_superadmin() THEN
        RETURN 'superadmin';
    END IF;

    caller_uid := auth.uid()::text;
    IF caller_uid IS NULL OR trim(caller_uid) = '' THEN
        RETURN NULL;
    END IF;

    -- Owner Check EXCLUSIVELY on public.tenants table using Canonical tenant_id
    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.tenant_id::text = check_tenant_id
          AND t.owner_uid::text = caller_uid
          AND COALESCE(t.is_active, FALSE) = TRUE
    ) THEN
        RETURN 'owner';
    END IF;

    -- Staff Check on public.users_staff table
    SELECT LOWER(s.role) INTO staff_role
    FROM public.users_staff s
    WHERE s.tenant_id::text = check_tenant_id
      AND s.uid::text = caller_uid
      AND COALESCE(s.is_active, FALSE) = TRUE
      AND LOWER(COALESCE(s.status, 'inactive')) IN ('active', 'aktif')
    LIMIT 1;

    IF staff_role IS NOT NULL THEN
        IF staff_role IN ('kasir', 'cashier') THEN RETURN 'kasir';
        ELSIF staff_role IN ('coach', 'pelatih') THEN RETURN 'coach';
        ELSIF staff_role IN ('admin', 'administrator') THEN RETURN 'admin';
        ELSIF staff_role IN ('staff', 'staf') THEN RETURN 'staff';
        ELSE RETURN NULL; -- Excludes 'owner' or 'superadmin' from users_staff
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Role Access Helpers for Least Privilege RLS
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN RETURN (public.get_user_tenant_role(check_tenant_id) IS NOT NULL); END; $$;

CREATE OR REPLACE FUNCTION public.user_is_tenant_admin_or_owner(check_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN RETURN (public.get_user_tenant_role(check_tenant_id) IN ('superadmin', 'owner', 'admin')); END; $$;

CREATE OR REPLACE FUNCTION public.user_can_manage_financials(check_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN RETURN (public.get_user_tenant_role(check_tenant_id) IN ('superadmin', 'owner', 'admin', 'kasir')); END; $$;

CREATE OR REPLACE FUNCTION public.user_can_manage_academy(check_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN RETURN (public.get_user_tenant_role(check_tenant_id) IN ('superadmin', 'owner', 'admin', 'coach')); END; $$;

CREATE OR REPLACE FUNCTION public.user_can_manage_pos(check_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN RETURN (public.get_user_tenant_role(check_tenant_id) IN ('superadmin', 'owner', 'admin', 'kasir', 'staff')); END; $$;

CREATE OR REPLACE FUNCTION public.get_coach_id_for_user(check_tenant_id TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
    found_coach_id TEXT;
    caller_uid TEXT;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN RETURN NULL; END IF;
    caller_uid := auth.uid()::text;
    IF caller_uid IS NULL OR trim(caller_uid) = '' THEN RETURN NULL; END IF;
    SELECT c.id::text INTO found_coach_id FROM public.coaches c WHERE c.tenant_id::text = check_tenant_id AND c.auth_uid::text = caller_uid LIMIT 1;
    RETURN found_coach_id;
END;
$$;

-- =========================================================================
-- 4. INVITATION RPCs (CREATE, GET, CLAIM, REVOKE)
-- =========================================================================

-- 1. create_staff_invitation()
CREATE OR REPLACE FUNCTION public.create_staff_invitation(
    target_tenant_id TEXT,
    invite_email TEXT,
    invite_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_caller_role TEXT;
    v_clean_email TEXT;
    v_clean_role TEXT;
    v_tenant_active BOOLEAN;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_invitation_id UUID;
    v_candidate_staff_ids UUID[];
    v_candidate_count INT := 0;
BEGIN
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terotentikasi.';
    END IF;

    IF target_tenant_id IS NULL OR trim(target_tenant_id) = '' THEN
        RAISE EXCEPTION 'ID Tenant tidak boleh kosong.';
    END IF;

    SELECT COALESCE(is_active, FALSE) INTO v_tenant_active
    FROM public.tenants
    WHERE tenant_id::text = target_tenant_id;

    IF v_tenant_active IS NULL OR v_tenant_active = FALSE THEN
        RAISE EXCEPTION 'Tenant % tidak aktif atau tidak ditemukan.', target_tenant_id;
    END IF;

    v_caller_role := LOWER(COALESCE(public.get_user_tenant_role(target_tenant_id), ''));

    IF NOT public.is_superadmin() THEN
        IF v_caller_role IS NULL OR v_caller_role = '' OR v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Admin tenant aktif yang berhak membuat undangan.';
        END IF;

        v_clean_role := LOWER(trim(COALESCE(invite_role, '')));

        IF v_caller_role = 'admin' AND v_clean_role IN ('owner', 'admin', 'administrator', 'superadmin') THEN
            RAISE EXCEPTION 'Akses ditolak: Admin tidak berwenang mengundang pengguna dengan peran %.', invite_role;
        END IF;

        IF v_clean_role IN ('owner', 'superadmin') THEN
            RAISE EXCEPTION 'Akses ditolak: Peran Owner dan Superadmin tidak dapat dibuat via undangan staf.';
        END IF;
    ELSE
        v_clean_role := LOWER(trim(COALESCE(invite_role, '')));
    END IF;

    IF v_clean_role NOT IN ('admin', 'administrator', 'kasir', 'cashier', 'coach', 'pelatih', 'staff', 'staf') THEN
        RAISE EXCEPTION 'Peran undangan tidak valid: %.', invite_role;
    END IF;

    IF v_clean_role IN ('administrator') THEN v_clean_role := 'admin';
    ELSIF v_clean_role IN ('cashier') THEN v_clean_role := 'kasir';
    ELSIF v_clean_role IN ('pelatih') THEN v_clean_role := 'coach';
    ELSIF v_clean_role IN ('staf') THEN v_clean_role := 'staff';
    END IF;

    v_clean_email := LOWER(trim(COALESCE(invite_email, '')));
    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'Format email undangan tidak valid.';
    END IF;

    -- Auto-transition expired pending invitations
    UPDATE public.invitations
    SET status = 'expired'
    WHERE tenant_id::text = target_tenant_id
      AND LOWER(trim(invite_email)) = v_clean_email
      AND status = 'pending'
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at <= now();

    -- CTE Multi-Row Lock
    WITH locked_candidates AS (
        SELECT s.id
        FROM public.users_staff s
        WHERE s.tenant_id::text = target_tenant_id
          AND LOWER(trim(s.email)) = v_clean_email
          AND LOWER(trim(s.role)) = v_clean_role
          AND COALESCE(s.is_active, FALSE) = TRUE
          AND LOWER(COALESCE(s.status, 'inactive')) IN ('active', 'aktif')
          AND s.uid IS NULL
        ORDER BY s.id
        FOR UPDATE
    )
    SELECT array_agg(id) INTO v_candidate_staff_ids FROM locked_candidates;

    v_candidate_count := COALESCE(array_length(v_candidate_staff_ids, 1), 0);

    IF v_candidate_count = 0 THEN
        RAISE EXCEPTION 'Tidak ditemukan calon akun staf aktif yang belum terikat UID untuk email % dengan peran % pada tenant %.', v_clean_email, v_clean_role, target_tenant_id;
    ELSIF v_candidate_count > 1 THEN
        RAISE EXCEPTION 'Terdeteksi % akun staf duplikat untuk email % pada tenant %. Undangan dibatalkan demi keamanan.', v_candidate_count, v_clean_email, target_tenant_id;
    END IF;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
    v_expires_at := now() + INTERVAL '7 days';

    BEGIN
        INSERT INTO public.invitations (
            tenant_id, invite_email, email, invite_role, role,
            token_hash, status, created_by_uid, expires_at
        ) VALUES (
            target_tenant_id, v_clean_email, v_clean_email, v_clean_role, v_clean_role,
            v_token_hash, 'pending', v_caller_uid, v_expires_at
        ) RETURNING id INTO v_invitation_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Undangan pending aktif untuk email % pada tenant ini sudah ada.', v_clean_email;
    END;

    RETURN jsonb_build_object(
        'invitation_id', v_invitation_id,
        'tenant_id', target_tenant_id,
        'invite_email', v_clean_email,
        'invite_role', v_clean_role,
        'raw_token', v_raw_token,
        'expires_at', v_expires_at
    );
END;
$$;

-- 2. get_invitation_info()
CREATE OR REPLACE FUNCTION public.get_invitation_info(raw_invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_computed_hash TEXT;
    v_inv RECORD;
    v_tenant_name TEXT;
    v_masked_email TEXT;
    v_email_parts TEXT[];
    v_username TEXT;
    v_domain TEXT;
BEGIN
    IF raw_invite_token IS NULL OR trim(raw_invite_token) = '' THEN
        RETURN jsonb_build_object('is_valid', false, 'message', 'Undangan tidak valid.');
    END IF;

    v_computed_hash := encode(digest(raw_invite_token, 'sha256'), 'hex');

    SELECT i.id, i.tenant_id, LOWER(trim(COALESCE(i.invite_email, i.email))) AS email, LOWER(trim(COALESCE(i.invite_role, i.role))) AS role, i.expires_at, i.accepted_at, i.revoked_at, i.status
    INTO v_inv
    FROM public.invitations i
    WHERE i.token_hash = v_computed_hash;

    IF v_inv.id IS NULL THEN
        RETURN jsonb_build_object('is_valid', false, 'message', 'Undangan tidak ditemukan atau token tidak valid.');
    END IF;

    IF v_inv.accepted_at IS NOT NULL OR LOWER(v_inv.status) = 'accepted' THEN
        RETURN jsonb_build_object('is_valid', false, 'message', 'Undangan ini sudah pernah digunakan.');
    END IF;

    IF v_inv.revoked_at IS NOT NULL OR LOWER(v_inv.status) = 'revoked' THEN
        RETURN jsonb_build_object('is_valid', false, 'message', 'Undangan ini telah dibatalkan.');
    END IF;

    IF v_inv.expires_at <= now() OR LOWER(v_inv.status) = 'expired' THEN
        RETURN jsonb_build_object('is_valid', false, 'message', 'Masa berlaku undangan telah kedaluwarsa.');
    END IF;

    -- Email Masking
    v_email_parts := regexp_split_to_array(v_inv.email, '@');
    IF array_length(v_email_parts, 1) = 2 THEN
        v_username := v_email_parts[1];
        v_domain := v_email_parts[2];
        IF length(v_username) <= 2 THEN
            v_masked_email := substr(v_username, 1, 1) || '***@' || v_domain;
        ELSE
            v_masked_email := substr(v_username, 1, 1) || '***' || substr(v_username, length(v_username), 1) || '@' || v_domain;
        END IF;
    ELSE
        v_masked_email := '***@***.com';
    END IF;

    SELECT name INTO v_tenant_name
    FROM public.tenants
    WHERE tenant_id::text = v_inv.tenant_id;

    RETURN jsonb_build_object(
        'is_valid', true,
        'tenant_id', v_inv.tenant_id,
        'tenant_name', COALESCE(v_tenant_name, v_inv.tenant_id),
        'masked_email', v_masked_email,
        'invite_role', v_inv.role,
        'expires_at', v_inv.expires_at
    );
END;
$$;

-- 3. claim_staff_invitation() - Atomic & Verified Claim RPC
CREATE OR REPLACE FUNCTION public.claim_staff_invitation(raw_invite_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_auth_email TEXT;
    v_email_confirmed TIMESTAMPTZ;
    v_computed_hash TEXT;
    v_inv RECORD;
    v_candidate_staff_ids UUID[];
    v_candidate_count INT := 0;
    v_staff_id UUID;
    v_staff_updated INT := 0;
    v_inv_updated INT := 0;
BEGIN
    IF raw_invite_token IS NULL OR trim(raw_invite_token) = '' THEN
        RETURN FALSE;
    END IF;

    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    -- Strict email verification check directly against auth.users
    SELECT LOWER(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_email_confirmed
    FROM auth.users u
    WHERE u.id::text = v_caller_uid;

    IF v_auth_email IS NULL OR v_auth_email = '' OR v_email_confirmed IS NULL THEN
        RAISE EXCEPTION 'Klaim gagal: Email % belum diverifikasi.', v_auth_email;
    END IF;

    v_computed_hash := encode(digest(raw_invite_token, 'sha256'), 'hex');

    -- Lock invitation row FOR UPDATE
    SELECT i.id, i.tenant_id, LOWER(trim(COALESCE(i.invite_email, i.email))) AS invite_email, LOWER(trim(COALESCE(i.invite_role, i.role))) AS invite_role, i.expires_at, i.accepted_at, i.revoked_at, i.status
    INTO v_inv
    FROM public.invitations i
    WHERE i.token_hash = v_computed_hash
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_inv.accepted_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at <= now() OR LOWER(v_inv.status) <> 'pending' THEN
        RETURN FALSE;
    END IF;

    -- Enforce exact email match
    IF v_inv.invite_email <> v_auth_email THEN
        RETURN FALSE;
    END IF;

    -- CTE Multi-Row Candidate Lock
    WITH locked_candidates AS (
        SELECT s.id
        FROM public.users_staff s
        WHERE s.tenant_id::text = v_inv.tenant_id
          AND LOWER(trim(s.email)) = v_auth_email
          AND LOWER(trim(s.role)) = v_inv.invite_role
          AND COALESCE(s.is_active, FALSE) = TRUE
          AND LOWER(COALESCE(s.status, 'inactive')) IN ('active', 'aktif')
          AND s.uid IS NULL
        ORDER BY s.id
        FOR UPDATE
    )
    SELECT array_agg(id) INTO v_candidate_staff_ids FROM locked_candidates;

    v_candidate_count := COALESCE(array_length(v_candidate_staff_ids, 1), 0);

    IF v_candidate_count = 0 THEN
        RETURN FALSE;
    ELSIF v_candidate_count > 1 THEN
        RAISE EXCEPTION 'Klaim gagal: Terdeteksi % kandidat staf duplikat untuk email % pada tenant %.', v_candidate_count, v_auth_email, v_inv.tenant_id;
    END IF;

    v_staff_id := v_candidate_staff_ids[1];

    -- Atomic UPDATE on staff row (Bypasses column GRANTs via SECURITY DEFINER owner context)
    UPDATE public.users_staff
    SET uid = v_caller_uid,
        updated_at = now()
    WHERE id = v_staff_id AND uid IS NULL;

    GET DIAGNOSTICS v_staff_updated = ROW_COUNT;

    IF v_staff_updated <> 1 THEN
        RAISE EXCEPTION 'Gagal mengikat Auth UID ke record staf. Transaksi dibatalkan.';
    END IF;

    UPDATE public.invitations
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by_uid = v_caller_uid
    WHERE id = v_inv.id
      AND LOWER(status) = 'pending'
      AND accepted_at IS NULL
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_inv_updated = ROW_COUNT;

    IF v_inv_updated <> 1 THEN
        RAISE EXCEPTION 'Gagal memperbarui status undangan. Transaksi dibatalkan.';
    END IF;

    RETURN TRUE;
END;
$$;

-- 4. revoke_staff_invitation()
CREATE OR REPLACE FUNCTION public.revoke_staff_invitation(target_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_caller_role TEXT;
    v_inv RECORD;
    v_rev_updated INT := 0;
BEGIN
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terotentikasi.';
    END IF;

    SELECT id, tenant_id, accepted_at, revoked_at, status
    INTO v_inv
    FROM public.invitations
    WHERE id = target_invitation_id
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Undangan tidak ditemukan.';
    END IF;

    IF v_inv.accepted_at IS NOT NULL OR LOWER(v_inv.status) = 'accepted' THEN
        RAISE EXCEPTION 'Gagal membatalkan: Undangan ini telah diterima sebelumnya.';
    END IF;

    IF v_inv.revoked_at IS NOT NULL OR LOWER(v_inv.status) = 'revoked' THEN
        RAISE EXCEPTION 'Gagal membatalkan: Undangan ini telah dibatalkan sebelumnya.';
    END IF;

    v_caller_role := LOWER(COALESCE(public.get_user_tenant_role(v_inv.tenant_id), ''));
    IF NOT public.is_superadmin() AND v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Owner atau Admin tenant % yang berhak membatalkan undangan.', v_inv.tenant_id;
    END IF;

    UPDATE public.invitations
    SET status = 'revoked',
        revoked_at = now(),
        revoked_by_uid = v_caller_uid
    WHERE id = target_invitation_id
      AND LOWER(status) = 'pending'
      AND accepted_at IS NULL
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_rev_updated = ROW_COUNT;

    IF v_rev_updated <> 1 THEN
        RAISE EXCEPTION 'Gagal memperbarui status pembatalan undangan.';
    END IF;

    RETURN TRUE;
END;
$$;

-- Targeted REVOKE & GRANT per specific audited security function
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_platform_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_tenant_ownership(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_role(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_access(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_is_tenant_admin_or_owner(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_financials(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_academy(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_pos(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coach_id_for_user(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_staff_invitation(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_staff_invitation(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_staff_invitation(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invitation_info(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tenant_ownership(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_access(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_tenant_admin_or_owner(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_financials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_academy(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_pos(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_id_for_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_invitation(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_info(TEXT) TO anon, authenticated;

-- Column Grants on invitations (Sealed token_hash)
REVOKE ALL ON TABLE public.invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
    id, tenant_id, invite_email, email, invite_role, role, status,
    created_by_uid, expires_at, accepted_at, accepted_by_uid,
    revoked_at, revoked_by_uid, created_at
) ON public.invitations TO authenticated;

-- Pure Engine Column Grants on users_staff (Sealed direct UID/tenant_id/role mutation)
REVOKE UPDATE ON public.users_staff FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
    email, name, nickname, phone, photo_url, address, updated_at
) ON public.users_staff TO authenticated;

-- =========================================================================
-- 5. TRIGGER PROTECTION ON SENSITIVE COLUMNS
-- =========================================================================

-- 1. Trigger pada users_staff (Strict UID mutation sealing + Owner/Superadmin escalation blocking)
CREATE OR REPLACE FUNCTION public.protect_users_staff_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    caller_tenant_role TEXT;
BEGIN
    IF OLD.tenant_id::text IS DISTINCT FROM NEW.tenant_id::text THEN
        RAISE EXCEPTION 'Mencoba memindahkan record staf ke tenant lain ditolak.' USING ERRCODE = '42501';
    END IF;

    caller_tenant_role := public.get_user_tenant_role(OLD.tenant_id::text);

    IF NOT public.is_superadmin() THEN
        IF COALESCE(caller_tenant_role, '') NOT IN ('owner', 'admin') THEN
            IF OLD.role IS DISTINCT FROM NEW.role THEN
                RAISE EXCEPTION 'Perubahan role staf hanya diizinkan untuk Owner/Admin.' USING ERRCODE = '42501';
            END IF;
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                RAISE EXCEPTION 'Perubahan status staf hanya diizinkan untuk Owner/Admin.' USING ERRCODE = '42501';
            END IF;
            IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
                RAISE EXCEPTION 'Perubahan status aktif staf hanya diizinkan untuk Owner/Admin.' USING ERRCODE = '42501';
            END IF;
        END IF;

        -- Strictly block direct UID mutation via UPDATE statements on users_staff
        -- UID binding MUST be performed exclusively via claim_staff_invitation RPC
        IF OLD.uid IS DISTINCT FROM NEW.uid THEN
            IF OLD.uid IS NOT NULL THEN
                RAISE EXCEPTION 'Auth UID staf yang sudah terikat tidak dapat diubah kembali.' USING ERRCODE = '42501';
            END IF;

            IF NEW.uid IS NULL OR NEW.uid <> auth.uid()::text THEN
                RAISE EXCEPTION 'UID yang diikat harus cocok dengan Auth UID pengguna yang mengklaim.' USING ERRCODE = '42501';
            END IF;
        END IF;

        -- Prevent escalation to owner or superadmin role via users_staff UPDATE
        IF LOWER(COALESCE(NEW.role, '')) IN ('owner', 'superadmin') THEN
            RAISE EXCEPTION 'Pengangkatan role Owner atau Superadmin via users_staff dilarang.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_users_staff_columns ON public.users_staff;
CREATE TRIGGER trg_protect_users_staff_columns
BEFORE UPDATE ON public.users_staff
FOR EACH ROW
EXECUTE FUNCTION public.protect_users_staff_columns();

-- 2. Trigger pada tenants
CREATE OR REPLACE FUNCTION public.protect_tenants_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT public.is_superadmin() THEN
        IF OLD.id::text IS DISTINCT FROM NEW.id::text THEN
            RAISE EXCEPTION 'Perubahan primary key tenant (id) dilarang.' USING ERRCODE = '42501';
        END IF;
        IF OLD.tenant_id::text IS DISTINCT FROM NEW.tenant_id::text THEN
            RAISE EXCEPTION 'Perubahan tenant_id dilarang.' USING ERRCODE = '42501';
        END IF;
        IF OLD.owner_uid IS DISTINCT FROM NEW.owner_uid THEN
            RAISE EXCEPTION 'Pemindahan kepemilikan tenant (owner_uid) dilarang via UPDATE biasa.' USING ERRCODE = '42501';
        END IF;
        IF OLD.owner_email IS DISTINCT FROM NEW.owner_email THEN
            RAISE EXCEPTION 'Perubahan owner_email dilarang via UPDATE biasa.' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tenants_columns ON public.tenants;
CREATE TRIGGER trg_protect_tenants_columns
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.protect_tenants_columns();

-- =========================================================================
-- 6. STRICT 24-TABLES EXISTENCE VALIDATION & LEAST-PRIVILEGE RBAC MATRIX
-- =========================================================================

-- A. Strict Existence & Structure Validation across ALL 24 Mandatory Tables
DO $$
DECLARE
    tbl text;
    col_type text;
    table_row_count int;
    null_tenant_count int;
    orphaned_count int;
    all_mandatory_tables text[] := ARRAY[
        'platform_superadmins', 'tenants', 'invitations', 'users_staff',
        'academies', 'academy_classes', 'coaches', 'students', 
        'academy_evaluations', 'academy_attendance', 'spp_payments',
        'courts', 'bookings', 'transactions', 'global_ledger', 
        'pos_transactions', 'products', 'sponsors', 'events', 
        'event_categories', 'event_registrations', 'event_expenses', 
        'event_documents', 'event_matches'
    ];
    domain_tables text[] := ARRAY[
        'academies', 'academy_classes', 'coaches', 'students', 
        'academy_evaluations', 'academy_attendance', 'spp_payments',
        'courts', 'bookings', 'transactions', 'global_ledger', 
        'pos_transactions', 'products', 'sponsors', 'events', 
        'event_categories', 'event_registrations', 'event_expenses', 
        'event_documents', 'event_matches'
    ];
BEGIN
    -- 1. Validate Table Existence for ALL 24 Mandatory Tables
    FOREACH tbl IN ARRAY all_mandatory_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Tabel wajib "%" tidak ditemukan di schema public.', tbl USING ERRCODE = '42P01';
        END IF;
    END LOOP;

    -- 2. Validate tenant_id Column, Data Type, and Existing Data Isolation on 20 Domain Tables
    FOREACH tbl IN ARRAY domain_tables
    LOOP
        SELECT data_type INTO col_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id';

        IF col_type IS NULL THEN
            -- Check if table has data before altering
            EXECUTE format('SELECT COUNT(*) FROM public.%I;', tbl) INTO table_row_count;
            IF table_row_count > 0 THEN
                RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Tabel "%" belum memiliki kolom tenant_id dan sudah berisi % baris data. Pemetaan tenant pemilik data harus dilakukan secara manual sebelum migrasi dapat dilanjutkan.', tbl, table_row_count USING ERRCODE = '23502';
            ELSE
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id TEXT;', tbl);
                col_type := 'text';
            END IF;
        ELSIF col_type NOT IN ('text', 'character varying', 'uuid') THEN
            RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Tabel "%" memiliki kolom tenant_id dengan tipe data "%" yang tidak valid (wajib TEXT, VARCHAR, atau UUID).', tbl, col_type USING ERRCODE = '42804';
        END IF;

        -- Validate null or empty string depending on type (never use trim on uuid)
        IF col_type = 'uuid' THEN
            EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id IS NULL;', tbl) INTO null_tenant_count;
        ELSE
            EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id IS NULL OR trim(tenant_id) = '''';', tbl) INTO null_tenant_count;
        END IF;

        IF null_tenant_count > 0 THEN
            RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Terdeteksi % baris data pada tabel "%" yang belum memiliki tenant_id terisi.', null_tenant_count, tbl USING ERRCODE = '23502';
        END IF;

        -- Check for orphaned records (tenant_id not matching any tenant in public.tenants.tenant_id)
        EXECUTE format('
            SELECT COUNT(*) 
            FROM public.%I d 
            WHERE NOT EXISTS (
                SELECT 1 
                FROM public.tenants t 
                WHERE t.tenant_id::text = d.tenant_id::text
            );', tbl) INTO orphaned_count;

        IF orphaned_count > 0 THEN
            RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Ditemukan % baris data orphaned pada tabel "%" dengan tenant_id yang tidak terdaftar di public.tenants.tenant_id. Selesaikan inkonsistensi referensi tenant secara manual.', orphaned_count, tbl USING ERRCODE = '23503';
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;

-- B. Targeted Cleanup of Legacy Policies ONLY on Managed Tables
DO $$
DECLARE
    tbl text;
    pol record;
    managed_tables text[] := ARRAY[
        'platform_superadmins', 'tenants', 'invitations', 'users_staff',
        'academies', 'academy_classes', 'coaches', 'students', 
        'academy_evaluations', 'academy_attendance', 'spp_payments',
        'courts', 'bookings', 'transactions', 'global_ledger', 
        'pos_transactions', 'products', 'sponsors', 'events', 
        'event_categories', 'event_registrations', 'event_expenses', 
        'event_documents', 'event_matches'
    ];
BEGIN
    FOREACH tbl IN ARRAY managed_tables
    LOOP
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
        END LOOP;
    END LOOP;
END $$;

-- C. CORE SYSTEM & IDENTITY TABLES RLS POLICIES

-- 1. platform_superadmins
ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superadmins FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_superadmins_select_rbac" ON public.platform_superadmins FOR SELECT USING (public.is_superadmin() OR auth.uid()::text = auth_uid);
CREATE POLICY "platform_superadmins_insert_rbac" ON public.platform_superadmins FOR INSERT WITH CHECK (public.is_superadmin());
CREATE POLICY "platform_superadmins_update_rbac" ON public.platform_superadmins FOR UPDATE USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "platform_superadmins_delete_rbac" ON public.platform_superadmins FOR DELETE USING (public.is_superadmin());

-- 2. invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_rbac" ON public.invitations FOR SELECT USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin'));
CREATE POLICY "invitations_insert_rbac" ON public.invitations FOR INSERT WITH CHECK (public.is_superadmin());
CREATE POLICY "invitations_update_rbac" ON public.invitations FOR UPDATE USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "invitations_delete_rbac" ON public.invitations FOR DELETE USING (public.is_superadmin());

-- 3. tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_rbac" ON public.tenants FOR SELECT USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);
CREATE POLICY "tenants_insert_rbac" ON public.tenants FOR INSERT WITH CHECK (public.is_superadmin() OR (auth.uid() IS NOT NULL AND owner_uid::text = auth.uid()::text));
CREATE POLICY "tenants_update_rbac" ON public.tenants FOR UPDATE USING (public.is_superadmin() OR owner_uid::text = auth.uid()::text) WITH CHECK (public.is_superadmin() OR owner_uid::text = auth.uid()::text);
CREATE POLICY "tenants_delete_rbac" ON public.tenants FOR DELETE USING (public.is_superadmin());

-- 4. users_staff
ALTER TABLE public.users_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_staff FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_staff_select_rbac" ON public.users_staff FOR SELECT USING (
    public.is_superadmin()
    OR uid::text = auth.uid()::text
    OR (
      uid IS NULL 
      AND LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL)
    )
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);
CREATE POLICY "users_staff_insert_rbac" ON public.users_staff FOR INSERT WITH CHECK (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin'));
CREATE POLICY "users_staff_update_rbac" ON public.users_staff FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR uid::text = auth.uid()::text
) WITH CHECK (
    public.is_superadmin()
    OR (public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin') AND tenant_id::text = users_staff.tenant_id::text)
    OR (uid::text = auth.uid()::text AND tenant_id::text = users_staff.tenant_id::text)
);
CREATE POLICY "users_staff_delete_rbac" ON public.users_staff FOR DELETE USING (public.is_superadmin() OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin'));

-- D. DOMAIN TABLES LEAST-PRIVILEGE RBAC MATRIX (20 DOMAIN TABLES)
DO $$
DECLARE
    tbl text;
    fin_tables text[] := ARRAY['transactions', 'global_ledger', 'pos_transactions', 'spp_payments', 'event_expenses'];
    acad_tables text[] := ARRAY['academies', 'academy_classes', 'students', 'academy_evaluations', 'academy_attendance'];
    pos_tables text[] := ARRAY['products', 'courts', 'bookings'];
    event_tables text[] := ARRAY['events', 'event_categories', 'event_registrations', 'event_documents', 'event_matches', 'sponsors'];
BEGIN
    -- Financial Tables Group (Restricted SELECT/INSERT/UPDATE/DELETE to Superadmin/Owner/Admin/Kasir)
    FOREACH tbl IN ARRAY fin_tables
    LOOP
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_superadmin() OR public.user_can_manage_financials(tenant_id::text));', tbl || '_select_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_can_manage_financials(tenant_id::text));', tbl || '_insert_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text)) WITH CHECK (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_update_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_delete_rbac', tbl);
    END LOOP;

    -- Academy Tables Group
    FOREACH tbl IN ARRAY acad_tables
    LOOP
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));', tbl || '_select_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));', tbl || '_insert_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text)) WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));', tbl || '_update_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_delete_rbac', tbl);
    END LOOP;

    -- Coaches Table Group
    CREATE POLICY "coaches_select_rbac" ON public.coaches FOR SELECT USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));
    CREATE POLICY "coaches_insert_rbac" ON public.coaches FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));
    CREATE POLICY "coaches_update_rbac" ON public.coaches FOR UPDATE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text) OR auth_uid::text = auth.uid()::text) WITH CHECK (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text) OR auth_uid::text = auth.uid()::text);
    CREATE POLICY "coaches_delete_rbac" ON public.coaches FOR DELETE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));

    -- POS & Inventory Tables Group
    FOREACH tbl IN ARRAY pos_tables
    LOOP
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));', tbl || '_select_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_can_manage_pos(tenant_id::text));', tbl || '_insert_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_superadmin() OR public.user_can_manage_pos(tenant_id::text)) WITH CHECK (public.is_superadmin() OR public.user_can_manage_pos(tenant_id::text));', tbl || '_update_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_delete_rbac', tbl);
    END LOOP;

    -- Event Management Master Tables Group
    FOREACH tbl IN ARRAY event_tables
    LOOP
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));', tbl || '_select_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_insert_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text)) WITH CHECK (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_update_rbac', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));', tbl || '_delete_rbac', tbl);
    END LOOP;

    -- Special RBAC Exception: event_registrations INSERT is allowed for Kasir/Staff at POS counter
    EXECUTE 'DROP POLICY IF EXISTS event_registrations_insert_rbac ON public.event_registrations;';
    EXECUTE 'CREATE POLICY event_registrations_insert_rbac ON public.event_registrations FOR INSERT WITH CHECK (public.is_superadmin() OR public.user_can_manage_pos(tenant_id::text));';
END $$;

-- =========================================================================
-- 7. READ-ONLY VERIFICATION QUERIES (PREFLIGHT AUDIT & CATALOG INSPECTION)
-- =========================================================================

-- Preflight Query 0: Audit pending invitations duplicates
SELECT tenant_id, LOWER(trim(invite_email)) AS clean_email, COUNT(*) AS pending_count
FROM public.invitations WHERE status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL
GROUP BY tenant_id, LOWER(trim(invite_email)) HAVING COUNT(*) > 1;

-- Query 1: Verify Column Privileges on invitations & users_staff
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_name IN ('invitations', 'users_staff')
ORDER BY table_name, grantee, column_name;

-- Query 2: Verify RLS & FORCE RLS status on core tenant tables
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables WHERE schemaname = 'public' 
  AND tablename IN ('tenants', 'invitations', 'users_staff', 'coaches', 'transactions');

-- Query 3: Verify Superadmin Auth UID binding status
SELECT id, email, auth_uid, (auth_uid IS NOT NULL) AS is_bound, created_at 
FROM public.platform_superadmins;

-- Query 4: Verify Functions SECURITY DEFINER and search_path
SELECT p.proname AS function_name, pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS is_security_definer, p.proconfig AS search_path_config
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('is_superadmin', 'get_user_tenant_role', 'create_staff_invitation', 'claim_staff_invitation', 'revoke_staff_invitation', 'claim_tenant_ownership');
