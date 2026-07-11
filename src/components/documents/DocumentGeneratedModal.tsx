import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
  LayoutDashboard,
  Mail,
  Printer,
  Share2,
  ShieldCheck,
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
  commission: 'Rapport bailleur',
  inventaire: 'Inventaire',
  bilan: 'Bilan financier',
  xlsx: 'Export Excel',
  csv: 'Export CSV',
  export: 'Export données',
  pdf: 'Document PDF',
  document: 'Document officiel',
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
    if (!documentPayload) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDocumentPayload(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentPayload]);

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

  const kindLabel = KIND_LABELS[documentPayload.kind] ?? 'Document officiel';
  const titleId = 'document-generated-title';
  const isPdf = (documentPayload.mimeType ?? '').includes('pdf') || documentPayload.fileName.toLowerCase().endsWith('.pdf');
  const isTableExport = ['xlsx', 'csv', 'export'].includes(documentPayload.kind);
  const isVerifiableDocument = ['contrat', 'quittance', 'facture', 'mandat', 'recu', 'commission'].includes(documentPayload.kind);
  const fileSize = documentPayload.fileSize
    ? `${(documentPayload.fileSize / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`
    : 'Optimum';

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
        // Some browsers block direct print on blob windows
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
      `Bonjour,\n\nLe document ${documentPayload.fileName} vient d'être généré et certifié depuis Samay Këur.\n\nVous trouverez le fichier en pièce jointe ou consultable en toute sécurité.\n`
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#06130f] shadow-[0_35px_120px_rgba(0,0,0,0.7)] animate-scaleIn"
      >
        {/* Barre d'en-tête unifiée et élégante avec bouton Fermer bien distinct */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#071713] px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" tone="dark" animated withTile={false} />
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-emerald-300">
                {documentPayload.reused ? 'ARCHIVE CERTIFIÉE RETROUVÉE' : 'DOCUMENT GÉNÉRÉ & SCELLÉ'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-bold text-white shadow-sm transition hover:border-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400"
            aria-label="Fermer la fenêtre (Échap)"
          >
            <span>Fermer</span>
            <span className="hidden rounded bg-white/15 px-1.5 py-0.2 text-[9px] font-mono font-black uppercase tracking-wider text-white/90 sm:inline-block">
              ESC
            </span>
            <X className="h-3.5 w-3.5 stroke-[3]" />
          </button>
        </div>

        {/* Contenu Principal en 2 Colonnes */}
        <div className="grid overflow-y-auto lg:grid-cols-[290px_minmax(0,1fr)] lg:overflow-hidden">
          {/* Colonne Gauche : Certificat d'Identité & Métadonnées Premium */}
          <div className="relative flex flex-col justify-between border-b border-white/10 bg-[linear-gradient(160deg,rgba(11,26,21,0.98),rgba(6,15,12,0.96))] p-4 text-white sm:p-5 lg:border-b-0 lg:border-r">
            <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" />

            <div className="space-y-4">
              {/* Titre & Macaron */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.18)]">
                  <Check className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 id={titleId} className="text-base font-black tracking-tight text-white sm:text-lg">
                    {kindLabel}
                  </h2>
                  <p className="mt-0.5 text-xs text-emerald-200/70">
                    {documentPayload.reused ? 'Version officielle archivée' : 'Document vérifié et disponible'}
                  </p>
                </div>
              </div>

              {/* Table de spécifications Premium */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 shadow-inner">
                <div className="divide-y divide-white/10 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Type
                    </span>
                    <span className="font-bold text-white truncate max-w-[130px]">{kindLabel}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                      Poids & Format
                    </span>
                    <span className="font-bold text-white">{fileSize} · {isPdf ? 'PDF' : 'XLSX'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" />
                      Horodatage
                    </span>
                    <span className="font-bold text-white truncate max-w-[135px]">{generatedDate}</span>
                  </div>

                  {(documentPayload.version != null || documentPayload.preview?.rowCount != null) && (
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                        <Layers className="h-3.5 w-3.5 text-emerald-400" />
                        Spécification
                      </span>
                      <span className="font-bold text-white">
                        {documentPayload.version != null ? `v${documentPayload.version}` : ''}
                        {documentPayload.preview?.rowCount != null ? ` · ${documentPayload.preview.rowCount} lignes` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Encadré d'authenticité juridique QR */}
              {isVerifiableDocument && (
                <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 to-emerald-950/40 p-3 text-xs leading-5 text-emerald-100 shadow-sm">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <ShieldCheck className="h-4 w-4" />
                      Certifié & Vérifiable
                    </span>
                    <TooltipHint label="Contrôle d'authenticité QR">
                      Chaque document officiel Samay Këur intègre un QR code permettant de contrôler son authenticité en ligne.
                    </TooltipHint>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-emerald-200/80">
                    Sceau d'intégrité inclus pour les contrôles de conformité en ligne.
                  </p>
                </div>
              )}
            </div>

            {feedback && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3.5 py-1.5 text-xs font-bold text-emerald-100 animate-slideInUp">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {feedback === 'copied' && 'Lien copié dans le presse-papiers'}
                {feedback === 'shared' && 'Dialogue de partage ouvert'}
                {feedback === 'printed' && 'Impression en cours de préparation'}
                {feedback === 'email' && 'Client de messagerie ouvert'}
              </div>
            )}
          </div>

          {/* Colonne Droite : Studio Documentaire & Actions de Direction */}
          <div className="flex flex-col justify-between overflow-y-auto bg-[linear-gradient(180deg,#f8f6f0,#f2eee5)] p-4 sm:p-5">
            {/* Cadre d'inspection stylisé du document */}
            <div className="mb-4 overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-100/95 px-3.5 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-brand-950 text-white shadow-xs">
                    {isTableExport ? <FileSpreadsheet className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-900">{documentPayload.title}</p>
                    <p className="truncate text-[0.68rem] font-mono font-semibold text-slate-500">{documentPayload.fileName}</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.65rem] font-black tracking-wide text-emerald-800">
                  {isTableExport ? 'TABLEAU EXCEL' : 'PDF VECTORIEL'}
                </span>
              </div>

              {isPdf ? (
                <div className="hidden h-[245px] bg-slate-100/80 md:block">
                  <iframe
                    title={`Aperçu ${documentPayload.fileName}`}
                    src={documentPayload.url}
                    className="h-full w-full bg-white"
                  />
                </div>
              ) : (
                <div className="max-h-[245px] overflow-auto bg-white p-3">
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
                    <div className="flex h-36 flex-col items-center justify-center text-center">
                      <FileSpreadsheet className="h-8 w-8 text-brand-700" />
                      <p className="mt-2 text-xs font-bold text-slate-700">Export structuré prêt à ouvrir dans Excel.</p>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={openFile}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 bg-white text-center md:hidden"
              >
                <div className="rounded-xl bg-emerald-50 p-2.5 text-brand-800">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="max-w-[14rem] text-xs font-bold text-slate-700">
                  Toucher pour ouvrir le document
                </span>
              </button>
            </div>

            {/* Actions exécutives structurées */}
            <div className="space-y-3">
              {/* Rangée Principale : Ouvrir / Télécharger */}
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  icon={ExternalLink}
                  onClick={openFile}
                  fullWidth
                  className="!h-9 !text-xs !font-bold shadow-sm"
                >
                  Ouvrir le fichier
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={downloadAgain}
                  fullWidth
                  className="!h-9 !text-xs !font-bold shadow-sm"
                >
                  Télécharger à nouveau
                </Button>
              </div>

              {/* Toolbar rapide unifiée */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-300/60 bg-white/90 p-1.5 shadow-2xs sm:grid-cols-4">
                <button
                  type="button"
                  onClick={shareDocument}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Partager</span>
                </button>
                <button
                  type="button"
                  onClick={printPdf}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={sendEmail}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Par email</span>
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                  <span>Copier lien</span>
                </button>
              </div>

              {/* Navigation de pied de page fine */}
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-xs">
                <button
                  type="button"
                  onClick={goDashboard}
                  className="flex items-center gap-1.5 font-bold text-slate-500 transition hover:text-brand-900"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Tableau de bord</span>
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="flex items-center gap-1.5 font-extrabold text-brand-800 transition hover:text-brand-950"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>Nouveau document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
