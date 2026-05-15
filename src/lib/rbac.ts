import type { AgencySettings } from '../types/agency';
import type { UserRole } from './supabase';

type ModuleSettings = Pick<
  AgencySettings,
  'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
>;

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

export function isModuleEnabled(page: string, settings?: Partial<ModuleSettings> | null) {
  if (!settings) return true;
  if (page === 'depenses') return settings.module_depenses_actif !== false;
  if (page === 'inventaires') return settings.module_inventaires_actif !== false;
  if (page === 'interventions') return settings.module_interventions_actif !== false;
  return true;
}

export function canAccessPage(
  role: UserRole | null | undefined,
  page: string,
  settings?: Partial<ModuleSettings> | null
) {
  if (!role) return false;
  if (role === 'super_admin') return true;
  const roles = PAGE_ROLES[page] ?? PAGE_ROLES.dashboard;
  return roles.includes(role) && isModuleEnabled(page, settings);
}

export function getPageAccessReason(page: string, settings?: Partial<ModuleSettings> | null) {
  if (!isModuleEnabled(page, settings)) {
    return 'Ce module est désactivé dans les paramètres de votre agence.';
  }
  return "Votre rôle ne permet pas d'accéder à cette page.";
}
