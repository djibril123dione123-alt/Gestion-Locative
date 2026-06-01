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
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/28 bg-white/[0.16] px-3.5 py-3 shadow-sm shadow-black/20 backdrop-blur">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-emerald-50/85">{label}</span>
      <span className="min-w-0 text-right text-sm font-black text-white drop-shadow-sm">{value || '—'}</span>
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
      className={`relative overflow-hidden rounded-[1.7rem] border ${visual.panel} p-5 shadow-2xl shadow-emerald-950/35 ring-1 ring-emerald-100/20 sm:p-7`}
      style={{
        background: 'linear-gradient(145deg, #04150f 0%, #073526 48%, #101827 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(110,231,183,0.26),transparent_24rem),radial-gradient(circle_at_88%_18%,rgba(245,158,11,0.18),transparent_18rem)]" />
      <div className={`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full ${visual.glow} blur-3xl`} />
      <div className="relative">
        {showBrand && (
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/12 pb-5">
            <div className="flex items-center gap-3">
              <BrandMark size="md" tone="dark" animated withTile={false} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-50/75">Samay Këur</p>
                <h1 className="text-lg font-black text-white sm:text-xl">Vérification documentaire</h1>
              </div>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${visual.badge}`}>
              <Icon className={`h-6 w-6 ${visual.iconClass}`} />
            </div>
          </div>
        )}

        <div className="text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ring-1 ${visual.badge}`}>
            <Icon className={`h-8 w-8 ${visual.iconClass}`} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-orange-100">Registre sécurisé</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl">
            {visual.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-emerald-50">
            {result?.message || copy.message}
          </p>
        </div>

        {details && (
          <div className={`mt-6 grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
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

        <div className="mt-6 rounded-2xl border border-white/24 bg-black/35 p-4 shadow-inner shadow-black/25">
          <div className="flex items-start gap-3">
            {result?.state === 'authentic' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-200" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-200" />
            )}
            <p className="text-xs font-semibold leading-5 text-emerald-50/90">
              {result?.state === 'authentic'
                ? "Cette page confirme l'authenticité du document enregistré dans le registre documentaire Samay Këur. Les informations affichées doivent correspondre au document scanné."
                : "Ne vous fiez pas à ce document tant que son authenticité n'a pas été confirmée par l'émetteur."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/22 bg-white/14 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </button>
          )}
          {onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-950/25 transition hover:bg-orange-600"
            >
              Découvrir Samay Këur
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
