/**
 * CheckoutModal — Paiement PayDunya multi-provider
 *
 * Flux :
 *   1. Sélection du moyen de paiement (Orange Money, Wave, Djamo, Carte)
 *   2. Saisie numéro (mobile) ou redirection (carte)
 *   3. Appel Edge Function initiate-payment
 *   4. Polling statut transaction (max 3 min) ou attente retour carte
 *   5. Webhook PayDunya → activate_subscription (côté serveur)
 *   6. Écran succès
 */
import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import {
  CheckCircle2, Loader2, Smartphone, ArrowLeft,
  AlertCircle, Shield, Clock, CreditCard, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/formatters';

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

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36; // 3 minutes

const CONTACT_WHATSAPP = '221774000000';

const PROVIDERS: { id: Provider; label: string; sub: string; emoji: string; color: string; bg: string }[] = [
  { id: 'orange_money', label: 'Orange Money',    sub: 'Sénégal',                 emoji: '🟠', color: '#F58220', bg: '#FFF7ED' },
  { id: 'wave',         label: 'Wave',             sub: 'Sénégal / Côte d\'Ivoire', emoji: '🌊', color: '#00A6ED', bg: '#EFF9FF' },
  { id: 'djamo',        label: 'Djamo',            sub: 'Côte d\'Ivoire',           emoji: '💜', color: '#7C3AED', bg: '#FAF5FF' },
  { id: 'card',         label: 'Carte bancaire',   sub: 'Visa / Mastercard',        emoji: '💳', color: '#1D4ED8', bg: '#EFF6FF' },
];

function isCorsOrNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('failed to send') || m.includes('cors') || m.includes('network') || m.includes('fetch') || m.includes('edge function');
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
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
      setTransactionId(null);
      setPollCount(0);
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
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) { setPhoneError('Numéro invalide (8 chiffres minimum).'); return; }
    setPhoneError('');
    setStep('processing');
    initiatePayment(provider!, cleaned);
  };

  const initiatePayment = async (prov: Provider, phoneNum: string | undefined) => {
    try {
      const { data, error } = await supabase.functions.invoke('initiate-payment', {
        body: {
          plan_id: planId,
          provider: prov,
          phone: phoneNum,
          amount_xof: priceXof,
          agency_id: profile?.agency_id,
        },
      });

      if (error) {
        const rawMsg = error.message ?? '';
        if (isCorsOrNetworkError(rawMsg)) {
          setIsEdgeFunctionDown(true);
          setErrorMsg('Le service de paiement est en cours de déploiement. Contactez-nous sur WhatsApp pour activer votre abonnement maintenant.');
        } else {
          setErrorMsg(rawMsg || 'Impossible d\'initier le paiement.');
        }
        setStep('error');
        return;
      }

      if (!data?.transaction_id) {
        setErrorMsg(data?.error ?? 'Réponse inattendue du serveur.');
        setStep('error');
        return;
      }

      setTransactionId(data.transaction_id);

      // Softpay mobile push échoué → fallback carte
      if (data.softpay_error && data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        setStep('card_redirect');
        startPolling(data.transaction_id);
        return;
      }

      // Carte : ouvrir la page PayDunya dans un onglet
      if (prov === 'card' && data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        window.open(data.checkout_url, '_blank', 'noopener,noreferrer');
        setStep('card_redirect');
        startPolling(data.transaction_id);
        return;
      }

      // Mode test : simuler succès
      if (data.test_mode) {
        setStep('success');
        setTimeout(() => onSuccess(), 2000);
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Activer le plan ${planName}`}>

      {/* ── Récapitulatif toujours visible ── */}
      {step !== 'success' && step !== 'error' && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-5 text-sm"
          style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <span className="font-semibold text-slate-800">Plan {planName}</span>
          <span className="font-extrabold" style={{ color: '#F58220' }}>{formatCurrency(priceXof)}<span className="font-normal text-slate-400 text-xs">/mois</span></span>
        </div>
      )}

      {/* ─── Étape 1 : Choix du moyen de paiement ─── */}
      {step === 'select_provider' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700 mb-3">Choisissez votre moyen de paiement</p>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectProvider(p.id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-current transition-all group text-left"
              style={{ '--hover-color': p.color } as React.CSSProperties}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: p.bg }}>
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-400">{p.sub}</p>
              </div>
              {p.id === 'card' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: p.bg, color: p.color }}>
                  Visa · MC
                </span>
              )}
            </button>
          ))}
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" />Sécurisé PayDunya</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Activation instantanée</span>
          </div>
        </div>
      )}

      {/* ─── Étape 2 : Saisie numéro (mobile money) ─── */}
      {step === 'enter_phone' && selectedProvider && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('select_provider')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Changer de moyen
          </button>

          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: selectedProvider.bg, border: `1.5px solid ${selectedProvider.color}30` }}>
            <span className="text-2xl">{selectedProvider.emoji}</span>
            <div>
              <p className="font-bold text-slate-900">{selectedProvider.label}</p>
              <p className="text-xs text-slate-500">{selectedProvider.sub}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Numéro {selectedProvider.label} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">🇸🇳 +221</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handlePay()}
                placeholder="77 123 45 67"
                maxLength={14}
                autoFocus
                className="w-full pl-24 pr-4 py-3.5 border-2 border-slate-200 rounded-xl text-lg tracking-wider focus:outline-none transition"
                onFocus={(e) => (e.target.style.borderColor = selectedProvider.color)}
                onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>
            {phoneError && (
              <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />{phoneError}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">Vous recevrez une notification sur ce numéro pour confirmer.</p>
          </div>

          <button
            onClick={handlePay}
            className="w-full py-4 rounded-xl font-bold text-base text-white transition-all shadow-lg hover:shadow-xl active:scale-95"
            style={{ background: `linear-gradient(135deg, ${selectedProvider.color} 0%, ${selectedProvider.color}CC 100%)` }}
          >
            {selectedProvider.emoji} Payer {formatCurrency(priceXof)}
          </button>

          <p className="text-xs text-center text-slate-400">
            100 % sécurisé · Sans carte bancaire · Annulable à tout moment
          </p>
        </div>
      )}

      {/* ─── Processing ─── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#F58220' }} />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900">Connexion à PayDunya…</p>
            <p className="text-sm text-slate-400 mt-1">Création de votre facture de paiement</p>
          </div>
        </div>
      )}

      {/* ─── Polling (mobile money push) ─── */}
      {step === 'polling' && selectedProvider && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
              style={{ backgroundColor: selectedProvider.bg }}>
              {selectedProvider.emoji}
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: selectedProvider.color }}>
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-slate-900">Confirmez sur votre téléphone</p>
            <p className="text-sm text-slate-600 max-w-xs">
              Une notification <strong>{selectedProvider.label}</strong> a été envoyée au{' '}
              <strong>+221 {phone}</strong>. Ouvrez l'application et confirmez le paiement.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>
              <Clock className="w-4 h-4" />
              {minutesLeft > 0 ? `${minutesLeft}m ` : ''}{String(secondsLeft).padStart(2, '0')}s restantes
            </div>
          </div>
          <button
            onClick={() => { stopPolling(); setStep('enter_phone'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Changer de numéro
          </button>
        </div>
      )}

      {/* ─── Carte : redirection PayDunya ─── */}
      {step === 'card_redirect' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
            <CreditCard className="w-12 h-12" style={{ color: '#1D4ED8' }} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-slate-900">Paiement par carte</p>
            <p className="text-sm text-slate-600 max-w-xs">
              Une page de paiement sécurisée a été ouverte dans un nouvel onglet.
              Complétez le paiement puis revenez ici.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              En attente de confirmation…
            </div>
          </div>
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition"
              style={{ backgroundColor: '#1D4ED8', color: 'white' }}
            >
              <ExternalLink className="w-4 h-4" />
              Rouvrir la page de paiement
            </a>
          )}
          <button
            onClick={() => { stopPolling(); setStep('select_provider'); }}
            className="text-sm text-slate-400 hover:text-slate-700 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Choisir un autre moyen
          </button>
        </div>
      )}

      {/* ─── Succès ─── */}
      {step === 'success' && (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-slate-900">Abonnement activé !</p>
            <p className="text-sm text-slate-600 mt-2">
              Le plan <strong>{planName}</strong> est actif pour 30 jours.<br />
              Un email de confirmation vous a été envoyé.
            </p>
          </div>
        </div>
      )}

      {/* ─── Erreur ─── */}
      {step === 'error' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-9 h-9 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900">
              {isEdgeFunctionDown ? 'Service temporairement indisponible' : 'Paiement non confirmé'}
            </p>
            <p className="text-sm text-slate-500 mt-2 max-w-xs">{errorMsg}</p>
          </div>
          <div className="w-full space-y-2">
            {isEdgeFunctionDown ? (
              <>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Bonjour, je veux activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <Smartphone className="w-5 h-5" />
                  Activer via WhatsApp
                </a>
                <button
                  onClick={() => { setStep('select_provider'); setErrorMsg(''); setIsEdgeFunctionDown(false); }}
                  className="w-full py-2.5 border-2 border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Réessayer quand même
                </button>
              </>
            ) : (
              <button
                onClick={() => { setStep('select_provider'); setErrorMsg(''); }}
                className="w-full py-3 rounded-xl text-white font-bold transition active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F58220 0%, #C2410C 100%)' }}
              >
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
