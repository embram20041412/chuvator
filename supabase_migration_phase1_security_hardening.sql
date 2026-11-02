-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FASE 1U: FINAL DATABASE SECURITY CONSOLIDATION
-- Target: Supabase PostgreSQL (SQL Editor)
-- Architecture: React Client SDK (Cloudflare Pages) -> Supabase PostgreSQL (RLS)
-- Key Security Guarantees:
--   1. Targeted Function Privileges (Explicit REVOKE/GRANT per audited function, zero mass schema REVOKE)
--   2. Valid CTE Multi-Row Candidate Locking (WITH locked_candidates AS (...) SELECT array_agg(id) FOR UPDATE)
--   3. Fail-Closed Tenant & Staff Status Validation (COALESCE(is_active, FALSE) = TRUE)
--   4. Immutable Partial Unique Engine Index (idx_invitations_pending_unique)
--   5. Expired Pending Invitation Auto-Transition (status = 'expired') prior to New Invitation Creation
--   6. Canonical Tenant Identity Standardization (tenant_id TEXT) across all tables & functions
--   7. Cryptographic SHA-256 Token Sealing (token_hash) & Zero Raw Token Storage in Database
--   8. Column Privilege Revocation (token_hash Sealed from Direct PostgREST SELECT for anon & authenticated)
--   9. Masked Email Preview RPC (get_invitation_info) for Anon & Authenticated Users
--  10. Pure Read-Only Authorization Functions with Preserved Signatures (check_tenant_id TEXT)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- =========================================================================
-- 1. SCHEMAS: INVITATIONS, PLATFORM SUPERADMINS, TENANTS & USERS_STAFF COLUMNS
-- =========================================================================
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

-- Canonical Tenant Identity Schema
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE public.tenants SET tenant_id = id::text WHERE tenant_id IS NULL;

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMPTZ,
    accepted_by_uid TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by_uid TEXT
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Ensure users_staff has both is_active and status columns for canonical schema compatibility
ALTER TABLE public.users_staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users_staff ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Drop outdated indexes if present
DROP INDEX IF EXISTS public.idx_invitations_pending_unique;

-- Immutable Partial Unique Index: Guarantees 1 active pending invitation per (tenant_id, LOWER(invite_email))
CREATE UNIQUE INDEX idx_invitations_pending_unique 
ON public.invitations (tenant_id, LOWER(invite_email)) 
WHERE status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_invite_email ON public.invitations(tenant_id, invite_email);

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
-- 2. FUNGSI OTORISASI DATABASE TEPERCAYA (SECURITY DEFINER)
-- Parameter: check_tenant_id TEXT (Preserved)
-- =========================================================================

-- 1. get_user_tenant_role(check_tenant_id TEXT) - Canonical Tenant Identity Lookup (Fail-Closed)
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

    -- Canonical Owner Check on tenants (Fail-Closed: is_active MUST be TRUE)
    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.tenant_id::text = check_tenant_id
          AND t.owner_uid::text = caller_uid
          AND COALESCE(t.is_active, FALSE) = TRUE
    ) THEN
        RETURN 'owner';
    END IF;

    -- Canonical Staff Check on users_staff (Fail-Closed: is_active MUST be TRUE)
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
        ELSIF staff_role IN ('owner') THEN RETURN 'owner';
        ELSE RETURN NULL;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. user_has_tenant_access(check_tenant_id TEXT)
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN (public.get_user_tenant_role(check_tenant_id) IS NOT NULL);
END;
$$;

