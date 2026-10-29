import { supabase } from '../config/supabase';

/**
 * =========================================================================
 * SUPABASE ARENA & COMMERCE SERVICE (POSTGRESQL MULTI-TENANT ARCHITECTURE)
 * =========================================================================
 * Layanan komunikasi data berbasis relational database Supabase untuk:
 * - Profil Tenant / GOR
 * - Lapangan (Courts)
 * - Booking Lapangan (Bookings)
 * - Transaksi & Keuangan (Transactions, POS, Global Ledger)
 * - Master Produk Retail & Kasir (Products)
 * - Sponsor & Event
 * - Staf & Undangan SaaS
 */

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
    bankAccounts: row.bank_accounts || row.bankAccounts || [],
    qrisUrl: row.qris_url || row.qrisUrl || null,
    sppBillingStartDay: row.spp_billing_start_day || row.sppBillingStartDay || 1,
    sppDueDay: row.spp_due_day || row.sppDueDay || 10,
    receiptFooterText: row.receipt_footer_text || row.receiptFooterText || '',
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
    bookingId: row.booking_id || row.bookingId || null,
    studentId: row.student_id || row.studentId || null,
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
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    province: payload.province,
    regency: payload.regency,
    district: payload.district,
    village: payload.village,
    sports_type: payload.sportsType || payload.sports_type,
    courts_count: payload.courtsCount || payload.courts_count,
    logo_url: payload.logoUrl !== undefined ? payload.logoUrl : payload.logo_url,
    bank_accounts: payload.bankAccounts || payload.bank_accounts,
    qris_url: payload.qrisUrl !== undefined ? payload.qrisUrl : payload.qris_url,
    spp_billing_start_day: payload.sppBillingStartDay || payload.spp_billing_start_day,
    spp_due_day: payload.sppDueDay || payload.spp_due_day,
    receipt_footer_text: payload.receiptFooterText || payload.receipt_footer_text,
    academy_pricing: payload.academyPricing || payload.academy_pricing,
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
  let ownerUid = payload.ownerUid || payload.owner_uid || null;
  let ownerEmail = payload.ownerEmail || payload.owner_email || '';

  if (!ownerUid) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        ownerUid = user.id;
        if (!ownerEmail) ownerEmail = user.email || '';
      }
    } catch (authErr) {
      console.warn('Could not retrieve current user in createTenant:', authErr);
    }
  }

  const dbPayload = {
    name: payload.name,
    phone: payload.phone,
    owner_name: payload.ownerName || payload.owner_name || '',
    owner_email: ownerEmail,
    owner_uid: ownerUid,
    address: payload.address || '',
    province: payload.province || '',
    regency: payload.regency || '',
    district: payload.district || '',
    village: payload.village || '',
    sports_type: payload.sportsType || payload.sports_type || '',
    courts_count: payload.courtsCount || payload.courts_count || 0,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('tenants')
    .insert([dbPayload])
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
    .select('*')
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

export async function createCourt(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    name: payload.name,
    sport: payload.sport,
    court_number: payload.courtNumber || payload.court_number || '',
    price: Number(payload.price || 0),
    is_active: payload.isActive !== false,
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
    .select('*')
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
// 4. TRANSAKSI & GENERAL LEDGER
// -------------------------------------------------------------------------

export async function getTransactions(tenantId, limitCount = 150) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
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
  const dbPayload = {
    tenant_id: payload.tenantId,
    booking_id: payload.bookingId || null,
    student_id: payload.studentId || null,
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
    payment_method: payload.paymentMethod || 'Cash',
    reference_id: payload.referenceId || null,
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

export async function createPosReceipt(payload) {
  const dbPayload = {
    tenant_id: payload.tenantId,
    amount: Number(payload.amount || payload.total || 0),
    total: Number(payload.total || payload.amount || 0),
    payment_method: payload.paymentMethod || 'Cash',
    items: payload.items || [],
    transaction_id: payload.transactionId || null,
    receipt_no: payload.receiptNo || `POS-${Date.now().toString().slice(-6)}`,
    customer_name: payload.customerName || 'Pelanggan',
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

// -------------------------------------------------------------------------
// 5. MASTER PRODUK RETAIL & KASIR (PRODUCTS)
// -------------------------------------------------------------------------

export async function getProducts(tenantId) {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) {
    console.warn('Supabase getProducts error:', error);
    return [];
  }
  return (data || []).map(mapProductFromSupabase);
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
// 8. TRANSAKSI SISWA (SPP & Keuangan Mahasiswa/Siswa)
// -------------------------------------------------------------------------

export async function getStudentTransactions(tenantId, studentId) {
  if (!tenantId || !studentId) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase getStudentTransactions error:', error);
    return [];
  }
  return (data || []).map(mapTransactionFromSupabase);
}
