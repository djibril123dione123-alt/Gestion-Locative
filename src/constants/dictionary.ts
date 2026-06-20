import {
  ACCOUNT_FEATURES,
  DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION,
  type AccountFeatureFlags,
  type DocumentMode,
  type OrganizationType,
} from '../types/organization';

export interface SemanticLabels {
  workspace: string;
  workspaceSettings: string;
  owners: string;
  properties: string;
  units: string;
  tenants: string;
  payments: string;
  unpaidRents: string;
  commissions: string;
  reports: string;
  documents: string;
  team: string;
  audit: string;
  legalRepresentative: string;
  netOwner: string;
  revenue: string;
  charges: string;
}

export interface NavigationGroupCopy {
  label: string;
  description: string;
}

export interface SemanticDictionaryEntry {
  labels: SemanticLabels;
  navigationGroups: Record<string, NavigationGroupCopy>;
  hiddenPages: string[];
  defaultDocumentMode: DocumentMode;
  features: AccountFeatureFlags;
  documentSignatureRole: string;
  legalHeaderMention: string;
  blockedMandateMessage: string;
}

export const ADAPTIVE_DICTIONARY: Record<OrganizationType, SemanticDictionaryEntry> = {
  individual: {
    labels: {
      workspace: 'Espace propriétaire',
      workspaceSettings: 'Parametres du compte',
      owners: 'Mon profil proprietaire',
      properties: 'Mes biens',
      units: 'Mes unites',
      tenants: 'Mes locataires',
      payments: 'Mes loyers',
      unpaidRents: 'Mes impayes',
      commissions: 'Loyers percus',
      reports: 'Mes revenus',
      documents: 'Mes documents',
      team: 'Collaborateurs',
      audit: 'Journal',
      legalRepresentative: 'Proprietaire',
      netOwner: 'Revenus nets',
      revenue: 'Loyers encaisses',
      charges: 'Charges',
    },
    navigationGroups: {
      portefeuille: {
        label: 'Mes biens',
        description: 'Immeubles & propriétés',
      },
      finance: {
        label: 'Loyers & paiements',
        description: 'Encaissements & reliquats',
      },
      operations: {
        label: 'Suivi terrain',
        description: 'Planning, maintenance et documents',
      },
      administration: {
        label: 'Paramètres',
        description: 'Compte & préférences',
      },
    },
    hiddenPages: ['bailleurs', 'commissions', 'equipe', 'audit', 'mandats'],
    defaultDocumentMode: DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION.individual,
    features: ACCOUNT_FEATURES.individual,
    documentSignatureRole: 'Le proprietaire',
    legalHeaderMention: '',
    blockedMandateMessage:
      'Le mandat de gerance est reserve aux agences ou gestionnaires qui administrent des biens pour des tiers.',
  },
  freelance: {
    labels: {
      workspace: 'Cabinet',
      workspaceSettings: 'Parametres cabinet',
      owners: 'Proprietaires',
      properties: 'Portefeuille',
      units: 'Unites du portefeuille',
      tenants: 'Locataires',
      payments: 'Encaissements',
      unpaidRents: 'Impayes',
      commissions: 'Honoraires',
      reports: 'Rapports proprietaires',
      documents: 'Documents',
      team: 'Collaborateurs',
      audit: 'Journal',
      legalRepresentative: 'Gestionnaire',
      netOwner: 'Net proprietaire',
      revenue: 'Honoraires percus',
      charges: 'Depenses',
    },
    navigationGroups: {
      portefeuille: {
        label: 'Portefeuille',
        description: 'Proprietaire -> bien -> locataire -> mandat',
      },
      finance: {
        label: 'Gestion financiere',
        description: 'Encaissements, honoraires et rapports',
      },
      operations: {
        label: 'Operations',
        description: 'Documents, maintenance et terrain',
      },
      administration: {
        label: 'Cabinet',
        description: 'Parametres, collaborateurs et abonnement',
      },
    },
    hiddenPages: ['audit'],
    defaultDocumentMode: DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION.freelance,
    features: ACCOUNT_FEATURES.freelance,
    documentSignatureRole: 'Le gestionnaire',
    legalHeaderMention: 'Cabinet de gestion immobiliere',
    blockedMandateMessage: '',
  },
  agency: {
    labels: {
      workspace: 'Agence',
      workspaceSettings: 'Parametres agence',
      owners: 'Bailleurs',
      properties: 'Biens & patrimoine',
      units: 'Unites',
      tenants: 'Locataires',
      payments: 'Encaissements',
      unpaidRents: 'Créances à recouvrer',
      commissions: 'Commissions',
      reports: 'Rapports bailleurs',
      documents: 'Documents',
      team: 'Equipe & acces',
      audit: 'Journal & audit',
      legalRepresentative: 'Representant legal',
      netOwner: 'Net bailleur estime',
      revenue: 'Commissions acquises',
      charges: 'Depenses',
    },
    navigationGroups: {
      portefeuille: {
        label: 'Portefeuille locatif',
        description: 'Bailleur → bien → unité → location',
      },
      finance: {
        label: 'Encaissement & finance',
        description: 'Paiements, reliquats, charges, commissions',
      },
      operations: {
        label: 'Operations terrain',
        description: 'Planning, maintenance et etats des lieux',
      },
      administration: {
        label: 'Administration',
        description: 'Agence, equipe, abonnement et controle',
      },
    },
    hiddenPages: [],
    defaultDocumentMode: DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION.agency,
    features: ACCOUNT_FEATURES.agency,
    documentSignatureRole: 'Le mandataire',
    legalHeaderMention: 'Agence immobiliere',
    blockedMandateMessage: '',
  },
  group: {
    labels: {
      workspace: 'Groupe',
      workspaceSettings: 'Administration groupe',
      owners: 'Reseau proprietaires',
      properties: 'Parc multi-agences',
      units: 'Unites consolidees',
      tenants: 'Locataires',
      payments: 'Encaissements consolides',
      unpaidRents: 'Impayes consolides',
      commissions: 'Revenus consolides',
      reports: 'Reporting reseau',
      documents: 'Documents',
      team: 'Gouvernance',
      audit: 'Audit centralise',
      legalRepresentative: 'Direction generale',
      netOwner: 'Net consolide',
      revenue: 'CA consolide',
      charges: 'Depenses consolidees',
    },
    navigationGroups: {
      portefeuille: {
        label: 'Reseau',
        description: 'Agences, portefeuilles et gouvernance',
      },
      finance: {
        label: 'Finance consolidee',
        description: 'Revenus, impayes et reporting groupe',
      },
      operations: {
        label: 'Operations reseau',
        description: 'Supervision et qualite operationnelle',
      },
      administration: {
        label: 'Gouvernance',
        description: 'Roles, audit et administration centrale',
      },
    },
    hiddenPages: [],
    defaultDocumentMode: DEFAULT_DOCUMENT_MODE_BY_ORGANIZATION.group,
    features: ACCOUNT_FEATURES.group,
    documentSignatureRole: 'La direction',
    legalHeaderMention: 'Groupe immobilier',
    blockedMandateMessage: '',
  },
} as const;

