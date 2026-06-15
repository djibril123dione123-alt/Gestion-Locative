import { supabase } from '../../lib/supabase';

export type OpenReceivableStatus = 'a_venir' | 'en_retard' | 'partiel';

export interface OpenReceivableRow {
  id: string;
  contrat_id: string;
  bailleur_id: string | null;
  locataire_nom: string;
  locataire_prenom: string;
  telephone_locataire: string;
  unite_nom: string;
  immeuble_nom: string;
  bailleur_nom: string;
  bailleur_prenom: string;
  montant_attendu: number;
  montant_encaisse: number;
  montant_du: number;
  mois_concerne: string;
  date_echeance: string;
  statut: OpenReceivableStatus;
}

export interface AgencyFinancialSummary {
  loyers_encaisses: number;
  commissions_agence: number;
  net_bailleurs: number;
  depenses_total: number;
  reliquats_ouverts: number;
  impayes_en_retard: number;
  echeances_ouvertes: number;
  paiements_count: number;
  contrats_actifs: number;
  solde_operationnel: number;
}

export interface OwnerFinancialSummary {
  bailleur_id: string;
  bailleur_nom: string;
  bailleur_prenom: string;
  loyers_encaisses: number;
  commissions_agence: number;
  net_bailleur: number;
  depenses_total: number;
  reliquats_ouverts: number;
  contrats_actifs: number;
}

export interface DepenseMutationInput {
  agency_id: string;
  montant: number;
  date_depense: string;
  categorie: string;
  description?: string | null;
  beneficiaire?: string | null;
  immeuble_id?: string | null;
  piece_justificative?: string | null;
}

export interface DepenseUpdateInput extends DepenseMutationInput {
  id: string;
}

function assertRpc<T>(data: T | null, error: { message?: string } | null): T {
  if (error) throw new Error(error.message || 'Erreur RPC finance');
  if (data == null) throw new Error('Réponse finance vide');
  return data;
}

export async function getOpenReceivables(input: {
  agencyId: string;
  start: string;
  end: string;
}): Promise<OpenReceivableRow[]> {
  const { data, error } = await supabase.rpc('fn_finance_open_receivables', {
    p_agency_id: input.agencyId,
    p_start: input.start,
    p_end: input.end,
  });
  return assertRpc((data ?? []) as OpenReceivableRow[], error);
}

export async function getAgencyFinancialSummary(input: {
  agencyId: string;
  start: string;
  end: string;
}): Promise<AgencyFinancialSummary> {
  const { data, error } = await supabase.rpc('fn_finance_agency_summary', {
    p_agency_id: input.agencyId,
    p_start: input.start,
    p_end: input.end,
  });
  const rows = assertRpc((data ?? []) as AgencyFinancialSummary[], error);
  return rows[0] ?? {
    loyers_encaisses: 0,
    commissions_agence: 0,
    net_bailleurs: 0,
    depenses_total: 0,
    reliquats_ouverts: 0,
    impayes_en_retard: 0,
    echeances_ouvertes: 0,
    paiements_count: 0,
    contrats_actifs: 0,
    solde_operationnel: 0,
  };
}

export async function getOwnerFinancialSummary(input: {
  agencyId: string;
  start: string;
  end: string;
  bailleurId?: string | null;
}): Promise<OwnerFinancialSummary[]> {
  const { data, error } = await supabase.rpc('fn_finance_owner_summary', {
    p_agency_id: input.agencyId,
    p_start: input.start,
    p_end: input.end,
    p_bailleur_id: input.bailleurId ?? null,
  });
  return assertRpc((data ?? []) as OwnerFinancialSummary[], error);
}

export async function createDepenseViaRpc(input: DepenseMutationInput) {
  const { data, error } = await supabase.rpc('fn_finance_create_depense', {
    p_agency_id: input.agency_id,
    p_montant: input.montant,
    p_date_depense: input.date_depense,
    p_categorie: input.categorie,
    p_description: input.description ?? null,
    p_beneficiaire: input.beneficiaire ?? null,
    p_immeuble_id: input.immeuble_id ?? null,
    p_piece_justificative: input.piece_justificative ?? null,
  });
  return assertRpc(data, error);
}

export async function updateDepenseViaRpc(input: DepenseUpdateInput) {
  const { data, error } = await supabase.rpc('fn_finance_update_depense', {
    p_agency_id: input.agency_id,
    p_id: input.id,
    p_montant: input.montant,
    p_date_depense: input.date_depense,
    p_categorie: input.categorie,
    p_description: input.description ?? null,
    p_beneficiaire: input.beneficiaire ?? null,
    p_immeuble_id: input.immeuble_id ?? null,
    p_piece_justificative: input.piece_justificative ?? null,
  });
  return assertRpc(data, error);
}

export async function cancelDepenseViaRpc(input: {
  agencyId: string;
  id: string;
  reason?: string | null;
}) {
  const { data, error } = await supabase.rpc('fn_finance_cancel_depense', {
    p_agency_id: input.agencyId,
    p_id: input.id,
    p_reason: input.reason ?? null,
  });
  return assertRpc(data, error);
}
