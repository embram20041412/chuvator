import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as coachStudentsHandler } from '../functions/api/coach/students.js';

test('Coach / Admin Students API: Atomically appends new entry to growth_history', async (t) => {
  await t.test('1. Valid request with height_cm and weight_kg generates required growth_history entry structure', async () => {
    // Mock context with env and mock fetch
    const mockStudentId = '550e8400-e29b-41d4-a716-446655440000';
    const mockEnv = {
      VITE_SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key'
    };

    let updatedPayload: any = null;

    // Global fetch mock
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/rest/v1/students?id=')) {
        if (init?.method === 'GET') {
          return new Response(JSON.stringify([{
            id: mockStudentId,
            student_name: 'Budi Santoso',
            height: 165,
            weight: 55,
            height_cm: 165,
            weight_kg: 55,
            growth_history: [
              { date: '2026-10-01', height_cm: 160, weight_kg: 52, bmi: 20.3, notes: 'Pengukuran Awal' }
            ]
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } else if (init?.method === 'PATCH') {
          updatedPayload = JSON.parse(init.body as string);
          return new Response(JSON.stringify([{
            id: mockStudentId,
            ...updatedPayload
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as any;

    try {
      const req = new Request('https://mock.local/api/coach/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: mockStudentId,
          height_cm: 170,
          weight_kg: 65,
          notes: 'Tes Pengukuran Rutin Nov',
          date: '2026-11-08'
        })
      });

      const response = await coachStudentsHandler({ request: req, env: mockEnv } as any);
      assert.equal(response.status, 200);

      const json = await response.json();
      assert.equal(json.success, true);
      assert.ok(json.new_entry);
      assert.equal(json.new_entry.date, '2026-11-08');
      assert.equal(json.new_entry.height_cm, 170);
      assert.equal(json.new_entry.weight_kg, 65);
      assert.equal(json.new_entry.bmi, 22.5); // 65 / (1.7*1.7) = 22.4913 -> 22.5
      assert.equal(json.new_entry.status, 'Proporsional');
      assert.equal(json.new_entry.notes, 'Tes Pengukuran Rutin Nov');

      // Verify DB update payload
      assert.ok(updatedPayload);
      assert.equal(updatedPayload.height_cm, 170);
      assert.equal(updatedPayload.weight_kg, 65);
      assert.equal(updatedPayload.height, 170);
      assert.equal(updatedPayload.weight, 65);
      assert.equal(updatedPayload.growth_history.length, 2);
      assert.equal(updatedPayload.growth_history[1].height_cm, 170);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
