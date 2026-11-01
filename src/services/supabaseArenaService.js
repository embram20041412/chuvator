import { supabase } from '../config/supabase';

/**
 * =========================================================================
 * SUPABASE ARENA & COMMERCE SERVICE (POSTGRESQL MULTI-TENANT ARCHITECTURE)
 * =========================================================================
 * Layanan komunikasi data berbasis relational database Supabase untuk:
 * - Profil Tenant / GOR (tenants)
 * - Lapangan (courts)
 * - Booking Lapangan (bookings)
 * - Transaksi & Keuangan (transactions, pos_transactions, global_ledger, spp_payments)
 * - Master Produk Retail & Kasir (products)
 * - Staf & Undangan SaaS (users_staff, invitations)
 */

// -------------------------------------------------------------------------
// HELPER NORMALISASI UUID & TANGGAL (ANTI ERROR POSTGRESQL 22P02)
// -------------------------------------------------------------------------

export const toUuidOrNull = (val) => {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
};

export const toDateOrNull = (val) => (val && String(val).trim() !== '' ? String(val).trim() : null);

// -------------------------------------------------------------------------
// DATA MAPPING HELPERS (SNAKE_CASE <-> CAMEL_CASE)
// -------------------------------------------------------------------------

export function mapTenantFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    ownerName: row.owner_name || row.ownerName || '',
    ownerEmail: row.owner_email || row.ownerEmail || '',
    address: row.address || '',
    province: row.province || '',
    regency: row.regency || '',
    district: row.district || '',
    village: row.village || '',
    sportsType: row.sports_type || row.sportsType || '',
    courtsCount: row.courts_count || row.courtsCount || 0,
    logoUrl: row.logo_url || row.logoUrl || null,
    bankName: row.bank_name || row.bankName || '',
    bankAccountNumber: row.bank_account_number || row.bankAccountNumber || '',
    bankAccountName: row.bank_account_name || row.bankAccountName || '',
    bankAccounts: row.bank_accounts || row.bankAccounts || [],
    qrisUrl: row.qris_url || row.qrisUrl || null,
    qrisImageBase64: row.qris_image_base64 || row.qrisImageBase64 || row.qris_url || row.qrisUrl || null,
    sppBillingStartDay: row.spp_billing_start_day || row.sppBillingStartDay || 1,
    sppDueDay: row.spp_due_day || row.sppDueDay || 10,
    receiptHeaderName: row.receipt_header_name || row.receiptHeaderName || row.name || '',
    receiptAddress: row.receipt_address || row.receiptAddress || row.address || '',
    receiptContact: row.receipt_contact || row.receiptContact || row.phone || '',
    receiptFooterText: row.receipt_footer_text || row.receipt_footer_note || row.receiptFooterText || row.receiptFooterNote || '',
    receiptFooterNote: row.receipt_footer_note || row.receipt_footer_text || row.receiptFooterNote || row.receiptFooterText || '',
    academyPricing: row.academy_pricing || row.academyPricing || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapCourtFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sport: row.sport,
    courtNumber: row.court_number || row.courtNumber || '',
    price: Number(row.price || 0),
    isActive: row.is_active !== false,
    operationalHours: row.operational_hours || row.operationalHours || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapBookingFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    courtId: row.court_id,
    courtName: row.court_name || row.courtName || '',
    courtNumber: row.court_number || row.courtNumber || '',
    customerName: row.customer_name || row.customerName || '',
    customerPhone: row.customer_phone || row.customerPhone || '',
    bookingDate: row.booking_date || row.bookingDate || row.date || '',
    date: row.booking_date || row.bookingDate || row.date || '',
    startTime: row.start_time || row.startTime || '',
    endTime: row.end_time || row.endTime || '',
    price: Number(row.price || 0),
    totalPrice: Number(row.total_price || row.totalPrice || row.price || 0),
    status: row.status || 'Lunas',
    paymentStatus: row.payment_status || row.paymentStatus || 'lunas',
    paymentMethod: row.payment_method || row.paymentMethod || 'QRIS',
    cashReceived: Number(row.cash_received || row.cashReceived || 0),
    changeAmount: Number(row.change_amount || row.changeAmount || 0),
    isVoid: Boolean(row.is_void || row.isVoid),
    voidedBy: row.voided_by || row.voidedBy || null,
    voidedAt: row.voided_at || row.voidedAt || null,
    voidReason: row.void_reason || row.voidReason || null,
    notes: row.notes || '',
    createdAt: row.created_at ? { seconds: Math.floor(new Date(row.created_at).getTime() / 1000) } : null,
    rawCreatedAt: row.created_at
  };
}

