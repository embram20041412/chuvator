-- =============================================================================
-- CHUVATOR — FASE 5.5-B (KONSOLIDASI V2.2.2)
-- PERSISTENT KK_HMAC BACKFILL AUDIT INFRASTRUCTURE & CONCURRENCY ENGINE
-- File: phase5_5_b_backfill_audit_schema.sql
-- Status: SPECIFICATION PREPARATION (DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL)
-- 
-- V2.2.2 KONSOLIDASI SPECIFICATION:
-- 1. Anti-Deadlock Row Locking: Eliminasi lock-upgrade dari FOR SHARE -> UPDATE.
--    Seluruh RPC yang memodifikasi backfill_kk_runs menggunakan FOR UPDATE secara konsisten.
-- 2. Strict Lock Hierarchy: Seluruh RPC mengunci tabel dalam urutan konsisten:
--    Urutan 1: public.backfill_kk_runs (FOR UPDATE)
--    Urutan 2: public.students (FOR UPDATE)
--    Urutan 3: public.backfill_kk_audit (INSERT append-only)
-- 3. Hardened SECURITY DEFINER: SET search_path = '' pada seluruh fungsi.
--    Semua tabel, view, dan fungsi pg_catalog (now, gen_random_uuid, jsonb_build_object, dll)
--    wajib ber-kualifikasi schema eksplisit (public.*, pg_catalog.*).
-- 4. True Append-Only (UPDATE, DELETE, TRUNCATE): Trigger statement-level untuk TRUNCATE
--    dan trigger row-level untuk UPDATE/DELETE.
-- 5. Strict Privilege Isolation: REVOKE EXECUTE dari PUBLIC, anon, authenticated.
--    Hanya role service_role yang diberikan hak EXECUTE.
-- 6. Source Mutability Guard: p_expected_no_kk wajib 16 digit dan divalidasi 
--    terhadap nilai aktual di database sebelum mutasi (SOURCE_KK_MUTATED).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABEL: public.backfill_kk_runs
-- Menyimpan state siklus eksekusi backfill, concurrency lease lock, generation token, dan progress cursor.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backfill_kk_runs (
    run_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    tenant_id TEXT NOT NULL, -- Terikat permanen pada tenant (TEXT sesuai students.tenant_id)
    status VARCHAR(32) NOT NULL DEFAULT 'ACQUIRED',
    lease_token UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(), -- Fencing token unik per generasi lease
    created_by TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    completed_at TIMESTAMPTZ NULL,
    last_cursor UUID NULL, -- Kursor resmi database untuk resume deterministik
    processed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    rollback_count INTEGER NOT NULL DEFAULT 0,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    lease_expires_at TIMESTAMPTZ NOT NULL,
    error_summary TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_backfill_runs_status CHECK (
        status IN ('ACQUIRED', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')
    )
);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_status_lease 
    ON public.backfill_kk_runs (status, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_tenant_status 
    ON public.backfill_kk_runs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_started 
    ON public.backfill_kk_runs (started_at DESC);


-- -----------------------------------------------------------------------------
-- 2. TABEL: public.backfill_kk_audit (IMMUTABLE APPEND-ONLY EVENT LOG)
-- Catatan audit persisten riwayat mutasi per siswa.
-- DIDESAIN SEBAGAI EVENT SOURCING MURNI: Tidak pernah di-UPDATE, di-DELETE, atau di-TRUNCATE.
-- Event baru dicatat untuk setiap mutasi (APPLIED, SKIPPED, RESTORED, CONFLICT).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backfill_kk_audit (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.backfill_kk_runs(run_id) ON DELETE RESTRICT,
    event_type VARCHAR(32) NOT NULL, -- 'BACKFILL_APPLIED', 'BACKFILL_SKIPPED', 'ROLLBACK_RESTORED', 'ROLLBACK_CONFLICT'
    batch_id INTEGER NOT NULL DEFAULT 1,
    tenant_id TEXT NOT NULL, -- Sesuai tipe data aktual students.tenant_id (TEXT)
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    original_audit_id UUID NULL REFERENCES public.backfill_kk_audit(id) ON DELETE RESTRICT,
    old_kk_hmac VARCHAR(64) NULL,
    old_kk_last4 VARCHAR(4) NULL,
    new_kk_hmac VARCHAR(64) NULL,
    new_kk_last4 VARCHAR(4) NULL,
    current_db_hmac VARCHAR(64) NULL, -- Khusus audit event ROLLBACK_CONFLICT
    current_db_last4 VARCHAR(4) NULL, -- Khusus audit event ROLLBACK_CONFLICT
    reason TEXT NULL, -- Alasan skip atau detail konflik rollback
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_backfill_audit_event_type CHECK (
        event_type IN ('BACKFILL_APPLIED', 'BACKFILL_SKIPPED', 'ROLLBACK_RESTORED', 'ROLLBACK_CONFLICT')
    )
);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_run_student 
    ON public.backfill_kk_audit (run_id, student_id);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_tenant_student 
    ON public.backfill_kk_audit (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_event_type 
    ON public.backfill_kk_audit (event_type);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_original_ref 
    ON public.backfill_kk_audit (original_audit_id);


-- -----------------------------------------------------------------------------
-- 3. TRIGGER PENEGAK APPEND-ONLY (IMMUTABILITY ENGINE)
-- Mencegah segala bentuk UPDATE, DELETE, dan TRUNCATE terhadap riwayat audit.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_prevent_backfill_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'TABEL AUDIT BERSIFAT APPEND-ONLY: Mutasi (UPDATE, DELETE, atau TRUNCATE) dilarang pada public.backfill_kk_audit.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_backfill_audit_update ON public.backfill_kk_audit;
CREATE TRIGGER trg_prevent_backfill_audit_update
    BEFORE UPDATE OR DELETE ON public.backfill_kk_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_backfill_audit_mutation();

DROP TRIGGER IF EXISTS trg_prevent_backfill_audit_truncate ON public.backfill_kk_audit;
CREATE TRIGGER trg_prevent_backfill_audit_truncate
    BEFORE TRUNCATE ON public.backfill_kk_audit
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.fn_prevent_backfill_audit_mutation();


-- -----------------------------------------------------------------------------
-- 4. KEAMANAN RLS DAN HAK AKSES DATA
-- Akses publik/anon/authenticated dicabut secara total.
-- Hanya backend berotentikasi (service_role) yang memiliki izin SELECT & INSERT.
-- service_role TIDAK DIBERI izin UPDATE, DELETE, maupun TRUNCATE pada audit.
-- -----------------------------------------------------------------------------

ALTER TABLE public.backfill_kk_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backfill_kk_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.backfill_kk_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backfill_kk_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.backfill_kk_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.backfill_kk_audit FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.backfill_kk_runs TO service_role;
GRANT SELECT, INSERT ON TABLE public.backfill_kk_audit TO service_role;


-- -----------------------------------------------------------------------------
-- 5. RPC: acquire_backfill_kk_lease (DENGAN LEASE FENCING TOKEN & TENANT BINDING)
-- Serialisasi: Transaction-level advisory lock + Penguncian FOR UPDATE pada run aktif.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_backfill_kk_lease(
    p_tenant_id TEXT,
    p_created_by TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_active_run RECORD;
    v_new_run_id UUID;
    v_new_token UUID;
    v_expires_at TIMESTAMPTZ;
    v_safe_lease_seconds INTEGER;
BEGIN
    -- 0. Lock transaksi global akuisisi lease untuk mencegah race condition antar-worker saat belum ada baris run
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('chuvator_backfill_lease_acquisition'));

    -- 1. Validasi tenant_id wajib ada
    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_TENANT_ID',
            'message', 'tenant_id wajib disertakan untuk mengikat siklus run backfill.'
        );
    END IF;

    -- 2. Periksa apakah ada run yang masih aktif dan lease-nya belum kedaluwarsa pada tenant ini atau global
    -- Serialisasi FOR UPDATE mencegah race condition saat dua worker mencoba acquire serentak
    SELECT run_id, lease_token, lease_expires_at, tenant_id INTO v_active_run
    FROM public.backfill_kk_runs
    WHERE status IN ('ACQUIRED', 'RUNNING')
      AND lease_expires_at > pg_catalog.now()
      AND (tenant_id = p_tenant_id OR p_tenant_id = 'global' OR tenant_id = 'global')
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_active_run.run_id IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'LOCKED',
            'message', 'Terdapat proses backfill yang sedang berjalan pada tenant ini.',
            'active_run_id', v_active_run.run_id,
            'lease_expires_at', v_active_run.lease_expires_at
        );
    END IF;

    -- 3. Tandai run usang yang lease-nya sudah kedaluwarsa tapi belum selesai
    UPDATE public.backfill_kk_runs
    SET status = 'FAILED',
        error_summary = 'LEASE_EXPIRED_TIMEOUT: Worker terhenti atau gagal memperbarui heartbeat tepat waktu.',
        completed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE status IN ('ACQUIRED', 'RUNNING')
      AND lease_expires_at <= pg_catalog.now()
      AND (tenant_id = p_tenant_id OR p_tenant_id = 'global');

    -- 4. Terbitkan lease run baru dengan fencing token unik
    v_new_token := pg_catalog.gen_random_uuid();
    v_safe_lease_seconds := GREATEST(pg_catalog.coalesce(p_lease_seconds, 60), 30);
    v_expires_at := pg_catalog.now() + (v_safe_lease_seconds || ' seconds')::pg_catalog.interval;
    
    INSERT INTO public.backfill_kk_runs (
        tenant_id,
        status,
        lease_token,
        created_by,
        started_at,
        heartbeat_at,
        lease_expires_at
    ) VALUES (
        p_tenant_id,
        'RUNNING',
        v_new_token,
        p_created_by,
        pg_catalog.now(),
        pg_catalog.now(),
        v_expires_at
    ) RETURNING run_id INTO v_new_run_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'code', 'ACQUIRED',
        'run_id', v_new_run_id,
        'lease_token', v_new_token,
        'lease_expires_at', v_expires_at,
        'tenant_id', p_tenant_id
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. RPC: heartbeat_backfill_kk_lease (VALIDASI FENCING TOKEN & EXPOSURE)
-- Operasi single-statement atomik yang langsung memperoleh row exclusive lock.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.heartbeat_backfill_kk_lease(
    p_run_id UUID,
    p_lease_token UUID,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_updated INTEGER;
    v_safe_lease_seconds INTEGER;
BEGIN
    v_safe_lease_seconds := GREATEST(pg_catalog.coalesce(p_lease_seconds, 60), 30);

    UPDATE public.backfill_kk_runs
    SET heartbeat_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now() + (v_safe_lease_seconds || ' seconds')::pg_catalog.interval,
        updated_at = pg_catalog.now()
    WHERE run_id = p_run_id
      AND lease_token = p_lease_token
      AND status = 'RUNNING'
      AND lease_expires_at > pg_catalog.now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'LEASE_LOST_OR_TOKEN_INVALID',
            'message', 'Lease token tidak valid, telah kedaluwarsa, atau telah diambil alih oleh worker lain.'
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. RPC: apply_backfill_kk_atomic_record (FENCING TOKEN & ANTI-DEADLOCK LOCKING)
-- SERIALISASI KONSISTEN:
-- Step 1: Kunci public.backfill_kk_runs menggunakan FOR UPDATE (mencegah lock upgrade deadlock)
-- Step 2: Kunci public.students menggunakan FOR UPDATE
-- Step 3: Insert public.backfill_kk_audit (append-only)
-- Step 4: Update aggregate & cursor pada public.backfill_kk_runs
-- Seluruh mutasi dieksekusi dalam 1 transaksi atomik database.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_backfill_kk_atomic_record(
    p_run_id UUID,
    p_lease_token UUID,
    p_batch_id INTEGER,
    p_student_id UUID,
    p_tenant_id TEXT,
    p_expected_old_hmac VARCHAR(64),
    p_expected_old_last4 VARCHAR(4),
    p_new_hmac VARCHAR(64),
    p_new_last4 VARCHAR(4),
    p_expected_no_kk VARCHAR(16)
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_run RECORD;
    v_curr_no_kk VARCHAR(16);
    v_curr_hmac VARCHAR(64);
    v_curr_last4 VARCHAR(4);
    v_curr_tenant TEXT;
BEGIN
    -- 0. Validasi Wajib Parameter p_expected_no_kk (tepat 16 digit angka murni)
    IF p_expected_no_kk IS NULL OR p_expected_no_kk !~ '^[0-9]{16}$' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_EXPECTED_NO_KK',
            'message', 'Parameter p_expected_no_kk wajib diisi dengan tepat 16 digit angka murni.'
        );
    END IF;

    -- 1. Kunci Baris Run dengan FOR UPDATE (Eliminasi Deadlock Lock-Upgrade)
    SELECT run_id, tenant_id, lease_token, status, lease_expires_at INTO v_run
    FROM public.backfill_kk_runs
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'RUN_NOT_FOUND', 'message', 'Siklus run tidak ditemukan.');
    END IF;

    IF v_run.lease_token IS DISTINCT FROM p_lease_token THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'FENCING_TOKEN_MISMATCH', 'message', 'Lease token telah usang. Worker lain telah mengambil alih tugas ini.');
    END IF;

    IF v_run.status <> 'RUNNING' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'RUN_INACTIVE', 'message', 'Status run tidak lagi aktif.');
    END IF;

    IF v_run.lease_expires_at <= pg_catalog.now() THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'LEASE_EXPIRED', 'message', 'Masa berlaku lease telah kedaluwarsa.');
    END IF;

    -- Validasi isolasi tenant run vs student tenant
    IF v_run.tenant_id <> 'global' AND v_run.tenant_id <> p_tenant_id THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'TENANT_MISMATCH', 'message', 'Siswa tidak termasuk dalam tenant siklus run ini.');
    END IF;

    -- 2. Kunci baris siswa untuk update dengan isolasi tenant (Lock Order Level 2)
    SELECT tenant_id, no_kk, kk_hmac, kk_last4 
    INTO v_curr_tenant, v_curr_no_kk, v_curr_hmac, v_curr_last4
    FROM public.students
    WHERE id = p_student_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'STUDENT_NOT_FOUND', 'message', 'Siswa tidak ditemukan.');
    END IF;

    -- 3. Validation of Source KK Mutability (Mandatory Unconditional Check)
    -- Memastikan sumber data tidak berubah sejak dibaca oleh worker
    IF v_curr_no_kk IS DISTINCT FROM p_expected_no_kk THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'SOURCE_KK_MUTATED',
            'message', 'Nomor KK siswa telah diubah oleh admin saat proses backfill berjalan. Generasi HMAC dibatalkan.'
        );
    END IF;

    -- Optimistic Concurrency Control untuk kolom hash
    IF (v_curr_hmac IS DISTINCT FROM p_expected_old_hmac) OR (v_curr_last4 IS DISTINCT FROM p_expected_old_last4) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'CONCURRENCY_CONFLICT',
            'message', 'Data siswa telah diubah oleh proses lain sebelum update diaplikasikan.'
        );
    END IF;

    -- 4. Update data siswa
    UPDATE public.students
    SET kk_hmac = p_new_hmac,
        kk_last4 = p_new_last4,
        updated_at = pg_catalog.now()
    WHERE id = p_student_id AND tenant_id = p_tenant_id;

    -- 5. Catat event ke tabel audit persisten (IMMUTABLE APPEND-ONLY)
    INSERT INTO public.backfill_kk_audit (
        run_id,
        event_type,
        batch_id,
        tenant_id,
        student_id,
        old_kk_hmac,
        old_kk_last4,
        new_kk_hmac,
        new_kk_last4
    ) VALUES (
        p_run_id,
        'BACKFILL_APPLIED',
        p_batch_id,
        p_tenant_id,
        p_student_id,
        p_expected_old_hmac,
        p_expected_old_last4,
        p_new_hmac,
        p_new_last4
    );

    -- 6. Perbarui progress run & kursor resmi DB
    UPDATE public.backfill_kk_runs
    SET processed_count = processed_count + 1,
        last_cursor = p_student_id,
        updated_at = pg_catalog.now()
    WHERE run_id = p_run_id;

    RETURN pg_catalog.jsonb_build_object('success', true, 'code', 'UPDATED');
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. RPC: record_backfill_kk_skip (FENCING TOKEN & ANTI-DEADLOCK LOCKING)
-- Serialisasi: FOR UPDATE pada backfill_kk_runs sebelum append audit & update counter.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_backfill_kk_skip(
    p_run_id UUID,
    p_lease_token UUID,
    p_batch_id INTEGER,
    p_student_id UUID,
    p_tenant_id TEXT,
    p_reason TEXT,
    p_old_hmac VARCHAR(64) DEFAULT NULL,
    p_old_last4 VARCHAR(4) DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_run RECORD;
    v_student_exists BOOLEAN;
BEGIN
    -- 0. Validasi tenant_id wajib ada
    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_TENANT_ID',
            'message', 'tenant_id wajib disertakan untuk mencatat riwayat skip.'
        );
    END IF;

    -- 1. Validasi lease token & kunci baris run dengan FOR UPDATE
    SELECT run_id, tenant_id, lease_token, status, lease_expires_at INTO v_run
    FROM public.backfill_kk_runs
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'RUN_NOT_FOUND');
    END IF;

    IF v_run.lease_token IS DISTINCT FROM p_lease_token THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'FENCING_TOKEN_MISMATCH');
    END IF;

    IF v_run.status <> 'RUNNING' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'RUN_INACTIVE');
    END IF;

    IF v_run.lease_expires_at <= pg_catalog.now() THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'LEASE_EXPIRED');
    END IF;

    -- Validasi isolasi tenant run vs student tenant
    IF v_run.tenant_id <> 'global' AND v_run.tenant_id <> p_tenant_id THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'TENANT_MISMATCH');
    END IF;

    -- 2. Validasi kepemilikan tenant atas siswa
    SELECT EXISTS (
        SELECT 1 FROM public.students 
        WHERE id = p_student_id AND tenant_id = p_tenant_id
    ) INTO v_student_exists;

    IF NOT v_student_exists THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'STUDENT_NOT_FOUND');
    END IF;

    -- 3. Catat skip event ke audit append-only
    INSERT INTO public.backfill_kk_audit (
        run_id,
        event_type,
        batch_id,
        tenant_id,
        student_id,
        old_kk_hmac,
        old_kk_last4,
        reason
    ) VALUES (
        p_run_id,
        'BACKFILL_SKIPPED',
        p_batch_id,
        p_tenant_id,
        p_student_id,
        p_old_hmac,
        p_old_last4,
        p_reason
    );

    UPDATE public.backfill_kk_runs
    SET skipped_count = skipped_count + 1,
        last_cursor = p_student_id,
        updated_at = pg_catalog.now()
    WHERE run_id = p_run_id;

    RETURN pg_catalog.jsonb_build_object('success', true, 'code', 'SKIPPED_RECORDED');
