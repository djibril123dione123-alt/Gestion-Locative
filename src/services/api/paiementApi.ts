/**
 * paiementApi.ts — Client pour l'Edge Function create-paiement
 *
 * Remplace l'appel direct supabase.from('paiements').insert() par un appel
 * à l'Edge Function Supabase, qui garantit :
 *   - Validation Zod serveur
 *   - agency_id injecté côté serveur (jamais trust client)
 *   - Calcul commission côté serveur
 *
 * Fallback : si l'Edge Function n'est pas déployée (env DEV ou erreur 404),
 * une erreur explicite est levée pour alerter le développeur.
 *
 * Déploiement Edge Function :
 *   supabase functions deploy create-paiement --no-verify-jwt
 */

import { supabase } from '../../lib/supabase';

export interface CreatePaiementInput {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'carte';
  statut: 'paye' | 'en_attente' | 'partiel';
  reference?: string | null;
  notes?: string | null;
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

/**
 * Crée un paiement via l'Edge Function Supabase.
 * La commission et l'agency_id sont calculés/injectés côté serveur.
 */
export async function createPaiementViaEdge(
  input: CreatePaiementInput,
): Promise<PaiementApiResult> {
  const { data, error } = await supabase.functions.invoke<{
    data?: PaiementApiResult;
    error?: string;
    code?: string;
  }>('create-paiement', {
    body: input,
  });

  if (error) {
    throw new PaiementApiError(
      error.message ?? 'Erreur Edge Function inconnue.',
      'EDGE_FUNCTION_ERROR',
    );
  }

  if (!data) {
    throw new PaiementApiError(
      'Réponse vide de l\'Edge Function.',
      'EMPTY_RESPONSE',
    );
  }

  if (data.error) {
    throw new PaiementApiError(data.error, data.code ?? 'API_ERROR');
  }

  if (!data.data) {
    throw new PaiementApiError(
      'Données de paiement manquantes dans la réponse.',
      'MISSING_DATA',
    );
  }

  return data.data;
}
