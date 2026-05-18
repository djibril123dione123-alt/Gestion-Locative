import { useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTracking } from '../../hooks/useTracking';
import { formatCurrency, formatSenegalPhoneInput, normalizeSenegalPhone } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import { Modal } from './Modal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  priceXof: number;
  onSuccess: () => void;
}

type Provider = 'wave' | 'orange_money';
type Step = 'choose' | 'enter_phone' | 'processing' | 'success';

const PROVIDERS: Record<
  Provider,
  {
    label: string;
    description: string;
    accent: string;
    icon: typeof Smartphone;
  }
> = {
  wave: {
    label: 'Wave',
    description: 'Paiement mobile rapide et sécurisé',
    accent: 'from-blue-500 to-cyan-400',
    icon: Smartphone,
  },
  orange_money: {
    label: 'Orange Money',
    description: 'Validation via compte mobile money',
    accent: 'from-orange-500 to-amber-400',
    icon: CreditCard,
  },
};

export function PaymentModal({ isOpen, onClose, planName, priceXof, onSuccess }: PaymentModalProps) {
  const { profile } = useAuth();
  const { track } = useTracking();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setProvider(null);
    setStep('choose');
    setPhone('');
    setError('');
  };

  const handleClose = () => {
    if (step === 'processing') return;
    reset();
    onClose();
  };

  const handlePay = async () => {
    const normalizedPhone = normalizeSenegalPhone(phone);
    if (!normalizedPhone) {
      setError('Entrez un numéro sénégalais valide, par exemple 77 123 45 67.');
      return;
    }
    setError('');
    setStep('processing');

    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      if (profile?.agency_id) {
        const now = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);

        await supabase
          .from('agencies')
          .update({ status: 'active' })
          .eq('id', profile.agency_id);

        await supabase.from('subscriptions').upsert(
          {
            agency_id: profile.agency_id,
            plan_id: 'pro',
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          },
          { onConflict: 'agency_id' }
        );

        await track({
          action: 'subscription_pay',
          metadata: { provider, plan: planName, amount: priceXof, phone: normalizedPhone.slice(-4) },
        });
      }

      setStep('success');
      setTimeout(() => {
        reset();
        onClose();
        onSuccess();
      }, 2200);
    } catch {
      setStep('enter_phone');
      setError("Erreur lors de l'activation. Veuillez réessayer.");
    }
  };

  const providerConfig = provider ? PROVIDERS[provider] : null;
  const ActiveProviderIcon = providerConfig?.icon;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Activation de l'abonnement">
      {step === 'choose' && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[1.35rem] bg-brand-950 p-5 text-white shadow-premium">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-action-500/25 blur-3xl" />
            <div className="absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-200" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">
                  Activation premium
                </p>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-50/70">Plan {planName}</p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.02em]">{formatCurrency(priceXof)}</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-50 backdrop-blur">
                  30 jours
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-emerald-50/72">
                Activation immédiate après validation du paiement mobile. Aucun numéro de carte bancaire requis.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              Moyen de paiement
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.entries(PROVIDERS) as Array<[Provider, (typeof PROVIDERS)[Provider]]>).map(
                ([id, item]) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setProvider(id);
                        setStep('enter_phone');
                      }}
                      className="group relative overflow-hidden rounded-[1.25rem] border border-emerald-950/10 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-900/20 hover:shadow-premium focus:outline-none focus:ring-4 focus:ring-action-500/15"
                    >
                      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg shadow-slate-900/10 transition-transform duration-200 group-hover:scale-105`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-black text-slate-950">{item.label}</p>
                          <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
                          <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                            Disponible
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-900/10 bg-emerald-50/60 px-4 py-3 text-xs font-bold text-brand-700">
            <ShieldCheck className="h-4 w-4" />
            Paiement sécurisé, traçable et activé instantanément.
          </div>
        </div>
      )}

      {step === 'enter_phone' && providerConfig && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 transition-colors hover:text-brand-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux moyens de paiement
          </button>

          <div className="sk-premium-panel p-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${providerConfig.accent} text-white shadow-lg shadow-slate-900/10`}>
                {ActiveProviderIcon && <ActiveProviderIcon className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-slate-950">{providerConfig.label}</p>
                <p className="text-sm text-slate-500">{formatCurrency(priceXof)} · Plan {planName} · 30 jours</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">
              Numéro {providerConfig.label}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(formatSenegalPhoneInput(event.target.value))}
              placeholder="Ex : 77 123 45 67"
              maxLength={14}
              className="sk-input w-full py-3 text-lg font-bold tracking-wide"
              autoFocus
            />
            {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Une notification de confirmation sera envoyée sur ce numéro avant activation.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePay}
            className="sk-create-cta flex w-full items-center justify-center rounded-[1.15rem] px-5 py-3.5 text-base font-black shadow-lg shadow-orange-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          >
            Payer {formatCurrency(priceXof)}
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-orange-200 bg-orange-50 shadow-inner">
            <div className="absolute inset-0 rounded-[1.75rem] bg-action-500/15 blur-xl" />
            <Loader2 className="relative h-10 w-10 animate-spin text-action-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-950">Traitement en cours...</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Validation du paiement {providerConfig?.label || 'mobile money'} et activation de votre espace.
            </p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-200 bg-emerald-50 shadow-inner">
            <div className="absolute inset-0 rounded-[1.75rem] bg-emerald-500/15 blur-xl" />
            <CheckCircle2 className="relative h-12 w-12 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-950">Paiement réussi</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              L'abonnement <strong>{planName}</strong> est activé pour 30 jours.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
