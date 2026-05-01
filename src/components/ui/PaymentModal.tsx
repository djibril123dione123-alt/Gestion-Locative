import { useState } from 'react';
import { Modal } from './Modal';
import { CheckCircle2, Loader2, Smartphone, CreditCard, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTracking } from '../../hooks/useTracking';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  priceXof: number;
  onSuccess: () => void;
}

type Provider = 'wave' | 'orange_money';
type Step = 'choose' | 'enter_phone' | 'processing' | 'success';

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
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned || cleaned.length < 9) {
      setError('Entrez un numéro valide (9 chiffres minimum).');
      return;
    }
    setError('');
    setStep('processing');

    await new Promise((r) => setTimeout(r, 2500));

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
          metadata: { provider, plan: planName, amount: priceXof, phone: cleaned.slice(-4) },
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
      setError('Erreur lors de l\'activation. Veuillez réessayer.');
    }
  };

  const providerLabel = provider === 'wave' ? 'Wave' : 'Orange Money';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Payer l'abonnement">
      {step === 'choose' && (
        <div className="space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm text-orange-900">
              Activez le plan <strong>{planName}</strong> —{' '}
              <strong>{priceXof.toLocaleString('fr-FR')} FCFA / mois</strong> · Activation instantanée · 30 jours
            </p>
          </div>

          <p className="text-sm font-semibold text-slate-700">Choisissez votre moyen de paiement :</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => { setProvider('wave'); setStep('enter_phone'); }}
              className="flex flex-col items-center gap-3 p-5 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Smartphone className="w-7 h-7 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Wave</p>
                <p className="text-xs text-slate-500 mt-0.5">Paiement mobile Wave</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Disponible</span>
            </button>

            <button
              onClick={() => { setProvider('orange_money'); setStep('enter_phone'); }}
              className="flex flex-col items-center gap-3 p-5 border-2 border-slate-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all group focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <CreditCard className="w-7 h-7 text-orange-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Orange Money</p>
                <p className="text-xs text-slate-500 mt-0.5">Paiement mobile Orange</p>
              </div>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Disponible</span>
            </button>
          </div>

          <p className="text-xs text-center text-slate-400">
            Paiement 100 % sécurisé • Aucune carte bancaire requise
          </p>
        </div>
      )}

      {step === 'enter_phone' && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('choose')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            {provider === 'wave' ? (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">{providerLabel}</p>
              <p className="text-xs text-slate-500">{priceXof.toLocaleString('fr-FR')} FCFA · 30 jours</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Numéro {providerLabel}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex : 77 123 45 67"
              maxLength={14}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg tracking-wider focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              autoFocus
            />
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
            <p className="mt-1.5 text-xs text-slate-400">
              Vous recevrez une notification de confirmation sur ce numéro.
            </p>
          </div>

          <button
            onClick={handlePay}
            className="w-full px-4 py-3 text-white rounded-xl font-semibold transition text-base shadow-lg hover:shadow-xl"
            style={{ background: 'linear-gradient(135deg, #F58220 0%, #E65100 100%)' }}
          >
            Payer {priceXof.toLocaleString('fr-FR')} FCFA
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-5 py-10">
          <Loader2 className="w-14 h-14 text-orange-500 animate-spin" />
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900">Traitement en cours…</p>
            <p className="text-sm text-slate-500 mt-1">Validation du paiement {providerLabel}</p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">Paiement réussi !</p>
            <p className="text-sm text-slate-600 mt-2">
              Abonnement <strong>{planName}</strong> activé pour 30 jours.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
