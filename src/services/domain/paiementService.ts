/**
 * paiementService — logique métier des paiements.
 *
 * Responsabilités :
 *   - Construire le payload complet avant insertion/mise à jour Supabase
 *   - Valider les champs requis
 *   - Calculer parts agence/bailleur via commissionService
 *   - Fournir un soft-delete (deleted_at) au lieu d'un hard DELETE
 */

import type { ModePayment, PaiementStatut } from '../../types/entities';
import { calculateCommission, CommissionRequiredError } from './commissionService';

export interface PaiementFormData {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: ModePayment;
  statut: PaiementStatut;
  reference?: string | null;
}

export interface ContratForPaiement {
  id: string;
  commission: number | null | undefined;
  loyer_mensuel: number;
}

export interface PaiementPayload {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: ModePayment;
  statut: PaiementStatut;
  reference: string | null;
  part_agence: number;
  part_bailleur: number;
  agency_id: string;
}

export class PaiementValidationError extends Error {
  readonly code = 'PAIEMENT_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'PaiementValidationError';
  }
}

/**
 * Construit le payload complet prêt pour Supabase.
 * Lance une erreur typée si la commission est manquante ou les données invalides.
 */
export function buildPaiementPayload(
  form: PaiementFormData,
  contrat: ContratForPaiement,
  agencyId: string,
): PaiementPayload {
  if (!form.contrat_id) {
    throw new PaiementValidationError('Veuillez sélectionner un contrat.');
  }
  if (!form.montant_total || form.montant_total <= 0) {
    throw new PaiementValidationError('Le montant doit être supérieur à 0.');
  }
  if (!form.mois_concerne) {
    throw new PaiementValidationError('Le mois concerné est requis.');
  }
  if (!form.date_paiement) {
    throw new PaiementValidationError('La date de paiement est requise.');
  }

  const { partAgence, partBailleur } = calculateCommission(
    form.montant_total,
    contrat.commission,
    contrat.id,
  );

  return {
    contrat_id: form.contrat_id,
    montant_total: form.montant_total,
    mois_concerne: form.mois_concerne,
    date_paiement: form.date_paiement,
    mode_paiement: form.mode_paiement,
    statut: form.statut,
    reference: form.reference ?? null,
    part_agence: partAgence,
    part_bailleur: partBailleur,
    agency_id: agencyId,
  };
}

/**
 * Traduit les erreurs métier en messages lisibles pour l'UI.
 */
export function formatPaiementError(err: unknown): string {
  if (err instanceof CommissionRequiredError) {
    return err.message;
  }
  if (err instanceof PaiementValidationError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Une erreur est survenue lors de l'enregistrement du paiement.";
}
