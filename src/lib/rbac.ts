import type { AgencySettings } from '../types/agency';
import type { UserRole } from './supabase';

type ModuleSettings = Pick<
  AgencySettings,
  'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
>;

export type AccessLevel = 'none' | 'read' | 'write' | 'admin';
export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'manage';

export interface UserPagePermission {
  page: string;
  access_level: AccessLevel;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage: boolean;
}

export type UserPermissionMap = Record<string, UserPagePermission>;

export interface PermissionCatalogItem {
  id: string;
  label: string;
  description: string;
  category: string;
  sensitive?: boolean;
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { id: 'dashboard', label: 'Vue d’ensemble', description: 'Synthèse opérationnelle, KPIs et activité récente.', category: 'Pilotage' },
  { id: 'tableau-de-bord-financier', label: 'Rapports', description: 'Rapports bailleurs, finance et exports.', category: 'Finance & reporting', sensitive: true },
  { id: 'bailleurs', label: 'Bailleurs', description: 'Propriétaires, coordonnées et mandats.', category: 'Portefeuille locatif' },
  { id: 'immeubles', label: 'Immeubles', description: 'Immeubles, adresses et regroupements.', category: 'Portefeuille locatif' },
  { id: 'unites', label: 'Unités', description: 'Lots, loyers, disponibilités et états.', category: 'Portefeuille locatif' },
  { id: 'locataires', label: 'Locataires', description: 'Fiches locataires, contacts et historique.', category: 'Portefeuille locatif' },
  { id: 'contrats', label: 'Contrats & baux', description: 'Création, modification et suivi des baux.', category: 'Portefeuille locatif', sensitive: true },
  { id: 'paiements', label: 'Encaissements', description: 'Paiements reçus, reçus et actions financières.', category: 'Finance & reporting', sensitive: true },
  { id: 'loyers-impayes', label: 'Loyers impayés', description: 'Suivi des reliquats et relances.', category: 'Finance & reporting', sensitive: true },
  { id: 'depenses', label: 'Dépenses', description: 'Charges, dépenses et justificatifs.', category: 'Finance & reporting', sensitive: true },
  { id: 'commissions', label: 'Commissions', description: 'Ventilation agence/bailleur et commissions.', category: 'Finance & reporting', sensitive: true },
  { id: 'documents', label: 'Documents', description: 'Contrats, quittances, rapports et exports.', category: 'Opérations terrain' },
  { id: 'notifications', label: 'Notifications', description: 'Alertes, emails, SMS et centre de messages.', category: 'Transversal' },
  { id: 'calendrier', label: 'Calendrier', description: 'Échéances, rendez-vous et tâches planifiées.', category: 'Opérations' },
  { id: 'interventions', label: 'Maintenance', description: 'Interventions, incidents et suivi terrain.', category: 'Opérations' },
  { id: 'inventaires', label: 'États des lieux', description: 'Inventaires d’entrée/sortie et pièces jointes.', category: 'Opérations' },
  { id: 'audit', label: 'Audit', description: 'Traçabilité, journaux et contrôles internes.', category: 'Administration', sensitive: true },
  { id: 'parametres', label: 'Paramètres', description: 'Identité agence, modules et configuration.', category: 'Administration', sensitive: true },
  { id: 'equipe', label: 'Équipe', description: 'Invitations, rôles et permissions utilisateur.', category: 'Administration', sensitive: true },
  { id: 'abonnement', label: 'Abonnement', description: 'Plan, facturation SaaS et limites.', category: 'Administration', sensitive: true },
  { id: 'pricing', label: 'Tarifs', description: 'Plans et comparaison des offres.', category: 'Administration' },
];

const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard: ['admin', 'agent', 'comptable', 'bailleur'],
  agences: ['super_admin'],
  bailleurs: ['admin'],
  immeubles: ['admin'],
  unites: ['admin'],
  locataires: ['admin', 'agent', 'comptable'],
  contrats: ['admin', 'agent', 'comptable', 'bailleur'],
  paiements: ['admin', 'agent', 'comptable', 'bailleur'],
  'loyers-impayes': ['admin', 'agent', 'comptable', 'bailleur'],
  depenses: ['admin'],
  commissions: ['admin'],
  'tableau-de-bord-financier': ['admin'],
  'filtres-avances': ['admin'],
  parametres: ['admin'],
  equipe: ['admin'],
  abonnement: ['admin'],
  notifications: ['admin', 'agent', 'comptable', 'bailleur'],
  inventaires: ['admin', 'agent'],
  interventions: ['admin', 'agent'],
  calendrier: ['admin', 'agent'],
  documents: ['admin', 'agent'],
  audit: ['admin'],
  pricing: ['admin', 'agent', 'comptable', 'bailleur'],
};

const LEVEL_WEIGHT: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

export function permissionRowsToMap(rows?: Array<Partial<UserPagePermission>> | null): UserPermissionMap {
  if (!rows) return {};
  return rows.reduce<UserPermissionMap>((acc, row) => {
    if (!row.page || !row.access_level) return acc;
    acc[row.page] = {
      page: row.page,
      access_level: row.access_level as AccessLevel,
      can_create: Boolean(row.can_create),
      can_update: Boolean(row.can_update),
      can_delete: Boolean(row.can_delete),
      can_export: Boolean(row.can_export),
      can_manage: Boolean(row.can_manage),
    };
    return acc;
  }, {});
}

