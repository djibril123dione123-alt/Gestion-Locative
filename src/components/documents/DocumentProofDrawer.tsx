import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Archive,
  Check,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatStorageSize } from '../../services/documentStorage';
import { getDocumentProofState } from './documentProofState';

interface VerificationData {
  token: string;
  status: 'authentic' | 'revoked' | 'superseded';
  issuedAt: string;
  registeredAt: string;
  agencyName: string;
  amountXof: number | null;
  paymentStatus: string | null;
}

export interface DocumentProofDrawerData {
  id: string;
  source: 'uploaded' | 'generated';
  title: string;
  subtitle: string;
  storagePath: string;
  mimeType: string | null;
  size: number;
  category: string;
  entityType: string | null;
  lifecycleStatus: string;
  retentionPolicy: string;
  createdAt: string;
  reference?: string;
  documentType?: string;
  fileName: string;
  businessContext?: { subject?: string; location?: string };
  period?: string | null;
  isVerifiable?: boolean;
  entityId?: string | null;
  version?: number;
  description?: string | null;
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
  verification?: VerificationData;
}

interface DocumentProofDrawerProps {
  document: DocumentProofDrawerData;
  canArchive: boolean;
  onClose: () => void;
  onOpen: (document: DocumentProofDrawerData) => Promise<void>;
  onDownload: (document: DocumentProofDrawerData) => Promise<void>;
  onArchive: (document: DocumentProofDrawerData) => void;
  onVerify?: (document: DocumentProofDrawerData) => void;
  onCopyLink?: (document: DocumentProofDrawerData) => Promise<void>;
  onNotify: (message: string) => void;
  onError: (message: string) => void;
}

const NOT_PROVIDED = 'Non renseigné';

function formatDate(value?: string | null) {
  if (!value) return NOT_PROVIDED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatPeriod(value?: string | null) {
  if (!value) return NOT_PROVIDED;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

function formatXof(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return NOT_PROVIDED;
  return `${new Intl.NumberFormat('fr-FR').format(Number(value))} F CFA`;
}

function metadataText(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return NOT_PROVIDED;
}

function metadataAmount(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return formatXof(value);
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return formatXof(Number(value));
  }
  return NOT_PROVIDED;
}

function documentTypeLabel(document: DocumentProofDrawerData) {
  const labels: Record<string, string> = {
    quittance: 'Quittance',
    facture: 'Facture',
    contrat: 'Contrat de bail',
    mandat: 'Mandat de gestion',
    rapport: 'Rapport',
    rapport_bailleur: 'Rapport bailleur',
    rapport_proprietaire: 'Rapport propriétaire',
    export: 'Export financier',
  };
  return labels[document.documentType ?? ''] ?? (document.source === 'uploaded' ? 'Document ajouté' : 'Document généré');
}

function lifecycleLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Actif',
    archived: 'Archivé',
    orphaned: 'À classer',
    temporary: 'À revoir',
    corrupt: 'À revoir',
    deleted: 'Supprimé',
  };
  return labels[status] ?? status;
}


