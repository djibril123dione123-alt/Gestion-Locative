export type IncidentStatut = 'signale' | 'a_qualifier' | 'planifie' | 'devis_a_valider' | 'autorise' | 'en_cours' | 'resolu' | 'annule';
export type IncidentPriority = 'urgente' | 'haute' | 'normale' | 'basse';
export type IncidentCategory = 'plomberie' | 'electricite' | 'peinture' | 'serrurerie' | 'climatisation' | 'menuiserie' | 'autre';
export type DemandePar = 'locataire' | 'bailleur' | 'agent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Incident {
  id: string;
  reference: string;
  agency_id: string;
  titre: string;
  description: string | null;
  immeuble_id: string | null;
  unite_id: string | null;
  locataire_id: string | null;
  bailleur_id: string | null;
  categorie: IncidentCategory | null;
  urgence: IncidentPriority;
  demande_par: DemandePar | null;
  
  // Dates
  date_demande: string;
  date_souhaitee: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  
  // Intervenants
  assigne_a: string | null; // UUID profil
  prestataire_nom: string | null;
  prestataire_telephone: string | null;
  prestataire_email: string | null;
  prestataire_metier: string | null;
  
  // Coûts
  cout_estime: number | null;
  approved_cost: number | null;
  final_cost: number | null; // anciennement cout_reel
  
  // Validation Bailleur
  approval_required: boolean;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  
  // Documents / Medias
  devis_url: string | null;
  facture_url: string | null;
  photos_avant: string[];
  photos_apres: string[];
  notes: string | null;
  
  // Suivi
  statut: IncidentStatut;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations (jointures)
  immeubles?: { nom: string };
  unites?: { nom: string };
  locataires?: { prenom: string; nom: string };
  bailleurs?: { prenom: string; nom: string };
  assignee?: { first_name: string; last_name: string };
}
