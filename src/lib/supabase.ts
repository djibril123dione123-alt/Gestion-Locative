import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'super_admin' | 'admin' | 'agent' | 'comptable' | 'bailleur';

export type { UserProfile };


// Interceptor logic for human-readable errors
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body.error && (body.error.includes('token') || body.error.includes('JWT'))) {
        body.message = 'Votre session a expiré. Veuillez vous reconnecter.';
        return new Response(JSON.stringify(body), { status: response.status, headers: response.headers });
      }
    } catch {
      // La réponse n'est pas JSON : conserver la réponse originale.
    }
  }
  return response;
};


// Interceptor logic for human-readable errors
