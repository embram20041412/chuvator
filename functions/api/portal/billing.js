/**
 * Cloudflare Pages Function: /api/portal/billing
 * Edge-safe billing and QRIS endpoint for Portal Wali Murid using Firebase Firestore REST API.
 */

// Helper to convert PEM private key to ArrayBuffer for Web Crypto API
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/[\r\n\s]+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Base64URL string encoder
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ArrayBuffer to Base64URL encoder
function bufferToBase64Url(buf) {
  const binStr = String.fromCharCode(...new Uint8Array(buf));
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate Google OAuth2 Access Token using RS256 Web Crypto in Edge runtime
 */
async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  if (!clientEmail || !privateKeyPem) return null;

  try {
    const cleanPem = privateKeyPem.replace(/\\n/g, '\n').trim();
    const keyBuffer = pemToArrayBuffer(cleanPem);

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' }
      },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      scope: 'https://www.googleapis.com/auth/datastore'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedToken = `${encodedHeader}.${encodedClaims}`;

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    const signedJwt = `${unsignedToken}.${bufferToBase64Url(signature)}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google OAuth token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (err) {
    throw new Error(`Auth Error: ${err.message}`);
  }
}

/**
 * Unwraps Firestore typed values into standard JS primitives/objects
 */
function parseFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    return parseFirestoreFields(val.mapValue.fields);
  }
  return Object.values(val)[0];
}

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

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
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * POST /api/portal/billing
 * Accepts { studentId, tenantId }
 */
export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const { request, env = {} } = context;

    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const body = await request.json().catch(() => ({}));
    let { studentId, tenantId } = body;

    if (!studentId && !tenantId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Parameter studentId atau tenantId diperlukan.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Dapatkan Access Token Service Account
    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.warn('Google Auth token error:', tokenErr.message);
    }

    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (accessToken) {
      reqHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    let studentData = null;

    // 2. Baca dokumen student untuk mendapatkan data riil biaya dan status
    if (studentId) {
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
        console.warn('Gagal membaca data siswa:', err);
      }
    }

    // 3. Ambil data tenant untuk mendapatkan QRIS dan seluruh Info Rekening Bank
    let bankAccounts = [];
    let bankDetails = {
      bank: '',
      number: '',
      name: ''
    };

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
        console.warn('Gagal mengambil data tenant:', err);
      }
    }

    // Fallback: Jika data bank masih kosong atau tenantId belum terhubung, cek koleksi tenants
    if (bankAccounts.length === 0 && !tenantInfo.qrisUrl) {
      try {
        const tenantListUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/tenants?pageSize=5`;
        const listResp = await fetch(tenantListUrl, { method: 'GET', headers: reqHeaders });
        if (listResp.ok) {
          const listData = await listResp.json();
          const docs = listData.documents || [];
          if (docs.length > 0) {
            let selectedDoc = docs[0];
            if (tenantId) {
              const matched = docs.find(d => (d.name || '').endsWith(`/${tenantId}`));
              if (matched) selectedDoc = matched;
            }
            const tFields = parseFirestoreFields(selectedDoc.fields);
            bankAccounts = extractAllBankAccounts(tFields);
            const primaryBank = bankAccounts[0] || { bankName: '', accountNumber: '', accountName: '' };

            bankDetails = {
              bank: primaryBank.bankName,
              number: primaryBank.accountNumber,
              name: primaryBank.accountName
            };

            const tDocId = (selectedDoc.name || '').split('/').pop();
            tenantInfo = {
              id: tDocId || tenantId,
              name: tFields.name || tFields.arenaName || tenantInfo.name,
              qrisUrl: tFields.qrisUrl || tFields.qrisImageUrl || tFields.qrisImageBase64 || tenantInfo.qrisUrl,
              bankName: primaryBank.bankName,
              bankAccount: primaryBank.accountNumber,
              bankAccountNumber: primaryBank.accountNumber,
              accountHolder: primaryBank.accountName,
              bankAccountName: primaryBank.accountName,
              bankDetails,
              bankAccounts
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('Fallback koleksi tenants gagal:', fallbackErr);
      }
    }

    // 4. Kueri tagihan riil siswa & koleksi spp_payments
    const details = [];
    let totalAmount = 0;
    let paymentHistory = [];

    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth(); // 0-11
    const currentMonth = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
    const currentMonthLabel = `${monthNamesIndo[currentMonthIdx]} ${currentYear}`;

    if (studentId) {
      // A. Kueri semua dokumen spp_payments milik studentId
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

            // Jika berstatus belum lunas / pending / unpaid
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
              // Masuk ke paymentHistory jika berstatus lunas
              paymentHistory.push({ id, ...f });
            }
          }
        }
      } catch (err) {
        console.warn('Gagal membaca spp_payments:', err);
      }

      // B. Kueri koleksi transactions untuk paymentHistory tambahan jika ada
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
        console.warn('Gagal membaca transactions:', err);
      }

      // C. Jika belum ada tagihan pending dari dokumen spp_payments, hitung tagihan riil dari data siswa
      if (details.length === 0 && studentData) {
        // 1) Tagihan Pendaftaran
        const isRegPaid = Boolean(studentData.registrationFeePaid || studentData.isRegistrationFeePaid);
        const regAmount = Number(studentData.registrationFee || studentData.entryFee || 0);
        if (!isRegPaid && regAmount > 0) {
          details.push({
            name: 'Biaya Pendaftaran / Registrasi',
            amount: regAmount
          });
          totalAmount += regAmount;
        }

        // 2) Tagihan SPP Bulan Berjalan
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
    }

    // Status: Lunas bulan ini jika tidak ada tagihan tertunggak (totalAmount === 0)
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
    console.error('Portal Billing API Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Terjadi kesalahan internal',
        details: error.stack || error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
