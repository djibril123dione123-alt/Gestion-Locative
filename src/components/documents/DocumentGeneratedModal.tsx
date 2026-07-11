import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Mail,
  Printer,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DOCUMENT_GENERATED_EVENT,
  GeneratedDocumentPayload,
} from '../../lib/documentGenerated';
import { BrandMark } from '../brand/BrandLogo';
import { Button } from '../ui/Button';
import { TooltipHint } from '../onboarding/TooltipHint';

interface DocumentGeneratedModalProps {
  onNavigate?: (page: string) => void;
}

type Feedback = 'copied' | 'shared' | 'printed' | 'email' | null;

const KIND_LABELS: Partial<Record<GeneratedDocumentPayload['kind'], string>> = {
  contrat: 'Contrat',
  quittance: 'Quittance',
  facture: 'Facture',
  recu: 'Reçu',
  mandat: 'Mandat',
  commission: 'Rapport',
  inventaire: 'Inventaire',
  bilan: 'Bilan',
  xlsx: 'Export Excel',
  csv: 'Export CSV',
  export: 'Export',
  pdf: 'PDF',
  document: 'Document',
};

export function DocumentGeneratedModal({ onNavigate }: DocumentGeneratedModalProps) {
  const [documentPayload, setDocumentPayload] = useState<GeneratedDocumentPayload | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const handleGeneratedDocument = (event: Event) => {
      const detail = (event as CustomEvent<GeneratedDocumentPayload>).detail;
      if (!detail?.url || !detail.fileName) return;
      setDocumentPayload(detail);
      setFeedback(null);
    };

    window.addEventListener(DOCUMENT_GENERATED_EVENT, handleGeneratedDocument);
    return () => window.removeEventListener(DOCUMENT_GENERATED_EVENT, handleGeneratedDocument);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const generatedDate = useMemo(() => {
    if (!documentPayload?.generatedAt) return '';
    return new Date(documentPayload.generatedAt).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [documentPayload?.generatedAt]);

  if (!documentPayload) return null;

  const kindLabel = KIND_LABELS[documentPayload.kind] ?? 'Document';
  const titleId = 'document-generated-title';
  const isPdf = (documentPayload.mimeType ?? '').includes('pdf') || documentPayload.fileName.toLowerCase().endsWith('.pdf');
  const isTableExport = ['xlsx', 'csv', 'export'].includes(documentPayload.kind);
  const isVerifiableDocument = ['contrat', 'quittance', 'facture', 'mandat', 'recu'].includes(documentPayload.kind);
  const fileSize = documentPayload.fileSize
    ? `${(documentPayload.fileSize / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`
    : 'Calcul local';

  const downloadAgain = () => {
    const link = window.document.createElement('a');
    link.href = documentPayload.url;
    link.download = documentPayload.fileName;
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const openFile = () => {
    window.open(documentPayload.url, '_blank', 'noopener,noreferrer');
  };

  const printPdf = () => {
    if (!isPdf) {
      downloadAgain();
      return;
    }
    const pdfWindow = window.open(documentPayload.url, '_blank', 'noopener,noreferrer');
    if (!pdfWindow) return;
    setFeedback('printed');
    window.setTimeout(() => {
      try {
        pdfWindow.focus();
        pdfWindow.print();
      } catch {
        // Some browsers block direct print on blob windows; opening the PDF is still useful.
      }
    }, 500);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(documentPayload.url);
      setFeedback('copied');
    } catch {
      downloadAgain();
    }
  };

  const shareDocument = async () => {
    const shareText = `${documentPayload.title} - ${documentPayload.fileName}`;
    try {
      if (navigator.share) {
        if (documentPayload.blob) {
          const file = new File([documentPayload.blob], documentPayload.fileName, {
            type: documentPayload.mimeType ?? 'application/pdf',
          });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({ title: documentPayload.title, text: shareText, files: [file] });
          } else {
            await navigator.share({ title: documentPayload.title, text: shareText, url: documentPayload.url });
          }
        } else {
          await navigator.share({ title: documentPayload.title, text: shareText, url: documentPayload.url });
        }
        setFeedback('shared');
        return;
      }
      await navigator.clipboard.writeText(documentPayload.url);
      setFeedback('copied');
    } catch {
      // User cancelled native share sheet
    }
  };

  const sendEmail = () => {
    const subject = encodeURIComponent(documentPayload.title);
    const body = encodeURIComponent(
      `Bonjour,\n\nLe document ${documentPayload.fileName} vient d'être généré depuis Samay Këur.\n\nLe fichier a été téléchargé automatiquement. Vous pouvez aussi l'ouvrir depuis l'application avant de l'envoyer en pièce jointe.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setFeedback('email');
  };

  const close = () => setDocumentPayload(null);

  const goDashboard = () => {
    onNavigate?.('dashboard');
    close();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-md sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-[#06130f] shadow-[0_30px_100px_rgba(0,0,0,0.65)] animate-scaleIn lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden"
      >
        {/* Bouton de fermeture à contraste élevé, hyper-visible */}
        <button
          type="button"
          onClick={close}
          className="absolute right-3.5 top-3.5 z-30 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/95 px-3.5 py-1.5 text-xs font-black text-white shadow-lg transition hover:border-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400"
          aria-label="Fermer la fenêtre"
        >
          <span>Fermer</span>
          <X className="h-3.5 w-3.5 stroke-[3]" />
        </button>

        {/* Colonne Gauche : Résumé Compact & Métadonnées */}
        <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(155deg,rgba(13,27,22,0.98),rgba(8,17,14,0.92))] p-4 text-white sm:p-5 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute -left-16 -top-20 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-36 w-36 rounded-full bg-action-500/12 blur-3xl" />

          <div className="relative flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <BrandMark size="sm" tone="dark" animated withTile={false} />
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-action-300">
                    {documentPayload.reused ? 'Archive retrouvée' : isTableExport ? 'Export prêt' : 'Document prêt'}
                  </p>
                  <p className="text-[0.7rem] text-emerald-100/70">
                    {documentPayload.reused ? 'Version existante réutilisée' : 'Téléchargement réussi'}
                  </p>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-400/20 text-emerald-300">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <h2 id={titleId} className="text-base font-black tracking-tight text-white sm:text-lg">
                  {documentPayload.reused ? `${kindLabel} déjà généré` : `${kindLabel} généré`}
                </h2>
              </div>

              <p className="text-[0.75rem] leading-5 text-emerald-50/75">
                {documentPayload.reused ? (
                  <>
                    Le fichier <span className="font-bold text-white">{documentPayload.fileName}</span> est déjà présent dans l'archive.
                  </>
                ) : (
                  <>
                    Le fichier <span className="font-bold text-white">{documentPayload.fileName}</span> est prêt.
                  </>
                )}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-wider text-emerald-200/70">Type</p>
                  <p className="mt-0.5 font-bold text-white truncate">{kindLabel}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-wider text-emerald-200/70">Taille</p>
                  <p className="mt-0.5 font-bold text-white truncate">{fileSize}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5 col-span-2">
                  <p className="text-[0.62rem] font-black uppercase tracking-wider text-emerald-200/70">Généré le</p>
                  <p className="mt-0.5 font-bold text-white truncate">{generatedDate}</p>
                </div>
                {documentPayload.version != null && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                    <p className="text-[0.62rem] font-black uppercase tracking-wider text-emerald-200/70">Version</p>
                    <p className="mt-0.5 font-bold text-white">v{documentPayload.version}</p>
                  </div>
                )}
                {documentPayload.preview?.rowCount != null && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                    <p className="text-[0.62rem] font-black uppercase tracking-wider text-emerald-200/70">Lignes</p>
                    <p className="mt-0.5 font-bold text-white">{documentPayload.preview.rowCount}</p>
                  </div>
                )}
              </div>

              {isVerifiableDocument && (
                <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50/85">
                  <p className="font-bold text-white flex items-center justify-between">
                    <span>QR de vérification</span>
                    <TooltipHint label="Comprendre le QR de vérification">
                      Le QR ouvre une page publique de contrôle pour confirmer la référence, le type de document et son authenticité.
                    </TooltipHint>
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-emerald-100/75">
                    Preuve documentaire vérifiable instantanément après partage.
                  </p>
                </div>
              )}
            </div>

            {feedback && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/15 px-3 py-1.5 text-xs font-bold text-emerald-100 animate-slideInUp">
                <Sparkles className="h-3.5 w-3.5 text-action-300" />
                {feedback === 'copied' && 'Lien copié'}
                {feedback === 'shared' && 'Partage lancé'}
                {feedback === 'printed' && 'Impression lancée'}
                {feedback === 'email' && 'Email ouvert'}
              </div>
            )}
          </div>
        </div>

        {/* Colonne Droite : Prévisualisation compacte & Actions rapides */}
        <div className="flex flex-col justify-between overflow-y-auto bg-[linear-gradient(180deg,rgba(250,247,239,0.99),rgba(242,237,227,0.96))] p-4 sm:p-5">
          <div className="mb-4 overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-[0_12px_32px_rgba(6,17,13,0.08)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-950 text-white">
                  {isTableExport ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-950">{documentPayload.title}</p>
                  <p className="truncate text-[0.68rem] font-semibold text-slate-500">{documentPayload.fileName}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.68rem] font-black text-brand-800">
                {isTableExport ? 'EXPORT' : 'PDF'}
              </span>
            </div>

            {isPdf ? (
              <div className="hidden h-[250px] bg-slate-100 md:block">
                <iframe
                  title={`Aperçu ${documentPayload.fileName}`}
                  src={documentPayload.url}
                  className="h-full w-full bg-white"
                />
              </div>
            ) : (
              <div className="max-h-[250px] overflow-auto bg-white p-3">
                {documentPayload.preview?.stats?.length ? (
                  <div className="mb-3 grid gap-2 sm:grid-cols-3">
                    {documentPayload.preview.stats.map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-emerald-900/10 bg-emerald-50/70 p-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-brand-700">{stat.label}</p>
                        <p className="mt-0.5 text-sm font-black text-slate-950">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {documentPayload.preview?.rows?.length ? (
                  <table className="min-w-full overflow-hidden rounded-lg text-left text-xs">
                    <thead className="bg-brand-950 text-white">
                      <tr>
                        {documentPayload.preview.columns.slice(0, 6).map((column) => (
                          <th key={column} className="px-2.5 py-1.5 text-[0.68rem] font-black uppercase tracking-wide">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documentPayload.preview.rows.map((row, index) => (
                        <tr key={index} className="bg-white">
                          {documentPayload.preview?.columns.slice(0, 6).map((column) => (
                            <td key={column} className="max-w-[10rem] truncate px-2.5 py-1.5 font-semibold text-slate-700">
                              {row[column] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center text-center">
                    <FileSpreadsheet className="h-8 w-8 text-brand-700" />
                    <p className="mt-2 text-xs font-bold text-slate-700">Export prêt à ouvrir dans Excel.</p>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={openFile}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-white text-center md:hidden"
            >
              <div className="rounded-xl bg-emerald-50 p-3 text-brand-800">
                <FileText className="h-7 w-7" />
              </div>
              <span className="max-w-[14rem] text-xs font-bold text-slate-700">
                Touchez pour ouvrir le fichier
              </span>
            </button>
          </div>

          {/* Grille d'actions compacte et dé-zoomée */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="success" size="sm" icon={ExternalLink} onClick={openFile} fullWidth>
                Ouvrir le fichier
              </Button>
              <Button type="button" variant="primary" size="sm" icon={Download} onClick={downloadAgain} fullWidth>
                Télécharger à nouveau
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <Button type="button" variant="secondary" size="sm" icon={Share2} onClick={shareDocument} fullWidth className="!px-2 !text-xs">
                Partager
              </Button>
              <Button type="button" variant="secondary" size="sm" icon={Printer} onClick={printPdf} fullWidth className="!px-2 !text-xs">
                Imprimer
              </Button>
              <Button type="button" variant="secondary" size="sm" icon={Mail} onClick={sendEmail} fullWidth className="!px-2 !text-xs">
                Par email
              </Button>
              <Button type="button" variant="secondary" size="sm" icon={Copy} onClick={copyLink} fullWidth className="!px-2 !text-xs">
                Copier lien
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-xs">
              <button
                type="button"
                onClick={goDashboard}
                className="flex items-center gap-1.5 font-bold text-slate-600 hover:text-brand-900 transition"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Tableau de bord</span>
              </button>
              <button
                type="button"
                onClick={close}
                className="flex items-center gap-1.5 font-extrabold text-brand-800 hover:text-brand-950 transition"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>Nouveau document</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
