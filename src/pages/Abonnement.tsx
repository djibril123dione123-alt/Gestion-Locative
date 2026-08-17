import { useEffect, useMemo, useState, useCallback, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { submitSubscriptionPaymentProof } from '../services/tenantAdministrationCommands';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import {
  WizardShell,
  wizardPrimaryActionClass,
  wizardSecondaryActionClass,
} from '../components/ui/WizardShell';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import {
  CreditCard, CheckCircle2, Clock, Zap, Building2, Crown,
  BarChart3, TrendingUp, AlertTriangle, Calendar, Users,
  Home, DoorOpen, ChevronRight, ArrowUpRight, HardDrive,
  FileCheck2, Send,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { PageSkeleton } from '../components/ui/Skeleton';
import { formatStorageSize, getAgencyStorageUsage, type StorageUsage } from '../services/documentStorage';
import gmailLogo from '../assets/support/gmail.png';
import whatsappLogo from '../assets/support/whatsapp.jpg';
import { CONTACT_EMAIL, CONTACT_WHATSAPP, FOUNDER_OFFER, PRICING_PLAN_DEFINITIONS, type PlanId } from '../lib/pricingCatalog';

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
  founder_eligible: boolean | null;
  founder_paid_cycles_used: number | null;
  founder_cycles_total: number | null;
}

interface Usage {
  users: number;
  immeubles: number;
  unites: number;
}

interface SubscriptionPaymentProof {
  id: string;
  agency_id: string;
  subscription_id: string | null;
  plan_key: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  payment_date: string | null;
  proof_file_url: string | null;
  proof_storage_path: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  created_at: string;
}

interface AbonnementProps {
  embedded?: boolean;
}

function SupportLogo({ src, alt, fallback, className }: { src: string; alt: string; fallback: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden bg-white ${className}`}>
      {!failed ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[0.62rem] font-black text-slate-700">{fallback}</span>
      )}
    </span>
  );
}

// Plans canoniques — source de vérité pour l'UI
const PLAN_ICONS: Record<PlanId, typeof Zap> = {
  starter: Zap,
  pro: Building2,
  business: BarChart3,
  enterprise: Crown,
};

const PLAN_CATALOG = PRICING_PLAN_DEFINITIONS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  price_xof: plan.price_xof,
  founder_price_xof: plan.founderPriceXof ?? null,
  max_users: plan.limits.max_users,
  max_immeubles: plan.limits.max_immeubles,
  max_unites: plan.limits.max_unites,
  storage_gb: plan.limits.storage_gb,
  icon: PLAN_ICONS[plan.id],
  color: plan.accent,
  badge: plan.badge,
  features: plan.features,
}));

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Actif',     color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  trial:     { label: 'Essai',     color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  past_due:  { label: 'Impayé',   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  suspended: { label: 'Suspendu', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  cancelled: { label: 'Annulé',   color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
};

const MANUAL_PAYMENT_METHODS = [
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'wave', label: 'Wave' },
  { id: 'djamo', label: 'Djamo' },
  { id: 'bank_transfer', label: 'Virement' },
  { id: 'cash', label: 'Espèces' },
] as const;

const PROOF_STATUS_COPY: Record<SubscriptionPaymentProof['status'], { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  approved: { label: 'Validée', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Rejetée', className: 'bg-red-50 text-red-700 ring-red-200' },
};

export function Abonnement({ embedded = false }: AbonnementProps = {}) {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const toast = useToast();
  const [agency, setAgency]           = useState<Agency | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory]         = useState<Subscription[]>([]);
  const [usage, setUsage]             = useState<Usage>({ users: 0, immeubles: 0, unites: 0 });
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading]         = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [manualProofs, setManualProofs] = useState<SubscriptionPaymentProof[]>([]);
  const [proofsAvailable, setProofsAvailable] = useState(true);
  const [manualProofOpen, setManualProofOpen] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofForm, setProofForm] = useState({
    plan_key: 'pro',
    amount: '15000',
    method: 'wave',
    reference: '',
    payment_date: new Date().toISOString().slice(0, 10),
    proof_file_url: '',
    comment: '',
  });

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [agencyRes, subRes, limitsRes, storageRes] = await Promise.all([
        supabase.from('agencies').select('id, name, status, plan, trial_ends_at, founder_eligible, founder_paid_cycles_used, founder_cycles_total').eq('id', profile.agency_id).single(),
        supabase.from('subscriptions').select('*, subscription_plans(*)').eq('agency_id', profile.agency_id).order('created_at', { ascending: false }),
        supabase.rpc('check_plan_limits', { p_agency_id: profile.agency_id }),
        getAgencyStorageUsage(profile.agency_id).catch(() => null),
      ]);

      if (agencyRes.data) setAgency(agencyRes.data as Agency);

      if (subRes.data && subRes.data.length > 0) {
        const subs = subRes.data as Subscription[];
        const activePaidSub = subs.find((sub) => sub.status === 'active' && sub.plan_id !== 'starter');
        const effectiveSub = isIndividualOwner ? activePaidSub ?? subs[0] : subs[0];
        setSubscription(effectiveSub);
        setCurrentPlan(activePaidSub?.subscription_plans ?? (!isIndividualOwner ? subs[0].subscription_plans ?? null : null));
        setHistory(subs);
      } else if (agencyRes.data?.plan && !isIndividualOwner) {
        const { data: planData } = await supabase
          .from('subscription_plans').select('*').eq('id', agencyRes.data.plan).maybeSingle();
        if (planData) setCurrentPlan(planData as Plan);
      } else {
        setCurrentPlan(null);
      }

      if (limitsRes.data?.usage) setUsage(limitsRes.data.usage as Usage);
      if (storageRes) setStorageUsage(storageRes);

      const { data: proofRows, error: proofError } = await supabase
        .from('subscription_payment_proofs')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (proofError) {
        const missingTable = proofError.code === '42P01' || /subscription_payment_proofs|does not exist/i.test(proofError.message ?? '');
        if (missingTable) {
          setProofsAvailable(false);
          setManualProofs([]);
        } else {
          console.warn('Erreur chargement preuves abonnement:', proofError.message);
        }
      } else {
        setProofsAvailable(true);
        setManualProofs((proofRows ?? []) as SubscriptionPaymentProof[]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [isIndividualOwner, profile?.agency_id, toast]);

  useEffect(() => { if (profile?.agency_id) load(); }, [profile?.agency_id, load]);

  const trialDaysLeft = agency?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const isTrial     = agency?.status === 'trial';
  const isSuspended = agency?.status === 'suspended' || agency?.status === 'past_due';
  const statusCfg   = STATUS_CONFIG[agency?.status ?? 'active'] ?? STATUS_CONFIG.active;

  const hasActivePaidSubscription = subscription?.status === 'active' && subscription.plan_id !== 'starter';
  const currentPlanId = isIndividualOwner && !hasActivePaidSubscription ? 'starter' : currentPlan?.id ?? agency?.plan ?? 'starter';
  const catalogPlan   = PLAN_CATALOG.find((p) => p.id === currentPlanId) ?? PLAN_CATALOG[0];
  const displayedPlanName = catalogPlan.name;
  const selectedCatalogPlan = PLAN_CATALOG.find((p) => p.id === selectedPlanId) ?? PLAN_CATALOG[1];

  // Offre Fondateurs : acquise à l'agence tant qu'il lui reste des cycles payants
  // fondateurs — jamais retirée en cours de route même si l'offre publique ferme.
  const founderCyclesUsed = agency?.founder_paid_cycles_used ?? 0;
  const founderCyclesTotal = agency?.founder_cycles_total ?? FOUNDER_OFFER.paidCycles;
  const founderActive = Boolean(agency?.founder_eligible) && founderCyclesUsed < founderCyclesTotal;
  const founderCyclesLeft = Math.max(0, founderCyclesTotal - founderCyclesUsed);
  const effectivePrice = (plan: (typeof PLAN_CATALOG)[number]) =>
    founderActive && plan.founder_price_xof ? plan.founder_price_xof : plan.price_xof;
  const isFounderPrice = (plan: (typeof PLAN_CATALOG)[number]) =>
    founderActive && Boolean(plan.founder_price_xof);
  const manualProofFormId = 'manual-proof-wizard-form';
  const proofCatalogPlan = PLAN_CATALOG.find((plan) => plan.id === proofForm.plan_key) ?? selectedCatalogPlan;
  const proofAmount = Number(proofForm.amount || 0);
  const latestManualProof = useMemo(() => manualProofs[0] ?? null, [manualProofs]);
  const getPlanFeatures = (plan: (typeof PLAN_CATALOG)[number]) => plan.features;

  const openPayment = (planId: string) => {
    setSelectedPlanId(planId);
    setPaymentOpen(true);
  };

  const openManualProof = () => {
    setProofForm({
      plan_key: currentPlanId === 'starter' ? 'pro' : currentPlanId,
      amount: String(catalogPlan.price_xof > 0 ? catalogPlan.price_xof : 15000),
      method: 'wave',
      reference: '',
      payment_date: new Date().toISOString().slice(0, 10),
      proof_file_url: '',
      comment: '',
    });
    setManualProofOpen(true);
  };

  const submitManualProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.agency_id) return;
    const amount = Number(proofForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Indiquez un montant valide.');
      return;
    }

    setSubmittingProof(true);
    try {
      await submitSubscriptionPaymentProof({
        subscriptionId: subscription?.id ?? null,
        planKey: proofForm.plan_key,
        amount,
        method: proofForm.method,
        reference: proofForm.reference.trim() || null,
        paymentDate: proofForm.payment_date,
        proofFileUrl: proofForm.proof_file_url.trim() || null,
        comment: proofForm.comment.trim() || null,
      });
      toast.success('Preuve transmise au support.');
      setManualProofOpen(false);
      load();
    } catch {
      toast.error("Impossible d'enregistrer la preuve pour le moment.");
    } finally {
      setSubmittingProof(false);
    }
  };

  const renderUsageBar = (
    icon: React.ReactNode,
    label: string,
    used: number,
    max: number,
    testId?: string,
    displayValue?: string
  ) => {
    const unlimited = max === -1;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    const toneClass =
      pct > 85
        ? 'bg-red-500'
        : pct > 65
          ? 'bg-amber-500'
          : 'bg-emerald-500';

    return (
      <div
        data-testid={testId}
        className="flex flex-col justify-between rounded-xl border border-emerald-950/10 bg-white/90 p-3 shadow-xs transition hover:border-emerald-500/30"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
              {icon}
            </div>
            <span className="text-[0.72rem] font-extrabold text-slate-800">{label}</span>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-slate-600">
            {unlimited ? 'Illimité' : `${pct}%`}
          </span>
        </div>

        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[0.68rem] font-extrabold text-slate-900">
            <span>Consommation</span>
            <span>
              {displayValue ? (
                displayValue
              ) : unlimited ? (
                'Sur mesure'
              ) : (
                <>
                  {used} <span className="font-semibold text-slate-400">/ {max}</span>
                </>
              )}
            </span>
          </div>
          {!unlimited && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-500 ${toneClass}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <PageSkeleton title="Abonnement & Formules" variant="dashboard" />;
  }

  return (
    <div className={embedded ? 'space-y-2.5 sm:space-y-3' : 'sk-mobile-page sk-page-narrow space-y-5 sm:space-y-6'}>

      {!embedded && (
      <PremiumPageHeader
        density="compact"
        eyebrow="PARAMÈTRES AGENCE"
        title="Abonnement"
        description={isIndividualOwner
          ? 'Gérez votre plan, vos limites et votre capacité patrimoniale.'
          : 'Gérez votre plan, vos limites et votre capacité opérationnelle.'}
        mobileDescription="Plan et limites."
        sideContent={
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-emerald-950/10 bg-white/85 p-2 shadow-sm">
            {[
              ['Plan', displayedPlanName],
              ['Statut', statusCfg.label],
              ['Usage', String(usage.unites) + (isIndividualOwner ? ' unités suivies' : ' unités')],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl bg-[#fff8ed] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        }
      />
      )}

      {/* ── Bannière urgente essai ── */}
      {embedded && (
        <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.65fr)]">
          <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8]/92 p-2.5 shadow-sm">
            <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Abonnement & paiements</p>
            <h2 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Plan, limites et validation des paiements.</h2>
            <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-600">
              Le paiement en ligne reste prioritaire. Pour un paiement manuel, le support valide la preuve et active le plan.
            </p>
          </div>
          <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 p-2.5 shadow-sm">
            <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-orange-700">Paiement manuel</p>
            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[0.72rem] font-extrabold text-slate-950">Validation par support</p>
                {proofsAvailable && latestManualProof ? (
                  <p className="mt-0.5 truncate text-[0.62rem] font-semibold text-slate-600">
                    Dernière preuve · {formatCurrency(Number(latestManualProof.amount))}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[0.62rem] font-semibold leading-3 text-slate-600">
                    Problème de paiement ? Contactez le support ou déclarez une preuve.
                  </p>
                )}
              </div>
              {proofsAvailable && latestManualProof ? (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ring-1 ${PROOF_STATUS_COPY[latestManualProof.status].className}`}>
                  {PROOF_STATUS_COPY[latestManualProof.status].label}
                </span>
              ) : null}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {proofsAvailable && (
                <button
                  type="button"
                  onClick={openManualProof}
                  className="inline-flex h-8.5 items-center justify-center rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-black text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                >
                  <FileCheck2 className="mr-1.5 h-4 w-4 text-emerald-700" />
                  Déclarer une preuve
                </button>
              )}
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8.5 items-center justify-center rounded-xl border border-emerald-600/30 bg-emerald-50/90 px-3 text-xs font-black text-emerald-950 shadow-sm transition hover:bg-emerald-100/90"
              >
                <SupportLogo src={whatsappLogo} alt="WhatsApp" fallback="WA" className="mr-2 h-5 w-5 shrink-0 rounded-md border border-black/5" />
                WhatsApp
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex h-8.5 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <SupportLogo src={gmailLogo} alt="Gmail" fallback="GM" className="mr-2 h-5 w-5 shrink-0 rounded-md border border-black/5" />
                Email
              </a>
            </div>
          </div>
        </section>
      )}

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
            className="sk-action sk-action-financial flex-shrink-0 px-5 py-2.5">
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
      <div className={embedded ? 'overflow-hidden rounded-xl border border-emerald-950/10 bg-white/88 shadow-sm' : 'sk-premium-panel overflow-hidden'}>
        <div className={embedded ? 'p-2.5' : 'p-5 sm:p-6'}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className={embedded ? 'flex items-center gap-2.5' : 'flex items-center gap-4'}>
              <div className={embedded ? 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg' : 'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0'}
                style={{ backgroundColor: catalogPlan.color + '18' }}>
                <catalogPlan.icon className={embedded ? 'h-4 w-4' : 'w-7 h-7'} style={{ color: catalogPlan.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={embedded ? 'text-[0.5rem] font-black uppercase tracking-[0.14em] text-slate-400' : 'text-xs font-bold text-slate-400 uppercase tracking-wider'}>Plan actuel</p>
                  <span className={embedded ? 'inline-flex rounded-full px-1.5 py-0.5 text-[0.56rem] font-bold' : 'inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold'} data-testid="badge-status"
                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                    {statusCfg.label}
                  </span>
                </div>
                <p className={embedded ? 'mt-0.5 text-[1rem] font-extrabold text-slate-900' : 'text-2xl font-extrabold text-slate-900 mt-0.5'} data-testid="text-current-plan">
                  {displayedPlanName}
                  {isFounderPrice(catalogPlan) && (
                    <span className="ml-2 inline-flex rounded-full bg-emerald-900 px-2 py-0.5 align-middle text-[0.5rem] font-black uppercase tracking-[0.08em] text-white">
                      {FOUNDER_OFFER.badgeLabel}
                    </span>
                  )}
                </p>
                <p className={embedded ? 'mt-0.5 text-[0.7rem] text-slate-400' : 'text-sm text-slate-400 mt-0.5'}>
                  {catalogPlan.price_xof > 0 ? (
                    isFounderPrice(catalogPlan) ? (
                      <span className="inline-flex flex-wrap items-baseline gap-1.5">
                        <span className="font-extrabold text-slate-900">{formatCurrency(effectivePrice(catalogPlan))}<span className="text-xs font-semibold text-slate-400">/mois</span></span>
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(catalogPlan.price_xof)}</span>
                        <span className="text-[0.62rem] font-semibold text-emerald-700">Offre Fondateurs · {founderCyclesLeft} cycle{founderCyclesLeft > 1 ? 's' : ''} payant{founderCyclesLeft > 1 ? 's' : ''} restant{founderCyclesLeft > 1 ? 's' : ''}</span>
                      </span>
                    ) : (
                      <>{formatCurrency(catalogPlan.price_xof)}<span className="text-xs">/mois</span></>
                    )
                  ) : (
                    <span className="text-green-600 font-semibold">Sur devis</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              {subscription && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Renouvellement le {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openPayment(currentPlanId)} data-testid="button-pay"
                  className={embedded ? 'sk-action sk-action-financial h-8 px-2.5 text-[0.7rem]' : 'sk-action sk-action-financial px-4 py-2.5'}>
                  <CreditCard className="w-4 h-4" />
                  Renouveler
                </button>
                <button onClick={() => setUpgradeOpen(true)} data-testid="button-upgrade"
                  className={embedded ? 'sk-action sk-action-secondary h-8 px-2.5 text-[0.7rem]' : 'sk-action sk-action-secondary px-4 py-2.5'}>
                  <TrendingUp className="w-4 h-4" />
                  Changer de plan
                </button>
              </div>
            </div>
          </div>

          {/* Usage bars */}
          <div className={embedded ? 'mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4' : 'mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'}>
            {renderUsageBar(<Users className="w-4 h-4" />, 'Utilisateurs', usage.users, currentPlan?.max_users ?? catalogPlan.max_users, 'usage-utilisateurs')}
            {renderUsageBar(<Home className="w-4 h-4" />, isIndividualOwner ? 'Biens' : 'Immeubles', usage.immeubles, currentPlan?.max_immeubles ?? catalogPlan.max_immeubles, 'usage-immeubles')}
            {renderUsageBar(<DoorOpen className="w-4 h-4" />, isIndividualOwner ? 'Unités locatives' : 'Unités', usage.unites, currentPlan?.max_unites ?? catalogPlan.max_unites, 'usage-produits')}
            {renderUsageBar(
              <HardDrive className="w-4 h-4" />,
              'Stockage',
              Math.round((storageUsage?.used_bytes ?? 0) / 1024 / 1024),
              Math.max(
                1,
                Math.round(
                  (storageUsage?.limit_bytes ?? ((currentPlan?.storage_gb ?? catalogPlan.storage_gb) * 1024 * 1024 * 1024)) /
                    1024 /
                    1024
                )
              ),
              'usage-stockage',
              storageUsage
                ? `${formatStorageSize(storageUsage.used_bytes)} / ${formatStorageSize(storageUsage.limit_bytes)}`
                : undefined
            )}
          </div>
        </div>
      </div>

      {proofsAvailable && (
        <div className={embedded ? 'rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm' : 'sk-premium-panel p-5 sm:p-6'}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={embedded ? 'text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700' : 'text-xs font-bold uppercase tracking-wider text-emerald-700'}>
                Paiements manuels
              </p>
              <h2 className={embedded ? 'mt-0.5 text-[0.82rem] font-extrabold text-slate-900' : 'mt-1 text-lg font-bold text-slate-900'}>
                Preuves transmises au support
              </h2>
              <p className={embedded ? 'mt-0.5 text-[0.66rem] leading-4 text-slate-500' : 'mt-1 text-sm text-slate-500'}>
                Le paiement en ligne reste prioritaire. Les preuves manuelles sont validées par le support.
              </p>
            </div>
            <button
              type="button"
              onClick={openManualProof}
              className={embedded ? 'sk-action sk-action-secondary h-8 px-2.5 text-[0.7rem]' : 'sk-action sk-action-secondary px-4 py-2.5'}
            >
              <FileCheck2 className="h-4 w-4" />
              Déclarer une preuve
            </button>
          </div>

          {manualProofs.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-emerald-950/12 bg-[#fffdf8] p-2 text-[0.66rem] font-semibold text-slate-500">
              Aucune preuve manuelle transmise. Pour un paiement hors ligne, ajoutez la référence ou contactez le support.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-[#fffdf8]">
              {manualProofs.map((proof) => {
                const status = PROOF_STATUS_COPY[proof.status] ?? PROOF_STATUS_COPY.pending;
                const methodLabel = MANUAL_PAYMENT_METHODS.find((method) => method.id === proof.method)?.label ?? proof.method;
                return (
                  <li key={proof.id} className="flex flex-col gap-1.5 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[0.7rem] font-extrabold text-slate-900">
                        {formatCurrency(Number(proof.amount))} · {methodLabel}
                      </p>
                      <p className="truncate text-[0.58rem] font-semibold text-slate-500">
                        {proof.reference ? `Réf. ${proof.reference} · ` : ''}
                        {new Date(proof.payment_date ?? proof.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      {proof.comment && (
                        <p className="truncate text-[0.56rem] font-medium text-slate-400">{proof.comment}</p>
                      )}
                    </div>
                    <span className={`w-fit rounded-full px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ring-1 ${status.className}`}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Grille comparaison plans ── */}
      <div className={embedded ? 'rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm' : 'sk-premium-panel p-5 sm:p-6'}>
        <div className={embedded ? 'mb-2.5 flex items-center justify-between' : 'flex items-center justify-between mb-5'}>
          <div>
            <h2 className={embedded ? 'text-[0.82rem] font-extrabold text-slate-900' : 'font-bold text-slate-900 text-lg'}>Comparer les plans</h2>
            <p className={embedded ? 'mt-0.5 text-[0.68rem] text-slate-400' : 'text-sm text-slate-400 mt-0.5'}>
              {FOUNDER_OFFER.trialDays} jours d'essai offerts avant la première échéance · Orange Money · Wave · Djamo · Carte
            </p>
          </div>
          <a href="#/pricing" className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition" style={{ color: '#F58220' }}>
            Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const Icon = plan.icon;
            const isHigher = PLAN_CATALOG.findIndex((p) => p.id === plan.id) > PLAN_CATALOG.findIndex((p) => p.id === currentPlanId);
            return (
              <div key={plan.id}
                className={embedded ? 'relative flex flex-col gap-1.5 rounded-xl border p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md' : 'relative flex flex-col gap-3 rounded-[1.25rem] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium'}
                style={{ borderColor: isCurrent ? plan.color : '#E2E8F0', backgroundColor: isCurrent ? plan.color + '06' : '#FAFAFA' }}>
                {'badge' in plan && !isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[0.58rem] font-bold text-white"
                    style={{ backgroundColor: plan.color }}>
                    {(plan as typeof plan & { badge?: string }).badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[0.58rem] font-bold text-white"
                    style={{ backgroundColor: plan.color }}>
                    Actuel
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: plan.color + '18' }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: plan.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1 text-[0.76rem] font-bold text-slate-900">
                      {plan.name}
                      {isFounderPrice(plan) && (
                        <span className="rounded-full bg-emerald-900 px-1.5 py-0.5 text-[0.44rem] font-black uppercase tracking-[0.06em] text-white">
                          {FOUNDER_OFFER.badgeLabel}
                        </span>
                      )}
                    </p>
                    {plan.price_xof > 0 ? (
                      isFounderPrice(plan) ? (
                        <p className="flex flex-wrap items-baseline gap-1 text-[0.66rem] font-semibold">
                          <span style={{ color: plan.color }}>{formatCurrency(effectivePrice(plan))}/mois</span>
                          <span className="text-slate-400 line-through">{formatCurrency(plan.price_xof)}</span>
                        </p>
                      ) : (
                        <p className="text-[0.66rem] font-semibold" style={{ color: plan.color }}>
                          {formatCurrency(plan.price_xof)}/mois
                        </p>
                      )
                    ) : (
                      <p className="text-[0.66rem] font-semibold" style={{ color: plan.color }}>Sur devis</p>
                    )}
                  </div>
                </div>

                <ul className="flex-1 space-y-0.5">
                  {getPlanFeatures(plan).slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[0.66rem] text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="rounded-lg py-1 text-center text-[0.68rem] font-bold"
                    style={{ backgroundColor: plan.color + '18', color: plan.color }}>
                    Plan actuel
                  </div>
                ) : plan.id === 'enterprise' ? (
                  <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux un devis Entreprise Samay Këur.')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 rounded-lg py-1 text-[0.68rem] font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: plan.color }}>
                    Contacter
                  </a>
                ) : (
                  <button onClick={() => openPayment(plan.id)}
                    className="sk-action sk-action-financial justify-center py-1 text-[0.68rem]">
                    {isHigher ? <><TrendingUp className="w-3 h-3" />Passer au {plan.name}</> : <><ChevronRight className="w-3 h-3" />Sélectionner</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[0.6rem] leading-4 text-slate-400">{FOUNDER_OFFER.disclaimer}</p>
      </div>

      {/* ── Historique ── */}
      <div className={embedded ? 'rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm' : 'sk-premium-panel p-5 sm:p-6'}>
        <h2 className={embedded ? 'mb-1.5 text-[0.82rem] font-extrabold text-slate-900' : 'font-bold text-slate-900 text-lg mb-4'}>Historique des paiements</h2>
        {history.length === 0 ? (
          <div className={embedded ? 'py-3 text-center' : 'text-center py-8'}>
            <CreditCard className={embedded ? 'mx-auto mb-1.5 h-6 w-6 text-slate-200' : 'w-10 h-10 text-slate-200 mx-auto mb-3'} />
            <p className={embedded ? 'text-[0.7rem] text-slate-400' : 'text-sm text-slate-400'}>Aucun paiement enregistré pour l'instant.</p>
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
      {!embedded && (
        <div className="rounded-2xl border border-emerald-950/10 bg-white/92 p-3 shadow-sm">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-emerald-700">Support facturation</p>
              <h2 className="text-sm font-black text-slate-950">Problème de paiement ?</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500">Support compact, preuve manuelle disponible plus haut.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent("Bonjour, j'ai une question sur mon abonnement Samay Këur.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-green-300 hover:bg-green-50"
            >
              <SupportLogo src={whatsappLogo} alt="WhatsApp" fallback="WA" className="h-7 w-7 flex-shrink-0 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-slate-900">WhatsApp Business</p>
                <p className="text-xs text-slate-400">+221 76 901 09 60 · Réponse rapide</p>
              </div>
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question abonnement Samay Këur')}`}
              className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <SupportLogo src={gmailLogo} alt="Gmail" fallback="GM" className="h-7 w-7 flex-shrink-0 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Email</p>
                <p className="text-xs text-slate-400">{CONTACT_EMAIL}</p>
              </div>
            </a>
          </div>
        </div>
      )}

      <WizardShell
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Changer de plan"
        eyebrow="FACTURATION & PLAN"
        description="Comparez les capacités et activez le plan adapté à votre croissance."
        mobileDescription="Changer de plan."
        variant="classic"
        tone="finance"
        size="standard"
        mobileMode="fullscreen"
      >
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-[#031510] p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)] ring-1 ring-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.08),transparent_40%)] pointer-events-none" />
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent pointer-events-none" />
            
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse" />
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-emerald-400/90">VOTRE PLAN ACTUEL</p>
                  <p className="truncate text-[1.2rem] font-black text-white drop-shadow-sm">{displayedPlanName}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.05] px-3.5 py-1.5 text-[0.7rem] font-bold tracking-widest text-white shadow-inner backdrop-blur-md">
                  {catalogPlan.price_xof > 0 ? `${formatCurrency(effectivePrice(catalogPlan))} / MOIS` : 'SUR DEVIS'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {PLAN_CATALOG.map((plan) => {
              const Icon = plan.icon;
              const isCurr = currentPlanId === plan.id;
              const isEnterprise = plan.id === 'enterprise';
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={isCurr}
                  onClick={() => {
                    setUpgradeOpen(false);
                    if (plan.id === 'enterprise') {
                      window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux passer au plan Entreprise Samay Këur.')}`, '_blank');
                    } else {
                      openPayment(plan.id);
                    }
                  }}
                  className={`group relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-3xl border p-4 sm:p-5 text-left transition-all duration-500 ease-out ${
                    isCurr
                      ? 'cursor-default border-emerald-500/50 bg-gradient-to-br from-emerald-50/80 to-emerald-100/30 shadow-[0_8px_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
                      : isEnterprise
                      ? 'border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white hover:-translate-y-1 hover:border-slate-600 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:ring-1 hover:ring-slate-700'
                      : 'border-slate-200/80 bg-white hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/40 hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30'
                  }`}
                >
                  {isCurr && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_70%)] pointer-events-none" />}
                  {isEnterprise && !isCurr && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_70%)] pointer-events-none opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
                  {!isEnterprise && !isCurr && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.04),transparent_70%)] pointer-events-none opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
                  
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-500 group-hover:scale-110 ${
                          isEnterprise ? 'bg-white/10 ring-1 ring-white/20' : ''
                        }`}
                        style={!isEnterprise ? { backgroundColor: plan.color + '15', border: `1px solid ${plan.color}20` } : {}}
                      >
                        <Icon className="h-6 w-6" style={!isEnterprise ? { color: plan.color } : { color: '#f8fafc' }} />
                      </div>
                      <div className="min-w-0">
                        <p className={`flex flex-wrap items-center gap-1.5 truncate text-[1.1rem] font-black transition-colors duration-300 ${isEnterprise ? 'text-white group-hover:text-slate-200' : 'text-slate-900 group-hover:text-emerald-950'}`}>
                          {plan.name}
                          {isFounderPrice(plan) && (
                            <span className="rounded-full bg-emerald-900 px-1.5 py-0.5 text-[0.44rem] font-black uppercase tracking-[0.06em] text-white">
                              {FOUNDER_OFFER.badgeLabel}
                            </span>
                          )}
                        </p>
                        {plan.price_xof > 0 ? (
                          isFounderPrice(plan) ? (
                            <p className="mt-0.5 flex flex-wrap items-baseline gap-1 text-[0.75rem] font-extrabold">
                              <span style={{ color: plan.color }}>{formatCurrency(effectivePrice(plan))}/mois</span>
                              <span className="text-[0.65rem] font-semibold text-slate-400 line-through">{formatCurrency(plan.price_xof)}</span>
                            </p>
                          ) : (
                            <p className={`text-[0.75rem] font-extrabold mt-0.5 ${isEnterprise ? 'text-slate-400' : ''}`} style={!isEnterprise ? { color: plan.color } : {}}>
                              {formatCurrency(plan.price_xof)}/mois
                            </p>
                          )
                        ) : (
                          <p className={`text-[0.75rem] font-extrabold mt-0.5 ${isEnterprise ? 'text-slate-400' : ''}`}>Sur devis</p>
                        )}
                      </div>
                    </div>
                    {isCurr ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white shadow-md ring-2 ring-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Actuel
                      </span>
                    ) : (
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-500 ${
                        isEnterprise
                          ? 'border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:bg-slate-700 group-hover:text-white'
                          : 'border-slate-200/80 bg-slate-50 text-slate-400 group-hover:border-emerald-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                      }`}>
                        <ArrowUpRight className="h-4.5 w-4.5" />
                      </span>
                    )}
                  </div>

                  <div className={`relative mt-5 grid grid-cols-3 gap-2 rounded-2xl p-3 transition-colors duration-500 ${
                    isEnterprise ? 'bg-slate-800/50 group-hover:bg-slate-800/80' : 'bg-slate-50/80 group-hover:bg-emerald-50/50'
                  }`}>
                    <div className="text-center">
                      <p className={`text-[0.55rem] font-black uppercase tracking-widest ${isEnterprise ? 'text-slate-400' : 'text-slate-400'}`}>Utilisateurs</p>
                      <p className={`text-[0.9rem] font-black mt-0.5 ${isEnterprise ? 'text-white' : 'text-slate-800'}`}>{plan.max_users === -1 ? '∞' : plan.max_users}</p>
                    </div>
                    <div className={`border-l border-r px-1 text-center ${isEnterprise ? 'border-slate-700/50' : 'border-slate-200/70'}`}>
                      <p className={`text-[0.55rem] font-black uppercase tracking-widest ${isEnterprise ? 'text-slate-400' : 'text-slate-400'}`}>Unités</p>
                      <p className={`text-[0.9rem] font-black mt-0.5 ${isEnterprise ? 'text-white' : 'text-slate-800'}`}>{plan.max_unites === -1 ? '∞' : plan.max_unites}</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-[0.55rem] font-black uppercase tracking-widest ${isEnterprise ? 'text-slate-400' : 'text-slate-400'}`}>Stockage</p>
                      <p className={`text-[0.9rem] font-black mt-0.5 ${isEnterprise ? 'text-white' : 'text-slate-800'}`}>{plan.storage_gb === -1 ? '∞' : `${plan.storage_gb} Go`}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-inner">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-900/5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-[0.72rem] font-medium leading-relaxed text-slate-600">
              Le changement de plan <strong>conserve les données existantes</strong>. Seules les capacités sont ajustées.
            </span>
          </div>
        </div>
      </WizardShell>

      <WizardShell
        open={manualProofOpen}
        onClose={() => setManualProofOpen(false)}
        title="Déclarer une preuve"
        eyebrow="PAIEMENT MANUEL"
        description="Le support valide la preuve puis active le plan si le paiement est confirmé."
        mobileDescription="Preuve de paiement."
        variant="classic"
        tone="finance"
        size="standard"
        mobileMode="fullscreen"
        secondaryAction={(
          <button
            type="button"
            onClick={() => setManualProofOpen(false)}
            className={wizardSecondaryActionClass}
          >
            Annuler
          </button>
        )}
        primaryAction={(
          <button
            type="submit"
            form={manualProofFormId}
            disabled={submittingProof}
            className={wizardPrimaryActionClass}
          >
            {submittingProof ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Transmettre la preuve
          </button>
        )}
      >
        <form id={manualProofFormId} onSubmit={submitManualProof} className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-[#031510] p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)] ring-1 ring-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.08),transparent_40%)] pointer-events-none" />
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent pointer-events-none" />
            
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 ring-1 ring-white/15 backdrop-blur-md shadow-inner">
                  <FileCheck2 className="h-5 w-5 drop-shadow-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-emerald-400/90">DÉCLARATION OFFICIELLE</p>
                  <p className="truncate text-[1.1rem] font-black text-white drop-shadow-sm">Plan {proofCatalogPlan.name}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-emerald-400/90">MONTANT ESTIMÉ</p>
                <p className="text-[1.35rem] font-black tracking-tight text-white drop-shadow-md">
                  {formatCurrency(Number.isFinite(proofAmount) ? proofAmount : 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Plan</span>
              <SmartCombobox
                value={proofForm.plan_key}
                options={PLAN_CATALOG.filter((plan) => plan.id !== 'enterprise').map((plan) => ({
                  value: plan.id,
                  label: plan.name,
                  subtitle: `${formatCurrency(plan.price_xof)} / mois`,
                }))}
                onChange={(val) => {
                  setProofForm((form) => ({
                    ...form,
                    plan_key: val,
                    amount: String(PLAN_CATALOG.find((plan) => plan.id === val)?.price_xof || form.amount),
                  }));
                }}
                placeholder="Sélectionner un plan..."
                density="compact"
              />
            </div>

            <label className="block">
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Montant (XOF)</span>
              <input
                type="number"
                min="0"
                value={proofForm.amount}
                onChange={(event) => setProofForm((form) => ({ ...form, amount: event.target.value }))}
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.8rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:rounded-[0.6rem]"
              />
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Date paiement</span>
              <input
                type="date"
                value={proofForm.payment_date}
                onChange={(event) => setProofForm((form) => ({ ...form, payment_date: event.target.value }))}
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.8rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:rounded-[0.6rem]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Moyen de paiement</span>
              <SmartCombobox
                value={proofForm.method}
                options={MANUAL_PAYMENT_METHODS.map((method) => ({ value: method.id, label: method.label }))}
                onChange={(val) => setProofForm((form) => ({ ...form, method: val }))}
                placeholder="Moyen de paiement..."
                density="compact"
              />
            </div>

            <label className="block">
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Référence</span>
              <input
                type="text"
                value={proofForm.reference}
                onChange={(event) => setProofForm((form) => ({ ...form, reference: event.target.value }))}
                placeholder="Ex : WAVE-1289"
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.8rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:rounded-[0.6rem]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Lien preuve</span>
              <input
                type="url"
                value={proofForm.proof_file_url}
                onChange={(event) => setProofForm((form) => ({ ...form, proof_file_url: event.target.value }))}
                placeholder="Lien Drive, reçu ou capture"
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.8rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:rounded-[0.6rem]"
              />
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">Commentaire</span>
              <input
                type="text"
                value={proofForm.comment}
                onChange={(event) => setProofForm((form) => ({ ...form, comment: event.target.value }))}
                placeholder="Ex : paiement transmis par Wave"
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.8rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:rounded-[0.6rem]"
              />
            </label>
          </div>

          <div className="mt-4 flex items-start gap-4 rounded-xl border border-orange-200/80 bg-gradient-to-br from-orange-50/80 to-amber-50/30 p-4 shadow-sm sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100/80 text-orange-600 ring-1 ring-orange-200/50">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] font-black text-orange-950">Validation support requise</p>
              <p className="mt-0.5 text-[0.72rem] font-medium leading-relaxed text-orange-900/80">
                Ajoutez une référence claire (ou un lien vers la capture). Le plan sera activé dès validation.
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-flex rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-orange-700 shadow-sm">
                En attente
              </span>
            </div>
          </div>
        </form>
      </WizardShell>

      {/* ── Checkout modal ── */}
      <CheckoutModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        planId={selectedPlanId}
        planName={selectedCatalogPlan.name}
        priceXof={effectivePrice(selectedCatalogPlan)}
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
