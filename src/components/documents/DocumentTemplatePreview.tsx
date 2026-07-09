import { FileCheck2, QrCode, Stamp } from 'lucide-react';
import {
  getSampleTemplateVariables,
  renderDocumentTemplate,
} from '../../lib/documents/templateEngine';
import type { DocumentTemplateContent } from '../../types/documentStudio';

export function DocumentTemplatePreview({ content }: { content: DocumentTemplateContent }) {
  let rendered;
  try {
    rendered = renderDocumentTemplate(content, getSampleTemplateVariables(content.documentType));
  } catch {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-amber-300/70 bg-amber-50/70 p-6 text-center">
        <div className="max-w-sm">
          <FileCheck2 className="mx-auto h-7 w-7 text-amber-700" />
          <h3 className="mt-3 text-sm font-black text-slate-900">Aperçu temporairement indisponible</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Corrigez les éléments signalés dans l’éditeur pour rétablir l’aperçu fidèle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto rounded-md border border-slate-900/10 bg-slate-100/80 p-3">
      <article className="mx-auto min-h-[46rem] max-w-[44rem] bg-white px-8 py-7 shadow-[0_18px_46px_rgba(15,23,42,0.12)]">
        <header className="border-t-2 border-emerald-800 pb-5 pt-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-orange-600">
                Aperçu exact du contenu
              </p>
              <h2 className="mt-1 font-serif text-xl font-black text-slate-950">{rendered.title}</h2>
              <p className="mt-1 text-[0.68rem] text-slate-500">Keur Gestion · Dakar</p>
            </div>
            {content.style.showLogo && (
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-900/10 bg-emerald-50">
                <FileCheck2 className="h-5 w-5 text-emerald-800" />
              </div>
            )}
          </div>
        </header>

        <div className="space-y-4">
          {rendered.blocks.map((block) => (
            <section key={block.id} className="break-inside-avoid">
              <h3 className="text-[0.68rem] font-black uppercase text-emerald-900">{block.title}</h3>
              {block.kind === 'system' ? (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
                  <span className="text-[0.62rem] text-slate-500">Donnée métier</span>
                  <span className="text-right text-[0.62rem] font-bold text-slate-700">
                    {block.systemKey?.replace(/_/g, ' ')}
                  </span>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-line text-[0.68rem] leading-[1.55] text-slate-700">
                  {block.content}
                </p>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-8 flex items-end justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-[0.58rem] text-slate-500">
            {content.style.showSignature && <Stamp className="h-4 w-4 text-emerald-700" />}
            <span>Document de prévisualisation · Données fictives</span>
          </div>
          {content.style.showQr && <QrCode className="h-8 w-8 text-slate-800" />}
        </footer>
      </article>
    </div>
  );
}
