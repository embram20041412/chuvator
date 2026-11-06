/**
 * Parent Management Service
 * Integrates with Cloudflare Pages Functions for FASE 5.5-B
 */

const getAuthHeaders = () => {
  // Try to get token from localStorage (common in this app)
  const sessionStr = localStorage.getItem('sb-wqnhlmvvyhpctmaukwyj-auth-token');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };
    } catch (e) {
      console.error('Error parsing auth session:', e);
    }
  }
  return { 'Content-Type': 'application/json' };
};

export const parentService = {
  /**
   * Search students by KK number (16 digits)
   */
  searchStudentsByKK: async (kk) => {
    const response = await fetch(`/api/tenant/parents/students?kk=${encodeURIComponent(kk)}`, {
      method: 'GET',
      headers: getAuthHeaders()
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
    const response = await fetch('/api/tenant/parents', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Gagal membuat akun wali murid.');
    }
    return data;
  },

  /**
   * Fetch all parent accounts for the tenant
   * Note: This uses the standard Supabase REST API via PostgREST since we have a direct table
   */
  getParentAccounts: async (supabase, tenantId) => {
    const { data, error } = await supabase
      .from('parent_accounts')
      .select(`
        *,
        links:parent_student_links(
          student:students(id, name, kk_last4)
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
