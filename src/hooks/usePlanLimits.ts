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

/**
 * Seul id de plan "gratuit / compte individuel" reellement present dans
 * subscription_plans/subscriptions.plan_id (verifie en base le 2026-08-18,
 * apres l'incident ou usePlanLimits.ts comparait a 'basic', un id qui n'a
 * jamais existe ni en base ni dans le catalogue frontend). Ne pas modifier
 * sans revalider contre `select id from subscription_plans`.
 */
export const STARTER_PLAN_ID = 'starter';

export interface ServerPlanLimits {
  max_users: number;
  max_immeubles: number;
  max_unites: number;
  plan?: string;
}

/**
 * Determine les limites effectives d'une agence. Un compte individuel
 * (bailleur seul) sans abonnement payant actif retombe sur le plan
 * starter par defaut ; sinon on fait confiance aux limites renvoyees par
 * le serveur (RPC check_plan_limits).
 */
export function resolveEffectivePlanLimits(
  isIndividualOwner: boolean,
  hasPaidSubscription: boolean,
  serverLimits: ServerPlanLimits | null | undefined,
): ServerPlanLimits {
  if (isIndividualOwner && !hasPaidSubscription) {
    return { max_users: 1, max_immeubles: 3, max_unites: 10, plan: STARTER_PLAN_ID };
  }
  return serverLimits ?? { max_users: -1, max_immeubles: -1, max_unites: -1, plan: 'pro' };
}

export function usePlanLimits(): PlanLimits {
  const { profile, accountProfile } = useAuth();
  const [state, setState] = useState<Omit<PlanLimits, 'refresh'>>({
    canAddImmeuble: true,
    canAddUnite: true,
    canAddUser: true,
    planName: STARTER_PLAN_ID,
    usage: { users: 0, immeubles: 0, unites: 0 },
    limits: { max_users: 1, max_immeubles: 3, max_unites: 10 },
    loading: true,
  });

  const checkLimits = useCallback(async () => {
    if (!profile?.agency_id) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const [limitsResponse, paidSubscriptionResponse] = await Promise.all([
        supabase.rpc('check_plan_limits', {
          p_agency_id: profile.agency_id,
        }),
        accountProfile.isIndividualOwner
          ? supabase
              .from('subscriptions')
              .select('id, plan_id, status')
              .eq('agency_id', profile.agency_id)
              .eq('status', 'active')
              .neq('plan_id', STARTER_PLAN_ID)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (paidSubscriptionResponse.error) {
        throw paidSubscriptionResponse.error;
      }

      if (limitsResponse.error) {
        throw limitsResponse.error;
      }

      const data = limitsResponse.data;
      if (data) {
        const effectiveLimits = resolveEffectivePlanLimits(
          accountProfile.isIndividualOwner,
          Boolean(paidSubscriptionResponse.data),
          data.limits,
        );
        const usage = data.usage ?? { users: 0, immeubles: 0, unites: 0 };
        setState({
          canAddImmeuble: effectiveLimits.max_immeubles === -1 || usage.immeubles < effectiveLimits.max_immeubles,
          canAddUnite: effectiveLimits.max_unites === -1 || usage.unites < effectiveLimits.max_unites,
          canAddUser: effectiveLimits.max_users === -1 || usage.users < effectiveLimits.max_users,
          planName: effectiveLimits.plan ?? 'pro',
          usage,
          limits: {
            max_users: effectiveLimits.max_users,
            max_immeubles: effectiveLimits.max_immeubles,
            max_unites: effectiveLimits.max_unites,
          },
          loading: false,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [accountProfile.isIndividualOwner, profile?.agency_id]);

  useEffect(() => {
    if (profile?.agency_id) checkLimits();
  }, [profile?.agency_id, checkLimits]);

  return { ...state, refresh: checkLimits };
}