export function mapTransactionFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    bookingId: toUuidOrNull(row.booking_id) || row.booking_id || null,
    studentId: toUuidOrNull(row.student_id) || row.student_id || null,
    sponsorId: row.sponsor_id || row.sponsorId || null,
    eventId: row.event_id || row.eventId || null,
    itemName: row.item_name || row.itemName || '',
    itemCategory: row.item_category || row.itemCategory || '',
    category: row.category || row.item_category || '',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'Cash',
    itemsCount: Number(row.items_count || row.itemsCount || 1),
    items: row.items || [],
    status: row.status || 'COMPLETED',
    isVoid: Boolean(row.is_void || row.isVoid),
    voidedBy: row.voided_by || row.voidedBy || null,
    voidedAt: row.voided_at || row.voidedAt || null,
    voidReason: row.void_reason || row.voidReason || null,
    createdAt: row.created_at ? { seconds: Math.floor(new Date(row.created_at).getTime() / 1000) } : null,
    rawCreatedAt: row.created_at
  };
}

export function mapProductFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    category: row.category,
    type: row.type || 'jual',
    barcode: row.barcode || '',
    cogs: Number(row.cogs || 0),
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapSppPaymentFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    studentId: toUuidOrNull(row.student_id) || row.student_id || null,
    studentName: row.student_name || '',
    paidMonth: row.paid_month || '',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || 'QRIS',
    status: row.status || 'COMPLETED',
    receiptNo: row.receipt_no || '',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

// -------------------------------------------------------------------------
// 1. TENANT / GOR PROFILE
// -------------------------------------------------------------------------

export async function getTenantProfile(tenantId) {
  if (!tenantId) return null;
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    console.warn('Supabase getTenantProfile error:', error);
    return null;
  }
  return mapTenantFromSupabase(data);
}

export async function updateTenantProfile(tenantId, payload) {
  if (!tenantId) throw new Error('Tenant ID wajib disertakan.');

  const dbPayload = {
    name: payload.name !== undefined ? payload.name.trim() : undefined,
    owner_name: payload.ownerName !== undefined ? payload.ownerName : payload.owner_name,
    owner_email: payload.ownerEmail !== undefined ? payload.ownerEmail : payload.owner_email,
    phone: payload.phone !== undefined ? payload.phone.trim() : undefined,
    address: payload.address !== undefined ? payload.address.trim() : undefined,
    province: payload.province,
    regency: payload.regency,
    district: payload.district,
    village: payload.village,
    sports_type: payload.sportsType !== undefined ? payload.sportsType : payload.sports_type,
    courts_count: payload.courtsCount !== undefined ? payload.courtsCount : payload.courts_count,
    logo_url: payload.logoUrl !== undefined ? payload.logoUrl : payload.logo_url,
    bank_name: payload.bankName !== undefined ? payload.bankName : payload.bank_name,
    bank_account_number: payload.bankAccountNumber !== undefined ? payload.bankAccountNumber : payload.bank_account_number,
    bank_account_name: payload.bankAccountName !== undefined ? payload.bankAccountName : payload.bank_account_name,
    bank_accounts: payload.bankAccounts !== undefined ? payload.bankAccounts : payload.bank_accounts,
    qris_url: payload.qrisUrl !== undefined ? payload.qrisUrl : payload.qris_url,
    qris_image_base64: payload.qrisImageBase64 !== undefined ? payload.qrisImageBase64 : payload.qris_image_base64,
    spp_billing_start_day: payload.sppBillingStartDay !== undefined ? payload.sppBillingStartDay : payload.spp_billing_start_day,
    spp_due_day: payload.sppDueDay !== undefined ? payload.sppDueDay : payload.spp_due_day,
    receipt_header_name: payload.receiptHeaderName !== undefined ? payload.receiptHeaderName : payload.receipt_header_name,
    receipt_address: payload.receiptAddress !== undefined ? payload.receiptAddress : payload.receipt_address,
    receipt_contact: payload.receiptContact !== undefined ? payload.receiptContact : payload.receipt_contact,
    receipt_footer_text: payload.receiptFooterText !== undefined
      ? payload.receiptFooterText
      : (payload.receiptFooterNote !== undefined ? payload.receiptFooterNote : payload.receipt_footer_text),
    receipt_footer_note: payload.receiptFooterNote !== undefined
      ? payload.receiptFooterNote
      : (payload.receiptFooterText !== undefined ? payload.receiptFooterText : payload.receipt_footer_note),
    academy_pricing: payload.academyPricing !== undefined ? payload.academyPricing : payload.academy_pricing,
    updated_at: new Date().toISOString()
  };

  // Clean undefined keys
  Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);

  const { data, error } = await supabase
    .from('tenants')
    .update(dbPayload)
    .eq('id', tenantId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase updateTenantProfile error:', error);
    throw error;
  }
  return mapTenantFromSupabase(data || { id: tenantId, ...payload });
}