END;
$$;


-- -----------------------------------------------------------------------------
-- 9. RPC: rollback_backfill_kk_atomic (ANTI-DEADLOCK STRICT HIERARCHY & IMMUTABLE LOG)
-- HIERARKI PENGUNCIAN KONSISTEN:
-- Step 1: Kunci public.backfill_kk_runs menggunakan FOR UPDATE
-- Step 2: Kunci public.students menggunakan FOR UPDATE
-- Step 3: Validasi mutasi pasca-backfill (IS DISTINCT FROM)
-- Step 4: Kembalikan nilai students jika cocok, atau catat ROLLBACK_CONFLICT
-- Step 5: Update agregat rollback_count pada public.backfill_kk_runs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rollback_backfill_kk_atomic(
    p_run_id UUID,
    p_student_id UUID
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_run RECORD;
    v_applied_audit RECORD;
    v_already_restored BOOLEAN;
    v_curr_hmac VARCHAR(64);
    v_curr_last4 VARCHAR(4);
    v_curr_tenant TEXT;
BEGIN
    -- 1. Kunci Baris Run Terlebih Dahulu (Urutan Penguncian Konsisten Level 1)
    SELECT run_id, tenant_id, status INTO v_run
    FROM public.backfill_kk_runs
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'RUN_NOT_FOUND',
            'message', 'Siklus run tidak ditemukan.'
        );
    END IF;

    -- 2. Cari audit event BACKFILL_APPLIED asli untuk run & siswa bersangkutan
    SELECT * INTO v_applied_audit
    FROM public.backfill_kk_audit
    WHERE run_id = p_run_id 
      AND student_id = p_student_id
      AND event_type = 'BACKFILL_APPLIED'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'APPLIED_AUDIT_NOT_FOUND',
            'message', 'Tidak ditemukan catatan BACKFILL_APPLIED untuk runId dan studentId ini.'
        );
    END IF;

    -- 3. Cek apakah sudah pernah di-rollback sebelumnya (IDEMPOTEN)
    SELECT EXISTS (
        SELECT 1 FROM public.backfill_kk_audit
        WHERE run_id = p_run_id
          AND student_id = p_student_id
          AND event_type = 'ROLLBACK_RESTORED'
          AND original_audit_id = v_applied_audit.id
    ) INTO v_already_restored;

    IF v_already_restored THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'code', 'ALREADY_ROLLED_BACK',
            'message', 'Siswa ini sudah pernah dipulihkan sebelumnya.'
        );
    END IF;

    -- 4. Kunci data siswa saat ini (Urutan Penguncian Konsisten Level 2)
    SELECT tenant_id, kk_hmac, kk_last4 INTO v_curr_tenant, v_curr_hmac, v_curr_last4
    FROM public.students
    WHERE id = p_student_id AND tenant_id = v_applied_audit.tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'STUDENT_NOT_FOUND');
    END IF;

    -- 5. STRICT DUAL-COLUMN COMPARISON:
    -- Bandingkan kk_hmac dan kk_last4 saat ini dengan new_kk_hmac dan new_kk_last4 audit.
    -- Jika salah satu saja berbeda (atau keduanya), JANGAN restore, catat event ROLLBACK_CONFLICT!
    IF (v_curr_hmac IS DISTINCT FROM v_applied_audit.new_kk_hmac) OR 
       (v_curr_last4 IS DISTINCT FROM v_applied_audit.new_kk_last4) THEN
       
        -- Catat event konflik secara permanen ke tabel audit
        INSERT INTO public.backfill_kk_audit (
            run_id,
            event_type,
            batch_id,
            tenant_id,
            student_id,
            original_audit_id,
            old_kk_hmac,
            old_kk_last4,
            new_kk_hmac,
            new_kk_last4,
            current_db_hmac,
            current_db_last4,
            reason
        ) VALUES (
            p_run_id,
            'ROLLBACK_CONFLICT',
            v_applied_audit.batch_id,
            v_applied_audit.tenant_id,
            p_student_id,
            v_applied_audit.id,
            v_applied_audit.old_kk_hmac,
            v_applied_audit.old_kk_last4,
            v_applied_audit.new_kk_hmac,
            v_applied_audit.new_kk_last4,
            v_curr_hmac,
            v_curr_last4,
            'CONFLICT: Nilai aktual di database telah berubah pasca-backfill. Pemulihan otomatis dibatalkan.'
        );

        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'ROLLBACK_CONFLICT_DATA_CHANGED',
            'message', 'Nilai data siswa telah diperbarui setelah backfill dijalankan. Rollback otomatis dibatalkan untuk mencegah kerusakan data.'
        );
    END IF;

    -- 6. Jika kedua kolom cocok persis, pulihkan old_kk_hmac dan old_kk_last4 dalam satu transaksi
    UPDATE public.students
    SET kk_hmac = v_applied_audit.old_kk_hmac,
        kk_last4 = v_applied_audit.old_kk_last4,
        updated_at = pg_catalog.now()
    WHERE id = p_student_id AND tenant_id = v_applied_audit.tenant_id;

    -- 7. Catat event ROLLBACK_RESTORED sebagai baris baru (TRUE APPEND-ONLY)
    INSERT INTO public.backfill_kk_audit (
        run_id,
        event_type,
        batch_id,
        tenant_id,
        student_id,
        original_audit_id,
        old_kk_hmac,
        old_kk_last4,
        new_kk_hmac,
        new_kk_last4
    ) VALUES (
        p_run_id,
        'ROLLBACK_RESTORED',
        v_applied_audit.batch_id,
        v_applied_audit.tenant_id,
        p_student_id,
        v_applied_audit.id,
        v_applied_audit.old_kk_hmac,
        v_applied_audit.old_kk_last4,
        v_applied_audit.new_kk_hmac,
        v_applied_audit.new_kk_last4
    );

    -- 8. Update agregat run
    UPDATE public.backfill_kk_runs
    SET rollback_count = rollback_count + 1,
        updated_at = pg_catalog.now()
    WHERE run_id = p_run_id;

    RETURN pg_catalog.jsonb_build_object('success', true, 'code', 'ROLLED_BACK');
