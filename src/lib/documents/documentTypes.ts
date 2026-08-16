// Registre canonique des types de documents — source unique pour tout libellé
// "type de document -> texte affiché" dans l'app (liste GED, modale de génération,
// page publique /verify, console admin, échéances de loyer).
//
// Avant ce fichier, 8 endroits maintenaient chacun leur propre table, la plupart
// incomplète vis-à-vis des types de documents d'échéances (rent_invoice, etc.),
// ce qui cassait notamment la page de vérification publique et le badge "vérifiable"
// de la GED pour ces types. Voir le plan de refonte documentaire pour le détail.

export type CanonicalDocumentType =
  | 'contrat'
  | 'mandat'
  | 'quittance'
  | 'facture'
  | 'rapport'
  | 'rapport_bailleur'
  | 'rapport_proprietaire'
  | 'due_notice'
  | 'rent_invoice'
  | 'partial_payment_receipt'
  | 'rent_receipt'
  | 'credit_note'
  | 'recu'
  | 'commission'
  | 'inventaire'
  | 'bilan'
  | 'export'
  | 'pdf'
  | 'xlsx'
  | 'csv'
  | 'document';

// Les libellés "contrat"/"mandat" suivent le titre effectivement dessiné par le
// vrai générateur PDF (pdf.ts: generateContratPDF/generateMandatBailleurPDF),
// pas une variante de libellé apparue localement dans un des 8 anciens registres.
const CANONICAL_DOCUMENT_LABELS: Record<CanonicalDocumentType, string> = {
  contrat: 'Contrat de location',
  mandat: 'Mandat de gérance',
  quittance: 'Quittance',
  facture: 'Facture',
  rapport: 'Rapport',
  rapport_bailleur: 'Rapport bailleur',
  rapport_proprietaire: 'Rapport propriétaire',
  due_notice: "Avis d'échéance de loyer",
  rent_invoice: 'Facture de loyer',
  partial_payment_receipt: 'Reçu de paiement partiel',
  rent_receipt: 'Quittance de loyer',
  credit_note: 'Avoir locatif',
  recu: 'Reçu de paiement',
  commission: 'Rapport bailleur',
  inventaire: 'Inventaire',
  bilan: 'Bilan financier',
  export: 'Export financier',
  pdf: 'Document',
  xlsx: 'Export Excel',
  csv: 'Export CSV',
  document: 'Document',
};

/** Types de documents émis par le moteur d'échéances de loyer (voir rentalDuePdf.ts). */
export const RENTAL_DUE_DOCUMENT_TYPES: CanonicalDocumentType[] = [
  'due_notice',
  'rent_invoice',
  'partial_payment_receipt',
  'rent_receipt',
  'credit_note',
];

function isCanonicalDocumentType(value: string): value is CanonicalDocumentType {
  return Object.prototype.hasOwnProperty.call(CANONICAL_DOCUMENT_LABELS, value);
}

export type DocumentTypeLabelFallback = 'humanize' | 'raw' | 'generic';

/**
 * Résout le libellé français d'un type de document.
 * `fallback` contrôle le comportement pour un type inconnu (chaque appelant
 * historique avait un choix différent, volontairement préservé ici) :
 *  - 'humanize' : remplace les underscores par des espaces (ex: liste GED interne)
 *  - 'raw'      : renvoie le type tel quel (ex: console admin, qui veut voir la vraie valeur)
 *  - 'generic'  : renvoie toujours "Document" (ex: modale de génération)
 */
export function getDocumentTypeLabel(
  type: string | null | undefined,
  options: { fallback?: DocumentTypeLabelFallback } = {},
): string {
  const fallback = options.fallback ?? 'generic';
  const raw = type ?? '';
  const lower = raw.trim().toLowerCase();

  if (isCanonicalDocumentType(lower)) return CANONICAL_DOCUMENT_LABELS[lower];

  switch (fallback) {
    case 'humanize':
      return raw ? raw.replace(/_/g, ' ') : 'Document';
    case 'raw':
      return raw.trim() || 'Document';
    case 'generic':
    default:
      return 'Document';
  }
}
