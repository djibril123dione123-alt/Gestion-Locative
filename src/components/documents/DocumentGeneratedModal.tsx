import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
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

  const downloadAgain = () => {
    const link = window.document.createElement('a');
    link.href = documentPayload.url;
    link.download = documentPayload.fileName;
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const openPdf = () => {
    window.open(documentPayload.url, '_blank', 'noopener,noreferrer');
  };

  const printPdf = () => {
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
            type: 'application/pdf',
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
      // User cancelled the native share sheet; no visible error needed.
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/72 px-3 py-5 backdrop-blur-xl sm:px-6">
      <div
        className="absolute inset-0 opacity-80"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 52% 18%, rgba(249,115,22,0.22), transparent 24rem), radial-gradient(circle at 18% 82%, rgba(20,83,45,0.48), transparent 28rem)',
        }}
      />

      <section className="relative grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/12 bg-[#06130f]/94 shadow-[0_40px_140px_rgba(0,0,0,0.48)] animate-scaleIn lg:grid-cols-[0.95fr_1.05fr]">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/8 p-2 text-white/70 transition hover:bg-white/14 hover:text-white focus:outline-none focus:ring-2 focus:ring-action-400"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(155deg,rgba(13,27,22,0.98),rgba(8,17,14,0.9))] p-6 text-white sm:p-8 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-emerald-400/14 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-action-500/16 blur-3xl" />

          <div className="relative">
            <div className="mb-7 flex items-center gap-3">
              <BrandMark size="sm" tone="dark" animated withTile={false} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-action-300">Document prêt</p>
                <p className="text-sm text-emerald-100/70">Téléchargement automatique terminé</p>
              </div>
            </div>

            <div className="mb-7 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/12 shadow-[0_0_50px_rgba(52,211,153,0.2)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-brand-950 shadow-[0_0_30px_rgba(52,211,153,0.42)]">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>
            </div>

            <h2 className="max-w-md text-3xl font-black tracking-tight text-white sm:text-4xl">
              {kindLabel} généré avec succès.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-emerald-50/72 sm:text-base">
              Le fichier <span className="font-bold text-white">{documentPayload.fileName}</span> a été créé et téléchargé. Vous pouvez maintenant le partager, l'imprimer ou l'ouvrir en un clic.
            </p>

            <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">Type</p>
                <p className="mt-1 font-bold text-white">{kindLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">Généré le</p>
                <p className="mt-1 font-bold text-white">{generatedDate}</p>
              </div>
            </div>

            {feedback && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/12 px-4 py-2 text-sm font-bold text-emerald-100 animate-slideInUp">
                <Sparkles className="h-4 w-4 text-action-300" />
                {feedback === 'copied' && 'Lien temporaire copié'}
                {feedback === 'shared' && 'Partage lancé'}
                {feedback === 'printed' && 'Préparation de l’impression'}
                {feedback === 'email' && 'Client email ouvert'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,rgba(250,247,239,0.98),rgba(242,237,227,0.95))] p-4 sm:p-6 lg:p-8">
          <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-950/12 bg-white shadow-[0_24px_70px_rgba(6,17,13,0.16)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-950 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{documentPayload.title}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{documentPayload.fileName}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-brand-800">PDF</span>
            </div>

            <div className="hidden h-[420px] bg-slate-100 md:block">
              <iframe
                title={`Aperçu ${documentPayload.fileName}`}
                src={documentPayload.url}
                className="h-full w-full bg-white"
              />
            </div>
            <button
              type="button"
              onClick={openPdf}
              className="flex h-56 w-full flex-col items-center justify-center gap-3 bg-white text-center md:hidden"
            >
              <div className="rounded-2xl bg-emerald-50 p-4 text-brand-800">
                <FileText className="h-9 w-9" />
              </div>
              <span className="max-w-[14rem] text-sm font-bold text-slate-700">
                Touchez pour ouvrir l'aperçu PDF
              </span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="primary" icon={Download} onClick={downloadAgain} fullWidth>
              Télécharger à nouveau
            </Button>
            <Button type="button" variant="success" icon={ExternalLink} onClick={openPdf} fullWidth>
              Ouvrir le PDF
            </Button>
            <Button type="button" variant="secondary" icon={Share2} onClick={shareDocument} fullWidth>
              Partager
            </Button>
            <Button type="button" variant="secondary" icon={Printer} onClick={printPdf} fullWidth>
              Imprimer
            </Button>
            <Button type="button" variant="secondary" icon={Mail} onClick={sendEmail} fullWidth>
              Envoyer par email
            </Button>
            <Button type="button" variant="secondary" icon={Copy} onClick={copyLink} fullWidth>
              Copier le lien
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="ghost" icon={LayoutDashboard} onClick={goDashboard} fullWidth>
              Retour au dashboard
            </Button>
            <Button type="button" variant="financial" icon={FilePlus2} onClick={close} fullWidth>
              Générer un autre document
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
