export type PlanId = 'starter' | 'pro' | 'business' | 'enterprise';

export interface PricingPlanDefinition {
  id: PlanId;
  name: string;
  internalName: string;
  audience: string;
  price_xof: number;
  priceLabel: string;
  /** Prix Offre Fondateurs (12 premiers cycles payants) — absent si le plan n'est pas concerné. */
  founderPriceXof?: number;
  founderPriceLabel?: string;
  billingLabel: string;
  positioning: string;
  outcome: string;
  bestFor: string;
  supportLabel: string;
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
export const CONTACT_EMAIL = 'contact@samaykeur.com';

/**
 * Source tarifaire publique canonique.
 * Les IDs, prix et limites correspondent aux identifiants persistés en base.
 * Les capacités métier communes ne sont pas dupliquées ici comme des droits de plan :
 * elles restent disponibles selon le rôle, les modules activés et le type de compte.
 */
export const PRICING_PLAN_DEFINITIONS: PricingPlanDefinition[] = [
  {
    id: 'starter',
    name: 'Essentiel',
    internalName: 'Starter',
    audience: 'Bailleur indépendant',
    price_xof: 5000,
    priceLabel: '5 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour centraliser un petit patrimoine et suivre les loyers sans fichiers dispersés.',
    outcome: 'Une gestion claire des biens, des échéances et des documents du quotidien.',
    bestFor: 'Un propriétaire qui gère seul jusqu’à 10 unités.',
    supportLabel: 'Support par email',
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
      storage: '1 Go',
    },
    features: [
      'Biens, unités, occupants et baux',
      'Suivi des loyers et des impayés',
      'Quittances et documents professionnels',
      'Dépenses, historique et tableau de bord',
      'Support par email',
    ],
    value: [
      'Centraliser les informations du patrimoine',
      'Savoir ce qui est payé ou en retard',
      'Retrouver les documents au même endroit',
    ],
    infrastructure: ['1 utilisateur', 'Jusqu’à 10 unités', '1 Go de stockage documentaire'],
    cta: 'Choisir Essentiel',
    ctaStyle: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    internalName: 'Pro',
    audience: 'Gestionnaire indépendant ou petite structure',
    price_xof: 15000,
    priceLabel: '15 000 F CFA',
    founderPriceXof: 12000,
    founderPriceLabel: '12 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour professionnaliser les encaissements et partager une information fiable.',
    outcome: 'Plus de capacité, une petite équipe et des rapports prêts à présenter aux propriétaires.',
    bestFor: 'Une équipe jusqu’à 5 personnes qui gère jusqu’à 100 unités.',
    supportLabel: 'Support prioritaire',
    accent: '#B8863E',
    surface: '#FBF6EC',
    badge: 'Populaire',
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
      storage: '20 Go',
    },
    features: [
      'Toutes les fonctions métier essentielles',
      'Collaboration jusqu’à 5 utilisateurs',
      'Rapports bailleurs et suivi financier',
      'GED et vérification documentaire',
      'Support prioritaire',
    ],
    value: [
      'Partager une source unique avec l’équipe',
      'Suivre paiements partiels et reliquats',
      'Produire des rapports propriétaires lisibles',
    ],
    infrastructure: ['5 utilisateurs', 'Jusqu’à 100 unités', '20 Go de stockage documentaire'],
    cta: 'Choisir Pro',
    ctaStyle: 'primary',
  },
  {
    id: 'business',
    name: 'Agence',
    internalName: 'Business',
    audience: 'Agence immobilière et équipe de gestion',
    price_xof: 35000,
    priceLabel: '35 000 F CFA',
    founderPriceXof: 29000,
    founderPriceLabel: '29 000 F CFA',
    billingLabel: 'par mois',
    positioning: 'Pour coordonner plusieurs gestionnaires et piloter un portefeuille plus important.',
    outcome: 'Une capacité agence, des accès maîtrisés et une vision consolidée des opérations.',
    bestFor: 'Une agence jusqu’à 15 utilisateurs et 500 unités.',
    supportLabel: 'Support prioritaire',
    accent: '#0F766E',
    surface: '#ECFDF5',
    highlighted: true,
    badge: 'Recommandé aux agences',
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
      storage: '100 Go',
    },
    features: [
      'Toutes les fonctions métier essentielles',
      'Collaboration jusqu’à 15 utilisateurs',
      'Rôles, permissions et suivi d’activité',
      'Rapports consolidés et documents vérifiables',
      'Support prioritaire',
    ],
    value: [
      'Coordonner agents, comptables et administrateurs',
      'Contrôler les accès selon les responsabilités',
      'Piloter un portefeuille agence plus large',
    ],
    infrastructure: ['15 utilisateurs', 'Jusqu’à 500 unités', '100 Go de stockage documentaire'],
    cta: 'Choisir Agence',
    ctaStyle: 'secondary',
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    internalName: 'Enterprise',
    audience: 'Groupe, réseau ou organisation multi-agences',
    price_xof: 0,
    priceLabel: 'Sur devis',
    billingLabel: 'capacité à définir',
    positioning: 'Pour cadrer un déploiement à grande échelle avec des besoins spécifiques.',
    outcome: 'Le périmètre, les volumes et l’accompagnement sont définis avec votre organisation.',
    bestFor: 'Un groupe, un réseau ou une organisation dépassant les limites du plan Agence.',
    supportLabel: 'Accompagnement défini sur devis',
    accent: '#14532D',
    surface: '#F0FDF4',
    limits: {
      max_users: -1,
      max_immeubles: -1,
      max_unites: -1,
      storage_gb: 100,
    },
    capacities: {
      users: 'À définir',
      immeubles: 'À définir',
      unites: 'À définir',
      storage: 'À définir',
    },
    features: [
      'Périmètre fonctionnel défini avec votre équipe',
      'Capacités adaptées au volume réel',
      'Accompagnement de déploiement',
      'Conditions de support contractualisées',
    ],
    value: [
      'Cadrer les besoins d’un réseau ou d’un groupe',
      'Préparer l’adoption par plusieurs équipes',
      'Définir les capacités et le support attendus',
    ],
    infrastructure: ['Utilisateurs à définir', 'Portefeuille à définir', 'Stockage à définir'],
    cta: 'Parler à l’équipe',
    ctaStyle: 'contact',
  },
];

export const PLAN_ORDER = PRICING_PLAN_DEFINITIONS.map((plan) => plan.id);

/**
 * Offre Fondateurs : tarif préférentiel sur les 12 premiers cycles payants
 * (starter et enterprise ne sont pas concernés). L'éligibilité réelle d'une
 * agence (founder_eligible / founder_paid_cycles_used / founder_cycles_total)
 * est une donnée serveur (table agencies) — ces constantes ne sont que la
 * copy et les durées, jamais une source de vérité sur le prix facturé.
 */
export const FOUNDER_OFFER = {
  paidCycles: 12,
  trialDays: 30,
  badgeLabel: 'OFFRE FONDATEURS',
  disclaimer:
    "Offre Fondateurs réservée aux premières agences clientes. Tarif préférentiel appliqué pendant 12 mois payants, puis retour au tarif public en vigueur. Les 30 jours d'essai restent disponibles pour toute nouvelle agence.",
} as const;

export function getPricingPlan(planId: string | null | undefined) {
  return PRICING_PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? PRICING_PLAN_DEFINITIONS[0];
}
