/**
 * contratApi.ts — Client pour les Edge Functions create-contrat et update-contrat
 *
 * Remplace les appels directs supabase.from('contrats').insert/update() par des
 * appels aux Edge Functions Supabase, qui garantissent :
 *   - JWT + agency_id injecté côté serveur
 *   - Validation Zod serveur
 *   - Vérification disponibilité unité (create)
 *   - Libération unité sur résiliation (update)
 *   - Log event_log automatique
 *
 * Déploiement :
 *   supabase functions deploy create-contrat
 *   supabase functions deploy update-contrat
 */

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

async function invokeContratFunction<T>(
  fnName: string,
  body: unknown,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{
    data?: T;
    error?: string;
    code?: string;
  }>(fnName, { body });

  if (error) {
    throw new ContratApiError(
      error.message ?? `Erreur Edge Function ${fnName}.`,
      'EDGE_FUNCTION_ERROR',
    );
  }

  if (!data) {
    throw new ContratApiError('Réponse vide de l\'Edge Function.', 'EMPTY_RESPONSE');
  }

  if ((data as { error?: string }).error) {
    throw new ContratApiError(
      (data as { error: string; code?: string }).error,
      (data as { code?: string }).code ?? 'API_ERROR',
    );
  }

  const result = (data as { data?: T }).data;
  if (!result) {
    throw new ContratApiError('Données manquantes dans la réponse.', 'MISSING_DATA');
  }

  return result;
}

/**
 * Crée un contrat via l'Edge Function.
 * Vérifie la disponibilité de l'unité côté serveur.
 */
export async function createContratViaEdge(
  input: CreateContratInput,
): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('create-contrat', input);
}

/**
 * Met à jour un contrat via l'Edge Function.
 * Libère l'unité si statut → 'resilie' ou 'expire'.
 */
export async function updateContratViaEdge(
  input: UpdateContratInput,
): Promise<ContratApiResult> {
  return invokeContratFunction<ContratApiResult>('update-contrat', input);
}