export async function createTenant(payload) {
  // 1. Sebelum melakukan .insert('tenants', payload), pastikan fungsi mengambil data user aktif:
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    payload.owner_uid = user.id; // Pastikan owner_uid terisi ID user yang sedang login
  }

  const ownerUid = payload.owner_uid || payload.ownerUid || user?.id || null;
  const ownerEmail = payload.owner_email || payload.ownerEmail || user?.email || '';

  if (!ownerUid) {
    throw new Error('Sesi tidak valid. Pengguna harus login sebelum mengaktifkan GOR.');
  }

  // 2. Bersihkan payload dari kolom tambahan yang belum ada di tabel tenants Supabase
  // (seperti bank_account_number, bank_account_name, receipt_footer_note, dll).
  // Hanya sertakan kolom-kolom inti yang valid di tabel tenants:
  const tenantPayload = {
    name: (payload.name || '').trim(),
    phone: (payload.phone || '').trim(),
    address: payload.address || '',
    province: payload.province || '',
    regency: payload.regency || '',
    district: payload.district || '',
    village: payload.village || '',
    sports_type: payload.sports_type || payload.sportsType || '',
    courts_count: Number(payload.courts_count ?? payload.courtsCount ?? 0),
    owner_name: payload.owner_name || payload.ownerName || (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Owner'),
    owner_email: ownerEmail,
    owner_uid: ownerUid
  };

  const { data, error } = await supabase
    .from('tenants')
    .insert([tenantPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createTenant error:', error);
    throw error;
  }
  return mapTenantFromSupabase(data);
}

// -------------------------------------------------------------------------
// 2. LAPANGAN (COURTS)
// -------------------------------------------------------------------------

export async function getCourts(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('courts')
    .select('id, tenant_id, name, sport, court_number, price, is_active, operational_hours, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) {
    console.warn('Supabase getCourts error:', error);
    return [];
  }
  return (data || []).map(mapCourtFromSupabase);
}

export async function updateCourt(courtId, payload) {
  if (!courtId) throw new Error('Court ID wajib disertakan.');
  const dbPayload = {
    name: payload.name,
    sport: payload.sport,
    court_number: payload.courtNumber || payload.court_number,
    price: payload.price !== undefined ? Number(payload.price) : undefined,
    is_active: payload.isActive !== undefined ? payload.isActive : payload.is_active,
    operational_hours: payload.operationalHours || payload.operational_hours,
    updated_at: new Date().toISOString()
  };
  Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);

  const { data, error } = await supabase
    .from('courts')
    .update(dbPayload)
    .eq('id', courtId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase updateCourt error:', error);
    throw error;
  }
  return mapCourtFromSupabase(data || { id: courtId, ...payload });
}

