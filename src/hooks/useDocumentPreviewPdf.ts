import { useEffect, useRef, useState } from 'react';
import type jsPDF from 'jspdf';
import {
  buildContratPreviewDocument,
  buildMandatPreviewDocument,
  buildPaiementReceiptPreviewDocument,
  buildRapportPreviewDocument,
} from '../lib/pdf';
import type { AgencySettings } from '../types';
import type { DocumentTemplateContent, DocumentTemplateType } from '../types/documentStudio';

const DEBOUNCE_MS = 400;

/** Types dont l'aperçu réel est déjà branché à un générateur de pdf.ts. */
const PREVIEWABLE_TYPES: DocumentTemplateType[] = [
  'contrat',
  'mandat',
  'quittance',
  'facture',
  'rapport_bailleur',
  'rapport_proprietaire',
];

export function isDocumentPreviewSupported(documentType: DocumentTemplateType): boolean {
  return PREVIEWABLE_TYPES.includes(documentType);
}

interface UseDocumentPreviewPdfResult {
  /** URL blob du PDF d'aperçu, à passer directement à un <iframe src>. */
  blobUrl: string | null;
  /** Instance jsPDF déjà construite pour ce blobUrl — réutilisable pour "PDF test" (doc.save()) sans regénérer. */
  doc: jsPDF | null;
  loading: boolean;
  error: string | null;
  /** false si ce type de document n'a pas encore de générateur réel branché à l'aperçu. */
  supported: boolean;
}

/**
 * Génère en direct (avec debounce) le VRAI PDF — via buildXxxPreviewDocument,
 * les mêmes fonctions de dessin que la génération réelle — pour un contenu de
 * modèle en cours d'édition. Ne déclenche jamais d'allocation de référence ni
 * d'écriture registre (previewMode dans pdf.ts). Le blob URL précédent est
 * systématiquement révoqué avant d'en produire un nouveau.
 */
export function useDocumentPreviewPdf(
  documentType: DocumentTemplateType,
  content: DocumentTemplateContent | null,
  settings: Partial<AgencySettings>,
): UseDocumentPreviewPdfResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<jsPDF | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);
  const currentBlobUrlRef = useRef<string | null>(null);
  const supported = isDocumentPreviewSupported(documentType);

  useEffect(() => {
    if (!content || !supported) {
      setLoading(false);
      setError(null);
      return;
    }

    const sequence = ++sequenceRef.current;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const nextDoc = documentType === 'mandat'
            ? await buildMandatPreviewDocument(content, settings)
            : documentType === 'quittance' || documentType === 'facture'
              ? await buildPaiementReceiptPreviewDocument(content, settings, documentType === 'facture' ? 100000 : 0)
              : documentType === 'rapport_bailleur' || documentType === 'rapport_proprietaire'
                ? await buildRapportPreviewDocument(documentType, content, settings)
                : await buildContratPreviewDocument(content, settings);

          if (sequence !== sequenceRef.current) return; // une frappe plus récente a déjà relancé un rendu

          // Même mécanisme que saveGeneratedPdf (pdf.ts) : output('blob') est le
          // seul overload jsPDF dont le type de retour est fiable côté TS.
          const nextUrl = URL.createObjectURL(nextDoc.output('blob'));
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = nextUrl;
          setBlobUrl(nextUrl);
          setDoc(nextDoc);
        } catch (err) {
          if (sequence !== sequenceRef.current) return;
          setError(err instanceof Error ? err.message : "L'aperçu n'a pas pu être généré.");
          setDoc(null);
        } finally {
          if (sequence === sequenceRef.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, content, settings, supported]);

  useEffect(() => () => {
    if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
  }, []);

  return { blobUrl, doc, loading, error, supported };
}
