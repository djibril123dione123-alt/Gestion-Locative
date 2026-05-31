import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { deriveAccountProfile, type AccountProfile } from '../lib/accountProfile';
import type { Agency } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  agency: Agency | null;
  accountProfile: AccountProfile;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AGENCY_SELECT_LEGACY = 'id,name,ninea,address,phone,email,website,logo_url,plan,status,trial_ends_at,is_bailleur_account,created_at,updated_at';
const AGENCY_SELECT_EXTENDED = `${AGENCY_SELECT_LEGACY},organization_type`;

function shouldRetryLegacyAgencySelect(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '42703' || message.includes('organization_type') || message.includes('column');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const accountProfile = useMemo(() => deriveAccountProfile(agency), [agency]);

  // Prevent concurrent loadProfile calls (race condition guard)
  const loadingProfileRef = useRef(false);

  const loadAgency = async (agencyId: string): Promise<Agency | null> => {
    const extended = await supabase
      .from('agencies')
      .select(AGENCY_SELECT_EXTENDED)
      .eq('id', agencyId)
      .maybeSingle();

    if (!extended.error && extended.data) {
      return extended.data as Agency;
    }

    if (!shouldRetryLegacyAgencySelect(extended.error)) {
      return null;
    }

    const legacy = await supabase
      .from('agencies')
      .select(AGENCY_SELECT_LEGACY)
      .eq('id', agencyId)
      .maybeSingle();

    return (legacy.data as Agency | null) ?? null;
  };

  const loadProfile = async (userId: string, retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setProfile(null);
        return;
      }

      if (!data) {
        if (retryCount < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return loadProfile(userId, retryCount + 1);
        }
        setProfile(null);
      } else {
        setProfile(data);
        if (data.agency_id) {
          setAgency(await loadAgency(data.agency_id));
        } else {
          setAgency(null);
        }
      }
    } catch {
      setProfile(null);
      setAgency(null);
    } finally {
      setLoading(false);
      loadingProfileRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Rely solely on onAuthStateChange (fires INITIAL_SESSION on startup).
    // This avoids the race condition between safeGetSession + onAuthStateChange
    // both calling loadProfile concurrently.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const newUser = session?.user ?? null;
        setUser(newUser);

        if (newUser) {
          // Guard against concurrent calls (e.g. rapid auth state changes)
          if (loadingProfileRef.current) return;
          loadingProfileRef.current = true;
          void loadProfile(newUser.id);
        } else {
          setProfile(null);
          setAgency(null);
          setLoading(false);
          loadingProfileRef.current = false;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, profileData: Partial<UserProfile>) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom: profileData.nom || '',
          prenom: profileData.prenom || '',
          role: profileData.role || 'agent',
          accepted_terms_at: profileData.accepted_terms_at ?? null,
          accepted_privacy_at: profileData.accepted_privacy_at ?? null,
          terms_version: profileData.terms_version ?? null,
          privacy_version: profileData.privacy_version ?? null,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const MAX_PROFILE_RETRIES = 5;
    const PROFILE_RETRY_DELAY = 600;
    let newProfile = null;

    for (let attempt = 0; attempt < MAX_PROFILE_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY));
      }

      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select()
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) continue;
      if (data) {
        newProfile = data;
        break;
      }
    }

    if (newProfile) {
      setProfile(newProfile);
      if (newProfile.agency_id) {
        setAgency(await loadAgency(newProfile.agency_id));
      }
    }
    setLoading(false);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, agency, accountProfile, loading, signIn, signInWithGoogle, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Fast Refresh accepts this shared hook export because it does not hold component state.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