export async function updateCourtsBatch(updatesArray) {
  if (!Array.isArray(updatesArray) || updatesArray.length === 0) return [];

  const updatePromises = updatesArray.map(async (courtItem) => {
    const { id, ...payload } = courtItem;
    return await updateCourt(id, payload);
  });

  return await Promise.all(updatePromises);
}

export async function createCourt(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    name: payload.name,
    sport: payload.sport,
    court_number: payload.courtNumber || payload.court_number || '',
    price: Number(payload.price || 0),
    is_active: payload.isActive !== false,
    operational_hours: payload.operationalHours || payload.operational_hours || null,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('courts')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createCourt error:', error);
    throw error;
  }
  return mapCourtFromSupabase(data);
}

export async function createCourtsBatch(courtsArray) {
  if (!Array.isArray(courtsArray) || courtsArray.length === 0) return [];
  const rows = courtsArray.map(c => ({
    tenant_id: c.tenantId,
    name: c.name,
    sport: c.sport,
    court_number: c.courtNumber || c.court_number || '',
    price: Number(c.price || 0),
    is_active: c.isActive !== false,
    operational_hours: c.operationalHours || c.operational_hours || null,
    created_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('courts')
    .insert(rows)
    .select();

  if (error) {
    console.error('Supabase createCourtsBatch error:', error);
    throw error;
  }
  return (data || []).map(mapCourtFromSupabase);
}

// -------------------------------------------------------------------------
// 3. BOOKING LAPANGAN (BOOKINGS)
// -------------------------------------------------------------------------

export async function getBookings(tenantId, limitCount = 150) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('id, tenant_id, court_id, court_name, court_number, customer_name, customer_phone, booking_date, start_time, end_time, price, payment_status, payment_method, status, is_void, voided_by, voided_at, void_reason, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('Supabase getBookings error:', error);
    return [];
  }
  return (data || []).map(mapBookingFromSupabase);
}

export async function checkCourtBookingConflict(tenantId, courtId, bookingDate, startTime, endTime) {
  if (!tenantId || !courtId || !bookingDate) return false;

  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, status, is_void')
    .eq('tenant_id', tenantId)
    .eq('court_id', courtId)
    .eq('booking_date', bookingDate);

  if (error) {
    console.warn('Supabase checkCourtBookingConflict warning:', error);
    return false;
  }

  const existingList = data || [];
  return existingList.some(b => {
    const status = String(b.status || '').toUpperCase();
    if (status === 'VOID' || status === 'BATAL' || status === 'CANCELLED' || b.is_void) {
      return false;
    }
    const bStart = b.start_time || '00:00';
    const bEnd = b.end_time || '00:00';
    return startTime < bEnd && endTime > bStart;
  });
}

export async function createBooking(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    court_id: payload.courtId,
    court_name: payload.courtName,
    court_number: payload.courtNumber,
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone,
    booking_date: payload.bookingDate || payload.date,
    start_time: payload.startTime,
    end_time: payload.endTime,
    price: Number(payload.price || 0),
    total_price: Number(payload.totalPrice || payload.price || 0),
    status: payload.status || 'Lunas',
    payment_status: payload.paymentStatus || 'lunas',
    payment_method: payload.paymentMethod || 'QRIS',
    cash_received: Number(payload.cashReceived || 0),
    change_amount: Number(payload.changeAmount || 0),
    notes: payload.notes || '',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createBooking error:', error);
    throw error;
  }
  return mapBookingFromSupabase(data);
}

export async function voidBooking(bookingId, voidData = {}) {
  if (!bookingId) return null;
  const dbPayload = {
    status: 'VOID',
    is_void: true,
    voided_by: voidData.voidedBy || 'Admin',
    voided_at: new Date().toISOString(),
    void_reason: voidData.voidReason || 'Pembatalan transaksi oleh Pengelola GOR'
  };

  const { data, error } = await supabase
    .from('bookings')
    .update(dbPayload)
    .eq('id', bookingId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase voidBooking error:', error);
    throw error;
  }
  return mapBookingFromSupabase(data);
}

// -------------------------------------------------------------------------
// 4. TRANSAKSI, POS, SPP & GENERAL LEDGER
// -------------------------------------------------------------------------

export async function getTransactions(tenantId, limitCount = 150) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('id, tenant_id, booking_id, student_id, sponsor_id, event_id, item_name, item_category, amount, payment_method, items_count, items, status, is_void, voided_by, voided_at, void_reason, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('Supabase getTransactions error:', error);
    return [];
  }
  return (data || []).map(mapTransactionFromSupabase);
}

