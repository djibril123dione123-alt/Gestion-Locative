import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  Lock,
  Mail,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { SkeletonTable } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  getDefaultAccessLevel,
  getEffectivePermission,
  permissionRowsToMap,
  PERMISSION_CATALOG,
  type AccessLevel,
  type UserPagePermission,
  type UserPermissionMap,
} from '../lib/rbac';
import { supabase, type UserRole } from '../lib/supabase';

interface Member {
  id: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  role: UserRole;
  actif: boolean;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

type RoleOption = 'admin' | 'agent' | 'comptable';
type DraftAccessLevel = AccessLevel | 'inherit';
type PermissionDraftItem = Omit<UserPagePermission, 'access_level'> & { access_level: DraftAccessLevel };
type PermissionDraft = Record<string, PermissionDraftItem>;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent',
  comptable: 'Comptable',
  bailleur: 'Bailleur',
  super_admin: 'Super admin',
};

const ACCESS_LABELS: Record<DraftAccessLevel, string> = {
  inherit: 'Rôle par défaut',
  none: 'Masqué',
  read: 'Lecture seule',
  write: 'Édition',
  admin: 'Admin module',
};

const ACTIONS = [
  { key: 'can_create', label: 'Créer', icon: Sparkles },
  { key: 'can_update', label: 'Modifier', icon: Edit3 },
  { key: 'can_delete', label: 'Supprimer', icon: Trash2 },
  { key: 'can_export', label: 'Exporter', icon: Download },
  { key: 'can_manage', label: 'Gérer', icon: SlidersHorizontal },
] as const;

