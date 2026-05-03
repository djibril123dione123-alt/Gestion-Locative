/**
 * paiementApi.ts — Client pour les Edge Functions paiements
 *
 * Remplace tous les appels directs supabase.from('paiements').insert/update/delete()
 * par des appels aux Edge Functions Supabase :
 *   - create-paiement : validation Zod + agency_id + commission côté serveur
 *   - update-paiement : vérification propriété + recalcul parts si montant modifié
 *   - cancel-paiement : soft-cancel + ledger reversal + event_log
 *
 * Déploiement :
 *   supabase functions deploy create-paiement
 *   supabase functions deploy update-paiement
 *   supabase functions deploy cancel-paiement
 */

import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePaiementInput {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre';
  statut: 'paye' | 'partiel' | 'impaye';
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

// ─── Helper interne ───────────────────────────────────────────────────────────

async function invokePaiementFn<T>(fnName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
  }>(fnName, { body: body as Record<string, unknown> });

  if (error) {
    const payload = data as { error?: string; code?: string; details?: unknown } | undefined;
    throw new PaiementApiError(
      payload?.error ?? error.message ?? `Erreur Edge Function ${fnName}.`,
      payload?.code ?? 'EDGE_FUNCTION_ERROR',
    );
  }
  if (!data) {
    throw new PaiementApiError("Réponse vide de l'Edge Function.", 'EMPTY_RESPONSE');
  }
  if ((data as { error?: string }).error) {
    const payload = data as { error: string; code?: string; details?: unknown };
    throw new PaiementApiError(
      payload.error,
      payload.code ?? 'API_ERROR',
    );
  }
  const result = (data as { data?: T }).data;
  if (!result) {
    throw new PaiementApiError('Données de paiement manquantes dans la réponse.', 'MISSING_DATA');
  }
  return result;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Crée un paiement.
 * La commission et l'agency_id sont calculés/injectés côté serveur.
 */
export async function createPaiementViaEdge(
  input: CreatePaiementInput,
): Promise<PaiementApiResult> {
  return invokePaiementFn<PaiementApiResult>('create-paiement', input);
}

/**
 * Met à jour un paiement.
 * Si montant_total est fourni, les parts sont recalculées côté serveur.
 */
export async function updatePaiementViaEdge(
  input: UpdatePaiementInput,
): Promise<PaiementApiResult> {
  return invokePaiementFn<PaiementApiResult>('update-paiement', input);
}

/**
 * Annule un paiement (soft-cancel : statut → 'annule').
 * Écrit un reversal dans le ledger et supprime l'entrée revenus associée.
 */
export async function cancelPaiementViaEdge(
  input: CancelPaiementInput,
): Promise<{ id: string; statut: string; already_cancelled?: boolean }> {
  return invokePaiementFn('cancel-paiement', input);
}
