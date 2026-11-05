/**
 * Cloudflare Pages Function: /api/portal/announcements (REFACTORED V2 - SUPABASE)
 * Edge-safe announcements endpoint for Portal Wali Murid.
 * Enforces V2 session authentication, CSRF validation, and tenant-based filtering.
 * 
 * ACTIVE DATABASE: Supabase/PostgreSQL
 * REMOVED: Firestore REST API logic.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session,
  getCleanSupabaseUrl,
  getSupabaseAnonKey
} from './_auth_v2.js';

// OPTIONS CORS Preflight handler
export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/portal/announcements
 */
export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Session Validation via Parent Portal V2 Auth
    const sessionResult = await validatePortalV2Session(context);
    if (!sessionResult.valid || !sessionResult.session) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;
    const supabaseUrl = getCleanSupabaseUrl(env);
    const anonKey = getSupabaseAnonKey(env);

    // 2. Strict CSRF Validation
    if (!verifyCsrf(request, env, session.csrfToken)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Permintaan ditolak. CSRF check gagal.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Request Body Tenant Authorization Check
    const body = await request.json().catch(() => ({}));
    const reqTenantId = String(body.tenantId || '').trim();

    if (!reqTenantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'tenantId wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify reqTenantId is in authorized tenants from session
    const isAuthorized = (session.childrenSummary || []).some(
      c => String(c.tenantId || '').trim().toLowerCase() === reqTenantId.toLowerCase()
    );

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk tenant ini.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Fetch Announcements from Supabase
    // Filter by tenant_id and status='published'
    const annUrl = `${supabaseUrl}/rest/v1/announcements?tenant_id=eq.${reqTenantId}&status=eq.published&order=publish_date.desc&limit=20`;
    const annResp = await fetch(annUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!annResp.ok) {
      const errText = await annResp.text().catch(() => 'Unknown error');
      console.error(`[Announcements] Supabase query failed: ${errText}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Gagal memuat pengumuman dari database.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    const rawAnnouncements = await annResp.json();
    const announcements = rawAnnouncements.map(ann => ({
      id: ann.id,
      title: ann.title || 'Pengumuman Akademi',
      content: ann.content || '',
      category: ann.category || 'Umum',
      date: ann.publish_date || ann.created_at || '',
      isImportant: !!ann.is_important,
      author: ann.author || 'Pengelola Akademi'
    }));

    return new Response(
      JSON.stringify({
        success: true,
        announcements,
        total: announcements.length
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Portal Announcements API Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal saat memuat pengumuman.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
