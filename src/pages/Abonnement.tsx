import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import {
  CreditCard, CheckCircle2, Clock, Zap, Building2, Crown,
  BarChart3, TrendingUp, AlertTriangle, Calendar, Users,
  Home, DoorOpen, ChevronRight, Smartphone, Mail, ArrowUpRight,
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

const CONTACT_WHATSAPP = '221769010960';
const CONTACT_EMAIL    = 'samaykeur@gmail.com';

// Plans canoniques — source de vérité pour l'UI
const PLAN_CATALOG = [
  {
    id: 'starter',
    name: 'Starter',
    price_xof: 5000,
    max_users: 1,
    max_immeubles: 3,
    max_unites: 10,
    icon: Zap,
    color: '#475569',
    features: ['Tableau de bord loyers', 'Quittances PDF', 'Exports Excel', 'Rappels email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_xof: 15000,
    max_users: 5,
    max_immeubles: 20,
    max_unites: 100,
    icon: Building2,
    color: '#F58220',
    badge: 'Recommandé',
    features: ['Tout Starter', 'Notifications bailleurs', 'Rapports PDF mensuels', 'Alertes impayés', 'Commissions', 'Support WhatsApp'],
  },
  {
    id: 'business',
    name: 'Business',
    price_xof: 35000,
    max_users: 15,
    max_immeubles: 100,
    max_unites: 500,
    icon: BarChart3,
    color: '#0891B2',
    features: ['Tout Pro', '15 utilisateurs', 'Rapports agents', 'Multi-portefeuilles', 'API webhooks', 'Support < 4h'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_xof: 0,
    max_users: -1,
    max_immeubles: -1,
    max_unites: -1,
    icon: Crown,
    color: '#7C3AED',
    features: ['Tout Business', 'Illimité partout', 'White-label', 'SLA 99,9 %', 'Account manager', 'Formation sur site'],
  },
] as const;

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
  const [agency, setAgency]           = useState<Agency | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory]         = useState<Subscription[]>([]);
  const [usage, setUsage]             = useState<Usage>({ users: 0, immeubles: 0, unites: 0 });
  const [loading, setLoading]         = useState(true);
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => { if (profile?.agency_id) load(); }, [profile?.agency_id, load]);

  const trialDaysLeft = agency?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const isTrial     = agency?.status === 'trial';
  const isSuspended = agency?.status === 'suspended' || agency?.status === 'past_due';
  const statusCfg   = STATUS_CONFIG[agency?.status ?? 'active'] ?? STATUS_CONFIG.active;

  const currentPlanId = currentPlan?.id ?? agency?.plan ?? 'starter';
  const catalogPlan   = PLAN_CATALOG.find((p) => p.id === currentPlanId) ?? PLAN_CATALOG[1];
  const selectedCatalogPlan = PLAN_CATALOG.find((p) => p.id === selectedPlanId) ?? PLAN_CATALOG[1];

  const openPayment = (planId: string) => {
    setSelectedPlanId(planId);
    setPaymentOpen(true);
  };

  const renderUsageBar = (icon: React.ReactNode, label: string, used: number, max: number, testId?: string) => {
    const unlimited = max === -1 || max >= 999;
    const pct       = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    const barColor  = pct > 85 ? '#EF4444' : pct > 65 ? '#F59E0B' : '#F58220';

    return (
      <div data-testid={testId}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-slate-500">{icon}
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
          <span className="text-sm font-bold text-slate-800">
            {used}{unlimited ? <span className="text-xs font-normal text-slate-400 ml-1">(illimité)</span> : <span className="text-slate-400">/{max}</span>}
          </span>
        </div>
        {!unlimited && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Abonnement</h1>
        <p className="text-sm text-slate-400 mt-1">Gérez votre plan, votre utilisation et vos paiements</p>
      </div>

      {/* ── Bannière urgente essai ── */}
      {isTrial && trialDaysLeft !== null && (
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{
            background: trialDaysLeft <= 3 ? 'linear-gradient(135deg,#FEF2F2,#FEE2E2)' : 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
            border: `1.5px solid ${trialDaysLeft <= 3 ? '#FECACA' : '#FDE68A'}`,
          }}>
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
                Passez au plan Pro pour conserver toutes vos données et fonctionnalités.
              </p>
            </div>
          </div>
          <button onClick={() => openPayment('pro')}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow hover:opacity-90 transition"
            style={{ background: 'linear-gradient(135deg,#F58220,#C2410C)' }}>
            Activer maintenant
          </button>
        </div>
      )}

      {/* ── Bannière suspension ── */}
      {isSuspended && (
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', border: '1.5px solid #FECACA' }}>
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-bold text-red-900">Compte suspendu</p>
              <p className="text-sm text-red-700">Renouvelez votre abonnement pour retrouver l'accès complet.</p>
            </div>
          </div>
          <button onClick={() => openPayment(currentPlanId)}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-white font-bold text-sm bg-red-600 hover:bg-red-700 shadow transition">
            Réactiver
          </button>
        </div>
      )}

      {/* ── Plan actuel ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: catalogPlan.color + '18' }}>
                <catalogPlan.icon className="w-7 h-7" style={{ color: catalogPlan.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan actuel</p>
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold" data-testid="badge-status"
                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                    {statusCfg.label}
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5" data-testid="text-current-plan">
                  {currentPlan?.name ?? catalogPlan.name}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {catalogPlan.price_xof > 0
                    ? <>{formatCurrency(catalogPlan.price_xof)}<span className="text-xs">/mois</span></>
                    : <span className="text-green-600 font-semibold">Sur devis</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              {subscription && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Renouvellement le {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openPayment(currentPlanId)} data-testid="button-pay"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-md hover:opacity-90 transition"
                  style={{ background: 'linear-gradient(135deg,#F58220,#C2410C)' }}>
                  <CreditCard className="w-4 h-4" />
                  Renouveler
                </button>
                <button onClick={() => setUpgradeOpen(true)} data-testid="button-upgrade"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-medium text-sm hover:border-slate-300 hover:bg-slate-50 transition">
                  <TrendingUp className="w-4 h-4" />
                  Changer de plan
                </button>
              </div>
            </div>
          </div>

          {/* Usage bars */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {renderUsageBar(<Users className="w-4 h-4" />, 'Utilisateurs', usage.users, currentPlan?.max_users ?? catalogPlan.max_users, 'usage-utilisateurs')}
            {renderUsageBar(<Home className="w-4 h-4" />, 'Immeubles', usage.immeubles, currentPlan?.max_immeubles ?? catalogPlan.max_immeubles, 'usage-immeubles')}
            {renderUsageBar(<DoorOpen className="w-4 h-4" />, 'Unités', usage.unites, currentPlan?.max_unites ?? catalogPlan.max_unites, 'usage-produits')}
          </div>
        </div>
      </div>

      {/* ── Grille comparaison plans ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Comparer les plans</h2>
            <p className="text-sm text-slate-400 mt-0.5">Sans engagement · Orange Money · Wave · Djamo · Carte</p>
          </div>
          <a href="#/pricing" className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition" style={{ color: '#F58220' }}>
            Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const Icon = plan.icon;
            const isHigher = PLAN_CATALOG.findIndex((p) => p.id === plan.id) > PLAN_CATALOG.findIndex((p) => p.id === currentPlanId);
            return (
              <div key={plan.id}
                className="relative rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all"
                style={{ borderColor: isCurrent ? plan.color : '#E2E8F0', backgroundColor: isCurrent ? plan.color + '06' : '#FAFAFA' }}>
                {'badge' in plan && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: plan.color }}>
                    {(plan as typeof plan & { badge?: string }).badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: plan.color }}>
                    Actuel
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: plan.color + '18' }}>
                    <Icon className="w-4 h-4" style={{ color: plan.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{plan.name}</p>
                    <p className="text-xs font-semibold" style={{ color: plan.color }}>
                      {plan.price_xof > 0 ? formatCurrency(plan.price_xof) + '/mois' : 'Sur devis'}
                    </p>
                  </div>
                </div>

                <ul className="space-y-1 flex-1">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center py-1.5 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: plan.color + '18', color: plan.color }}>
                    Plan actuel
                  </div>
                ) : plan.id === 'enterprise' ? (
                  <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux un devis Enterprise Samay Këur.')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: plan.color }}>
                    Contacter
                  </a>
                ) : (
                  <button onClick={() => openPayment(plan.id)}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: plan.color }}>
                    {isHigher ? <><TrendingUp className="w-3 h-3" />Passer au {plan.name}</> : <><ChevronRight className="w-3 h-3" />Sélectionner</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Historique ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Historique des paiements</h2>
        {history.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
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
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold self-start sm:self-auto"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Support ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Besoin d'aide ?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, j\'ai une question sur mon abonnement Samay Këur.')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition group">
            <img src="/logo-whatsapp.jpg" alt="WhatsApp" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 text-sm">WhatsApp Business</p>
              <p className="text-xs text-slate-400">+221 76 901 09 60 · Réponse rapide</p>
            </div>
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question abonnement Samay Këur')}`}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition group">
            <img src="/logo-gmail.png" alt="Gmail" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 text-sm">Gmail</p>
              <p className="text-xs text-slate-400">{CONTACT_EMAIL}</p>
            </div>
          </a>
        </div>
      </div>

      {/* ── Modal changement de plan ── */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setUpgradeOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Changer de plan</h3>
              <p className="text-sm text-slate-400 mt-1">Sans engagement · Activation instantanée</p>
            </div>
            {PLAN_CATALOG.map((plan) => {
              const Icon = plan.icon;
              const isCurr = currentPlanId === plan.id;
              return (
                <button key={plan.id} disabled={isCurr}
                  onClick={() => {
                    setUpgradeOpen(false);
                    if (plan.id === 'enterprise') {
                      window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux passer au plan Enterprise Samay Këur.')}`, '_blank');
                    } else {
                      openPayment(plan.id);
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 transition text-left disabled:opacity-60 disabled:cursor-default hover:enabled:shadow-md"
                  style={{ borderColor: isCurr ? plan.color : '#E2E8F0', backgroundColor: isCurr ? plan.color + '08' : 'white' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.color + '18' }}>
                      <Icon className="w-4 h-4" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{plan.name}</p>
                      <p className="text-xs" style={{ color: plan.color }}>
                        {plan.price_xof > 0 ? formatCurrency(plan.price_xof) + '/mois' : 'Sur devis'}
                      </p>
                    </div>
                  </div>
                  {isCurr
                    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: plan.color }}>Actuel</span>
                    : <ChevronRight className="w-4 h-4 text-slate-300" />}
                </button>
              );
            })}
            <button type="button" onClick={() => setUpgradeOpen(false)}
              className="w-full text-sm text-slate-400 hover:text-slate-700 py-1 transition">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── Checkout modal ── */}
      <CheckoutModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        planId={selectedPlanId}
        planName={selectedCatalogPlan.name}
        priceXof={selectedCatalogPlan.price_xof}
        onSuccess={() => {
          setPaymentOpen(false);
          toast.success(`Plan ${selectedCatalogPlan.name} activé pour 30 jours !`);
          load();
        }}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
