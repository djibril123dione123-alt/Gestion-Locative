import React, { useState } from 'react';
import { getAppOrigin } from '../../lib/appUrl';
import { X, AlertTriangle, Building2, UserPlus, UserCog, CreditCard, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatSenegalPhoneInput, normalizeSenegalPhone } from '../../lib/formatters';

// ─── Types partagés (snake_case côté DB et TS pour cohérence avec l'existant)
export interface AgencyOption {
  id: string;
  name: string;
  status?: string;
  plan?: string;
}

export interface UserRow {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  actif: boolean;
  agency_id: string | null;
  agency_name?: string;
}

export interface SubscriptionRow {
  id: string;
  agency_id: string;
  agency_name: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due';
  current_period_start: string | null;
  current_period_end: string | null;
}

const PLAN_IDS = ['basic', 'pro', 'enterprise'] as const;
const USER_ROLES = ['admin', 'agent', 'comptable', 'bailleur'] as const;
const INVITE_ROLES = ['admin', 'agent', 'comptable'] as const;
const AGENCY_PLANS = ['basic', 'pro', 'enterprise'] as const;
const AGENCY_STATUSES = ['active', 'trial', 'suspended', 'cancelled'] as const;
const SUB_STATUSES = ['active', 'cancelled', 'past_due'] as const;

// ─── Wrapper modale dark theme cohérent avec la Console ─────────────────────

