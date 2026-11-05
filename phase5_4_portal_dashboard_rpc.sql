-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 5.4 (SECURITY & INTEGRITY CORRECTION)
-- RPC: public.portal_get_student_dashboard
-- Purpose: Consolidated Parent Portal Student Dashboard Data Fetcher
-- Security: SECURITY DEFINER, search_path = public, extensions, pg_temp
-- Authorization: Strict auth.uid() matching via parent_accounts -> parent_student_links (parent_account_id & tenant_id)
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
    v_auth_uid TEXT := auth.uid()::text;
    v_parent_id UUID;
    
    -- Student, Class & Tenant Variables
    v_student RECORD;
    v_class RECORD;
    v_tenant RECORD;
    v_coach_name TEXT := NULL;
    v_coach_photo_url TEXT := NULL;
    v_academy_name TEXT := 'Sport Academy';
    
    -- Output Aggregates
    v_upcoming_sessions JSONB := '[]'::JSONB;
    v_schedules JSONB := '[]'::JSONB;
    v_attendance JSONB := '[]'::JSONB;
    v_evaluations JSONB := '[]'::JSONB;
    v_spp_payments JSONB := '[]'::JSONB;
    
    -- Helper loop variables for schedule expansion
    v_sched_item JSONB;
    v_day_name TEXT;
    v_dow_target INT;
    v_curr_date DATE;
    v_curr_dow INT;
    v_generated_sessions JSONB := '[]'::JSONB;
    v_slot_key TEXT;
    v_seen_keys JSONB := '{}'::JSONB;
