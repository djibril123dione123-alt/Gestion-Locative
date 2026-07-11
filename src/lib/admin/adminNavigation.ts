import {
  Activity,
  Building2,
  CreditCard,
  LifeBuoy,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type ConsoleSpace =
  | 'overview'
  | 'organizations'
  | 'billing'
  | 'users-access'
  | 'support-ops'
  | 'system-config';

export interface ConsoleNavItem {
  id: ConsoleSpace;
  label: string;
  shortLabel: string;
  route: string;
  description: string;
  icon: LucideIcon;
}

export const CONSOLE_NAV_ITEMS: ConsoleNavItem[] = [
  {
    id: 'overview',
    label: 'Pilotage',
    shortLabel: 'Pilotage',
    route: '#/console/overview',
    description: 'Décisions du jour, santé plateforme et risques prioritaires.',
    icon: Activity,
  },
  {
    id: 'organizations',
    label: 'Organisations',
    shortLabel: 'Organisations',
    route: '#/console/organizations',
    description: 'Agences, bailleurs individuels, statuts, plans et usage.',
    icon: Building2,
  },
  {
    id: 'billing',
    label: 'Abonnements',
    shortLabel: 'Billing',
    route: '#/console/billing',
    description: 'Plans, revenus estimés, quotas et paiements manuels.',
    icon: CreditCard,
  },
  {
    id: 'users-access',
    label: 'Utilisateurs & accès',
    shortLabel: 'Accès',
    route: '#/console/users-access',
    description: 'Rôles, comptes sensibles, rattachements tenant et accès.',
    icon: Users,
  },
  {
    id: 'support-ops',
    label: 'Support & opérations',
    shortLabel: 'Support',
    route: '#/console/support-ops',
    description: 'Demandes, tickets, annonces et incidents client.',
    icon: LifeBuoy,
  },
  {
    id: 'system-config',
    label: 'Système & configuration',
    shortLabel: 'Système',
    route: '#/console/system-config',
    description: 'Documents, QR, santé technique, feature flags, audit et configuration.',
    icon: Settings2,
  },
];

const LEGACY_ROUTE_MAP: Record<string, ConsoleSpace> = {
  dashboard: 'overview',
  console: 'overview',
  agences: 'organizations',
  organisations: 'organizations',
  abonnement: 'billing',
  abonnements: 'billing',
  pricing: 'billing',
  equipe: 'users-access',
  utilisateurs: 'users-access',
  demandes: 'support-ops',
  support: 'support-ops',
  notifications: 'support-ops',
  technique: 'system-config',
  technical: 'system-config',
  securite: 'system-config',
  sécurité: 'system-config',
  audit: 'system-config',
  documents: 'system-config',
  configuration: 'system-config',
  parametres: 'system-config',
};

export function getConsoleSpaceFromHash(hash: string): ConsoleSpace {
  const clean = hash.replace(/^#\/?/, '').replace(/^console\/?/, '');
  const firstSegment = clean.split(/[/?&]/)[0] || 'overview';
  if (CONSOLE_NAV_ITEMS.some((item) => item.id === firstSegment)) return firstSegment as ConsoleSpace;
  return LEGACY_ROUTE_MAP[firstSegment] ?? 'overview';
}

export function getConsoleRoute(space: ConsoleSpace) {
  return CONSOLE_NAV_ITEMS.find((item) => item.id === space)?.route ?? '#/console/overview';
}
