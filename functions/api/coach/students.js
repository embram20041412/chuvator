/**
 * Edge API Endpoint: /api/coach/students (atau /api/admin/students)
 * 
 * Bertanggung jawab menangani pembaruan data antropometri/pengukuran fisik siswa (Tinggi Badan & Berat Badan).
 * Menyimpan data secara atomik ke kolom skalar (height_cm, weight_kg, height, weight)
 * DAN menambahkan (append) entri baru ke dalam array JSONB `growth_history`.
 * 
 * Format entri `growth_history`:
 * {
 *   "date": "YYYY-MM-DD",
 *   "height_cm": 170,
 *   "weight_kg": 65,
 *   "height": 170,
 *   "weight": 65,
 *   "bmi": 22.5,
 *   "status": "Proporsional",
 *   "notes": "Pengukuran Rutin",
 *   "recordedAt": "ISO String"
 * }
 */

export async function onRequest(context) {
  const { request, env } = context;

  // Header CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
    return new Response(JSON.stringify({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Metode HTTP tidak diizinkan. Gunakan POST, PUT, atau PATCH.'
    }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://k3ugqrxx4vyuatbx4pin.supabase.co';
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({
        error: 'CONFIG_ERROR',
        message: 'Konfigurasi Supabase tidak ditemukan.'
      }), { status: 500, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.student_id || body.studentId || body.id;
    const heightVal = body.height_cm !== undefined ? body.height_cm : body.height;
    const weightVal = body.weight_kg !== undefined ? body.weight_kg : body.weight;
    const notes = body.notes || body.growthNotes || 'Pengukuran Antropometri';
    const inputDate = body.date || body.recordedDate || new Date().toISOString().split('T')[0];

    if (!studentId) {
      return new Response(JSON.stringify({
        error: 'MISSING_STUDENT_ID',
        message: 'student_id wajib disertakan.'
      }), { status: 400, headers: corsHeaders });
    }

    const numHeight = heightVal !== undefined && heightVal !== null && heightVal !== '' ? Number(heightVal) : null;
    const numWeight = weightVal !== undefined && weightVal !== null && weightVal !== '' ? Number(weightVal) : null;

    if ((numHeight === null || isNaN(numHeight)) && (numWeight === null || isNaN(numWeight))) {
      return new Response(JSON.stringify({
        error: 'INVALID_INPUT',
        message: 'Nilai tinggi badan (height_cm/height) atau berat badan (weight_kg/weight) wajib diisi.'
      }), { status: 400, headers: corsHeaders });
    }

    // 1. Ambil data siswa yang ada saat ini dari database
    const fetchUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=id,student_name,height,weight,growth_history`;
    const fetchResp = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fetchResp.ok) {
      const errText = await fetchResp.text();
      return new Response(JSON.stringify({
        error: 'DB_READ_ERROR',
        message: 'Gagal membaca data siswa dari database.',
        details: errText
      }), { status: 500, headers: corsHeaders });
    }

    const students = await fetchResp.json();
    if (!students || students.length === 0) {
      return new Response(JSON.stringify({
        error: 'STUDENT_NOT_FOUND',
        message: `Siswa dengan ID "${studentId}" tidak ditemukan.`
      }), { status: 404, headers: corsHeaders });
    }

    const currentStudent = students[0];

    // 2. Parse array growth_history (atau inisialisasi sebagai empty array jika null)
    let existingHistory = [];
    if (Array.isArray(currentStudent.growth_history)) {
      existingHistory = [...currentStudent.growth_history];
    } else if (typeof currentStudent.growth_history === 'string') {
      try {
        const parsed = JSON.parse(currentStudent.growth_history);
        if (Array.isArray(parsed)) existingHistory = parsed;
      } catch {
        existingHistory = [];
      }
    }

    // Determine final height & weight for scalar fields
    const finalHeight = numHeight !== null && !isNaN(numHeight) ? numHeight : Number(currentStudent.height || 0);
    const finalWeight = numWeight !== null && !isNaN(numWeight) ? numWeight : Number(currentStudent.weight || 0);

    // Hitung BMI jika tinggi & berat valid
    let bmiVal = null;
    let statusVal = 'Belum Ada';
    if (finalHeight > 0 && finalWeight > 0) {
      const hM = finalHeight / 100;
      bmiVal = Math.round((finalWeight / (hM * hM)) * 10) / 10;
      statusVal = bmiVal < 18.5 ? 'Underweight' : (bmiVal <= 24.9 ? 'Proporsional' : 'Overweight');
    }

    // 3. Buat entri baru growth_history sesuai spesifikasi
    const newGrowthEntry = {
      date: inputDate,
      height_cm: finalHeight,
      weight_kg: finalWeight,
      height: finalHeight,
      weight: finalWeight,
      bmi: bmiVal,
      status: statusVal,
      notes: notes,
      recordedAt: new Date().toISOString()
    };

    const updatedHistory = [...existingHistory, newGrowthEntry];

    // 4. Lakukan UPDATE ke database Supabase (HANYA KOLOM SKALAR height DAN weight)
    const updatePayload = {
      height: finalHeight,
      weight: finalWeight,
      growth_history: updatedHistory,
      updated_at: new Date().toISOString()
    };

    const updateUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}`;
    const updateResp = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text();
      return new Response(JSON.stringify({
        error: 'DB_UPDATE_ERROR',
        message: 'Gagal memperbarui data antropometri siswa.',
        details: errText
      }), { status: 500, headers: corsHeaders });
    }

    const updatedData = await updateResp.json();

    return new Response(JSON.stringify({
      success: true,
      message: 'Data pengukuran fisik siswa dan growth_history berhasil diperbarui secara atomik.',
      data: updatedData && updatedData.length > 0 ? updatedData[0] : updatePayload,
      new_entry: newGrowthEntry
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'SERVER_ERROR',
      message: error.message || 'Terjadi kesalahan server saat memproses data antropometri.'
    }), { status: 500, headers: corsHeaders });
  }
}