function ModalShell({
  open, onClose, title, subtitle, icon: Icon, children, widthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full ${widthClass} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-sm text-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1';
const primaryBtn = 'px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50';
const secondaryBtn = 'px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium';

function adminCommandKey(command: string, targetId: string) {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${command}:${targetId}:${nonce}`;
}

// ─── 1) Création d'agence ───────────────────────────────────────────────────

interface CreateAgencyProps {
  open: boolean;
  onClose: () => void;
  actorId: string | undefined;
  actorEmail: string | null | undefined;
  onCreated: () => void;
}

export function CreateAgencyModal({ open, onClose, actorId, actorEmail, onCreated }: CreateAgencyProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    plan: 'pro' as typeof AGENCY_PLANS[number],
    status: 'trial' as typeof AGENCY_STATUSES[number],
    trial_days: 30,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  void actorId;
  void actorEmail;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const normalizedPhone = normalizeSenegalPhone(form.phone);
      if (!normalizedPhone) {
        setErr('Le téléphone doit être un numéro sénégalais valide, par exemple 77 123 45 67.');
        setBusy(false);
        return;
      }
      const { error } = await supabase.rpc('admin_create_agency', {
        p_name: form.name.trim(),
        p_email: form.email.trim().toLowerCase(),
        p_phone: normalizedPhone,
        p_plan: form.plan,
        p_status: form.status,
        p_trial_days: form.status === 'trial' ? form.trial_days : 30,
        p_idempotency_key: adminCommandKey('create-agency', form.email.trim().toLowerCase()),
      });
      if (error) throw error;

      onCreated();
      onClose();
      setForm({ name: '', email: '', phone: '', plan: 'pro', status: 'trial', trial_days: 30 });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur création agence');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Nouvelle agence" subtitle="Création d'un tenant" icon={Building2}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Nom de l'agence *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} data-testid="input-new-agency-name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} data-testid="input-new-agency-email" />
          </div>
          <div>
            <label className={labelCls}>Téléphone *</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: formatSenegalPhoneInput(e.target.value) })} className={inputCls} data-testid="input-new-agency-phone" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Plan</label>
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as typeof AGENCY_PLANS[number] })} className={inputCls} data-testid="select-new-agency-plan">
              {AGENCY_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof AGENCY_STATUSES[number] })} className={inputCls} data-testid="select-new-agency-status">
              {AGENCY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {form.status === 'trial' && (
          <div>
            <label className={labelCls}>Durée d'essai (jours)</label>
            <input type="number" min={1} max={365} value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value) || 30 })} className={inputCls} />
          </div>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>Annuler</button>
          <button type="submit" disabled={busy} className={primaryBtn} data-testid="button-submit-create-agency">
            {busy ? 'Création…' : 'Créer l\'agence'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── 2) Invitation utilisateur ───────────────────────────────────────────────

interface InviteUserProps {
  open: boolean;
  onClose: () => void;
  agencies: AgencyOption[];
  actorId: string | undefined;
  actorEmail: string | null | undefined;
  onInvited: () => void;
}

export function InviteUserModal({ open, onClose, agencies, actorId, actorEmail, onInvited }: InviteUserProps) {
  const [form, setForm] = useState({
    email: '',
    agency_id: '',
    role: 'agent' as typeof INVITE_ROLES[number],
    message: '',
    days_valid: 7,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  void actorId;
  void actorEmail;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc('admin_create_invitation', {
        p_email: form.email.trim().toLowerCase(),
        p_agency_id: form.agency_id,
        p_role: form.role,
        p_message: form.message.trim() || '',
        p_days_valid: form.days_valid,
        p_idempotency_key: adminCommandKey('create-invitation', `${form.agency_id}:${form.email.trim().toLowerCase()}`),
      });
      if (error) throw error;

      const result = data as { token?: string } | null;
      if (!result?.token) throw new Error('Invitation créée sans jeton exploitable.');
      const url = `${getAppOrigin()}/?token=${result.token}`;
      setLink(url);

      onInvited();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur création invitation');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const reset = () => {
    setForm({ email: '', agency_id: '', role: 'agent', message: '', days_valid: 7 });
    setLink(null);
    setErr(null);
    setCopied(false);
  };

  const close = () => { reset(); onClose(); };

  return (
    <ModalShell open={open} onClose={close} title="Inviter un utilisateur" subtitle="Crée une invitation rattachée à une agence" icon={UserPlus}>
      {link ? (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-sm text-emerald-300 font-medium">Invitation créée</p>
            <p className="text-xs text-gray-400 mt-1">Transmettez ce lien à l'invité (valide {form.days_valid} jours).</p>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={link} className={inputCls} data-testid="input-invite-link" />
            <button onClick={copyLink} className={secondaryBtn} data-testid="button-copy-invite-link">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={reset} className={secondaryBtn}>Nouvelle invitation</button>
            <button onClick={close} className={primaryBtn}>Fermer</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} data-testid="input-invite-email" />
          </div>
          <div>
            <label className={labelCls}>Agence cible *</label>
            <select required value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })} className={inputCls} data-testid="select-invite-agency">
              <option value="">— Choisir une agence —</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rôle</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof INVITE_ROLES[number] })} className={inputCls} data-testid="select-invite-role">
                {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Validité (jours)</label>
              <input type="number" min={1} max={30} value={form.days_valid} onChange={(e) => setForm({ ...form, days_valid: parseInt(e.target.value) || 7 })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Message (optionnel)</label>
            <textarea rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={inputCls} />
          </div>
          {form.role === 'admin' && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200">Un administrateur d'agence peut gérer tous les utilisateurs et les paramètres de cette agence.</p>
            </div>
          )}
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className={secondaryBtn}>Annuler</button>
            <button type="submit" disabled={busy} className={primaryBtn} data-testid="button-submit-invite">
              {busy ? 'Création…' : 'Créer l\'invitation'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ─── 3) Édition utilisateur ──────────────────────────────────────────────────

interface EditUserProps {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  agencies: AgencyOption[];
  actorId: string | undefined;
  actorEmail: string | null | undefined;
  onSaved: () => void;
}

export function EditUserModal({ open, onClose, user, agencies, actorId, actorEmail, onSaved }: EditUserProps) {
  const [role, setRole] = useState<string>(user?.role ?? 'agent');
  const [agencyId, setAgencyId] = useState<string>(user?.agency_id ?? '');
  const [actif, setActif] = useState<boolean>(user?.actif ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [reason, setReason] = useState('');

  void actorId;
  void actorEmail;

  React.useEffect(() => {
    if (user) {
      setRole(user.role);
      setAgencyId(user.agency_id ?? '');
      setActif(user.actif);
      setErr(null);
      setConfirmRoleChange(false);
      setReason('');
    }
  }, [user]);

  if (!user) return null;

  const roleEscalation = user.role !== 'admin' && role === 'admin';
  const agencyChanged = (user.agency_id ?? '') !== agencyId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roleEscalation && !confirmRoleChange) return;
    if (reason.trim().length < 8) {
      setErr('Indiquez un motif d’au moins 8 caractères pour assurer la traçabilité.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const hasRoleChange = role !== user.role;
      const hasStatusChange = actif !== user.actif;
      if (!hasRoleChange && !agencyChanged && !hasStatusChange) {
        onClose();
        setBusy(false);
        return;
      }

      const { error } = await supabase.rpc('admin_update_user_access', {
        p_target_user_id: user.id,
        p_next_role: hasRoleChange ? role : null,
        p_next_active: hasStatusChange ? actif : null,
        p_next_agency_id: agencyChanged ? agencyId || null : null,
        p_change_agency: agencyChanged,
        p_reason: reason.trim(),
        p_idempotency_key: adminCommandKey('user-access', user.id),
      });
      if (error) throw error;

      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur mise à jour utilisateur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title={`${user.prenom} ${user.nom}`} subtitle={user.email} icon={UserCog}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Rôle</label>
          <select value={role} onChange={(e) => { setRole(e.target.value); setConfirmRoleChange(false); }} className={inputCls} data-testid="select-edit-user-role">
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {role === 'super_admin' && (
            <p className="mt-1 text-xs text-amber-300">Le rôle super_admin n'est pas attribuable depuis cette interface.</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Agence rattachée</label>
          <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className={inputCls} data-testid="select-edit-user-agency">
            <option value="">— Aucune (utilisateur global) —</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between bg-gray-950 border border-gray-700 rounded p-3">
          <div>
            <p className="text-sm text-gray-200 font-medium">Compte actif</p>
            <p className="text-xs text-gray-500">Désactiver bloque l'accès sans supprimer les données</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={actif} onChange={(e) => setActif(e.target.checked)} data-testid="toggle-edit-user-actif" />
            <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer-checked:bg-orange-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        {roleEscalation && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-200">Vous allez accorder les pleins pouvoirs sur cette agence à <span className="font-semibold">{user.email}</span>. Cette action est sensible.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-red-200">
              <input type="checkbox" checked={confirmRoleChange} onChange={(e) => setConfirmRoleChange(e.target.checked)} data-testid="confirm-role-escalation" />
              Je confirme la promotion en administrateur d'agence
            </label>
          </div>
        )}

        {agencyChanged && user.agency_id && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-200">Le rattachement d'agence va changer. L'utilisateur perdra l'accès aux données de son agence actuelle.</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Motif de la modification *</label>
          <textarea
            rows={2}
            minLength={8}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="Ex. Changement validé par le responsable de compte"
            data-testid="input-edit-user-reason"
          />
          <p className="mt-1 text-xs text-gray-500">Ce motif est conservé dans le journal d’audit.</p>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>Annuler</button>
          <button type="submit" disabled={busy || reason.trim().length < 8 || (roleEscalation && !confirmRoleChange) || role === 'super_admin'} className={primaryBtn} data-testid="button-submit-edit-user">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── 4) Édition abonnement ───────────────────────────────────────────────────

interface EditSubProps {
  open: boolean;
  onClose: () => void;
  subscription: SubscriptionRow | null;
  actorId: string | undefined;
  actorEmail: string | null | undefined;
  onSaved: () => void;
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export function EditSubscriptionModal({ open, onClose, subscription, actorId, actorEmail, onSaved }: EditSubProps) {
  const [planId, setPlanId] = useState<string>(subscription?.plan_id ?? 'pro');
  const [status, setStatus] = useState<string>(subscription?.status ?? 'active');
  const [periodStart, setPeriodStart] = useState<string>(toDateInput(subscription?.current_period_start ?? null));
  const [periodEnd, setPeriodEnd] = useState<string>(toDateInput(subscription?.current_period_end ?? null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState('');

  void actorId;
  void actorEmail;

  React.useEffect(() => {
    if (subscription) {
      setPlanId(subscription.plan_id);
      setStatus(subscription.status);
      setPeriodStart(toDateInput(subscription.current_period_start));
      setPeriodEnd(toDateInput(subscription.current_period_end));
      setErr(null);
      setConfirmCancel(false);
      setReason('');
    }
  }, [subscription]);

  if (!subscription) return null;

  const cancelling = subscription.status !== 'cancelled' && status === 'cancelled';
  const planChanging = subscription.plan_id !== planId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cancelling && !confirmCancel) return;
    if (reason.trim().length < 8) {
      setErr('Indiquez un motif d’au moins 8 caractères pour assurer la traçabilité.');
      return;
    }
    if (!periodStart || !periodEnd || new Date(periodEnd) <= new Date(periodStart)) {
      setErr('La période d’abonnement doit comporter une date de fin postérieure à la date de début.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('admin_update_subscription', {
        p_subscription_id: subscription.id,
        p_plan_id: planId,
        p_status: status,
        p_period_start: new Date(periodStart).toISOString(),
        p_period_end: new Date(periodEnd).toISOString(),
        p_reason: reason.trim(),
        p_idempotency_key: adminCommandKey('subscription-update', subscription.id),
      });
      if (error) throw error;

      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur mise à jour abonnement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Modifier l'abonnement" subtitle={subscription.agency_name} icon={CreditCard}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls} data-testid="select-edit-sub-plan">
              {PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} data-testid="select-edit-sub-status">
              {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Début période</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fin période</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
          </div>
        </div>

        {planChanging && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-200">Le changement de plan modifie les limites d'usage. Le champ <code>agencies.plan</code> sera aligné automatiquement.</p>
          </div>
        )}

        {cancelling && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-200">Vous allez annuler l'abonnement. L'agence pourrait perdre l'accès à certaines fonctionnalités.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-red-200">
              <input type="checkbox" checked={confirmCancel} onChange={(e) => setConfirmCancel(e.target.checked)} data-testid="confirm-sub-cancel" />
              Je confirme l'annulation de l'abonnement
            </label>
          </div>
        )}

        <div>
          <label className={labelCls}>Motif de la modification *</label>
          <textarea
            rows={2}
            minLength={8}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="Ex. Renouvellement confirmé par le support"
            data-testid="input-edit-sub-reason"
          />
          <p className="mt-1 text-xs text-gray-500">Le plan, la période et le journal d’audit sont mis à jour dans une seule transaction.</p>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>Annuler</button>
          <button type="submit" disabled={busy || reason.trim().length < 8 || (cancelling && !confirmCancel)} className={primaryBtn} data-testid="button-submit-edit-sub">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── 5) Confirmation dark theme (suspension/suppression/etc.) ───────────────

interface DarkConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
  busy?: boolean;
  requireText?: string;
}

export function DarkConfirmModal({
  open, onClose, onConfirm, title, message, confirmText = 'Confirmer',
  destructive = true, busy = false, requireText,
}: DarkConfirmProps) {
  const [typed, setTyped] = useState('');
  React.useEffect(() => { if (!open) setTyped(''); }, [open]);
  const blocked = !!requireText && typed.trim() !== requireText;
  if (!open) return null;
  return (
    <ModalShell open={open} onClose={onClose} title={title} icon={AlertTriangle}>
      <div className="space-y-4">
        <p className="text-sm text-gray-300">{message}</p>
        {requireText && (
          <div>
            <label className={labelCls}>Tapez « {requireText} » pour confirmer</label>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} data-testid="input-confirm-text" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={secondaryBtn} disabled={busy}>Annuler</button>
          <button
            onClick={onConfirm}
            disabled={busy || blocked}
            data-testid="button-confirm-action"
            className={`px-4 py-2 rounded text-white text-sm font-semibold disabled:opacity-50 ${destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'}`}
          >
            {busy ? 'En cours…' : confirmText}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
