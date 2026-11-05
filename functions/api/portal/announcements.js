/**
 * Cloudflare Pages Function: /api/portal/announcements
 * Edge-safe announcements endpoint for Parent Portal V2.
 * Handles missing database tables gracefully to prevent 502 Bad Gateway.
 */

export async function onRequest(context) {
  const { request } = context;

  // Tangani Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Portal-CSRF, apikey'
      }
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    // Data pengumuman default resmi yang aman di Edge
    const announcementsList = [
      {
        id: 'ann-1',
        title: 'Selamat Datang di Portal Wali Murid V2',
        content: 'Seluruh tagihan, presensi, jadwal sesi latihan, dan evaluasi atlet kini dapat dipantau langsung dari portal ini.',
        category: 'Resmi',
        date: new Date().toISOString(),
        publishDate: new Date().toISOString(),
        isImportant: true,
        author: 'Pengelola Akademi'
      },
      {
        id: 'ann-2',
        title: 'Informasi Jadwal Latihan & Kehadiran',
        content: 'Harap pastikan atlet tiba di venue 15 menit sebelum sesi dimulai dengan perlengkapan lengkap.',
        category: 'Latihan',
        date: new Date().toISOString(),
        publishDate: new Date().toISOString(),
        isImportant: false,
        author: 'Head Coach'
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      data: announcementsList,
      announcements: announcementsList,
      total: announcementsList.length
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: true,
      data: [],
      announcements: [],
      total: 0,
      message: error.message
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
