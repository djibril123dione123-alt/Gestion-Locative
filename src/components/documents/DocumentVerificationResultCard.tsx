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
    <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] items-start gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="min-w-0 text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-slate-400 sm:text-[11px]">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-bold leading-5 text-slate-800 [overflow-wrap:anywhere] sm:text-sm">{value || 'Non renseigné'}</span>
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
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border bg-white ${visual.panel} p-3.5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:rounded-[1.7rem] sm:p-6`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-800 via-emerald-500 to-amber-400" />
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_68%)]" />
      <div className="relative">
        {showBrand && (
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:mb-5 sm:gap-4 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <BrandMark size="sm" tone="light" animated withTile={false} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 sm:text-xs sm:tracking-[0.2em]">Registre Samay Këur</p>
                <h1 className="truncate text-base font-black text-slate-950 sm:text-lg">Vérification documentaire</h1>
              </div>
            </div>
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10 ${visual.badge}`}>
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${visual.iconClass}`} />
            </div>
          </div>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border shadow-sm sm:h-14 sm:w-14 ${visual.badge}`}>
            <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${visual.iconClass}`} />
          </div>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-[0.16em] sm:text-xs sm:tracking-[0.2em] ${visual.eyebrow}`}>Contrôle du registre</p>
          <h2 className="mt-1 break-words text-xl font-black tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
            {visual.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl break-words text-xs font-semibold leading-5 text-slate-500 [overflow-wrap:anywhere] sm:text-sm sm:leading-6">
            {result?.message || copy.message}
          </p>
        </div>

        {details && (
          <div className={`mt-4 min-w-0 max-w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 sm:mt-5 sm:px-4 ${compact ? '' : 'sm:grid sm:grid-cols-2 sm:gap-x-6'}`}>
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

        <div className="mt-4 max-w-full rounded-xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
          <div className="flex items-start gap-3">
            {result?.state === 'authentic' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
            )}
            <p className="min-w-0 break-words text-[11px] font-semibold leading-5 text-slate-600 [overflow-wrap:anywhere] sm:text-xs">
              {result?.state === 'authentic'
                ? "Le registre Samay Këur confirme l'authenticité de cette référence. Vérifiez que les informations affichées correspondent au document scanné."
                : "Ne vous fiez pas à ce document tant que son authenticité n'a pas été confirmée par son émetteur."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2.5">
          {onReset && (
            <button type="button" onClick={onReset} className="sk-action sk-action-primary justify-center">
              <ScanLine className="h-4 w-4" />
              Scanner un autre document
            </button>
          )}
          {details?.reference && (
            <button type="button" onClick={() => void copyReference()} className="sk-action sk-action-secondary justify-center">
              {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Référence copiée' : 'Copier la référence'}
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="sk-action sk-action-secondary justify-center"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </button>
          )}
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="sk-action sk-action-secondary justify-center"
            >
              Découvrir Samay Këur
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
