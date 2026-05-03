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
  return error?.status === 404 || error?.status === 409 || message.includes('Edge Function') || message.includes('Conflict');
}

async function invokeContratFunction<T>(fnName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{
    data?: T;
    error?: string;
    code?: string;
  }>(fnName, { body: body as Record<string, unknown> });

  if (error && !isEdgeFunctionUnavailable(error)) {
    throw new ContratApiError(error.message ?? `Erreur Edge Function ${fnName}.`, 'EDGE_FUNCTION_ERROR');
  }

  if (data && !(data as { error?: string }).error) {
    const result = (data as { data?: T }).data;
    if (result) return result;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new ContratApiError('Session invalide. Veuillez vous reconnecter.', 'AUTH_SESSION_ERROR');
  }

  if (!sessionData.session) {
    throw new ContratApiError('Vous devez être connecté pour créer un contrat.', 'NO_SESSION');
  }

  if (fnName === 'create-contrat') {
    const { data: created, error: createError } = await supabase
      .from('contrats')
      .insert({
        locataire_id: (body as CreateContratInput).locataire_id,
        unite_id: (body as CreateContratInput).unite_id,
        date_debut: (body as CreateContratInput).date_debut,
        date_fin: (body as CreateContratInput).date_fin ?? null,
        loyer_mensuel: (body as CreateContratInput).loyer_mensuel,
        commission: (body as CreateContratInput).commission ?? null,
        caution: (body as CreateContratInput).caution ?? null,
        statut: (body as CreateContratInput).statut,
        destination: (body as CreateContratInput).destination ?? null,
        agency_id: sessionData.session.user.id ? sessionData.session.user.id : undefined,
      })
      .select('*')
      .single();

    if (createError || !created) {
      throw new ContratApiError(createError?.message ?? 'Création du contrat impossible.', 'FALLBACK_CREATE_ERROR');
    }

    return created as T;
  }

  if (fnName === 'update-contrat') {
    const input = body as UpdateContratInput;
    const { data: updated, error: updateError } = await supabase
      .from('contrats')
      .update({
        statut: input.statut,
        date_fin: input.date_fin ?? null,
        commission: input.commission ?? null,
        caution: input.caution ?? null,
      })
      .eq('id', input.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new ContratApiError(updateError?.message ?? 'Mise à jour du contrat impossible.', 'FALLBACK_UPDATE_ERROR');
    }

    return updated as T;
  }

  throw new ContratApiError(`Fonction inconnue: ${fnName}`, 'UNKNOWN_FUNCTION');
}

export async function createContratViaEdge(input: CreateContratInput): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('create-contrat', input);
}

export async function updateContratViaEdge(input: UpdateContratInput): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('update-contrat', input);
}
