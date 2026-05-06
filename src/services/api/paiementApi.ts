import { supabase } from '../../lib/supabase';

export interface CreatePaiementInput {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre';
  statut: 'paye' | 'partiel' | 'impaye';
  idempotency_key?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface UpdatePaiementInput {
  id: string;
  montant_total?: number;
  mode_paiement?: 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre';
  statut?: 'paye' | 'partiel' | 'impaye' | 'annule';
  date_paiement?: string;
  reference?: string | null;
  notes?: string | null;
}

export interface CancelPaiementInput {
  id: string;
  raison?: string;
}

export interface PaiementApiResult {
  id: string;
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  part_agence: number;
  part_bailleur: number;
  agency_id: string;
  created_at: string;
  [key: string]: unknown;
}

export class PaiementApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PaiementApiError';
    this.code = code;
  }
}

async function invokePaiementFn<T>(fnName: string, body: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new PaiementApiError('Session expirée. Veuillez vous reconnecter.', 'NO_SESSION');
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
    throw new PaiementApiError(
      payload?.error ?? `La fonction ${fnName} a échoué (${response.status}).`,
      payload?.code ?? `EDGE_FUNCTION_${response.status}`,
    );
  }

  if (!payload) {
    throw new PaiementApiError("Réponse vide de l'Edge Function.", 'EMPTY_RESPONSE');
  }

  if (payload.error) {
    throw new PaiementApiError(payload.error, payload.code ?? 'API_ERROR');
  }

  if (!payload.data) {
    throw new PaiementApiError('Données de paiement manquantes dans la réponse.', 'MISSING_DATA');
  }

  return payload.data;
}

export async function createPaiementViaEdge(
  input: CreatePaiementInput,
): Promise<PaiementApiResult> {
  return invokePaiementFn<PaiementApiResult>('create-paiement', input);
}

export async function updatePaiementViaEdge(
  input: UpdatePaiementInput,
): Promise<PaiementApiResult> {
  return invokePaiementFn<PaiementApiResult>('update-paiement', input);
}

export async function cancelPaiementViaEdge(
  input: CancelPaiementInput,
): Promise<{ id: string; statut: string; already_cancelled?: boolean }> {
  return invokePaiementFn('cancel-paiement', input);
}
