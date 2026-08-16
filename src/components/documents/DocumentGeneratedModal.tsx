import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Mail,
  Printer,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { GeneratedDocumentPayload } from '../../lib/documentGenerated';
import { useDocumentGeneration } from '../../hooks/useDocumentGeneration';
import { BrandMark } from '../brand/BrandLogo';
import { Button } from '../ui/Button';
import { DocumentGenerationProgress } from './DocumentGenerationProgress';

interface DocumentGeneratedModalProps {
  onNavigate?: (page: string) => void;
}

type Feedback = 'copied' | 'shared' | 'printed' | 'email' | null;

const KIND_LABELS: Partial<Record<GeneratedDocumentPayload['kind'], string>> = {
  contrat: 'Contrat de location',
  quittance: 'Quittance de loyer',
  facture: 'Facture',
  recu: 'Reçu de paiement',
  mandat: 'Mandat de gestion',
  commission: 'Rapport bailleur',
  inventaire: 'Inventaire',
  bilan: 'Bilan financier',
  xlsx: 'Export Excel',
  csv: 'Export CSV',
  export: 'Export de données',
  pdf: 'Document PDF',
  document: 'Document',
};

function formatFileSize(bytes?: number) {
  if (!bytes) return 'PDF optimisé';
  return `${(bytes / 1024).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  })} Ko`;
}

