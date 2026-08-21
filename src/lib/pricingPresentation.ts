import type { PlanId } from './pricingCatalog';

export interface PricingComparisonRow {
  label: string;
  values: Record<PlanId, string>;
}

export interface PricingComparisonSection {
  title: string;
  rows: PricingComparisonRow[];
}

const INCLUDED = {
  starter: 'Inclus',
  pro: 'Inclus',
  business: 'Inclus',
  enterprise: 'Périmètre défini',
} satisfies Record<PlanId, string>;

const BY_MODULE = {
  starter: 'Selon configuration',
  pro: 'Selon configuration',
  business: 'Selon configuration',
  enterprise: 'Périmètre défini',
} satisfies Record<PlanId, string>;

export const PRICING_FOUNDATION = [
  {
    title: 'Patrimoine',
    text: 'Bailleurs, biens et unités sont réunis dans une source de vérité exploitable.',
  },
  {
    title: 'Locations',
    text: 'Occupants, baux, échéances et renouvellements restent reliés au bon dossier.',
  },
  {
    title: 'Encaissements',
    text: 'Paiements complets ou partiels, reliquats et impayés sont suivis sans ambiguïté.',
  },
  {
    title: 'Finances',
    text: 'Dépenses, charges, commissions et nets bailleurs sont rapprochés des opérations.',
  },
  {
    title: 'Documents',
    text: 'Contrats, mandats, quittances, factures et rapports sont générés et archivés.',
  },
  {
    title: 'Pilotage',
    text: 'Tableaux de bord, rapports et accès d’équipe rendent l’activité plus lisible.',
  },
];

export const PRICING_BENEFITS = [
  {
    title: 'Finance bailleur maîtrisée',
    text: 'Chaque encaissement, dépense, commission et reliquat reste rattaché au bon dossier.',
  },
  {
    title: 'Documents vérifiables',
    text: 'Les documents professionnels sont centralisés, référencés et vérifiables lorsque le QR est activé.',
  },
  {
    title: 'Équipe sous contrôle',
    text: 'Rôles, permissions et visibilité des pages structurent le travail des collaborateurs.',
  },
  {
    title: 'Travail sur le terrain',
    text: 'L’interface responsive et les mécanismes de cache disponibles facilitent les consultations en mobilité.',
  },
];

