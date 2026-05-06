import { supabase } from '../../lib/supabase';

export interface CreateContratInput {
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin?: string | null;
  loyer_mensuel: number;
  commission?: number | null;
  caution?: number | null;
  statut: 'actif' | 'expire' | 'resilie';
  destination?: string | null;
}

export interface UpdateContratInput {
  id: string;
  statut?: 'actif' | 'expire' | 'resilie';
  date_fin?: string | null;
  commission?: number | null;
  caution?: number | null;
}

export interface DeleteContratInput {
  id: string;
}

export interface ContratApiResult {
  id: string;
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin: string | null;
  loyer_mensuel: number;
  commission: number | null;
  caution: number | null;
  statut: string;
  destination: string | null;
  agency_id: string;
  created_at: string;
  [key: string]: unknown;
}

export class ContratApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ContratApiError';
    this.code = code;
  }
}

async function invokeContratFunction<T>(fnName: string, body: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new ContratApiError('Session expirée. Veuillez vous reconnecter.', 'NO_SESSION');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${sessionData.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null) as {
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
  } | null;

  if (!response.ok) {
    throw new ContratApiError(
      payload?.error ?? `La fonction ${fnName} a échoué (${response.status}).`,
      payload?.code ?? `EDGE_FUNCTION_${response.status}`,
    );
  }

  if (payload?.error) {
    throw new ContratApiError(
      payload.error ?? `Erreur Edge Function ${fnName}.`,
      payload.code ?? 'EDGE_FUNCTION_ERROR',
    );
  }

  if (payload?.data) return payload.data;

  throw new ContratApiError(`La fonction ${fnName} a échoué.`, 'EDGE_FUNCTION_EMPTY_RESPONSE');
}

export async function createContratViaEdge(input: CreateContratInput): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('create-contrat', input);
}

export async function updateContratViaEdge(input: UpdateContratInput): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('update-contrat', input);
}

export async function deleteContrat(input: DeleteContratInput): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new ContratApiError('Session invalide. Veuillez vous reconnecter.', 'AUTH_SESSION_ERROR');
  }

  if (!sessionData.session) {
    throw new ContratApiError('Vous devez être connecté pour supprimer un contrat.', 'NO_SESSION');
  }

  const { error } = await supabase
    .from('contrats')
    .delete()
    .eq('id', input.id);

  if (error) {
    throw new ContratApiError(error.message ?? 'Suppression du contrat impossible.', 'DELETE_ERROR');
  }
}
