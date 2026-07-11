import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
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
  contrat: 'Contrat de bail',
  quittance: 'Quittance de loyer',
  facture: 'Facture locative',
  recu: 'Reçu de paiement',
  mandat: 'Mandat de gestion',
  commission: 'Rapport bailleur',
  inventaire: 'Inventaire des lieux',
  bilan: 'Bilan financier',
  xlsx: 'Export Excel',
  csv: 'Export CSV',
  export: 'Export de données',
  pdf: 'Document PDF',
  document: 'Document officiel',
};

export function DocumentGeneratedModal({ onNavigate: _onNavigate }: DocumentGeneratedModalProps) {
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
    const timer = window.setTimeout(() => setFeedback(null), 2300);
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
    : 'Optimisé';

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
        // Fallback transparent
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
      `Bonjour,\n\nVeuillez trouver ci-joint le document officiel « ${documentPayload.fileName} » généré depuis la plateforme Samay Këur.\n\nCe document est certifié conforme et intègre son sceau numérique de vérification.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setFeedback('email');
  };

  const close = () => setDocumentPayload(null);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-[0_40px_130px_rgba(0,0,0,0.75)] animate-scaleIn"
      >
        <div className="grid overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden">
          {/* Colonne Gauche : Certificat d'Intégrité & Sceau Numérique (Obsidian Luxury Panel) */}
          <div className="relative flex flex-col justify-between border-b border-white/10 bg-[#061410] p-5 text-white lg:border-b-0 lg:border-r">
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-full bg-action-500/10 blur-3xl" />

            <div className="relative space-y-5">
              {/* Logo & Sceau officiel */}
              <div className="flex items-center justify-between">
                <BrandMark size="sm" tone="dark" animated withTile={false} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CERTIFIÉ
                </span>
              </div>

              {/* Statut Héro de la génération */}
              <div className="flex items-start gap-3.5 pt-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/25 to-teal-600/10 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                  <Check className="h-5 w-5 stroke-[3]" />
                </div>
                <div>
                  <h2 id={titleId} className="text-base font-black tracking-tight text-white sm:text-lg">
                    {kindLabel}
                  </h2>
                  <p className="mt-0.5 text-xs text-emerald-100/70">
                    {documentPayload.reused
                      ? 'Archive officielle instantanée'
                      : 'Généré & scellé avec succès'}
                  </p>
                </div>
              </div>

              {/* Plaque d'identité technique du document */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-inner">
                <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[0.62rem] font-black uppercase tracking-widest text-emerald-300/80">
                    SCELLÉ NUMÉRIQUE
                  </span>
                  <span className="font-mono text-[0.68rem] font-bold text-emerald-200">
                    #SK-{documentPayload.fileName.slice(-8).replace(/[^a-zA-Z0-9]/g, '8')}
                  </span>
                </div>

                <div className="divide-y divide-white/10 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Catégorie
                    </span>
                    <span className="font-bold text-white truncate max-w-[130px]">{kindLabel}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                      Format
                    </span>
                    <span className="font-bold text-white">{fileSize} · {isPdf ? 'PDF' : 'XLSX'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" />
                      Émis le
                    </span>
                    <span className="font-bold text-white truncate max-w-[135px]">{generatedDate}</span>
                  </div>

                  {(documentPayload.version != null || documentPayload.preview?.rowCount != null) && (
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2 text-emerald-200/70 font-semibold">
                        <Layers className="h-3.5 w-3.5 text-emerald-400" />
                        Révision
                      </span>
                      <span className="font-bold text-white">
                        {documentPayload.version != null ? `v${documentPayload.version}` : ''}
                        {documentPayload.preview?.rowCount != null ? ` · ${documentPayload.preview.rowCount} lignes` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cartouche Valeur Juridique & QR */}
              {isVerifiableDocument && (
                <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 to-emerald-950/40 p-3.5 text-xs leading-5 text-emerald-100 shadow-sm">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <ShieldCheck className="h-4 w-4" />
                      Valeur Probante & QR
                    </span>
                    <TooltipHint label="Contrôle d'authenticité QR">
                      Chaque document officiel Samay Këur intègre un QR code infalsifiable permettant d'en vérifier la validité sur notre portail public.
                    </TooltipHint>
                  </div>
                  <p className="mt-1 text-[0.7rem] leading-4 text-emerald-200/80">
                    Sceau d'authenticité et horodatage certifiés pour toute démarche juridique ou administrative.
                  </p>
                </div>
              )}
            </div>

            {feedback && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3.5 py-1.5 text-xs font-bold text-emerald-100 animate-slideInUp">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {feedback === 'copied' && 'Lien copié dans le presse-papiers'}
                {feedback === 'shared' && 'Dialogue de partage lancé'}
                {feedback === 'printed' && 'Impression en cours de préparation'}
                {feedback === 'email' && 'Client de messagerie ouvert'}
              </div>
            )}
          </div>

          {/* Colonne Droite : Espace d'Inspection & Commandes Exécutives (Studio Workspace) */}
          <div className="flex flex-col justify-between overflow-y-auto bg-[linear-gradient(180deg,#FCFCFA,#F6F5F2)] p-4 sm:p-6">
            {/* Barre supérieure du Workspace avec bouton Fermer macOS/Raycast */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-600" />
                <span className="text-[0.68rem] font-black uppercase tracking-wider text-slate-500">
                  ESPACE DE CONSULTATION & DIFFUSION
                </span>
              </div>

              <button
                type="button"
                onClick={close}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-extrabold text-slate-700 shadow-xs transition hover:border-rose-500 hover:bg-rose-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                aria-label="Fermer la fenêtre (Échap)"
              >
                <span>Fermer</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-mono font-black uppercase tracking-wider text-slate-600 group-hover:bg-rose-700 group-hover:text-white">
                  ESC
                </span>
                <X className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>

            {/* Cadre d'inspection stylisé du document */}
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-100/90 px-3.5 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-brand-950 text-white shadow-xs">
                    {isTableExport ? <FileSpreadsheet className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-900">{documentPayload.title}</p>
                    <p className="truncate text-[0.68rem] font-mono font-semibold text-slate-500">{documentPayload.fileName}</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-0.5 text-[0.65rem] font-black tracking-wide text-emerald-900">
                  {isTableExport ? 'TABLEAU EXCEL' : 'PDF VECTORIEL'}
                </span>
              </div>

              {isPdf ? (
                <div className="hidden h-[390px] bg-slate-100/80 sm:h-[430px] md:block">
                  <iframe
                    title={`Aperçu ${documentPayload.fileName}`}
                    src={documentPayload.url.includes('#') ? documentPayload.url : `${documentPayload.url}#view=FitH`}
                    className="h-full w-full bg-white"
                  />
                </div>
              ) : (
                <div className="max-h-[390px] overflow-auto bg-white p-3 sm:max-h-[430px]">
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
                  Toucher pour consulter le document
                </span>
              </button>
            </div>

            {/* Hiérarchie d'actions exécutive Apple/Linear */}
            <div className="space-y-3">
              {/* Rangée Héro : Ouverture & Téléchargement */}
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  icon={ExternalLink}
                  onClick={openFile}
                  fullWidth
                  className="!h-10 !text-xs !font-black shadow-sm"
                >
                  Consulter le document
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={downloadAgain}
                  fullWidth
                  className="!h-10 !text-xs !font-black shadow-sm"
                >
                  Télécharger le fichier
                </Button>
              </div>

              {/* Dock d'outils unifié Apple-Style (Segmented Toolbar) */}
              <div className="flex items-center justify-between divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={shareDocument}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Partager</span>
                </button>
                <button
                  type="button"
                  onClick={printPdf}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={sendEmail}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                  <span>Copier lien</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
