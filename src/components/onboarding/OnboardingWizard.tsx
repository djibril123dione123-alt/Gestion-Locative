import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/Toast';
import { getTimezoneKey, markOnboardingComplete } from './onboardingStorage';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type RoleOption = 'agent' | 'comptable' | 'admin';

const AGENCY_ASSETS_BUCKET = 'agency-assets';
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

const STEPS = [
  {
    title: 'Identite',
    eyebrow: 'Etape 1',
    icon: Building2,
  },
  {
    title: 'Cadre de travail',
    eyebrow: 'Etape 2',
    icon: CheckCircle2,
  },
  {
    title: 'Equipe',
    eyebrow: 'Etape 3',
    icon: Users,
  },
] as const;

const TIMEZONES = [
  { value: 'Africa/Dakar', label: 'Dakar, Abidjan, GMT' },
  { value: 'Africa/Bamako', label: 'Bamako, GMT' },
  { value: 'Africa/Conakry', label: 'Conakry, GMT' },
  { value: 'Africa/Casablanca', label: 'Casablanca, GMT+1' },
  { value: 'Europe/Paris', label: 'Paris, Europe centrale' },
];

function getLogoExtension(file: File) {
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  return 'png';
}

export function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    agencyName: '',
    devise: 'XOF',
    timezone: 'Africa/Dakar',
    inviteEmail: '',
    inviteRole: 'agent' as RoleOption,
  });

  useEffect(() => {
    if (!isOpen || !profile?.agency_id) return;
    let alive = true;

    void (async () => {
      const [agencyRes, settingsRes] = await Promise.all([
        supabase.from('agencies').select('name, logo_url').eq('id', profile.agency_id).maybeSingle(),
        supabase.from('agency_settings').select('nom_agence, devise, logo_url').eq('agency_id', profile.agency_id).maybeSingle(),
      ]);

      if (!alive) return;
      const storedTimezone = (() => {
        try {
          return localStorage.getItem(getTimezoneKey(profile.agency_id ?? '')) ?? 'Africa/Dakar';
        } catch {
          return 'Africa/Dakar';
        }
      })();

      setForm((prev) => ({
        ...prev,
        agencyName: settingsRes.data?.nom_agence || agencyRes.data?.name || prev.agencyName,
        devise: settingsRes.data?.devise || prev.devise,
        timezone: storedTimezone,
      }));
      setLogoPreview(settingsRes.data?.logo_url || agencyRes.data?.logo_url || null);
    })();

    return () => {
      alive = false;
    };
  }, [isOpen, profile?.agency_id]);

  useEffect(() => {
    if (!logoFile) return;
    const preview = URL.createObjectURL(logoFile);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [logoFile]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  if (!isOpen || !profile?.agency_id) return null;

  const canContinue = step !== 0 || form.agencyName.trim().length >= 2;

  const uploadLogo = async () => {
    if (!logoFile || !profile?.agency_id) return logoPreview;
    if (!logoFile.type.startsWith('image/')) {
      throw new Error('Le logo doit etre une image.');
    }
    if (logoFile.size > MAX_LOGO_SIZE) {
      throw new Error('Le logo doit peser moins de 5 Mo.');
    }

    const fileExt = getLogoExtension(logoFile);
    const filePath = `${profile.agency_id}/logos/onboarding-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(AGENCY_ASSETS_BUCKET)
      .upload(filePath, logoFile, {
        cacheControl: '31536000',
        contentType: logoFile.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(AGENCY_ASSETS_BUCKET).getPublicUrl(filePath);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const createInvitation = async () => {
    if (!form.inviteEmail.trim() || !profile?.agency_id || !profile.id) return null;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const email = form.inviteEmail.trim().toLowerCase();

    const { error } = await supabase.from('invitations').insert({
      email,
      agency_id: profile.agency_id,
      role: form.inviteRole,
      token,
      invited_by: profile.id,
      expires_at: expiresAt,
      status: 'pending',
    });
    if (error) throw error;
    return `${window.location.origin}/?token=${token}`;
  };

  const save = async () => {
    if (!profile?.agency_id) return;
    if (!form.agencyName.trim()) {
      toast.warning(isIndividualOwner ? 'Indiquez votre nom pour continuer.' : "Indiquez le nom de l'agence pour continuer.");
      setStep(0);
      return;
    }

    setLoading(true);
    try {
      const logoUrl = await uploadLogo();
      const agencyName = form.agencyName.trim();

      const { error: agencyError } = await supabase
        .from('agencies')
        .update({ name: agencyName, logo_url: logoUrl || null })
        .eq('id', profile.agency_id);
      if (agencyError) throw agencyError;

      const { error: settingsError } = await supabase.from('agency_settings').upsert({
        agency_id: profile.agency_id,
        nom_agence: agencyName,
        devise: form.devise,
        city: form.timezone.includes('Abidjan') ? 'Abidjan' : 'Dakar',
        logo_url: logoUrl || null,
      });
      if (settingsError) throw settingsError;

      let inviteLink: string | null = null;
      if (form.inviteEmail.trim()) {
        inviteLink = isIndividualOwner ? null : await createInvitation();
        setGeneratedInviteLink(inviteLink);
      }

      try {
        localStorage.setItem(getTimezoneKey(profile.agency_id), form.timezone);
      } catch {
        /* noop */
      }
      markOnboardingComplete(profile.agency_id);
      toast.success(
        inviteLink
          ? "Agence configurée. L'invitation est prête à partager."
          : isIndividualOwner
            ? 'Espace propriétaire configuré. Vous pouvez commencer à travailler.'
            : 'Agence configurée. Vous pouvez commencer à travailler.',
      );
      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'enregistrer la configuration.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (!canContinue) {
      toast.warning(isIndividualOwner ? 'Ajoutez au moins votre nom.' : "Ajoutez au moins le nom de l'agence.");
      return;
    }
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    void save();
  };

  const skip = () => {
    if (!profile.agency_id) return;
    markOnboardingComplete(profile.agency_id);
    toast.success('Vous pourrez terminer la configuration depuis les parametres.');
    onComplete();
    onClose();
  };

  const StepIcon = STEPS[step].icon;

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-xl">
        <section className="relative w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/14 bg-white shadow-[0_34px_120px_rgba(6,17,13,0.32)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            aria-label="Fermer l'onboarding"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
            <aside className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white sm:p-8">
              <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/16 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-orange-200">
                  Time-to-value
                </span>
                <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                  {isIndividualOwner ? 'Configurez votre espace propriétaire en moins de 3 minutes.' : 'Configurez votre agence en moins de 3 minutes.'}
                </h2>
                <p className="mt-4 text-sm leading-6 text-emerald-50/72">
                  {isIndividualOwner
                    ? 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, puis premiers pas métier.'
                    : 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, équipe, puis premiers pas métier.'}
                </p>

                <div className="mt-8 space-y-3">
                  {STEPS.map((item, index) => {
                    const Icon = item.icon;
                    const active = index === step;
                    const done = index < step;
                    return (
                      <div
                        key={item.title}
                        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                          active
                            ? 'border-orange-300/35 bg-white/12'
                            : done
                              ? 'border-emerald-300/25 bg-emerald-300/10'
                              : 'border-white/10 bg-white/[0.04]'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${done ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10 text-orange-200'}`}>
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100/55">
                            {item.eyebrow}
                          </p>
                          <p className="text-sm font-black text-white">
                            {isIndividualOwner && item.title === 'Equipe' ? 'Préférences' : item.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="p-5 sm:p-8">
              <div className="mb-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand-800 ring-1 ring-emerald-100">
                    <StepIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                      {STEPS[step].eyebrow}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950">
                      {isIndividualOwner && STEPS[step].title === 'Equipe' ? 'Préférences' : STEPS[step].title}
                    </h3>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-orange-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {step === 0 && (
                <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">
                      {isIndividualOwner ? 'Nom du propriétaire' : "Nom de l'agence"}
                    </span>
                    <input
                      value={form.agencyName}
                      onChange={(event) => setForm((prev) => ({ ...prev, agencyName: event.target.value }))}
                      placeholder={isIndividualOwner ? 'Ex: Moussa Diop' : 'Ex: Teranga Gestion Immobilière'}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      autoFocus
                    />
                  </label>

                  <label className="group flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 px-5 py-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50">
                    {logoPreview ? (
                      <img src={logoPreview} alt={isIndividualOwner ? 'Visuel propriétaire' : 'Logo agence'} className="h-14 w-20 object-contain" />
                    ) : (
                      <Upload className="h-7 w-7 text-brand-800" />
                    )}
                    <span className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-brand-800">
                      Logo optionnel
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">Devise principale</span>
                    <select
                      value={form.devise}
                      onChange={(event) => setForm((prev) => ({ ...prev, devise: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    >
                      <option value="XOF">FCFA BCEAO (XOF)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">Dollar (USD)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700">Fuseau horaire</span>
                    <select
                      value={form.timezone}
                      onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone.value} value={timezone.value}>
                          {timezone.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold leading-6 text-emerald-900">
                      Ces reglages alimentent les documents, les rapports et les dates affichees dans l'application.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-1 h-5 w-5 text-brand-800" />
                      <div>
                        <p className="font-black text-slate-950">
                          {isIndividualOwner ? 'Votre espace est prêt pour vos premiers biens.' : "Inviter l'équipe maintenant ou plus tard."}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {isIndividualOwner
                            ? 'Vous pourrez ajouter vos biens, locataires et paiements depuis le tableau de bord.'
                            : "Cette étape est optionnelle. Vous pouvez démarrer seul et inviter vos collaborateurs depuis la page Équipe."}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isIndividualOwner && <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700">Email collaborateur optionnel</span>
                      <input
                        type="email"
                        value={form.inviteEmail}
                        onChange={(event) => setForm((prev) => ({ ...prev, inviteEmail: event.target.value }))}
                        placeholder="agent@agence.com"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700">Role</span>
                      <select
                        value={form.inviteRole}
                        onChange={(event) => setForm((prev) => ({ ...prev, inviteRole: event.target.value as RoleOption }))}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="agent">Agent</option>
                        <option value="comptable">Comptable</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                  </div>}
                  {generatedInviteLink && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                      Invitation creee : {generatedInviteLink}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={skip}
                  className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Passer pour l'instant
                </button>
                <div className="flex gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((value) => Math.max(0, value - 1))}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Retour
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    disabled={loading || !canContinue}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/18 transition hover:-translate-y-0.5 hover:bg-brand-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === STEPS.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    {step === STEPS.length - 1 ? 'Terminer' : 'Continuer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
