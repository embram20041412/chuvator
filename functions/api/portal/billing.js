/**
 * Cloudflare Pages Function: /api/portal/billing
 * Edge-safe billing and QRIS endpoint for Parent Portal V2 (FASE 5.4).
 * Strict Session V2, Anti-IDOR, CSRF verification & Supabase RPC portal_get_student_dashboard integration.
 */

import { validatePortalV2Session, verifyCsrf, getCorsHeaders } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  // 1. Tangani Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // 2. Strict CSRF Verification for POST
    if (request.method === 'POST') {
      const csrfHeader = request.headers.get('X-Portal-CSRF');
      if (!verifyCsrf(request, env, csrfHeader)) {
        return new Response(
          JSON.stringify({ success: false, error: 'CSRF token atau origin tidak valid' }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // 3. Strict Parent Portal V2 Session Validation
    const sessionResult = await validatePortalV2Session(context);

    if (
      !sessionResult ||
      !sessionResult.valid ||
      !sessionResult.session ||
      !sessionResult.session.accessToken
    ) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;
    const { accessToken } = session;
    const childrenSummary = Array.isArray(session.childrenSummary) ? session.childrenSummary : [];
    const accessibleTenants = Array.isArray(session.accessibleTenants) ? session.accessibleTenants : [];

    // Parse Body / SearchParams for requested student & tenant
    let rawStudentId = '';
    let rawTenantId = '';

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      rawStudentId = body.studentId || body.student_id || '';
      rawTenantId = body.tenantId || body.tenant_id || '';
    } else {
      const url = new URL(request.url);
      rawStudentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || '';
      rawTenantId = url.searchParams.get('tenantId') || url.searchParams.get('tenant_id') || '';
    }

    // Default to first child if not specified
    const firstChild = childrenSummary[0] || {};
    const studentId = (rawStudentId || firstChild.studentId || firstChild.id || '').toLowerCase();

    // 4. Anti-IDOR: Verify student belongs to authenticated parent
    const matchingChildren = childrenSummary.filter(
      c => String(c.studentId || c.id || '').toLowerCase() === studentId
    );

    if (matchingChildren.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses terhadap data siswa ini ditolak' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const matchedChild = matchingChildren[0];
    const childTenantId = matchedChild.tenantId || matchedChild.tenant_id || rawTenantId || firstChild.tenantId || '';

    // 5. Tenant Isolation Validation
    if (!childTenantId || !accessibleTenants.includes(childTenantId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses lintas tenant tidak diizinkan' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Call Supabase RPC portal_get_student_dashboard with Validated Access Token
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    let rpcData = null;
    try {
      const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/portal_get_student_dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          p_student_id: studentId,
          p_tenant_id: childTenantId
        })
      });

      if (rpcResp.ok) {
        rpcData = await rpcResp.json().catch(() => null);
      } else {
        const errText = await rpcResp.text().catch(() => '');
        console.warn(`[billing.js] RPC portal_get_student_dashboard HTTP ${rpcResp.status}: ${errText}`);
      }
    } catch (rpcErr) {
        console.warn('[billing.js] RPC fetch exception:', rpcErr.message);
    }

    const tenant = rpcData?.tenant || {};
    const rpcStudent = rpcData?.student || {};
    const sppPayments = Array.isArray(rpcData?.spp_payments) ? rpcData.spp_payments : [];

    // QRIS Image URL or Base64 Fallback with proper MIME formatting
    let qrisUrl = tenant.qris_url || null;
    let qrisBase64 = tenant.qris_image_base64 || null;

    if (qrisBase64 && !qrisBase64.startsWith('data:image/')) {
      qrisBase64 = `data:image/png;base64,${qrisBase64}`;
    }

    if (!qrisUrl && qrisBase64) {
      qrisUrl = qrisBase64;
    } else if (qrisUrl && qrisUrl.startsWith('data:image/')) {
      qrisBase64 = qrisUrl;
    }

    // Parse Bank Accounts (Support JSONB array with accountName, accountNumber, bankName + Single Column Fallbacks)
    let bankAccounts = [];
    const rawBankAccounts = tenant.bank_accounts;

    if (Array.isArray(rawBankAccounts) && rawBankAccounts.length > 0) {
      bankAccounts = rawBankAccounts.map(b => ({
        bankName: b.bankName || b.bank_name || b.bank || 'Bank',
        accountNumber: String(b.accountNumber || b.bank_account_number || b.noRekening || ''),
        accountName: b.accountName || b.bank_account_name || b.atasNama || tenant.name || 'Akademi'
      }));
    } else if (tenant.bank_name || tenant.bank_account_number) {
      bankAccounts.push({
        bankName: tenant.bank_name || 'Bank',
        accountNumber: String(tenant.bank_account_number || ''),
        accountName: tenant.bank_account_name || tenant.name || 'Akademi'
      });
    }

    const tenantInfo = {
      id: tenant.id || childTenantId,
      tenant_id: tenant.tenant_id || childTenantId,
      name: tenant.name || rpcStudent.tenant_name || 'Sport Arena',
      qris_url: qrisUrl,
      qrisUrl: qrisUrl,
      qris_image_base64: qrisBase64,
      bank_accounts: bankAccounts,
      bankAccounts
    };

    const monthlyFee = Number(rpcStudent.monthly_fee || rpcStudent.spp_monthly_fee || matchedChild.monthlyFee || 0);
    const latestPayment = sppPayments[0];

    const isPaid = latestPayment
      ? (
          latestPayment.is_paid === true ||
          String(latestPayment.status || '').trim().toUpperCase() === 'LUNAS'
        )
      : false;
    const totalAmount = isPaid ? 0 : monthlyFee;
    const statusText = isPaid ? 'LUNAS' : (monthlyFee > 0 ? 'BELUM LUNAS' : 'BEBAS BIAYA');

    const details = [];
    if (totalAmount > 0) {
      details.push({
        id: 'bill-spp-01',
        name: `Tagihan Iuran SPP (${statusText})`,
        amount: totalAmount
      });
    }

    const primaryBank = bankAccounts[0] || {
      bankName: 'Transfer Bank',
      accountNumber: '',
      accountName: tenantInfo.name
    };

    const finalResponse = {
      success: true,
      message: 'Data penagihan berhasil dimuat',
      tenant: tenantInfo,
      bankDetails: {
        bank: primaryBank.bankName,
        number: primaryBank.accountNumber,
        name: primaryBank.accountName
      },
      bankAccounts,
      billing: {
        totalAmount,
        details,
        monthlyFee,
        isPaidThisMonth: isPaid,
        statusText
      },
      students: rpcStudent.id ? [rpcStudent] : [matchedChild],
      paymentHistory: sppPayments
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[billing.js] Unhandled exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan internal pada server' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
