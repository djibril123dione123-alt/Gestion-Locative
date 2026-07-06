export type PlanId = 'starter' | 'pro' | 'business' | 'enterprise';

export interface PricingPlanDefinition {
  id: PlanId;
  name: string;
  audience: string;
  price_xof: number;
  priceLabel: string;
  billingLabel: string;
  positioning: string;
  outcome: string;
  accent: string;
  surface: string;
  highlighted?: boolean;
  badge?: string;
  limits: {
    max_users: number;
    max_immeubles: number;
    max_unites: number;
    storage_gb: number;
  };
  capacities: {
    users: string;
    immeubles: string;
    unites: string;
    storage: string;
  };
  features: string[];
  value: string[];
  infrastructure: string[];
  cta: string;
  ctaStyle: 'primary' | 'secondary' | 'outline' | 'contact';
}

export const CONTACT_WHATSAPP = '221769010960';
export const CONTACT_EMAIL = 'samaykeur@gmail.com';

export const PRICING_PLAN_DEFINITIONS: PricingPlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'Bailleur individuel',
    price_xof: 5000,
    priceLabel: '5 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour structurer un petit patrimoine sans Excel dispersé.',
    outcome: 'Vous gardez une vision claire des loyers, documents et échéances essentielles.',
    accent: '#475569',
    surface: '#F8FAFC',
    limits: {
      max_users: 1,
      max_immeubles: 3,
      max_unites: 10,
      storage_gb: 1,
    },
    capacities: {
      users: '1 utilisateur',
      immeubles: '3 immeubles',
      unites: '10 unités',
      storage: '1 Go sécurisé',
    },
    features: ['Pilotage simple des loyers', 'Documents locatifs professionnels', 'GED légère', 'Support email'],
    value: [
      'Pilotage simple des loyers',
      'Documents locatifs professionnels',
      'Suivi basique des impayés',
      'Archivage documentaire léger',
    ],
    infrastructure: ['GED de démarrage', 'Exports essentiels', 'Support email'],
    cta: 'Commencer en Starter',
    ctaStyle: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'Bailleur sérieux / petite gestion',
    price_xof: 15000,
    priceLabel: '15 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour professionnaliser les encaissements et rassurer les propriétaires.',
    outcome: 'Vous automatisez le suivi financier, les relances et les rapports propriétaires.',
    accent: '#F58220',
    surface: '#FFF7ED',
    highlighted: true,
    badge: 'Recommandé',
    limits: {
      max_users: 5,
      max_immeubles: 20,
      max_unites: 100,
      storage_gb: 20,
    },
    capacities: {
      users: '5 utilisateurs',
      immeubles: '20 immeubles',
      unites: '100 unités',
      storage: '20 Go sécurisés',
    },
    features: ['Tout Starter', 'Notifications bailleurs', 'Rapports PDF mensuels', 'Alertes impayés', 'Commissions', 'Support WhatsApp'],
    value: [
      'Suivi propriétaire automatisé',
      'Reporting financier avancé',
      'Paiements Wave, Orange Money et Djamo',
      'QR de vérification documentaire',
      'Gestion des reliquats et paiements partiels',
    ],
    infrastructure: ['GED structurée', 'Synchronisation offline-first', 'Support WhatsApp prioritaire'],
    cta: 'Activer Pro',
    ctaStyle: 'primary',
  },
  {
    id: 'business',
    name: 'Business',
    audience: 'Agence immobilière structurée',
    price_xof: 35000,
    priceLabel: '35 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour coordonner une équipe, sécuriser les workflows et piloter un portefeuille.',
    outcome: 'Votre agence gagne en contrôle : rôles, validations, audit trail et reporting consolidé.',
    accent: '#0F766E',
    surface: '#ECFDF5',
    badge: 'Agence',
    limits: {
      max_users: 15,
      max_immeubles: 100,
      max_unites: 500,
      storage_gb: 100,
    },
    capacities: {
      users: '15 utilisateurs',
      immeubles: '100 immeubles',
      unites: '500 unités',
      storage: '100 Go sécurisés',
    },
    features: ['Tout Pro', '15 utilisateurs', 'Rapports agents', 'Multi-portefeuilles', 'API webhooks', 'Support < 4h'],
    value: [
      'Rôles et permissions avancés',
      'Workflows équipe et coordination agence',
      'Historique et audit trail opérationnel',
      'Rapports bailleurs et finance consolidés',
      'Portefeuille multi-gestionnaires',
    ],
    infrastructure: ['GED agence complète', 'API webhooks', 'Support prioritaire < 4h'],
    cta: 'Passer en Business',
    ctaStyle: 'secondary',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Groupes, réseaux, multi-agences',
    price_xof: 0,
    priceLabel: 'Sur devis',
    billingLabel: 'capacité sur mesure',
    positioning: 'Pour déployer une infrastructure immobilière gouvernée, sécurisée et scalable.',
    outcome: 'Vous obtenez une plateforme adaptée à vos règles, vos équipes et votre gouvernance.',
    accent: '#14532D',
    surface: '#F0FDF4',
    limits: {
      max_users: -1,
      max_immeubles: -1,
      max_unites: -1,
      storage_gb: 100,
    },
    capacities: {
      users: 'Sur mesure',
      immeubles: 'Sur mesure',
      unites: 'Sur mesure',
      storage: 'Fair usage contractualisé',
    },
    features: ['Capacité sur mesure', 'White-label', 'SLA contractualisé', 'Account manager', 'Formation sur site'],
    value: [
      'Multi-agence et gouvernance réseau',
      'SLA, sécurité et conformité renforcés',
      'Déploiement personnalisé et formation',
      'White-label et intégrations métier',
      'Account manager dédié',
    ],
    infrastructure: ['Architecture dédiée selon volume', 'API complète', 'Support institutionnel'],
    cta: 'Demander un devis',
    ctaStyle: 'contact',
  },
];

export const PLAN_ORDER = PRICING_PLAN_DEFINITIONS.map((plan) => plan.id);

export function getPricingPlan(planId: string | null | undefined) {
  return PRICING_PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? PRICING_PLAN_DEFINITIONS[0];
}
