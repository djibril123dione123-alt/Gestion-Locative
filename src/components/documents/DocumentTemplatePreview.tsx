import { FileCheck2, FileClock, Loader2 } from 'lucide-react';

interface DocumentTemplatePreviewProps {
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
  supported: boolean;
}

/**
 * Aperçu "fidèle" au sens strict : affiche le VRAI PDF produit par le même
 * générateur que la génération officielle (voir useDocumentPreviewPdf +
 * src/lib/pdf.ts buildXxxPreviewDocument), rendu nativement par le navigateur
 * dans une iframe — jamais une reconstitution HTML approximative.
 */
export function DocumentTemplatePreview({ blobUrl, loading, error, supported }: DocumentTemplatePreviewProps) {
  if (!supported) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
        <div className="max-w-sm">
          <FileClock className="mx-auto h-7 w-7 text-slate-400" />
          <h3 className="mt-3 text-sm font-black text-slate-900">Aperçu bientôt disponible pour ce type</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Le rendu réel de ce type de document n'est pas encore branché à l'aperçu en direct.
            Utilisez « PDF test » sur les autres types en attendant.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-amber-300/70 bg-amber-50/70 p-6 text-center">
        <div className="max-w-sm">
          <FileCheck2 className="mx-auto h-7 w-7 text-amber-700" />
          <h3 className="mt-3 text-sm font-black text-slate-900">Aperçu temporairement indisponible</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-slate-200 bg-slate-50/60">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-80 overflow-hidden rounded-md border border-slate-900/10 bg-slate-100/80">
      {loading && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[0.62rem] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Mise à jour…
        </div>
      )}
      <iframe
        title="Aperçu du document"
        src={blobUrl}
        className="h-full w-full border-0"
      />
    </div>
  );
}
