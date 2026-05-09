export type GeneratedDocumentKind =
  | 'contrat'
  | 'quittance'
  | 'facture'
  | 'recu'
  | 'mandat'
  | 'commission'
  | 'inventaire'
  | 'bilan'
  | 'pdf'
  | 'document';

export interface GeneratedDocumentPayload {
  kind: GeneratedDocumentKind;
  title: string;
  fileName: string;
  url: string;
  blob?: Blob;
  generatedAt: string;
  source?: string;
}

export const DOCUMENT_GENERATED_EVENT = 'samaykeur:document-generated';

export function announceGeneratedDocument(
  payload: Omit<GeneratedDocumentPayload, 'generatedAt'> & { generatedAt?: string }
) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<GeneratedDocumentPayload>(DOCUMENT_GENERATED_EVENT, {
      detail: {
        ...payload,
        generatedAt: payload.generatedAt ?? new Date().toISOString(),
      },
    })
  );
}
