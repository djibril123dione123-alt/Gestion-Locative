import { supabase } from '../../lib/supabase';

export interface FinancialDocumentSnapshot<TPayload> {
  snapshotId: string;
  fingerprint: string;
  createdAt: string;
  payload: TPayload;
}

export interface OwnerReportContractSnapshot {
  contrat_id: string;
  immeuble_id: string;
  immeuble: string;
  unite_id: string;
  unite: string;
  locataire: string;
  loyer_mensuel: number;
  encaisse: number;
  reliquat: number;
  commission: number;
  part_bailleur: number;
  statut: string;
}

export interface OwnerReportPaymentSnapshot {
  id: string;
  contrat_id: string;
  date_paiement: string;
  mois_concerne: string;
  montant_total: number;
  part_agence: number;
  part_bailleur: number;
  mode_paiement: string;
  reference: string | null;
  statut: string;
  loyer_mensuel: number;
  locataire: string;
  unite: string;
  immeuble: string;
  adresse: string | null;
}

export interface OwnerReportExpenseSnapshot {
  id: string;
  date_depense: string;
  categorie: string;
  description: string | null;
  beneficiaire: string | null;
  montant: number;
  piece_justificative: string | null;
  immeuble_id: string;
  immeuble: string;
}

export interface OwnerReportSnapshotPayload {
  schemaVersion: 'owner_report_v1';
  generatedAt: string;
  agencyId: string;
  bailleurId: string;
  period: { start: string; end: string };
  owner: { id: string; nom: string; prenom: string };
  totals: {
    collected: number;
    arrears: number;
    commissions: number;
    expenses: number;
    ownerShare: number;
    netToPay: number;
    activeContracts: number;
    recoveryRate: number;
  };
  contracts: OwnerReportContractSnapshot[];
  payments: OwnerReportPaymentSnapshot[];
  expenses: OwnerReportExpenseSnapshot[];
  receivables: Array<Record<string, unknown>>;
}

export interface PaymentReceiptSnapshotPayload {
  schemaVersion: 'payment_receipt_v1';
  generatedAt: string;
  agencyId: string;
  payment: {
    id: string;
    createdAt: string;
    date: string;
    period: string;
    amount: number;
    expected: number;
    previousPayments: number;
    paidToDate: number;
    remaining: number;
    status: 'partiel' | 'solde';
    mode: string;
    reference: string | null;
    agencyShare: number;
    ownerShare: number;
  };
  context: {
    contractId: string;
    rent: number;
    tenant: { id: string; nom: string; prenom: string };
    unit: { id: string; nom: string };
    property: { id: string; nom: string; adresse: string | null };
    ownerId: string;
  };
}

function assertSnapshot<TPayload>(
  data: unknown,
  error: { message?: string } | null,
): FinancialDocumentSnapshot<TPayload> {
  if (error) throw new Error(error.message || 'Impossible de figer les donnees du document.');
  if (!data || typeof data !== 'object') throw new Error('Le serveur n\'a pas retourne de snapshot documentaire.');
  const snapshot = data as Partial<FinancialDocumentSnapshot<TPayload>>;
  if (!snapshot.snapshotId || !snapshot.fingerprint || !snapshot.createdAt || !snapshot.payload) {
    throw new Error('Le snapshot documentaire retourne par le serveur est incomplet.');
  }
  return snapshot as FinancialDocumentSnapshot<TPayload>;
}

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('La periode du rapport est invalide.');
  const [year, monthNumber] = month.split('-').map(Number);
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(endDay).padStart(2, '0')}`,
  };
}

export async function createOwnerReportSnapshot(input: {
  agencyId: string;
  bailleurId: string;
  month: string;
  documentKind: 'rapport_bailleur' | 'rapport_proprietaire';
}): Promise<FinancialDocumentSnapshot<OwnerReportSnapshotPayload>> {
  const bounds = monthBounds(input.month);
  const { data, error } = await supabase.rpc('fn_create_owner_report_snapshot', {
    p_agency_id: input.agencyId,
    p_bailleur_id: input.bailleurId,
    p_period_start: bounds.start,
    p_period_end: bounds.end,
    p_document_kind: input.documentKind,
  });
  return assertSnapshot<OwnerReportSnapshotPayload>(data, error);
}

export async function createPaymentReceiptSnapshot(input: {
  agencyId: string;
  paymentId: string;
}): Promise<FinancialDocumentSnapshot<PaymentReceiptSnapshotPayload>> {
  const { data, error } = await supabase.rpc('fn_create_payment_receipt_snapshot', {
    p_agency_id: input.agencyId,
    p_payment_id: input.paymentId,
  });
  return assertSnapshot<PaymentReceiptSnapshotPayload>(data, error);
}
