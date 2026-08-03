import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Shield,
} from 'lucide-react';

import orangeMoneyLogo from '../../assets/payments/orange-money.png';
import waveLogo from '../../assets/payments/wave.png';
import djamoLogo from '../../assets/payments/djamo.png';
import gmailLogo from '../../assets/support/gmail.png';
import whatsappLogo from '../../assets/support/whatsapp.jpg';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatSenegalPhone, formatSenegalPhoneInput, normalizeSenegalPhone } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import {
  WizardShell,
  wizardPrimaryActionClass,
  wizardSecondaryActionClass,
  type WizardStep,
} from '../ui/WizardShell';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  priceXof: number;
  onSuccess: () => void;
}

type Provider = 'orange_money' | 'wave' | 'djamo' | 'card';
type Step = 'select_provider' | 'enter_phone' | 'processing' | 'polling' | 'card_redirect' | 'success' | 'error';

interface ProviderConfig {
  id: Provider;
  label: string;
  sub: string;
  logo?: string;
  fallback: string;
  color: string;
  bg: string;
}

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36;

const CONTACT_WHATSAPP = '221769010960';
const CONTACT_EMAIL = 'samaykeur@gmail.com';

const PROVIDERS: ProviderConfig[] = [
  { id: 'orange_money', label: 'Orange Money', sub: 'Sénégal', logo: orangeMoneyLogo, fallback: 'OM', color: '#FF6600', bg: '#FFF4EE' },
  { id: 'wave', label: 'Wave', sub: 'Sénégal', logo: waveLogo, fallback: 'W', color: '#00AEEF', bg: '#EFF9FF' },
  { id: 'djamo', label: 'Djamo', sub: 'Sénégal', logo: djamoLogo, fallback: 'D', color: '#1A1A1A', bg: '#F5F5F5' },
  { id: 'card', label: 'Carte bancaire', sub: 'Visa / Mastercard', fallback: 'CB', color: '#1D4ED8', bg: '#EFF6FF' },
];

function isCorsOrNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('failed to send a request') ||
    m.includes('networkerror') ||
    (m.includes('cors') && !m.includes('edge function'))
  );
}

