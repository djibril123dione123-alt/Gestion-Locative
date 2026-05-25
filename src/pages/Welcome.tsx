import React, { useEffect, useState } from 'react';
import {
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { reloadUserProfile } from '../lib/agencyHelper';
import { BrandLogo } from '../components/brand/BrandLogo';
import { LoadingState } from '../components/ui/LoadingState';
import { formatSenegalPhoneInput, normalizeSenegalPhone } from '../lib/formatters';

type AccountType = 'agency' | 'bailleur';
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AgencyRequestRow {
  id: string;
  status: RequestStatus;
  agency_name: string;
  is_bailleur_account: boolean;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  created_agency_id: string | null;
}

export default function Welcome() {
  const { user } = useAuth();
  const { showToast, toasts, removeToast } = useToast();

  // ─── État de la demande existante (pour gérer pending / rejected) ─────────
  const [requestLoading, setRequestLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<AgencyRequestRow | null>(null);
  const [resetting, setResetting] = useState(false);

  // ─── État du formulaire (mode "création de demande") ──────────────────────
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: user?.email || '',
    address: '',
    ninea: '',
    devise: 'XOF',
  });

  // Charger la demande existante de l'utilisateur (status pending/rejected/approved)
  useEffect(() => {
    if (!user) {
      setRequestLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('agency_creation_requests')
          .select('id, status, agency_name, is_bailleur_account, rejection_reason, created_at, reviewed_at, created_agency_id')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn('Lecture agency_creation_requests :', error.message);
          setExistingRequest(null);
        } else {
          setExistingRequest((data as AgencyRequestRow | null) ?? null);
        }
      } catch (err) {
        console.warn('Erreur chargement demande :', err);
        if (!cancelled) setExistingRequest(null);
      } finally {
        if (!cancelled) setRequestLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Polling léger : si une demande pending existe, on poll toutes les 8s pour
  // détecter une approbation et basculer immédiatement.
  useEffect(() => {
    if (!user || !existingRequest || existingRequest.status !== 'pending') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('agency_creation_requests')
        .select('id, status, agency_name, is_bailleur_account, rejection_reason, created_at, reviewed_at, created_agency_id')
        .eq('id', existingRequest.id)
        .maybeSingle();
      if (data && data.status !== 'pending') {
        setExistingRequest(data as AgencyRequestRow);
        if (data.status === 'approved') {
          await reloadUserProfile();
          window.location.href = '/';
        }
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [user, existingRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType || !user) {
      showToast('Données manquantes pour la demande', 'error');
      return;
    }
    setLoading(true);
    try {
      const normalizedPhone = normalizeSenegalPhone(formData.phone);
      if (!normalizedPhone) {
        showToast('Le téléphone doit être un numéro sénégalais valide, par exemple 77 123 45 67.', 'error');
        setLoading(false);
        return;
      }
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
      }

      const { data, error } = await supabase
        .from('agency_creation_requests')
        .insert({
          requester_id: user.id,
          requester_email: user.email,
          requester_name: null,
          requester_phone: normalizedPhone,
          agency_name: formData.name.trim(),
          agency_phone: normalizedPhone,
          agency_email: formData.email.trim() || user.email,
          agency_address: formData.address.trim() || null,
          agency_ninea: formData.ninea.trim() || null,
          agency_devise: formData.devise || 'XOF',
          is_bailleur_account: accountType === 'bailleur',
          status: 'pending',
        })
        .select('id, status, agency_name, is_bailleur_account, rejection_reason, created_at, reviewed_at, created_agency_id')
        .single();
      if (error) throw error;

      setExistingRequest(data as AgencyRequestRow);
      showToast('Votre demande a été envoyée. Vous serez notifié dès qu\'elle sera traitée.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'envoi de la demande';
      showToast(msg, 'error');
      console.error('Erreur création demande :', err);
    } finally {
      setLoading(false);
    }
  };

  // Permettre à l'utilisateur de soumettre une nouvelle demande après un rejet
  const handleResetRequest = async () => {
    if (!user || !existingRequest) return;
    if (existingRequest.status !== 'rejected' && existingRequest.status !== 'cancelled') return;
    setResetting(true);
    try {
      setExistingRequest(null);
      setStep(0);
      setAccountType(null);
      setFormData({
        name: '',
        phone: '',
        email: user.email || '',
        address: '',
        ninea: '',
        devise: 'XOF',
      });
    } finally {
      setResetting(false);
    }
  };

  const nextStep = () => {
    if (step === 0 && !accountType) return;
    if (step === 1 && !formData.name.trim()) return;
    if (step === 2 && !formData.phone.trim()) return;
    if (step >= 3) return;
    setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  // ─── Vues d'état ──────────────────────────────────────────────────────────

  if (requestLoading) {
    return (
      <div className="min-h-screen bg-brand-paper">
        <LoadingState
          label="Initialisation"
          description="Préparation de votre espace Samay Këur."
          className="min-h-screen"
        />
      </div>
    );
  }

  const requestKindLabel = existingRequest?.is_bailleur_account ? 'espace propriétaire' : 'agence';
  const requestCreatedLabel = existingRequest?.is_bailleur_account ? 'Votre espace propriétaire' : 'Votre agence';

  if (existingRequest && existingRequest.status === 'pending') {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden p-4">
          <div className="sk-card-premium max-w-lg w-full bg-white/92 p-8 text-center shadow-[0_32px_120px_rgba(6,17,13,0.32)]">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6">
              <Clock className="w-10 h-10 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Demande en cours d'examen</h1>
            <p className="text-slate-600 mb-6">
              Votre demande de création de votre {requestKindLabel}{' '}
              <span className="font-semibold text-slate-900">« {existingRequest.agency_name} »</span>{' '}
              a bien été reçue le{' '}
              <span className="font-semibold">
                {new Date(existingRequest.created_at).toLocaleDateString('fr-FR')}
              </span>
              . Notre équipe l'examinera dans les meilleurs délais.
            </p>
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-orange-900 flex items-start gap-2">
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  Vous recevrez une notification dès l'approbation. Vous pouvez fermer cet onglet
                  et revenir plus tard.
                </span>
              </p>
            </div>
            <button
              onClick={async () => {
                window.location.reload();
              }}
              className="w-full px-6 py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: '#F58220' }}
              data-testid="button-refresh-pending"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="mt-3 text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </>
    );
  }

  if (existingRequest && existingRequest.status === 'rejected') {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden p-4">
          <div className="sk-card-premium max-w-lg w-full bg-white/92 p-8 text-center shadow-[0_32px_120px_rgba(6,17,13,0.32)]">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Demande non approuvée</h1>
            <p className="text-slate-600 mb-4">
              Votre demande pour votre {requestKindLabel}{' '}
              <span className="font-semibold text-slate-900">« {existingRequest.agency_name} »</span>{' '}
              n'a pas été approuvée par notre équipe.
            </p>
            {existingRequest.rejection_reason && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-semibold text-red-900 mb-1">Motif :</p>
                <p className="text-sm text-red-800">{existingRequest.rejection_reason}</p>
              </div>
            )}
            <button
              onClick={handleResetRequest}
              disabled={resetting}
              className="w-full px-6 py-3 rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#F58220' }}
              data-testid="button-new-request"
            >
              {resetting ? 'Préparation…' : 'Soumettre une nouvelle demande'}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="mt-3 text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </>
    );
  }

  if (existingRequest && existingRequest.status === 'approved') {
    // Race condition : la demande est approuvée mais le profil n'a pas encore été rechargé.
    return (
      <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <div className="sk-card-premium max-w-lg w-full bg-white/92 p-8 text-center shadow-[0_32px_120px_rgba(6,17,13,0.32)]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Demande approuvée !</h1>
          <p className="text-slate-600 mb-6">
            {requestCreatedLabel} a été créé{existingRequest?.is_bailleur_account ? '' : 'e'}. Cliquez ci-dessous pour accéder à votre espace.
          </p>
          <button
            onClick={async () => {
              await reloadUserProfile();
              window.location.href = '/';
            }}
            className="w-full px-6 py-3 rounded-lg text-white font-semibold"
            style={{ backgroundColor: '#F58220' }}
            data-testid="button-enter-app"
          >
            Accéder à mon espace
          </button>
        </div>
      </div>
    );
  }

  // ─── Vue formulaire (création de la demande) ──────────────────────────────

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="max-w-4xl w-full animate-fadeIn">
            <div className="text-center mb-12 animate-slideInUp">
              <BrandLogo size="lg" tone="light" animated showTagline stacked className="items-center justify-center" />
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-950 via-emerald-800 to-orange-600 bg-clip-text text-transparent mb-4">
                Bienvenue sur Samay Këur
              </h1>
              <p className="text-lg md:text-xl text-gray-700">
                Choisissez le type de compte qui vous correspond
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => { setAccountType('agency'); nextStep(); }}
                className="sk-card-premium bg-white/94 rounded-[1.4rem] p-8 text-left shadow-premium transition-all group hover:-translate-y-1 hover:shadow-premium-lg"
                data-testid="card-account-agency"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                  <Building2 className="w-8 h-8 text-emerald-800" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Je gère pour des clients</h2>
                <p className="text-gray-600 mb-6">
                  Gérez des propriétaires, leurs biens, les mandats, les encaissements et les rapports.
                  Idéal pour une agence ou un cabinet de gestion.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-700 mr-2" />Gestion multi-bailleurs</li>
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-700 mr-2" />Équipe collaborative</li>
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-700 mr-2" />Rapports personnalisés</li>
                </ul>
                <div className="flex items-center text-emerald-800 font-semibold">
                  Choisir ce type
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => { setAccountType('bailleur'); nextStep(); }}
                className="sk-card-premium bg-white/94 rounded-[1.4rem] p-8 text-left shadow-premium transition-all group hover:-translate-y-1 hover:shadow-premium-lg"
                data-testid="card-account-bailleur"
              >
                <div className="w-16 h-16 bg-orange-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-orange-100 transition-colors">
                  <User className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Je gère mes propres biens</h2>
                <p className="text-gray-600 mb-6">
                  Suivez vos locataires, loyers, impayés et documents sans logique d'agence inutile.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />Gestion de vos biens</li>
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />Suivi des loyers</li>
                  <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-orange-500 mr-2" />Tableaux de bord clairs</li>
                </ul>
                <div className="flex items-center text-orange-600 font-semibold">
                  Choisir ce type
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-gray-500">
                Toute demande est validée par notre équipe sous 24h ouvrées.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button onClick={prevStep} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" />Retour
                </button>
                <span className="text-sm text-gray-500">Étape 1 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {accountType === 'agency' ? 'Nom de votre structure' : 'Votre nom complet'}
              </h2>
              <p className="text-gray-600">
                {accountType === 'agency'
                  ? 'Comment s\'appelle votre agence ou cabinet de gestion ?'
                  : 'Quel est votre nom complet ?'}
              </p>
            </div>
            <div className="space-y-6">
              <input
                type="text"
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder={accountType === 'agency' ? 'Ex: Immobilier Premium Dakar' : 'Ex: Moussa Diop'}
                onKeyPress={(e) => e.key === 'Enter' && formData.name.trim() && nextStep()}
                data-testid="input-name"
              />
              <button
                onClick={nextStep}
                disabled={!formData.name.trim()}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
                data-testid="button-next-step-1"
              >
                Continuer<ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button onClick={prevStep} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" />Retour
                </button>
                <span className="text-sm text-gray-500">Étape 2 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Numéro de téléphone</h2>
              <p className="text-gray-600">Pour que nous puissions vous joindre concernant votre demande.</p>
            </div>
            <div className="space-y-6">
              <input
                type="tel"
                autoFocus
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatSenegalPhoneInput(e.target.value) })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder="+221 77 123 45 67"
                onKeyPress={(e) => e.key === 'Enter' && formData.phone.trim() && nextStep()}
                data-testid="input-phone"
              />
              <button
                onClick={nextStep}
                disabled={!formData.phone.trim()}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
                data-testid="button-next-step-2"
              >
                Continuer<ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 animate-fadeIn">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button onClick={prevStep} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" />Retour
                </button>
                <span className="text-sm text-gray-500">Étape 3 sur 3</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Informations complémentaires</h2>
              <p className="text-gray-600">Quelques détails optionnels pour finaliser votre demande.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Sacré-Cœur 3, Dakar"
                  data-testid="input-address"
                />
              </div>
              <div>
                {accountType === 'agency' && (
                  <>
                    <label className="block text-sm font-medium text-slate-700 mb-2">NINEA (optionnel au démarrage)</label>
                    <input
                      type="text"
                      value={formData.ninea}
                      onChange={(e) => setFormData({ ...formData, ninea: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="00123456789"
                      data-testid="input-ninea"
                    />
                  </>
                )}
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-5 border-2 border-orange-200">
                <h3 className="font-bold text-orange-900 mb-2">Validation par notre équipe</h3>
                <p className="text-sm text-orange-800">
                  Votre demande est examinée sous 24h ouvrées. Vous recevrez une notification
                  par email dès l'approbation.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center shadow-lg hover:shadow-xl"
                data-testid="button-submit-request"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3" />
                    Envoi en cours…
                  </>
                ) : (
                  <>Envoyer ma demande<CheckCircle2 className="w-5 h-5 ml-2" /></>
                )}
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        {renderStepContent()}
      </div>
    </>
  );
}
