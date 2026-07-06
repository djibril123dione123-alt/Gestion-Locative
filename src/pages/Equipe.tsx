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
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
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
import { getPricingPlan } from '../lib/pricingCatalog';
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

interface EquipeProps {
  embedded?: boolean;
  sectionMode?: 'team' | 'permissions' | 'access';
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent',
  comptable: 'Comptable',
  bailleur: 'Bailleur',
  super_admin: 'Super admin',
};

const INVITE_ROLE_GUIDE: Record<RoleOption, { summary: string; access: string[]; tone: string }> = {
  agent: {
    summary: 'Gestion opérationnelle selon les permissions accordées.',
    access: ['Bailleurs, biens et locations', 'Documents utiles au suivi', 'Finance limitée par défaut'],
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-100',
  },
  comptable: {
    summary: 'Encaissements, reliquats et rapports selon permissions.',
    access: ['Paiements et créances', 'Dépenses et commissions', 'Lecture opérationnelle ciblée'],
    tone: 'text-orange-800 bg-orange-50 border-orange-100',
  },
  admin: {
    summary: 'Accès complet à l’agence et à la configuration.',
    access: ['Toutes les pages', 'Équipe et permissions', 'Abonnement et paramètres'],
    tone: 'text-slate-800 bg-slate-50 border-slate-200',
  },
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

export function Equipe({ embedded = false, sectionMode = 'team' }: EquipeProps = {}) {
  const { profile, agency } = useAuth();
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

  const planDefinition = useMemo(() => getPricingPlan(agency?.plan), [agency?.plan]);
  const userUsageLabel = planDefinition.limits.max_users === -1
    ? `${stats.activeMembers}/illimite`
    : `${stats.activeMembers}/${planDefinition.limits.max_users}`;

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
      <div className={embedded ? 'p-0' : 'p-4 sm:p-6'}>
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
    <div className={embedded ? 'space-y-2.5' : 'sk-page-shell space-y-5 sm:space-y-6'}>
      {!embedded && (
      <PremiumPageHeader
        density="compact"
        eyebrow="ADMINISTRATION & SÉCURITÉ"
        title="Équipe & permissions"
        description="Gérez les collaborateurs et leurs droits d'accès à l'agence."
        mobileDescription="Équipe et droits."
        primaryAction={
          <PremiumButton
            variant="create"
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            data-testid="button-invite-member"
            icon={<UserPlus className="h-4 w-4" />}
          >
            Inviter
          </PremiumButton>
        }
      />
      )}

      {embedded && (sectionMode === 'team' || sectionMode === 'access') && (
        <section className="flex flex-col gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/92 p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Équipe & accès</p>
            <h2 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Collaborateurs, rôles et pages visibles.</h2>
            <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-600">Invitez, filtrez et ajustez les permissions sans quitter le Control Center.</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-emerald-800">
                Utilisateurs {userUsageLabel}
              </span>
              <span className="rounded-full bg-orange-50 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-orange-700">
                {stats.pendingInvitations} invitation{stats.pendingInvitations > 1 ? 's' : ''}
              </span>
            </div>
            <PremiumButton
              variant="create"
              size="sm"
              onClick={() => setIsInviteOpen(true)}
              data-testid="button-invite-member-embedded"
              icon={<UserPlus className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Inviter
            </PremiumButton>
          </div>
        </section>
      )}

      {embedded && (sectionMode === 'permissions' || sectionMode === 'access') && (
        <section className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-emerald-50/80 via-white to-[#fff8ed] p-2.5 shadow-sm">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Permissions & pages visibles</p>
          <h2 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Repères d'accès, contrôle précis.</h2>
          <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-4 text-slate-600">
            Les rôles restent la base. Les profils personnalisés ci-dessous utilisent les droits existants par page, sans contourner le RBAC.
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
            {[
              ['Standard', 'Agent opérationnel avec écriture métier.'],
              ['Restreint', 'Lecture ou pages masquées selon besoin.'],
              ['Finance', 'Encaissements, créances et exports.'],
              ['Personnalisé', 'Overrides par page et par action.'],
            ].map(([preset, description]) => (
              <div key={preset} className="rounded-lg border border-emerald-950/10 bg-white/88 px-2 py-1.5 shadow-sm">
                <p className="text-[0.7rem] font-extrabold text-slate-950">{preset}</p>
                <p className="mt-0.5 line-clamp-2 text-[0.62rem] font-semibold leading-[0.875rem] text-slate-500">{description}</p>
              </div>
            ))}
          </div>
          <PermissionMatrixPreview />
        </section>
      )}

      <section className="grid gap-1.5 sm:grid-cols-3">
        <MetricCard label="Membres actifs" value={stats.activeMembers} icon={UsersIcon} />
        <MetricCard label="Invitations" value={stats.pendingInvitations} icon={Mail} tone="orange" />
        <MetricCard label="Profils restreints" value={stats.restrictedMembers} icon={Lock} tone="emerald" />
      </section>

      <section className={embedded ? 'overflow-hidden rounded-xl border border-emerald-950/10 bg-white/88 shadow-sm' : 'sk-premium-panel overflow-hidden'}>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[0.82rem] font-extrabold text-slate-950">{sectionMode === 'team' ? 'Membres actuels' : 'Profils et overrides'}</h2>
            <p className="text-[0.68rem] text-slate-500">{filteredMembers.length} profil(s) visible(s)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[0.72rem] font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:hidden"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un membre..."
                className="hidden h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[0.72rem] font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:block"
              />
            </label>
            <select aria-label="Sélection"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.72rem] font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
            <SkeletonTable rows={4} cols={5} />
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
                <article key={member.id} className="grid gap-2.5 p-2.5 transition hover:bg-emerald-50/45 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[0.78rem] font-extrabold text-slate-950">
                        {member.prenom ?? ''} {member.nom ?? ''}
                      </h3>
                      <RoleBadge role={member.role} />
                      <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${member.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {member.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                    {member.email ? (
                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(member.email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-brand-700 underline-offset-2 hover:text-brand-950 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">Email non renseigné</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-emerald-950/10 bg-white/70 p-1 text-center shadow-sm">
                    <MiniStat label="Masquées" value={summary.hidden} />
                    <MiniStat label="Lecture" value={summary.readOnly} />
                    <MiniStat label="Overrides" value={summary.overrides} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openPermissions(member)}
                      disabled={isProtected}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-900/10 bg-white px-2.5 text-[0.7rem] font-extrabold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {isProtected ? 'Protégé' : 'Permissions'}
                    </button>
                    {member.actif && member.id !== profile.id ? (
                      <button
                        type="button"
                        onClick={() => setDeactivateTarget(member)}
                        data-testid={`button-deactivate-${member.id}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[0.7rem] font-extrabold text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100"
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

      {sectionMode !== 'permissions' && (
      <section className={embedded ? 'overflow-hidden rounded-2xl border border-emerald-950/10 bg-white/88 shadow-sm' : 'sk-premium-panel overflow-hidden'}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Mail className="h-5 w-5 text-slate-500" />
          <h2 className="font-black text-slate-950">Invitations en attente ({invitations.length})</h2>
        </div>
        {invitations.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">Aucune invitation en attente</div>
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
      )}

      <Modal isOpen={isInviteOpen} onClose={closeInviteModal} title="Inviter un collaborateur">
        {generatedLink ? (
          <div className="space-y-3">
            <p className="text-[0.76rem] leading-5 text-slate-700">
              Invitation créée. Envoyez ce lien à votre collaborateur pour qu'il rejoigne l'agence.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input aria-label="Champ de saisie"
                type="text"
                readOnly
                value={generatedLink}
                data-testid="input-invite-link"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[0.74rem] font-semibold text-slate-700"
              />
              <button
                type="button"
                onClick={() => copyLink(generatedLink)}
                data-testid="button-copy-generated"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] px-3 text-[0.72rem] font-black text-white transition hover:from-[#0A3F30] hover:to-[#06281F]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-2.5">
            <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2.5 shadow-sm">
              <p className="text-[0.56rem] font-black uppercase tracking-[0.16em] text-[#a45d12]">Nouvel accès</p>
              <h3 className="mt-0.5 text-[0.84rem] font-extrabold text-slate-950">Inviter un collaborateur</h3>
              <p className="mt-0.5 text-[0.66rem] font-medium leading-4 text-slate-600">
                Les accès pourront être ajustés ensuite dans Équipe & accès.
              </p>
              <p className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[0.58rem] font-black text-emerald-800">
                Utilisateurs : {userUsageLabel}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Email professionnel</label>
              <input aria-label="Champ de saisie"
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                data-testid="input-invite-email"
                placeholder="collaborateur@agence.sn"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[0.78rem] font-semibold text-slate-900 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Rôle et preset d’accès</label>
              <select aria-label="Sélection"
                value={formData.role}
                onChange={(event) => setFormData({ ...formData, role: event.target.value as RoleOption })}
                data-testid="select-invite-role"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[0.78rem] font-semibold text-slate-900 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15"
              >
                <option value="agent">Agent</option>
                <option value="comptable">Comptable</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            {(() => {
              const guide = INVITE_ROLE_GUIDE[formData.role];
              const presetGuide = [
                ['Standard', formData.role === 'agent', 'Gestion opérationnelle'],
                ['Finance', formData.role === 'comptable', 'Encaissements et rapports'],
                ['Admin', formData.role === 'admin', 'Contrôle complet'],
                ['Restreint', false, 'À ajuster après acceptation'],
              ] as const;
              return (
                <div className={`rounded-xl border p-2.5 ${guide.tone}`}>
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[0.7rem] font-extrabold">{ROLE_LABELS[formData.role]}</p>
                      <p className="mt-0.5 text-[0.62rem] font-semibold leading-3 opacity-80">{guide.summary}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-4">
                    {presetGuide.map(([label, active, description]) => (
                      <span
                        key={label}
                        className={[
                          'rounded-lg px-2 py-1 text-[0.54rem] font-black leading-3 ring-1',
                          active ? 'bg-emerald-950 text-white ring-emerald-950' : 'bg-white/70 text-slate-500 ring-white/70',
                        ].join(' ')}
                        title={description}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 grid gap-1 sm:grid-cols-3">
                    {guide.access.map((item) => (
                      <span key={item} className="rounded-lg bg-white/70 px-2 py-1 text-[0.56rem] font-bold leading-3 text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeInviteModal}
                className="h-9 rounded-lg border border-slate-200 px-3 text-[0.72rem] font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="button-submit-invitation"
                className="h-9 rounded-lg border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] px-3 text-[0.72rem] font-black text-white transition hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50"
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
                            <select aria-label="Sélection"
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

function PermissionMatrixPreview() {
  const rows = [
    { page: 'patrimoine', label: 'Biens & patrimoine' },
    { page: 'occupants-baux', label: 'Locations' },
    { page: 'paiements', label: 'Encaissements' },
    { page: 'loyers-impayes', label: 'Créances' },
    { page: 'depenses', label: 'Dépenses' },
    { page: 'documents', label: 'Documents' },
    { page: 'abonnement', label: 'Abonnement' },
  ];
  const roles: Array<{ key: UserRole; label: string }> = [
    { key: 'admin', label: 'Admin' },
    { key: 'agent', label: 'Agent' },
    { key: 'comptable', label: 'Comptable' },
  ];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-950/10 bg-white/90 shadow-sm">
      <div className="grid grid-cols-[minmax(8rem,1fr)_repeat(3,minmax(4rem,0.55fr))] border-b border-slate-100 bg-[#fffdf8] px-2.5 py-1.5 text-[0.56rem] font-black uppercase tracking-[0.12em] text-slate-500">
        <span>Page</span>
        {roles.map((role) => <span key={role.key} className="text-center">{role.label}</span>)}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.page} className="grid grid-cols-[minmax(8rem,1fr)_repeat(3,minmax(4rem,0.55fr))] items-center gap-2 px-2.5 py-1.5">
            <span className="min-w-0 truncate text-[0.7rem] font-extrabold text-slate-800">{row.label}</span>
            {roles.map((role) => (
              <AccessBadge key={role.key} level={getDefaultAccessLevel(role.key, row.page)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessBadge({ level }: { level: AccessLevel }) {
  const label = level === 'admin' ? 'Admin' : level === 'write' ? 'Écriture' : level === 'read' ? 'Lecture' : 'Masqué';
  const className =
    level === 'admin'
      ? 'bg-emerald-950 text-white'
      : level === 'write'
        ? 'bg-emerald-50 text-emerald-700'
        : level === 'read'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-slate-100 text-slate-400';
  return (
    <span className={`justify-self-center rounded-full px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ${className}`}>
      {label}
    </span>
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
    <div className="rounded-xl border border-emerald-950/10 bg-white/88 px-2.5 py-1.5 shadow-sm">
      <div className="flex items-center justify-between gap-2.5">
        <div>
          <p className="text-[0.52rem] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
          <p className="mt-0.5 text-[1rem] font-extrabold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-3 w-3" />
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
    <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${className}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-1.5 py-1">
      <p className="text-[0.78rem] font-extrabold text-slate-950">{value}</p>
      <p className="text-[0.56rem] font-bold text-slate-500">{label}</p>
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