END;
$$;


-- -----------------------------------------------------------------------------
-- 10. RPC: complete_backfill_kk_run (VALIDASI FENCING TOKEN & STATUS TERMINAL)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_backfill_kk_run(
    p_run_id UUID,
    p_lease_token UUID,
    p_status VARCHAR(32),
    p_error_summary TEXT DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_run RECORD;
BEGIN
    -- 0. Validasi p_status tidak boleh NULL dan harus status terminal yang valid
    IF p_status IS NULL OR p_status NOT IN ('COMPLETED', 'FAILED', 'ROLLED_BACK') THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_TERMINAL_STATUS',
            'message', 'Status penyelesaian wajib disertakan (COMPLETED, FAILED, atau ROLLED_BACK).'
        );
    END IF;

    -- 1. Kunci Baris Run dengan FOR UPDATE
    SELECT run_id, lease_token, status, lease_expires_at INTO v_run
    FROM public.backfill_kk_runs
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'RUN_NOT_FOUND');
    END IF;

    -- 2. Validasi status awal harus RUNNING (tidak boleh terminal yang sudah selesai)
    IF v_run.status <> 'RUNNING' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false, 
            'code', 'RUN_ALREADY_TERMINAL',
            'message', 'Siklus run tidak dapat diselesaikan karena sudah berada dalam status terminal: ' || v_run.status
        );
    END IF;

    -- 3. Validasi fencing token
    IF v_run.lease_token IS DISTINCT FROM p_lease_token THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false, 
            'code', 'FENCING_TOKEN_MISMATCH',
            'message', 'Lease token tidak valid atau telah diambil alih oleh worker lain.'
        );
    END IF;

    -- 4. Validasi lease belum kedaluwarsa
    IF v_run.lease_expires_at <= pg_catalog.now() THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false, 
            'code', 'LEASE_EXPIRED',
            'message', 'Masa berlaku lease telah kedaluwarsa sebelum penyelesaian run.'
        );
    END IF;

    -- 5. Lakukan update status terminal
    UPDATE public.backfill_kk_runs
    SET status = p_status,
        completed_at = pg_catalog.now(),
        error_summary = p_error_summary,
        updated_at = pg_catalog.now()
    WHERE run_id = p_run_id;

    RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;


-- -----------------------------------------------------------------------------
-- 11. HAK AKSES EKSEKUSI RPC (STRICT REVOKE & SERVICE_ROLE ONLY)
-- -----------------------------------------------------------------------------

-- Trigger function
REVOKE ALL ON FUNCTION public.fn_prevent_backfill_audit_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_prevent_backfill_audit_mutation() TO service_role;

-- RPC functions
REVOKE ALL ON FUNCTION public.acquire_backfill_kk_lease(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_backfill_kk_lease(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_backfill_kk_atomic_record(UUID, UUID, INTEGER, UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_backfill_kk_skip(UUID, UUID, INTEGER, UUID, TEXT, TEXT, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_backfill_kk_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_backfill_kk_run(UUID, UUID, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acquire_backfill_kk_lease(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_backfill_kk_lease(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_backfill_kk_atomic_record(UUID, UUID, INTEGER, UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_backfill_kk_skip(UUID, UUID, INTEGER, UUID, TEXT, TEXT, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_backfill_kk_atomic(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_backfill_kk_run(UUID, UUID, VARCHAR, TEXT) TO service_role;

COMMIT;
