/**
 * commissionService — calcul et validation des commissions.
 *
 * Règle métier :
 *   - La commission DOIT être définie et > 0 sur le contrat avant d'enregistrer
 *     un paiement. Aucun fallback silencieux n'est acceptable.
 *   - part_agence = round(montant * commission / 100)
 *   - part_bailleur = montant - part_agence
 */

export class CommissionRequiredError extends Error {
  readonly code = 'COMMISSION_REQUIRED';
  constructor(contratId?: string) {
    const where = contratId ? ` (contrat ${contratId})` : '';
    super(
      `La commission n'est pas définie sur ce contrat${where}. ` +
        `Veuillez configurer le taux de commission avant d'enregistrer un paiement.`,
    );
    this.name = 'CommissionRequiredError';
  }
}

export class CommissionRangeError extends Error {
  readonly code = 'COMMISSION_RANGE';
  constructor(value: number) {
    super(`La commission (${value}%) doit être comprise entre 0 et 100.`);
    this.name = 'CommissionRangeError';
  }
}

/**
 * Valide qu'une commission est exploitable.
 * Lance une erreur typée si elle est invalide.
 */
export function validateCommission(
  commission: number | null | undefined,
  contratId?: string,
): asserts commission is number {
  if (commission === null || commission === undefined) {
    throw new CommissionRequiredError(contratId);
  }
  if (commission < 0 || commission > 100) {
    throw new CommissionRangeError(commission);
  }
}

export interface CommissionResult {
  partAgence: number;
  partBailleur: number;
  tauxCommission: number;
}

/**
 * Calcule la répartition agence / bailleur.
 * Lance une CommissionRequiredError si la commission est nulle ou indéfinie.
 */
export function calculateCommission(
  montantTotal: number,
  commission: number | null | undefined,
  contratId?: string,
): CommissionResult {
  validateCommission(commission, contratId);

  const partAgence = Math.round((montantTotal * commission) / 100);
  const partBailleur = montantTotal - partAgence;

  return {
    partAgence,
    partBailleur,
    tauxCommission: commission,
  };
}

/**
 * Retourne la commission d'un contrat si elle est valide, sinon null.
 * Ne lance pas d'erreur — utile pour les checks UI.
 */
export function getCommissionOrNull(commission: number | null | undefined): number | null {
  if (commission === null || commission === undefined) return null;
  if (commission < 0 || commission > 100) return null;
  return commission;
}

/**
 * Vérifie si un contrat a une commission configurée (pour afficher un avertissement UI).
 */
export function isCommissionMissing(commission: number | null | undefined): boolean {
  return getCommissionOrNull(commission) === null;
}