function InfoSection({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-950/10 bg-white/90 p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.035)] sm:p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      </div>
      <dl className="mt-3 divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function InfoRow({ label, value, mono = false, strong = false }: { label: string; value: ReactNode; mono?: boolean; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-xs ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-700'} ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function buildContextRows(document: DocumentProofDrawerData) {
  const subject = document.businessContext?.subject || NOT_PROVIDED;
  const location = document.businessContext?.location || NOT_PROVIDED;
  const type = document.documentType;

  if (type === 'quittance' || type === 'facture') {
    return [
      ['Locataire', subject],
      ['Bien / unité', location],
      ['Période', formatPeriod(document.period)],
      ['Paiement lié', document.entityId ? 'Enregistré' : NOT_PROVIDED],
      ['Montant', formatXof(document.verification?.amountXof)],
    ];
  }
  if (type === 'contrat') {
    return [
      ['Locataire', subject],
      ['Bien / unité', location],
      ['Date de début', metadataText(document.metadata, ['date_debut', 'start_date'])],
      ['Date de fin', metadataText(document.metadata, ['date_fin', 'end_date'])],
      ['Statut du bail', metadataText(document.metadata, ['statut', 'contract_status'])],
    ];
  }
  if (type === 'mandat') {
    return [
      ['Bailleur', subject],
      ['Émetteur', document.verification?.agencyName || NOT_PROVIDED],
      ['Date', formatDate(document.createdAt)],
      ['Statut', lifecycleLabel(document.lifecycleStatus)],
    ];
  }
  if (type === 'rapport' || type === 'rapport_bailleur' || type === 'rapport_proprietaire') {
    return [
      ['Bailleur / propriétaire', subject],
      ['Période', formatPeriod(document.period)],
      ['Total encaissé', metadataAmount(document.metadata, ['total_encaisse', 'total_collected'])],
      ['Net propriétaire', metadataAmount(document.metadata, ['net_bailleur', 'net_proprietaire', 'owner_net'])],
    ];
  }
  return [
    ['Catégorie', document.category || NOT_PROVIDED],
    ['Élément lié', subject],
    ['Description', document.description || NOT_PROVIDED],
    ['Ajouté par', document.uploadedBy || NOT_PROVIDED],
  ];
}