export function isModuleEnabled(page: string, settings?: Partial<ModuleSettings> | null) {
  if (!settings) return true;
  if (page === 'depenses') return settings.module_depenses_actif !== false;
  if (page === 'inventaires') return settings.module_inventaires_actif !== false;
  if (page === 'interventions') return settings.module_interventions_actif !== false;
  return true;
}

export function getDefaultAccessLevel(role: UserRole | null | undefined, page: string): AccessLevel {
  if (!role) return 'none';
  if (role === 'super_admin') return 'admin';
  const roles = PAGE_ROLES[page] ?? PAGE_ROLES.dashboard;
  if (!roles.includes(role)) return 'none';
  if (role === 'admin') return 'admin';
  if (role === 'agent') return ['dashboard', 'locataires', 'contrats', 'paiements', 'loyers-impayes', 'inventaires', 'interventions', 'calendrier', 'documents', 'notifications', 'pricing'].includes(page) ? 'write' : 'read';
  if (role === 'comptable') return ['paiements', 'loyers-impayes', 'contrats', 'locataires', 'notifications', 'pricing'].includes(page) ? 'read' : 'none';
  if (role === 'bailleur') return ['dashboard', 'contrats', 'paiements', 'loyers-impayes', 'notifications', 'pricing'].includes(page) ? 'read' : 'none';
  return 'none';
}

export function getEffectivePermission(
  role: UserRole | null | undefined,
  page: string,
  settings?: Partial<ModuleSettings> | null,
  userPermissions?: UserPermissionMap | null
): UserPagePermission {
  if (!role || !isModuleEnabled(page, settings)) {
    return emptyPermission(page);
  }

  if (role === 'super_admin') {
    return fullPermission(page);
  }

  const override = userPermissions?.[page];
  const accessLevel = override?.access_level ?? getDefaultAccessLevel(role, page);

  if (accessLevel === 'none') {
    return emptyPermission(page);
  }

  const baseline: UserPagePermission = {
    page,
    access_level: accessLevel,
    can_create: accessLevel === 'write' || accessLevel === 'admin',
    can_update: accessLevel === 'write' || accessLevel === 'admin',
    can_delete: accessLevel === 'admin',
    can_export: true,
    can_manage: accessLevel === 'admin',
  };

  if (!override) return baseline;

  return {
    page,
    access_level: accessLevel,
    can_create: override.can_create,
    can_update: override.can_update,
    can_delete: override.can_delete,
    can_export: override.can_export,
    can_manage: accessLevel === 'admin' && override.can_manage,
  };
}

export function canAccessPage(
  role: UserRole | null | undefined,
  page: string,
  settings?: Partial<ModuleSettings> | null,
  userPermissions?: UserPermissionMap | null
) {
  return getEffectivePermission(role, page, settings, userPermissions).access_level !== 'none';
}

export function canPerformAction(
  role: UserRole | null | undefined,
  page: string,
  action: PermissionAction,
  settings?: Partial<ModuleSettings> | null,
  userPermissions?: UserPermissionMap | null
) {
  const permission = getEffectivePermission(role, page, settings, userPermissions);
  if (action === 'view') return permission.access_level !== 'none';
  if (permission.access_level === 'none') return false;
  if (permission.access_level === 'admin') return true;
  if (action === 'create') return permission.can_create;
  if (action === 'update') return permission.can_update;
  if (action === 'delete') return permission.can_delete;
  if (action === 'export') return permission.can_export;
  if (action === 'manage') return permission.can_manage;
  return false;
}

export function hasMinimumAccess(
  role: UserRole | null | undefined,
  page: string,
  minimum: AccessLevel,
  settings?: Partial<ModuleSettings> | null,
  userPermissions?: UserPermissionMap | null
) {
  const permission = getEffectivePermission(role, page, settings, userPermissions);
  return LEVEL_WEIGHT[permission.access_level] >= LEVEL_WEIGHT[minimum];
}

export function getPageAccessReason(
  page: string,
  settings?: Partial<ModuleSettings> | null,
  userPermissions?: UserPermissionMap | null
) {
  if (!isModuleEnabled(page, settings)) {
    return 'Ce module est désactivé dans les paramètres de votre agence.';
  }
  if (userPermissions?.[page]?.access_level === 'none') {
    return 'Cette page a été masquée par un administrateur de votre agence.';
  }
  return "Votre rôle ou vos permissions ne permettent pas d'accéder à cette page.";
}

function emptyPermission(page: string): UserPagePermission {
  return {
    page,
    access_level: 'none',
    can_create: false,
    can_update: false,
    can_delete: false,
    can_export: false,
    can_manage: false,
  };
}

function fullPermission(page: string): UserPagePermission {
  return {
    page,
    access_level: 'admin',
    can_create: true,
    can_update: true,
    can_delete: true,
    can_export: true,
    can_manage: true,
  };
}