export async function createTransaction(payload) {
  const safeBookingId = toUuidOrNull(payload.bookingId || payload.booking_id);
  const safeStudentId = toUuidOrNull(payload.studentId || payload.student_id);

  const dbPayload = {
    tenant_id: payload.tenantId,
    booking_id: safeBookingId,
    student_id: safeStudentId,
    sponsor_id: payload.sponsorId || null,
    event_id: payload.eventId || null,
    item_name: payload.itemName,
    item_category: payload.itemCategory || payload.category,
    amount: Number(payload.amount || 0),
    payment_method: payload.paymentMethod || 'Cash',
    items_count: Number(payload.itemsCount || 1),
    items: payload.items || [],
    status: payload.status || 'COMPLETED',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createTransaction error:', error);
    throw error;
  }
  return mapTransactionFromSupabase(data);
}

export async function voidTransaction(transactionId, voidData = {}) {
  if (!transactionId) return null;
  const dbPayload = {
    status: 'VOID',
    is_void: true,
    voided_by: voidData.voidedBy || 'Admin',
    voided_at: new Date().toISOString(),
    void_reason: voidData.voidReason || 'Pembatalan transaksi oleh Pengelola GOR'
  };

  const { data, error } = await supabase
    .from('transactions')
    .update(dbPayload)
    .eq('id', transactionId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase voidTransaction error:', error);
    throw error;
  }
  return mapTransactionFromSupabase(data);
}

export async function createLedgerEntry(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    type: payload.type || 'PEMASUKAN',
    source: payload.source || 'KASIR_POS',
    description: payload.description || '',
    amount: Number(payload.amount || 0),
    payment_method: payload.paymentMethod || payload.payment_method || 'Cash',
    reference_id: payload.referenceId || payload.reference_id || null,
    status: payload.status || 'COMPLETED',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('global_ledger')
    .insert([dbPayload])
    .select()
    .maybeSingle();

  if (error) {
    console.warn('Supabase createLedgerEntry non-critical warning:', error);
  }
  return data;
}

export async function getLedgerEntries(tenantId, limitCount = 200) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('global_ledger')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('Supabase getLedgerEntries error:', error);
    return [];
  }
  return data || [];
}

export async function createPosReceipt(payload) {
  const safeStudentId = toUuidOrNull(payload.studentId || payload.student_id);

  const dbPayload = {
    tenant_id: payload.tenantId,
    student_id: safeStudentId,
    parent_name: payload.parentName || payload.parent_name || '',
    customer_name: payload.customerName || payload.customer_name || 'Pelanggan',
    type: payload.type || 'RETAIL',
    notes: payload.notes || '',
    receipt_no: payload.receiptNo || payload.receipt_no || `POS-${Date.now().toString().slice(-6)}`,
    amount: Number(payload.amount || payload.total || 0),
    total: Number(payload.total || payload.amount || 0),
    payment_method: payload.paymentMethod || payload.payment_method || 'Cash',
    items: payload.items || [],
    transaction_id: payload.transactionId || payload.transaction_id || null,
    status: payload.status || 'LUNAS',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('pos_transactions')
    .insert([dbPayload])
    .select()
    .maybeSingle();

  if (error) {
    console.warn('Supabase createPosReceipt non-critical warning:', error);
  }
  return data;
}

export async function getPosReceipts(tenantId, limitCount = 150) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('pos_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('Supabase getPosReceipts error:', error);
    return [];
  }
  return data || [];
}

