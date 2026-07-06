import React, { useEffect, useState } from 'react';
import {
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
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

const welcomeInputClass =
  'w-full rounded-2xl border border-white/20 bg-[#FDFBF7] px-4 py-3.5 text-base font-semibold text-brand-950 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition placeholder:text-slate-500 focus:border-amber-400/70 focus:bg-white focus:ring-4 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60';

const welcomePrimaryButtonClass =
  'flex w-full min-h-12 items-center justify-center rounded-2xl border border-emerald-950/10 bg-[#072F24] px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_48px_rgba(7,47,36,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] hover:shadow-[0_24px_60px_rgba(7,47,36,0.32)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-none disabled:bg-slate-700/80 disabled:text-slate-200 disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';

function WelcomeShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 p-4 sm:p-6 [@media(max-height:800px)]:items-start [@media(max-height:800px)]:p-3 ${compact ? 'items-start' : ''}`}>
      <picture className="pointer-events-none absolute inset-0">
        <source media="(max-width: 767px)" srcSet="/brand/image-premium-page-accueil-mobile.png" />
        <img
          src="/brand/image-premium-page-accueil-desktop.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
        />
      </picture>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,17,13,0.66)_0%,rgba(6,17,13,0.28)_42%,rgba(6,17,13,0.74)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,138,0,0.13),transparent_22rem),radial-gradient(circle_at_16%_76%,rgba(52,211,153,0.12),transparent_18rem)]" />
      <div className="relative z-10 flex w-full justify-center py-6 sm:py-8 [@media(max-height:800px)]:py-3 [@media(max-height:760px)]:py-2">
        {children}
      </div>
    </div>
  );
}

export default function Welcome() {
  const { user } = useAuth();
  const { showToast, toasts, removeToast } = useToast();

  // État de la demande existante (pour gérer pending / rejected)
  const [requestLoading, setRequestLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<AgencyRequestRow | null>(null);
  const [resetting, setResetting] = useState(false);

  // État du formulaire (mode "création de demande")
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

  // Vues d'état

  if (requestLoading) {
    return (
      <WelcomeShell compact>
        <LoadingState
          label="Initialisation"
          description="Préparation de votre espace Samay Këur."
          className="min-h-[420px] rounded-[1.75rem] border border-white/15 bg-white/88 px-8 shadow-[0_34px_120px_rgba(6,17,13,0.30)] backdrop-blur-2xl"
        />
      </WelcomeShell>
    );
  }

  const requestKindLabel = existingRequest?.is_bailleur_account ? 'espace propriétaire' : 'espace agence';
  const requestCreatedLabel = existingRequest?.is_bailleur_account ? 'Votre espace propriétaire' : 'Votre agence';

  if (existingRequest && existingRequest.status === 'pending') {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <WelcomeShell compact>
          <div className="w-full max-w-xl animate-fadeIn">
            <div className="mb-5 flex justify-center">
              <BrandLogo size="sm" tone="dark" animated showTagline stacked className="items-center justify-center" />
            </div>
            <div className="rounded-[1.75rem] border border-white/18 bg-brand-950/68 p-6 text-center shadow-[0_34px_120px_rgba(6,17,13,0.32)] backdrop-blur-2xl sm:p-8 [@media(max-height:800px)]:p-6">
              <div className="mx-auto mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300/35 bg-[linear-gradient(135deg,#F7E6BF,#C8872E)] text-brand-950 shadow-[0_18px_48px_rgba(143,74,18,0.20)] [@media(max-height:800px)]:mb-4 [@media(max-height:800px)]:h-14 [@media(max-height:800px)]:w-14">
                <Clock className="h-4 w-4 [@media(max-height:800px)]:h-7 [@media(max-height:800px)]:w-7" />
              </div>
              <div className="mb-3 inline-flex rounded-full border border-amber-300/30 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                Validation manuelle
              </div>
              <h1 className="mb-3 font-serif text-3xl font-black text-[#FFF7E6] [@media(max-height:800px)]:text-2xl">Demande en cours d'examen</h1>
              <p className="mx-auto mb-5 max-w-md text-sm font-semibold leading-7 text-slate-200 sm:text-base">
                Votre demande de création d'{requestKindLabel}{' '}
                <span className="font-black text-white">« {existingRequest.agency_name} »</span>{' '}
                a bien été reçue le{' '}
                <span className="font-black text-white">
                  {new Date(existingRequest.created_at).toLocaleDateString('fr-FR')}
                </span>
                . Notre équipe l'examinera dans les meilleurs délais.
              </p>
              <div className="mb-5 rounded-lg border border-amber-200/30 bg-amber-100/12 p-2.5 text-left shadow-inner shadow-white/50">
                <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#FFF7E6]">
                  <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                  <span>
                    Vous recevrez une notification par email dès l'approbation. Vous pouvez fermer cet onglet
                    et revenir plus tard.
                  </span>
                </p>
              </div>
            <button
              onClick={async () => {
                window.location.reload();
              }}
              className={`${welcomePrimaryButtonClass} gap-2`}
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
              className="mt-4 text-sm font-bold text-slate-400 transition hover:text-white"
            >
              Se déconnecter
            </button>
          </div>
          </div>
        </WelcomeShell>
      </>
    );
  }

  if (existingRequest && existingRequest.status === 'rejected') {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <WelcomeShell compact>
          <div className="w-full max-w-xl animate-fadeIn">
            <div className="mb-5 flex justify-center">
              <BrandLogo size="sm" tone="dark" animated showTagline stacked className="items-center justify-center" />
            </div>
            <div className="rounded-[1.75rem] border border-white/18 bg-brand-950/68 p-6 text-center shadow-[0_34px_120px_rgba(6,17,13,0.32)] backdrop-blur-2xl sm:p-8">
              <div className="mx-auto mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-[0_18px_48px_rgba(153,27,27,0.14)]">
                <XCircle className="h-4 w-4" />
              </div>
              <h1 className="mb-3 font-serif text-3xl font-black text-[#FFF7E6]">Demande non approuvée</h1>
              <p className="mx-auto mb-4 max-w-md text-sm font-semibold leading-7 text-slate-200 sm:text-base">
              Votre demande pour votre {requestKindLabel}{' '}
                <span className="font-black text-white">« {existingRequest.agency_name} »</span>{' '}
                n'a pas été approuvée par notre équipe.
            </p>
            {existingRequest.rejection_reason && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-left">
                <p className="text-sm font-semibold text-red-900 mb-1">Motif :</p>
                <p className="text-sm text-red-800">{existingRequest.rejection_reason}</p>
              </div>
            )}
            <button
              onClick={handleResetRequest}
              disabled={resetting}
              className={welcomePrimaryButtonClass}
              data-testid="button-new-request"
            >
              {resetting ? 'Préparation…' : 'Soumettre une nouvelle demande'}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="mt-4 text-sm font-bold text-slate-500 transition hover:text-brand-800"
            >
              Se déconnecter
            </button>
          </div>
          </div>
        </WelcomeShell>
      </>
    );
  }

  if (existingRequest && existingRequest.status === 'approved') {
    // Race condition : la demande est approuvée mais le profil n'a pas encore été rechargé.
    return (
      <WelcomeShell compact>
        <div className="w-full max-w-xl animate-fadeIn">
          <div className="mb-5 flex justify-center">
            <BrandLogo size="sm" tone="dark" animated showTagline stacked className="items-center justify-center" />
          </div>
          <div className="rounded-[1.75rem] border border-white/18 bg-brand-950/68 p-6 text-center shadow-[0_34px_120px_rgba(6,17,13,0.32)] backdrop-blur-2xl sm:p-8">
            <div className="mx-auto mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_18px_48px_rgba(6,95,70,0.16)]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h1 className="mb-3 font-serif text-3xl font-black text-[#FFF7E6]">Demande approuvée !</h1>
            <p className="mb-6 text-sm font-semibold leading-7 text-slate-200 sm:text-base">
            {requestCreatedLabel} a été créé{existingRequest?.is_bailleur_account ? '' : 'e'}. Cliquez ci-dessous pour accéder à votre espace.
          </p>
          <button
            onClick={async () => {
              await reloadUserProfile();
              window.location.href = '/';
            }}
            className={welcomePrimaryButtonClass}
            data-testid="button-enter-app"
          >
            Accéder à mon espace
          </button>
        </div>
        </div>
      </WelcomeShell>
    );
  }

  // Vue formulaire (création de la demande)

  const formSteps = accountType === 'agency'
    ? ['Structure', 'Contact', 'Détails']
    : ['Identité', 'Contact', 'Adresse'];

  const renderStepper = () => (
    <div className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-white/22 bg-brand-950/50 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:px-5  .5">
      <div className="grid grid-cols-3 items-center gap-2">
        {formSteps.map((label, index) => {
          const itemStep = index + 1;
          const isActive = step === itemStep;
          const isDone = step > itemStep;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-xs font-black transition [@media(max-height:800px)]:h-7 [@media(max-height:800px)]:w-7 ${
                isActive
                  ? 'border-amber-200 bg-amber-200 text-brand-950 shadow-[0_10px_26px_rgba(208,138,36,0.26)]'
                  : isDone
                    ? 'border-emerald-200/70 bg-emerald-200/90 text-brand-950'
                    : 'border-white/40 bg-white/20 text-white'
              }`}>
                {String(itemStep).padStart(2, '0')}
              </div>
              <span className={`min-w-0 text-[11px] font-black uppercase leading-tight sm:text-xs ${
                isActive ? 'text-amber-100' : isDone ? 'text-emerald-100' : 'text-slate-100'
              }`}>
                {label}
              </span>
              {index < formSteps.length - 1 && (
                <div className={`hidden h-px flex-1 sm:block ${isDone ? 'bg-emerald-200/70' : 'bg-white/28'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderFormCard = (children: React.ReactNode) => (
    <div className="w-full max-w-2xl animate-fadeIn">
      {renderStepper()}
      <div className="rounded-[1.75rem] border border-white/18 bg-brand-950/68 p-5 shadow-[0_34px_120px_rgba(6,17,13,0.34)] backdrop-blur-2xl sm:p-8 [@media(max-height:800px)]:p-5">
        {children}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="w-full max-w-5xl animate-fadeIn">
            <div className="mx-auto mb-4 max-w-2xl text-center text-white sm:mb-5 animate-slideInUp [@media(max-height:800px)]:mb-4 [@media(max-height:760px)]:mb-3">
              <div className="mb-4 flex origin-top justify-center [@media(max-height:800px)]:mb-2 ">
                <BrandLogo size="md" tone="dark" animated showTagline stacked className="items-center justify-center" />
              </div>
              <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-white/[0.08] px-3 py-1.5 text-[10px] font-black uppercase text-amber-100 shadow-[0_14px_44px_rgba(0,0,0,0.18)] backdrop-blur-xl [@media(max-height:800px)]:mb-2 [@media(max-height:800px)]:px-3 [@media(max-height:800px)]:py-1.5 [@media(max-height:800px)]:text-[10px]">
                <ShieldCheck className="h-4 w-4 [@media(max-height:800px)]:h-3.5 [@media(max-height:800px)]:w-3.5" />
                Configuration de votre espace
              </div>
              <h1 className="text-4xl font-black leading-tight text-white drop-shadow-2xl md:text-5xl 2xl:text-6xl [@media(max-height:800px)]:text-4xl [@media(max-height:760px)]:text-3xl">
                Bienvenue sur Samay Këur
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-emerald-50/80 md:text-xl md:leading-8 [@media(max-height:800px)]:mt-2 [@media(max-height:800px)]:max-w-xl [@media(max-height:800px)]:text-sm [@media(max-height:800px)]:leading-6 md:[@media(max-height:800px)]:text-base">
                Choisissez le mode de gestion qui correspond à votre activité. Votre espace,
                vos documents et vos rapports seront adaptés dès le départ.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 md:gap-7 [@media(max-height:800px)]:gap-4">
              <button
                onClick={() => { setAccountType('agency'); nextStep(); }}
                className="group relative min-h-full overflow-hidden rounded-xl border border-emerald-200/40 bg-white/[0.88] p-3 text-left text-brand-950 shadow-[0_14px_42px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white/[0.94] hover:shadow-[0_18px_56px_rgba(6,17,13,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50 sm:p-4 [@media(max-height:800px)]:rounded-2xl [@media(max-height:800px)]:p-4 sm:[@media(max-height:800px)]:p-5"
                data-testid="card-account-agency"
              >
                <div className="mb-3 flex items-start justify-between gap-2.5 ">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-900/10 bg-gradient-to-br from-emerald-950 to-brand-700 text-white shadow-[0_18px_42px_rgba(31,59,46,0.28)] transition duration-300 group-hover:scale-[1.03] [@media(max-height:800px)]:h-12 [@media(max-height:800px)]:w-12 [@media(max-height:800px)]:rounded-xl">
                    <Building2 className="h-4 w-4 [@media(max-height:800px)]:h-6 [@media(max-height:800px)]:w-6" />
                  </div>
                  <span className="rounded-full border border-emerald-900/10 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-brand-800 [@media(max-height:800px)]:px-2.5 [@media(max-height:800px)]:py-1 [@media(max-height:800px)]:text-[10px]">
                    Agence / cabinet
                  </span>
                </div>
                <h2 className="mb-1.5 font-serif text-lg font-black text-brand-950 md:text-xl [@media(max-height:800px)]:mb-2 ">Je gère pour des clients</h2>
                <p className="mb-3 text-[0.72rem] font-semibold leading-4 text-slate-600  [@media(max-height:800px)]:text-sm [@media(max-height:800px)]:leading-6">Un espace structuré pour gérer des propriétaires, des mandats, des encaissements et des rapports professionnels.</p>
                <ul className="mb-3 grid gap-1.5 text-[0.68rem] "><li className="flex items-center gap-1.5 rounded-md border border-emerald-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><Users className="h-4 w-4 text-brand-800" />Gestion multi-bailleurs</li><li className="flex items-center gap-1.5 rounded-md border border-emerald-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><ShieldCheck className="h-4 w-4 text-brand-800" />Équipe collaborative</li><li className="flex items-center gap-1.5 rounded-md border border-emerald-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><Sparkles className="h-4 w-4 text-brand-800" />Rapports personnalisés</li></ul>
                <div className="flex min-h-9 items-center justify-between rounded-lg bg-brand-950 px-3 py-1.5 text-[0.68rem] font-black text-white shadow-[0_9px_22px_rgba(6,17,13,0.18)] transition group-hover:bg-brand-800 [@media(max-height:800px)]:min-h-10 [@media(max-height:800px)]:px-3 .5">Créer un espace agence<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 " /></div>
              </button>

              <button
                onClick={() => { setAccountType('bailleur'); nextStep(); }}
                className="group relative min-h-full overflow-hidden rounded-xl border border-emerald-200/40 bg-white/[0.88] p-3 text-left text-brand-950 shadow-[0_14px_42px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white/[0.94] hover:shadow-[0_18px_56px_rgba(6,17,13,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50 sm:p-4 [@media(max-height:800px)]:rounded-2xl [@media(max-height:800px)]:p-4 sm:[@media(max-height:800px)]:p-5"
                data-testid="card-account-bailleur"
              >
                <div className="mb-3 flex items-start justify-between gap-2.5 ">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-900/10 bg-gradient-to-br from-amber-500 to-action-500 text-white shadow-[0_18px_42px_rgba(255,138,0,0.22)] transition duration-300 group-hover:scale-[1.03] [@media(max-height:800px)]:h-12 [@media(max-height:800px)]:w-12 [@media(max-height:800px)]:rounded-xl">
                    <Home className="h-4 w-4 [@media(max-height:800px)]:h-6 [@media(max-height:800px)]:w-6" />
                  </div>
                  <span className="rounded-full border border-amber-900/10 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800 [@media(max-height:800px)]:px-2.5 [@media(max-height:800px)]:py-1 [@media(max-height:800px)]:text-[10px]">
                    Patrimoine privé
                  </span>
                </div>
                <h2 className="mb-1.5 font-serif text-lg font-black text-brand-950 md:text-xl [@media(max-height:800px)]:mb-2 ">Je gère mes propres biens</h2>
                <p className="mb-3 text-[0.72rem] font-semibold leading-4 text-slate-600  [@media(max-height:800px)]:text-sm [@media(max-height:800px)]:leading-6">
                  Un espace propriétaire plus simple pour suivre vos locataires, vos loyers,
                  vos impayés et vos documents.
                </p>
                <ul className="mb-3 grid gap-1.5 text-[0.68rem] ">
                  <li className="flex items-center gap-1.5 rounded-md border border-amber-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><Home className="h-4 w-4 text-action-600" />Gestion de vos biens</li>
                  <li className="flex items-center gap-1.5 rounded-md border border-amber-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><CheckCircle2 className="h-4 w-4 text-action-600" />Suivi des loyers</li>
                  <li className="flex items-center gap-1.5 rounded-md border border-amber-950/10 bg-white/75 px-2 py-1.5 font-black text-slate-700 shadow-sm "><User className="h-4 w-4 text-action-600" />Tableau de bord clair</li>
                </ul>
                <div className="flex min-h-9 items-center justify-between rounded-lg bg-brand-950 px-3 py-1.5 text-[0.68rem] font-black text-white shadow-[0_9px_22px_rgba(6,17,13,0.18)] transition group-hover:bg-brand-800 [@media(max-height:800px)]:min-h-10 [@media(max-height:800px)]:px-3 .5">
                  Créer un espace bailleur
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 " />
                </div>
              </button>
            </div>

            <div className="mt-7 text-center [@media(max-height:800px)]:mt-4">
              <p className="inline-flex rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-bold text-emerald-50/80 backdrop-blur-xl [@media(max-height:760px)]:hidden">
                Toute demande est validée par notre équipe sous 24h ouvrées.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          renderFormCard(
            <>
            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={prevStep} className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-2.5 py-1.5 text-xs font-black text-slate-100 transition hover:bg-white/16 hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />Retour
                </button>
                <span className="rounded-full border border-emerald-100/30 bg-emerald-100/16 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-100">Étape 1 sur 3</span>
              </div>
              <h2 className="mb-1.5 font-serif text-xl font-black text-[#FFF7E6]">
                {accountType === 'agency' ? 'Nom de votre structure' : 'Votre nom complet'}
              </h2>
              <p className="text-[0.72rem] font-semibold leading-4 text-slate-200">
                {accountType === 'agency'
                  ? 'Comment s\'appelle votre agence ou cabinet de gestion ?'
                  : 'Indiquez le nom qui sera associé à votre espace propriétaire.'}
              </p>
            </div>
            <div className="space-y-2.5">
              <input
                type="text"
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={welcomeInputClass}
                placeholder={accountType === 'agency' ? 'Ex: Immobilier Premium Dakar' : 'Ex: Moussa Diop'}
                onKeyPress={(e) => e.key === 'Enter' && formData.name.trim() && nextStep()}
                data-testid="input-name"
              />
              <button
                onClick={nextStep}
                disabled={!formData.name.trim()}
                className={welcomePrimaryButtonClass}
                data-testid="button-next-step-1"
              >
                Continuer<ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
            </>,
          )
        );

      case 2:
        return (
          renderFormCard(
            <>
            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={prevStep} className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-2.5 py-1.5 text-xs font-black text-slate-100 transition hover:bg-white/16 hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />Retour
                </button>
                <span className="rounded-full border border-emerald-100/30 bg-emerald-100/16 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-100">Étape 2 sur 3</span>
              </div>
              <h2 className="mb-1.5 font-serif text-xl font-black text-[#FFF7E6]">Numéro de téléphone</h2>
              <p className="text-[0.72rem] font-semibold leading-4 text-slate-200">À quel numéro notre équipe peut-elle vous joindre ?</p>
            </div>
            <div className="space-y-2.5">
              <input
                type="tel"
                autoFocus
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatSenegalPhoneInput(e.target.value) })}
                className={welcomeInputClass}
                placeholder="+221 77 123 45 67"
                onKeyPress={(e) => e.key === 'Enter' && formData.phone.trim() && nextStep()}
                data-testid="input-phone"
              />
              <button
                onClick={nextStep}
                disabled={!formData.phone.trim()}
                className={welcomePrimaryButtonClass}
                data-testid="button-next-step-2"
              >
                Continuer<ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
            </>,
          )
        );

      case 3:
        return (
          renderFormCard(
            <>
            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={prevStep} className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-2.5 py-1.5 text-xs font-black text-slate-100 transition hover:bg-white/16 hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />Retour
                </button>
                <span className="rounded-full border border-emerald-100/30 bg-emerald-100/16 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-100">Étape 3 sur 3</span>
              </div>
              <h2 className="mb-1.5 font-serif text-xl font-black text-[#FFF7E6]">
                {accountType === 'agency' ? 'Détails de votre structure' : 'Adresse'}
              </h2>
              <p className="text-[0.72rem] font-semibold leading-4 text-slate-200">
                {accountType === 'agency'
                  ? 'Ajoutez votre adresse et, si disponible, votre NINEA.'
                  : 'Ajoutez votre adresse pour finaliser votre demande.'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-100">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={welcomeInputClass}
                  placeholder="Sacré-Cœur 3, Dakar"
                  data-testid="input-address"
                />
              </div>
              <div>
                {accountType === 'agency' && (
                  <>
                    <label className="mb-1.5 block text-xs font-black text-slate-100">NINEA (optionnel au démarrage)</label>
                    <input
                      type="text"
                      value={formData.ninea}
                      onChange={(e) => setFormData({ ...formData, ninea: e.target.value })}
                      className={welcomeInputClass}
                      placeholder="00123456789"
                      data-testid="input-ninea"
                    />
                  </>
                )}
              </div>

              <div className="rounded-lg border border-amber-200/30 bg-amber-100/12 p-2.5 shadow-inner shadow-white/5">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-200" />
                  <h3 className="font-black text-[#FFF7E6]">Validation par notre équipe</h3>
                </div>
                <p className="text-xs font-semibold leading-5 text-slate-200">
                  Votre demande sera examinée sous 24h ouvrées. Vous recevrez une notification
                  par email dès l'approbation.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={welcomePrimaryButtonClass}
                data-testid="button-submit-request"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-3" />
                    Envoi en cours…
                  </>
                ) : (
                  <>Envoyer ma demande<CheckCircle2 className="w-5 h-5 ml-2" /></>
                )}
              </button>
            </form>
            </>,
          )
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <WelcomeShell>{renderStepContent()}</WelcomeShell>
    </>
  );
}

