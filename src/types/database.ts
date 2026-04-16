export interface UserProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  role: 'admin' | 'agent' | 'comptable' | 'bailleur';
  bailleur_id: string | null;
  agency_id: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agency {
  id: string;
  name: string;
  ninea: string | null;
  address: string | null;
  phone: string;
  email: string;
  website: string | null;
  logo_url: string | null;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  trial_ends_at: string | null;
  is_bailleur_account: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  agency_id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}
