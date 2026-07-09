import { useEffect, useMemo, useState, useCallback, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import { Modal } from '../components/ui/Modal';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import {
  CreditCard, CheckCircle2, Clock, Zap, Building2, Crown,
  BarChart3, TrendingUp, AlertTriangle, Calendar, Users,
  Home, DoorOpen, ChevronRight, ArrowUpRight, HardDrive,
  FileCheck2, Send,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { SkeletonCards, SkeletonTable } from '../components/ui/Skeleton';
import { formatStorageSize, getAgencyStorageUsage, type StorageUsage } from '../services/documentStorage';
import gmailLogo from '../assets/support/gmail.png';
import whatsappLogo from '../assets/support/whatsapp.jpg';
import { CONTACT_EMAIL, CONTACT_WHATSAPP, PRICING_PLAN_DEFINITIONS, type PlanId } from '../lib/pricingCatalog';

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
    <span className={`inline-flex items-center justify-center overflow-hidden border border-emerald-950/10 bg-white ${className}`}>
      {!failed ? (
        <img src={src} alt={alt} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
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
        supabase.from('agencies').select('id, name, status, plan, trial_ends_at').eq('id', profile.agency_id).single(),
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
  const latestManualProof = useMemo(() => manualProofs[0] ?? null, [manualProofs]);
  const getPlanFeatures = (plan: (typeof PLAN_CATALOG)[number]) => {
    if (!isIndividualOwner) return plan.features;
    const individualFeatures: Record<string, readonly string[]> = {
      starter: ['Suivi simple des loyers', 'Quittances professionnelles', 'Documents personnels', 'Support email'],
      pro: ['Tout Starter', 'Rapports propriétaires mensuels', 'Alertes impayés', 'Paiements partiels', 'Support WhatsApp'],
      business: ['Tout Pro', 'Portefeuille multi-biens', 'Stockage documentaire avancé', 'Reporting financier', 'Support prioritaire'],
      enterprise: ['Capacité sur mesure', 'Accompagnement personnalisé', 'SLA contractualisé', 'Formation sur site'],
    };
    return individualFeatures[plan.id] ?? plan.features;
  };

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
    const { error } = await supabase.from('subscription_payment_proofs').insert({
      agency_id: profile.agency_id,
      subscription_id: subscription?.id ?? null,
      plan_key: proofForm.plan_key,
      amount,
      currency: 'XOF',
      method: proofForm.method,
      reference: proofForm.reference.trim() || null,
      payment_date: proofForm.payment_date || null,
      proof_file_url: proofForm.proof_file_url.trim() || null,
      comment: proofForm.comment.trim() || null,
      status: 'pending',
      submitted_by: profile.id,
    });
    setSubmittingProof(false);

    if (error) {
      toast.error("Impossible d'enregistrer la preuve pour le moment.");
      return;
    }

    toast.success('Preuve transmise au support.');
    setManualProofOpen(false);
    load();
  };

  const renderUsageBar = (icon: React.ReactNode, label: string, used: number, max: number, testId?: string) => {
    const unlimited = max === -1;
    const pct       = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    const barColor  = pct > 85 ? '#EF4444' : pct > 65 ? '#F59E0B' : '#F58220';

    return (
      <div data-testid={testId}>
        <div className={embedded ? 'mb-1 flex items-center justify-between' : 'flex items-center justify-between mb-1.5'}>
          <div className={embedded ? 'flex items-center gap-1.5 text-slate-500' : 'flex items-center gap-2 text-slate-500'}>{icon}
            <span className={embedded ? 'text-xs font-semibold text-slate-700' : 'text-sm font-medium text-slate-700'}>{label}</span>
          </div>
          <span className={embedded ? 'text-xs font-bold text-slate-800' : 'text-sm font-bold text-slate-800'}>
            {unlimited ? <span className="text-xs font-semibold text-slate-500">sur mesure</span> : <>{used}<span className="text-slate-400">/{max}</span></>}
          </span>
        </div>
        {!unlimited && (
          <div className={embedded ? 'h-1.5 overflow-hidden rounded-full bg-slate-100' : 'h-2 bg-slate-100 rounded-full overflow-hidden'}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={embedded ? 'space-y-2.5 sm:space-y-3' : 'sk-mobile-page sk-page-narrow space-y-5 sm:space-y-6'}>
        <div className="rounded-[2rem] border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 sm:p-8 shadow-2xl shadow-emerald-950/15">
          <div className="h-4 w-32 animate-pulse rounded-full bg-white/15" />
          <div className="mt-5 h-8 w-64 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-full bg-white/10" />
        </div>
        <SkeletonCards count={3} />
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
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
        <section className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,0.65fr)]">
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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {proofsAvailable && (
                <button
                  type="button"
                  onClick={openManualProof}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-emerald-950/10 bg-white px-2.5 text-[0.68rem] font-extrabold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                  Déclarer
                </button>
              )}
              <a href={`https://wa.me/${CONTACT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center justify-center rounded-lg border border-emerald-950/10 bg-white px-2.5 text-[0.68rem] font-extrabold text-emerald-800 shadow-sm">
                <SupportLogo src={whatsappLogo} alt="WhatsApp" fallback="WA" className="mr-1.5 h-4 w-4 rounded-md" />
                WhatsApp
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex h-7 items-center justify-center rounded-lg border border-emerald-950/10 bg-white px-2.5 text-[0.68rem] font-extrabold text-emerald-800 shadow-sm">
                <SupportLogo src={gmailLogo} alt="Gmail" fallback="GM" className="mr-1.5 h-4 w-4 rounded-md" />
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
                </p>
                <p className={embedded ? 'mt-0.5 text-[0.7rem] text-slate-400' : 'text-sm text-slate-400 mt-0.5'}>
                  {catalogPlan.price_xof > 0
                    ? <>{formatCurrency(catalogPlan.price_xof)}<span className="text-xs">/mois</span></>
                    : <span className="text-green-600 font-semibold">Sur devis</span>}
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
          <div className={embedded ? 'mt-2.5 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-2.5 sm:grid-cols-2 xl:grid-cols-4' : 'mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5'}>
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
              'usage-stockage'
            )}
          </div>
          {storageUsage && (
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Stockage utilisé : {formatStorageSize(storageUsage.used_bytes)} sur {formatStorageSize(storageUsage.limit_bytes)}.
            </p>
          )}
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
            <p className={embedded ? 'mt-0.5 text-[0.68rem] text-slate-400' : 'text-sm text-slate-400 mt-0.5'}>Sans engagement · Orange Money · Wave · Djamo · Carte</p>
          </div>
          <a href="#/pricing" className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition" style={{ color: '#F58220' }}>
            Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
                  <div>
                    <p className="text-[0.76rem] font-bold text-slate-900">{plan.name}</p>
                    <p className="text-[0.66rem] font-semibold" style={{ color: plan.color }}>
                      {plan.price_xof > 0 ? formatCurrency(plan.price_xof) + '/mois' : 'Sur devis'}
                    </p>
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
                  <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux un devis Enterprise Samay Këur.')}`}
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
      <div className="sk-premium-panel p-5 sm:p-6">
        <h2 className={embedded ? 'mb-1.5 text-[0.82rem] font-extrabold text-slate-900' : 'font-bold text-slate-900 text-lg mb-4'}>Besoin d'aide ?</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <a href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, j\'ai une question sur mon abonnement Samay Këur.')}`}
            target="_blank" rel="noopener noreferrer"
            className={embedded ? 'flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 transition hover:border-green-300 hover:bg-green-50' : 'flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition group'}>
            <SupportLogo src={whatsappLogo} alt="WhatsApp" fallback="WA" className="h-10 w-10 flex-shrink-0 rounded-xl" />
            <div>
              <p className={embedded ? 'text-[0.72rem] font-semibold text-slate-900' : 'font-semibold text-slate-900 text-sm'}>WhatsApp Business</p>
              <p className={embedded ? 'text-[0.64rem] text-slate-400' : 'text-xs text-slate-400'}>+221 76 901 09 60 · Réponse rapide</p>
            </div>
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question abonnement Samay Këur')}`}
            className={embedded ? 'flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 transition hover:border-blue-300 hover:bg-blue-50' : 'flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition group'}>
            <SupportLogo src={gmailLogo} alt="Gmail" fallback="GM" className="h-10 w-10 flex-shrink-0 rounded-xl" />
            <div>
              <p className={embedded ? 'text-[0.72rem] font-semibold text-slate-900' : 'font-semibold text-slate-900 text-sm'}>Gmail</p>
              <p className={embedded ? 'text-[0.64rem] text-slate-400' : 'text-xs text-slate-400'}>{CONTACT_EMAIL}</p>
            </div>
          </a>
        </div>
      </div>
      )}

      {/* ── Modal changement de plan ── */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/68 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={() => setUpgradeOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-emerald-950/10 bg-[#fffdf8] shadow-2xl shadow-emerald-950/20 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-emerald-950/10 bg-white/78 px-4 py-3">
              <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-emerald-800">Facturation</p>
              <div className="mt-0.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-extrabold text-slate-950">Changer de plan</h3>
                  <p className="mt-0.5 text-[0.7rem] font-semibold leading-4 text-slate-500">
                    Choisissez une capacité puis confirmez le paiement sécurisé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                  aria-label="Fermer le changement de plan"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="rounded-xl border border-emerald-950/10 bg-white/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[0.54rem] font-black uppercase tracking-[0.14em] text-slate-500">Plan actuel</p>
                    <p className="text-[0.8rem] font-extrabold text-slate-950">{displayedPlanName}</p>
                  </div>
                  <p className="text-[0.68rem] font-bold text-slate-500">
                    {catalogPlan.price_xof > 0 ? `${formatCurrency(catalogPlan.price_xof)}/mois` : 'Sur devis'}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
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
                      className="min-w-0 rounded-xl border p-2.5 text-left transition disabled:cursor-default disabled:opacity-70 hover:enabled:-translate-y-0.5 hover:enabled:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                      style={{ borderColor: isCurr ? plan.color : '#E2E8F0', backgroundColor: isCurr ? plan.color + '08' : 'white' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: plan.color + '18' }}>
                            <Icon className="h-4 w-4" style={{ color: plan.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[0.76rem] font-extrabold text-slate-950">{plan.name}</p>
                            <p className="text-[0.64rem] font-semibold" style={{ color: plan.color }}>
                              {plan.price_xof > 0 ? formatCurrency(plan.price_xof) + '/mois' : 'Sur devis'}
                            </p>
                          </div>
                        </div>
                        {isCurr
                          ? <span className="rounded-full px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-white" style={{ backgroundColor: plan.color }}>Actuel</span>
                          : <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[0.54rem] font-bold text-slate-500">
                        <span className="truncate rounded-md bg-slate-50 px-1.5 py-1">{plan.max_users === -1 ? 'Util. +' : `${plan.max_users} util.`}</span>
                        <span className="truncate rounded-md bg-slate-50 px-1.5 py-1">{plan.max_unites === -1 ? 'Unités +' : `${plan.max_unites} unités`}</span>
                        <span className="truncate rounded-md bg-slate-50 px-1.5 py-1">{plan.storage_gb === -1 ? 'Stockage +' : `${plan.storage_gb} Go`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-[0.66rem] font-semibold leading-4 text-slate-600">
                Activation après confirmation du paiement. Le paiement en ligne reste prioritaire ; le support valide les preuves manuelles.
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={manualProofOpen}
        onClose={() => setManualProofOpen(false)}
        title="Déclarer une preuve"
        description="Le support valide la preuve puis active le plan si le paiement est confirmé."
      >
        <form onSubmit={submitManualProof} className="space-y-3">
          {/* Bandeau de synthèse officiel premium */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-950/15 bg-gradient-to-r from-emerald-950 via-[#073b2f] to-[#0a4d3e] px-3 py-2 text-white shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 ring-1 ring-white/15">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.52rem] font-black uppercase tracking-[0.16em] text-emerald-300">Déclaration officielle</p>
                <h3 className="truncate text-xs font-extrabold text-white">
                  Plan {PLAN_CATALOG.find((plan) => plan.id === proofForm.plan_key)?.name ?? proofForm.plan_key}
                </h3>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-emerald-300">Montant estimé</p>
              <p className="text-xs font-extrabold text-amber-300">
                {formatCurrency(Number(proofForm.amount || 0))}
              </p>
            </div>
          </div>

          {/* Grille de champs ultra dense et uniforme (hauteur h-11 exacte pour tous les champs) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-xs font-bold text-slate-700">Plan</span>
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
                  density="wizard"
                />
              </div>

              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">Montant (XOF)</span>
                <input
                  type="number"
                  min="0"
                  value={proofForm.amount}
                  onChange={(event) => setProofForm((form) => ({ ...form, amount: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">Date de paiement</span>
                <input
                  type="date"
                  value={proofForm.payment_date}
                  onChange={(event) => setProofForm((form) => ({ ...form, payment_date: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-bold text-slate-700">Moyen de paiement</span>
                <SmartCombobox
                  value={proofForm.method}
                  options={MANUAL_PAYMENT_METHODS.map((method) => ({
                    value: method.id,
                    label: method.label,
                  }))}
                  onChange={(val) => setProofForm((form) => ({ ...form, method: val }))}
                  placeholder="Moyen de paiement..."
                  density="wizard"
                />
              </div>

              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">Référence</span>
                <input
                  type="text"
                  value={proofForm.reference}
                  onChange={(event) => setProofForm((form) => ({ ...form, reference: event.target.value }))}
                  placeholder="Ex : WAVE-1289"
                  className="h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">Lien preuve (optionnel)</span>
                <input
                  type="url"
                  value={proofForm.proof_file_url}
                  onChange={(event) => setProofForm((form) => ({ ...form, proof_file_url: event.target.value }))}
                  placeholder="Lien Drive, reçu ou capture"
                  className="h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">Commentaire</span>
                <input
                  type="text"
                  value={proofForm.comment}
                  onChange={(event) => setProofForm((form) => ({ ...form, comment: event.target.value }))}
                  placeholder="Ex : paiement transmis par Wave au nom de l'agence"
                  className="h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </label>
            </div>
          </div>

          {/* Actions du bas */}
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setManualProofOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submittingProof}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-950 via-[#073b2f] to-[#0a4d3e] px-5 text-xs font-extrabold text-white shadow-sm transition hover:from-[#073b2f] hover:to-emerald-950 disabled:opacity-60"
            >
              {submittingProof ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white" />
              ) : (
                <Send className="h-3.5 w-3.5 text-emerald-300" />
              )}
              Transmettre la preuve
            </button>
          </div>
        </form>
      </Modal>

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