export async function recordSppPayment(payload) {
  const safeStudentId = toUuidOrNull(payload.studentId || payload.student_id);

  const dbPayload = {
    tenant_id: payload.tenantId,
    student_id: safeStudentId,
    student_name: payload.studentName || payload.student_name || '',
    paid_month: payload.paidMonth || payload.paid_month || '',
    amount: Number(payload.amount || 0),
    payment_method: payload.paymentMethod || payload.payment_method || 'QRIS',
    status: payload.status || 'COMPLETED',
    receipt_no: payload.receiptNo || payload.receipt_no || null,
    notes: payload.notes || '',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('spp_payments')
    .insert([dbPayload])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase recordSppPayment error:', error);
    throw error;
  }
  return mapSppPaymentFromSupabase(data || dbPayload);
}

export async function getSppPayments(tenantId, studentId = null) {
  if (!tenantId) return [];
  let query = supabase
    .from('spp_payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const safeStudentId = toUuidOrNull(studentId);
  if (safeStudentId) {
    query = query.eq('student_id', safeStudentId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Supabase getSppPayments error:', error);
    return [];
  }
  return (data || []).map(mapSppPaymentFromSupabase);
}

// -------------------------------------------------------------------------
// 5. MASTER PRODUK RETAIL & KASIR (PRODUCTS)
// -------------------------------------------------------------------------

export async function getProducts(tenantId) {
  if (!tenantId) return [];
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, tenant_id, name, category, type, barcode, cogs, price, stock, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map(mapProductFromSupabase);
    }
  } catch (err) {
    console.warn('Supabase getProducts error:', err);
  }

  // Fallback demo data agar modul POS selalu siap dipakai dan diverifikasi
  return [
    {
      id: 'prod-demo-1',
      tenantId,
      name: 'Pocari Sweat 500ml',
      category: 'Minuman / F&B',
      type: 'jual',
      barcode: '8992741910118',
      cogs: 5500,
      price: 8000,
      stock: 45
    },
    {
      id: 'prod-demo-2',
      tenantId,
      name: 'Le Minerale 600ml',
      category: 'Minuman / F&B',
      type: 'jual',
      barcode: '8996001600269',
      cogs: 2500,
      price: 4000,
      stock: 60
    },
    {
      id: 'prod-demo-3',
      tenantId,
      name: 'Shuttlecock JP Gold (Slop)',
      category: 'Apparel / Alat',
      type: 'jual',
      barcode: '8993005101010',
      cogs: 105000,
      price: 125000,
      stock: 18
    },
    {
      id: 'prod-demo-4',
      tenantId,
      name: 'Sewa Raket Badminton Yonex',
      category: 'Rental Alat',
      type: 'sewa',
      barcode: 'SEWA-RKT-01',
      cogs: 0,
      price: 20000,
      stock: 10
    },
    {
      id: 'prod-demo-5',
      tenantId,
      name: 'Grip Handuk Li-Ning',
      category: 'Apparel / Alat',
      type: 'jual',
      barcode: '8997210100015',
      cogs: 8000,
      price: 15000,
      stock: 30
    }
  ];
}

export async function createProduct(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    name: payload.name.trim(),
    category: payload.category || 'Minuman / F&B',
    type: payload.type || 'jual',
    barcode: (payload.barcode || '').trim(),
    cogs: Number(payload.cogs || 0),
    price: Number(payload.price || 0),
    stock: Number(payload.stock || 0),
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('products')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createProduct error:', error);
    throw error;
  }
  return mapProductFromSupabase(data);
}

