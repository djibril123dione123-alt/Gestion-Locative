import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Mail,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/Toast';
import { getTimezoneKey, markOnboardingComplete, markOnboardingCompletePersisted } from './onboardingStorage';
import { ensureE164, isValidInternationalPhone } from '../../lib/formatters';
import { PhoneInput } from '../ui/PhoneInput';
import { resolveAgencyAssetUrl, uploadAgencyIdentityAsset } from '../../services/agencyIdentityAssets';
import { createTeamInvitation } from '../../services/tenantAdministrationCommands';
import { completeTenantOnboarding } from '../../services/tenantProfileCommands';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type RoleOption = 'agent' | 'comptable' | 'admin';

const STEPS = [
  {
    title: 'Identité officielle',
    eyebrow: 'Étape 1',
    icon: Building2,
  },
  {
    title: 'Cadre de travail',
    eyebrow: 'Étape 2',
    icon: CheckCircle2,
  },
  {
    title: 'Équipe',
    eyebrow: 'Étape 3',
    icon: Users,
  },
] as const;

const TIMEZONES = [
  { value: 'Africa/Dakar', label: 'Dakar, Sénégal (GMT)' },
  { value: 'Africa/Bamako', label: 'Bamako, GMT' },
  { value: 'Africa/Conakry', label: 'Conakry, GMT' },
  { value: 'Africa/Casablanca', label: 'Casablanca, GMT+1' },
  { value: 'Europe/Paris', label: 'Paris, Europe centrale' },
];

