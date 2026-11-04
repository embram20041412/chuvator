/**
 * Cloudflare Pages Function: /api/portal/billing (STAGE 7G.2A.3)
 * Edge-safe billing and QRIS endpoint for Portal Wali Murid using Firebase Firestore REST API.
 * Enforces session authentication, CSRF validation, strict tenant/student isolation, and fail-closed credentials.
 */

import {
  getGoogleAccessToken,
  parseFirestoreFields,
  getCorsHeaders,
  verifyCsrf,
  validatePortalSession
} from './_auth.js';

/**
 * Normalizes all bank accounts from tenant fields into a clean array:
 * [{ bankName, accountNumber, accountName }]
 */
function extractAllBankAccounts(tFields) {
  if (!tFields || typeof tFields !== 'object') return [];
  const accounts = [];
  const rawList = Array.isArray(tFields.bankAccounts)
    ? tFields.bankAccounts
    : (Array.isArray(tFields.accounts) ? tFields.accounts : []);

  for (const item of rawList) {
    if (!item) continue;
    const bankName = (item.bankName || item.bank || item.namaBank || '').trim();
    const accountNumber = String(item.accountNumber || item.bankAccountNumber || item.bankAccount || item.noRekening || item.nomorRekening || '').trim();
    const accountName = (item.accountName || item.bankAccountName || item.accountHolder || item.atasNama || tFields.name || '').trim();

    if (bankName || accountNumber) {
      accounts.push({
        bankName: bankName || 'Bank',
        accountNumber,
        accountName
      });
    }
  }

  // Fallback ke field individual jika array kosong
  if (accounts.length === 0) {
    const sBank = (tFields.bankName || tFields.bank || '').trim();
    const sNum = String(tFields.bankAccountNumber || tFields.bankAccount || tFields.noRekening || tFields.accountNumber || '').trim();
    const sHolder = (tFields.bankAccountName || tFields.bankAccountHolder || tFields.accountHolder || tFields.atasNama || tFields.name || '').trim();

    if (sBank || sNum) {
      accounts.push({
        bankName: sBank || 'Bank',
        accountNumber: sNum,
        accountName: sHolder
      });
    }
  }

  return accounts;
}

// OPTIONS CORS Preflight handler
export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * POST /api/portal/billing
 */
