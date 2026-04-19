export interface Bailleur {
  id: string;
  agency_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  piece_identite: string | null;
  notes: string | null;
  actif: boolean;
  commission: number | null;
  debut_contrat: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Immeuble {
  id: string;
  agency_id: string;
  nom: string;
  adresse: string;
  quartier: string | null;
  ville: string;
  bailleur_id: string | null;
  nombre_unites: number;
  description: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Unite {
  id: string;
  agency_id: string;
  immeuble_id: string | null;
  nom: string;
  numero: string | null;
  etage: string | null;
  loyer_base: number;
  statut: 'libre' | 'loue' | 'maintenance';
  superficie: number | null;
  description: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Locataire {
  id: string;
  agency_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse_personnelle: string | null;
  piece_identite: string | null;
  notes: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Contrat {
  id: string;
  agency_id: string;
  locataire_id: string | null;
  unite_id: string | null;
  date_debut: string;
  date_fin: string | null;
  loyer_mensuel: number;
  caution: number | null;
  commission: number | null;
  statut: 'actif' | 'expire' | 'resilie';
  notes: string | null;
  destination: 'Habitation' | 'Commercial' | 'Mixte';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type ModePayment = 'especes' | 'cheque' | 'virement' | 'mobile_money' | 'autre';
export type PaiementStatut = 'paye' | 'partiel' | 'impaye' | 'annule';

export interface Paiement {
  id: string;
  agency_id: string;
  contrat_id: string | null;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: ModePayment;
  part_agence: number;
  part_bailleur: number;
  statut: PaiementStatut;
  reference: string | null;
  piece_justificative: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  actif: boolean;
  deleted_at: string | null;
}

export interface Depense {
  id: string;
  agency_id: string;
  montant: number;
  date_depense: string;
  categorie: string;
  description: string | null;
  beneficiaire: string | null;
  immeuble_id: string | null;
  piece_justificative: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  actif: boolean;
  deleted_at: string | null;
}

export interface Commission {
  id: string;
  agency_id: string;
  montant: number;
  date_commission: string;
  paiement_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Revenu {
  id: string;
  agency_id: string;
  montant: number;
  date_revenu: string;
  categorie: string;
  description: string | null;
  source: string | null;
  paiement_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
