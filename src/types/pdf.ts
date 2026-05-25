import { Contrat, Paiement, Bailleur } from './entities';
import { AgencySettings } from './agency';

export interface ContratPDFData extends Contrat {
  locataires?: {
    nom: string;
    prenom: string;
    piece_identite: string | null;
    adresse_personnelle: string | null;
  };
  unites?: {
    nom: string;
    immeubles?: {
      nom: string;
      adresse: string;
      bailleurs?: {
        nom: string;
        prenom: string;
      };
    };
  };
}

export interface PaiementPDFData extends Paiement {
  montant_attendu: number | null;
  montant_encaisse_cumul: number | null;
  paiements_precedents?: number | null;
  total_paye_mois?: number | null;
  statut_reel_mois?: string | null;
  contrats?: {
    loyer_mensuel: number;
    locataires?: {
      nom: string;
      prenom: string;
    };
    unites?: {
      immeubles?: {
        adresse: string;
      };
    };
  };
}

export interface MandatPDFData extends Bailleur {
  bien_adresse?: string;
  bien_composition?: string;
  duree_annees?: number;
}

export interface PDFGenerationOptions {
  settings: AgencySettings;
  compress?: boolean;
}
