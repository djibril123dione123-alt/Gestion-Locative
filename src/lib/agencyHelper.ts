import { supabase, UserProfile } from './supabase';

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

export async function reloadUserProfile(maxRetries = 5, delay = 1000): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;
    if (profile) return profile;

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}
