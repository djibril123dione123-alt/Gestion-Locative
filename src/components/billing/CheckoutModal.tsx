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
import { formatCurrency } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import {
  WizardShell,
  wizardPrimaryActionClass,
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

type Step = 'confirm' | 'processing' | 'redirect' | 'success' | 'error';

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60;

const CONTACT_WHATSAPP = '221769010960';
const CONTACT_EMAIL = 'contact@samaykeur.com';

const ACCEPTED_METHODS = [
  { label: 'Orange Money', logo: orangeMoneyLogo, fallback: 'OM' },
  { label: 'Wave', logo: waveLogo, fallback: 'W' },
  { label: 'Djamo', logo: djamoLogo, fallback: 'D' },
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
  const [step, setStep] = useState<Step>('confirm');
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
      setStep('confirm');
      setErrorMsg('');
      setIsEdgeFunctionDown(false);
      setCheckoutUrl(null);
      setPollCount(0);
      paymentAttemptKeyRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => () => stopPolling(), []);

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

  const initiatePayment = async () => {
    setStep('processing');
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

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/senepay-checkout`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
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

      if (data.status === 'completed') {
        setStep('success');
        setTimeout(() => onSuccess(), 1500);
        return;
      }

      if (!data.checkout_url) {
        setErrorMsg('Session de paiement créée mais aucune page de paiement reçue. Réessayez.');
        setStep('error');
        return;
      }

      setCheckoutUrl(data.checkout_url);
      window.open(data.checkout_url, '_blank', 'noopener,noreferrer');
      setStep('redirect');
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

  const handleClose = () => {
    if (step === 'processing') return;
    stopPolling();
    onClose();
  };

  const timeLeft = Math.max(0, POLL_MAX_ATTEMPTS - pollCount) * (POLL_INTERVAL_MS / 1000);
  const minutesLeft = Math.floor(timeLeft / 60);
  const secondsLeft = timeLeft % 60;
  const checkoutSteps: WizardStep[] = [
    {
      id: 'confirm',
      label: 'Confirmation',
      shortLabel: 'Plan',
      description: 'Vérifiez le montant',
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    {
      id: 'payment',
      label: 'Paiement',
      shortLabel: 'Paiement',
      description: 'Page sécurisée',
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
  const checkoutStepIndex = step === 'confirm' ? 0 : step === 'processing' ? 1 : 2;

  return (
    <WizardShell
      open={isOpen}
      onClose={handleClose}
      title={`Activer le plan ${planName}`}
      eyebrow="FACTURATION & PAIEMENT"
      description="Paiement sécurisé. Activation après confirmation du paiement."
      mobileDescription="Paiement sécurisé."
      steps={step === 'success' || step === 'error' ? [] : checkoutSteps}
      currentStep={checkoutStepIndex}
      variant="workstation"
      tone="finance"
      size="compact"
      panelClassName="sm:max-w-[700px]"
      mobileMode="fullscreen"
      primaryAction={step === 'confirm' ? (
        <button
          type="button"
          onClick={initiatePayment}
          className={wizardPrimaryActionClass}
        >
          Payer {formatCurrency(priceXof)}
        </button>
      ) : undefined}
    >
      {step !== 'success' && step !== 'error' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[0.85rem] font-black text-slate-900">Plan {planName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[0.64rem] font-medium text-slate-500">
              <Shield className="h-3 w-3 shrink-0 text-emerald-600" />
              Activation instantanée après confirmation
            </p>
          </div>
          <p className="shrink-0 text-[1.1rem] font-black tracking-tight text-slate-900">
            {formatCurrency(priceXof)}
            <span className="ml-1 text-[0.58rem] font-bold text-slate-400 uppercase tracking-widest">/mois</span>
          </p>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div>
            <h4 className="text-[0.95rem] font-black text-slate-900 tracking-tight">Vous allez être redirigé vers une page de paiement sécurisée</h4>
            <p className="mt-0.5 text-[0.72rem] text-slate-500 font-medium">
              Choisissez ensuite votre moyen de paiement (Orange Money, Wave, Djamo ou carte) directement sur la page sécurisée.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
            {ACCEPTED_METHODS.map((m) => (
              <LogoBadge key={m.label} src={m.logo} label={m.label} fallback={m.fallback} className="h-9 w-9 rounded-lg ring-1 ring-slate-900/5" />
            ))}
            <span className="rounded-full border border-blue-200/80 bg-blue-50 px-2 py-1 text-[0.6rem] font-black uppercase tracking-wider text-blue-700">
              VISA
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-500">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600/70" />
            <p className="text-[0.7rem] font-medium leading-relaxed">
              Une fois le paiement terminé, revenez sur cet onglet : la validation se fait automatiquement.
            </p>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
            <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
          </div>
          <div className="text-center">
            <p className="text-[0.95rem] font-extrabold text-slate-950">Connexion au service de paiement</p>
            <p className="mt-1 text-[0.7rem] font-medium text-slate-500">Création de la session sécurisée.</p>
          </div>
        </div>
      )}

      {step === 'redirect' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <CreditCard className="h-8 w-8" />
          </div>
          <div className="max-w-sm text-center">
            <p className="text-[1rem] font-extrabold text-slate-950">Onglet de paiement ouvert</p>
            <p className="mt-1 text-[0.72rem] font-medium leading-5 text-slate-600">
              Complétez le paiement dans l’onglet sécurisé qui vient de s’ouvrir, puis revenez ici.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[0.7rem] font-bold text-orange-700">
              <Clock className="h-3.5 w-3.5" />
              {minutesLeft > 0 ? `${minutesLeft}m ` : ''}{String(secondsLeft).padStart(2, '0')}s restantes
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
              setStep('confirm');
            }}
            className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Annuler
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-6 py-10 animate-in zoom-in-95">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500 shadow-xl shadow-emerald-500/20">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
          <div className="text-center">
            <p className="text-[1.3rem] font-black text-slate-900">Paiement réussi !</p>
            <p className="mt-2 text-[0.9rem] font-medium text-slate-500">
              Votre accès au plan <strong>{planName}</strong> est désormais activé.
            </p>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-6 py-8 animate-in zoom-in-95 duration-500">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 shadow-[0_8px_30px_rgba(239,68,68,0.15)]">
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.8),transparent)]" />
            <AlertCircle className="relative h-10 w-10 text-red-500 drop-shadow-sm" />
          </div>
          <div className="max-w-xs text-center">
            <p className="text-[1.15rem] font-black tracking-tight text-slate-900">
              {isEdgeFunctionDown ? 'Service indisponible' : 'Paiement non confirmé'}
            </p>
            <p className="mt-2 text-[0.8rem] font-medium leading-relaxed text-slate-500">{errorMsg}</p>
          </div>
          <div className="w-full max-w-sm space-y-3 mt-2">
            {isEdgeFunctionDown ? (
              <>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Bonjour, je veux activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-4 text-[0.85rem] font-black text-white shadow-[0_4px_12px_rgba(37,211,102,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,211,102,0.4)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <LogoBadge src={whatsappLogo} label="WhatsApp" fallback="WA" className="h-6 w-6 rounded-md border-white/20" />
                  Activer via WhatsApp
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Activation plan ${planName} - Samay Këur`)}&body=${encodeURIComponent(`Bonjour, je veux activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 text-[0.85rem] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:-translate-y-0.5"
                >
                  <LogoBadge src={gmailLogo} label="Gmail" fallback="GM" className="h-6 w-6 rounded-md" />
                  Envoyer un email
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setStep('confirm');
                    setErrorMsg('');
                    setIsEdgeFunctionDown(false);
                  }}
                  className="h-11 w-full rounded-xl bg-transparent text-[0.8rem] font-bold text-slate-500 transition hover:text-slate-700"
                >
                  Réessayer quand même
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep('confirm');
                  setErrorMsg('');
                }}
                className="h-12 w-full rounded-xl bg-slate-900 px-4 text-[0.85rem] font-black text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/10"
              >
                Réessayer le paiement
              </button>
            )}
          </div>
        </div>
      )}
    </WizardShell>
  );
}