BEGIN
    -- 1. STRICT AUTHORIZATION & PARENT-STUDENT TENANT ISOLATION CHECK
    IF v_auth_uid IS NOT NULL THEN
        -- Standard Parent Auth: Match auth.uid() strictly against parent_accounts -> parent_student_links
        -- Enforces parent_student_links.tenant_id = students.tenant_id
        SELECT pa.id INTO v_parent_id
        FROM public.parent_accounts pa
        JOIN public.parent_student_links psl ON psl.parent_account_id = pa.id
        JOIN public.students s ON psl.student_id = s.id
        WHERE pa.auth_uid = v_auth_uid
          AND psl.student_id = p_student_id
          AND psl.tenant_id = s.tenant_id
          AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
          AND psl.status = 'active'
        LIMIT 1;

        IF v_parent_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'FORBIDDEN',
                'message', 'Akses ke data siswa ini ditolak'
            );
        END IF;
    ELSIF current_setting('role', true) = 'service_role' THEN
        -- Elevated Backend Access: Only permitted when auth.uid() is NULL and role is service_role
        NULL;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Sesi orang tua tidak terautentikasi'
        );
    END IF;

    -- 2. FETCH STUDENT RECORD (WITH TENANT ISOLATION)
    SELECT 
        s.id,
        s.student_name,
        s.name,
        s.photo_url,
        s.class_id,
        s.class_name,
        s.tenant_id,
        s.academy_name,
        s.birth_date,
        s.school_name,
        s.sport_category,
        s.sport,
        s.spp_monthly_fee,
        s.monthly_fee
    INTO v_student
    FROM public.students s
    WHERE s.id = p_student_id
      AND (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id);

    IF v_student.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'STUDENT_NOT_FOUND',
            'message', 'Data siswa tidak ditemukan'
        );
    END IF;

    -- 3. FETCH CLASS & COACH RECORD (STRICT TENANT ISOLATION)
    IF v_student.class_id IS NOT NULL THEN
        SELECT 
            c.id,
            c.class_name,
            c.academy_name,
            c.coach_id,
            c.coach_name,
            c.schedules,
            co.name AS coach_name_from_table,
            co.photo_url AS coach_photo_from_table
        INTO v_class
        FROM public.academy_classes c
        LEFT JOIN public.coaches co ON (c.coach_id = co.id AND c.tenant_id = co.tenant_id)
        WHERE c.id = v_student.class_id AND c.tenant_id = v_student.tenant_id;
    END IF;

    -- Resolve Coach Name & Photo
    v_coach_name := COALESCE(v_class.coach_name_from_table, v_class.coach_name, NULL);
    v_coach_photo_url := COALESCE(v_class.coach_photo_from_table, NULL);

    -- 4. UNAMBIGUOUS TENANT LOOKUP (PRIORITY ORDER: 1. tenants.id = student.tenant_id, 2. tenants.tenant_id = student.tenant_id)
    SELECT 
        t.id,
        t.tenant_id,
        t.name,
        t.qris_url,
        t.qris_image_base64,
        t.bank_name,
        t.bank_account_name,
        t.bank_account_number,
        t.bank_accounts
    INTO v_tenant
    FROM public.tenants t
    WHERE t.id::text = v_student.tenant_id
    LIMIT 1;

    IF v_tenant.id IS NULL THEN
        SELECT 
            t.id,
            t.tenant_id,
            t.name,
            t.qris_url,
            t.qris_image_base64,
            t.bank_name,
            t.bank_account_name,
            t.bank_account_number,
            t.bank_accounts
        INTO v_tenant
        FROM public.tenants t
        WHERE t.tenant_id = v_student.tenant_id
        LIMIT 1;
    END IF;

    -- 5. RESOLVE ACADEMY IDENTITY (STRICT PRIORITY ORDER)
    -- Priority: 1) academy_classes.academy_name -> 2) students.academy_name -> 3) tenants.name -> 4) 'Sport Academy'
    v_academy_name := COALESCE(
        NULLIF(trim(v_class.academy_name), ''),
        NULLIF(trim(v_student.academy_name), ''),
        NULLIF(trim(v_tenant.name), ''),
        'Sport Academy'
    );

    -- 6. FETCH UPCOMING BOOKINGS (SCHEDULE) WITH UUID TO TEXT CAST (b.class_id::text = v_student.class_id::text)
    -- DDL schema defines bookings.class_id as UUID. Casting both to ::text prevents type mismatch exceptions.
    -- Preserves actual status without forcing 'Lunas' on NULL status.
    -- Excludes void (is_void IS TRUE) and cancelled bookings.
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
        )
    ) INTO v_upcoming_sessions
    FROM (
        SELECT b.id, b.date, b.start_time, b.end_time, b.court_id, b.court_name, b.status, b.class_id, b.tenant_id
        FROM public.bookings b
        WHERE b.class_id::text = v_student.class_id::text
          AND b.tenant_id = v_student.tenant_id
          AND b.date >= CURRENT_DATE
          AND (b.is_void IS NOT TRUE)
          AND (b.status IS NULL OR b.status NOT IN ('Dibatalkan', 'Cancelled', 'VOID'))
        ORDER BY b.date ASC, b.start_time ASC
    ) b
    LEFT JOIN public.courts co ON (b.court_id = co.id AND b.tenant_id = co.tenant_id);

    IF v_upcoming_sessions IS NOT NULL AND jsonb_array_length(v_upcoming_sessions) > 0 THEN
        -- Record existing booking keys (date_startTime) to prevent duplication with routine schedules
        FOR v_sched_item IN SELECT * FROM jsonb_array_elements(v_upcoming_sessions) LOOP
            v_slot_key := (v_sched_item->>'date') || '_' || (v_sched_item->>'start_time');
            v_seen_keys := jsonb_set(v_seen_keys, ARRAY[v_slot_key], 'true'::jsonb);
        END LOOP;
    ELSE
        v_upcoming_sessions := '[]'::JSONB;
    END IF;

    -- MERGED ROUTINE SCHEDULE EXPANSION (14 DAYS)
    -- Supplements upcoming bookings with routine class schedule slots for dates that do NOT already have explicit court bookings
    IF v_class.schedules IS NOT NULL AND jsonb_typeof(v_class.schedules) = 'array' AND jsonb_array_length(v_class.schedules) > 0 THEN
        v_generated_sessions := '[]'::JSONB;

        FOR v_curr_date IN 
            SELECT d::DATE FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '13 days', INTERVAL '1 day') AS d
        LOOP
            v_curr_dow := EXTRACT(ISODOW FROM v_curr_date);

            FOR v_sched_item IN SELECT * FROM jsonb_array_elements(v_class.schedules)
            LOOP
                v_day_name := trim(COALESCE(v_sched_item->>'day', ''));
                v_dow_target := CASE LOWER(v_day_name)
                    WHEN 'senin' THEN 1 WHEN 'monday' THEN 1
                    WHEN 'selasa' THEN 2 WHEN 'tuesday' THEN 2
                    WHEN 'rabu' THEN 3 WHEN 'wednesday' THEN 3
                    WHEN 'kamis' THEN 4 WHEN 'thursday' THEN 4
                    WHEN 'jumat' THEN 5 WHEN 'friday' THEN 5
                    WHEN 'sabtu' THEN 6 WHEN 'saturday' THEN 6
                    WHEN 'minggu' THEN 7 WHEN 'sunday' THEN 7
                    ELSE 0
                END;

                IF v_dow_target = v_curr_dow THEN
                    v_slot_key := v_curr_date::text || '_' || COALESCE(v_sched_item->>'startTime', v_sched_item->>'start_time', '15:00');
                    
                    -- Only append if this date/time slot does NOT already exist in bookings
                    IF NOT (v_seen_keys ? v_slot_key) THEN
                        v_seen_keys := jsonb_set(v_seen_keys, ARRAY[v_slot_key], 'true'::jsonb);
                        v_generated_sessions := v_generated_sessions || jsonb_build_array(
                            jsonb_build_object(
                                'id', 'gen-' || v_curr_date || '-' || COALESCE(v_sched_item->>'startTime', v_sched_item->>'start_time', '15:00'),
                                'date', v_curr_date,
                                'start_time', COALESCE(v_sched_item->>'startTime', v_sched_item->>'start_time', '15:00'),
                                'end_time', COALESCE(v_sched_item->>'endTime', v_sched_item->>'end_time', '17:00'),
                                'startTime', COALESCE(v_sched_item->>'startTime', v_sched_item->>'start_time', '15:00'),
                                'endTime', COALESCE(v_sched_item->>'endTime', v_sched_item->>'end_time', '17:00'),
                                'court_name', COALESCE(v_sched_item->>'courtName', v_sched_item->>'court_name', 'Lapangan Utama'),
                                'courtName', COALESCE(v_sched_item->>'courtName', v_sched_item->>'court_name', 'Lapangan Utama'),
                                'status', 'Rutin'
                            )
                        );
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    -- Merge explicit bookings with non-overlapping routine schedule slots, sort chronologically and limit to 12
    SELECT jsonb_agg(elem) INTO v_upcoming_sessions
    FROM (
        SELECT elem FROM jsonb_array_elements(v_upcoming_sessions || v_generated_sessions) AS elem
        ORDER BY (elem->>'date') ASC, (elem->>'start_time') ASC
        LIMIT 12
    ) sub;

    v_upcoming_sessions := COALESCE(v_upcoming_sessions, '[]'::JSONB);

    -- Class Schedules array
    v_schedules := COALESCE(v_class.schedules, '[]'::JSONB);

    -- 7. FETCH ATTENDANCE (VERIFIED SCHEMA: student_id & tenant_id FILTERS)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'date', a.date,
            'status', a.status,
            'notes', a.notes,
            'class_name', COALESCE(a.class_name, v_student.class_name, v_class.class_name),
            'coach_name', COALESCE(a.coach_name, v_coach_name)
        ) ORDER BY a.date DESC
    ) INTO v_attendance
    FROM public.academy_attendance a
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

    v_attendance := COALESCE(v_attendance, '[]'::JSONB);

    -- 8. FETCH EVALUATIONS (VERIFIED SCHEMA: created_at, coach_note, pillar_scores/scores)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', e.id,
            'evaluation_date', COALESCE(e.created_at::date, CURRENT_DATE),
            'created_at', e.created_at,
            'overall_score', e.overall_score,
            'notes', COALESCE(e.coach_note, ''),
            'coach_note', COALESCE(e.coach_note, ''),
            'category_scores', COALESCE(e.pillar_scores, e.scores, '{}'::jsonb),
            'pillar_scores', COALESCE(e.pillar_scores, e.scores, '{}'::jsonb)
        ) ORDER BY e.created_at DESC
    ) INTO v_evaluations
    FROM public.academy_evaluations e
    WHERE e.student_id = v_student.id AND e.tenant_id = v_student.tenant_id;

    v_evaluations := COALESCE(v_evaluations, '[]'::JSONB);

    -- 9. FETCH SPP PAYMENTS (VERIFIED PAYMENT INTEGRITY: NO DEFAULT FOR VERIFICATION STATUS & NO RECEIPT_NO ALIASING AS RECEIPT_URL)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'payment_date', p.payment_date,
            'month', p.month,
            'month_period', p.month,
            'year', p.year,
            'year_period', p.year,
            'amount', p.amount,
            'status', p.status,
            'verification_status', p.verification_status,
            'receipt_no', p.receipt_no
        ) ORDER BY p.created_at DESC
    ) INTO v_spp_payments
    FROM public.spp_payments p
    WHERE p.student_id = v_student.id AND p.tenant_id = v_student.tenant_id;

    v_spp_payments := COALESCE(v_spp_payments, '[]'::JSONB);

    -- 10. CONSTRUCT COMPLETE JSON RESPONSE WITH SEPARATE qris_url AND qris_image_base64
    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student.id,
            'student_id', v_student.id,
            'student_name', COALESCE(v_student.student_name, v_student.name, ''),
            'studentName', COALESCE(v_student.student_name, v_student.name, ''),
            'photo_url', v_student.photo_url,
            'photoUrl', v_student.photo_url,
            'class_id', v_student.class_id,
            'class_name', COALESCE(v_class.class_name, v_student.class_name, 'Kelas Reguler'),
            'className', COALESCE(v_class.class_name, v_student.class_name, 'Kelas Reguler'),
            'coach_id', v_class.coach_id,
            'coach_name', v_coach_name,
            'coachName', v_coach_name,
            'coach_photo_url', v_coach_photo_url,
            'tenant_id', v_student.tenant_id,
            'tenant_name', COALESCE(v_tenant.name, 'Sport Arena'),
            'academy_name', v_academy_name,
            'academyName', v_academy_name,
            'birth_date', v_student.birth_date,
            'birthDate', v_student.birth_date,
            'school_name', COALESCE(v_student.school_name, ''),
            'schoolOrigin', COALESCE(v_student.school_name, ''),
            'sport_category', COALESCE(v_student.sport_category, v_student.sport, 'Badminton'),
            'sportCategory', COALESCE(v_student.sport_category, v_student.sport, 'Badminton'),
            'monthly_fee', COALESCE(v_student.monthly_fee, v_student.spp_monthly_fee, 0)
        ),
        'tenant', jsonb_build_object(
            'id', COALESCE(v_tenant.id::text, v_student.tenant_id),
            'tenant_id', v_student.tenant_id,
            'name', COALESCE(v_tenant.name, 'Sport Arena'),
            'qris_url', v_tenant.qris_url,
            'qris_image_base64', v_tenant.qris_image_base64,
            'bank_name', v_tenant.bank_name,
            'bank_account_name', v_tenant.bank_account_name,
            'bank_account_number', v_tenant.bank_account_number,
            'bank_accounts', COALESCE(v_tenant.bank_accounts, '[]'::JSONB)
        ),
        'upcoming_sessions', v_upcoming_sessions,
        'schedules', v_schedules,
        'attendance', v_attendance,
        'evaluations', v_evaluations,
        'spp_payments', v_spp_payments
    );
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.portal_get_student_dashboard(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_student_dashboard(UUID, TEXT) TO authenticated, service_role;
