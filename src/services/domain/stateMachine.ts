/**
 * stateMachine.ts — Machines d'état métier Samay Këur
 *
 * Source de vérité des transitions autorisées pour les entités financières.
 * Ces règles sont appliquées :
 *   - Côté serveur (Edge Functions — Deno inline, même logique)
 *   - Côté client (validation UX avant envoi)
 *
 * États paiement :
 *   impaye  → paye | partiel | annule
 *   partiel → paye | annule
 *   paye    → annule          (remboursement)
 *   annule  → ∅               (état terminal)
 *
 * États contrat :
 *   actif   → expire | resilie
 *   expire  → actif           (renouvellement)
 *   resilie → ∅               (état terminal)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaiementStatut = 'paye' | 'partiel' | 'impaye' | 'annule';
export type ContratStatut  = 'actif' | 'expire' | 'resilie';

// ─── Tables de transitions ────────────────────────────────────────────────────

const PAIEMENT_TRANSITIONS: Record<PaiementStatut, PaiementStatut[]> = {
  impaye:  ['paye', 'partiel', 'annule'],
  partiel: ['paye', 'annule'],
  paye:    ['annule'],
  annule:  [],                            // état terminal — aucune sortie
};

const CONTRAT_TRANSITIONS: Record<ContratStatut, ContratStatut[]> = {
  actif:   ['expire', 'resilie'],
  expire:  ['actif'],                     // renouvellement possible
  resilie: [],                            // état terminal — aucune sortie
};

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Valide la transition d'un paiement de `from` vers `to`.
 * Lance une erreur si la transition est interdite.
 */
export function validatePaiementTransition(
  from: PaiementStatut,
  to: PaiementStatut,
): void {
  if (from === to) return; // pas de changement = toujours OK
  const allowed = PAIEMENT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    const list = allowed.length > 0 ? allowed.join(', ') : 'aucune transition';
    throw new Error(
      `Transition paiement invalide : "${from}" → "${to}". Autorisées depuis "${from}" : ${list}.`,
    );
  }
}

/**
 * Valide la transition d'un contrat de `from` vers `to`.
 * Lance une erreur si la transition est interdite.
 */
export function validateContratTransition(
  from: ContratStatut,
  to: ContratStatut,
): void {
  if (from === to) return;
  const allowed = CONTRAT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    const list = allowed.length > 0 ? allowed.join(', ') : 'aucune transition';
    throw new Error(
      `Transition contrat invalide : "${from}" → "${to}". Autorisées depuis "${from}" : ${list}.`,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne true si le statut paiement est un état terminal (aucune sortie possible). */
export function isPaiementTerminal(statut: PaiementStatut): boolean {
  return (PAIEMENT_TRANSITIONS[statut] ?? []).length === 0;
}

/** Retourne true si le statut contrat est un état terminal (aucune sortie possible). */
export function isContratTerminal(statut: ContratStatut): boolean {
  return (CONTRAT_TRANSITIONS[statut] ?? []).length === 0;
}

/** Retourne les transitions autorisées depuis un statut paiement donné. */
export function getAllowedPaiementTransitions(from: PaiementStatut): PaiementStatut[] {
  return [...(PAIEMENT_TRANSITIONS[from] ?? [])];
}

/** Retourne les transitions autorisées depuis un statut contrat donné. */
export function getAllowedContratTransitions(from: ContratStatut): ContratStatut[] {
  return [...(CONTRAT_TRANSITIONS[from] ?? [])];
}
