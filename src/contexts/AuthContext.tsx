import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { deriveAccountProfile, type AccountProfile } from '../lib/accountProfile';
import type { Agency } from '../types/database';
import { clearCachedValuesForUser, isOfflineError, withReadTimeout } from '../services/offlineReadCache';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  agency: Agency | null;
  accountProfile: AccountProfile;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (options?: GoogleSignInOptions) => Promise<void>;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AGENCY_SELECT_LEGACY = 'id,name,ninea,address,phone,email,website,logo_url,plan,status,trial_ends_at,is_bailleur_account,created_at,updated_at';
const AGENCY_SELECT_EXTENDED = `${AGENCY_SELECT_LEGACY},organization_type`;
const AUTH_CACHE_PREFIX = 'sk_auth_profile:';
const AUTH_READ_TIMEOUT_MS = 5_000;
const OAUTH_TERMS_STORAGE_KEY = 'sk_oauth_terms_acceptance';

type GoogleSignInOptions = {
  acceptedTermsAt?: string;
  acceptedPrivacyAt?: string;
  termsVersion?: string;
  privacyVersion?: string;
};

function shouldRetryLegacyAgencySelect(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '42703' || message.includes('organization_type') || message.includes('column');
}

function getOAuthRedirectUrl(): string {
  const appUrl = (import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || '').replace(/\/+$/, '');
  const isLocal =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  const origin = isLocal || !appUrl ? window.location.origin : appUrl;
  return `${origin}/login`;
}

function readPendingOAuthTerms(): GoogleSignInOptions | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_TERMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as GoogleSignInOptions : null;
  } catch {
    return null;
  }
}

