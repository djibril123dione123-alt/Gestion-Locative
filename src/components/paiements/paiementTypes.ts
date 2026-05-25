import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PaiementContrats {
  loyer_mensuel: number;
  commission: number | null;
  pourcentage_agence?: number | null;
  locataires: { nom: string; prenom: string } | null;
  unites: {
    nom: string;
    id: string;
    immeubles?: {
      nom?: string | null;
      bailleurs?: { id: string; nom: string; prenom: string } | null;
    } | null;
  } | null;
}

export interface PaiementRow {
  id: string;
  created_at?: string | null;
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  montant_attendu?: number | null;
  montant_encaisse_cumul?: number | null;
  reliquat?: number | null;
  reference: string | null;
  actif?: boolean;
  deleted_at?: string | null;
  contrats?: PaiementContrats | null;
}

export interface ContratRow {
  id: string;
  loyer_mensuel: number;
  date_debut?: string | null;
  date_fin?: string | null;
  commission?: number | null;
  pourcentage_agence?: number | null;
  locataires?: { nom: string; prenom: string } | null;
  unites?: {
    nom: string;
    id?: string;
    immeubles?: {
      nom?: string | null;
      bailleurs?: { id: string; nom: string; prenom: string } | null;
    } | null;
  } | null;
}

export type StatusFilter = 'tous' | 'paye' | 'partiel';

export type FormModePayment = 'especes' | 'cheque' | 'virement' | 'mobile_money';
export type FormPaiementStatut = 'paye' | 'partiel';

export interface StatusLabel {
  label: string;
  classes: string;
  icon: LucideIcon;
}

export const STATUS_LABELS: Record<string, StatusLabel> = {
  paye: {
    label: 'Payé',
    classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  en_attente: {
    label: 'En attente',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
  },
  impaye: {
    label: 'Impayé',
    classes: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
  partiel: {
    label: 'Partiel',
    classes: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertTriangle,
  },
  annule: {
    label: 'Annulé',
    classes: 'bg-slate-100 text-slate-500 border-slate-200',
    icon: MinusCircle,
  },
};

export const STATUS_LABEL_FALLBACK: StatusLabel = {
  label: 'Inconnu',
  classes: 'bg-slate-100 text-slate-500 border-slate-200',
  icon: MinusCircle,
};

export const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
  autre: 'Autre',
};

export interface PaiementFormData {
  contrat_id: string;
  montant_total: string;
  mois_concerne: string;
  mois_display: string;
  date_paiement: string;
  mode_paiement: FormModePayment;
  statut: FormPaiementStatut;
  reference: string;
}