export function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [storedLogoPath, setStoredLogoPath] = useState<string | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    agencyName: '',
    representativeName: '',
    ownerPhone: '',
    ownerAddress: '',
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
        supabase.from('agencies').select('name, logo_url, phone, address').eq('id', profile.agency_id).maybeSingle(),
        supabase
          .from('agency_settings')
          .select('nom_agence, devise, logo_url, representant_nom, telephone, adresse')
          .eq('agency_id', profile.agency_id)
          .maybeSingle(),
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
        representativeName: settingsRes.data?.representant_nom || prev.representativeName,
        ownerPhone: settingsRes.data?.telephone || agencyRes.data?.phone || prev.ownerPhone,
        ownerAddress: settingsRes.data?.adresse || agencyRes.data?.address || prev.ownerAddress,
        devise: settingsRes.data?.devise || prev.devise,
        timezone: storedTimezone,
      }));
      const storedLogo = settingsRes.data?.logo_url || agencyRes.data?.logo_url || null;
      setStoredLogoPath(storedLogo);
      setLogoPreview(await resolveAgencyAssetUrl(storedLogo));
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
  const fieldClass =
    'h-9 w-full rounded-lg border border-white/20 bg-[#FDFBF7] px-3 py-1.5 text-xs font-bold text-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] outline-none transition placeholder:text-slate-500 focus:border-amber-400/70 focus:bg-white focus:ring-4 focus:ring-amber-400/20';
  const labelClass = 'mb-1 block text-[0.68rem] font-black text-slate-700';
  const mutedCopyClass = 'text-[0.68rem] leading-4 text-slate-600';
  const getVisibleStepTitle = (index: number) => {
    if (!isIndividualOwner) return STEPS[index].title;
    if (index === 0) return 'Profil propriétaire';
    if (index === 2) return 'Préférences';
    return STEPS[index].title;
  };
  const currentTitle = getVisibleStepTitle(step);
  const skipLabel = step === 2 && !isIndividualOwner ? 'Inviter plus tard' : "Passer pour l'instant";

  const uploadLogo = async () => {
    if (!logoFile || !profile?.agency_id) return null;
    return uploadAgencyIdentityAsset({ agencyId: profile.agency_id, kind: 'logo', file: logoFile });
  };

  const createInvitation = async () => {
    if (!form.inviteEmail.trim() || !profile?.agency_id || !profile.id) return null;
    const email = form.inviteEmail.trim().toLowerCase();
    const invitation = await createTeamInvitation({
      email,
      role: form.inviteRole,
      daysValid: 7,
    });
    return `${window.location.origin}/?token=${invitation.token}`;
  };

  const save = async () => {
    if (!profile?.agency_id) return;
    if (!form.agencyName.trim()) {
      toast.warning(isIndividualOwner ? 'Indiquez votre nom pour continuer.' : "Indiquez le nom de l'agence pour continuer.");
      setStep(0);
      return;
    }
    const normalizedOwnerPhone = isIndividualOwner && form.ownerPhone.trim()
      ? ensureE164(form.ownerPhone)
      : null;
    if (isIndividualOwner && form.ownerPhone.trim() && !isValidInternationalPhone(normalizedOwnerPhone)) {
      toast.warning('Le téléphone doit être un numéro valide, par exemple 77 123 45 67.');
      setStep(0);
      return;
    }

    setLoading(true);
    try {
      const uploadedLogo = await uploadLogo();
      const logoUrl = uploadedLogo?.path || storedLogoPath;
      const agencyName = form.agencyName.trim();
      await completeTenantOnboarding({
        agencyName,
        logoUrl: logoUrl || null,
        phone: isIndividualOwner ? normalizedOwnerPhone || form.ownerPhone.trim() || null : null,
        address: isIndividualOwner ? form.ownerAddress.trim() || null : null,
        representativeName: isIndividualOwner ? null : form.representativeName.trim() || null,
        currency: form.devise,
        city: form.timezone.includes('Abidjan') ? 'Abidjan' : 'Dakar',
      });

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

  const skip = async () => {
    if (!profile.agency_id) return;
    setLoading(true);
    try {
      await markOnboardingCompletePersisted(profile.agency_id);
    toast.success('Vous pourrez terminer la configuration depuis les paramètres.');
    onComplete();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'enregistrer l'état de configuration.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const StepIcon = STEPS[step].icon;

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-slate-950/76 px-3 py-3 backdrop-blur-2xl">
        <section className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-white/14 bg-[linear-gradient(135deg,rgba(255,250,240,0.98),rgba(248,244,236,0.94))] shadow-[0_18px_56px_rgba(6,17,13,0.3)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-white/90 p-1.5 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            aria-label="Fermer l'onboarding"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="grid lg:grid-cols-[0.64fr_1.36fr]">
            <aside className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_8%,rgba(251,191,36,0.2),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.26),transparent_34%),linear-gradient(145deg,#02140f,#053426_48%,#06110e)] p-3.5 text-white sm:p-4">
              <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/16 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex rounded-full border border-orange-300/25 bg-orange-300/10 px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-orange-200">
                  Mise en route
                </span>
                <h2 className="mt-2 text-lg font-black tracking-tight text-[#fff7e6] sm:text-xl">
                  {isIndividualOwner ? 'Configurez votre espace propriétaire en moins de 3 minutes.' : 'Configurez votre agence en moins de 3 minutes.'}
                </h2>
                <p className="mt-2 text-[0.68rem] leading-4 text-emerald-50/76">
                  {isIndividualOwner
                    ? 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, puis premiers pas métier.'
                    : 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, équipe, puis premiers pas métier.'}
                </p>

                <div className="mt-4 space-y-1.5">
                  {STEPS.map((item, index) => {
                    const Icon = item.icon;
                    const active = index === step;
                    const done = index < step;
                    const title = getVisibleStepTitle(index);
                    return (
                      <div
                        key={item.title}
                        className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                          active
                            ? 'border-orange-300/35 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                            : done
                              ? 'border-emerald-300/25 bg-emerald-300/10'
                              : 'border-white/10 bg-white/[0.05]'
                        }`}
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${done ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10 text-orange-200'}`}>
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-emerald-100/60">
                            {item.eyebrow}
                          </p>
                          <p className="text-[0.7rem] font-black text-white">
                            {title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="max-h-[86vh] overflow-y-auto p-3.5 sm:p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-brand-800 ring-1 ring-emerald-100">
                    <StepIcon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-orange-600">
                      {STEPS[step].eyebrow}
                    </p>
                    <h3 className="text-base font-black text-slate-950">
                      {currentTitle}
                    </h3>
                  </div>
                </div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-orange-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {step === 0 && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-xs font-black text-slate-950">
                        {isIndividualOwner ? 'Profil propriétaire' : 'Identité officielle'}
                      </p>
                      <p className={mutedCopyClass}>
                        {isIndividualOwner
                          ? 'Vérifiez les informations associées à votre espace propriétaire.'
                          : 'Vérifiez les informations qui apparaîtront sur vos documents, rapports et invitations.'}
                      </p>
                    </div>
                    <label className="block">
                      <span className={labelClass}>
                        {isIndividualOwner ? 'Nom du propriétaire' : "Nom de l'agence"}
                      </span>
                      <input
                        value={form.agencyName}
                        onChange={(event) => setForm((prev) => ({ ...prev, agencyName: event.target.value }))}
                        placeholder={isIndividualOwner ? 'Ex: Moussa Diop' : 'Ex: Teranga Gestion Immobilière'}
                        className={fieldClass}
                        autoFocus
                      />
                    </label>
                    {!isIndividualOwner && (
                      <label className="block">
                        <span className={labelClass}>Nom du représentant</span>
                        <input
                          value={form.representativeName}
                          onChange={(event) => setForm((prev) => ({ ...prev, representativeName: event.target.value }))}
                          placeholder="Ex: Awa Ndiaye"
                          className={fieldClass}
                        />
                        <span className="mt-1 block text-[0.62rem] font-semibold text-slate-500">
                          Utilisé sur les contrats, mandats, rapports et signatures si renseigné.
                        </span>
                      </label>
                    )}
                    {isIndividualOwner && (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <PhoneInput
                          label="Téléphone"
                          value={form.ownerPhone}
                          onChange={(value) => setForm((prev) => ({ ...prev, ownerPhone: value }))}
                          placeholder="Ex: 77 123 45 67"
                        />
                        <label className="block">
                          <span className={labelClass}>
                            <MapPin className="mr-1 inline h-3.5 w-3.5 text-brand-800" />
                            Adresse
                          </span>
                          <input
                            value={form.ownerAddress}
                            onChange={(event) => setForm((prev) => ({ ...prev, ownerAddress: event.target.value }))}
                            placeholder="Ex: Ouakam, Dakar"
                            className={fieldClass}
                          />
                        </label>
                        <p className="rounded-lg border border-amber-200/60 bg-amber-50/80 p-2 text-[0.62rem] font-semibold leading-4 text-amber-900 sm:col-span-2">
                          Ces informations pourront être utilisées dans vos documents, rapports et quittances.
                        </p>
                      </div>
                    )}
                  </div>

                  <label className="group flex min-h-[5.75rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300/70 bg-emerald-50/60 px-3 py-2.5 text-center shadow-inner transition hover:border-amber-400 hover:bg-amber-50/70 sm:w-32">
                    {logoPreview ? (
                      <img src={logoPreview} alt={isIndividualOwner ? 'Photo de profil propriétaire' : 'Logo agence'} className={isIndividualOwner ? 'h-16 w-16 rounded-full object-cover ring-4 ring-white/80' : 'h-16 w-24 object-contain'} />
                    ) : (
                      <Upload className="h-5 w-5 text-brand-800" />
                    )}
                    <span className="mt-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-brand-800">
                      {isIndividualOwner ? 'Photo optionnelle' : 'Logo optionnel'}
                    </span>
                    <span className="mt-1 text-[0.62rem] font-semibold text-slate-500">
                      {isIndividualOwner ? 'Avatar propriétaire · PNG, JPG' : 'PNG, JPG, SVG'}
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
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs font-black text-slate-950">Cadre de travail</p>
                    <p className={mutedCopyClass}>
                      {isIndividualOwner
                        ? 'Définissez les paramètres qui alimenteront vos loyers, documents et dates.'
                        : 'Ces réglages cadrent les montants, les dates et les documents générés par Samay Këur.'}
                    </p>
                  </div>
                  <label className="block">
                    <span className={labelClass}>Devise principale</span>
                    <select
                      value={form.devise}
                      onChange={(event) => setForm((prev) => ({ ...prev, devise: event.target.value }))}
                      className={fieldClass}
                    >
                      <option value="XOF">F CFA BCEAO (XOF)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">Dollar (USD)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Fuseau horaire</span>
                    <select
                      value={form.timezone}
                      onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                      className={fieldClass}
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone.value} value={timezone.value}>
                          {timezone.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/75 p-2.5 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold leading-4 text-emerald-900">
                      Ces réglages alimentent les documents, les rapports et les dates affichées dans l'application.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-emerald-950/10 bg-white/75 p-2.5 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <Mail className="mt-0.5 h-4 w-4 text-brand-800" />
                      <div>
                        <p className="text-xs font-black text-slate-950">
                          {isIndividualOwner ? 'Préférences de démarrage' : "Inviter l'équipe maintenant ou plus tard."}
                        </p>
                        <p className="mt-1 text-[0.68rem] leading-4 text-slate-600">
                          {isIndividualOwner
                            ? 'Votre espace propriétaire est prêt. Vous pourrez maintenant ajouter votre premier bien, suivre vos loyers et générer vos documents.'
                            : "Cette étape est optionnelle. Vous pouvez démarrer seul et inviter vos collaborateurs depuis la page Équipe."}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isIndividualOwner && (
                    <div className="grid gap-2.5 sm:grid-cols-[1fr_10rem]">
                      <label className="block">
                        <span className={labelClass}>Email collaborateur optionnel</span>
                        <input
                          type="email"
                          value={form.inviteEmail}
                          onChange={(event) => setForm((prev) => ({ ...prev, inviteEmail: event.target.value }))}
                          placeholder="agent@agence.com"
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Rôle</span>
                        <select
                          value={form.inviteRole}
                          onChange={(event) => setForm((prev) => ({ ...prev, inviteRole: event.target.value as RoleOption }))}
                          className={fieldClass}
                        >
                          <option value="agent">Agent</option>
                          <option value="comptable">Comptable</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {generatedInviteLink && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[0.68rem] font-semibold text-emerald-900">
                      Invitation créée : {generatedInviteLink}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void skip()}
                  disabled={loading}
                  className="rounded-lg px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white/70 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {skipLabel}
                </button>
                <div className="flex gap-2">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((value) => Math.max(0, value - 1))}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Retour
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    disabled={loading || !canContinue}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#072F24] px-4 py-2 text-xs font-black text-white shadow-[0_12px_34px_rgba(7,47,36,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25 disabled:cursor-not-allowed disabled:opacity-50"
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