-- 3. get_coach_id_for_user(check_tenant_id TEXT) - Pure Read-Only Function
CREATE OR REPLACE FUNCTION public.get_coach_id_for_user(check_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    found_coach_id TEXT;
    caller_uid TEXT;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN NULL;
    END IF;

    caller_uid := auth.uid()::text;
    IF caller_uid IS NULL OR trim(caller_uid) = '' THEN
        RETURN NULL;
    END IF;

    SELECT c.id::text INTO found_coach_id
    FROM public.coaches c
    WHERE c.tenant_id::text = check_tenant_id
      AND c.auth_uid::text = caller_uid
    LIMIT 1;

    RETURN found_coach_id;
END;
$$;

-- 4. RPC Create Staff Invitation (CTE Locking + Engine Unique Index + Fail-Closed Status)
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
    -- 1. Memastikan auth.uid() tersedia
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terotentikasi.';
    END IF;

    IF target_tenant_id IS NULL OR trim(target_tenant_id) = '' THEN
        RAISE EXCEPTION 'ID Tenant tidak boleh kosong.';
    END IF;

    -- 2. Validasi status tenant aktif (Fail-closed: COALESCE(is_active, FALSE))
    SELECT COALESCE(is_active, FALSE) INTO v_tenant_active
    FROM public.tenants
    WHERE tenant_id::text = target_tenant_id;

    IF v_tenant_active IS NULL OR v_tenant_active = FALSE THEN
        RAISE EXCEPTION 'Tenant % tidak aktif atau tidak ditemukan.', target_tenant_id;
    END IF;

    -- 3. Validasi Otorisasi Pemanggil
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

    -- Transisi Otomatis Undangan Kedaluwarsa
    UPDATE public.invitations
    SET status = 'expired'
    WHERE tenant_id::text = target_tenant_id
      AND LOWER(trim(invite_email)) = v_clean_email
      AND status = 'pending'
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at <= now();

    -- Lock kandidat users_staff secara deterministik via CTE dengan ORDER BY & FOR UPDATE
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

    -- Cryptographic 32-byte Token & SHA-256 Hash
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

-- 5. RPC Safe Invitation Info Preview (Anon/Auth Allowed, Masked Email, Zero token_hash Exposure)
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

    -- Email Masking e.g. u***r@domain.com
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

-- 6. RPC Claim Staff Invitation (CTE Deterministic Locking, Zero Arbitrary LIMIT 1)
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

    -- 1. Verifikasi auth.uid()
    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    -- 2. Ambil email dan email_confirmed_at dari auth.users
    SELECT LOWER(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_email_confirmed
    FROM auth.users u
    WHERE u.id::text = v_caller_uid;

    IF v_auth_email IS NULL OR v_auth_email = '' OR v_email_confirmed IS NULL THEN
        RAISE EXCEPTION 'Klaim gagal: Email % belum diverifikasi.', v_auth_email;
    END IF;

    -- 3. Hitung SHA-256 dari raw token
    v_computed_hash := encode(digest(raw_invite_token, 'sha256'), 'hex');

    -- 4, 5. Lock record undangan dengan SELECT FOR UPDATE
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

    IF v_inv.invite_email <> v_auth_email THEN
        RETURN FALSE;
    END IF;

    -- 6. Lock kandidat users_staff secara deterministik via CTE dengan ORDER BY & FOR UPDATE
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

-- 7. RPC Revoke Invitation (Authorized Owner/Admin only, SELECT FOR UPDATE)
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

-- Drop legacy bypass functions if exist
DROP FUNCTION IF EXISTS public.claim_unambiguous_account();
DROP FUNCTION IF EXISTS public.claim_user_account(TEXT);
DROP FUNCTION IF EXISTS public.claim_user_account();

-- Targeted Revoke & Grant per specific audited security function (Preserves other app functions intact)
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_role(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_access(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coach_id_for_user(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_staff_invitation(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_staff_invitation(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_staff_invitation(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invitation_info(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_access(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_id_for_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_invitation(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_info(TEXT) TO anon, authenticated;

-- Hak Akses Tabel & Kolom: Cabut SELECT token_hash dari authenticated dan anon
REVOKE ALL ON TABLE public.invitations FROM PUBLIC, anon, authenticated;

-- Berikan SELECT kolom terbatas (EXCLUDING token_hash) kepada authenticated
GRANT SELECT (
    id, tenant_id, invite_email, email, invite_role, role, status,
    created_by_uid, expires_at, accepted_at, accepted_by_uid,
    revoked_at, revoked_by_uid, created_at
) ON public.invitations TO authenticated;

-- =========================================================================
-- 3. TRIGGER PROTECTION ON SENSITIVE COLUMNS (NULL-SAFE IS DISTINCT FROM)
-- =========================================================================

-- 1. Trigger pada users_staff
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
        RAISE EXCEPTION 'Mencoba memindahkan record staf ke tenant lain ditolak.';
    END IF;

    caller_tenant_role := public.get_user_tenant_role(OLD.tenant_id::text);

    IF NOT public.is_superadmin() AND COALESCE(caller_tenant_role, '') NOT IN ('owner', 'admin') THEN
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Perubahan role staf hanya diizinkan untuk Owner/Admin.';
        END IF;
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            RAISE EXCEPTION 'Perubahan status staf hanya diizinkan untuk Owner/Admin.';
        END IF;
        IF OLD.uid IS NOT NULL AND OLD.uid IS DISTINCT FROM NEW.uid THEN
            RAISE EXCEPTION 'Auth UID staf yang sudah terikat tidak dapat diubah.';
        END IF;
        IF OLD.uid IS NULL AND NEW.uid IS NOT NULL AND NEW.uid <> auth.uid()::text THEN
            RAISE EXCEPTION 'Pengikatan Auth UID hanya diizinkan untuk akun sendiri.';
        END IF;
    END IF;

    IF LOWER(COALESCE(NEW.role, '')) = 'superadmin' AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Pengangkatan role superadmin dilarang.';
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
        IF OLD.owner_uid IS DISTINCT FROM NEW.owner_uid THEN
            RAISE EXCEPTION 'Pemindahan kepemilikan tenant (owner_uid) dilarang via UPDATE biasa.';
        END IF;
        IF OLD.owner_email IS DISTINCT FROM NEW.owner_email THEN
            RAISE EXCEPTION 'Perubahan owner_email dilarang via UPDATE biasa.';
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
-- 4. PEMBERSIHAN POLICY PERMISSIVE RESIDU (tenant_isolation_policy)
-- =========================================================================
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'tenants', 'invitations', 'users_staff', 'academies', 'coaches', 'academy_classes', 
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
-- 5. PENEGAKAN KEBIJAKAN RLS GRANULAR PER TABEL (FULL CRUD MATRIX)
-- =========================================================================

-- -------------------------------------------------------------------------
-- A. TABEL: invitations (Token Hash Sealed from Direct SELECT via Column Grants + RLS)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "invitations_select_hardened" ON public.invitations;
CREATE POLICY "invitations_select_hardened" ON public.invitations
FOR SELECT USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "invitations_insert_hardened" ON public.invitations;
CREATE POLICY "invitations_insert_hardened" ON public.invitations
FOR INSERT WITH CHECK (
    public.is_superadmin()
);

DROP POLICY IF EXISTS "invitations_update_hardened" ON public.invitations;
CREATE POLICY "invitations_update_hardened" ON public.invitations
FOR UPDATE USING (
    public.is_superadmin()
) WITH CHECK (
    public.is_superadmin()
);

DROP POLICY IF EXISTS "invitations_delete_hardened" ON public.invitations;
CREATE POLICY "invitations_delete_hardened" ON public.invitations
FOR DELETE USING (
    public.is_superadmin()
);

-- -------------------------------------------------------------------------
-- B. TABEL: tenants
-- -------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_hardened" ON public.tenants;
CREATE POLICY "tenants_select_hardened" ON public.tenants
FOR SELECT USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
    OR (
      LOWER(COALESCE(owner_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL)
    )
    OR public.get_user_tenant_role(tenant_id::text) IS NOT NULL
);

DROP POLICY IF EXISTS "tenants_insert_hardened" ON public.tenants;
CREATE POLICY "tenants_insert_hardened" ON public.tenants
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR (auth.uid() IS NOT NULL AND owner_uid::text = auth.uid()::text)
);

DROP POLICY IF EXISTS "tenants_update_hardened" ON public.tenants;
CREATE POLICY "tenants_update_hardened" ON public.tenants
FOR UPDATE USING (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
) WITH CHECK (
    public.is_superadmin()
    OR owner_uid::text = auth.uid()::text
);

DROP POLICY IF EXISTS "tenants_delete_hardened" ON public.tenants;
CREATE POLICY "tenants_delete_hardened" ON public.tenants
FOR DELETE USING (
    public.is_superadmin()
);

-- -------------------------------------------------------------------------
-- C. TABEL: users_staff
-- -------------------------------------------------------------------------
ALTER TABLE public.users_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_staff_select_hardened" ON public.users_staff;
CREATE POLICY "users_staff_select_hardened" ON public.users_staff
FOR SELECT USING (
    public.is_superadmin()
    OR uid::text = auth.uid()::text
    OR (
      uid IS NULL 
      AND LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL)
    )
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "users_staff_insert_hardened" ON public.users_staff;
CREATE POLICY "users_staff_insert_hardened" ON public.users_staff
FOR INSERT WITH CHECK (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "users_staff_update_hardened" ON public.users_staff;
CREATE POLICY "users_staff_update_hardened" ON public.users_staff
FOR UPDATE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
    OR uid::text = auth.uid()::text
) WITH CHECK (
    public.is_superadmin()
    OR (
      public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
      AND tenant_id::text = users_staff.tenant_id::text
    )
    OR (
      uid::text = auth.uid()::text 
      AND tenant_id::text = users_staff.tenant_id::text
    )
);

DROP POLICY IF EXISTS "users_staff_delete_hardened" ON public.users_staff;
CREATE POLICY "users_staff_delete_hardened" ON public.users_staff
FOR DELETE USING (
    public.is_superadmin()
    OR public.get_user_tenant_role(tenant_id::text) IN ('owner', 'admin')
);
