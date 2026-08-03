import type {
  DocumentArchiveStatus,
  DocumentVerificationStatus,
} from './documentGeneration';
import { completeDocumentGeneration } from './documentGeneration';

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
  generationKey?: string;
  reference?: string;
  archiveStatus?: DocumentArchiveStatus;
  verificationStatus?: DocumentVerificationStatus;
}

export const DOCUMENT_GENERATED_EVENT = 'samaykeur:document-generated';

export function announceGeneratedDocument(
  payload: Omit<GeneratedDocumentPayload, 'generatedAt'> & { generatedAt?: string }
) {
  const detail: GeneratedDocumentPayload = {
    ...payload,
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
  };

  completeDocumentGeneration(detail);
  if (typeof window === 'undefined') return detail;

  window.dispatchEvent(
    new CustomEvent<GeneratedDocumentPayload>(DOCUMENT_GENERATED_EVENT, {
      detail,
    })
  );
  return detail;
}
