-- =============================================================================
-- CHUVATOR (CHUA SPORT CORE) — FASE 1D
-- SMART ROUTINE BOOKING & COLLISION SUGGESTION RPC
-- Target: Supabase PostgreSQL
-- Purpose: Generator Jadwal Rutin Kelas Akademi dengan Deteksi Bentrok Atomik
--          dan Rekomendasi Lapangan Alternatif Bebas Race Condition.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_academy_schedule(
    p_tenant_id TEXT,
    p_class_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_schedules JSONB,
    p_override_court_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_class_name TEXT;
    v_class_sport TEXT;
    v_sched_count INT;
    v_current_date DATE;
    v_dow INT;
    v_dow_name TEXT;
    
    -- Variables for schedule item
    v_item JSONB;
    v_item_day TEXT;
    v_item_start TEXT;
    v_item_end TEXT;
    v_item_court_id UUID;
    v_target_court_id UUID;
    v_target_court_name TEXT;
    
    -- Conflict tracking
    v_conflict_found BOOLEAN := false;
    v_conflict_date DATE;
    v_conflict_start TEXT;
    v_conflict_end TEXT;
    v_conflict_cust_name TEXT;
    v_conflict_type TEXT;
    v_conflict_court_name TEXT;
    v_conflict_court_id UUID;

    -- Slot record for array iteration
    v_slot RECORD;
    v_inserted_count INT := 0;

    -- Suggestion variables
    v_alt_court RECORD;
    v_alt_court_id UUID := NULL;
    v_alt_court_name TEXT := NULL;
    v_alt_has_conflict BOOLEAN;
BEGIN
    -- 1. Validasi Parameter Awal
    IF p_tenant_id IS NULL OR trim(p_tenant_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_PARAM', 'message', 'Tenant ID wajib diisi');
    END IF;

    IF p_class_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_PARAM', 'message', 'Class ID wajib diisi');
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_PARAM', 'message', 'Rentang tanggal wajib diisi');
    END IF;

    IF p_start_date > p_end_date THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_RANGE', 'message', 'Tanggal mulai tidak boleh melebihi tanggal selesai');
    END IF;

    IF p_schedules IS NULL OR jsonb_typeof(p_schedules) != 'array' OR jsonb_array_length(p_schedules) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMPTY_SCHEDULE', 'message', 'Array jadwal kelas kosong atau tidak valid');
    END IF;

    -- 2. Ambil Informasi Kelas
    SELECT class_name, sport INTO v_class_name, v_class_sport
    FROM public.academy_classes
    WHERE id = p_class_id AND tenant_id = p_tenant_id;

    IF v_class_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CLASS_NOT_FOUND', 'message', 'Data kelas tidak ditemukan pada tenant ini');
    END IF;

    -- 3. Siapkan Tabel Temporer untuk Menyimpan Seluruh Slot yang Direncanakan
    CREATE TEMP TABLE IF NOT EXISTS _planned_slots (
        slot_date DATE,
        start_time TEXT,
        end_time TEXT,
        court_id UUID,
        court_name TEXT
    ) ON COMMIT DROP;

    DELETE FROM _planned_slots WHERE true;

    -- Loop tanggal menggunakan generate_series
    FOR v_current_date IN 
        SELECT d::DATE 
        FROM generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval) AS d
    LOOP
        -- EXTRACT(ISODOW FROM date): 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
        v_dow := EXTRACT(ISODOW FROM v_current_date);
        v_dow_name := CASE v_dow
            WHEN 1 THEN 'Senin'
            WHEN 2 THEN 'Selasa'
            WHEN 3 THEN 'Rabu'
            WHEN 4 THEN 'Kamis'
            WHEN 5 THEN 'Jumat'
            WHEN 6 THEN 'Sabtu'
            WHEN 7 THEN 'Minggu'
        END;

        -- Periksa setiap jadwal di array p_schedules
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_schedules)
        LOOP
            v_item_day := trim(COALESCE(v_item->>'day', ''));
            
            -- Cocokkan hari (bisa format Indonesia atau case-insensitive)
            IF LOWER(v_item_day) = LOWER(v_dow_name) OR 
               (LOWER(v_item_day) = 'monday' AND v_dow = 1) OR
               (LOWER(v_item_day) = 'tuesday' AND v_dow = 2) OR
               (LOWER(v_item_day) = 'wednesday' AND v_dow = 3) OR
               (LOWER(v_item_day) = 'thursday' AND v_dow = 4) OR
               (LOWER(v_item_day) = 'friday' AND v_dow = 5) OR
               (LOWER(v_item_day) = 'saturday' AND v_dow = 6) OR
               (LOWER(v_item_day) = 'sunday' AND v_dow = 7)
            THEN
                v_item_start := COALESCE(v_item->>'startTime', v_item->>'start_time', '15:00');
                v_item_end := COALESCE(v_item->>'endTime', v_item->>'end_time', '17:00');
                
                -- Jika p_override_court_id diberikan, gunakan override tersebut
                IF p_override_court_id IS NOT NULL THEN
                    v_target_court_id := p_override_court_id;
                ELSE
                    v_target_court_id := NULLIF(COALESCE(v_item->>'courtId', v_item->>'court_id', ''), '')::UUID;
                END IF;

                -- Ambil nama lapangan aktual
                SELECT name INTO v_target_court_name
                FROM public.courts
                WHERE id = v_target_court_id AND tenant_id = p_tenant_id;

                IF v_target_court_name IS NULL THEN
                    v_target_court_name := COALESCE(v_item->>'courtName', v_item->>'court_name', 'Lapangan Utama');
                END IF;

                -- Masukkan ke tabel temporer rencana slot
                INSERT INTO _planned_slots (slot_date, start_time, end_time, court_id, court_name)
                VALUES (v_current_date, v_item_start, v_item_end, v_target_court_id, v_target_court_name);
            END IF;
        END LOOP;
    END LOOP;

    -- Periksa apakah ada slot yang dihasilkan
    SELECT count(*) INTO v_sched_count FROM _planned_slots;
    IF v_sched_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'NO_MATCHING_DATES', 
            'message', 'Tidak ada tanggal yang cocok dengan pola hari jadwal pada rentang tanggal ini.'
        );
    END IF;

    -- 4. CEK BENTROK JADWAL SECARA ATOMIK DENGAN ROW-LOCKING
    -- Gunakan SELECT ... FOR SHARE / UPDATE pada bookings terkait untuk mencegah race condition kasir
    FOR v_slot IN SELECT * FROM _planned_slots ORDER BY slot_date, start_time
    LOOP
        SELECT 
            b.date,
            b.start_time,
            b.end_time,
            COALESCE(b.customer_name, 'Penyewa Reguler'),
            COALESCE(b.booking_type, 'REGULAR'),
            COALESCE(c.name, v_slot.court_name),
            b.court_id
        INTO 
            v_conflict_date,
            v_conflict_start,
            v_conflict_end,
            v_conflict_cust_name,
            v_conflict_type,
            v_conflict_court_name,
            v_conflict_court_id
        FROM public.bookings b
        LEFT JOIN public.courts c ON b.court_id = c.id
        WHERE b.tenant_id = p_tenant_id
          AND b.court_id = v_slot.court_id
          AND b.date = v_slot.slot_date
          AND b.status NOT IN ('Dibatalkan', 'Cancelled', 'VOID')
          AND (v_slot.start_time < b.end_time AND v_slot.end_time > b.start_time)
        LIMIT 1;

        IF v_conflict_date IS NOT NULL THEN
            v_conflict_found := true;
            EXIT; -- Keluar dari loop saat bentrok pertama ditemukan
        END IF;
    END LOOP;

    -- 5. JIKA BENTROK: BATALKAN INSERT & CARI SARAN LAPANGAN ALTERNATIF
    IF v_conflict_found THEN
        -- Cari lapangan alternatif di tenant yang sama:
        -- Harus memiliki cabor yang sama, aktif, dan bukan lapangan yang sedang bentrok
        FOR v_alt_court IN 
            SELECT id, name
            FROM public.courts
            WHERE tenant_id = p_tenant_id
              AND is_active = true
              AND id != v_conflict_court_id
              AND (
                  v_class_sport IS NULL 
                  OR LOWER(sport) = LOWER(v_class_sport) 
                  OR sport IS NULL
              )
            ORDER BY name ASC
        LOOP
            -- Cek apakah lapangan alternatif ini BEBAS DARI BENTROK untuk SELURUH slot yang direncanakan
            v_alt_has_conflict := false;

            FOR v_slot IN SELECT * FROM _planned_slots
            LOOP
                IF EXISTS (
                    SELECT 1 
                    FROM public.bookings b
                    WHERE b.tenant_id = p_tenant_id
                      AND b.court_id = v_alt_court.id
                      AND b.date = v_slot.slot_date
                      AND b.status NOT IN ('Dibatalkan', 'Cancelled', 'VOID')
                      AND (v_slot.start_time < b.end_time AND v_slot.end_time > b.start_time)
                ) THEN
                    v_alt_has_conflict := true;
                    EXIT; -- Lapangan ini bentrok di salah satu tanggal, skip
                END IF;
            END LOOP;

            -- Jika lapangan alternatif ini 100% aman untuk seluruh tanggal
            IF NOT v_alt_has_conflict THEN
                v_alt_court_id := v_alt_court.id;
                v_alt_court_name := v_alt_court.name;
                EXIT; -- Pilih rekomendasi pertama yang aman
            END IF;
        END LOOP;

        -- Return payload respons bentrok lengkap dengan rekomendasi
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CONFLICT',
            'conflict_details', jsonb_build_object(
                'date', v_conflict_date,
                'start_time', v_conflict_start,
                'end_time', v_conflict_end,
                'customer_name', v_conflict_cust_name,
                'booking_type', v_conflict_type,
                'court_name', v_conflict_court_name
            ),
            'suggestion_court', CASE 
                WHEN v_alt_court_id IS NOT NULL THEN
                    jsonb_build_object('id', v_alt_court_id, 'name', v_alt_court_name)
                ELSE NULL
            END
        );
    END IF;

    -- 6. JIKA TIDAK ADA BENTROK: EKSEKUSI INSERT BULK SECARA ATOMIK
    FOR v_slot IN SELECT * FROM _planned_slots ORDER BY slot_date, start_time
    LOOP
        INSERT INTO public.bookings (
            tenant_id,
            class_id,
            court_id,
            court_name,
            date,
            booking_date,
            start_time,
            end_time,
            booking_type,
            customer_name,
            customer_phone,
            status,
            total_price,
            price,
            payment_method,
            notes,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            p_class_id,
            v_slot.court_id,
            v_slot.court_name,
            v_slot.slot_date,
            v_slot.slot_date,
            v_slot.start_time,
            v_slot.end_time,
            'ACADEMY',
            'Akademi: ' || v_class_name,
            '-',
            'Lunas',
            0,
            0,
            'Internal GOR',
            'Rutin Otomatis Kelas ' || v_class_name,
            now(),
            now()
        );
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    -- Return JSON sukses
    RETURN jsonb_build_object(
        'success', true,
        'total_inserted', v_inserted_count,
        'message', format('Berhasil mengunci %s sesi jadwal lapangan untuk kelas %s', v_inserted_count, v_class_name)
    );
END;
$$;

-- Izin Eksekusi: Berikan akses ke authenticated dan service_role
REVOKE ALL ON FUNCTION public.generate_academy_schedule(TEXT, UUID, DATE, DATE, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_academy_schedule(TEXT, UUID, DATE, DATE, JSONB, UUID) TO authenticated, service_role;
