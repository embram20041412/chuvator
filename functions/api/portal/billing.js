/**
 * Cloudflare Pages Function: /api/portal/billing (REFACTORED V2 - SUPABASE)
 * Edge-safe billing and QRIS endpoint for Portal Wali Murid.
 * Enforces V2 session authentication, CSRF validation, and server-side child authorization.
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

/**
 * Normalizes bank account array from Supabase tenant columns.
 */
function normalizeBankAccounts(tenant) {
  const accounts = [];
  const rawList = Array.isArray(tenant.bank_accounts) ? tenant.bank_accounts : [];

  for (const item of rawList) {
    if (!item) continue;
    const bankName = (item.bankName || item.bank || item.namaBank || '').trim();
    const accountNumber = String(item.accountNumber || item.bankAccountNumber || item.bankAccount || item.noRekening || item.nomorRekening || '').trim();
    const accountName = (item.accountName || item.bankAccountName || item.accountHolder || item.atasNama || tenant.name || '').trim();

    if (bankName || accountNumber) {
      accounts.push({ bankName: bankName || 'Bank', accountNumber, accountName });
    }
  }

  // Fallback to primary columns if JSONB is empty
  if (accounts.length === 0) {
    const sBank = (tenant.bank_name || '').trim();
    const sNum = String(tenant.bank_account_number || '').trim();
    const sHolder = (tenant.bank_account_name || tenant.name || '').trim();

    if (sBank || sNum) {
      accounts.push({ bankName: sBank || 'Bank', accountNumber: sNum, accountName: sHolder });
    }
  }

  return accounts;
}

// OPTIONS CORS Preflight handler
export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/portal/billing
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

    // 3. Multi-Child Request Body & Student Authorization Check
    const body = await request.json().catch(() => ({}));
    const requestedStudentId = String(body.studentId || '').trim();

    if (!requestedStudentId) {
      return new Response(
        JSON.stringify({ success: false, message: 'studentId wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const authorizedChild = (session.childrenSummary || []).find(
      c => String(c.studentId || c.id || '').trim().toLowerCase() === requestedStudentId.toLowerCase()
    );

    if (!authorizedChild) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk anak ini.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const verifiedStudentId = String(authorizedChild.studentId || authorizedChild.id).trim();
    const verifiedTenantId = String(authorizedChild.tenantId || '').trim();

    // 4. Call Supabase RPC parent_get_billing
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/parent_get_billing`;
    const rpcResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ p_tenant_id: verifiedTenantId })
    });

    if (!rpcResp.ok) {
      const errText = await rpcResp.text().catch(() => 'Unknown error');
      console.error(`[Billing] RPC parent_get_billing failed: ${errText}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Gagal memuat data tagihan dari Core.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    const billingResult = await rpcResp.json();
    const studentBilling = (billingResult.students || []).find(
      s => String(s.student_id).toLowerCase() === verifiedStudentId.toLowerCase()
    );

    if (!studentBilling) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data tagihan anak tidak ditemukan.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 5. Fetch Tenant info (QRIS & Bank)
    const tenantUrl = `${supabaseUrl}/rest/v1/tenants?id=eq.${verifiedTenantId}&select=*`;
    const tenantResp = await fetch(tenantUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });

    let tenantData = null;
    if (tenantResp.ok) {
      const tenants = await tenantResp.json();
      tenantData = tenants[0] || null;
    }

    const bankAccounts = tenantData ? normalizeBankAccounts(tenantData) : [];
    const primaryBank = bankAccounts[0] || { bankName: '', accountNumber: '', accountName: '' };

    // 6. Fetch Payment History (Lunas)
    const historyUrl = `${supabaseUrl}/rest/v1/spp_payments?student_id=eq.${verifiedStudentId}&tenant_id=eq.${verifiedTenantId}&status=eq.Lunas&order=payment_date.desc&limit=10`;
    const historyResp = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });

    const rawHistory = historyResp.ok ? await historyResp.json() : [];
    const paymentHistory = rawHistory.map(h => ({
      id: h.id,
      month: h.month || h.paid_month || '',
      amount: Number(h.amount || 0),
      paymentDate: h.payment_date || h.created_at || '',
      paymentMethod: h.payment_method || 'Transfer Bank / QRIS',
      status: 'Lunas',
      description: h.notes || `Pembayaran SPP ${h.month || ''}`
    }));

    // 7. Map to Frontend format
    const totalAmount = Number(studentBilling.remaining_bill || 0);
    const isPaidThisMonth = studentBilling.billing_status === 'LUNAS' || totalAmount === 0;

    const details = [];
    if (totalAmount > 0) {
      details.push({
        id: 'bill-01',
        name: studentBilling.billing_status === 'BELUM_LUNAS' ? 'Tagihan SPP (Belum Lunas)' : 'Tagihan SPP (Parsial)',
        amount: totalAmount
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data penagihan berhasil dimuat',
        tenant: {
          id: verifiedTenantId,
          name: tenantData?.name || '',
          qrisUrl: tenantData?.qris_url || null
        },
        bankDetails: {
          bank: primaryBank.bankName,
          number: primaryBank.accountNumber,
          name: primaryBank.accountName
        },
        bankAccounts,
        billing: {
          totalAmount,
          details,
          monthlyFee: Number(studentBilling.monthly_fee || 0),
          isPaidThisMonth,
          statusText: studentBilling.billing_status.replace('_', ' ')
        },
        paymentHistory
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Portal Billing API Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal saat memuat data penagihan.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
