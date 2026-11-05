-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 5.4-F (DIRECT CODE CORRECTION)
-- RPC Function: public.portal_get_student_dashboard
-- Purpose: Consolidated Parent Portal Student Dashboard Data Fetcher
-- Security: SECURITY DEFINER, search_path = public, extensions, pg_temp
-- Authorization: Strict UUID auth.uid() matching via EXISTS (parent_accounts -> parent_student_links -> students)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_get_student_dashboard(
    p_student_id UUID,
    p_tenant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    -- Auth Identity (Strict UUID type)
    v_auth_uid UUID := auth.uid();
    
    -- Student Scalar Fields (Verified Schema)
    v_student_id UUID := NULL;
    v_student_name TEXT := NULL;
    v_student_photo_url TEXT := NULL;
    v_student_class_id UUID := NULL;
    v_student_class_name TEXT := NULL;
    v_student_coach_name TEXT := NULL;
    v_student_tenant_id TEXT := NULL;
    v_student_academy_name TEXT := NULL;
    v_student_birth_date DATE := NULL;
    v_student_school_origin TEXT := NULL;
    v_student_sport_category TEXT := NULL;
    v_student_monthly_fee NUMERIC := 0;
    
    -- Class & Coach Scalar Fields (Verified Schema: is_archived BOOLEAN)
    v_class_name TEXT := NULL;
    v_class_academy_name TEXT := NULL;
    v_class_coach_id UUID := NULL;
    v_class_coach_name TEXT := NULL;
    v_class_schedules JSONB := '[]'::jsonb;
    v_coach_name_from_table TEXT := NULL;
    
    -- Resolved Branding & Identity
    v_resolved_coach_name TEXT := NULL;
    v_resolved_academy_name TEXT := 'Sport Academy';
    
    -- Tenant Scalar Fields (Verified Schema: tenants.tenant_id)
    v_tenant_db_id UUID := NULL;
    v_tenant_name TEXT := NULL;
    v_tenant_qris_url TEXT := NULL;
    v_tenant_qris_image_base64 TEXT := NULL;
    v_tenant_bank_name TEXT := NULL;
    v_tenant_bank_account_name TEXT := NULL;
    v_tenant_bank_account_number TEXT := NULL;
    v_tenant_bank_accounts JSONB := '[]'::jsonb;
    
    -- Output Aggregates
    v_upcoming_sessions JSONB := '[]'::jsonb;
    v_schedules JSONB := '[]'::jsonb;
    v_attendance JSONB := '[]'::jsonb;
    v_evaluations JSONB := '[]'::jsonb;
    v_spp_payments JSONB := '[]'::jsonb;
BEGIN
    -- 1. STRICT AUTHORIZATION (UUID auth.uid IS MANDATORY)
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Sesi orang tua tidak terautentikasi'
        );
    END IF;

    -- Strict Parent Ownership & Tenant Isolation Validation via EXISTS
    IF NOT EXISTS (
        SELECT 1
        FROM public.parent_accounts pa
        JOIN public.parent_student_links psl ON psl.parent_account_id = pa.id AND psl.tenant_id = pa.tenant_id
        JOIN public.students s ON psl.student_id = s.id AND psl.tenant_id = s.tenant_id
        WHERE pa.auth_uid = v_auth_uid
          AND pa.status = 'active'
          AND psl.status = 'active'
          AND s.id = p_student_id
          AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'FORBIDDEN',
            'message', 'Akses ke data siswa ini ditolak'
        );
    END IF;

    -- 2. FETCH STUDENT RECORD (VERIFIED COLUMNS ONLY)
    SELECT 
        s.id,
        COALESCE(s.student_name, s.name, ''),
        s.photo_url,
        s.class_id,
        s.class_name,
        s.coach_name,
        s.tenant_id,
        s.academy_name,
        s.birth_date,
        COALESCE(s.school_origin, ''),
        COALESCE(s.sport_category, 'Badminton'),
        COALESCE(s.monthly_fee, 0)
    INTO 
        v_student_id,
        v_student_name,
        v_student_photo_url,
        v_student_class_id,
        v_student_class_name,
        v_student_coach_name,
        v_student_tenant_id,
        v_student_academy_name,
        v_student_birth_date,
        v_student_school_origin,
        v_student_sport_category,
        v_student_monthly_fee
    FROM public.students s
    WHERE s.id = p_student_id
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id);

    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'STUDENT_NOT_FOUND',
            'message', 'Data siswa tidak ditemukan'
        );
    END IF;

    -- 3. FETCH CLASS & COACH (VERIFIED SCHEMA: is_archived IS NOT TRUE)
    IF v_student_class_id IS NOT NULL THEN
        SELECT 
            c.class_name,
            c.academy_name,
            c.coach_id,
            c.coach_name,
            c.schedules,
            co.name
        INTO 
            v_class_name,
            v_class_academy_name,
            v_class_coach_id,
            v_class_coach_name,
            v_class_schedules,
            v_coach_name_from_table
        FROM public.academy_classes c
        LEFT JOIN public.coaches co ON (c.coach_id = co.id AND c.tenant_id = co.tenant_id)
        WHERE c.id = v_student_class_id 
          AND c.tenant_id = v_student_tenant_id
          AND (c.is_archived IS NOT TRUE);
    END IF;

    -- Resolve Coach Identity
    v_resolved_coach_name := COALESCE(v_coach_name_from_table, v_class_coach_name, v_student_coach_name, NULL);

    -- 4. DETERMINISTIC TENANT LOOKUP (PRIORITY MATCH: t.tenant_id FIRST, THEN t.id)
    IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.tenant_id = v_student_tenant_id) THEN
        SELECT 
            t.id,
            t.name,
            t.qris_url,
            t.qris_image_base64,
            t.bank_name,
            t.bank_account_name,
            t.bank_account_number,
            t.bank_accounts
        INTO 
            v_tenant_db_id,
            v_tenant_name,
            v_tenant_qris_url,
            v_tenant_qris_image_base64,
            v_tenant_bank_name,
            v_tenant_bank_account_name,
            v_tenant_bank_account_number,
            v_tenant_bank_accounts
        FROM public.tenants t
        WHERE t.tenant_id = v_student_tenant_id
        ORDER BY t.id ASC
        LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id::text = v_student_tenant_id) THEN
        SELECT 
            t.id,
            t.name,
            t.qris_url,
            t.qris_image_base64,
            t.bank_name,
            t.bank_account_name,
            t.bank_account_number,
            t.bank_accounts
        INTO 
            v_tenant_db_id,
            v_tenant_name,
            v_tenant_qris_url,
            v_tenant_qris_image_base64,
            v_tenant_bank_name,
            v_tenant_bank_account_name,
            v_tenant_bank_account_number,
            v_tenant_bank_accounts
        FROM public.tenants t
        WHERE t.id::text = v_student_tenant_id
        ORDER BY t.id ASC
        LIMIT 1;
    END IF;

    -- 5. RESOLVE ACADEMY BRANDING PRIORITY (STUDENT ACADEMY NAME FIRST)
    v_resolved_academy_name := COALESCE(
        NULLIF(trim(v_student_academy_name), ''),
        NULLIF(trim(v_class_academy_name), ''),
        NULLIF(trim(v_tenant_name), ''),
        'Chua Sport Academy'
    );

    -- 6. FETCH UPCOMING BOOKINGS (MATCHES STUDENT CLASS BOOKINGS, MAX 12, EXCLUDES CANCELLED/VOID)
    IF v_student_class_id IS NOT NULL THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', b.id,
                'date', b.date,
                'start_time', b.start_time,
                'end_time', b.end_time,
                'startTime', b.start_time,
                'endTime', b.end_time,
                'court_name', COALESCE(co.name, b.court_name, 'Lapangan Utama'),
                'courtName', COALESCE(co.name, b.court_name, 'Lapangan Utama'),
                'status', b.status,
                'class_id', b.class_id,
                'tenant_id', b.tenant_id
            ) ORDER BY b.date ASC, b.start_time ASC, b.id ASC
        ) INTO v_upcoming_sessions
        FROM (
            SELECT b.id, b.date, b.start_time, b.end_time, b.court_id, b.court_name, b.status, b.class_id, b.tenant_id
            FROM public.bookings b
            WHERE b.class_id::text = v_student_class_id::text
              AND b.tenant_id = v_student_tenant_id
              AND b.date >= CURRENT_DATE
              AND (b.is_void IS NOT TRUE)
              AND (b.status IS NULL OR UPPER(BTRIM(b.status)) NOT IN ('DIBATALKAN', 'BATAL', 'CANCELLED', 'VOID'))
            ORDER BY b.date ASC, b.start_time ASC, b.id ASC
            LIMIT 12
        ) b
        LEFT JOIN public.courts co ON (b.court_id = co.id AND b.tenant_id = co.tenant_id);
    END IF;

    v_upcoming_sessions := COALESCE(v_upcoming_sessions, '[]'::jsonb);
    v_schedules := COALESCE(v_class_schedules, '[]'::jsonb);

    -- 7. FETCH ACADEMY ATTENDANCE (SAFE ATTENDANCE JSONB EXTRACTION & EXACT-RECORD DEDUPLICATION)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', att.id,
            'date', att.date,
            'status', att.status,
            'notes', att.notes,
            'class_name', COALESCE(
                att.class_name,
                v_class_name,
                v_student_class_name,
                'Kelas Reguler'
            ),
            'coach_name', COALESCE(
                att.coach_name,
                v_resolved_coach_name
            )
        )
        ORDER BY att.date DESC, att.id DESC
    )
    INTO v_attendance
    FROM (
        SELECT DISTINCT ON (att_inner.id)
            att_inner.id,
            att_inner.date,
            att_inner.status,
            att_inner.notes,
            att_inner.class_name,
            att_inner.coach_name
        FROM (
            -- Single-student attendance
            SELECT
                a.id,
                a.date,
                a.status,
                a.notes,
                a.class_name,
                a.coach_name
            FROM public.academy_attendance a
            WHERE a.tenant_id = v_student_tenant_id
              AND a.student_id = v_student_id

            UNION ALL

            -- Class-session attendance stored in students_data JSONB
            SELECT
                a.id,
                a.date,
                elem.value->>'status' AS status,
                COALESCE(elem.value->>'notes', a.notes) AS notes,
                a.class_name,
                a.coach_name
            FROM public.academy_attendance a
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(a.students_data) = 'array'
                    THEN a.students_data
                    ELSE '[]'::jsonb
                END
            ) AS elem(value)
            WHERE a.tenant_id = v_student_tenant_id
              AND a.class_id = v_student_class_id
              AND a.student_id IS NULL
              AND (
                  elem.value->>'studentId' = v_student_id::text
                  OR elem.value->>'student_id' = v_student_id::text
                  OR elem.value->>'id' = v_student_id::text
              )
        ) att_inner
        ORDER BY att_inner.id, att_inner.date DESC
    ) att;

    v_attendance := COALESCE(v_attendance, '[]'::jsonb);

    -- 8. EVALUATIONS CONTRACT (PRODUCT DECISION: RETURN EMPTY ARRAY UNTIL PUBLICATION LIFECYCLE IS PROVED)
    v_evaluations := '[]'::jsonb;

    -- 9. FETCH SPP PAYMENTS (VERIFIED COLUMNS ONLY: NO payment_date)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'paid_month', p.paid_month,
            'month', p.month,
            'month_period', p.month,
            'amount', p.amount,
            'payment_method', p.payment_method,
            'status', p.status,
            'is_paid', p.is_paid,
            'notes', p.notes,
            'created_at', p.created_at
        ) ORDER BY p.created_at DESC, p.id DESC
    ) INTO v_spp_payments
    FROM public.spp_payments p
    WHERE p.student_id = v_student_id 
      AND p.tenant_id = v_student_tenant_id;

    v_spp_payments := COALESCE(v_spp_payments, '[]'::jsonb);

    -- 10. CONSTRUCT COMPLETE JSON RESPONSE (PRESERVING ALL FRONTEND CONTRACT KEYS)
    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student_id,
            'student_id', v_student_id,
            'student_name', v_student_name,
            'studentName', v_student_name,
            'photo_url', v_student_photo_url,
            'photoUrl', v_student_photo_url,
            'class_id', v_student_class_id,
            'class_name', COALESCE(v_class_name, v_student_class_name, 'Kelas Reguler'),
            'className', COALESCE(v_class_name, v_student_class_name, 'Kelas Reguler'),
            'coach_id', v_class_coach_id,
            'coach_name', v_resolved_coach_name,
            'coachName', v_resolved_coach_name,
            'tenant_id', v_student_tenant_id,
            'tenant_name', COALESCE(v_tenant_name, ''),
            'academy_name', v_resolved_academy_name,
            'academyName', v_resolved_academy_name,
            'birth_date', v_student_birth_date,
            'birthDate', v_student_birth_date,
            'school_name', v_student_school_origin,
            'schoolOrigin', v_student_school_origin,
            'sport_category', v_student_sport_category,
            'sportCategory', v_student_sport_category,
            'monthly_fee', v_student_monthly_fee
        ),
        'tenant', jsonb_build_object(
            'id', COALESCE(v_tenant_db_id::text, v_student_tenant_id),
            'tenant_id', v_student_tenant_id,
            'name', COALESCE(v_tenant_name, ''),
            'qris_url', v_tenant_qris_url,
            'qris_image_base64', v_tenant_qris_image_base64,
            'bank_name', v_tenant_bank_name,
            'bank_account_name', v_tenant_bank_account_name,
            'bank_account_number', v_tenant_bank_account_number,
            'bank_accounts', COALESCE(v_tenant_bank_accounts, '[]'::jsonb)
        ),
        'upcoming_sessions', v_upcoming_sessions,
        'schedules', v_schedules,
        'attendance', v_attendance,
        'evaluations', v_evaluations,
        'spp_payments', v_spp_payments
    );
END;
$$;

-- Security Grants
REVOKE ALL ON FUNCTION public.portal_get_student_dashboard(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.portal_get_student_dashboard(UUID, TEXT) TO authenticated;