export function DocumentGeneratedModal({
  onNavigate,
}: DocumentGeneratedModalProps) {
  const { session, close } = useDocumentGeneration();
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!session?.visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, session?.visible]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2300);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const generatedDate = useMemo(() => {
    if (!session?.payload?.generatedAt) return '';
    return new Date(session.payload.generatedAt).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [session?.payload?.generatedAt]);

  if (!session?.visible) return null;

  const payload = session.payload;
  const isReady = session.state === 'ready' && Boolean(payload);
  const isError = session.state === 'error';
  const kindLabel = KIND_LABELS[session.kind] ?? 'Document';
  const titleId = 'document-generation-title';
  const isPdf = Boolean(
    payload &&
      ((payload.mimeType ?? '').includes('pdf') ||
        payload.fileName.toLowerCase().endsWith('.pdf')),
  );
  const isTableExport = ['xlsx', 'csv', 'export'].includes(session.kind);
  const archiveReady = session.archiveStatus === 'ready';
  const archiveIncomplete = session.archiveStatus === 'incomplete';
  const verificationActive = session.verificationStatus === 'active';
  const verificationUnavailable =
    session.verificationStatus === 'unavailable';

  const downloadAgain = () => {
    if (!payload) return;
    const link = window.document.createElement('a');
    link.href = payload.url;
    link.download = payload.fileName;
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const openFile = () => {
    if (payload) window.open(payload.url, '_blank', 'noopener,noreferrer');
  };

  const printPdf = () => {
    if (!payload) return;
    if (!isPdf) {
      downloadAgain();
      return;
    }
    const pdfWindow = window.open(payload.url, '_blank', 'noopener,noreferrer');
    if (!pdfWindow) return;
    setFeedback('printed');
    window.setTimeout(() => {
      try {
        pdfWindow.focus();
        pdfWindow.print();
      } catch {
        // The document remains available if browser printing is restricted.
      }
    }, 500);
  };

  const copyLink = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.url);
      setFeedback('copied');
    } catch {
      downloadAgain();
    }
  };

  const shareDocument = async () => {
    if (!payload) return;
    try {
      if (navigator.share) {
        const shareData: ShareData = {
          title: payload.title,
          text: `${payload.title} - ${payload.fileName}`,
          url: payload.url,
        };
        if (payload.blob) {
          const file = new File([payload.blob], payload.fileName, {
            type: payload.mimeType ?? 'application/pdf',
          });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            delete shareData.url;
            shareData.files = [file];
          }
        }
        await navigator.share(shareData);
        setFeedback('shared');
        return;
      }
      await navigator.clipboard.writeText(payload.url);
      setFeedback('copied');
    } catch {
      // Native share cancellation does not require an error message.
    }
  };

  const sendEmail = () => {
    if (!payload) return;
    const subject = encodeURIComponent(payload.title);
    const trustText = verificationActive
      ? 'Son QR de vérification Samay Këur est actif.'
      : archiveReady
        ? 'Le document est enregistré dans le registre documentaire.'
        : 'Le document est prêt à être consulté.';
    const body = encodeURIComponent(
      `Bonjour,\n\nLe document « ${payload.fileName} » a été généré depuis Samay Këur.\n${trustText}\n`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setFeedback('email');
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={!isReady && !isError}
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-[0_40px_130px_rgba(0,0,0,0.72)] motion-safe:animate-scaleIn"
      >
        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden">
          <aside className="relative flex min-h-[220px] flex-col justify-between overflow-hidden border-b border-white/10 bg-[#061b15] p-5 text-white lg:min-h-[600px] lg:border-b-0 lg:border-r">
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <BrandMark size="sm" tone="dark" animated withTile={false} />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                    isError
                      ? 'border-rose-300/30 bg-rose-400/10 text-rose-200'
                      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isError
                        ? 'bg-rose-300'
                        : isReady
                          ? 'bg-emerald-300'
                          : 'bg-emerald-300 motion-safe:animate-pulse'
                    }`}
                  />
                  {isError
                    ? 'À reprendre'
                    : isReady
                      ? archiveReady
                        ? 'Document enregistré'
                        : 'Document prêt'
                      : 'Préparation sécurisée'}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    isError
                      ? 'border-rose-300/30 bg-rose-400/10 text-rose-200'
                      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                  }`}
                >
                  {isError ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : isReady ? (
                    <Check className="h-5 w-5 stroke-[3]" />
                  ) : (
                    <FileText className="h-5 w-5 motion-safe:animate-pulse motion-reduce:animate-none" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-base font-black tracking-normal text-white sm:text-lg"
                  >
                    {isReady ? kindLabel : session.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                    {session.reference
                      ? `Référence ${session.reference}`
                      : 'Préparation sécurisée du document'}
                  </p>
                </div>
              </div>

              {isReady && payload ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
                  <p className="truncate text-xs font-black text-white">
                    {payload.fileName}
                  </p>
                  <dl className="mt-3 divide-y divide-white/10 text-xs">
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-emerald-100/60">Format</dt>
                      <dd className="font-bold text-white">
                        {formatFileSize(payload.fileSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-emerald-100/60">Préparé le</dt>
                      <dd className="text-right font-bold text-white">
                        {generatedDate}
                      </dd>
                    </div>
                    {payload.version != null && (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="text-emerald-100/60">Version</dt>
                        <dd className="font-bold text-white">
                          v{payload.version}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : null}

              {isReady && (archiveReady || verificationActive) ? (
                <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3.5 text-xs leading-5 text-emerald-50">
                  <p className="flex items-center gap-2 font-black">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Intégrité documentaire
                  </p>
                  <p className="mt-1 text-emerald-100/75">
                    {verificationActive
                      ? 'QR de vérification actif. Empreinte et référence enregistrées.'
                      : 'Document enregistré dans le registre Samay Këur.'}
                  </p>
                </div>
              ) : null}

              {isReady &&
              (archiveIncomplete || verificationUnavailable) ? (
                <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3.5 text-xs leading-5 text-amber-50">
                  <p className="flex items-center gap-2 font-black">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                    Vérification incomplète
                  </p>
                  <p className="mt-1 text-amber-100/75">
                    Le PDF est consultable, mais son archivage ou sa vérification
                    n’est pas confirmé. Il n’est pas présenté comme enregistré.
                  </p>
                </div>
              ) : null}
            </div>

            {feedback && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-50">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {feedback === 'copied' && 'Lien copié'}
                {feedback === 'shared' && 'Partage ouvert'}
                {feedback === 'printed' && 'Impression préparée'}
                {feedback === 'email' && 'Messagerie ouverte'}
              </div>
            )}
          </aside>

          <main className="flex min-h-[420px] flex-col bg-[#fbfaf7]">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                <span className="truncate text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Consultation documentaire
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
              {!isReady && !isError ? (
                <DocumentGenerationProgress session={session} />
              ) : null}

              {isError ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-5 text-center shadow-sm">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950">
                      La génération n’a pas pu être terminée
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                      {archiveIncomplete
                        ? 'Le PDF a été composé, mais son enregistrement documentaire n’a pas abouti. Il n’est pas présenté comme enregistré ni vérifiable.'
                        : 'Aucune version incomplète n’a été publiée.'}
                    </p>
                    {session.error ? (
                      <p className="mt-2 text-xs font-semibold text-rose-700">
                        {session.error}
                      </p>
                    ) : null}
                    <div className="mt-5 flex justify-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={close}
                      >
                        Fermer
                      </Button>
                      {session.retry ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={RefreshCw}
                          onClick={() => void session.retry?.()}
                        >
                          Réessayer
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {isReady && payload ? (
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div
                      className={`flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 ${
                        isPdf ? 'md:hidden' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-white">
                          {isTableExport ? (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-950">
                            {payload.title}
                          </p>
                          <p className="truncate text-[10px] font-semibold text-slate-500">
                            {payload.fileName}
                          </p>
                        </div>
                      </div>
                      <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-900 sm:inline-flex">
                        {isTableExport ? 'Tableau' : 'PDF'}
                      </span>
                    </div>

                    {isPdf ? (
                      <div className="hidden min-h-[390px] flex-1 bg-slate-100 md:flex">
                        <iframe
                          title={`Aperçu ${payload.fileName}`}
                          src={
                            payload.url.includes('#')
                              ? payload.url
                              : `${payload.url}#view=FitH`
                          }
                          className="h-full w-full bg-white"
                        />
                      </div>
                    ) : (
                      <div className="max-h-[390px] overflow-auto p-3">
                        {payload.preview?.rows?.length ? (
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-emerald-950 text-white">
                              <tr>
                                {payload.preview.columns
                                  .slice(0, 6)
                                  .map((column) => (
                                    <th
                                      key={column}
                                      className="px-2.5 py-2 text-[10px] font-black uppercase"
                                    >
                                      {column}
                                    </th>
                                  ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {payload.preview.rows.map((row, index) => (
                                <tr key={index}>
                                  {payload.preview?.columns
                                    .slice(0, 6)
                                    .map((column) => (
                                      <td
                                        key={column}
                                        className="max-w-[10rem] truncate px-2.5 py-2 font-semibold text-slate-700"
                                      >
                                        {row[column] ?? '—'}
                                      </td>
                                    ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex h-44 flex-col items-center justify-center text-center">
                            <FileSpreadsheet className="h-8 w-8 text-emerald-800" />
                            <p className="mt-2 text-xs font-bold text-slate-700">
                              Export structuré prêt à consulter.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={openFile}
                      className="flex h-56 w-full flex-col items-center justify-center gap-2 bg-white text-center md:hidden"
                    >
                      <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
                        <FileCheck className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        Ouvrir le document
                      </span>
                    </button>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        icon={ExternalLink}
                        onClick={openFile}
                        fullWidth
                        className="!h-10 !text-xs !font-black"
                      >
                        Consulter
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Download}
                        onClick={downloadAgain}
                        fullWidth
                        className="!h-10 !text-xs !font-black"
                      >
                        Télécharger
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {[
                        [Share2, 'Partager', shareDocument],
                        [Printer, 'Imprimer', printPdf],
                        [Mail, 'Email', sendEmail],
                        [Copy, 'Lien', copyLink],
                      ].map(([Icon, label, action]) => {
                        const ActionIcon = Icon as typeof Share2;
                        return (
                          <button
                            key={label as string}
                            type="button"
                            onClick={action as () => void}
                            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:flex-row sm:text-xs"
                          >
                            <ActionIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{label as string}</span>
                          </button>
                        );
                      })}
                    </div>
                    {onNavigate ? (
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          onNavigate('documents');
                        }}
                        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900 hover:underline"
                      >
                        <HardDrive className="h-3.5 w-3.5" />
                        Ouvrir le registre documentaire
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </section>
    </div>
  );
}
