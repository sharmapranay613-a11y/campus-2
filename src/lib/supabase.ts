import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCampusConfig } from '@/src/config/campus';

const { supabaseUrl, supabaseAnonKey, isSupabaseConfigured } = getCampusConfig();

export const supabaseConfigured = isSupabaseConfigured;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  return supabase;
}
