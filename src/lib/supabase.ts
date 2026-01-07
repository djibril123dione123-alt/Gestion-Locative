import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'agent' | 'comptable' | 'bailleur';

export interface UserProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  role: UserRole;
  bailleur_id: string | null;
  agency_id: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}
