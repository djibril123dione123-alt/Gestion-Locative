import type { PlanId } from './pricingCatalog';

export interface PricingComparisonRow {
  label: string;
  values: Record<PlanId, string>;
}

export interface PricingComparisonSection {
  title: string;
  rows: PricingComparisonRow[];
}

export const PRICING_FOUNDATION = [
  {
    title: 'Patrimoine et locations',
    text: 'Bailleurs, biens, unités, occupants et baux réunis dans un même espace.',
  },
  {
    title: 'Encaissements et impayés',
    text: 'Paiements complets ou partiels, reliquats et échéances restent lisibles.',
  },
  {
    title: 'Documents professionnels',
    text: 'Contrats, mandats, quittances, factures et rapports sont générés et archivés.',
  },
  {
    title: 'Rapports bailleurs',
    text: 'Les propriétaires disposent d’une synthèse claire des opérations et montants.',
  },
  {
    title: 'Équipe et accès',
    text: 'Les rôles et permissions structurent le travail quand le plan accueille plusieurs utilisateurs.',
  },
  {
    title: 'Usage local',
    text: 'Une interface en français, pensée pour les usages immobiliers au Sénégal.',
  },
];

export const PRICING_BENEFITS = [
  {
    title: 'Moins de recherches manuelles',
    text: 'Les informations utiles ne restent plus dispersées entre cahiers, fichiers et conversations.',
  },
  {
    title: 'Des montants plus faciles à expliquer',
    text: 'Paiements, reliquats, dépenses et nets bailleurs sont rapprochés des dossiers concernés.',
  },
  {
    title: 'Une relation propriétaire plus professionnelle',
    text: 'Documents et rapports donnent une preuve claire du travail réalisé par le gestionnaire.',
  },
];

export const PRICING_COMPARISON: PricingComparisonSection[] = [
  {
    title: 'Gestion locative',
    rows: [
      {
        label: 'Biens, unités et occupants',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'Baux, échéances et impayés',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'Paiements et reliquats',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'Dépenses, charges et commissions',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'Rapports bailleurs',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
    ],
  },
  {
    title: 'Documents et contrôle',
    rows: [
      {
        label: 'Contrats, mandats et quittances',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'GED et registre documentaire',
        values: { starter: 'Inclus', pro: 'Inclus', business: 'Inclus', enterprise: 'Périmètre défini' },
      },
      {
        label: 'QR de vérification',
        values: { starter: 'Disponible', pro: 'Disponible', business: 'Disponible', enterprise: 'À définir' },
      },
      {
        label: 'Rôles et permissions',
        values: { starter: 'Compte unique', pro: 'Jusqu’à 5 comptes', business: 'Jusqu’à 15 comptes', enterprise: 'À définir' },
      },
    ],
  },
  {
    title: 'Accompagnement',
    rows: [
      {
        label: 'Canal de support',
        values: { starter: 'Email', pro: 'Prioritaire', business: 'Prioritaire', enterprise: 'Défini sur devis' },
      },
      {
        label: 'Dimensionnement',
        values: { starter: 'Standard', pro: 'Standard', business: 'Standard', enterprise: 'Avec votre équipe' },
      },
    ],
  },
];

export const PRICING_FAQ = [
  {
    question: 'Quel plan choisir pour démarrer ?',
    answer:
      'Essentiel convient à un bailleur qui travaille seul. Pro est adapté à une petite équipe. Agence répond aux portefeuilles plus importants et aux équipes jusqu’à 15 utilisateurs.',
  },
  {
    question: 'Les fonctions métier changent-elles selon le plan ?',
    answer:
      'Le socle de gestion locative reste commun. Les plans augmentent surtout le nombre d’utilisateurs, d’immeubles, d’unités et la capacité documentaire. Certains modules restent pilotés par le type de compte, le rôle et la configuration de l’organisation.',
  },
  {
    question: 'Puis-je changer de plan sans perdre mes données ?',
    answer:
      'Oui. Le changement de plan ajuste les capacités disponibles sans supprimer les informations déjà enregistrées. Si un usage dépasse une nouvelle limite, l’équipe vous accompagne avant le changement.',
  },
  {
    question: 'Comment le paiement de l’abonnement fonctionne-t-il ?',
    answer:
      'Le paiement en ligne est proposé via les moyens disponibles dans le parcours sécurisé. Une preuve de paiement manuel peut aussi être transmise au support et reste soumise à validation avant activation.',
  },
  {
    question: 'Le plan Entreprise inclut-il automatiquement des intégrations spécifiques ?',
    answer:
      'Non. Le périmètre Entreprise est défini sur devis. Une intégration, un volume ou un accompagnement particulier n’est considéré comme inclus qu’après validation contractuelle.',
  },
  {
    question: 'Puis-je essayer le produit avant de choisir ?',
    answer:
      'L’équipe peut organiser une démonstration centrée sur votre portefeuille, vos documents et votre manière de travailler afin de confirmer le plan adapté.',
  },
];
