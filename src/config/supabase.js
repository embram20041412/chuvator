import { createClient } from '@supabase/supabase-js';

// 1. Ambil URL dari env atau fallback
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co';

// 2. KUNCI PERBAIKAN: Bersihkan akhiran /rest/v1 dan garis miring berlebih
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

console.log('[Supabase Init] URL Bersih:', supabaseUrl);
console.log('[Supabase Init] API Key terdeteksi:', supabaseAnonKey ? 'Ya' : 'Tidak');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Kredensial Supabase (URL atau Anon Key) hilang. Pastikan .env sudah dikonfigurasi.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
