export type GeneratedDocumentKind =
  | 'contrat'
  | 'quittance'
  | 'facture'
  | 'recu'
  | 'mandat'
  | 'commission'
  | 'inventaire'
  | 'bilan'
  | 'xlsx'
  | 'csv'
  | 'export'
  | 'pdf'
  | 'document';

export interface GeneratedDocumentPreview {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  stats?: Array<{ label: string; value: string | number }>;
  period?: string;
  rowCount?: number;
}

export interface GeneratedDocumentPayload {
  kind: GeneratedDocumentKind;
  title: string;
  fileName: string;
  url: string;
  blob?: Blob;
  mimeType?: string;
  fileSize?: number;
  generatedAt: string;
  source?: string;
  preview?: GeneratedDocumentPreview;
  reused?: boolean;
  version?: number;
  storagePath?: string;
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
