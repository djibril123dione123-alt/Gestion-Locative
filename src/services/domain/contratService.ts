/**
 * contratService — logique métier des contrats.
 *
 * Responsabilités :
 *   - Valider qu'un contrat peut être créé / activé
 *   - Vérifier qu'une unité est libre avant assignation
 *   - Calculer la date de fin selon la durée
 *   - Fournir les règles de transition de statut
 */

export type ContratStatut = 'actif' | 'expire' | 'resilie';

export interface ContratForValidation {
  date_debut: string;
  date_fin?: string | null;
  loyer_mensuel: number;
  commission: number | null;
  unite_id: string | null;
  locataire_id: string | null;
}

export class ContratValidationError extends Error {
  readonly code = 'CONTRAT_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'ContratValidationError';
  }
}

/**
 * Valide les champs requis d'un contrat avant insertion.
 * Lance une ContratValidationError si invalide.
 */
export function validateContrat(c: ContratForValidation): void {
  if (!c.locataire_id) {
    throw new ContratValidationError('Un locataire est requis pour créer un contrat.');
  }
  if (!c.unite_id) {
    throw new ContratValidationError('Une unité doit être sélectionnée.');
  }
  if (!c.date_debut) {
    throw new ContratValidationError('La date de début est requise.');
  }
  if (c.loyer_mensuel <= 0) {
    throw new ContratValidationError('Le loyer mensuel doit être supérieur à 0.');
  }
  if (c.date_fin && c.date_fin <= c.date_debut) {
    throw new ContratValidationError('La date de fin doit être postérieure à la date de début.');
  }
  if (c.commission !== null && (c.commission < 0 || c.commission > 100)) {
    throw new ContratValidationError('Le taux de commission doit être compris entre 0 et 100.');
  }
}

/**
 * Vérifie si une transition de statut est légale.
 * Transitions autorisées :
 *   actif → expire | resilie
 *   expire → resilie
 */
export function isStatutTransitionValid(from: ContratStatut, to: ContratStatut): boolean {
  const allowed: Record<ContratStatut, ContratStatut[]> = {
    actif: ['expire', 'resilie'],
    expire: ['resilie'],
    resilie: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

/**
 * Calcule la date de fin à partir de la date de début et d'une durée en mois.
 */
export function computeDateFin(dateDebut: string, dureeMois: number): string {
  const d = new Date(dateDebut);
  d.setMonth(d.getMonth() + dureeMois);
  return d.toISOString().split('T')[0];
}

/**
 * Retourne true si le contrat est expiré (date_fin < aujourd'hui).
 */
export function isContratExpire(dateFin: string | null | undefined): boolean {
  if (!dateFin) return false;
  return new Date(dateFin) < new Date();
}

/**
 * Formate l'erreur pour l'UI.
 */
export function formatContratError(err: unknown): string {
  if (err instanceof ContratValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Une erreur est survenue lors de la gestion du contrat.';
}