export const PRICING_COMPARISON: PricingComparisonSection[] = [
  {
    title: 'Gestion locative',
    rows: [
      { label: 'Biens, unités et occupants', values: INCLUDED },
      { label: 'Baux, échéances et renouvellements', values: INCLUDED },
      { label: 'Paiements complets et partiels', values: INCLUDED },
      { label: 'Reliquats, impayés et créances', values: INCLUDED },
    ],
  },
  {
    title: 'Finance et propriétaires',
    rows: [
      { label: 'Dépenses et charges', values: INCLUDED },
      { label: 'Commissions et net bailleur', values: INCLUDED },
      { label: 'Rapports bailleurs et propriétaires', values: INCLUDED },
      { label: 'Suivi des reversements', values: INCLUDED },
    ],
  },
  {
    title: 'Documents',
    rows: [
      { label: 'Quittances, contrats et mandats', values: INCLUDED },
      { label: 'Rapports et factures', values: INCLUDED },
      { label: 'GED et archivage documentaire', values: INCLUDED },
      { label: 'Studio documentaire et modèles', values: INCLUDED },
      { label: 'Registre et QR Verify', values: BY_MODULE },
    ],
  },
  {
    title: 'Exploitation',
    rows: [
      { label: 'Calendrier et suivi des échéances', values: INCLUDED },
      { label: 'Maintenance et interventions', values: BY_MODULE },
      { label: 'États des lieux', values: BY_MODULE },
    ],
  },
  {
    title: 'Équipe et contrôle',
    rows: [
      {
        label: 'Utilisateurs inclus',
        values: { starter: '1', pro: '5', business: '15', enterprise: 'À définir' },
      },
      {
        label: 'Rôles et permissions',
        values: { starter: 'Compte unique', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      { label: 'Journal des actions', values: INCLUDED },
    ],
  },
  {
    title: 'Intégrations et accompagnement',
    rows: [
      { label: 'Exports disponibles dans les écrans concernés', values: INCLUDED },
      {
        label: 'Paiement en ligne de l’abonnement',
        values: { starter: 'Selon disponibilité', pro: 'Selon disponibilité', business: 'Selon disponibilité', enterprise: 'À définir' },
      },
      {
        label: 'API ou intégration spécifique',
        values: { starter: 'Non commercialisé', pro: 'Non commercialisé', business: 'Non commercialisé', enterprise: 'Sur étude' },
      },
      {
        label: 'Canal de support',
        values: { starter: 'Email', pro: 'Prioritaire', business: 'Prioritaire', enterprise: 'Défini sur devis' },
      },
    ],
  },
  {
    title: 'Capacités techniques',
    rows: [
      {
        label: 'Unités gérées',
        values: { starter: '10', pro: '100', business: '500', enterprise: 'À définir' },
      },
      {
        label: 'Immeubles',
        values: { starter: '3', pro: '20', business: '100', enterprise: 'À définir' },
      },
    ],
  },
];

export const PRICING_FAQ = [
  {
    question: 'Puis-je changer de plan sans perdre mes données ?',
    answer:
      'Oui. Le changement de plan ajuste les capacités disponibles sans supprimer les informations déjà enregistrées. Si votre usage dépasse une nouvelle limite, le changement est cadré avant activation.',
  },
  {
    question: 'Que se passe-t-il si j’atteins la limite d’unités ?',
    answer:
      'Les données existantes sont conservées. Vous devrez choisir un plan offrant davantage de capacité avant d’ajouter de nouvelles unités au-delà de la limite appliquée.',
  },
  {
    question: 'Pouvez-vous importer mes données existantes ?',
    answer:
      'Le format et le volume des données sont examinés pendant l’onboarding. Samay Këur ne promet pas un import automatique universel : le périmètre réalisable est confirmé avant toute reprise.',
  },
  {
    question: 'Plusieurs collaborateurs peuvent-ils avoir des accès différents ?',
    answer:
      'Oui sur les plans multi-utilisateurs. Les rôles définissent une base et les permissions peuvent limiter les pages visibles selon les responsabilités de chacun.',
  },
  {
    question: 'Les paiements partiels et les reliquats sont-ils pris en charge ?',
    answer:
      'Oui. Un encaissement peut être total ou partiel, et le reliquat reste rattaché à l’échéance et au dossier concernés.',
  },
  {
    question: 'Puis-je exporter mes données et télécharger mes documents ?',
    answer:
      'Les écrans concernés proposent des exports et les documents générés peuvent être téléchargés. Le périmètre précis dépend du dossier et du module utilisés.',
  },
  {
    question: 'Comment les documents sont-ils sécurisés et vérifiés ?',
    answer:
      'Les documents sont enregistrés avec une référence. Lorsque QR Verify est activé, le QR permet de consulter les informations de vérification prévues par le registre Samay Këur.',
  },
  {
    question: 'Puis-je travailler avec une connexion instable ?',
    answer:
      'Certaines consultations bénéficient d’un cache local et de mécanismes de synchronisation. Une première ouverture en ligne reste nécessaire et Samay Këur ne présente pas toutes les opérations comme entièrement hors ligne.',
  },
  {
    question: 'Quels moyens de paiement sont gérés ?',
    answer:
      'La gestion locative permet d’enregistrer notamment espèces, virement, chèque et mobile money. Pour l’abonnement, les canaux proposés dans le parcours de paiement sécurisé dépendent de leur disponibilité.',
  },
  {
    question: 'Quand faut-il choisir le plan Entreprise ?',
    answer:
      'Entreprise s’adresse aux groupes, réseaux et organisations multi-agences qui dépassent les capacités du plan Agence ou nécessitent un périmètre d’accompagnement défini contractuellement.',
  },
];
