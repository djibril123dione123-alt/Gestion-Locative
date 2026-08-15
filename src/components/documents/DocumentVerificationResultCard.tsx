import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileSearch,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';
import {
  getDocumentTypeLabel,
  getVerificationCopy,
  type DocumentVerificationResult,
  type VerificationState,
} from '../../services/documentVerification';

interface DocumentVerificationResultCardProps {
  result: DocumentVerificationResult | null;
  loading?: boolean;
  onRetry?: () => void;
  onDiscover?: () => void;
  compact?: boolean;
  showBrand?: boolean;
  onReset?: () => void;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getVisualState(state: VerificationState | 'loading') {
  if (state === 'loading') {
    return {
      title: 'Vérification en cours',
      icon: Loader2,
      iconClass: 'animate-spin text-emerald-800',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      panel: 'border-emerald-950/10',
      eyebrow: 'text-emerald-700',
    };
  }
  if (state === 'authentic') {
    return {
      title: getVerificationCopy('authentic').title,
      icon: ShieldCheck,
      iconClass: 'text-emerald-800',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      panel: 'border-emerald-200/80',
      eyebrow: 'text-emerald-700',
    };
  }
  if (state === 'revoked' || state === 'superseded') {
    return {
      title: getVerificationCopy(state).title,
      icon: ShieldAlert,
      iconClass: 'text-red-700',
      badge: 'border-red-200 bg-red-50 text-red-700',
      panel: 'border-red-200/80',
      eyebrow: 'text-red-600',
    };
  }
  if (state === 'network_error') {
    return {
      title: getVerificationCopy('network_error').title,
      icon: AlertTriangle,
      iconClass: 'text-amber-700',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      panel: 'border-amber-200/80',
      eyebrow: 'text-amber-700',
    };
  }
  return {
    title: getVerificationCopy(state).title,
    icon: FileSearch,
    iconClass: 'text-slate-700',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    panel: 'border-slate-200',
    eyebrow: 'text-slate-500',
  };
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] items-start gap-2.5 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="min-w-0 text-[0.58rem] font-black uppercase leading-4 tracking-[0.08em] text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-right text-[0.72rem] font-semibold leading-4 text-slate-800 [overflow-wrap:anywhere]">{value || 'Non renseigné'}</span>
    </div>
  );
}

export function DocumentVerificationResultCard({
  result,
  loading = false,
  onRetry,
  onDiscover,
  compact = false,
  showBrand = true,
  onReset,
}: DocumentVerificationResultCardProps) {
  const [copied, setCopied] = useState(false);
  const state = loading ? 'loading' : result?.state ?? 'not_found';
  const visual = getVisualState(state);
  const Icon = visual.icon;
  const copy =
    state === 'loading'
      ? { title: 'Vérification en cours', message: 'Interrogation du registre documentaire sécurisé Samay Këur.' }
      : getVerificationCopy(result?.state ?? 'not_found');
  const details = result?.details;

  const copyReference = async () => {
    if (!details?.reference) return;
    try {
      await navigator.clipboard.writeText(details.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.2rem] border bg-[linear-gradient(135deg,rgba(255,252,245,0.97),rgba(255,255,255,0.94))] ${visual.panel} p-3 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/70 sm:p-4`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-800 via-emerald-500 to-amber-400" />
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.07),transparent_68%)]" />
      <div className="relative">
        {showBrand && (
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 pb-2.5 sm:mb-4 sm:gap-4 sm:pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandMark size="sm" tone="light" animated withTile={false} />
              <div className="min-w-0">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-emerald-700">Registre Samay Këur</p>
                <h1 className="truncate text-sm font-extrabold text-slate-950 sm:text-base">Vérification documentaire</h1>
              </div>
            </div>
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border ${visual.badge}`}>
              <Icon className={`h-4 w-4 ${visual.iconClass}`} />
            </div>
          </div>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm sm:h-11 sm:w-11 ${visual.badge}`}>
            <Icon className={`h-5 w-5 ${visual.iconClass}`} />
          </div>
          <p className={`mt-2.5 text-[0.58rem] font-black uppercase tracking-[0.16em] ${visual.eyebrow}`}>Contrôle du registre</p>
          <h2 className="mt-1 break-words text-base font-extrabold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-lg">
            {visual.title}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xl break-words text-[0.72rem] font-medium leading-5 text-slate-500 [overflow-wrap:anywhere] sm:text-xs">
            {result?.message || copy.message}
          </p>
        </div>

        {details && (
          <div className={`mt-3 min-w-0 max-w-full rounded-xl border border-emerald-950/10 bg-white/[0.72] px-3 shadow-sm sm:mt-4 ${compact ? '' : 'sm:grid sm:grid-cols-2 sm:gap-x-5'}`}>
            <div>
              <DetailRow label="Statut" value={getVerificationCopy(result.state).title} />
              <DetailRow label="Référence" value={details.reference} />
              <DetailRow label="Type" value={getDocumentTypeLabel(details.type)} />
              <DetailRow label="Émetteur" value={details.issuer} />
            </div>
            <div>
              <DetailRow label="Date d’émission" value={formatDate(details.issuedAt)} />
              <DetailRow label="Dernière vérification" value={formatDateTime(details.lastCheckedAt)} />
              <DetailRow label="Enregistré le" value={formatDateTime(details.registeredAt)} />
            </div>
          </div>
        )}

        <div className="mt-3 max-w-full rounded-xl border border-emerald-950/10 bg-white/75 p-2.5 shadow-sm sm:mt-4 sm:p-3">
          <div className="flex items-start gap-2.5">
            {result?.state === 'authentic' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
            )}
            <p className="min-w-0 break-words text-[0.68rem] font-medium leading-5 text-slate-600 [overflow-wrap:anywhere] sm:text-[0.72rem]">
              {result?.state === 'authentic'
                ? "Cette référence est enregistrée dans le registre Samay Këur. Vérifiez que les informations affichées correspondent au document scanné."
                : "Ne vous fiez pas à ce document tant que son enregistrement n'a pas été confirmé par son émetteur."}
            </p>
          </div>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:justify-center">
          {onReset && (
            <button type="button" onClick={onReset} className="sk-action sk-action-primary h-8 justify-center px-2.5 text-[0.72rem]">
              <ScanLine className="h-3.5 w-3.5" />
              Scanner un autre document
            </button>
          )}
          {details?.reference && (
            <button type="button" onClick={() => void copyReference()} className="sk-action sk-action-secondary h-8 justify-center px-2.5 text-[0.72rem]">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Référence copiée' : 'Copier la référence'}
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="sk-action sk-action-secondary h-8 justify-center px-2.5 text-[0.72rem]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </button>
          )}
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="sk-action sk-action-secondary h-8 justify-center px-2.5 text-[0.72rem]"
            >
              Découvrir Samay Këur
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
