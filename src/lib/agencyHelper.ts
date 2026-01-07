import { supabase } from './supabase';

export async function getCurrentAgencyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('agency_id')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.agency_id || null;
}

export function buildAgencyQuery(tableName: string) {
  return supabase
    .from(tableName)
    .select('*');
}
