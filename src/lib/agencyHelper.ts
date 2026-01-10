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
  if (!user) {
    console.error('❌ No authenticated user');
    return null;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`🔄 Reloading profile (attempt ${attempt + 1}/${maxRetries})`);

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('❌ Error reloading profile:', error);
      return null;
    }

    if (profile) {
      console.log('✅ Profile reloaded successfully:', {
        id: profile.id,
        role: profile.role,
        hasAgency: !!profile.agency_id
      });
      return profile;
    }

    if (attempt < maxRetries - 1) {
      console.log(`⏳ Profile not found, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error('❌ Profile not found after all retries');
  return null;
}

export function buildAgencyQuery(tableName: string) {
  return supabase
    .from(tableName)
    .select('*');
}
