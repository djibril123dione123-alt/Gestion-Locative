import { Bailleur, Immeuble, Unite, Locataire, Contrat, Paiement, Depense } from './entities';

export type BailleurFormInput = Omit<Bailleur, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by'>;

export type ImmeubleFormInput = Omit<Immeuble, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by'>;

export type UniteFormInput = Omit<Unite, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by'>;

export type LocataireFormInput = Omit<Locataire, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by'>;

export type ContratFormInput = Omit<Contrat, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by'>;

export type PaiementFormInput = Omit<Paiement, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by' | 'part_agence' | 'part_bailleur'>;

export type DepenseFormInput = Omit<Depense, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'created_by' | 'deleted_at'>;
