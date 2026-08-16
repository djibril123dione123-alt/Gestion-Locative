import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Building2,
  Check,
  Copy,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { ensureE164, isValidInternationalPhone } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import { PhoneInput } from '../ui/PhoneInput';
import { SmartCombobox } from '../ui/SmartCombobox';
import { WizardRail } from '../ui/WizardRail';
import {
  WizardShell,
  wizardPrimaryActionClass,
  wizardSecondaryActionClass,
  type WizardStep,
} from '../ui/WizardShell';

export interface ConsoleAgencyOption {
  id: string;
  name: string;
  status?: string | null;
  plan?: string | null;
}

type AgencyPlan = 'basic' | 'pro' | 'business' | 'enterprise';
type AgencyStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
type InviteRole = 'admin' | 'agent' | 'comptable';

const fieldLabelClass =
  'mb-1 block text-[0.61rem] font-black uppercase tracking-[0.12em] text-slate-500';
const inputClass =
  'h-8 w-full rounded-lg border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 text-[0.75rem] font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15';

function commandKey(command: string, target: string) {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${command}:${target}:${nonce}`;
}

function commandErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : '';
  const normalized = raw.toUpperCase();
  const messages: Array<[string, string]> = [
    ['AGENCY_NAME_INVALID', 'Le nom de l’organisation doit contenir au moins deux caractères.'],
    ['AGENCY_EMAIL_INVALID', 'L’adresse email professionnelle est invalide.'],
    ['AGENCY_PHONE_INVALID', 'Le numéro de téléphone sénégalais est invalide.'],
    ['AGENCY_PLAN_INVALID', 'Le plan sélectionné n’est pas disponible.'],
    ['AGENCY_STATUS_INVALID', 'Le statut initial sélectionné est invalide.'],
    ['AGENCY_TRIAL_DAYS_INVALID', 'La durée d’essai doit être comprise entre 1 et 365 jours.'],
    ['INVITATION_EMAIL_INVALID', 'L’adresse email du collaborateur est invalide.'],
    ['INVITATION_ROLE_INVALID', 'Le rôle sélectionné n’est pas autorisé.'],
    ['INVITATION_DURATION_INVALID', 'La durée de validité doit être comprise entre 1 et 30 jours.'],
    ['INVITATION_AGENCY_NOT_FOUND', 'L’organisation sélectionnée n’existe plus. Actualisez la console.'],
    ['INVITATION_ALREADY_PENDING', 'Une invitation active existe déjà pour cet email dans cette organisation.'],
    ['SUPER_ADMIN_REQUIRED', 'Cette action est réservée aux super-administrateurs.'],
  ];
  const matched = messages.find(([code]) => normalized.includes(code));
  return matched?.[1] ?? fallback;
}

function planLabel(plan: AgencyPlan) {
  if (plan === 'basic') return 'Starter';
  if (plan === 'pro') return 'Pro';
  if (plan === 'business') return 'Business';
  return 'Enterprise';
}

function agencyStatusLabel(status: AgencyStatus) {
  return {
    active: 'Actif',
    trial: 'Essai',
    suspended: 'Suspendu',
    cancelled: 'Clôturé',
  }[status];
}

function RailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5">
      <p className="text-[0.49rem] font-black uppercase tracking-[0.12em] text-emerald-200/60">{label}</p>
      <p className="mt-0.5 truncate text-[0.65rem] font-black text-white">{value}</p>
    </div>
  );
}

export function CreateConsoleAgencyWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(commandKey('create-agency', 'console'));
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    plan: 'pro' as AgencyPlan,
    status: 'trial' as AgencyStatus,
    trialDays: 30,
  });
  const steps: WizardStep[] = [
    { id: 'identity', label: 'Identité' },
    { id: 'offer', label: 'Offre & accès' },
    { id: 'review', label: 'Validation' },
  ];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const phoneValid = isValidInternationalPhone(form.phone);
  const identityValid = form.name.trim().length >= 2 && emailValid && phoneValid;

  const reset = () => {
    setStep(0);
    setBusy(false);
    setError(null);
    idempotencyKeyRef.current = commandKey('create-agency', 'console');
    setForm({
      name: '',
      email: '',
      phone: '',
      plan: 'pro',
      status: 'trial',
      trialDays: 30,
    });
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedPhone = ensureE164(form.phone);
    if (!identityValid || !isValidInternationalPhone(normalizedPhone)) {
      setStep(0);
      setError('Vérifiez le nom, l’adresse email et le numéro de téléphone.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const email = form.email.trim().toLowerCase();
      const { error: rpcError } = await supabase.rpc('admin_create_agency', {
        p_name: form.name.trim(),
        p_email: email,
        p_phone: normalizedPhone,
        p_plan: form.plan,
        p_status: form.status,
        p_trial_days: form.status === 'trial' ? form.trialDays : 30,
        p_idempotency_key: idempotencyKeyRef.current,
      });
      if (rpcError) throw rpcError;
      await onCreated();
      reset();
      onClose();
    } catch (caught) {
      setError(commandErrorMessage(caught, 'La création n’a pas pu être terminée. Vérifiez les informations puis réessayez.'));
    } finally {
      setBusy(false);
    }
  };

  const rail = (
    <WizardRail
      eyebrow="Console propriétaire"
      subtitle="Provisionnement agence"
      title="Nouvelle agence"
      description="Créez un espace isolé, rattachez son offre et préparez son administration."
      steps={steps}
      currentStep={step}
      footer={(
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-amber-200" />
          Commande serveur protégée par le rôle super-admin et conservée dans l’audit.
        </span>
      )}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <RailValue label="Agence" value={form.name.trim() || 'À renseigner'} />
        <RailValue label="Plan" value={planLabel(form.plan)} />
        <RailValue label="Statut" value={agencyStatusLabel(form.status)} />
        <RailValue
          label="Activation"
          value={form.status === 'trial' ? `${form.trialDays} jours` : 'Immédiate'}
        />
      </div>
    </WizardRail>
  );

  return (
    <WizardShell
      open={open}
      onClose={close}
      title="Nouvelle agence"
      eyebrow="ORGANISATIONS"
      description="Créez un espace client exploitable avec une offre et un statut cohérents."
      mobileDescription="Création d’une agence."
      steps={steps}
      currentStep={step}
      variant="workstation"
      tone="agency"
      size="standard"
      mobileMode="fullscreen"
      rail={rail}
      secondaryAction={(
        <button
          type="button"
          onClick={step === 0 ? close : () => setStep((current) => Math.max(0, current - 1))}
          disabled={busy}
          className={wizardSecondaryActionClass}
        >
          {step === 0 ? 'Annuler' : 'Retour'}
        </button>
      )}
      primaryAction={step < 2 ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep((current) => Math.min(2, current + 1));
          }}
          disabled={busy || (step === 0 && !identityValid)}
          className={wizardPrimaryActionClass}
        >
          Continuer
        </button>
      ) : (
        <button
          type="submit"
          form="console-create-agency"
          disabled={busy || !identityValid}
          className={wizardPrimaryActionClass}
          data-testid="button-submit-create-agency"
        >
          {busy ? 'Création...' : 'Créer l’agence'}
        </button>
      )}
    >
      <form id="console-create-agency" onSubmit={submit} className="space-y-2.5">
        <div className={step === 0 ? 'space-y-2.5' : 'hidden'}>
          <div>
            <label className={fieldLabelClass}>Nom de l’agence *</label>
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex. Cabinet Horizon Immobilier"
              className={inputClass}
              data-testid="input-new-agency-name"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClass}>Email de contact *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="direction@agence.sn"
                className={inputClass}
                data-testid="input-new-agency-email"
              />
              {form.email.trim() && !emailValid ? (
                <p className="mt-1 text-[0.58rem] font-bold text-red-600">Saisissez une adresse email valide.</p>
              ) : null}
            </div>
            <div>
              <PhoneInput
                label="Téléphone"
                required
                value={form.phone}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
              {form.phone.trim() && !phoneValid ? (
                <p className="mt-1 text-[0.58rem] font-bold text-red-600">Numéro de téléphone invalide.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-950/10 bg-emerald-50/55 p-2.5">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
              <p className="text-[0.63rem] font-semibold leading-4 text-slate-600">
                L’agence disposera de son propre espace de données. Invitez ensuite son administrateur depuis Utilisateurs & accès pour terminer la configuration.
              </p>
            </div>
          </div>
        </div>

        <div className={step === 1 ? 'space-y-2.5' : 'hidden'}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClass}>Plan initial</label>
              <SmartCombobox
                density="compact"
                value={form.plan}
                options={[
                  { value: 'basic', label: 'Starter', subtitle: 'Démarrage et bailleur individuel' },
                  { value: 'pro', label: 'Pro', subtitle: 'Gestion locative structurée' },
                  { value: 'business', label: 'Business', subtitle: 'Agence multi-utilisateur et pilotage avancé' },
                  { value: 'enterprise', label: 'Enterprise', subtitle: 'Réseaux et besoins avancés' },
                ]}
                onChange={(value) => setForm({ ...form, plan: value as AgencyPlan })}
                placeholder="Choisir un plan"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>Statut initial</label>
              <SmartCombobox
                density="compact"
                value={form.status}
                options={[
                  { value: 'trial', label: 'Essai', subtitle: 'Accès temporaire contrôlé' },
                  { value: 'active', label: 'Actif', subtitle: 'Accès immédiatement ouvert' },
                  { value: 'suspended', label: 'Suspendu', subtitle: 'Espace créé, accès bloqué' },
                  { value: 'cancelled', label: 'Clôturé', subtitle: 'Réservé aux reprises administratives' },
                ]}
                onChange={(value) => setForm({ ...form, status: value as AgencyStatus })}
                placeholder="Choisir un statut"
              />
            </div>
          </div>
          {form.status === 'trial' ? (
            <div>
              <label className={fieldLabelClass}>Durée d’essai</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.trialDays}
                  onChange={(event) => setForm({ ...form, trialDays: parseInt(event.target.value, 10) || 30 })}
                  className={inputClass}
                />
                <span className="shrink-0 text-[0.68rem] font-bold text-slate-500">jours</span>
              </div>
            </div>
          ) : null}
          <div className="grid gap-1.5 sm:grid-cols-3">
            {[
              ['Isolation', 'Espace agence dédié'],
              ['Gouvernance', 'RBAC et audit actifs'],
              ['Données', 'Aucun contenu factice'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-emerald-950/10 bg-white px-2.5 py-2">
                <p className="text-[0.51rem] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-0.5 text-[0.65rem] font-black text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={step === 2 ? 'space-y-2.5' : 'hidden'}>
          <div className="rounded-xl border border-emerald-950/10 bg-white p-3 shadow-sm">
            <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-emerald-700">Validation</p>
            <h3 className="mt-0.5 text-[0.86rem] font-black text-slate-950">Vérifier l’espace avant création</h3>
            <dl className="mt-2 divide-y divide-slate-100">
              {[
                ['Organisation', form.name.trim()],
                ['Contact', `${form.email.trim()} · ${form.phone}`],
                ['Offre', planLabel(form.plan)],
                ['Accès initial', form.status === 'trial' ? `Essai de ${form.trialDays} jours` : agencyStatusLabel(form.status)],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 py-2 text-[0.67rem]">
                  <dt className="font-black uppercase tracking-[0.08em] text-slate-400">{label}</dt>
                  <dd className="text-right font-black text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            <p className="text-[0.62rem] font-semibold leading-4 text-amber-900">
              Aucun abonnement payant n’est confirmé sans son flux de paiement ou une validation manuelle du support.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[0.63rem] font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </WizardShell>
  );
}

export function InviteConsoleUserWizard({
  open,
  agencies,
  onClose,
  onInvited,
}: {
  open: boolean;
  agencies: ConsoleAgencyOption[];
  onClose: () => void;
  onInvited: () => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(commandKey('create-invitation', 'console'));
  const [form, setForm] = useState({
    email: '',
    agencyId: '',
    role: 'agent' as InviteRole,
    message: '',
    daysValid: 7,
  });
  const steps: WizardStep[] = [
    { id: 'person', label: 'Collaborateur' },
    { id: 'access', label: 'Rôle & agence' },
    { id: 'review', label: 'Confirmation' },
  ];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const accessValid = Boolean(form.agencyId) && Boolean(form.role);
  const selectedAgency = useMemo(
    () => agencies.find((agency) => agency.id === form.agencyId) ?? null,
    [agencies, form.agencyId],
  );

  const reset = () => {
    setStep(0);
    setBusy(false);
    setCopied(false);
    setError(null);
    setLink(null);
    idempotencyKeyRef.current = commandKey('create-invitation', 'console');
    setForm({ email: '', agencyId: '', role: 'agent', message: '', daysValid: 7 });
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailValid || !accessValid) return;
    setBusy(true);
    setError(null);
    try {
      const email = form.email.trim().toLowerCase();
      const { data, error: rpcError } = await supabase.rpc('admin_create_invitation', {
        p_email: email,
        p_agency_id: form.agencyId,
        p_role: form.role,
        p_message: form.message.trim(),
        p_days_valid: form.daysValid,
        p_idempotency_key: idempotencyKeyRef.current,
      });
      if (rpcError) throw rpcError;
      const result = data as { token?: string } | null;
      if (!result?.token) throw new Error('Invitation créée sans lien exploitable.');
      setLink(`${window.location.origin}/?token=${result.token}`);
      await onInvited();
    } catch (caught) {
      setError(commandErrorMessage(caught, 'L’invitation n’a pas pu être créée. Vérifiez les informations puis réessayez.'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copie automatique impossible. Sélectionnez le lien manuellement.');
    }
  };

  const rail = (
    <WizardRail
      eyebrow="Console propriétaire"
      subtitle="Accès organisation"
      title="Invitation plateforme"
      description="Rattachez un collaborateur à la bonne organisation sans contourner les rôles agence."
      steps={link ? [] : steps}
      currentStep={step}
      footer={(
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-amber-200" />
          Invitation serveur tracée, limitée dans le temps et rattachée à une organisation explicite.
        </span>
      )}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <RailValue label="Email" value={form.email.trim() || 'À renseigner'} />
        <RailValue label="Rôle" value={form.role} />
        <RailValue label="Agence" value={selectedAgency?.name ?? 'À choisir'} />
        <RailValue label="Expiration" value={`${form.daysValid} jours`} />
      </div>
    </WizardRail>
  );

  return (
    <WizardShell
      open={open}
      onClose={close}
      title={link ? 'Invitation prête' : 'Inviter un utilisateur'}
      eyebrow="UTILISATEURS & ACCÈS"
      description="Créez un accès rattaché à une organisation et à un rôle explicite."
      mobileDescription="Invitation sécurisée."
      steps={link ? [] : steps}
      currentStep={step}
      variant="workstation"
      tone="agency"
      size="standard"
      mobileMode="fullscreen"
      rail={rail}
      secondaryAction={(
        <button
          type="button"
          onClick={link || step === 0 ? close : () => setStep((current) => Math.max(0, current - 1))}
          disabled={busy}
          className={wizardSecondaryActionClass}
        >
          {link || step === 0 ? 'Fermer' : 'Retour'}
        </button>
      )}
      primaryAction={link ? (
        <button type="button" onClick={() => void copyLink()} className={wizardPrimaryActionClass}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copié' : 'Copier le lien'}
        </button>
      ) : step < 2 ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep((current) => Math.min(2, current + 1));
          }}
          disabled={busy || (step === 0 ? !emailValid : !accessValid)}
          className={wizardPrimaryActionClass}
        >
          Continuer
        </button>
      ) : (
        <button
          type="submit"
          form="console-invite-user"
          disabled={busy || !emailValid || !accessValid}
          className={wizardPrimaryActionClass}
          data-testid="button-submit-invite"
        >
          {busy ? 'Création...' : 'Créer l’invitation'}
        </button>
      )}
    >
      {link ? (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="text-[0.76rem] font-black text-emerald-950">Invitation créée</p>
                <p className="mt-0.5 text-[0.63rem] font-semibold leading-4 text-emerald-800">
                  Le lien expire dans {form.daysValid} jours et rattache le compte à {selectedAgency?.name}.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className={fieldLabelClass}>Lien d’invitation</label>
            <input
              readOnly
              value={link}
              className={inputClass}
              data-testid="input-invite-link"
            />
          </div>
        </div>
      ) : (
        <form id="console-invite-user" onSubmit={submit} className="space-y-2.5">
          <div className={step === 0 ? 'space-y-2.5' : 'hidden'}>
            <div>
              <label className={fieldLabelClass}>Email professionnel *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="collaborateur@agence.sn"
                className={inputClass}
                data-testid="input-invite-email"
              />
              {form.email.trim() && !emailValid ? (
                <p className="mt-1 text-[0.58rem] font-bold text-red-600">Saisissez une adresse email valide.</p>
              ) : null}
            </div>
            <div>
              <label className={fieldLabelClass}>Message d’accueil</label>
              <textarea
                rows={3}
                maxLength={240}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Contexte ou consigne utile pour le collaborateur."
                className="min-h-[4.75rem] w-full resize-none rounded-lg border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-2 text-[0.72rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15"
              />
              <p className="mt-1 text-[0.57rem] font-semibold text-slate-400">
                {240 - form.message.length} caractères restants.
              </p>
            </div>
          </div>

          <div className={step === 1 ? 'space-y-2.5' : 'hidden'}>
            <div>
              <label className={fieldLabelClass}>Organisation cible *</label>
              <SmartCombobox
                density="compact"
                value={form.agencyId}
                options={agencies.map((agency) => ({
                  value: agency.id,
                  label: agency.name,
                  subtitle: `${agency.plan ?? 'Plan non renseigné'} · ${agency.status ?? 'Statut non renseigné'}`,
                }))}
                onChange={(value) => setForm({ ...form, agencyId: value })}
                placeholder="Sélectionner une organisation"
                searchPlaceholder="Rechercher une organisation..."
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
              <div>
                <label className={fieldLabelClass}>Rôle *</label>
                <SmartCombobox
                  density="compact"
                  value={form.role}
                  options={[
                    { value: 'agent', label: 'Agent', subtitle: 'Gestion opérationnelle selon permissions' },
                    { value: 'comptable', label: 'Comptable', subtitle: 'Encaissements, reliquats et rapports' },
                    { value: 'admin', label: 'Administrateur', subtitle: 'Accès complet à l’agence' },
                  ]}
                  onChange={(value) => setForm({ ...form, role: value as InviteRole })}
                  placeholder="Sélectionner un rôle"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Validité</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.daysValid}
                  onChange={(event) => setForm({ ...form, daysValid: parseInt(event.target.value, 10) || 7 })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-950/10 bg-white p-2.5">
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <p className="text-[0.63rem] font-semibold leading-4 text-slate-600">
                  Le rôle définit la base RBAC. Les permissions détaillées restent administrées depuis l’espace agence après acceptation.
                </p>
              </div>
            </div>
          </div>

          <div className={step === 2 ? 'space-y-2.5' : 'hidden'}>
            <div className="rounded-xl border border-emerald-950/10 bg-white p-3 shadow-sm">
              <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-emerald-700">Confirmation</p>
              <h3 className="mt-0.5 text-[0.86rem] font-black text-slate-950">Vérifier l’invitation</h3>
              <dl className="mt-2 divide-y divide-slate-100">
                {[
                  ['Collaborateur', form.email.trim()],
                  ['Organisation', selectedAgency?.name ?? 'Non sélectionnée'],
                  ['Rôle', form.role],
                  ['Expiration', `${form.daysValid} jours`],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 py-2 text-[0.67rem]">
                    <dt className="font-black uppercase tracking-[0.08em] text-slate-400">{label}</dt>
                    <dd className="text-right font-black text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2.5">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" />
              <p className="text-[0.62rem] font-semibold leading-4 text-sky-900">
                Le lien est à usage contrôlé. Le compte ne rejoint l’organisation qu’après acceptation de l’invitation.
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[0.63rem] font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </WizardShell>
  );
}
