/**
 * CheckoutModal — Paiement PayDunya (Orange Money)
 *
 * Flux :
 *   1. Saisie numéro Orange Money
 *   2. Appel Edge Function initiate-payment → crée invoice PayDunya + transaction DB
 *   3. PayDunya envoie une demande de paiement sur le téléphone
 *   4. Polling statut transaction (max 3 min)
 *   5. Webhook PayDunya → activate_subscription (côté serveur)
 *   6. Success screen
 */
import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import {
  CheckCircle2, Loader2, Smartphone, ArrowLeft,
  AlertCircle, Phone, Shield, Clock,
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

type Step = 'enter_phone' | 'processing' | 'polling' | 'success' | 'error';

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36;

const CONTACT_WHATSAPP = '221774000000';

function isCorsOrNetworkError(msg: string): boolean {
  return (
    msg.toLowerCase().includes('failed to send') ||
    msg.toLowerCase().includes('cors') ||
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('fetch') ||
    msg.toLowerCase().includes('edge function')
  );
}

export function CheckoutModal({ isOpen, onClose, planId, planName, priceXof, onSuccess }: CheckoutModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('enter_phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEdgeFunctionDown, setIsEdgeFunctionDown] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setStep('enter_phone');
      setPhone('');
      setPhoneError('');
      setErrorMsg('');
      setIsEdgeFunctionDown(false);
      setTransactionId(null);
      setPollCount(0);
    }
  }, [isOpen]);

  useEffect(() => { return () => stopPolling(); }, []);

  const handlePay = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setPhoneError('Entrez un numéro valide (8 chiffres minimum).');
      return;
    }
    setPhoneError('');
    setStep('processing');

    try {
      const { data, error } = await supabase.functions.invoke('initiate-payment', {
        body: {
          plan_id: planId,
          phone: cleaned,
          amount_xof: priceXof,
          agency_id: profile?.agency_id,
        },
      });

      if (error) {
        const rawMsg = error.message ?? '';
        if (isCorsOrNetworkError(rawMsg)) {
          setIsEdgeFunctionDown(true);
          setErrorMsg('Le service de paiement en ligne est en cours de déploiement. Contactez-nous sur WhatsApp pour activer votre abonnement maintenant.');
        } else {
          setIsEdgeFunctionDown(false);
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
      setStep('polling');
      startPolling(data.transaction_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue.';
      if (isCorsOrNetworkError(msg)) {
        setIsEdgeFunctionDown(true);
        setErrorMsg('Le service de paiement en ligne est en cours de déploiement. Contactez-nous sur WhatsApp pour activer votre abonnement maintenant.');
      } else {
        setIsEdgeFunctionDown(false);
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
        setIsEdgeFunctionDown(false);
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
        setIsEdgeFunctionDown(false);
        setErrorMsg('Le paiement a échoué ou a été annulé. Veuillez réessayer.');
        setStep('error');
      }
    }, POLL_INTERVAL_MS);
  };

  const handleClose = () => {
    if (step === 'processing') return;
    stopPolling();
    onClose();
  };

  const timeLeft = Math.max(0, POLL_MAX_ATTEMPTS - pollCount) * (POLL_INTERVAL_MS / 1000);
  const minutesLeft = Math.floor(timeLeft / 60);
  const secondsLeft = timeLeft % 60;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Activer le plan ${planName}`}>
      {step === 'enter_phone' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FED7AA' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F58220' }}>
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">{planName}</p>
                <p className="text-2xl font-extrabold" style={{ color: '#F58220' }}>{formatCurrency(priceXof)}<span className="text-sm font-normal text-slate-500 ml-1">/ mois</span></p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Numéro Orange Money <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">🇸🇳 +221</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                placeholder="77 123 45 67"
                maxLength={14}
                autoFocus
                className="w-full pl-24 pr-4 py-3.5 border border-slate-300 rounded-xl text-lg tracking-wider focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': '#F58220' } as React.CSSProperties}
                onFocus={(e) => e.target.style.borderColor = '#F58220'}
                onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
              />
            </div>
            {phoneError && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{phoneError}</p>}
            <p className="mt-1.5 text-xs text-slate-400">Vous recevrez une notification de confirmation sur ce numéro.</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Récapitulatif</p>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Plan {planName}</span><span className="font-semibold">{formatCurrency(priceXof)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Durée</span><span className="font-semibold">30 jours</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Renouvellement</span><span className="font-semibold">Automatique</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2.5">
              <span className="text-slate-900">Total à payer</span>
              <span style={{ color: '#F58220' }}>{formatCurrency(priceXof)}</span>
            </div>
          </div>

          <button
            onClick={handlePay}
            className="w-full py-4 text-white rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-xl active:scale-95"
            style={{ background: 'linear-gradient(135deg, #F58220 0%, #C2410C 100%)' }}
          >
            Payer {formatCurrency(priceXof)} via Orange Money
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" />100 % sécurisé</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Activation instantanée</span>
            <span>·</span>
            <span>Sans carte bancaire</span>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="relative">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#F58220' }} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900">Initialisation du paiement…</p>
            <p className="text-sm text-slate-500 mt-1">Connexion à Orange Money en cours</p>
          </div>
        </div>
      )}

      {step === 'polling' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
              <Phone className="w-12 h-12" style={{ color: '#F58220' }} />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F58220' }}>
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-slate-900">Confirmez sur votre téléphone</p>
            <p className="text-sm text-slate-600 max-w-xs">
              Une notification Orange Money a été envoyée au <strong>+221 {phone}</strong>.
              Ouvrez l'app Orange Money et confirmez le paiement.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>
              <Clock className="w-4 h-4" />
              Attente {minutesLeft > 0 ? `${minutesLeft}m ` : ''}{String(secondsLeft).padStart(2, '0')}s
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

      {step === 'success' && (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">Abonnement activé !</p>
            <p className="text-sm text-slate-600 mt-2">
              Le plan <strong>{planName}</strong> est maintenant actif pour 30 jours.<br />
              Un email de confirmation a été envoyé.
            </p>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-9 h-9 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900">
              {isEdgeFunctionDown ? 'Paiement en ligne indisponible' : 'Paiement non confirmé'}
            </p>
            <p className="text-sm text-slate-500 mt-2 max-w-xs">{errorMsg}</p>
          </div>
          <div className="w-full space-y-2">
            {isEdgeFunctionDown ? (
              <>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Bonjour, je souhaite activer le plan ${planName} sur Samay Këur (${formatCurrency(priceXof)}/mois).`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <Smartphone className="w-5 h-5" />
                  Contacter sur WhatsApp
                </a>
                <button
                  onClick={() => { setStep('enter_phone'); setErrorMsg(''); setIsEdgeFunctionDown(false); }}
                  className="w-full py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Réessayer quand même
                </button>
              </>
            ) : (
              <button
                onClick={() => { setStep('enter_phone'); setErrorMsg(''); }}
                className="w-full py-3 rounded-xl text-white font-bold transition"
                style={{ backgroundColor: '#F58220' }}
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
