import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  CalendarClock,
  Download,
  Edit3,
  KeyRound,
  Lock,
  Mail,
  Search,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import {
  WizardShell,
  wizardPrimaryActionClass,
  wizardSecondaryActionClass,
} from '../components/ui/WizardShell';
import { WizardRail } from '../components/ui/WizardRail';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { PremiumFilterSelect } from '../components/ui/PremiumFilterSelect';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PageSkeleton, SkeletonTable } from '../components/ui/Skeleton';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  getDefaultAccessLevel,
  getEffectivePermission,
  isModuleEnabled,
  permissionRowsToMap,
  PERMISSION_CATALOG,
  type AccessLevel,
  type UserPagePermission,
  type UserPermissionMap,
} from '../lib/rbac';
import { getPricingPlan } from '../lib/pricingCatalog';
import { supabase, type UserRole } from '../lib/supabase';
import {
  cancelTeamInvitation,
  createTeamInvitation,
  deactivateTeamMember,
  replaceMemberPermissions,
} from '../services/tenantAdministrationCommands';
import type { AgencySettings } from '../types/agency';

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
  message?: string | null;
  expires_at: string;
  created_at: string;
}

type RoleOption = 'admin' | 'agent' | 'comptable';
type StatusFilter = 'all' | 'active' | 'inactive';
type AccessPreset = 'standard' | 'restricted' | 'finance' | 'custom';
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

