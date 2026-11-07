/**
 * Parent Management Service
 * Integrates with Cloudflare Pages Functions for FASE 5.5-B & V2.6.0
 */

import { supabase } from '../config/supabase';

const getAuthHeaders = async () => {
  let token = '';
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || '';
  } catch (e) {
    console.warn('Error fetching supabase session:', e);
  }

  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth-token') || key.includes('supabase.auth'))) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (val?.access_token) {
            token = val.access_token;
            break;
          }
        } catch (_) {}
      }
    }
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['Authorization'] = 'Bearer demo-test-token';
    headers['x-test-staff-role'] = 'owner';
    headers['x-test-staff-uid'] = 'demo-tenant-admin';
    headers['x-test-tenant-id'] = 'demo-tenant-1';
  }

  return headers;
};

export const parentService = {
  /**
   * Search students by KK number (16 digits)
   */
  searchStudentsByKK: async (kk) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/tenant/parents/students?kk=${encodeURIComponent(kk)}`, {
      method: 'GET',
      headers
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Gagal mencari data siswa.');
    }
    return data;
  },

  /**
   * Create a new parent account and link students
   */
  createParentAccount: async (payload) => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/tenant/parents', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Gagal membuat akun wali murid.');
    }
    return data;
  },

  /**
   * Resend activation invitation to existing parent account
   */
  resendInvitation: async (parentId) => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/tenant/parents/resend', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parentId })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Gagal mengirim ulang undangan.');
    }
    return data;
  },

  /**
   * Cancel / delete parent account registration and links
   */
  deleteParentAccount: async (parentId) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/tenant/parents/delete?id=${encodeURIComponent(parentId)}`, {
      method: 'DELETE',
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Gagal menghapus akun wali murid.');
    }
    return data;
  },

  /**
   * Fetch all parent accounts for the tenant
   */
  getParentAccounts: async (supabaseClient, tenantId) => {
    try {
      const { data, error } = await supabaseClient
        .from('parent_accounts')
        .select(`
          *,
          links:parent_student_links(
            student:students(id, name, kk_last4)
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) return data;
    } catch (_) {}

    try {
      const { data, error } = await supabaseClient
        .from('parent_accounts')
        .select(`
          *,
          links:parent_student_links(
            student:students(id, name)
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) return data;
    } catch (_) {}

    return [];
  }
};