export function DocumentProofDrawer({
  document,
  canArchive,
  onClose,
  onOpen,
  onDownload,
  onArchive,
  onVerify,
  onCopyLink,
  onNotify,
  onError,
}: DocumentProofDrawerProps) {
  const [pendingAction, setPendingAction] = useState<'open' | 'download' | 'copy-link' | null>(null);
  const [referenceCopied, setReferenceCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contextRows = useMemo(() => buildContextRows(document), [document]);
  const proofState = getDocumentProofState(document);
  const proofTone = proofState.kind === 'verifiable'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : proofState.kind === 'revoked'
      ? 'border-red-200 bg-red-50 text-red-700'
      : proofState.kind === 'superseded'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : proofState.kind === 'review'
          ? 'border-orange-200 bg-orange-50 text-orange-800'
          : 'border-slate-200 bg-slate-50 text-slate-600';

  useEffect(() => {
    closeButtonRef.current?.focus();
    setReferenceCopied(false);
  }, [document.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const run = async (action: 'open' | 'download' | 'copy-link', callback: () => Promise<void>) => {
    setPendingAction(action);
    try {
      await callback();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Action documentaire impossible');
    } finally {
      setPendingAction(null);
    }
  };

  const copyReference = async () => {
    if (!document.reference) return;
    try {
      await navigator.clipboard.writeText(document.reference);
      setReferenceCopied(true);
      onNotify('Référence copiée');
      window.setTimeout(() => setReferenceCopied(false), 1800);
    } catch {
      onError('Copie de la référence indisponible');
    }
  };

  return (
    <aside
      className="fixed inset-0 z-[70] flex min-h-0 flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.2)] xl:sticky xl:top-4 xl:z-auto xl:h-[calc(100vh-2rem)] xl:rounded-3xl xl:border xl:border-emerald-950/10"
      role="dialog"
      aria-label={`Fiche preuve ${document.title}`}
    >
      <header className="shrink-0 border-b border-emerald-950/10 bg-[#fffdf8]/95 px-4 py-3.5 backdrop-blur sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">{documentTypeLabel(document)}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${proofTone}`}>{proofState.label}</span>
            </div>
            <h2 className="mt-1.5 line-clamp-2 text-xl font-black leading-tight text-slate-950 sm:text-2xl">{document.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-1">{lifecycleLabel(document.lifecycleStatus)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">{document.source === 'generated' ? 'Généré' : 'Ajouté'}</span>
            </div>
            <p className="mt-2 truncate font-mono text-[11px] font-semibold text-slate-400" title={document.reference || undefined}>
              {document.reference ? `Réf. ${document.reference}` : 'Référence non renseignée'}
            </p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950" aria-label="Fermer la fiche preuve">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-3.5 pb-28 sm:px-5 sm:py-4 xl:pb-5">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => run('open', () => onOpen(document))} disabled={pendingAction !== null} className="sk-action sk-action-primary min-w-0 justify-center disabled:opacity-60">
            {pendingAction === 'open' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Ouvrir
          </button>
          <button type="button" onClick={() => run('download', () => onDownload(document))} disabled={pendingAction !== null} className="sk-action sk-action-secondary min-w-0 justify-center disabled:opacity-60">
            {pendingAction === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger
          </button>
        </div>

        <InfoSection title="Résumé" icon={FileCheck2}>
          <InfoRow label="Type" value={documentTypeLabel(document)} />
          <InfoRow label="Source" value={document.source === 'generated' ? 'Généré automatiquement' : 'Ajouté manuellement'} />
          <InfoRow label="Statut" value={lifecycleLabel(document.lifecycleStatus)} strong />
          <InfoRow label="Date de création" value={formatDate(document.createdAt)} />
          <InfoRow label="Taille" value={formatStorageSize(document.size)} />
          <InfoRow label="Version" value={document.version ? `v${document.version}` : NOT_PROVIDED} />
          <InfoRow label="Origine" value={document.uploadedBy || NOT_PROVIDED} />
          {document.source === 'generated' && (
            <InfoRow label="Émetteur" value={document.verification?.agencyName || metadataText(document.metadata, ['agency_name', 'nom_agence'])} />
          )}
        </InfoSection>

        <InfoSection title="Contexte métier" icon={Clipboard}>
          {contextRows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
        </InfoSection>

        <InfoSection title="Preuve et registre" icon={ShieldCheck}>
          <InfoRow label="Référence" value={document.reference || NOT_PROVIDED} mono />
          <InfoRow label="État de preuve" value={proofState.label} strong />
          <InfoRow label="Registre GED" value={document.source === 'generated' ? 'Présent' : 'Non applicable'} />
          <InfoRow label="Preuve QR" value={document.verification ? 'Enregistrée' : 'Absente'} />
          <InfoRow label="Jeton de vérification" value={document.verification?.token ? 'Présent' : 'Absent'} />
          <InfoRow label="Enregistré le" value={formatDate(document.verification?.registeredAt)} />
          <InfoRow label="Dernière vérification" value="Non disponible" />
          <InfoRow label="Lecture" value={proofState.description} />
        </InfoSection>

        <InfoSection title="Actions de preuve" icon={QrCode}>
          <div className="grid grid-cols-2 gap-2 py-1">
            {document.reference && (
              <button type="button" onClick={copyReference} className="sk-action sk-action-secondary min-w-0 justify-center px-2.5 text-xs">
                {referenceCopied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                Copier réf.
              </button>
            )}
            {onVerify && document.verification && (
              <button type="button" onClick={() => onVerify(document)} className="sk-action sk-action-secondary min-w-0 justify-center px-2.5 text-xs">
                <QrCode className="h-4 w-4" />
                Vérifier QR
              </button>
            )}
            {onCopyLink && document.verification && (
              <button type="button" onClick={() => run('copy-link', () => onCopyLink(document))} disabled={pendingAction !== null} className="sk-action sk-action-secondary col-span-2 min-w-0 justify-center px-2.5 text-xs disabled:opacity-60">
                {pendingAction === 'copy-link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Copier le lien de vérification
              </button>
            )}
          </div>
        </InfoSection>

        {canArchive && (
          <section className="rounded-2xl border border-amber-200/70 bg-amber-50/55 p-3.5">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-amber-800">Action secondaire</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-900/70">Le document restera conservé et traçable dans le coffre.</p>
            <button type="button" onClick={() => onArchive(document)} className="sk-action mt-3 w-full justify-center border border-amber-300 bg-white text-amber-800 hover:bg-amber-50">
              <Archive className="h-4 w-4" />
              Archiver le document
            </button>
          </section>
        )}
      </div>
    </aside>
  );
}