export const PAGE_LABEL_KEYS: Record<string, keyof SemanticLabels | 'dashboard' | 'contracts' | 'subscription' | 'pricing' | 'notifications' | 'inventory' | 'maintenance' | 'calendar'> = {
  dashboard: 'dashboard',
  bailleurs: 'owners',
  patrimoine: 'properties',
  immeubles: 'properties',
  unites: 'units',
  locataires: 'tenants',
  contrats: 'contracts',
  paiements: 'payments',
  'loyers-impayes': 'unpaidRents',
  depenses: 'charges',
  commissions: 'commissions',
  'tableau-de-bord-financier': 'reports',
  'filtres-avances': 'reports',
  documents: 'documents',
  parametres: 'workspaceSettings',
  equipe: 'team',
  audit: 'audit',
  abonnement: 'subscription',
  pricing: 'pricing',
  notifications: 'notifications',
  inventaires: 'inventory',
  interventions: 'maintenance',
  calendrier: 'calendar',
};

export function getSemanticDictionary(type: OrganizationType): SemanticDictionaryEntry {
  return ADAPTIVE_DICTIONARY[type] ?? ADAPTIVE_DICTIONARY.agency;
}

export function getSemanticPageLabel(page: string, type: OrganizationType): string | null {
  const entry = getSemanticDictionary(type);
  const labelKey = PAGE_LABEL_KEYS[page];
  if (!labelKey) return null;
  if (labelKey === 'dashboard') return type === 'individual' ? 'Espace propriétaire' : 'Tableau de bord';
  if (labelKey === 'contracts') return 'Contrats';
  if (labelKey === 'subscription') return 'Abonnement';
  if (labelKey === 'pricing') return 'Tarifs';
  if (labelKey === 'notifications') return 'Notifications';
  if (labelKey === 'inventory') return 'Etats des lieux';
  if (labelKey === 'maintenance') return 'Maintenance';
  if (labelKey === 'calendar') return 'Calendrier';
  return entry.labels[labelKey] ?? null;
}