function clearPendingOAuthTerms() {
  try {
    sessionStorage.removeItem(OAUTH_TERMS_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

async function assertGoogleOAuthUrlIsUsable(url: string) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
    });

    if (response.status >= 400) {
      const text = await response.text();
      if (text.toLowerCase().includes('unsupported provider') || text.toLowerCase().includes('provider is not enabled')) {
        throw new Error('Unsupported provider: provider is not enabled');
      }
      throw new Error('Connexion Google indisponible pour le moment.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('unsupported provider') || message.includes('provider is not enabled')) {
      throw error;
    }
    // If the browser blocks the preflight because the provider redirects to Google,
    // continue with the real OAuth navigation.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const accountProfile = useMemo(() => deriveAccountProfile(agency), [agency]);

  const readCachedAuth = (userId: string): { profile: UserProfile; agency: Agency | null } | null => {
    try {
      const raw = localStorage.getItem(`${AUTH_CACHE_PREFIX}${userId}`);
      return raw ? JSON.parse(raw) as { profile: UserProfile; agency: Agency | null } : null;
    } catch {
      return null;
    }
  };

  const writeCachedAuth = (userId: string, nextProfile: UserProfile, nextAgency: Agency | null) => {
    try {
      localStorage.setItem(
        `${AUTH_CACHE_PREFIX}${userId}`,
        JSON.stringify({ profile: nextProfile, agency: nextAgency, timestamp: Date.now() }),
      );
    } catch {
      /* noop */
    }
  };

  const readStoredSupabaseUser = (): User | null => {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { user?: User | null; currentSession?: { user?: User | null } | null };
        const storedUser = parsed.user ?? parsed.currentSession?.user ?? null;
        if (storedUser?.id) return storedUser;
      }
    } catch {
      /* noop */
    }
    return null;
  };

  // Prevent concurrent loadProfile calls (race condition guard)
  const loadingProfileRef = useRef(false);

  const loadAgency = async (agencyId: string): Promise<Agency | null> => {
    const extended = await withReadTimeout(
      supabase
        .from('agencies')
        .select(AGENCY_SELECT_EXTENDED)
        .eq('id', agencyId)
        .maybeSingle(),
      AUTH_READ_TIMEOUT_MS,
    );

    if (!extended.error && extended.data) {
      return extended.data as Agency;
    }

    if (!shouldRetryLegacyAgencySelect(extended.error)) {
      return null;
    }

    const legacy = await withReadTimeout(
      supabase
        .from('agencies')
        .select(AGENCY_SELECT_LEGACY)
        .eq('id', agencyId)
        .maybeSingle(),
      AUTH_READ_TIMEOUT_MS,
    );

    return (legacy.data as Agency | null) ?? null;
  };

  const loadProfile = async (userId: string, retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      const cached = readCachedAuth(userId);
      if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
        setProfile(cached.profile);
        setAgency(cached.agency);
        return;
      }

      const { data, error } = await withReadTimeout(
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        AUTH_READ_TIMEOUT_MS,
      );

      if (error) {
        if (cached && isOfflineError(error)) {
          setProfile(cached.profile);
          setAgency(cached.agency);
        } else {
          setProfile(null);
        }
        return;
      }

      if (!data) {
        if (retryCount < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return loadProfile(userId, retryCount + 1);
        }
        setProfile(null);
      } else {
        let nextProfile = data as UserProfile;
        const pendingTerms = readPendingOAuthTerms();
        if (pendingTerms?.acceptedTermsAt && !nextProfile.accepted_terms_at) {
          const { data: updatedProfile, error: termsError } = await supabase
            .from('user_profiles')
            .update({
              accepted_terms_at: pendingTerms.acceptedTermsAt,
              accepted_privacy_at: pendingTerms.acceptedPrivacyAt ?? pendingTerms.acceptedTermsAt,
              terms_version: pendingTerms.termsVersion ?? null,
              privacy_version: pendingTerms.privacyVersion ?? null,
            })
            .eq('id', userId)
            .select('*')
            .maybeSingle();

          if (!termsError && updatedProfile) {
            nextProfile = updatedProfile as UserProfile;
            clearPendingOAuthTerms();
          }
        }

        setProfile(nextProfile);
        let loadedAgency: Agency | null = null;
        if (nextProfile.agency_id) {
          loadedAgency = await loadAgency(nextProfile.agency_id);
          setAgency(loadedAgency);
        } else {
          setAgency(null);
        }
        writeCachedAuth(userId, nextProfile, loadedAgency);
      }
    } catch (error) {
      const cached = readCachedAuth(userId);
      if (cached && isOfflineError(error)) {
        setProfile(cached.profile);
        setAgency(cached.agency);
      } else {
        setProfile(null);
        setAgency(null);
      }
    } finally {
      setLoading(false);
      loadingProfileRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let fallbackTimer: number | null = null;

    // Rely solely on onAuthStateChange (fires INITIAL_SESSION on startup).
    // This avoids the race condition between safeGetSession + onAuthStateChange
    // both calling loadProfile concurrently.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const newUser = session?.user ?? null;
        setUser(newUser);

        if (newUser) {
          // Nettoyage immédiat de l'URL des tokens OAuth (#access_token=...) après connexion
          if (
            typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token=') ||
              window.location.hash.includes('refresh_token=') ||
              window.location.hash.includes('error='))
          ) {
            window.history.replaceState(null, document.title, `${window.location.origin}/#/dashboard`);
          }

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

    fallbackTimer = window.setTimeout(() => {
      if (!mounted || !loadingProfileRef.current && !loading) return;
      const storedUser = readStoredSupabaseUser();
      if (!storedUser?.id) return;
      const cached = readCachedAuth(storedUser.id);
      if (!cached) return;
      setUser(storedUser);
      setProfile(cached.profile);
      setAgency(cached.agency);
      setLoading(false);
      loadingProfileRef.current = false;
    }, 1800);

    return () => {
      mounted = false;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async (options?: GoogleSignInOptions) => {
    if (options?.acceptedTermsAt) {
      sessionStorage.setItem(OAUTH_TERMS_STORAGE_KEY, JSON.stringify(options));
    } else {
      clearPendingOAuthTerms();
    }

    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Connexion Google indisponible pour le moment.');

    await assertGoogleOAuthUrlIsUsable(data.url);
    window.location.assign(data.url);
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
    const userId = user?.id;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (userId) {
      try {
        localStorage.removeItem(`${AUTH_CACHE_PREFIX}${userId}`);
        await clearCachedValuesForUser(userId);
      } catch {
        /* noop */
      }
    }
    window.location.hash = '#/dashboard';
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
