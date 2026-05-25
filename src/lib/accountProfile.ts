import {
  getSemanticDictionary,
  getSemanticPageLabel,
  type SemanticLabels,
} from '../constants/dictionary';
import {
  ORGANIZATION_TO_LEGACY_TYPE,
  normalizeOrganizationType,
  type AccountFeatureFlags,
  type LegacyAccountType,
  type OrganizationType,
} from '../types/organization';
import { canAccessPage, getPageAccessReason, type UserPermissionMap } from './rbac';
import type { UserRole } from './supabase';
import type { AgencySettings } from '../types/agency';
import type { Agency } from '../types/database';

export type AccountType = LegacyAccountType;

export type AccountLabels = SemanticLabels;

export interface AccountProfile {
  type: AccountType;
  organizationType: OrganizationType;
  isIndividualOwner: boolean;
  labels: AccountLabels;
  features: AccountFeatureFlags;
  hiddenPages: string[];
  documentSignatureRole: string;
  blockedMandateMessage: string;
}

const PHASE_1_HIDDEN_PAGES = ['bailleurs', 'commissions', 'equipe', 'audit', 'mandats'];

export function deriveAccountProfile(
  agency?: Pick<Agency, 'is_bailleur_account' | 'organization_type'> | null
): AccountProfile {
  const organizationType = normalizeOrganizationType(agency?.organization_type, agency?.is_bailleur_account === true);
  const isIndividualOwner = organizationType === 'individual';
  const type: AccountType = ORGANIZATION_TO_LEGACY_TYPE[organizationType] ?? (isIndividualOwner ? 'bailleur_individuel' : 'agence');
  const dictionary = getSemanticDictionary(organizationType);

  return {
    type,
    organizationType,
    isIndividualOwner,
    labels: dictionary.labels,
    features: dictionary.features,
    hiddenPages: isIndividualOwner ? PHASE_1_HIDDEN_PAGES : dictionary.hiddenPages,
    documentSignatureRole: dictionary.documentSignatureRole,
    blockedMandateMessage: dictionary.blockedMandateMessage,
  };
}

export function getEffectiveRoleForAccount(
  role: UserRole | null | undefined,
  accountProfile: AccountProfile
): UserRole | null | undefined {
  if (accountProfile.isIndividualOwner && role === 'bailleur') {
    return 'admin';
  }
  return role;
}

export function isPageHiddenForAccount(page: string, accountProfile: AccountProfile): boolean {
  return accountProfile.hiddenPages.includes(page);
}

export function canAccessAccountPage(
  role: UserRole | null | undefined,
  page: string,
  accountProfile: AccountProfile,
  settings?: Partial<
    Pick<
      AgencySettings,
      'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
    >
  > | null,
  userPermissions?: UserPermissionMap | null
): boolean {
  if (isPageHiddenForAccount(page, accountProfile)) return false;
  return canAccessPage(getEffectiveRoleForAccount(role, accountProfile), page, settings, userPermissions);
}

export function getAccountPageAccessReason(
  page: string,
  accountProfile: AccountProfile,
  settings?: Partial<
    Pick<
      AgencySettings,
      'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
    >
  > | null,
  userPermissions?: UserPermissionMap | null
): string {
  if (isPageHiddenForAccount(page, accountProfile)) {
    return accountProfile.blockedMandateMessage || "Ce module n'est pas disponible pour ce type de compte.";
  }
  return getPageAccessReason(page, settings, userPermissions);
}

export function getAccountPageLabel(page: string, accountProfile: AccountProfile): string | null {
  return getSemanticPageLabel(page, accountProfile.organizationType);
}

export function getAccountGroupCopy(
  groupId: string,
  accountProfile: AccountProfile
): { label: string; description: string } | null {
  const groupCopy = getSemanticDictionary(accountProfile.organizationType).navigationGroups[groupId];
  return groupCopy ?? null;
}
