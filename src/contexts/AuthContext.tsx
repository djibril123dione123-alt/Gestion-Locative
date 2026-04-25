import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      console.log(`🔍 Loading profile for user ${userId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error loading profile:', error);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!data) {
        if (retryCount < MAX_RETRIES) {
          console.warn(`⏳ No profile found, retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return loadProfile(userId, retryCount + 1);
        } else {
          console.warn('⚠️ Profile not found after all retries. User profile will be created by trigger or needs to complete registration.');
          setProfile(null);
        }
      } else {
        console.log('✅ Profile loaded successfully:', {
          id: data.id,
          role: data.role,
          hasAgency: !!data.agency_id
        });
        setProfile(data);
      }
    } catch (error) {
      console.error('❌ Unexpected error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, profileData: Partial<UserProfile>) => {
    console.log('🚀 Starting sign up...', { email });

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom: profileData.nom || '',
          prenom: profileData.prenom || '',
          role: profileData.role || 'agent',
        }
      }
    });

    if (authError) {
      console.error('❌ Auth sign up error:', authError);
      throw authError;
    }

    if (!authData.user) {
      console.error('❌ User creation failed - no user returned');
      throw new Error('User creation failed');
    }

    console.log('✅ Auth user created:', authData.user.id);
    console.log('⏳ Waiting for trigger to create profile...');

    // Retry pattern : on poll le profil jusqu'à 5 fois (max ~3s) au lieu d'un sleep arbitraire
    const MAX_PROFILE_RETRIES = 5;
    const PROFILE_RETRY_DELAY = 600;
    let newProfile = null;

    for (let attempt = 0; attempt < MAX_PROFILE_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, PROFILE_RETRY_DELAY));
      }

      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select()
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error(`❌ Error fetching profile (attempt ${attempt + 1}):`, profileError);
        continue;
      }

      if (data) {
        newProfile = data;
        console.log(`✅ Profile found after ${attempt + 1} attempt(s):`, data.id);
        break;
      }
    }

    if (newProfile) {
      setProfile(newProfile);
    } else {
      console.warn('⚠️ Profile not found yet, will be loaded by AuthContext');
    }

    setLoading(false);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
