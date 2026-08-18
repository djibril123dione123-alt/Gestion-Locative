export type InventaireType = 'entree' | 'sortie' | 'intermediaire';
export type InventaireStatut = 'en_cours' | 'termine' | 'litige';
export type EtatElement = 'bon' | 'usage_normal' | 'a_surveiller' | 'degrade' | 'a_reparer';

export interface ElementPhoto {
  url: string;
  date: string;
}

export interface EDL_Element {
  id: string;
  nom: string; // Murs, Sol, Plafond, Fenêtre...
  etat: EtatElement;
  observations: string;
  photos: ElementPhoto[];
}

export interface EDL_Piece {
  id: string;
  nom: string; // Salon, Chambre 1, Cuisine...
  elements: EDL_Element[];
}

export interface EDL_Compteur {
  id: string;
  type: string; // Eau, Electricite, Gaz...
  valeur: string;
  photo_url?: string;
  observations?: string;
}

export interface EDL_Cle {
  id: string;
  type: string; // Porte d'entrée, Boîte aux lettres...
  quantite: number;
  observations?: string;
}

export interface Inventaire {
  id: string;
  agency_id: string;
  contrat_id: string;
  type: InventaireType;
  date: string;
  locataire_present: boolean;
  proprietaire_present: boolean;
  agent_present: boolean;
  
  // Nouveaux JSONB
  pieces: EDL_Piece[];
  compteurs: EDL_Compteur[];
  cles: EDL_Cle[];
  
  // Legacy or simplified equipment field
  equipements?: Record<string, any>;
  
  observations: string | null;
  reparations: string | null;
  caution_retenue: number;
  
  signature_locataire: string | null;
  signature_proprietaire: string | null;
  signature_agent: string | null;
  
  statut: InventaireStatut;
  parent_inventaire_id: string | null; // Pour comparaison
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  contrats?: {
    id: string;
    locataires?: { nom: string; prenom: string };
    unites?: { nom: string; immeubles?: { id?: string; nom: string } };
  };
}
