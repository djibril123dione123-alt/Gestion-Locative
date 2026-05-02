import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { CheckoutModal } from '../components/billing/CheckoutModal';
import { CreditCard, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react';
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

export function Abonnement() {
  const { profile } = useAuth();
  const toast = useToast();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [usage, setUsage] = useState<Usage>({ users: 0, immeubles: 0, unites: 0 });
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [agencyRes, subRes, limitsRes] = await Promise.all([
        supabase.from('agencies').select('id, name, status, plan, trial_ends_at').eq('id', profile.agency_id).single(),
        supabase
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false }),
        supabase.rpc('check_plan_limits', { p_agency_id: profile.agency_id }),
      ]);

      if (agencyRes.data) setAgency(agencyRes.data as Agency);
      if (subRes.data && subRes.data.length > 0) {
        const subs = subRes.data as Subscription[];
        setSubscription(subs[0]);
        setCurrentPlan(subs[0].subscription_plans ?? null);
        setHistory(subs);
      } else {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', agencyRes.data?.plan ?? 'basic')
          .maybeSingle();
        if (planData) setCurrentPlan(planData as Plan);
      }
      if (limitsRes.data?.usage) setUsage(limitsRes.data.usage as Usage);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const trialDaysLeft = agency?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;
  const isTrial = agency?.status === 'trial';

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trial: 'bg-orange-100 text-orange-800',
    past_due: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-200 text-slate-700',
    suspended: 'bg-red-100 text-red-800',
  };

  const renderProgress = (label: string, used: number, max: number) => {
    const isUnlimited = max === -1 || max === 999 || max === 9999;
    const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    return (
      <div data-testid={`usage-${label.toLowerCase()}`}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-sm text-slate-600">
            {used} {isUnlimited ? '(illimité)' : `/ ${max}`}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#C0392B' : '#F58220' }}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Chargement…</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Abonnement</h1>
        <p className="text-sm text-slate-600 mt-1">Gérez votre plan et votre utilisation</p>
      </div>

      {/* Trial countdown */}
      {isTrial && trialDaysLeft !== null && (
        <div className={`mb-6 p-4 rounded-xl border ${trialDaysLeft <= 3 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-3">
            <Clock className={`w-6 h-6 ${trialDaysLeft <= 3 ? 'text-red-600' : 'text-orange-600'}`} />
            <div className="flex-1">
              <p className={`font-semibold ${trialDaysLeft <= 3 ? 'text-red-900' : 'text-orange-900'}`} data-testid="text-trial-days">
                {trialDaysLeft > 0
                  ? `Essai gratuit : ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} restant${trialDaysLeft > 1 ? 's' : ''}`
                  : 'Essai expiré'}
              </p>
              <p className={`text-sm ${trialDaysLeft <= 3 ? 'text-red-700' : 'text-orange-700'}`}>
                Passez au plan Pro pour conserver vos données et toutes les fonctionnalités.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F58220' }}>
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500">Plan actuel</p>
              <p className="text-xl font-bold text-slate-900" data-testid="text-current-plan">
                {currentPlan?.name ?? agency?.plan ?? 'Basic'}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {currentPlan ? `${formatCurrency(currentPlan.price_xof)} / mois` : '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColor[agency?.status ?? 'active'] ?? 'bg-slate-100 text-slate-700'}`} data-testid="badge-status">
              {agency?.status ?? '—'}
            </span>
            {subscription && (
              <p className="text-xs text-slate-500">
                Période en cours : {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setPaymentOpen(true)}
                data-testid="button-pay"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90 shadow-md"
                style={{ background: 'linear-gradient(135deg, #F58220 0%, #E65100 100%)' }}
              >
                <Zap className="w-4 h-4" />
                Payer l'abonnement
              </button>
              {currentPlan?.id !== 'pro' && currentPlan?.id !== 'enterprise' && (
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  data-testid="button-upgrade"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium transition hover:bg-slate-50"
                >
                  <TrendingUp className="w-4 h-4" />
                  Passer au plan Pro
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Usage bars */}
        {currentPlan && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            {renderProgress('Utilisateurs', usage.users, currentPlan.max_users)}
            {renderProgress('Immeubles', usage.immeubles, currentPlan.max_immeubles)}
            {renderProgress('Produits', usage.unites, currentPlan.max_unites)}
          </div>
        )}
      </div>

      {/* Features */}
      {currentPlan && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">Fonctionnalités incluses</h2>
          <ul className="space-y-2">
            {Object.entries(currentPlan.features ?? {}).map(([key, value]) => (
              <li key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-slate-500">: {String(value)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Stockage : {currentPlan.storage_gb} Go</span>
            </li>
          </ul>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Historique des abonnements</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun historique disponible.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((s) => (
              <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{s.subscription_plans?.name ?? s.plan_id}</p>
                  <p className="text-xs text-slate-500">
                    Du {new Date(s.current_period_start).toLocaleDateString('fr-FR')} au{' '}
                    {new Date(s.current_period_end).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor[s.status] ?? 'bg-slate-100'}`}>
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Programme Pilote — 10 clients fondateurs */}
      <div className="mb-6 rounded-2xl border-2 p-6 relative overflow-hidden" style={{ borderColor: '#F58220', background: 'linear-gradient(135deg, #fffbf5 0%, #fff7ed 100%)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
          <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="50" fill="#F58220"/></svg>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F58220' }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-slate-900">Programme Pilote — 10 agences fondatrices</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#F58220' }}>Limité</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Rejoignez les 10 premières agences à adopter Samay Këur et bénéficiez d'un accès fondateur à tarif préférentiel, avec accompagnement personnalisé et influence directe sur la roadmap.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Starter Pilote', price: '9 900 XOF/mois', features: ['Jusqu\'à 30 unités', '3 utilisateurs', 'Support WhatsApp'] },
                { label: 'Pro Pilote', price: '19 900 XOF/mois', features: ['Jusqu\'à 100 unités', '10 utilisateurs', 'Support prioritaire', 'PDF illimités'] },
                { label: 'Agence Pilote', price: '39 900 XOF/mois', features: ['Unités illimitées', 'Utilisateurs illimités', 'Onboarding dédié', 'Accès API'] },
              ].map((plan) => (
                <div key={plan.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="font-bold text-slate-900 text-sm mb-1">{plan.label}</p>
                  <p className="text-orange-600 font-semibold text-sm mb-2">{plan.price}</p>
                  <ul className="space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je veux rejoindre le programme pilote Samay Këur (10 agences fondatrices)')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                Rejoindre sur WhatsApp
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Programme Pilote Samay Këur')}&body=${encodeURIComponent("Bonjour,\n\nJe souhaite rejoindre le programme pilote Samay Këur.\n\nNom de l'agence : \nNombre de biens gérés : \nVille : ")}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 font-medium hover:bg-slate-50"
              >
                Demander par email
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade modal — contact commercial */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setUpgradeOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Passer au plan Pro</h3>
            <div className="space-y-2">
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour, je souhaite passer au plan Pro Samay Këur')}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-whatsapp"
                className="block w-full text-center px-4 py-3 rounded-xl text-white font-semibold transition hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                Contacter sur WhatsApp
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Passage au plan Pro')}`}
                data-testid="link-email"
                className="block w-full text-center px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Envoyer un email
              </a>
            </div>
            <button type="button" onClick={() => setUpgradeOpen(false)} className="w-full text-sm text-slate-500 hover:text-slate-800 py-1">Fermer</button>
          </div>
        </div>
      )}

      {/* Payment modal — Orange Money via PayDunya */}
      <CheckoutModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        planId={currentPlan?.id !== 'enterprise' ? 'pro' : 'enterprise'}
        planName={currentPlan?.name ?? 'Pro'}
        priceXof={currentPlan?.price_xof ?? 15000}
        onSuccess={() => {
          setPaymentOpen(false);
          toast.success('Abonnement activé pour 30 jours !');
          load();
        }}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
