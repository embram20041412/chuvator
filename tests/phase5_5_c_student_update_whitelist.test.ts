import { test } from 'node:test';
import assert from 'node:assert';
import { updateStudent, ALLOWED_STUDENT_UPDATE_COLUMNS } from '../src/services/supabaseAcademyService.js';
import { supabase } from '../src/services/supabaseClient.js';

test('CHUVATOR — FASE 5.5-C: Student Update Column Whitelist & Error 42501 Defense', async (t) => {
  await t.test('1. Whitelist Verification: Protected columns MUST be strictly excluded', () => {
    // Columns that MUST be allowed
    const expectedWhitelisted = [
      'student_name', 'birth_date', 'nik', 'no_kk', 'school_origin',
      'academy_id', 'academy_name', 'class_id', 'class_name', 'coach_name',
      'sport_category', 'player_role', 'parent_name', 'parent_phone', 'phone',
      'contact_phone', 'province', 'regency', 'district', 'village',
      'address_detail', 'join_date', 'registration_fee', 'registration_fee_paid',
      'is_registration_fee_paid', 'registration_fee_paid_at', 'monthly_fee',
      'payment_status', 'spp_status', 'last_paid_month', 'last_paid_date',
      'last_spp_paid_at', 'height', 'weight', 'photo_url', 'tournaments',
      'growth_history', 'updated_at'
    ];

    for (const col of expectedWhitelisted) {
      assert.ok(ALLOWED_STUDENT_UPDATE_COLUMNS.has(col), `Column '${col}' must be in ALLOWED_STUDENT_UPDATE_COLUMNS whitelist`);
    }

    // Strictly forbidden columns
    const forbiddenColumns = ['id', 'tenant_id', 'created_at', 'nik_kk', 'kk_hmac', 'kk_last4'];
    for (const col of forbiddenColumns) {
      assert.strictEqual(
        ALLOWED_STUDENT_UPDATE_COLUMNS.has(col),
        false,
        `Forbidden column '${col}' MUST NOT be in ALLOWED_STUDENT_UPDATE_COLUMNS whitelist`
      );
    }
  });

  await t.test('2. updateStudent Payload Sanitization: Strips non-whitelisted and forbidden fields', async () => {
    const originalFrom = supabase.from;
    let capturedPayload: any = null;

    // Mock supabase update chain
    supabase.from = ((tableName: string) => {
      if (tableName === 'students') {
        return {
          update: (payload: Record<string, any>) => {
            capturedPayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: 'student-123', student_name: 'Test Budi', no_kk: '1234567890123456', nik: '1234567890123456' },
                    error: null
                  })
                })
              })
            };
          }
        } as any;
      }
      return originalFrom.call(supabase, tableName);
    }) as any;

    try {
      await updateStudent('student-123', {
        studentName: 'Test Budi',
        nik: '1234567890123456',
        noKk: '1234567890123456',
        // Attempting to pass forbidden/protected fields:
        id: 'hacked-id',
        tenantId: 'hacked-tenant',
        nikKk: 'hacked-nik-kk',
        kkHmac: 'hacked-hmac',
        kkLast4: '3456',
        createdAt: '2020-01-01'
      } as any);

      assert.ok(capturedPayload, 'UPDATE payload must be captured');
      assert.strictEqual(capturedPayload.student_name, 'Test Budi');
      assert.strictEqual(capturedPayload.nik, '1234567890123456');
      assert.strictEqual(capturedPayload.no_kk, '1234567890123456');

      // Assert forbidden fields were stripped out
      assert.strictEqual(capturedPayload.id, undefined);
      assert.strictEqual(capturedPayload.tenant_id, undefined);
      assert.strictEqual(capturedPayload.created_at, undefined);
      assert.strictEqual(capturedPayload.nik_kk, undefined);
      assert.strictEqual(capturedPayload.kk_hmac, undefined);
      assert.strictEqual(capturedPayload.kk_last4, undefined);
    } finally {
      supabase.from = originalFrom;
    }
  });

  await t.test('3. Error 42501 Handling: Re-throws clear exception when Supabase returns 42501', async () => {
    const originalFrom = supabase.from;

    supabase.from = ((tableName: string) => {
      if (tableName === 'students') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: '42501',
                    message: 'permission denied for table students',
                    details: 'column level grant update missing'
                  }
                })
              })
            })
          }) as any
        } as any;
      }
      return originalFrom.call(supabase, tableName);
    }) as any;

    try {
      await updateStudent('student-123', { studentName: 'New Name' });
      assert.fail('updateStudent must throw error on 42501');
    } catch (err: any) {
      assert.strictEqual(err.code, '42501');
      assert.match(err.message, /Akses ditolak \(42501\)/);
    } finally {
      supabase.from = originalFrom;
    }
  });
});
