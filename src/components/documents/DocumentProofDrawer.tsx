import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import { formatStorageSize } from '../../services/documentStorage';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
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

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatPeriod(value?: string | null) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

function formatXof(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Number(value))} F CFA`;
}

function metadataText(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function metadataAmount(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return formatXof(value);
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return formatXof(Number(value));
  }
  return null;
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
    <section className="rounded-xl border border-emerald-950/10 bg-white/[0.88] p-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.045)] ring-1 ring-white/70">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      </div>
      <dl className="mt-1.5 divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

/** Only renders if value is not null/undefined/empty */
function InfoRow({ label, value, mono = false, strong = false }: { label: string; value: ReactNode | null | undefined; mono?: boolean; strong?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2 py-1 first:pt-0 last:pb-0">
      <dt className="text-[0.64rem] font-medium text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[0.64rem] ${strong ? 'font-semibold text-slate-950' : 'font-semibold text-slate-700'} ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function buildContextRows(document: DocumentProofDrawerData): Array<[string, string | null]> {
  const subject = document.businessContext?.subject || null;
  const location = document.businessContext?.location || null;
  const type = document.documentType;

  if (type === 'quittance' || type === 'facture') {
    const rows: Array<[string, string | null]> = [
      ['Locataire', subject],
      ['Bien / unité', location],
      ['Période', formatPeriod(document.period)],
    ];
    if (document.entityId) rows.push(['Paiement lié', 'Enregistré']);
    const amount = formatXof(document.verification?.amountXof);
    if (amount) rows.push(['Montant', amount]);
    return rows;
  }
  if (type === 'contrat') {
    const rows: Array<[string, string | null]> = [
      ['Locataire', subject],
      ['Bien / unité', location],
    ];
    const dateDebut = metadataText(document.metadata, ['date_debut', 'start_date']);
    const dateFin = metadataText(document.metadata, ['date_fin', 'end_date']);
    const statut = metadataText(document.metadata, ['statut', 'contract_status']);
    if (dateDebut) rows.push(['Date de début', dateDebut]);
    if (dateFin) rows.push(['Date de fin', dateFin]);
    if (statut) rows.push(['Statut du bail', statut]);
    return rows;
  }
  if (type === 'mandat') {
    return [
      ['Bailleur', subject],
      ['Émetteur', document.verification?.agencyName || null],
      ['Date', formatDate(document.createdAt)],
      ['Statut', lifecycleLabel(document.lifecycleStatus)],
    ];
  }
  if (type === 'rapport' || type === 'rapport_bailleur' || type === 'rapport_proprietaire') {
    const rows: Array<[string, string | null]> = [
      ['Bailleur / propriétaire', subject],
      ['Période', formatPeriod(document.period)],
    ];
    const totalEncaisse = metadataAmount(document.metadata, ['total_encaisse', 'total_collected']);
    const netBailleur = metadataAmount(document.metadata, ['net_bailleur', 'net_proprietaire', 'owner_net']);
    if (totalEncaisse) rows.push(['Total encaissé', totalEncaisse]);
    if (netBailleur) rows.push(['Net propriétaire', netBailleur]);
    if (!totalEncaisse && !netBailleur) rows.push(['Résumé financier', 'Disponible dans le PDF']);
    return rows;
  }
  // Document libre
  const rows: Array<[string, string | null]> = [];
  if (subject) rows.push(['Élément lié', subject]);
  if (document.description) rows.push(['Description', document.description]);
  if (document.uploadedBy) rows.push(['Ajouté par', document.uploadedBy]);
  if (rows.length === 0) rows.push(['Dossier', document.category || null]);
  return rows;
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
  const contextRows = useMemo(() => buildContextRows(document), [document]);
  const proofState = getDocumentProofState(document);

  useEffect(() => {
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

  const hasContextRows = contextRows.some(([, v]) => v !== null && v !== '');

  return (
    <PremiumDrawerShell
      open
      title={document.title}
      eyebrow={documentTypeLabel(document)}
      description={[
        proofState.label,
        lifecycleLabel(document.lifecycleStatus),
        document.source === 'generated' ? 'Généré' : 'Ajouté',
        document.reference ? `Réf. ${document.reference}` : null,
      ].filter(Boolean).join(' · ')}
      avatar={
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10">
          <FileText className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
      closeLabel="Fermer la fiche preuve"
      size="compact"
      desktopMode="floating"
      desktopAt="lg"
      density="compact"
      ariaLabel={`Fiche preuve ${document.title}`}
      headerClassName="!py-2"
      bodyClassName="space-y-2 pb-24 lg:pb-3"
    >
        {/* Primary actions */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => run('open', () => onOpen(document))} disabled={pendingAction !== null} className="sk-action sk-action-primary h-7 min-h-0 flex-1 justify-center px-2 py-0.5 text-[0.68rem] disabled:opacity-60">
            {pendingAction === 'open' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            Ouvrir
          </button>
          <button type="button" onClick={() => run('download', () => onDownload(document))} disabled={pendingAction !== null} className="sk-action sk-action-secondary h-7 min-h-0 flex-1 justify-center px-2 py-0.5 text-[0.68rem] disabled:opacity-60">
            {pendingAction === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Télécharger
          </button>
        </div>

        {/* 1. PREUVE ET REGISTRE — en premier */}
        <InfoSection title="Preuve et registre" icon={ShieldCheck}>
          <InfoRow label="État de preuve" value={proofState.label} strong />
          <InfoRow label="Preuve QR" value={document.verification ? 'Enregistrée' : document.source === 'generated' ? 'Absente' : null} />
          <InfoRow label="Registre GED" value={document.source === 'generated' ? 'Présent' : null} />
          <InfoRow label="Référence" value={document.reference || null} mono />
          <InfoRow label="Enregistré le" value={formatDate(document.verification?.registeredAt)} />
          <InfoRow label="Lecture" value={proofState.description} />
        </InfoSection>

        {/* QR / Proof actions */}
        {(document.reference || (onVerify && document.verification) || (onCopyLink && document.verification)) && (
          <InfoSection title="Actions de preuve" icon={QrCode}>
            <div className="grid grid-cols-2 gap-1.5 py-0.5">
              {document.reference && (
                <button type="button" onClick={copyReference} className="sk-action sk-action-secondary h-8 min-w-0 justify-center px-2 text-[0.68rem]">
                  {referenceCopied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                  Copier réf.
                </button>
              )}
              {onVerify && document.verification && (
                <button type="button" onClick={() => onVerify(document)} className="sk-action sk-action-secondary h-8 min-w-0 justify-center px-2 text-[0.68rem]">
                  <QrCode className="h-3.5 w-3.5" />
                  Vérifier QR
                </button>
              )}
              {onCopyLink && document.verification && (
                <button type="button" onClick={() => run('copy-link', () => onCopyLink(document))} disabled={pendingAction !== null} className="sk-action sk-action-secondary col-span-2 h-8 min-w-0 justify-center px-2 text-[0.68rem] disabled:opacity-60">
                  {pendingAction === 'copy-link' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Copier le lien de vérification
                </button>
              )}
            </div>
          </InfoSection>
        )}

        {/* 2. CONTEXTE MÉTIER */}
        {hasContextRows && (
          <InfoSection title="Contexte métier" icon={Clipboard}>
            {contextRows.map(([label, value]) =>
              value ? <InfoRow key={label} label={label} value={value} /> : null
            )}
          </InfoSection>
        )}

        {/* 3. RÉSUMÉ TECHNIQUE — compact */}
        <InfoSection title="Fiche technique" icon={FileCheck2}>
          <InfoRow label="Type" value={documentTypeLabel(document)} />
          <InfoRow label="Source" value={document.source === 'generated' ? 'Généré automatiquement' : 'Ajouté manuellement'} />
          <InfoRow label="Date" value={formatDate(document.createdAt)} />
          <InfoRow label="Taille" value={formatStorageSize(document.size)} />
          {document.version && <InfoRow label="Version" value={`v${document.version}`} />}
          {document.source === 'generated' && (
            <InfoRow label="Émetteur" value={document.verification?.agencyName || metadataText(document.metadata, ['agency_name', 'nom_agence'])} />
          )}
        </InfoSection>

        {/* 4. ARCHIVAGE — action secondaire */}
        {canArchive && (
          <section className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-amber-800">Archiver ce document</p>
            <p className="mt-1 text-[0.68rem] font-semibold leading-4 text-amber-900/70">
              Le document reste conservé et traçable. Il sort de la vue active mais n'est pas supprimé.
              <span className="block mt-1 opacity-70">L'archivage ne révoque pas la preuve QR enregistrée.</span>
            </p>
            <button type="button" onClick={() => onArchive(document)} className="sk-action mt-2 w-full justify-center border border-amber-300 bg-white py-1.5 text-amber-800 hover:bg-amber-50">
              <Archive className="h-4 w-4" />
              Archiver le document
            </button>
          </section>
        )}
    </PremiumDrawerShell>
  );
}