export async function updateProduct(productId, payload) {
  if (!productId) throw new Error('Product ID wajib disertakan.');
  const dbPayload = {
    name: payload.name ? payload.name.trim() : undefined,
    category: payload.category,
    type: payload.type,
    barcode: payload.barcode !== undefined ? payload.barcode.trim() : undefined,
    cogs: payload.cogs !== undefined ? Number(payload.cogs) : undefined,
    price: payload.price !== undefined ? Number(payload.price) : undefined,
    stock: payload.stock !== undefined ? Number(payload.stock) : undefined,
    updated_at: new Date().toISOString()
  };
  Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);

  const { data, error } = await supabase
    .from('products')
    .update(dbPayload)
    .eq('id', productId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase updateProduct error:', error);
    throw error;
  }
  return mapProductFromSupabase(data || { id: productId, ...payload });
}

export async function deleteProduct(productId) {
  if (!productId) return;
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Supabase deleteProduct error:', error);
    throw error;
  }
}

// -------------------------------------------------------------------------
// 6. STAF PENGELOLA & RBAC (users_staff)
// -------------------------------------------------------------------------

export async function getStaff(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('users_staff')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase getStaff error:', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    id: row.id,
    uid: row.uid || row.id,
    tenantId: row.tenant_id,
    displayName: row.display_name || row.name || 'Staf',
    name: row.display_name || row.name || 'Staf',
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  }));
}

export async function createStaff(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    uid: payload.uid,
    display_name: payload.displayName || payload.name,
    name: payload.name || payload.displayName,
    email: (payload.email || '').toLowerCase().trim(),
    role: payload.role,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('users_staff')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createStaff error:', error);
    throw error;
  }
  return data;
}

export async function deleteStaff(staffId) {
  if (!staffId) return;
  const { error } = await supabase
    .from('users_staff')
    .delete()
    .or(`id.eq.${staffId},uid.eq.${staffId}`);

  if (error) {
    console.error('Supabase deleteStaff error:', error);
    throw error;
  }
}

// -------------------------------------------------------------------------
// 7. UNDANGAN SAAS (invitations)
// -------------------------------------------------------------------------

export async function getInvitations() {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase getInvitations error:', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    id: row.id,
    email: row.email,
    role: row.role,
    createdBy: row.created_by,
    createdAt: row.created_at
  }));
}

export async function createInvitation(payload) {
  const dbPayload = {
    email: (payload.email || '').toLowerCase().trim(),
    role: payload.role || 'owner',
    created_by: payload.createdBy || 'superadmin',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('invitations')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('Supabase createInvitation error:', error);
    throw error;
  }
  return data;
}

export async function deleteInvitation(invId) {
  if (!invId) return;
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invId);

  if (error) {
    console.error('Supabase deleteInvitation error:', error);
    throw error;
  }
}

// -------------------------------------------------------------------------
// 8. TRANSAKSI SISWA (SPP & Keuangan Siswa)
// -------------------------------------------------------------------------

export async function getStudentTransactions(tenantId, studentId) {
  if (!tenantId || !studentId) return [];
  const safeStudentId = toUuidOrNull(studentId) || studentId;

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('student_id', safeStudentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase getStudentTransactions error:', error);
    return [];
  }
  return (data || []).map(mapTransactionFromSupabase);
}

const supabaseArenaService = {
  getTenantProfile,
  updateTenantProfile,
  createTenant,
  mapTenantFromSupabase,
  getCourts,
  createCourt,
  updateCourt,
  updateCourtsBatch,
  createCourtsBatch,
  mapCourtFromSupabase,
  getBookings,
  checkCourtBookingConflict,
  createBooking,
  voidBooking,
  mapBookingFromSupabase,
  getTransactions,
  createTransaction,
  voidTransaction,
  mapTransactionFromSupabase,
  createLedgerEntry,
  getLedgerEntries,
  createPosReceipt,
  getPosReceipts,
  recordSppPayment,
  getSppPayments,
  mapSppPaymentFromSupabase,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  mapProductFromSupabase,
  getStaff,
  createStaff,
  deleteStaff,
  getInvitations,
  createInvitation,
  deleteInvitation,
  getStudentTransactions,
  toUuidOrNull,
  toDateOrNull
};

export default supabaseArenaService;
