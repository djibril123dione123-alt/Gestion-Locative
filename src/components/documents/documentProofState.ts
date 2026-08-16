export type DocumentProofKind =
  | 'verifiable'
  | 'review'
  | 'revoked'
  | 'superseded'
  | 'archived'
  | 'non_verifiable';

export interface DocumentProofStateInput {
  source: 'uploaded' | 'generated';
  lifecycleStatus: string;
  documentType?: string;
  verification?: {
    status: 'authentic' | 'revoked' | 'superseded';
  };
}

export interface DocumentProofState {
  kind: DocumentProofKind;
  label: string;
  description: string;
}

const QR_CAPABLE_DOCUMENT_TYPES = new Set([
  'quittance',
  'facture',
  'contrat',
  'mandat',
  'rapport',
  'rapport_bailleur',
  'rapport_proprietaire',
  'due_notice',
  'rent_invoice',
  'partial_payment_receipt',
  'rent_receipt',
  'credit_note',
]);

export function supportsPublicVerification(documentType?: string) {
  return Boolean(documentType && QR_CAPABLE_DOCUMENT_TYPES.has(documentType));
}

export function getDocumentProofState(document: DocumentProofStateInput): DocumentProofState {
  if (document.verification?.status === 'revoked') {
    return { kind: 'revoked', label: 'Révoqué', description: 'La preuve publique a été révoquée.' };
  }
  if (document.verification?.status === 'superseded') {
    return { kind: 'superseded', label: 'Remplacé', description: 'Une version plus récente remplace cette preuve.' };
  }
  if (document.lifecycleStatus === 'archived') {
    return { kind: 'archived', label: 'Archivé', description: 'Le document est conservé dans les archives.' };
  }
  if (document.verification?.status === 'authentic') {
    return { kind: 'verifiable', label: 'Vérifiable QR', description: 'Lien public de vérification disponible.' };
  }
  if (document.source === 'generated' && supportsPublicVerification(document.documentType)) {
    return { kind: 'review', label: 'À vérifier', description: 'La preuve QR est absente ou incomplète.' };
  }
  return {
    kind: 'non_verifiable',
    label: 'Non vérifiable',
    description: document.source === 'uploaded'
      ? 'Ce fichier ajouté manuellement ne possède pas de preuve QR.'
      : 'Ce type de document ne possède pas de preuve QR.',
  };
}
