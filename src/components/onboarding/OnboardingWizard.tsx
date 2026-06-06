import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Mail,
  Phone,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/Toast';
import { getTimezoneKey, markOnboardingComplete, markOnboardingCompletePersisted } from './onboardingStorage';
import { formatSenegalPhoneInput, normalizeSenegalPhone } from '../../lib/formatters';

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
  const fieldClass =
    'h-12 w-full rounded-2xl border border-emerald-950/10 bg-white/95 px-4 py-3 text-base font-bold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-300/25';
  const labelClass = 'mb-2 block text-sm font-black text-slate-700';
  const mutedCopyClass = 'text-sm leading-6 text-slate-600';
  const currentTitle = isIndividualOwner && STEPS[step].title === 'Équipe' ? 'Préférences' : STEPS[step].title;
  const skipLabel = step === 2 && !isIndividualOwner ? 'Inviter plus tard' : "Passer pour l'instant";

  const uploadLogo = async () => {
    if (!logoFile || !profile?.agency_id) return logoPreview;
    if (!logoFile.type.startsWith('image/')) {
      throw new Error(isIndividualOwner ? 'La photo de profil doit être une image.' : 'Le logo doit être une image.');
    }
    if (logoFile.size > MAX_LOGO_SIZE) {
      throw new Error(isIndividualOwner ? 'La photo de profil doit peser moins de 5 Mo.' : 'Le logo doit peser moins de 5 Mo.');
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
    const normalizedOwnerPhone = isIndividualOwner && form.ownerPhone.trim()
      ? normalizeSenegalPhone(form.ownerPhone)
      : null;
    if (isIndividualOwner && form.ownerPhone.trim() && !normalizedOwnerPhone) {
      toast.warning('Le téléphone doit être un numéro sénégalais valide, par exemple 77 123 45 67.');
      setStep(0);
      return;
    }

    setLoading(true);
    try {
      const logoUrl = await uploadLogo();
      const agencyName = form.agencyName.trim();
      const agencyUpdate: Record<string, string | null> = {
        name: agencyName,
        logo_url: logoUrl || null,
      };
      if (isIndividualOwner) {
        if (normalizedOwnerPhone || form.ownerPhone.trim()) {
          agencyUpdate.phone = normalizedOwnerPhone || form.ownerPhone.trim();
        }
        agencyUpdate.address = form.ownerAddress.trim() || null;
      }

      const { error: agencyError } = await supabase
        .from('agencies')
        .update(agencyUpdate)
        .eq('id', profile.agency_id);
      if (agencyError) throw agencyError;

      const settingsPayload: Record<string, unknown> = {
        agency_id: profile.agency_id,
        nom_agence: agencyName,
        representant_nom: isIndividualOwner ? null : form.representativeName.trim() || null,
        devise: form.devise,
        city: form.timezone.includes('Abidjan') ? 'Abidjan' : 'Dakar',
        logo_url: logoUrl || null,
        onboarding_completed_at: new Date().toISOString(),
      };
      if (isIndividualOwner) {
        settingsPayload.telephone = normalizedOwnerPhone || form.ownerPhone.trim() || null;
        settingsPayload.adresse = form.ownerAddress.trim() || null;
      }

      const { error: settingsError } = await supabase.from('agency_settings').upsert(settingsPayload);
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

  const skip = async () => {
    if (!profile.agency_id) return;
    setLoading(true);
    try {
      await markOnboardingCompletePersisted(profile.agency_id);
    toast.success('Vous pourrez terminer la configuration depuis les paramètres.');
    onComplete();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'enregistrer l'Ã©tat de configuration.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const StepIcon = STEPS[step].icon;

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-slate-950/76 px-3 py-4 backdrop-blur-2xl">
        <section className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/14 bg-[linear-gradient(135deg,rgba(255,250,240,0.98),rgba(248,244,236,0.94))] shadow-[0_34px_120px_rgba(6,17,13,0.36)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/25 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            aria-label="Fermer l'onboarding"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
            <aside className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_8%,rgba(251,191,36,0.2),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.26),transparent_34%),linear-gradient(145deg,#02140f,#053426_48%,#06110e)] p-6 text-white sm:p-8 [@media(max-height:800px)]:p-6">
              <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/16 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-orange-200">
                  Mise en route
                </span>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-[#fff7e6] sm:text-4xl [@media(max-height:800px)]:text-3xl">
                  {isIndividualOwner ? 'Configurez votre espace propriétaire en moins de 3 minutes.' : 'Configurez votre agence en moins de 3 minutes.'}
                </h2>
                <p className="mt-4 text-sm leading-6 text-emerald-50/76">
                  {isIndividualOwner
                    ? 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, puis premiers pas métier.'
                    : 'On garde uniquement ce qui débloque la valeur tout de suite : identité, devise, équipe, puis premiers pas métier.'}
                </p>

                <div className="mt-8 space-y-3 [@media(max-height:800px)]:mt-6">
                  {STEPS.map((item, index) => {
                    const Icon = item.icon;
                    const active = index === step;
                    const done = index < step;
                    const title = isIndividualOwner && item.title === 'Équipe' ? 'Préférences' : item.title;
                    return (
                      <div
                        key={item.title}
                        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                          active
                            ? 'border-orange-300/35 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                            : done
                              ? 'border-emerald-300/25 bg-emerald-300/10'
                              : 'border-white/10 bg-white/[0.05]'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${done ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10 text-orange-200'}`}>
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100/60">
                            {item.eyebrow}
                          </p>
                          <p className="text-sm font-black text-white">
                            {title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-8 [@media(max-height:800px)]:p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand-800 ring-1 ring-emerald-100">
                    <StepIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                      {STEPS[step].eyebrow}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950">
                      {currentTitle}
                    </h3>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-orange-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {step === 0 && (
                <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-black text-slate-950">
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
                        <span className="mt-2 block text-xs font-semibold text-slate-500">
                          Utilisé sur les contrats, mandats, rapports et signatures si renseigné.
                        </span>
                      </label>
                    )}
                    {isIndividualOwner && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className={labelClass}>
                            <Phone className="mr-1 inline h-4 w-4 text-brand-800" />
                            Téléphone
                          </span>
                          <input
                            value={formatSenegalPhoneInput(form.ownerPhone)}
                            onChange={(event) => setForm((prev) => ({ ...prev, ownerPhone: formatSenegalPhoneInput(event.target.value) }))}
                            placeholder="Ex: 77 123 45 67"
                            className={fieldClass}
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>
                            <MapPin className="mr-1 inline h-4 w-4 text-brand-800" />
                            Adresse
                          </span>
                          <input
                            value={form.ownerAddress}
                            onChange={(event) => setForm((prev) => ({ ...prev, ownerAddress: event.target.value }))}
                            placeholder="Ex: Ouakam, Dakar"
                            className={fieldClass}
                          />
                        </label>
                        <p className="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-3 text-xs font-semibold leading-5 text-amber-900 sm:col-span-2">
                          Ces informations pourront être utilisées dans vos documents, rapports et quittances.
                        </p>
                      </div>
                    )}
                  </div>

                  <label className="group flex min-h-[9rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-300/70 bg-emerald-50/60 px-5 py-4 text-center shadow-inner transition hover:border-amber-400 hover:bg-amber-50/70 sm:w-44">
                    {logoPreview ? (
                      <img src={logoPreview} alt={isIndividualOwner ? 'Photo de profil propriétaire' : 'Logo agence'} className={isIndividualOwner ? 'h-16 w-16 rounded-full object-cover ring-4 ring-white/80' : 'h-16 w-24 object-contain'} />
                    ) : (
                      <Upload className="h-7 w-7 text-brand-800" />
                    )}
                    <span className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-brand-800">
                      {isIndividualOwner ? 'Photo optionnelle' : 'Logo optionnel'}
                    </span>
                    <span className="mt-1 text-xs font-semibold text-slate-500">
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-lg font-black text-slate-950">Cadre de travail</p>
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
                      <option value="XOF">FCFA BCEAO (XOF)</option>
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
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/75 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold leading-6 text-emerald-900">
                      Ces réglages alimentent les documents, les rapports et les dates affichées dans l'application.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-950/10 bg-white/75 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-1 h-5 w-5 text-brand-800" />
                      <div>
                        <p className="font-black text-slate-950">
                          {isIndividualOwner ? 'Préférences de démarrage' : "Inviter l'équipe maintenant ou plus tard."}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {isIndividualOwner
                            ? 'Votre espace propriétaire est prêt. Vous pourrez maintenant ajouter votre premier bien, suivre vos loyers et générer vos documents.'
                            : "Cette étape est optionnelle. Vous pouvez démarrer seul et inviter vos collaborateurs depuis la page Équipe."}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isIndividualOwner && (
                    <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
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
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                      Invitation créée : {generatedInviteLink}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void skip()}
                  disabled={loading}
                  className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-white/70 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {skipLabel}
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/18 transition hover:-translate-y-0.5 hover:bg-brand-950 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
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
