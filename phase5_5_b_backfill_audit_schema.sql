-- =============================================================================
-- CHUVATOR — FASE 5.5-B
-- PERSISTENT KK_HMAC BACKFILL AUDIT INFRASTRUCTURE & RECOVERY ENGINE
-- File: phase5_5_b_backfill_audit_schema.sql
-- Status: SPECIFICATION PREPARATION (DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABEL: public.backfill_kk_runs
-- Menyimpan state siklus eksekusi backfill, concurrency lease lock, dan progress cursor.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backfill_kk_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(32) NOT NULL DEFAULT 'ACQUIRED',
    created_by TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    last_cursor UUID NULL,
    processed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    rollback_count INTEGER NOT NULL DEFAULT 0,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_expires_at TIMESTAMPTZ NOT NULL,
    error_summary TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_backfill_runs_status CHECK (
        status IN ('ACQUIRED', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')
    )
);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_status_lease 
    ON public.backfill_kk_runs (status, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_started 
    ON public.backfill_kk_runs (started_at DESC);


-- -----------------------------------------------------------------------------
-- 2. TABEL: public.backfill_kk_audit
-- Catatan audit persisten riwayat mutasi per siswa. Bersifat append-only
-- Menyimpan nilai lama vs nilai baru untuk rollback deterministik.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backfill_kk_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.backfill_kk_runs(run_id) ON DELETE RESTRICT,
    batch_id INTEGER NOT NULL DEFAULT 1,
    tenant_id TEXT NOT NULL, -- Sesuai tipe data aktual students.tenant_id (TEXT)
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    old_kk_hmac VARCHAR(64) NULL,
    old_kk_last4 VARCHAR(4) NULL,
    new_kk_hmac VARCHAR(64) NULL,
    new_kk_last4 VARCHAR(4) NULL,
    operation_status VARCHAR(32) NOT NULL,
    skip_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rolled_back_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_backfill_audit_status CHECK (
        operation_status IN ('SUCCESS', 'SKIPPED', 'FAILED', 'ROLLED_BACK')
    )
);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_run_student 
    ON public.backfill_kk_audit (run_id, student_id);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_tenant_student 
    ON public.backfill_kk_audit (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_backfill_audit_status 
    ON public.backfill_kk_audit (operation_status);


-- -----------------------------------------------------------------------------
-- 3. KEAMANAN RLS DAN AKSES DATA
-- Akses langsung dinonaktifkan untuk publik/anonim.
-- Hanya backend terotorisasi (service_role / postgres) yang dapat mengakses.
-- -----------------------------------------------------------------------------

ALTER TABLE public.backfill_kk_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backfill_kk_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.backfill_kk_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backfill_kk_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.backfill_kk_runs FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.backfill_kk_audit FROM public, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.backfill_kk_runs TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.backfill_kk_audit TO service_role;


-- -----------------------------------------------------------------------------
-- 4. RPC: acquire_backfill_kk_lease
-- Mengamankan distributed lease lock agar hanya satu backfill yang aktif.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_backfill_kk_lease(
    p_created_by TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_active_run_id UUID;
    v_new_run_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Periksa apakah ada run yang masih aktif dan lease-nya belum kedaluwarsa
    SELECT run_id INTO v_active_run_id
    FROM public.backfill_kk_runs
    WHERE status IN ('ACQUIRED', 'RUNNING')
      AND lease_expires_at > now()
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_active_run_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'LOCKED',
            'message', 'Terdapat proses backfill yang sedang berjalan.',
            'active_run_id', v_active_run_id
        );
    END IF;

    -- 2. Bersihkan/Tandai run usang yang lease-nya sudah kedaluwarsa tapi belum selesai
    UPDATE public.backfill_kk_runs
    SET status = 'FAILED',
        error_summary = 'LEASE_EXPIRED_TIMEOUT: Worker terhenti atau gagal mengirim heartbeat.',
        completed_at = now(),
        updated_at = now()
    WHERE status IN ('ACQUIRED', 'RUNNING')
      AND lease_expires_at <= now();

    -- 3. Buat lease run baru
    v_expires_at := now() + (p_lease_seconds || ' seconds')::INTERVAL;
    
    INSERT INTO public.backfill_kk_runs (
        status,
        created_by,
        started_at,
        heartbeat_at,
        lease_expires_at
    ) VALUES (
        'RUNNING',
        p_created_by,
        now(),
        now(),
        v_expires_at
    ) RETURNING run_id INTO v_new_run_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'ACQUIRED',
        'run_id', v_new_run_id,
        'lease_expires_at', v_expires_at
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. RPC: heartbeat_backfill_kk_lease
-- Memperpanjang lease lock selama batch berjalan.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.heartbeat_backfill_kk_lease(
    p_run_id UUID,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.backfill_kk_runs
    SET heartbeat_at = now(),
        lease_expires_at = now() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = now()
    WHERE run_id = p_run_id
      AND status = 'RUNNING';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'LEASE_LOST',
            'message', 'Lease tidak valid atau telah diambil alih.'
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. RPC: apply_backfill_kk_atomic_record
-- Mutasi atomik: Optimistic concurrency check pada students + Pencatatan audit trail.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_backfill_kk_atomic_record(
    p_run_id UUID,
    p_batch_id INTEGER,
    p_student_id UUID,
    p_tenant_id TEXT,
    p_expected_old_hmac VARCHAR(64),
    p_expected_old_last4 VARCHAR(4),
    p_new_hmac VARCHAR(64),
    p_new_last4 VARCHAR(4)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_curr_hmac VARCHAR(64);
    v_curr_last4 VARCHAR(4);
    v_curr_tenant TEXT;
BEGIN
    -- 1. Kunci baris siswa untuk update dengan isolasi tenant ketat
    SELECT tenant_id, kk_hmac, kk_last4 
    INTO v_curr_tenant, v_curr_hmac, v_curr_last4
    FROM public.students
    WHERE id = p_student_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'STUDENT_NOT_FOUND',
            'message', 'Siswa tidak ditemukan atau mismatch tenant_id.'
        );
    END IF;

    -- 2. Optimistic Concurrency Control
    -- Jika nilai di database sudah berubah sejak pembacaan awal, batalkan untuk mencegah overwrite
    IF (v_curr_hmac IS DISTINCT FROM p_expected_old_hmac) OR (v_curr_last4 IS DISTINCT FROM p_expected_old_last4) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CONCURRENCY_CONFLICT',
            'message', 'Data siswa telah diubah oleh proses lain sebelum update dapat diaplikasikan.'
        );
    END IF;

    -- 3. Update data siswa
    UPDATE public.students
    SET kk_hmac = p_new_hmac,
        kk_last4 = p_new_last4,
        updated_at = now()
    WHERE id = p_student_id AND tenant_id = p_tenant_id;

    -- 4. Simpan riwayat perubahan ke tabel audit persisten
    INSERT INTO public.backfill_kk_audit (
        run_id,
        batch_id,
        tenant_id,
        student_id,
        old_kk_hmac,
        old_kk_last4,
        new_kk_hmac,
        new_kk_last4,
        operation_status
    ) VALUES (
        p_run_id,
        p_batch_id,
        p_tenant_id,
        p_student_id,
        p_expected_old_hmac,
        p_expected_old_last4,
        p_new_hmac,
        p_new_last4,
        'SUCCESS'
    );

    -- 5. Perbarui progress run
    UPDATE public.backfill_kk_runs
    SET processed_count = processed_count + 1,
        last_cursor = p_student_id,
        updated_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object('success', true, 'code', 'UPDATED');
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. RPC: record_backfill_kk_skip
-- Mencatat baris yang dilewati (anomali KK, corrupt, atau mismatch) ke audit persisten.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_backfill_kk_skip(
    p_run_id UUID,
    p_batch_id INTEGER,
    p_student_id UUID,
    p_tenant_id TEXT,
    p_reason TEXT,
    p_old_hmac VARCHAR(64) DEFAULT NULL,
    p_old_last4 VARCHAR(4) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.backfill_kk_audit (
        run_id,
        batch_id,
        tenant_id,
        student_id,
        old_kk_hmac,
        old_kk_last4,
        new_kk_hmac,
        new_kk_last4,
        operation_status,
        skip_reason
    ) VALUES (
        p_run_id,
        p_batch_id,
        p_tenant_id,
        p_student_id,
        p_old_hmac,
        p_old_last4,
        NULL,
        NULL,
        'SKIPPED',
        p_reason
    );

    UPDATE public.backfill_kk_runs
    SET skipped_count = skipped_count + 1,
        last_cursor = p_student_id,
        updated_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object('success', true, 'code', 'SKIPPED_RECORDED');
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. RPC: rollback_backfill_kk_atomic
-- Mengembalikan perubahan data siswa ke nilai lama berdasarkan catatan audit run_id.
-- Melindungi dari overwrite data baru jika data siswa telah diubah proses sah pasca-backfill.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rollback_backfill_kk_atomic(
    p_run_id UUID,
    p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_audit RECORD;
    v_curr_hmac VARCHAR(64);
    v_curr_last4 VARCHAR(4);
BEGIN
    -- 1. Cari catatan audit sukses untuk run & siswa bersangkutan
    SELECT * INTO v_audit
    FROM public.backfill_kk_audit
    WHERE run_id = p_run_id 
      AND student_id = p_student_id
      AND operation_status = 'SUCCESS'
      AND rolled_back_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'AUDIT_NOT_FOUND_OR_ALREADY_ROLLED_BACK'
        );
    END IF;

    -- 2. Kunci data siswa saat ini
    SELECT kk_hmac, kk_last4 INTO v_curr_hmac, v_curr_last4
    FROM public.students
    WHERE id = p_student_id AND tenant_id = v_audit.tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'STUDENT_NOT_FOUND');
    END IF;

    -- 3. Proteksi Rollback: Pastikan nilai saat ini masih identik dengan nilai baru yang diisi oleh run ini
    -- Jika sudah diubah oleh pendaftaran/update lain, jangan menimpa data yang sah!
    IF (v_curr_hmac IS DISTINCT FROM v_audit.new_kk_hmac) OR (v_curr_last4 IS DISTINCT FROM v_audit.new_kk_last4) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ROLLBACK_CONFLICT_DATA_CHANGED',
            'message', 'Nilai data siswa telah diperbarui setelah backfill dijalankan. Rollback otomatis dibatalkan untuk mencegah kerusakan data.'
        );
    END IF;

    -- 4. Kembalikan ke nilai lama
    UPDATE public.students
    SET kk_hmac = v_audit.old_kk_hmac,
        kk_last4 = v_audit.old_kk_last4,
        updated_at = now()
    WHERE id = p_student_id AND tenant_id = v_audit.tenant_id;

    -- 5. Tandai status rollback pada catatan audit
    UPDATE public.backfill_kk_audit
    SET operation_status = 'ROLLED_BACK',
        rolled_back_at = now()
    WHERE id = v_audit.id;

    -- 6. Update agregat run
    UPDATE public.backfill_kk_runs
    SET rollback_count = rollback_count + 1,
        updated_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object('success', true, 'code', 'ROLLED_BACK');
END;
$$;


-- -----------------------------------------------------------------------------
-- 9. RPC: complete_backfill_kk_run
-- Menutup siklus run secara tertib (COMPLETED / FAILED).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_backfill_kk_run(
    p_run_id UUID,
    p_status VARCHAR(32),
    p_error_summary TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.backfill_kk_runs
    SET status = p_status,
        completed_at = now(),
        error_summary = p_error_summary,
        updated_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
