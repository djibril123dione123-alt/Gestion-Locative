import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PaiementContrats {
  loyer_mensuel: number;
  commission: number | null;
  pourcentage_agence?: number | null;
  locataires: { nom: string; prenom: string } | null;
  unites: { nom: string; id: string } | null;
}

export interface PaiementRow {
  id: string;
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  reference: string | null;
  contrats?: PaiementContrats | null;
}

export interface ContratRow {
  id: string;
  loyer_mensuel: number;
  commission?: number | null;
  pourcentage_agence?: number | null;
  locataires?: { nom: string; prenom: string } | null;
  unites?: { nom: string; id?: string } | null;
}

export type StatusFilter = 'tous' | 'paye' | 'en_attente' | 'impaye';

export type FormModePayment = 'especes' | 'cheque' | 'virement' | 'mobile_money';
export type FormPaiementStatut = 'paye' | 'en_attente' | 'impaye';

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
};

export const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
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
