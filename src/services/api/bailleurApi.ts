import { supabase } from '../../lib/supabase';

export type BailleurLifecycleStatus = 'resilie' | 'suspendu' | 'archive' | 'cloture';

export interface UpdateBailleurLifecycleInput {
  id: string;
  statut: BailleurLifecycleStatus;
  date: string;
  motif: string;
  observations?: string | null;
  acknowledge_impacts: boolean;
}

export interface BailleurLifecycleImpacts {
  immeubles_actifs: number;
  unites_liees: number;
  contrats_actifs: number;
}

export interface BailleurLifecycleResult {
  id: string;
  statut: BailleurLifecycleStatus;
  resiliation_date?: string | null;
  resiliation_motif?: string | null;
  resiliation_observations?: string | null;
  [key: string]: unknown;
}

export class BailleurApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'BailleurApiError';
    this.code = code;
    this.details = details;
  }
}

export async function updateBailleurLifecycleViaEdge(
  input: UpdateBailleurLifecycleInput,
): Promise<{ data: BailleurLifecycleResult; impacts?: BailleurLifecycleImpacts }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new BailleurApiError('Session expiree. Veuillez vous reconnecter.', 'NO_SESSION');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-bailleur-lifecycle`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${sessionData.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null) as {
    data?: BailleurLifecycleResult;
    error?: string;
    code?: string;
    details?: unknown;
    impacts?: BailleurLifecycleImpacts;
  } | null;

  if (!response.ok) {
    throw new BailleurApiError(
      payload?.error ?? `La fonction update-bailleur-lifecycle a echoue (${response.status}).`,
      payload?.code ?? `EDGE_FUNCTION_${response.status}`,
      payload?.details,
    );
  }

  if (!payload?.data) {
    throw new BailleurApiError("Reponse invalide de l'Edge Function.", 'MISSING_DATA');
  }

  return { data: payload.data, impacts: payload.impacts };
}