function LogoBadge({
  src,
  label,
  fallback,
  className = '',
}: {
  src?: string;
  label: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-2xs ${className}`}>
      {src && !failed ? (
        <img src={src} alt={label} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[0.62rem] font-black text-slate-700">{fallback}</span>
      )}
    </span>
  );
}

export function CheckoutModal({ isOpen, onClose, planId, planName, priceXof, onSuccess }: CheckoutModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('select_provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEdgeFunctionDown, setIsEdgeFunctionDown] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paymentAttemptKeyRef = useRef<string | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setStep('select_provider');
      setProvider(null);
      setPhone('');
      setPhoneError('');
      setErrorMsg('');
      setIsEdgeFunctionDown(false);
      setCheckoutUrl(null);
      setPollCount(0);
      paymentAttemptKeyRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => () => stopPolling(), []);

  const handleSelectProvider = (p: Provider) => {
    setProvider(p);
    if (p === 'card') {
      setStep('processing');
      initiatePayment(p, undefined);
    } else {
      setStep('enter_phone');
    }
  };

  const handlePay = () => {
    const normalizedPhone = normalizeSenegalPhone(phone);
    if (!normalizedPhone) {
      setPhoneError('Numéro sénégalais invalide. Exemple : 77 123 45 67.');
      return;
    }
    setPhoneError('');
    setStep('processing');
    initiatePayment(provider!, normalizedPhone);
  };

  const initiatePayment = async (prov: Provider, phoneNum: string | undefined) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setErrorMsg('Session expirée. Veuillez vous reconnecter.');
        setStep('error');
        return;
      }

      if (!paymentAttemptKeyRef.current) {
        paymentAttemptKeyRef.current = crypto.randomUUID();
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initiate-payment`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          provider: prov,
          phone: phoneNum,
          amount_xof: priceXof,
          agency_id: profile?.agency_id,
          idempotency_key: paymentAttemptKeyRef.current,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const rawMsg = data?.error ?? `Paiement refusé (${response.status}).`;
        if (isCorsOrNetworkError(rawMsg)) {
          setIsEdgeFunctionDown(true);
          setErrorMsg('Le service de paiement est en cours de déploiement. Contactez-nous sur WhatsApp pour activer votre abonnement maintenant.');
        } else {
          setErrorMsg(rawMsg || 'Impossible d’initier le paiement.');
        }
        setStep('error');
        return;
      }

      if (!data?.transaction_id) {
        setErrorMsg(data?.error ?? 'Réponse inattendue du serveur.');
        setStep('error');
        return;
      }

      if (data.softpay_error && data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        setStep('card_redirect');
        startPolling(data.transaction_id);
        return;
      }

      if (prov === 'card' && data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        window.open(data.checkout_url, '_blank', 'noopener,noreferrer');
        setStep('card_redirect');
        startPolling(data.transaction_id);
        return;
      }

      if (data.test_mode && data.transaction_id) {
        setErrorMsg('Paiement de test créé. L’activation reste réservée au webhook vérifié ou à une validation administrateur.');
        setStep('error');
        return;
      }

      setStep('polling');
      startPolling(data.transaction_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue.';
      if (isCorsOrNetworkError(msg)) {
        setIsEdgeFunctionDown(true);
        setErrorMsg('Le service de paiement est en cours de déploiement. Contactez-nous sur WhatsApp pour activer votre abonnement.');
      } else {
        setErrorMsg(msg);
      }
      setStep('error');
    }
  };

  const startPolling = (txnId: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      if (attempts > POLL_MAX_ATTEMPTS) {
        stopPolling();
        setErrorMsg('Délai dépassé. Si vous avez payé, votre compte sera activé automatiquement dans quelques minutes.');
        setStep('error');
        return;
      }

      const { data } = await supabase
        .from('payment_transactions')
        .select('status')
        .eq('id', txnId)
        .maybeSingle();

      if (data?.status === 'completed') {
        stopPolling();
        setStep('success');
        setTimeout(() => onSuccess(), 2500);
      } else if (data?.status === 'failed' || data?.status === 'cancelled') {
        stopPolling();
        setErrorMsg('Le paiement a échoué ou a été annulé.');
        setStep('error');
      }
    }, POLL_INTERVAL_MS);
  };

  const handleClose = () => {
    if (step === 'processing') return;
    stopPolling();
    onClose();
  };

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);
  const timeLeft = Math.max(0, POLL_MAX_ATTEMPTS - pollCount) * (POLL_INTERVAL_MS / 1000);
  const minutesLeft = Math.floor(timeLeft / 60);
  const secondsLeft = timeLeft % 60;
  const checkoutSteps: WizardStep[] = [
    {
      id: 'provider',
      label: 'Moyen de paiement',
      shortLabel: 'Moyen',
      description: 'Orange Money, Wave, Djamo ou carte',
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    {
      id: 'details',
      label: 'Détails',
      shortLabel: 'Détails',
      description: 'Numéro ou page sécurisée',
      icon: <Shield className="h-3.5 w-3.5" />,
    },
    {
      id: 'confirmation',
      label: 'Confirmation',
      shortLabel: 'Statut',
      description: 'Validation transaction',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
  ];
  const checkoutStepIndex =
    step === 'select_provider'
      ? 0
      : step === 'enter_phone' || step === 'processing'
        ? 1
        : 2;

  return (
    <WizardShell
      open={isOpen}
      onClose={handleClose}
      title={`Activer le plan ${planName}`}
      eyebrow="FACTURATION & PAIEMENT"
      description="Choisissez un moyen sécurisé. Activation après confirmation du paiement."
      mobileDescription="Paiement sécurisé."
      steps={step === 'success' || step === 'error' ? [] : checkoutSteps}
      currentStep={checkoutStepIndex}
      variant="workstation"
      tone="finance"
      size="compact"
      mobileMode="fullscreen"
      secondaryAction={step === 'enter_phone' ? (
        <button
          type="button"
          onClick={() => setStep('select_provider')}
          className={wizardSecondaryActionClass}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Changer de moyen
        </button>
      ) : undefined}
      primaryAction={step === 'enter_phone' && selectedProvider ? (
        <button
          type="button"
          onClick={handlePay}
          className={wizardPrimaryActionClass}
        >
          Payer {formatCurrency(priceXof)}
        </button>
      ) : undefined}
    >
      {step !== 'success' && step !== 'error' && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-emerald-950/15 bg-gradient-to-br from-[#fffefc] via-[#fffcf6] to-emerald-50/20 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-emerald-800">PLAN SÉLECTIONNÉ</p>
              <p className="mt-0.5 truncate text-base font-black text-slate-950">Plan {planName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black tracking-tight text-emerald-950">
                {formatCurrency(priceXof)}
                <span className="ml-1 text-xs font-semibold text-slate-500">/mois</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-800/15 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-950">
            <Shield className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>Activation instantanée après confirmation du paiement. Le paiement en ligne reste prioritaire.</span>
          </div>
        </div>
      )}


      {step === 'select_provider' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-black text-slate-950">Choisissez votre moyen de paiement</h4>
            <p className="mt-0.5 text-xs text-slate-500">Les transactions locales sont sécurisées et vérifiées automatiquement via PayDunya.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProvider(p.id)}
                className="group relative flex min-w-0 items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-600/40 hover:bg-emerald-50/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
              >
                {p.logo ? (
                  <LogoBadge src={p.logo} label={p.label} fallback={p.fallback} className="h-10 w-10 shrink-0 shadow-xs" />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 shadow-xs">
                    <CreditCard className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-950 group-hover:text-emerald-950">{p.label}</span>
                  <span className="block truncate text-[0.68rem] font-semibold text-slate-500">{p.sub}</span>
                </span>
                {p.id === 'card' ? (
                  <span className="rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-blue-700">
                    VISA
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[0.6rem] font-bold text-slate-600 group-hover:border-emerald-300 group-hover:bg-emerald-100/60 group-hover:text-emerald-900">
                    Rapide
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-2xs">
              <Shield className="h-3.5 w-3.5 text-emerald-700" /> Sécurisé par PayDunya
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-emerald-700" /> Activation instantanée
            </span>
          </div>
        </div>
      )}

      {step === 'enter_phone' && selectedProvider && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ backgroundColor: selectedProvider.bg, borderColor: `${selectedProvider.color}30` }}>
            <LogoBadge src={selectedProvider.logo} label={selectedProvider.label} fallback={selectedProvider.fallback} className="h-8 w-8" />
            <div className="min-w-0">
              <p className="truncate text-[0.8rem] font-extrabold text-slate-950">{selectedProvider.label}</p>
              <p className="truncate text-[0.62rem] font-semibold text-slate-500">{selectedProvider.sub}</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[0.72rem] font-extrabold text-slate-700">
              Numéro {selectedProvider.label} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.72rem] font-black text-slate-500">+221</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(formatSenegalPhoneInput(event.target.value));
                  setPhoneError('');
                }}
                onKeyDown={(event) => event.key === 'Enter' && handlePay()}
                placeholder="77 123 45 67"
                maxLength={14}
                autoFocus
                className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 pl-14 pr-3 text-[0.88rem] font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all tracking-wide placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:!h-8 sm:rounded-[0.6rem]"
              />
            </div>
            {phoneError ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.68rem] font-semibold text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />{phoneError}
              </p>
            ) : null}
            <p className="mt-1.5 text-[0.64rem] font-medium text-slate-500">Vous recevrez une notification à confirmer sur ce numéro.</p>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
            <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
          </div>
          <div className="text-center">
            <p className="text-[0.95rem] font-extrabold text-slate-950">Connexion à PayDunya</p>
            <p className="mt-1 text-[0.7rem] font-medium text-slate-500">Création de la facture de paiement.</p>
          </div>
        </div>
      )}

      {step === 'polling' && selectedProvider && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="relative">
            <LogoBadge src={selectedProvider.logo} label={selectedProvider.label} fallback={selectedProvider.fallback} className="h-16 w-16" />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: selectedProvider.color }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            </span>
          </div>
          <div className="max-w-sm text-center">
            <p className="text-[1rem] font-extrabold text-slate-950">Confirmez sur votre téléphone</p>
            <p className="mt-1 text-[0.72rem] font-medium leading-5 text-slate-600">
              Une notification <strong>{selectedProvider.label}</strong> a été envoyée au <strong>{formatSenegalPhone(phone)}</strong>.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[0.7rem] font-bold text-orange-700">
              <Clock className="h-3.5 w-3.5" />
              {minutesLeft > 0 ? `${minutesLeft}m ` : ''}{String(secondsLeft).padStart(2, '0')}s restantes
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopPolling();
              setStep('enter_phone');
            }}
            className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Changer de numéro
          </button>
        </div>
      )}

      {step === 'card_redirect' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <CreditCard className="h-8 w-8" />
          </div>
          <div className="max-w-sm text-center">
            <p className="text-[1rem] font-extrabold text-slate-950">Paiement par carte</p>
            <p className="mt-1 text-[0.72rem] font-medium leading-5 text-slate-600">
              Complétez le paiement dans l’onglet sécurisé PayDunya, puis revenez ici.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[0.7rem] font-bold text-orange-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              En attente de confirmation
            </div>
          </div>
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-700 px-3 text-[0.72rem] font-extrabold text-white transition hover:bg-blue-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Rouvrir la page de paiement
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              stopPolling();
              setStep('select_provider');
            }}
            className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Choisir un autre moyen
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-700" />
          </div>
          <div className="text-center">
            <p className="text-[1.1rem] font-black text-slate-950">Abonnement activé</p>
            <p className="mt-1 text-[0.72rem] font-medium leading-5 text-slate-600">
              Le plan <strong>{planName}</strong> est actif pour 30 jours.
            </p>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-4 py-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="max-w-sm text-center">
            <p className="text-[0.95rem] font-extrabold text-slate-950">
              {isEdgeFunctionDown ? 'Service temporairement indisponible' : 'Paiement non confirmé'}
            </p>
            <p className="mt-1.5 text-[0.72rem] font-medium leading-5 text-slate-500">{errorMsg}</p>
          </div>
          <div className="w-full space-y-2">
            {isEdgeFunctionDown ? (
              <>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Bonjour, je veux activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-[0.75rem] font-black text-white transition hover:opacity-90"
                >
                  <LogoBadge src={whatsappLogo} label="WhatsApp" fallback="WA" className="h-5 w-5 rounded-md border-white/20" />
                  Activer via WhatsApp
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Activation plan ${planName} - Samay Këur`)}&body=${encodeURIComponent(`Bonjour, je veux activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[0.75rem] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <LogoBadge src={gmailLogo} label="Gmail" fallback="GM" className="h-5 w-5 rounded-md" />
                  Envoyer un email
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setStep('select_provider');
                    setErrorMsg('');
                    setIsEdgeFunctionDown(false);
                  }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white text-[0.72rem] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Réessayer quand même
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep('select_provider');
                  setErrorMsg('');
                }}
                className="h-10 w-full rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 text-[0.78rem] font-black text-white transition hover:-translate-y-0.5"
              >
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}
    </WizardShell>
  );
}