export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Session Validation
    const sessionResult = await validatePortalSession(context);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;

    // 2. Strict CSRF & Origin Validation
    if (!verifyCsrf(request, env, session.csrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF check gagal.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Request Body Student & Tenant Authorization Check
    const body = await request.json().catch(() => ({}));
    if (body.studentId && String(body.studentId).trim().toLowerCase() !== session.studentId.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk data siswa ini.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    const studentId = session.studentId;
    let tenantId = session.tenantId;

    // 4. Validate Service Account Credentials
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Firebase Service Account environment variables missing in billing.js');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kesalahan konfigurasi server database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.error('Google Auth token error in billing.js:', tokenErr.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal melakukan autentikasi koneksi database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Access token database tidak dapat diperoleh.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    let studentData = null;

    // 5. Fetch student document for billing details & tenant binding
    try {
      const studentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(String(studentId).trim())}`;
      const studentResp = await fetch(studentUrl, { method: 'GET', headers: reqHeaders });
      if (studentResp.ok) {
        const studentDoc = await studentResp.json();
        studentData = parseFirestoreFields(studentDoc.fields);
        if (!tenantId && studentData.tenantId) {
          tenantId = studentData.tenantId;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca data siswa di billing.js:', err.message);
    }

    // 6. Fetch tenant details for QRIS & Bank accounts
    let bankAccounts = [];
    let bankDetails = { bank: '', number: '', name: '' };
    let tenantInfo = {
      id: tenantId || '',
      name: '',
      qrisUrl: null,
      bankName: '',
      bankAccount: '',
      bankAccountNumber: '',
      accountHolder: '',
      bankAccountName: '',
      bankAccounts: []
    };

    if (tenantId) {
      try {
        const tenantUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/tenants/${encodeURIComponent(String(tenantId).trim())}`;
        const tenantResp = await fetch(tenantUrl, { method: 'GET', headers: reqHeaders });
        if (tenantResp.ok) {
          const tenantDoc = await tenantResp.json();
          const tFields = parseFirestoreFields(tenantDoc.fields);

          bankAccounts = extractAllBankAccounts(tFields);
          const primaryBank = bankAccounts[0] || { bankName: '', accountNumber: '', accountName: '' };

          bankDetails = {
            bank: primaryBank.bankName,
            number: primaryBank.accountNumber,
            name: primaryBank.accountName
          };

          tenantInfo = {
            id: tenantId,
            name: tFields.name || tFields.arenaName || '',
            qrisUrl: tFields.qrisUrl || tFields.qrisImageUrl || tFields.qrisImageBase64 || null,
            bankName: primaryBank.bankName,
            bankAccount: primaryBank.accountNumber,
            bankAccountNumber: primaryBank.accountNumber,
            accountHolder: primaryBank.accountName,
            bankAccountName: primaryBank.accountName,
            bankDetails,
            bankAccounts
          };
        }
      } catch (err) {
        console.warn('Gagal mengambil data tenant di billing.js:', err.message);
      }
    }

    // 7. Query SPP payments & transactions for authenticated student
    const details = [];
    let totalAmount = 0;
    const paymentHistory = [];

    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentMonth = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
    const currentMonthLabel = `${monthNamesIndo[currentMonthIdx]} ${currentYear}`;

    // A. Query spp_payments for authenticated studentId
    try {
      const sppQueryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'spp_payments' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'studentId' },
              op: 'EQUAL',
              value: { stringValue: String(studentId).trim() }
            }
          },
          limit: 20
        }
      };

      const sppQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
      const sppResp = await fetch(sppQueryUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(sppQueryPayload)
      });

      if (sppResp.ok) {
        const sppResults = await sppResp.json();
        const docs = (Array.isArray(sppResults) ? sppResults : []).filter((item) => item.document);

        for (const d of docs) {
          const id = (d.document.name || '').split('/').pop();
          const f = parseFirestoreFields(d.document.fields);
          const status = String(f.status || '').toLowerCase();
          const itemAmount = Number(f.amount || f.totalAmount || f.nominal || 0);

          if (
            status.includes('pending') ||
            status.includes('belum') ||
            status.includes('unpaid') ||
            status.includes('menunggak')
          ) {
            if (itemAmount > 0) {
              details.push({
                id,
                name: f.itemName || f.description || `Tagihan SPP ${f.month || ''}`,
                amount: itemAmount
              });
              totalAmount += itemAmount;
            }
          } else {
            paymentHistory.push({ id, ...f });
          }
        }
      }
    } catch (err) {
      console.warn('Gagal membaca spp_payments:', err.message);
    }

    // B. Query transactions for authenticated studentId
    try {
      const txQueryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'transactions' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'studentId' },
              op: 'EQUAL',
              value: { stringValue: String(studentId).trim() }
            }
          },
          limit: 10
        }
      };

      const txQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
      const txResp = await fetch(txQueryUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(txQueryPayload)
      });

      if (txResp.ok) {
        const txResults = await txResp.json();
        const docs = (Array.isArray(txResults) ? txResults : []).filter((item) => item.document);
        for (const d of docs) {
          const id = (d.document.name || '').split('/').pop();
          const f = parseFirestoreFields(d.document.fields);
          paymentHistory.push({ id, ...f });
        }
      }
    } catch (err) {
      console.warn('Gagal membaca transactions:', err.message);
    }

    // C. Calculate unpaid fees from student document if no pending SPP documents exist
    if (details.length === 0 && studentData) {
      const isRegPaid = Boolean(studentData.registrationFeePaid || studentData.isRegistrationFeePaid);
      const regAmount = Number(studentData.registrationFee || studentData.entryFee || 0);
      if (!isRegPaid && regAmount > 0) {
        details.push({
          name: 'Biaya Pendaftaran / Registrasi',
          amount: regAmount
        });
        totalAmount += regAmount;
      }

      const lastPaid = studentData.lastPaidMonth || '';
      const sppAmount = Number(studentData.monthlyFee || 0);
      if (lastPaid !== currentMonth && sppAmount > 0) {
        details.push({
          name: `Iuran SPP ${currentMonthLabel}`,
          amount: sppAmount
        });
        totalAmount += sppAmount;
      }
    }

    const isPaidThisMonth = totalAmount === 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data penagihan riil berhasil dimuat',
        tenant: tenantInfo,
        bankDetails,
        bankAccounts,
        billing: {
          totalAmount,
          details,
          monthlyFee: Number(studentData?.monthlyFee || 0),
          currentMonth,
          lastPaidMonth: studentData?.lastPaidMonth || '',
          isPaidThisMonth,
          statusText: isPaidThisMonth ? 'LUNAS BULAN INI' : 'MENUNGGU PEMBAYARAN'
        },
        paymentHistory
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Portal Billing API Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat memuat data penagihan.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