export function Equipe() {
  const { profile } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [permissionsByUser, setPermissionsByUser] = useState<Record<string, UserPermissionMap>>({});
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{ email: string; role: RoleOption }>({
    email: '',
    role: 'agent',
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleOption | 'bailleur'>('all');
  const [permissionTarget, setPermissionTarget] = useState<Member | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, nom, prenom, email, role, actif, created_at')
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('invitations')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitationsRes.error) throw invitationsRes.error;

      const nextMembers = (membersRes.data ?? []) as Member[];
      setMembers(nextMembers);
      setInvitations((invitationsRes.data ?? []) as Invitation[]);

      const memberIds = nextMembers.map((member) => member.id);
      if (memberIds.length === 0) {
        setPermissionsByUser({});
        return;
      }

      const { data: permissionRows, error: permissionErr } = await supabase
        .from('user_page_permissions')
        .select('user_id,page,access_level,can_create,can_update,can_delete,can_export,can_manage')
        .eq('agency_id', profile.agency_id)
        .in('user_id', memberIds);

      if (permissionErr) {
        console.warn('[Equipe] permissions load failed', permissionErr.message);
        setPermissionsByUser({});
        return;
      }

      const nextPermissions: Record<string, UserPermissionMap> = {};
      for (const member of nextMembers) {
        const rows = (permissionRows ?? []).filter((row) => row.user_id === member.id);
        nextPermissions[member.id] = permissionRowsToMap(rows);
      }
      setPermissionsByUser(nextPermissions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) loadData();
  }, [profile?.agency_id, loadData]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      const fullName = `${member.prenom ?? ''} ${member.nom ?? ''} ${member.email ?? ''}`.toLowerCase();
      const roleOk = roleFilter === 'all' || member.role === roleFilter;
      return roleOk && (!needle || fullName.includes(needle));
    });
  }, [members, roleFilter, search]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((member) => member.actif).length;
    const restrictedMembers = members.filter((member) => {
      const permissions = permissionsByUser[member.id] ?? {};
      return Object.values(permissions).some((permission) => permission.access_level === 'none' || permission.access_level === 'read');
    }).length;
    return {
      activeMembers,
      pendingInvitations: invitations.length,
      restrictedMembers,
    };
  }, [invitations.length, members, permissionsByUser]);

  const openPermissions = (member: Member) => {
    const existing = permissionsByUser[member.id] ?? {};
    const draft = PERMISSION_CATALOG.reduce<PermissionDraft>((acc, item) => {
      const override = existing[item.id];
      const effective = getEffectivePermission(member.role, item.id, null, existing);
      acc[item.id] = {
        page: item.id,
        access_level: override?.access_level ?? 'inherit',
        can_create: override?.can_create ?? effective.can_create,
        can_update: override?.can_update ?? effective.can_update,
        can_delete: override?.can_delete ?? effective.can_delete,
        can_export: override?.can_export ?? effective.can_export,
        can_manage: override?.can_manage ?? effective.can_manage,
      };
      return acc;
    }, {});
    setPermissionDraft(draft);
    setPermissionTarget(member);
  };

  const updateDraftAccess = (page: string, accessLevel: DraftAccessLevel) => {
    setPermissionDraft((prev) => {
      const current = prev[page];
      if (!current) return prev;
      if (accessLevel === 'inherit' && permissionTarget) {
        const inherited = getEffectivePermission(permissionTarget.role, page);
        return {
          ...prev,
          [page]: {
            ...current,
            access_level: 'inherit',
            can_create: inherited.can_create,
            can_update: inherited.can_update,
            can_delete: inherited.can_delete,
            can_export: inherited.can_export,
            can_manage: inherited.can_manage,
          },
        };
      }
      return {
        ...prev,
        [page]: {
          ...current,
          access_level: accessLevel,
          can_create: accessLevel === 'write' || accessLevel === 'admin',
          can_update: accessLevel === 'write' || accessLevel === 'admin',
          can_delete: accessLevel === 'admin',
          can_export: accessLevel !== 'none',
          can_manage: accessLevel === 'admin',
        },
      };
    });
  };

  const toggleDraftAction = (page: string, key: keyof Pick<UserPagePermission, 'can_create' | 'can_update' | 'can_delete' | 'can_export' | 'can_manage'>) => {
    setPermissionDraft((prev) => {
      const current = prev[page];
      if (!current || current.access_level === 'none') return prev;
      return {
        ...prev,
        [page]: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  };

  const savePermissions = async () => {
    if (!profile?.agency_id || !profile.id || !permissionTarget) return;
    if (permissionTarget.id === profile.id || permissionTarget.role === 'admin' || permissionTarget.role === 'super_admin') {
      toast.warning("Les permissions d'un administrateur ne peuvent pas être restreintes ici.");
      return;
    }

    setSavingPermissions(true);
    try {
      const { error: deleteErr } = await supabase
        .from('user_page_permissions')
        .delete()
        .eq('agency_id', profile.agency_id)
        .eq('user_id', permissionTarget.id);
      if (deleteErr) throw deleteErr;

      const rows = Object.values(permissionDraft)
        .filter((permission) => permission.access_level !== 'inherit')
        .map((permission) => ({
          agency_id: profile.agency_id,
          user_id: permissionTarget.id,
          page: permission.page,
          access_level: permission.access_level as AccessLevel,
          can_create: permission.access_level !== 'none' && permission.can_create,
          can_update: permission.access_level !== 'none' && permission.can_update,
          can_delete: permission.access_level !== 'none' && permission.can_delete,
          can_export: permission.access_level !== 'none' && permission.can_export,
          can_manage: permission.access_level === 'admin' && permission.can_manage,
          created_by: profile.id,
        }));

      if (rows.length > 0) {
        const { error: insertErr } = await supabase.from('user_page_permissions').insert(rows);
        if (insertErr) throw insertErr;
      }

      setPermissionsByUser((prev) => ({
        ...prev,
        [permissionTarget.id]: permissionRowsToMap(rows),
      }));
      toast.success('Permissions mises à jour');
      setPermissionTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des permissions';
      toast.error(msg);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    if (!formData.email.trim()) {
      toast.warning('Veuillez saisir un email');
      return;
    }
    setSubmitting(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('invitations').insert({
        email: formData.email.trim().toLowerCase(),
        agency_id: profile.agency_id,
        role: formData.role,
        token,
        invited_by: profile.id,
        expires_at: expiresAt,
        status: 'pending',
      });
      if (error) throw error;
      const link = `${window.location.origin}/?token=${token}`;
      setGeneratedLink(link);
      toast.success("Invitation créée. Copiez le lien pour l'envoyer.");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'invitation";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Lien copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const closeInviteModal = () => {
    setIsInviteOpen(false);
    setFormData({ email: '', role: 'agent' });
    setGeneratedLink(null);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ actif: false })
        .eq('id', deactivateTarget.id);
      if (error) throw error;
      toast.success('Membre désactivé');
      setDeactivateTarget(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setDeactivating(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={Shield}
          title="Accès réservé"
          description="Seuls les administrateurs peuvent gérer l'équipe et ses permissions."
        />
      </div>
    );
  }

  const groupedCatalog = PERMISSION_CATALOG.reduce<Record<string, typeof PERMISSION_CATALOG>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="sk-page-shell space-y-5 sm:space-y-6">
      <section className="sk-premium-panel p-5 sm:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/10 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-brand-800">
              <Shield className="h-4 w-4" />
              RBAC enterprise
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Équipe & permissions</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Gérez précisément les pages, les modes lecture seule et les actions sensibles pour chaque membre de votre agence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            data-testid="button-invite-member"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/18 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F]"
          >
            <UserPlus className="h-5 w-5" />
            Inviter un collaborateur
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Membres actifs" value={stats.activeMembers} icon={UsersIcon} />
        <MetricCard label="Invitations" value={stats.pendingInvitations} icon={Mail} tone="orange" />
        <MetricCard label="Profils restreints" value={stats.restrictedMembers} icon={Lock} tone="emerald" />
      </section>

      <section className="sk-premium-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Membres actuels</h2>
            <p className="text-sm text-slate-500">{filteredMembers.length} profil(s) visible(s)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:hidden"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un membre..."
                className="hidden sm:block h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="all">Tous les rôles</option>
              <option value="admin">Admins</option>
              <option value="agent">Agents</option>
              <option value="comptable">Comptables</option>
              <option value="bailleur">Bailleurs</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-4 sm:p-6">
            <SkeletonTable rows={5} cols={5} />
          </div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Aucun membre" description="Aucun profil ne correspond à vos filtres." />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMembers.map((member) => {
              const permissions = permissionsByUser[member.id] ?? {};
              const summary = getMemberPermissionSummary(member, permissions);
              const isProtected = member.id === profile.id || member.role === 'admin' || member.role === 'super_admin';
              return (
                <article key={member.id} className="grid gap-4 p-4 transition hover:bg-emerald-50/45 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black text-slate-950">
                        {member.prenom ?? ''} {member.nom ?? ''}
                      </h3>
                      <RoleBadge role={member.role} />
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {member.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                    {member.email ? (
                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(member.email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-brand-700 underline-offset-2 hover:text-brand-950 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">Email non renseigné</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-[1rem] border border-emerald-950/10 bg-white/70 p-2 text-center shadow-sm">
                    <MiniStat label="Masquées" value={summary.hidden} />
                    <MiniStat label="Lecture" value={summary.readOnly} />
                    <MiniStat label="Overrides" value={summary.overrides} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openPermissions(member)}
                      disabled={isProtected}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-4 py-2.5 text-sm font-black text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {isProtected ? 'Protégé' : 'Permissions'}
                    </button>
                    {member.actif && member.id !== profile.id ? (
                      <button
                        type="button"
                        onClick={() => setDeactivateTarget(member)}
                        data-testid={`button-deactivate-${member.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100"
                      >
                        <X className="h-4 w-4" />
                        Désactiver
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="sk-premium-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Mail className="h-5 w-5 text-slate-500" />
          <h2 className="font-black text-slate-950">Invitations en attente ({invitations.length})</h2>
        </div>
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Aucune invitation en attente</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((invitation) => {
              const link = `${window.location.origin}/?token=${invitation.token}`;
              return (
                <li key={invitation.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-brand-700 underline-offset-2 hover:text-brand-950 hover:underline"
                      data-testid={`text-invitation-email-${invitation.id}`}
                    >
                      {invitation.email}
                    </a>
                    <p className="text-xs text-slate-500">
                      Rôle : <span className="font-bold capitalize">{invitation.role}</span> · Expire le {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(link)}
                    data-testid={`button-copy-${invitation.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    Copier le lien
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal isOpen={isInviteOpen} onClose={closeInviteModal} title="Inviter un collaborateur">
        {generatedLink ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              Invitation créée. Envoyez ce lien à votre collaborateur pour qu'il rejoigne l'agence.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={generatedLink}
                data-testid="input-invite-link"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
              <button
                type="button"
                onClick={() => copyLink(generatedLink)}
                data-testid="button-copy-generated"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] px-4 py-2 text-sm font-black text-white transition hover:from-[#0A3F30] hover:to-[#06281F]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                data-testid="input-invite-email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Rôle</label>
              <select
                value={formData.role}
                onChange={(event) => setFormData({ ...formData, role: event.target.value as RoleOption })}
                data-testid="select-invite-role"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="agent">Agent</option>
                <option value="comptable">Comptable</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="button-submit-invitation"
                className="rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] px-4 py-2.5 text-sm font-black text-white transition hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Création...' : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!permissionTarget}
        onClose={() => setPermissionTarget(null)}
        title={permissionTarget ? `Permissions · ${permissionTarget.prenom ?? ''} ${permissionTarget.nom ?? ''}` : 'Permissions'}
      >
        {permissionTarget ? (
          <div className="space-y-5">
            <div className="sk-card-premium p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-800">Profil contrôlé</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Base actuelle : {ROLE_LABELS[permissionTarget.role] ?? permissionTarget.role}. Les lignes “Rôle par défaut” suivent automatiquement ce rôle.
              </p>
            </div>

            <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
              {Object.entries(groupedCatalog).map(([category, items]) => (
                <div key={category} className="rounded-[1.25rem] border border-emerald-950/10 bg-white/90 shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="font-black text-slate-950">{category}</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const draft = permissionDraft[item.id];
                      const inherited = getDefaultAccessLevel(permissionTarget.role, item.id);
                      if (!draft) return null;
                      const actionsDisabled = draft.access_level === 'none';
                      return (
                        <div key={item.id} className="space-y-3 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-black text-slate-950">{item.label}</h4>
                                {item.sensitive ? (
                                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-orange-700">
                                    sensible
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
                              <p className="mt-1 text-xs font-bold text-slate-400">Défaut rôle : {ACCESS_LABELS[inherited]}</p>
                            </div>
                            <select
                              value={draft.access_level}
                              onChange={(event) => updateDraftAccess(item.id, event.target.value as DraftAccessLevel)}
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            >
                              <option value="inherit">Rôle par défaut</option>
                              <option value="none">Masquer</option>
                              <option value="read">Lecture seule</option>
                              <option value="write">Édition</option>
                              <option value="admin">Admin module</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {ACTIONS.map(({ key, label, icon: Icon }) => (
                              <button
                                key={key}
                                type="button"
                                disabled={actionsDisabled}
                                onClick={() => toggleDraftAction(item.id, key)}
                                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-black transition ${
                                  draft[key]
                                    ? 'border-emerald-200 bg-emerald-50 text-brand-800'
                                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPermissionTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={savingPermissions}
                className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-brand-950 disabled:opacity-50"
              >
                {savingPermissions ? 'Sauvegarde...' : 'Sauvegarder les accès'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title="Désactiver ce membre ?"
        message={`${deactivateTarget?.prenom ?? ''} ${deactivateTarget?.nom ?? ''} ne pourra plus accéder à l'agence.`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deactivating}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'brand' | 'orange' | 'emerald';
}) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-50 text-orange-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-brand-50 text-brand-800';
  return (
    <div className="sk-metric-tile">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const className =
    role === 'admin'
      ? 'bg-brand-900 text-white'
      : role === 'comptable'
        ? 'bg-blue-50 text-blue-700'
        : role === 'bailleur'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-emerald-50 text-emerald-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-2">
      <p className="text-base font-black text-slate-950">{value}</p>
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function getMemberPermissionSummary(member: Member, permissions: UserPermissionMap) {
  const values = Object.values(permissions);
  const hidden = values.filter((permission) => permission.access_level === 'none').length;
  const readOnly = values.filter((permission) => permission.access_level === 'read').length;
  const overrides = values.length;
  const inheritedReadOnly = PERMISSION_CATALOG.filter((item) => getDefaultAccessLevel(member.role, item.id) === 'read').length;
  return {
    hidden,
    readOnly: readOnly + inheritedReadOnly,
    overrides,
  };
}
