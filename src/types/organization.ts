export const ORGANIZATION_TYPES = ['individual', 'freelance', 'agency', 'group'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export type DatabaseOrganizationType =
  | 'agency'
  | 'individual_landlord'
  | 'multi_property_landlord'
  | 'property_manager'
  | 'group'
  | OrganizationType;

export type LegacyAccountType = 'agence' | 'bailleur_individuel' | 'gestionnaire' | 'groupe';

export type DocumentMode = 'simple' | 'professional' | 'legal';

export interface AccountFeatureFlags {
  canUseLandlords: boolean;
  canUseMandates: boolean;
  canUseCommissions: boolean;
  canInviteTeam: boolean;
  canUseAuditTrail: boolean;
  canUseAdvancedReports: boolean;
  canUseLegalDocuments: boolean;
  canUseDocumentQr: boolean;
}

export const LEGACY_TO_ORGANIZATION_TYPE: Record<LegacyAccountType, OrganizationType> = {
  agence: 'agency',
  bailleur_individuel: 'individual',
  gestionnaire: 'freelance',
  groupe: 'group',
};

export const ORGANIZATION_TO_LEGACY_TYPE: Record<OrganizationType, LegacyAccountType> = {
  agency: 'agence',
  individual: 'bailleur_individuel',
  freelance: 'gestionnaire',
  group: 'groupe',
};

export const DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION: Record<OrganizationType, DocumentMode> = {
  individual: 'simple',
  freelance: 'professional',
  agency: 'legal',
  group: 'legal',
};

export const ACCOUNT_FEATURES: Record<OrganizationType, AccountFeatureFlags> = {
  individual: {
    canUseLandlords: false,
    canUseMandates: false,
    canUseCommissions: false,
    canInviteTeam: false,
    canUseAuditTrail: false,
    canUseAdvancedReports: false,
    canUseLegalDocuments: false,
    canUseDocumentQr: true,
  },
  freelance: {
    canUseLandlords: true,
    canUseMandates: true,
    canUseCommissions: true,
    canInviteTeam: true,
    canUseAuditTrail: false,
    canUseAdvancedReports: true,
    canUseLegalDocuments: true,
    canUseDocumentQr: true,
  },
  agency: {
    canUseLandlords: true,
    canUseMandates: true,
    canUseCommissions: true,
    canInviteTeam: true,
    canUseAuditTrail: true,
    canUseAdvancedReports: true,
    canUseLegalDocuments: true,
    canUseDocumentQr: true,
  },
  group: {
    canUseLandlords: true,
    canUseMandates: true,
    canUseCommissions: true,
    canInviteTeam: true,
    canUseAuditTrail: true,
    canUseAdvancedReports: true,
    canUseLegalDocuments: true,
    canUseDocumentQr: true,
  },
};

export function normalizeOrganizationType(
  value?: string | null,
  isBailleurAccount = false,
): OrganizationType {
  if (isBailleurAccount) return 'individual';

  switch (value) {
    case 'individual':
    case 'individual_landlord':
    case 'multi_property_landlord':
      return 'individual';
    case 'freelance':
    case 'property_manager':
      return 'freelance';
    case 'group':
      return 'group';
    case 'agency':
    default:
      return 'agency';
  }
}
