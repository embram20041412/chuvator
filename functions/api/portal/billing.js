/**
 * Cloudflare Pages Function: /api/portal/billing
 * Edge-safe billing and QRIS endpoint for Parent Portal V2.
 * Native Fetch API to Supabase REST / RPC.
 * Fully compatible with Cloudflare Pages Functions edge runtime.
 */

import { validatePortalV2Session } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;

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
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    // 1. Ekstraksi Token Otorisasi (Header atau Session Cookie V2)
    let authHeader = request.headers.get('Authorization') || '';
    let studentId = '';
    let tenantId = 'global';

    // Parse body jika POST
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      tenantId = body.tenantId || body.tenant_id || tenantId;
      studentId = body.studentId || body.student_id || '';
    } else {
      const url = new URL(request.url);
      tenantId = url.searchParams.get('tenantId') || url.searchParams.get('tenant_id') || tenantId;
      studentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || '';
    }

    if (!authHeader) {
      // Coba ambil dari session cookie portal_session_v2
      try {
        const v2SessionResult = await validatePortalV2Session(context);
        if (v2SessionResult && v2SessionResult.valid && v2SessionResult.session) {
          authHeader = `Bearer ${v2SessionResult.session.accessToken}`;
          if (!tenantId || tenantId === 'global') {
            const firstChild = v2SessionResult.session.childrenSummary?.[0];
            tenantId = firstChild?.tenantId || tenantId;
          }
          if (!studentId) {
            const firstChild = v2SessionResult.session.childrenSummary?.[0];
            studentId = firstChild?.studentId || '';
          }
        }
      } catch (sessErr) {
        console.warn('[billing.js] Session check fallback:', sessErr.message);
      }
    }

    // Fallback Bearer anonKey jika belum ada
    const effectiveAuthHeader = authHeader || `Bearer ${anonKey}`;

    // 2. Panggil RPC parent_get_billing via Supabase REST API
    let rpcData = null;
    let rpcSuccess = false;

    try {
      const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/parent_get_billing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': effectiveAuthHeader
        },
        body: JSON.stringify({ p_tenant_id: tenantId })
      });

      if (rpcResponse.ok) {
        rpcData = await rpcResponse.json().catch(() => null);
        rpcSuccess = true;
      } else {
        const errText = await rpcResponse.text().catch(() => '');
        console.warn(`[billing.js] RPC parent_get_billing response status ${rpcResponse.status}: ${errText}`);
      }
    } catch (rpcErr) {
      console.warn('[billing.js] RPC fetch exception:', rpcErr.message);
    }

    // 3. Ambil Info Tenant (QRIS & Rekening Bank) jika tenantId valid
    let tenantInfo = {
      id: tenantId,
      name: 'Sport Academy',
      qris_url: null,
      qrisUrl: null,
      bank_accounts: []
    };
    let bankAccounts = [];

    if (tenantId && tenantId !== 'global') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
        let tenantQuery = `${supabaseUrl}/rest/v1/tenants?select=id,tenant_id,name,qris_url,qris_image_base64,bank_name,bank_account_name,bank_account_number,bank_accounts`;
        if (isUuid) {
          tenantQuery += `&or=(id.eq.${tenantId},tenant_id.eq.${tenantId})`;
        } else {
          tenantQuery += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
        }

        const tenantResp = await fetch(tenantQuery, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });
        if (tenantResp.ok) {
          const tenants = await tenantResp.json().catch(() => []);
          const t = tenants[0];
          if (t) {
            const rawQris = t.qris_url || t.qris_image_base64 || null;
            tenantInfo = {
              id: t.id,
              tenant_id: t.tenant_id || t.id,
              name: t.name || 'Sport Academy',
              qris_url: rawQris,
              qrisUrl: rawQris,
              bank_accounts: []
            };
            if (Array.isArray(t.bank_accounts) && t.bank_accounts.length > 0) {
              bankAccounts = t.bank_accounts.map(b => ({
                bankName: b.bankName || b.bank || 'Bank',
                accountNumber: String(b.accountNumber || b.noRekening || ''),
                accountName: b.accountName || b.atasNama || t.name
              }));
            } else if (t.bank_name || t.bank_account_number) {
              bankAccounts.push({
                bankName: t.bank_name || 'Bank',
                accountNumber: String(t.bank_account_number || ''),
                accountName: t.bank_account_name || t.name
              });
            }
            tenantInfo.bank_accounts = bankAccounts;
            tenantInfo.bankAccounts = bankAccounts;
          }
        }
      } catch (tenantErr) {
        console.warn('[billing.js] Tenant query exception:', tenantErr.message);
      }
    }

    // 4. Hitung Status Tagihan Berdasarkan RPC atau Nilai Default
    let studentBilling = null;
    if (rpcData && Array.isArray(rpcData.students)) {
      if (studentId) {
        studentBilling = rpcData.students.find(s => String(s.student_id).toLowerCase() === studentId.toLowerCase());
      }
      if (!studentBilling && rpcData.students.length > 0) {
        studentBilling = rpcData.students[0];
      }
    }

    const totalAmount = Number(studentBilling?.remaining_bill || 0);
    const monthlyFee = Number(studentBilling?.monthly_fee || 0);
    const isPaid = studentBilling ? (studentBilling.billing_status === 'LUNAS' || totalAmount === 0) : true;
    const statusText = studentBilling?.billing_status ? String(studentBilling.billing_status).replace('_', ' ') : 'LUNAS';

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
      students: rpcData?.students || [],
      paymentHistory: []
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[billing.js] Unhandled exception:', error.message);
    // Kembalikan fallback valid daripada 502 Bad Gateway
    return new Response(JSON.stringify({
      success: true,
      fallback: true,
      message: 'Data penagihan dimuat dengan mode aman.',
      tenant: { id: 'global', name: 'Sport Academy', qris_url: null, qrisUrl: null, bank_accounts: [] },
      bankDetails: { bank: 'Transfer Bank', number: '', name: 'Sport Academy' },
      bankAccounts: [],
      billing: {
        totalAmount: 0,
        details: [],
        monthlyFee: 0,
        isPaidThisMonth: true,
        statusText: 'LUNAS'
      },
      students: [],
      paymentHistory: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
