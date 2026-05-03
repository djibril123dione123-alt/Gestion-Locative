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

function isEdgeFunctionUnavailable(error: { message?: string; status?: number } | null) {
  const message = error?.message ?? '';
  return error?.status === 404 || message.includes('Edge Function');
}
function normalizeEdgeError(payload: { error?: string; code?: string; details?: unknown } | undefined, fallback: string) {
  return {
    message: payload?.error ?? fallback,
    code: payload?.code ?? 'EDGE_FUNCTION_ERROR',
  };
}

async function invokeContratFunction<T>(fnName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
  }>(fnName, { body: body as Record<string, unknown> });

  if (error) {
    const payload = data as { error?: string; code?: string; details?: unknown } | undefined;
    const normalized = normalizeEdgeError(payload, error.message ?? `Erreur Edge Function ${fnName}.`);
    throw new ContratApiError(
      normalized.message,
      error.status === 409 ? 'EDGE_FUNCTION_CONFLICT' : normalized.code,
    );
  }

  if (data && (data as { error?: string }).error) {
    const payload = data as { error?: string; code?: string; details?: unknown };
    throw new ContratApiError(
      payload.error ?? `Erreur Edge Function ${fnName}.`,
      payload.code ?? 'EDGE_FUNCTION_ERROR',
    );
  }

  if (data && !(data as { error?: string }).error) {
    const result = (data as { data?: T }).data;
    if (result) return result;
  }

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
