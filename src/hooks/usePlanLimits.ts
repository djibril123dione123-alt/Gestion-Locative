import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface PlanLimits {
  canAddImmeuble: boolean;
  canAddUnite: boolean;
  canAddUser: boolean;
  planName: string;
  usage: { users: number; immeubles: number; unites: number };
  limits: { max_users: number; max_immeubles: number; max_unites: number };
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePlanLimits(): PlanLimits {
  const { profile } = useAuth();
  const [state, setState] = useState<Omit<PlanLimits, 'refresh'>>({
    canAddImmeuble: true,
    canAddUnite: true,
    canAddUser: true,
    planName: 'pro',
    usage: { users: 0, immeubles: 0, unites: 0 },
    limits: { max_users: -1, max_immeubles: -1, max_unites: -1 },
    loading: true,
  });

  const checkLimits = useCallback(async () => {
    if (!profile?.agency_id) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const { data } = await supabase.rpc('check_plan_limits', {
        p_agency_id: profile.agency_id,
      });
      if (data) {
        setState({
          canAddImmeuble: !!data.can_add_immeuble,
          canAddUnite: !!data.can_add_unite,
          canAddUser: !!data.can_add_user,
          planName: data.limits?.plan ?? 'pro',
          usage: data.usage ?? { users: 0, immeubles: 0, unites: 0 },
          limits: data.limits ?? { max_users: -1, max_immeubles: -1, max_unites: -1 },
          loading: false,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    if (profile?.agency_id) checkLimits();
  }, [profile?.agency_id, checkLimits]);

  return { ...state, refresh: checkLimits };
}
