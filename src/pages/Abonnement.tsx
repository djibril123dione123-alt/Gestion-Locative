import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import {
  CreditCard, CheckCircle2, Clock, Zap, Building2, Crown,
  TrendingUp, AlertTriangle, Calendar, Users, Home, DoorOpen,
  ChevronRight, Smartphone, Mail,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';

interface Plan {
  id: string;
  name: string;
  price_xof: number;
  max_users: number;
  max_immeubles: number;
  max_unites: number;
  storage_gb: number;
  features: Record<string, unknown>;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  subscription_plans?: Plan;
}

interface Agency {
  id: string;
  name: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
}

interface Usage {
  users: number;
  immeubles: number;
  unites: number;
}

const CONTACT_WHATSAPP = '221774000000';
const CONTACT_EMAIL = 'contact@samaykeur.sn';

const PLANS_INFO = [
  {
    id: 'starter',
    name: 'Starter',
    price_xof: 9900,
    icon: Zap,
    color: '#64748B',
    max_users: 3,
    max_immeubles: 10,
    max_unites: 30,
    features: ['Tableau de bord complet', 'Exports PDF & Excel', 'Support email', 'Rappels locataires'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_xof: 19900,
    icon: Building2,
    color: '#F58220',
    max_users: 10,
    max_immeubles: 50,
    max_unites: 150,
    badge: 'Populaire',
    features: ['Tout Starter', 'Notifications bailleurs auto', 'Rapports PDF mensuels', 'Alertes impayés', 'Gestion commissions', 'Paiement Orange Money'],
  },
  {
    id: 'agence',
    name: 'Agence',
    price_xof: 39900,
    icon: Crown,
    color: '#7C3AED',
    max_users: -1,
    max_immeubles: -1,
    max_unites: -1,
    features: ['Tout Pro', 'Illimité partout', 'Onboarding dédié', 'API access', 'SLA 99,9 %', 'Account manager'],
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Actif',     color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  trial:     { label: 'Essai',     color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  past_due:  { label: 'Impayé',   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  suspended: { label: 'Suspendu', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  cancelled: { label: 'Annulé',   color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
};

export function Abonnement() {
  const { profile } = useAuth();
  const toast = useToast();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [usage, setUsage] = useState<Usage>({ users: 0, immeubles: 0, unites: 0 });
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [agencyRes, subRes, limitsRes] = await Promise.all([
        supabase.from('agencies').select('id, name, status, plan, trial_ends_at').eq('id', profile.agency_id).single(),
        supabase.from('subscriptions').select('*, subscription_plans(*)').eq('agency_id', profile.agency_id).order('created_at', { ascending: false }),
        supabase.rpc('check_plan_limits', { p_agency_id: profile.agency_id }),
      ]);

      if (agencyRes.data) setAgency(agencyRes.data as Agency);

      if (subRes.data && subRes.data.length > 0) {
        const subs = subRes.data as Subscription[];
        setSubscription(subs[0]);
        setCurrentPlan(subs[0].subscription_plans ?? null);
        setHistory(subs);
      } else if (agencyRes.data?.plan) {
        const { data: planData } = await supabase
          .from('subscription_plans').select('*').eq('id', agencyRes.data.plan).maybeSingle();
        if (planData) setCurrentPlan(planData as Plan);
      }

      if (limitsRes.data?.usage) setUsage(limitsRes.data.usage as Usage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => { if (profile?.agency_id) load(); }, [profile?.agency_id, load]);

  const trialDaysLeft = agency?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const isTrial    = agency?.status === 'trial';
  const isSuspended = agency?.status === 'suspended' || agency?.status === 'past_due';
  const statusCfg  = STATUS_CONFIG[agency?.status ?? 'active'] ?? STATUS_CONFIG.active;

  const planInfo = PLANS_INFO.find((p) => p.id === (currentPlan?.id ?? agency?.plan)) ?? PLANS_INFO[1];

  const openPayment = (planId: string) => {
    setSelectedPlanId(planId);
    setPaymentOpen(true);
  };

  const selectedPlanInfo = PLANS_INFO.find((p) => p.id === selectedPlanId) ?? PLANS_INFO[1];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Chargement…</p>
        </div>
      </div>
    );
  }

  const renderUsageBar = (
    icon: React.ReactNode, label: string, used: number, max: number, testId?: string,
  ) => {
    const unlimited = max === -1 || max >= 999;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    const danger = pct > 85;
    const warn   = pct > 65;
    const barColor = danger ? '#EF4444' : warn ? '#F59E0B' : '#F58220';

    return (
      <div className="flex flex-col gap-1.5" data-testid={testId}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-slate-400">{icon}</div>
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {used}{unlimited ? '' : ` / ${max}`}
            {unlimited && <span className="ml-1 text-xs font-normal text-slate-400">(illimité)</span>}
          </span>
        </div>
        {!unlimited && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Abonnement</h1>
        <p className="text-sm text-slate-500 mt-1">Gérez votre plan, votre utilisation et votre facturation</p>
      </div>

      {/* ─── Bannière urgente ─── */}
      {isTrial && trialDaysLeft !== null && (
        <div
          className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{
            background: trialDaysLeft <= 3 ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)' : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: `1.5px solid ${trialDaysLeft <= 3 ? '#FECACA' : '#FDE68A'}`,
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            {trialDaysLeft <= 3
              ? <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-500" />
              : <Clock className="w-6 h-6 flex-shrink-0 text-amber-500" />}
            <div>
              <p className={`font-bold ${trialDaysLeft <= 3 ? 'text-red-900' : 'text-amber-900'}`} data-testid="text-trial-days">
                {trialDaysLeft > 0
                  ? `Essai gratuit : ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} restant${trialDaysLeft > 1 ? 's' : ''}`
                  : 'Essai gratuit expiré'}
              </p>
              <p className={`text-sm ${trialDaysLeft <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
                Passez au plan Pro pour conserver vos données et débloquer toutes les fonctionnalités.
              </p>
            </div>
          </div>
          <button
            onClick={() => openPayment('pro')}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-white font-bold text-sm transition hover:opacity-90 shadow"
            style={{ background: 'linear-gradient(135deg, #F58220 0%, #C2410C 100%)' }}
          >
            Activer maintenant
          </button>
        </div>
      )}

      {isSuspended && (
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', border: '1.5px solid #FECACA' }}>
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-bold text-red-900">Compte suspendu</p>
              <p className="text-sm text-red-700">Renouvelez votre abonnement pour retrouver l'accès complet.</p>
            </div>
          </div>
          <button
            onClick={() => openPayment('pro')}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-white font-bold text-sm bg-red-600 hover:bg-red-700 transition shadow"
          >
            Réactiver
          </button>
        </div>
      )}

      {/* ─── Plan actuel ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: planInfo.color + '18' }}>
                <planInfo.icon className="w-7 h-7" style={{ color: planInfo.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Plan actuel</p>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}
                    data-testid="badge-status"
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5" data-testid="text-current-plan">
                  {currentPlan?.name ?? planInfo.name}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {currentPlan
                    ? <>{formatCurrency(currentPlan.price_xof)} <span className="text-slate-400">/ mois</span></>
                    : planInfo.price_xof > 0
                    ? <>{formatCurrency(planInfo.price_xof)} <span className="text-slate-400">/ mois</span></>
                    : <span className="text-green-600 font-semibold">Gratuit</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              {subscription && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Renouvellement le {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPayment(currentPlan?.id !== 'agence' ? 'pro' : 'agence')}
                  data-testid="button-pay"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition hover:opacity-90 shadow-md"
                  style={{ background: 'linear-gradient(135deg, #F58220 0%, #C2410C 100%)' }}
                >
                  <CreditCard className="w-4 h-4" />
                  Renouveler
                </button>
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  data-testid="button-upgrade"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm transition hover:bg-slate-50"
                >
                  <TrendingUp className="w-4 h-4" />
                  Changer de plan
                </button>
              </div>
            </div>
          </div>

          {/* Utilisation */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {renderUsageBar(<Users className="w-4 h-4" />, 'Utilisateurs', usage.users, currentPlan?.max_users ?? planInfo.max_users, 'usage-utilisateurs')}
            {renderUsageBar(<Home className="w-4 h-4" />, 'Immeubles', usage.immeubles, currentPlan?.max_immeubles ?? planInfo.max_immeubles, 'usage-immeubles')}
            {renderUsageBar(<DoorOpen className="w-4 h-4" />, 'Unités', usage.unites, currentPlan?.max_unites ?? planInfo.max_unites, 'usage-produits')}
          </div>
        </div>
      </div>

      {/* ─── Comparer les plans ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-1">Comparer les plans</h2>
        <p className="text-sm text-slate-500 mb-5">Évoluez quand vous êtes prêt, sans engagement.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS_INFO.map((plan) => {
            const isCurrentPlan = (currentPlan?.id ?? agency?.plan) === plan.id;
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className="relative rounded-2xl border-2 p-4 flex flex-col gap-4 transition-all"
                style={{
                  borderColor: isCurrentPlan ? plan.color : '#E2E8F0',
                  backgroundColor: isCurrentPlan ? plan.color + '08' : '#FAFAFA',
                }}
              >
                {plan.badge && !isCurrentPlan && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: plan.color }}
                  >
                    {plan.badge}
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: plan.color }}>
                    Plan actuel
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.color + '18' }}>
                    <Icon className="w-5 h-5" style={{ color: plan.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{plan.name}</p>
                    <p className="text-sm font-semibold" style={{ color: plan.color }}>
                      {formatCurrency(plan.price_xof)}<span className="text-xs text-slate-400 font-normal">/mois</span>
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="text-center py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: plan.color + '18', color: plan.color }}>
                    Plan actuel
                  </div>
                ) : plan.id === 'agence' ? (
                  <a
                    href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux passer au plan Agence sur Samay Këur.')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: plan.color }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Contacter l'équipe
                  </a>
                ) : (
                  <button
                    onClick={() => openPayment(plan.id)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: plan.color }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Passer au {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Historique ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Historique des paiements</h2>
        {history.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucun paiement enregistré pour l'instant.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((s) => {
              const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.active;
              return (
                <li key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{s.subscription_plans?.name ?? s.plan_id}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.current_period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(s.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold self-start sm:self-auto"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  >
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ─── Aide et contact ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Besoin d'aide ?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, j\'ai une question concernant mon abonnement Samay Këur.')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 group-hover:bg-green-200 transition">
              <Smartphone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">WhatsApp</p>
              <p className="text-xs text-slate-500">Réponse rapide · Support humain</p>
            </div>
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question abonnement Samay Këur')}`}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 group-hover:bg-orange-200 transition">
              <Mail className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Email</p>
              <p className="text-xs text-slate-500">{CONTACT_EMAIL}</p>
            </div>
          </a>
        </div>
      </div>

      {/* ─── Modal changement de plan ─── */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setUpgradeOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Changer de plan</h3>
              <p className="text-sm text-slate-500 mt-1">Choisissez le plan qui correspond à votre activité.</p>
            </div>
            <div className="space-y-2">
              {PLANS_INFO.map((plan) => {
                const Icon = plan.icon;
                const isCurrent = (currentPlan?.id ?? agency?.plan) === plan.id;
                return (
                  <button
                    key={plan.id}
                    disabled={isCurrent}
                    onClick={() => {
                      setUpgradeOpen(false);
                      if (plan.id === 'agence') {
                        window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux passer au plan Agence sur Samay Këur.')}`, '_blank');
                      } else {
                        openPayment(plan.id);
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 transition text-left disabled:opacity-50 disabled:cursor-default hover:enabled:shadow-md"
                    style={{
                      borderColor: isCurrent ? plan.color : '#E2E8F0',
                      backgroundColor: isCurrent ? plan.color + '08' : 'white',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.color + '18' }}>
                        <Icon className="w-5 h-5" style={{ color: plan.color }} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{plan.name}</p>
                        <p className="text-xs" style={{ color: plan.color }}>{formatCurrency(plan.price_xof)}/mois</p>
                      </div>
                    </div>
                    {isCurrent
                      ? <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: plan.color }}>Actuel</span>
                      : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setUpgradeOpen(false)} className="w-full text-sm text-slate-400 hover:text-slate-700 py-1 transition">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ─── Checkout Modal ─── */}
      <CheckoutModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        planId={selectedPlanId}
        planName={selectedPlanInfo.name}
        priceXof={selectedPlanInfo.price_xof}
        onSuccess={() => {
          setPaymentOpen(false);
          toast.success(`Plan ${selectedPlanInfo.name} activé pour 30 jours !`);
          load();
        }}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
