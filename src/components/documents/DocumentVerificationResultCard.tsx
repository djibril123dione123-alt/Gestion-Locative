import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';
import { formatCurrency } from '../../lib/formatters';
import {
  getDocumentTypeLabel,
  getPaymentStatusLabel,
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

function formatPeriod(value?: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 7)}-01`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getVisualState(state: VerificationState | 'loading') {
  if (state === 'loading') {
    return {
      title: 'Contrôle en cours',
      icon: Loader2,
      iconClass: 'animate-spin text-emerald-50',
      badge: 'bg-white/14 text-emerald-50 ring-white/25',
      panel: 'border-white/18',
      glow: 'bg-emerald-300/24',
    };
  }
  if (state === 'authentic') {
    return {
      title: getVerificationCopy('authentic').title,
      icon: ShieldCheck,
      iconClass: 'text-emerald-50',
      badge: 'bg-emerald-300/22 text-emerald-50 ring-emerald-100/40',
      panel: 'border-emerald-100/45',
      glow: 'bg-emerald-300/28',
    };
  }
  if (state === 'revoked' || state === 'superseded') {
    return {
      title: getVerificationCopy(state).title,
      icon: ShieldAlert,
      iconClass: 'text-orange-50',
      badge: 'bg-orange-300/22 text-orange-50 ring-orange-100/40',
      panel: 'border-orange-100/45',
      glow: 'bg-orange-300/28',
    };
  }
  if (state === 'network_error') {
    return {
      title: getVerificationCopy('network_error').title,
      icon: AlertTriangle,
      iconClass: 'text-orange-50',
      badge: 'bg-orange-300/22 text-orange-50 ring-orange-100/40',
      panel: 'border-orange-100/45',
      glow: 'bg-orange-300/24',
    };
  }
  return {
    title: getVerificationCopy(state).title,
    icon: FileSearch,
    iconClass: 'text-red-50',
    badge: 'bg-red-300/22 text-red-50 ring-red-100/40',
    panel: 'border-red-100/45',
    glow: 'bg-red-300/24',
  };
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] items-start gap-2 rounded-xl border border-white/28 bg-white/[0.16] px-3 py-2.5 shadow-sm shadow-black/20 backdrop-blur sm:gap-4 sm:rounded-2xl sm:px-3.5 sm:py-3">
      <span className="min-w-0 text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-emerald-50/85 sm:text-xs sm:tracking-[0.12em]">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-black leading-5 text-white drop-shadow-sm [overflow-wrap:anywhere] sm:text-sm">{value || '—'}</span>
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
}: DocumentVerificationResultCardProps) {
  const state = loading ? 'loading' : result?.state ?? 'not_found';
  const visual = getVisualState(state);
  const Icon = visual.icon;
  const copy =
    state === 'loading'
      ? { title: 'Contrôle en cours', message: 'Nous vérifions ce document auprès du registre sécurisé Samay Këur.' }
      : getVerificationCopy(result?.state ?? 'not_found');
  const details = result?.details;

  return (
    <section
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border ${visual.panel} p-3.5 shadow-2xl shadow-emerald-950/35 ring-1 ring-emerald-100/20 sm:rounded-[1.7rem] sm:p-7`}
      style={{
        background: 'linear-gradient(145deg, #04150f 0%, #073526 48%, #101827 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(110,231,183,0.26),transparent_24rem),radial-gradient(circle_at_88%_18%,rgba(245,158,11,0.18),transparent_18rem)]" />
      <div className={`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full ${visual.glow} blur-3xl`} />
      <div className="relative">
        {showBrand && (
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-white/12 pb-3 sm:mb-6 sm:gap-4 sm:pb-5">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <BrandMark size="md" tone="dark" animated withTile={false} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-50/75 sm:text-xs sm:tracking-[0.22em]">Samay Këur</p>
                <h1 className="truncate text-base font-black text-white sm:text-xl">Vérification documentaire</h1>
              </div>
            </div>
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 sm:h-11 sm:w-11 sm:rounded-2xl ${visual.badge}`}>
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${visual.iconClass}`} />
            </div>
          </div>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ring-1 sm:h-16 sm:w-16 sm:rounded-3xl ${visual.badge}`}>
            <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${visual.iconClass}`} />
          </div>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-orange-100 sm:mt-5 sm:text-xs sm:tracking-[0.22em]">Registre sécurisé</p>
          <h2 className="mt-1.5 break-words text-xl font-black tracking-tight text-white drop-shadow-sm [overflow-wrap:anywhere] sm:mt-2 sm:text-3xl">
            {visual.title}
          </h2>
          <p className="mx-auto mt-2.5 max-w-2xl break-words text-xs font-semibold leading-5 text-emerald-50 [overflow-wrap:anywhere] sm:mt-4 sm:text-sm sm:leading-6">
            {result?.message || copy.message}
          </p>
        </div>

        {details && (
          <div className={`mt-4 grid min-w-0 max-w-full gap-2 sm:mt-6 sm:gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
            <DetailRow label="Statut" value={getVerificationCopy(result.state).title} />
            <DetailRow label="Référence" value={details.reference} />
            <DetailRow label="Type" value={getDocumentTypeLabel(details.type)} />
            <DetailRow label="Émetteur" value={details.issuer} />
            <DetailRow label="Date d’émission" value={formatDate(details.issuedAt)} />
            <DetailRow label="Dernière vérification" value={formatDateTime(details.lastCheckedAt)} />
            {details.amountXof != null && <DetailRow label="Montant" value={formatCurrency(Number(details.amountXof), 'XOF')} />}
            {details.paymentStatus && <DetailRow label="État paiement" value={getPaymentStatusLabel(details.paymentStatus)} />}
            {details.period && <DetailRow label="Période" value={formatPeriod(details.period)} />}
            {details.registeredAt && <DetailRow label="Enregistré le" value={formatDateTime(details.registeredAt)} />}
          </div>
        )}

        <div className="mt-4 max-w-full rounded-xl border border-white/24 bg-black/35 p-3 shadow-inner shadow-black/25 sm:mt-6 sm:rounded-2xl sm:p-4">
          <div className="flex items-start gap-3">
            {result?.state === 'authentic' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-200" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-200" />
            )}
            <p className="min-w-0 break-words text-[11px] font-semibold leading-5 text-emerald-50/90 [overflow-wrap:anywhere] sm:text-xs">
              {result?.state === 'authentic'
                ? "Cette page confirme l'authenticité du document enregistré dans le registre documentaire Samay Këur. Les informations affichées doivent correspondre au document scanné."
                : "Ne vous fiez pas à ce document tant que son authenticité n'a pas été confirmée par l'émetteur."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex min-w-0 flex-col gap-2 sm:mt-6 sm:flex-row sm:justify-center sm:gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/22 bg-white/14 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/20 sm:rounded-2xl sm:py-3"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </button>
          )}
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:from-[#0A3F30] hover:to-[#06281F] sm:rounded-2xl sm:py-3"
            >
              Découvrir Samay Këur
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