const ACCESS_PRESETS: Record<AccessPreset, { label: string; summary: string; tone: string }> = {
  standard: {
    label: 'Standard',
    summary: 'Droits par défaut du rôle, sans exception manuelle.',
    tone: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  },
  restricted: {
    label: 'Restreint',
    summary: 'Accès limité aux pages utiles, modules sensibles masqués.',
    tone: 'border-orange-100 bg-orange-50 text-orange-800',
  },
  finance: {
    label: 'Finance',
    summary: 'Lecture finance, encaissements, créances et documents utiles.',
    tone: 'border-blue-100 bg-blue-50 text-blue-800',
  },
  custom: {
    label: 'Personnalisé',
    summary: 'Overrides appliqués page par page dans cette agence.',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
};

const ROLE_DEFAULT_PRESET: Record<RoleOption, AccessPreset> = {
  admin: 'standard',
  agent: 'standard',
  comptable: 'finance',
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

type PermissionActionKey = (typeof ACTIONS)[number]['key'];

type PermissionActionShape = {
  page: string;
  access_level: AccessLevel | DraftAccessLevel;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage: boolean;
};

const PAGE_ACTION_CAPABILITIES: Record<string, PermissionActionKey[]> = {
  dashboard: [],
  bailleurs: ['can_create', 'can_update', 'can_delete'],
  patrimoine: ['can_create', 'can_update', 'can_delete'],
  immeubles: ['can_create', 'can_update', 'can_delete'],
  unites: ['can_create', 'can_update', 'can_delete'],
  locataires: ['can_create', 'can_update', 'can_delete'],
  contrats: ['can_create', 'can_update', 'can_delete', 'can_export'],
  'occupants-baux': ['can_create', 'can_update', 'can_delete'],
  paiements: ['can_create', 'can_update', 'can_export'],
  'loyers-impayes': ['can_update', 'can_export'],
  depenses: ['can_create', 'can_update', 'can_delete', 'can_export'],
  commissions: ['can_update', 'can_export'],
  documents: ['can_create', 'can_update', 'can_delete', 'can_export', 'can_manage'],
  'documents/scan': ['can_create'],
  'documents/studio': ['can_update', 'can_manage'],
  notifications: ['can_update'],
  calendrier: ['can_create', 'can_update', 'can_delete'],
  interventions: ['can_create', 'can_update', 'can_delete'],
  inventaires: ['can_create', 'can_update', 'can_delete', 'can_export'],
  audit: ['can_export'],
  parametres: ['can_update', 'can_manage'],
  equipe: ['can_create', 'can_update', 'can_delete', 'can_manage'],
  abonnement: ['can_update', 'can_manage'],
  pricing: [],
};

function getPageActionCapabilities(page: string): PermissionActionKey[] {
  return PAGE_ACTION_CAPABILITIES[page] ?? ['can_create', 'can_update'];
}

function constrainPermissionActions<T extends PermissionActionShape>(permission: T): T {
  const capabilities = getPageActionCapabilities(permission.page);
  return {
    ...permission,
    can_create: capabilities.includes('can_create') && permission.can_create,
    can_update: capabilities.includes('can_update') && permission.can_update,
    can_delete: capabilities.includes('can_delete') && permission.can_delete,
    can_export: capabilities.includes('can_export') && permission.can_export,
    can_manage: capabilities.includes('can_manage') && permission.can_manage,
  };
}

export function Equipe({ embedded = false, sectionMode = 'team' }: EquipeProps = {}) {
  const { profile, agency } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [permissionsByUser, setPermissionsByUser] = useState<Record<string, UserPermissionMap>>({});
  const [agencySettings, setAgencySettings] = useState<Partial<AgencySettings> | null>(null);
  const [loading, setLoading] = useState(true);

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      const action = params.get('action');
      if (action === 'invite' || action === 'new') {
        setIsInviteOpen(true);
      }
    },
    onSelectId: (userId) => {
      const match = members.find((m) => m.id === userId);
      if (match) setPermissionTarget(match);
    },
  });

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{ email: string; role: RoleOption }>({
    email: '',
    role: 'agent',
  });
  const [invitePreset, setInvitePreset] = useState<AccessPreset>('standard');
  const [inviteStep, setInviteStep] = useState<1 | 2>(1);
  const [inviteNote, setInviteNote] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleOption | 'bailleur'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [permissionTarget, setPermissionTarget] = useState<Member | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [membersRes, invitationsRes, settingsRes] = await Promise.all([
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
        supabase
          .from('agency_settings')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .maybeSingle(),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitationsRes.error) throw invitationsRes.error;
      if (settingsRes.error) {
        console.warn('[Equipe] agency settings load failed', settingsRes.error.message);
      }

      const nextMembers = (membersRes.data ?? []) as Member[];
      setMembers(nextMembers);
      setInvitations((invitationsRes.data ?? []) as Invitation[]);
      setAgencySettings((settingsRes.data ?? null) as Partial<AgencySettings> | null);

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
      const statusOk =
        statusFilter === 'all'
        || (statusFilter === 'active' && member.actif)
        || (statusFilter === 'inactive' && !member.actif);
      return roleOk && statusOk && (!needle || fullName.includes(needle));
    });
  }, [members, roleFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((member) => member.actif).length;
    const inactiveMembers = members.filter((member) => !member.actif).length;
    const restrictedMembers = members.filter((member) => {
      const permissions = permissionsByUser[member.id] ?? {};
      return getMemberPermissionSummary(member, permissions, agencySettings).preset === 'restricted';
    }).length;
    const customMembers = members.filter((member) => Object.keys(permissionsByUser[member.id] ?? {}).length > 0).length;
    return {
      activeMembers,
      inactiveMembers,
      pendingInvitations: invitations.length,
      restrictedMembers,
      customMembers,
    };
  }, [agencySettings, invitations.length, members, permissionsByUser]);

  const planDefinition = useMemo(() => getPricingPlan(agency?.plan), [agency?.plan]);
  const seatsUsed = stats.activeMembers + stats.pendingInvitations;
  const maxUsers = planDefinition.limits.max_users;
  const hasUnlimitedSeats = maxUsers === -1;
  const canInviteMore = hasUnlimitedSeats || seatsUsed < maxUsers;
  const userUsageLabel = hasUnlimitedSeats
    ? `${seatsUsed}/illimite`
    : `${seatsUsed}/${maxUsers}`;
  const planSeatLabel = `${planDefinition.name} · ${userUsageLabel}`;
  const disabledModulesCount = useMemo(
    () => PERMISSION_CATALOG.filter((item) => !isModuleEnabled(item.id, agencySettings)).length,
    [agencySettings],
  );
  const invitePreview = useMemo(
    () => getPresetPreview(formData.role, invitePreset, agencySettings),
    [agencySettings, formData.role, invitePreset],
  );
  const permissionDraftPreview = useMemo(
    () => getDraftPreview(permissionDraft, agencySettings),
    [agencySettings, permissionDraft],
  );

  const buildPermissionDraft = useCallback((member: Member, preset: AccessPreset = 'custom') => {
    const existing = permissionsByUser[member.id] ?? {};
    return PERMISSION_CATALOG.reduce<PermissionDraft>((acc, item) => {
      const moduleEnabled = isModuleEnabled(item.id, agencySettings);
      const override = existing[item.id];
      const inherited = getEffectivePermission(member.role, item.id, agencySettings);
      let accessLevel: DraftAccessLevel = override?.access_level ?? 'inherit';
      let effective = getEffectivePermission(member.role, item.id, agencySettings, existing);

      if (!moduleEnabled) {
        accessLevel = 'none';
        effective = getEffectivePermission(member.role, item.id, agencySettings);
      } else if (preset === 'standard') {
        accessLevel = 'inherit';
        effective = inherited;
      } else if (preset === 'restricted') {
        const defaultLevel = getDefaultAccessLevel(member.role, item.id);
        const restrictedLevel: AccessLevel =
          item.id === 'dashboard' || item.id === 'documents/scan' || item.id === 'notifications'
            ? 'read'
            : item.sensitive
              ? 'none'
              : defaultLevel === 'none'
                ? 'none'
                : 'read';
        accessLevel = restrictedLevel;
        effective = getEffectivePermission(member.role, item.id, agencySettings, {
          [item.id]: {
            page: item.id,
            access_level: restrictedLevel,
            can_create: false,
            can_update: false,
            can_delete: false,
            can_export: restrictedLevel !== 'none',
            can_manage: false,
          },
        });
      } else if (preset === 'finance') {
        const financeLevel: AccessLevel =
          item.category === 'Finance & reporting'
            ? 'read'
            : item.id === 'dashboard' || item.id === 'documents' || item.id === 'documents/scan'
              ? 'read'
              : 'none';
        accessLevel = financeLevel;
        effective = getEffectivePermission(member.role, item.id, agencySettings, {
          [item.id]: {
            page: item.id,
            access_level: financeLevel,
            can_create: false,
            can_update: false,
            can_delete: false,
            can_export: financeLevel !== 'none',
            can_manage: false,
          },
        });
      }

      acc[item.id] = constrainPermissionActions({
        page: item.id,
        access_level: accessLevel,
        can_create: accessLevel === 'inherit' ? effective.can_create : effective.can_create,
        can_update: accessLevel === 'inherit' ? effective.can_update : effective.can_update,
        can_delete: accessLevel === 'inherit' ? effective.can_delete : effective.can_delete,
        can_export: accessLevel === 'inherit' ? effective.can_export : effective.can_export,
        can_manage: accessLevel === 'inherit' ? effective.can_manage : effective.can_manage,
      });
      return acc;
    }, {});
  }, [agencySettings, permissionsByUser]);

  const openPermissions = (member: Member) => {
    if (member.id === profile?.id || member.role === 'admin' || member.role === 'super_admin') {
      toast.warning('Ce profil administrateur est protégé.');
      return;
    }
    setPermissionDraft(buildPermissionDraft(member));
    setPermissionTarget(member);
  };

  const applyPreset = (preset: Exclude<AccessPreset, 'custom'>) => {
    if (!permissionTarget) return;
    setPermissionDraft(buildPermissionDraft(permissionTarget, preset));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const updateDraftAccess = (page: string, accessLevel: DraftAccessLevel) => {
    setPermissionDraft((prev) => {
      const current = prev[page];
      if (!current) return prev;
      if (accessLevel === 'inherit' && permissionTarget) {
        const inherited = getEffectivePermission(permissionTarget.role, page, agencySettings);
        const constrained = constrainPermissionActions({ ...inherited, page, access_level: 'inherit' });
        return {
          ...prev,
          [page]: {
            ...current,
            access_level: 'inherit',
            can_create: constrained.can_create,
            can_update: constrained.can_update,
            can_delete: constrained.can_delete,
            can_export: constrained.can_export,
            can_manage: constrained.can_manage,
          },
        };
      }
      const capabilities = getPageActionCapabilities(page);
      return {
        ...prev,
        [page]: {
          ...current,
          access_level: accessLevel,
          can_create: capabilities.includes('can_create') && (accessLevel === 'write' || accessLevel === 'admin'),
          can_update: capabilities.includes('can_update') && (accessLevel === 'write' || accessLevel === 'admin'),
          can_delete: capabilities.includes('can_delete') && accessLevel === 'admin',
          can_export: capabilities.includes('can_export') && accessLevel !== 'none',
          can_manage: capabilities.includes('can_manage') && accessLevel === 'admin',
        },
      };
    });
  };

  const toggleDraftAction = (page: string, key: keyof Pick<UserPagePermission, 'can_create' | 'can_update' | 'can_delete' | 'can_export' | 'can_manage'>) => {
    setPermissionDraft((prev) => {
      const current = prev[page];
      if (!current || current.access_level === 'none') return prev;
      if (!getPageActionCapabilities(page).includes(key)) return prev;
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
      const rows = Object.values(permissionDraft)
        .filter((permission) => permission.access_level !== 'inherit' && isModuleEnabled(permission.page, agencySettings))
        .map((permission) => {
          const constrained = constrainPermissionActions(permission);
          return {
            page: constrained.page,
            access_level: constrained.access_level as AccessLevel,
            can_create: constrained.access_level !== 'none' && constrained.can_create,
            can_update: constrained.access_level !== 'none' && constrained.can_update,
            can_delete: constrained.access_level !== 'none' && constrained.can_delete,
            can_export: constrained.access_level !== 'none' && constrained.can_export,
            can_manage: constrained.access_level === 'admin' && constrained.can_manage,
          };
        });
      const savedRows = await replaceMemberPermissions(permissionTarget.id, rows);

      setPermissionsByUser((prev) => ({
        ...prev,
        [permissionTarget.id]: permissionRowsToMap(savedRows),
      }));
      toast.success('Permissions mises à jour');
      setPermissionTarget(null);
      setExpandedCategories(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des permissions';
      toast.error(msg);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteStep !== 2) {
      // Une touche Entrée dans un champ du formulaire déclenche nativement
      // onSubmit, quelle que soit l'étape affichée : on avance d'une étape
      // au lieu de créer l'invitation sans passer par la confirmation.
      setInviteStep(2);
      return;
    }
    if (!profile?.agency_id) return;
    if (!formData.email.trim()) {
      toast.warning('Veuillez saisir un email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast.warning('Veuillez saisir un email valide');
      return;
    }
    if (!canInviteMore) {
      toast.warning('La limite utilisateur du plan est atteinte. Changez de plan avant d’inviter un nouveau collaborateur.');
      return;
    }
    setSubmitting(true);
    try {
      const invitation = await createTeamInvitation({
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        message: JSON.stringify({ access_preset: invitePreset, note: inviteNote.trim() || null }),
        daysValid: 7,
      });
      const link = `${window.location.origin}/?token=${invitation.token}`;
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
    setInvitePreset('standard');
    setInviteStep(1);
    setInviteNote('');
    setGeneratedLink(null);
    clearDirectRouteParams();
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    if (deactivateTarget.role === 'admin' || deactivateTarget.role === 'super_admin') {
      toast.warning('Un administrateur protégé ne peut pas être désactivé depuis cette action.');
      setDeactivateTarget(null);
      return;
    }
    setDeactivating(true);
    try {
      await deactivateTeamMember(
        deactivateTarget.id,
        "Désactivation manuelle depuis la console Équipe & accès",
      );
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
  const inviteEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
  const inviteFormId = 'team-invite-wizard-form';
  const inviteSteps = [
    {
      id: 'collaborator',
      label: 'Collaborateur & accès',
      shortLabel: 'Qui & accès',
      description: 'Email, rôle et preset',
      icon: <Mail className="h-3.5 w-3.5" />,
    },
    {
      id: 'confirm',
      label: 'Confirmation',
      shortLabel: 'Envoi',
      description: 'Sécurité et siège',
      icon: <Send className="h-3.5 w-3.5" />,
    },
  ];
  const inviteWizardRail = (
    <WizardRail
      eyebrow="Console équipe"
      title={generatedLink ? 'Invitation prête' : 'Nouvel accès'}
      description={generatedLink
        ? 'Copiez le lien sécurisé et transmettez-le au collaborateur.'
        : 'Définissez le rôle, le preset et la limite de siège avant l’envoi.'}
      steps={generatedLink ? [] : inviteSteps}
      currentStep={inviteStep - 1}
      badge={(
        <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[0.62rem] font-bold text-emerald-50">
          <UsersIcon className="h-3.5 w-3.5 text-amber-200" />
          Utilisateurs {userUsageLabel}
        </div>
      )}
      footer={(
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
          Les accès restent ajustables après acceptation et les modules désactivés restent verrouillés par RBAC.
        </span>
      )}
    />
  );

  if (loading && members.length === 0) {
    return <PageSkeleton title="Équipe & permissions" variant="table" />;
  }

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
        <section className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-950/12 bg-gradient-to-r from-white via-white to-emerald-50/40 px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#a45d12] shrink-0">
              COLLABORATEURS
            </span>
            <div className="flex items-baseline gap-2 min-w-0 truncate">
              <h1 className="font-extrabold text-sm sm:text-[0.92rem] text-slate-900 leading-none shrink-0">
                Équipe & accès
              </h1>
              <span className="hidden md:inline text-slate-300">·</span>
              <p className="hidden md:block text-xs text-slate-500 truncate">
                Collaborateurs, rôles, invitations et pages visibles.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
            <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-emerald-800">
              Utilisateurs {userUsageLabel}
            </span>
            {stats.pendingInvitations > 0 && (
              <span className="rounded-full bg-orange-50 border border-orange-200/60 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-orange-700">
                {stats.pendingInvitations} inv.
              </span>
            )}
            <PremiumButton
              variant="create"
              size="sm"
              disabled={!canInviteMore}
              onClick={() => setIsInviteOpen(true)}
              data-testid="button-invite-member-embedded"
              icon={<UserPlus className="h-3.5 w-3.5" />}
            >
              Inviter
            </PremiumButton>
          </div>
        </section>
      )}

      <PremiumKpiGrid variant="dashboard" maxItems={5} density="ultraCompact">
        <MetricCard density="ultraCompact" label="Membres actifs" value={stats.activeMembers} helper={`${stats.inactiveMembers} inactif(s)`} icon={UsersIcon} />
        <MetricCard density="ultraCompact" label="Invitations" value={stats.pendingInvitations} helper="En attente" icon={Mail} tone="warning" />
        <MetricCard density="ultraCompact" label="Accès restreints" value={stats.restrictedMembers} helper={`${stats.customMembers} personnalisé(s)`} icon={Lock} tone="success" />
        <MetricCard density="ultraCompact" label="RBAC" value="Actif" helper="Rôle + page" icon={ShieldCheck} tone="success" />
        <MetricCard density="ultraCompact" label="Plan" value={userUsageLabel} helper={planDefinition.name} icon={KeyRound} tone={canInviteMore ? 'financial' : 'warning'} />
      </PremiumKpiGrid>

      <section className={embedded ? 'overflow-hidden rounded-xl border border-emerald-950/10 bg-white/88 shadow-sm' : 'sk-premium-panel overflow-hidden'}>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-emerald-700">Console d’accès</p>
            <h2 className="text-[0.82rem] font-extrabold text-slate-950">{sectionMode === 'team' ? 'Collaborateurs' : 'Profils et overrides'}</h2>
            <p className="text-[0.68rem] text-slate-500">{filteredMembers.length} profil(s) visible(s) · {planSeatLabel}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
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
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2">
              <PremiumFilterSelect
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as typeof roleFilter)}
                placeholder="Tous les rôles"
                options={[
                  { value: 'all', label: 'Tous les rôles' },
                  { value: 'admin', label: 'Admins' },
                  { value: 'agent', label: 'Agents' },
                  { value: 'comptable', label: 'Comptables' },
                  { value: 'bailleur', label: 'Bailleurs' },
                ]}
                className="w-full sm:w-40"
              />
              <PremiumFilterSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                placeholder="Tous statuts"
                options={[
                  { value: 'all', label: 'Tous statuts' },
                  { value: 'active', label: 'Actifs' },
                  { value: 'inactive', label: 'Désactivés' },
                ]}
                className="w-full sm:w-36"
              />
            </div>
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
              const summary = getMemberPermissionSummary(member, permissions, agencySettings);
              const isSelf = member.id === profile.id;
              const isProtected = isSelf || member.role === 'admin' || member.role === 'super_admin';
              const displayName = getMemberDisplayName(member);
              return (
                <article key={member.id} className="grid gap-3 p-3 transition-colors duration-150 hover:bg-emerald-50/50 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-950/10 bg-gradient-to-br from-emerald-50 to-white text-[0.74rem] font-black text-emerald-900 shadow-sm">
                        {getInitials(member)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                          member.actif ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-slate-300'
                        }`}
                        title={member.actif ? 'Actif' : 'Désactivé'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[0.82rem] font-extrabold text-slate-950">{displayName}</h3>
                        {isSelf ? <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] text-white">Vous</span> : null}
                        <RoleBadge role={member.role} />
                        <PresetBadge preset={summary.preset} />
                      </div>
                      {member.email ? (
                        <a
                          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(member.email)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[0.68rem] font-semibold text-slate-600 underline-offset-2 transition hover:text-emerald-900 hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate">{member.email}</span>
                        </a>
                      ) : (
                        <p className="mt-0.5 text-[0.68rem] text-slate-400">Email non renseigné</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white/90 px-3 py-2 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[0.66rem] font-extrabold text-slate-800">
                        <span>Pages accessibles</span>
                        <span className="text-emerald-800">{summary.visible} page{summary.visible > 1 ? 's' : ''} visible{summary.visible > 1 ? 's' : ''}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(12, (summary.visible / ((summary.visible + summary.hidden) || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    {summary.overrides > 0 ? (
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.58rem] font-black text-amber-800">
                        +{summary.overrides} sur mesure
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[0.58rem] font-black text-emerald-800">
                        Par défaut
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 sm:flex-row lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openPermissions(member)}
                      disabled={isProtected}
                      title={isProtected ? 'Profil administrateur protégé' : 'Modifier les permissions par page'}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-900/15 bg-white px-3 text-[0.72rem] font-extrabold text-brand-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-50/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-700" />
                      {isProtected ? 'Protégé' : 'Permissions'}
                    </button>
                    {member.actif && member.id !== profile.id ? (
                      <button
                        type="button"
                        onClick={() => setDeactivateTarget(member)}
                        disabled={member.role === 'admin' || member.role === 'super_admin'}
                        title={member.role === 'admin' || member.role === 'super_admin' ? 'Un administrateur ne peut pas être désactivé depuis cette action.' : 'Désactiver le profil'}
                        data-testid={`button-deactivate-${member.id}`}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.7rem] font-extrabold text-slate-600 transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-3.5 w-3.5" />
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
        <div className="flex flex-col gap-1 border-b border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-orange-700">Invitations</p>
              <h2 className="text-[0.82rem] font-extrabold text-slate-950">En attente ({invitations.length})</h2>
            </div>
          </div>
          <p className="text-[0.66rem] font-semibold text-slate-500">Lien valable 7 jours · validation via invitation</p>
        </div>
        {invitations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-950/10 bg-emerald-50 text-emerald-800">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[0.78rem] font-extrabold text-slate-950">Aucune invitation en attente</p>
              <p className="mt-0.5 text-[0.66rem] font-semibold text-slate-500">
                Invitez un agent ou un comptable pour partager l’espace de travail.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              disabled={!canInviteMore}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-950/10 bg-white px-2.5 text-[0.68rem] font-extrabold text-brand-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Inviter un collaborateur
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((invitation) => {
              const link = `${window.location.origin}/?token=${invitation.token}`;
              const preset = getInvitationPreset(invitation);
              const sentAt = new Date(invitation.created_at).toLocaleDateString('fr-FR');
              return (
                <li key={invitation.id} className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 text-orange-700">
                      <CalendarClock className="h-3.5 w-3.5" />
                    </div>
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
                      Rôle : <span className="font-bold capitalize">{invitation.role}</span> · Envoyée le {sentAt} · Expire le {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <PresetBadge preset={preset} />
                      <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[0.54rem] font-black uppercase tracking-[0.08em] text-slate-500">En attente</span>
                    </div>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-row sm:justify-end">
                  <a
                    href={getInvitationEmailUrl(invitation, link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-950/10 bg-white px-2.5 text-[0.68rem] font-extrabold text-brand-800 shadow-sm transition hover:bg-emerald-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Email
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(link)}
                    data-testid={`button-copy-${invitation.id}`}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[0.68rem] font-extrabold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Renvoi non disponible avec les policies actuelles. Utilisez Email ou Copier."
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2.5 text-[0.68rem] font-extrabold text-slate-400"
                  >
                    Renvoyer
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await cancelTeamInvitation(invitation.id);
                        toast.success('Invitation annulée.');
                        loadData();
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Erreur lors de l'annulation de l'invitation.";
                        toast.error(msg);
                      }
                    }}
                    title="Annuler et supprimer cette invitation"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 text-[0.68rem] font-extrabold text-red-600 transition hover:bg-red-100 hover:border-red-200"
                  >
                    <X className="h-3.5 w-3.5" />
                    Annuler
                  </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {embedded && (sectionMode === 'permissions' || sectionMode === 'access') && (
        <section className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-emerald-50/80 via-white to-[#fff8ed] p-2.5 shadow-sm">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Permissions & pages visibles</p>
          <h2 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Repères d'accès, contrôle précis.</h2>
          <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-4 text-slate-600">
            Les rôles restent la base. Les profils personnalisés utilisent les droits existants par page, sans contourner le RBAC ni les modules désactivés.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
          <PermissionMatrixPreview settings={agencySettings} />
        </section>
      )}

      {sectionMode !== 'team' && (
        <section className="grid gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/92 p-2.5 shadow-sm lg:grid-cols-3">
          <div className="lg:col-span-3">
            <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-emerald-700">Sécurité d’accès</p>
            <h2 className="text-[0.82rem] font-extrabold text-slate-950">Garde-fous actifs</h2>
            <p className="text-[0.68rem] text-slate-500">
              Les rôles restent la base. Les overrides personnalisent sans contourner les modules désactivés.
            </p>
          </div>
          <SecurityGuardCard
            icon={ShieldCheck}
            title="Admin protégé"
            description="Le profil administrateur courant et les admins agence ne sont pas restreints depuis cette console."
          />
          <SecurityGuardCard
            icon={KeyRound}
            title="Dernier admin"
            description="La désactivation d’un administrateur est bloquée pour éviter de verrouiller l’agence."
          />
          <SecurityGuardCard
            icon={Lock}
            title="Modules désactivés"
            description={`${disabledModulesCount} page(s) suivent l'état Modules & navigation et restent verrouillées si le module est inactif.`}
          />
        </section>
      )}

      <WizardShell
        open={isInviteOpen}
        onClose={closeInviteModal}
        title={generatedLink ? 'Invitation prête' : 'Inviter un collaborateur'}
        eyebrow="ÉQUIPE & ACCÈS"
        description="Ajoutez un membre à l’agence et définissez son niveau d’accès avant l’envoi."
        mobileDescription="Invitation et accès."
        steps={generatedLink ? [] : inviteSteps}
        currentStep={inviteStep - 1}
        variant="workstation"
        tone="agency"
        size="compact"
        mobileMode="fullscreen"
        rail={inviteWizardRail}
        secondaryAction={
          <button
            type="button"
            onClick={generatedLink || inviteStep === 1 ? closeInviteModal : () => setInviteStep(1)}
            className={wizardSecondaryActionClass}
          >
            {generatedLink || inviteStep === 1 ? 'Fermer' : 'Retour'}
          </button>
        }
        primaryAction={generatedLink ? (
          <button
            type="button"
            onClick={() => copyLink(generatedLink)}
            data-testid="button-copy-generated"
            className={wizardPrimaryActionClass}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier le lien'}
          </button>
        ) : inviteStep < 2 ? (
          <button
            type="button"
            disabled={!canInviteMore || !inviteEmailIsValid}
            onClick={() => setInviteStep(2)}
            className={wizardPrimaryActionClass}
          >
            Continuer
          </button>
        ) : (
          <button
            type="submit"
            form={inviteFormId}
            disabled={submitting || !canInviteMore}
            data-testid="button-submit-invitation"
            className={wizardPrimaryActionClass}
          >
            {submitting ? 'Création...' : "Envoyer l'invitation"}
          </button>
        )}
      >
        {generatedLink ? (
          <div className="space-y-3">
            <p className="text-[0.76rem] leading-5 text-slate-700">
              Invitation créée. Envoyez ce lien à votre collaborateur pour qu'il rejoigne l'agence.
            </p>
            <div>
              <input aria-label="Champ de saisie"
                type="text"
                readOnly
                value={generatedLink}
                data-testid="input-invite-link"
                className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[0.74rem] font-semibold text-slate-700"
              />
            </div>
          </div>
        ) : (
          <form id={inviteFormId} onSubmit={handleInvite} className="space-y-2.5">
            {!canInviteMore ? (
              <p className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-[0.64rem] font-bold text-orange-800">
                Limite du plan atteinte. <a href="#/pricing" className="underline underline-offset-2">Changer de plan</a> avant d'ajouter un collaborateur.
              </p>
            ) : null}

            <div className={inviteStep === 1 ? 'space-y-2' : 'hidden'}>
              <label className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Email professionnel</label>
              <input aria-label="Champ de saisie"
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                data-testid="input-invite-email"
                placeholder="collaborateur@agence.sn"
                className="!h-8 !min-h-8 w-full rounded-lg border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 text-[0.76rem] font-semibold text-slate-900 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15"
              />
              {!inviteEmailIsValid && formData.email.trim() ? (
                <p className="mt-1 text-[0.6rem] font-bold text-red-600">Saisissez une adresse email professionnelle valide.</p>
              ) : null}
              <div>
                <label className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Message optionnel</label>
                <textarea
                  rows={3}
                  value={inviteNote}
                  onChange={(event) => setInviteNote(event.target.value.slice(0, 240))}
                  placeholder="Ex. Bienvenue dans l'espace Samay Këur de l'agence."
                  className="min-h-[4.75rem] w-full resize-none rounded-lg border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-2 text-[0.74rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/15"
                />
                <p className="mt-1 text-[0.58rem] font-semibold text-slate-400">Lien valable 7 jours. {240 - inviteNote.length} caractères restants.</p>
              </div>
            </div>
            <div className={inviteStep === 1 ? '' : 'hidden'}>
              <label className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Rôle et preset d’accès</label>
              <SmartCombobox
                density="compact"
                value={formData.role}
                options={[
                  { value: 'agent', label: 'Agent', subtitle: 'Biens, locations et documents autorisés' },
                  { value: 'comptable', label: 'Comptable', subtitle: 'Encaissements, reliquats et rapports' },
                  { value: 'admin', label: 'Administrateur', subtitle: 'Accès complet à l’agence' },
                ]}
                onChange={(val) => {
                  const nextRole = val as RoleOption;
                  setFormData({ ...formData, role: nextRole });
                  setInvitePreset(ROLE_DEFAULT_PRESET[nextRole] ?? 'standard');
                }}
                placeholder="Sélectionner un rôle"
              />
            </div>
            <div className={inviteStep === 1 ? '' : 'hidden'}>
              <p className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-500">Preset d’accès prévu</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(['standard', 'restricted', 'finance', 'custom'] as AccessPreset[]).map((preset) => {
                  const active = invitePreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInvitePreset(preset)}
                      className={[
                        'rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20',
                        active
                          ? 'border-emerald-900 bg-emerald-950 text-white shadow-sm'
                          : 'border-emerald-950/10 bg-white text-slate-700 hover:bg-emerald-50',
                      ].join(' ')}
                    >
                      <span className="block text-[0.64rem] font-black">{ACCESS_PRESETS[preset].label}</span>
                      <span className={active ? 'mt-0.5 block text-[0.54rem] font-semibold leading-3 text-emerald-50/80' : 'mt-0.5 block text-[0.54rem] font-semibold leading-3 text-slate-500'}>
                        {ACCESS_PRESETS[preset].summary}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {inviteStep === 1 ? (() => {
              const guide = INVITE_ROLE_GUIDE[formData.role];
              return (
                <div className={`flex items-start gap-2 rounded-xl border p-2.5 ${guide.tone}`}>
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-extrabold">{ROLE_LABELS[formData.role]}</p>
                    <p className="mt-0.5 text-[0.62rem] font-semibold leading-3 opacity-80">{guide.summary}</p>
                  </div>
                </div>
              );
            })() : null}
            {inviteStep === 2 ? (
              <div className="rounded-xl border border-emerald-950/10 bg-white p-3 shadow-sm">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-emerald-700">Confirmation</p>
                <h3 className="mt-0.5 text-[0.86rem] font-black text-slate-950">Vérifier avant envoi</h3>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
                  <MiniStat label="Email" value={formData.email.trim() || 'À renseigner'} />
                  <MiniStat label="Rôle" value={ROLE_LABELS[formData.role]} />
                  <MiniStat label="Preset" value={ACCESS_PRESETS[invitePreset].label} />
                  <MiniStat label="Sièges" value={userUsageLabel} />
                </div>
                <div className="mt-2 grid gap-1.5 rounded-lg bg-emerald-50/70 p-1.5 sm:grid-cols-4">
                  <MiniStat label="Visibles" value={invitePreview.visible} />
                  <MiniStat label="Masquées" value={invitePreview.hidden} />
                  <MiniStat label="Actions" value={invitePreview.actions} />
                  <MiniStat label="Modules off" value={invitePreview.disabled} />
                </div>
                <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[0.62rem] font-semibold leading-4 text-slate-600">
                  Les accès restent protégés par le rôle, les permissions par page et les modules activés. Ils pourront être ajustés après acceptation.
                </p>
              </div>
            ) : null}
          </form>
        )}
      </WizardShell>

      <WizardShell
        open={!!permissionTarget}
        onClose={() => {
          setPermissionTarget(null);
          setExpandedCategories(new Set());
          clearDirectRouteParams();
        }}
        size="compact"
        variant="workstation"
        tone="agency"
        eyebrow="SAMAY KËUR"
        title={permissionTarget ? `Permissions · ${permissionTarget.prenom ?? ''} ${permissionTarget.nom ?? ''}` : 'Permissions'}
        description={permissionTarget ? `Base actuelle : ${ROLE_LABELS[permissionTarget.role] ?? permissionTarget.role}` : ''}
        contentDescription="Ajustez les permissions pour chaque module de l'application."
        rail={
          <WizardRail
            eyebrow="Console d'accès"
            title="Permissions"
            description="Cliquez une catégorie pour l'ouvrir."
          >
            {permissionTarget && (
              <div className="space-y-2">
                {Object.keys(groupedCatalog).map((cat) => {
                  const isOpen = expandedCategories.has(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                        isOpen
                          ? 'border-amber-100/16 bg-white/[0.06] text-white'
                          : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78] hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <KeyRound className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="truncate text-[0.66rem] font-semibold">{cat}</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  );
                })}
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.055] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.54rem] font-black uppercase tracking-[0.14em] text-emerald-100/70">Profil ciblé</p>
                    <p className="truncate text-[0.65rem] font-black text-white">{permissionTarget.prenom} {permissionTarget.nom}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-white/5 px-2 py-1.5 border border-white/5">
                      <div className="text-[1.1rem] font-black text-white leading-none">{permissionDraftPreview.visible}</div>
                      <div className="text-[0.55rem] font-black uppercase tracking-wider text-emerald-100/50 mt-0.5">Visibles</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-2 py-1.5 border border-white/5">
                      <div className="text-[1.1rem] font-black text-white leading-none">{permissionDraftPreview.hidden}</div>
                      <div className="text-[0.55rem] font-black uppercase tracking-wider text-emerald-100/50 mt-0.5">Masquées</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-2 py-1.5 border border-white/5">
                      <div className="text-[1.1rem] font-black text-white leading-none">{permissionDraftPreview.actions}</div>
                      <div className="text-[0.55rem] font-black uppercase tracking-wider text-emerald-100/50 mt-0.5">Actions</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-2 py-1.5 border border-white/5">
                      <div className="text-[1.1rem] font-black text-white leading-none">{permissionDraftPreview.disabled}</div>
                      <div className="text-[0.55rem] font-black uppercase tracking-wider text-emerald-100/50 mt-0.5">Désactivés</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </WizardRail>
        }
        primaryAction={
          <button
            type="button"
            onClick={() => void savePermissions()}
            disabled={savingPermissions}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-[0_14px_28px_rgba(6,45,35,0.22)] focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {savingPermissions ? 'Sauvegarde...' : 'Enregistrer les accès'}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => {
              setPermissionTarget(null);
              setExpandedCategories(new Set());
              clearDirectRouteParams();
            }}
            disabled={savingPermissions}
            className="w-full rounded-xl border border-emerald-950/10 bg-white/85 px-4 py-2 text-[11px] font-semibold text-slate-600 shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] disabled:opacity-50 sm:w-auto"
          >
            Fermer
          </button>
        }
      >
        {permissionTarget ? (
          <div className="space-y-4">
            <div className="space-y-5 lg:space-y-6">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-950/5 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
                <div className="absolute -right-4 -top-4 opacity-[0.03] text-brand-900 pointer-events-none">
                  <ShieldCheck className="h-32 w-32" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-800 text-white shadow-sm">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-brand-800">Configuration Globale</p>
                  </div>
                  <p className="mt-2 text-[0.78rem] font-semibold text-slate-700 leading-relaxed max-w-xl">
                    Rôle de base : <span className="font-black text-slate-950">{ROLE_LABELS[permissionTarget.role] ?? permissionTarget.role}</span>.
                    <br/>
                    Les lignes “Rôle par défaut” suivent automatiquement ce rôle. Appliquez un profil type pour tout configurer rapidement, ou dépliez une catégorie ci-dessous pour affiner module par module.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-slate-500 mb-3 px-1">Profils Types</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['standard', 'restricted', 'finance', 'custom'] as AccessPreset[]).map((preset) => {
                    const isCustom = preset === 'custom';
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => isCustom ? setPermissionDraft(buildPermissionDraft(permissionTarget)) : applyPreset(preset as Exclude<AccessPreset, 'custom'>)}
                        className={`group relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${isCustom ? 'border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-300 hover:shadow-md' : 'border-emerald-950/5 bg-white hover:border-brand-200 hover:shadow-md'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`block text-[0.82rem] font-extrabold ${isCustom ? 'text-amber-900' : 'text-slate-950 group-hover:text-brand-800'}`}>
                            {ACCESS_PRESETS[preset].label}
                          </span>
                          {isCustom ? <Sparkles className="h-4 w-4 text-amber-500" /> : <Shield className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />}
                        </div>
                        <span className="block text-[0.7rem] font-semibold leading-snug text-slate-500 group-hover:text-slate-600">
                          {ACCESS_PRESETS[preset].summary}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {Object.keys(groupedCatalog).map((cat) => {
                const isOpen = expandedCategories.has(cat);
                return (
                  <div key={cat} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50/80"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                          <KeyRound className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="truncate text-[0.75rem] font-bold uppercase tracking-[0.15em] text-slate-800">{cat}</h3>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.58rem] font-bold text-slate-500">
                          {groupedCatalog[cat].length}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-slate-100 p-4">
                        {groupedCatalog[cat].map((item) => {
                          const draft = permissionDraft[item.id];
                          const moduleEnabled = isModuleEnabled(item.id, agencySettings);
                          const inherited = moduleEnabled ? getDefaultAccessLevel(permissionTarget.role, item.id) : 'none';
                          if (!draft) return null;
                          const actionsDisabled = draft.access_level === 'none' || !moduleEnabled;
                          const actionCapabilities = getPageActionCapabilities(item.id);
                          return (
                            <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-[0.82rem] font-black text-slate-950 group-hover:text-brand-800 transition-colors">{item.label}</h4>
                                    {item.sensitive ? (
                                      <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wide text-orange-700 ring-1 ring-inset ring-orange-600/10">
                                        sensible
                                      </span>
                                    ) : null}
                                    {!moduleEnabled ? (
                                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-400/20">
                                        module inactif
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[0.68rem] leading-snug text-slate-500">{item.description}</p>
                                  <p className="mt-1.5 text-[0.62rem] font-bold text-slate-400">Défaut rôle : <span className="text-slate-500">{ACCESS_LABELS[inherited]}</span></p>
                                </div>
                                <div className="w-full xl:w-52 shrink-0">
                                  <SmartCombobox
                                    density="dense"
                                    disabled={!moduleEnabled}
                                    value={draft.access_level}
                                    options={[
                                      { value: 'inherit', label: 'Rôle par défaut' },
                                      { value: 'none', label: 'Masquer' },
                                      { value: 'read', label: 'Lecture seule' },
                                      { value: 'write', label: 'Édition' },
                                      { value: 'admin', label: 'Admin module' },
                                    ]}
                                    onChange={(val) => updateDraftAccess(item.id, val as DraftAccessLevel)}
                                    placeholder="Niveau d'accès"
                                  />
                                </div>
                              </div>

                              <div className="mt-3.5 pt-3.5 border-t border-slate-100/80">
                                {actionCapabilities.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {ACTIONS.filter(({ key }) => actionCapabilities.includes(key)).map(({ key, label, icon: Icon }) => (
                                      <button
                                        key={key}
                                        type="button"
                                        disabled={actionsDisabled}
                                        onClick={() => toggleDraftAction(item.id, key)}
                                        className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[0.64rem] font-bold transition-all ${
                                          draft[key]
                                            ? 'border-brand-200 bg-emerald-50 text-brand-800 shadow-sm ring-1 ring-inset ring-brand-900/5'
                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
                                        } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white`}
                                      >
                                        <Icon className="h-3.5 w-3.5" />
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[0.62rem] font-semibold text-slate-500 border border-slate-100">
                                    <Lock className="h-3 w-3 opacity-60" />
                                    Consultation uniquement. Aucune action fine disponible.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </WizardShell>

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

function PermissionMatrixPreview({ settings }: { settings?: Partial<AgencySettings> | null }) {
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
        {rows.map((row) => {
          const moduleEnabled = isModuleEnabled(row.page, settings);
          return (
            <div key={row.page} className="grid grid-cols-[minmax(8rem,1fr)_repeat(3,minmax(4rem,0.55fr))] items-center gap-2 px-2.5 py-2 transition-colors hover:bg-emerald-50/45">
              <span className="min-w-0 truncate text-[0.72rem] font-extrabold text-slate-800">
                {row.label}
                {!moduleEnabled ? (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.48rem] font-black uppercase tracking-[0.06em] text-slate-500">
                    Désactivé
                  </span>
                ) : null}
              </span>
              {roles.map((role) => (
                <AccessBadge
                  key={role.key}
                  level={moduleEnabled ? getDefaultAccessLevel(role.key, row.page) : 'none'}
                  disabled={!moduleEnabled}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccessBadge({ level, disabled = false }: { level: AccessLevel; disabled?: boolean }) {
  if (disabled || level === 'none') {
    return (
      <span
        title={disabled ? 'Module désactivé' : 'Accès masqué pour ce rôle'}
        className="justify-self-center inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.56rem] font-semibold text-slate-300 transition-opacity hover:text-slate-500"
      >
        —
      </span>
    );
  }

  const label = level === 'admin' ? 'Admin' : level === 'write' ? 'Écriture' : 'Lecture';
  const className =
    level === 'admin'
      ? 'border border-emerald-900 bg-emerald-950 text-white shadow-xs'
      : level === 'write'
        ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-800 font-extrabold'
        : 'border border-sky-200/80 bg-sky-50 text-sky-800 font-extrabold';

  return (
    <span className={`justify-self-center rounded-full px-2 py-0.5 text-[0.54rem] uppercase tracking-[0.08em] ${className}`}>
      {label}
    </span>
  );
}

function SecurityGuardCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-emerald-950/10 bg-white/86 p-2 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.72rem] font-extrabold text-slate-950">{title}</p>
          <p className="mt-0.5 text-[0.62rem] font-semibold leading-4 text-slate-500">{description}</p>
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

function PresetBadge({ preset }: { preset: AccessPreset }) {
  const config = ACCESS_PRESETS[preset] ?? ACCESS_PRESETS.custom;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] ${config.tone}`}>
      {config.label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-white px-1.5 py-1">
      <p className="text-[0.78rem] font-extrabold text-slate-950">{value}</p>
      <p className="text-[0.56rem] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function getMemberPermissionSummary(
  member: Member,
  permissions: UserPermissionMap,
  settings?: Partial<AgencySettings> | null
) {
  const values = Object.values(permissions);
  const overrides = values.length;
  const effectivePermissions = PERMISSION_CATALOG.map((item) =>
    getEffectivePermission(member.role, item.id, settings, permissions)
  );
  const hidden = effectivePermissions.filter((permission) => permission.access_level === 'none').length;
  const readOnly = effectivePermissions.filter((permission) => permission.access_level === 'read').length;
  const visible = effectivePermissions.length - hidden;
  const preset: AccessPreset =
    overrides > 0
      ? hidden > 0 || readOnly > 0
        ? 'restricted'
        : 'custom'
      : ROLE_DEFAULT_PRESET[member.role as RoleOption] ?? 'standard';
  return {
    hidden,
    readOnly,
    visible,
    overrides,
    preset,
  };
}

function getPresetPreview(role: RoleOption, preset: AccessPreset, settings?: Partial<AgencySettings> | null) {
  let visible = 0;
  let hidden = 0;
  let actions = 0;
  let disabled = 0;

  for (const item of PERMISSION_CATALOG) {
    const moduleEnabled = isModuleEnabled(item.id, settings);
    if (!moduleEnabled) {
      hidden += 1;
      disabled += 1;
      continue;
    }

    let level: AccessLevel = getDefaultAccessLevel(role, item.id);
    if (preset === 'restricted') {
      level = item.id === 'dashboard' || item.id === 'documents/scan' || item.id === 'notifications'
        ? 'read'
        : item.sensitive
          ? 'none'
          : level === 'none'
            ? 'none'
            : 'read';
    } else if (preset === 'finance') {
      level = item.category === 'Finance & reporting' || item.id === 'dashboard' || item.id === 'documents' || item.id === 'documents/scan'
        ? 'read'
        : 'none';
    } else if (preset === 'custom') {
      level = getDefaultAccessLevel(role, item.id);
    }

    if (level === 'none') {
      hidden += 1;
      continue;
    }

    visible += 1;
    actions += level === 'admin' ? 5 : level === 'write' ? 4 : 1;
  }

  return { visible, hidden, actions, disabled };
}

function getDraftPreview(draft: PermissionDraft, settings?: Partial<AgencySettings> | null) {
  let visible = 0;
  let hidden = 0;
  let actions = 0;
  let disabled = 0;

  for (const item of PERMISSION_CATALOG) {
    const permission = draft[item.id];
    const moduleEnabled = isModuleEnabled(item.id, settings);
    if (!moduleEnabled) {
      disabled += 1;
      hidden += 1;
      continue;
    }
    if (!permission || permission.access_level === 'none') {
      hidden += 1;
      continue;
    }
    visible += 1;
    actions += Number(permission.can_create)
      + Number(permission.can_update)
      + Number(permission.can_delete)
      + Number(permission.can_export)
      + Number(permission.can_manage);
  }

  return { visible, hidden, actions, disabled };
}

function getInvitationPreset(invitation: Invitation): AccessPreset {
  if (invitation.message) {
    try {
      const parsed = JSON.parse(invitation.message) as { access_preset?: AccessPreset };
      if (parsed.access_preset && parsed.access_preset in ACCESS_PRESETS) {
        return parsed.access_preset;
      }
    } catch {
      /* legacy free-text invitation message */
    }
  }
  return ROLE_DEFAULT_PRESET[invitation.role as RoleOption] ?? 'standard';
}

function getMemberDisplayName(member: Member) {
  const fullName = `${member.prenom ?? ''} ${member.nom ?? ''}`.trim();
  if (fullName) return fullName;
  return member.email?.split('@')[0] ?? 'Collaborateur';
}

function getInitials(member: Member) {
  const displayName = getMemberDisplayName(member);
  const parts = displayName.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`
    : displayName.slice(0, 2);
  return initials.toUpperCase();
}

function getInvitationEmailUrl(invitation: Invitation, link: string) {
  const subject = encodeURIComponent('Invitation Samay Këur');
  const body = encodeURIComponent(
    [
      'Bonjour,',
      '',
      `Vous avez été invité à rejoindre Samay Këur avec le rôle ${ROLE_LABELS[invitation.role] ?? invitation.role}.`,
      `Lien d'invitation : ${link}`,
      '',
      "Ce lien expire automatiquement. Les accès pourront être ajustés par l'administrateur de l'agence.",
    ].join('\n')
  );
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}&su=${subject}&body=${body}`;
}
