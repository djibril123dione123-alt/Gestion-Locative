/**
 * occupantsBauxRepository — vue unifiée Occupants & Baux.
 *
 * Responsabilité unique : charger en une seule requête les données nécessaires
 * à la vue unifiée (occupant → bail → unité → bien → loyer → statut).
 *
 * Pattern : UI → Service domain → Repository → Supabase
 * Multi-tenant : toutes les requêtes filtrent sur agency_id (RLS en renfort).
 */

import { supabase } from '../lib/supabase';
import type { ContratPDFData } from '../types';

export type ContratStatut = 'actif' | 'resilie' | 'expire' | 'archive' | 'en_attente';

export interface OccupantBailPayment {
  id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  statut: string;
  reliquat: number | null;
  reference: string | null;
}

export interface OccupantBailDocument {
  id: string;
  title: string;
  subtitle: string;
  source: 'documents' | 'registry' | 'profile';
  status: string | null;
  created_at: string | null;
}

export interface OccupantBailEvent {
  id: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export interface OccupantBailDetails {
  payments: OccupantBailPayment[];
  documents: OccupantBailDocument[];
  events: OccupantBailEvent[];
}

export interface OccupantBailPersonOption {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
}

export interface OccupantBailAvailableUnit {
  id: string;
  nom: string;
  loyer_base: number;
  numero: string | null;
  etage: string | null;
  immeuble_nom: string | null;
  immeuble_id: string | null;
  bailleur_commission: number | null;
  bailleur_nom: string | null;
  bailleur_prenom: string | null;
}

export interface OccupantBailPersonInput {
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse_personnelle: string | null;
  piece_identite: string | null;
  type_piece?: string | null;
  numero_piece?: string | null;
}

export type OccupantBailContractPdfData = ContratPDFData;

export interface OccupantBailRow {
  /** Identifiant du contrat (bail) */
  contrat_id: string;
  /** Identifiant du locataire */
  locataire_id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  adresse_personnelle: string | null;
  piece_identite: string | null;

  /** Référence du contrat – numéro court lisible */
  contrat_ref: string;

  /** Bail */
  date_debut: string;
  date_fin: string | null;
  loyer_mensuel: number;
  caution: number | null;
  commission: number | null;
  statut: ContratStatut;
  destination: string;
  created_at: string;

  /** Unité */
  unite_id: string;
  unite_nom: string;

  /** Bien (immeuble) */
  immeuble_id: string | null;
  immeuble_nom: string | null;
  immeuble_adresse: string | null;

  /** Bailleur */
  bailleur_id: string | null;
  bailleur_nom: string | null;
  bailleur_prenom: string | null;
}

/**
 * Construit une référence courte lisible à partir de l'UUID du contrat.
 * Ex. : "CTR-A3F2"
 */
export function buildContratRef(contratId: string): string {
  return `CTR-${contratId.slice(0, 4).toUpperCase()}`;
}

const OCCUPANTS_BAUX_SELECT = `
  id,
  locataire_id,
  date_debut,
  date_fin,
  loyer_mensuel,
  caution,
  commission,
  statut,
  destination,
  created_at,
  locataires(id, nom, prenom, telephone, email, adresse_personnelle, piece_identite),
  unites(
    id,
    nom,
    immeubles(
      id,
      nom,
      adresse,
      bailleurs(id, nom, prenom)
    )
  )
` as const;

type RawRow = {
  id: string;
  locataire_id: string;
  date_debut: string;
  date_fin: string | null;
  loyer_mensuel: number;
  caution: number | null;
  commission: number | null;
  statut: string;
  destination: string;
  created_at: string;
  locataires: {
    id: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    email: string | null;
    adresse_personnelle: string | null;
    piece_identite: string | null;
  } | null;
  unites: {
    id: string;
    nom: string;
    immeubles: {
      id: string;
      nom: string;
      adresse: string | null;
      bailleurs: { id: string; nom: string; prenom: string } | null;
    } | null;
  } | null;
};

type RawPayment = {
  id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  statut: string;
  reliquat: number | null;
  reference: string | null;
};

type RawDocument = {
  id: string;
  name: string | null;
  document_category: string | null;
  entity_type: string | null;
  lifecycle_status: string | null;
  created_at: string | null;
};

type RawRegistryDocument = {
  id: string;
  document_type: string;
  reference: string | null;
  version: number | null;
  status: string | null;
  generated_at: string | null;
};

type RawEvent = {
  id: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type RawPersonOption = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
};

type RawAvailableUnit = {
  id: string;
  nom: string;
  loyer_base: number;
  numero: string | null;
  etage: string | null;
  immeubles: {
    id: string;
    nom: string;
    bailleurs: { commission: number | null; nom: string | null; prenom: string | null } | null;
  } | null;
};

function mapRow(row: RawRow): OccupantBailRow {
  return {
    contrat_id: row.id,
    locataire_id: row.locataire_id,
    nom: row.locataires?.nom ?? '',
    prenom: row.locataires?.prenom ?? '',
    telephone: row.locataires?.telephone ?? null,
    email: row.locataires?.email ?? null,
    adresse_personnelle: row.locataires?.adresse_personnelle ?? null,
    piece_identite: row.locataires?.piece_identite ?? null,
    contrat_ref: buildContratRef(row.id),
    date_debut: row.date_debut,
    date_fin: row.date_fin,
    loyer_mensuel: row.loyer_mensuel,
    caution: row.caution,
    commission: row.commission,
    statut: row.statut as ContratStatut,
    destination: row.destination,
    created_at: row.created_at,
    unite_id: row.unites?.id ?? '',
    unite_nom: row.unites?.nom ?? '—',
    immeuble_id: row.unites?.immeubles?.id ?? null,
    immeuble_nom: row.unites?.immeubles?.nom ?? null,
    immeuble_adresse: row.unites?.immeubles?.adresse ?? null,
    bailleur_id: row.unites?.immeubles?.bailleurs?.id ?? null,
    bailleur_nom: row.unites?.immeubles?.bailleurs?.nom ?? null,
    bailleur_prenom: row.unites?.immeubles?.bailleurs?.prenom ?? null,
  };
}

export const occupantsBauxRepository = {
  /**
   * Charge tous les baux d'une agence (hors archivés par défaut).
   *
   * @param agencyId   – ID de l'agence (multi-tenant)
   * @param statut     – filtre optionnel ; si absent : tous sauf 'archive'
   */
  async list(agencyId: string, statut?: ContratStatut): Promise<{ data: OccupantBailRow[]; error: unknown }> {
    let query = supabase
      .from('contrats')
      .select(OCCUPANTS_BAUX_SELECT)
      .eq('agency_id', agencyId)
      .order('date_debut', { ascending: false });

    if (statut) {
      query = query.eq('statut', statut);
    } else {
      // Vue principale : exclure les archivés
      query = query.neq('statut', 'archive');
    }

    const { data, error } = await query;
    if (error) return { data: [], error };

    const rows = (data as unknown as RawRow[]).map(mapRow);
    return { data: rows, error: null };
  },

  async getByContractId(input: {
    agencyId: string;
    contratId: string;
  }): Promise<{ data: OccupantBailRow | null; error: unknown }> {
    const { data, error } = await supabase
      .from('contrats')
      .select(OCCUPANTS_BAUX_SELECT)
      .eq('agency_id', input.agencyId)
      .eq('id', input.contratId)
      .single();

    if (error) return { data: null, error };
    return { data: mapRow(data as unknown as RawRow), error: null };
  },

  async details(input: {
    agencyId: string;
    contratId: string;
    locataireId: string;
    pieceIdentite?: string | null;
  }): Promise<{ data: OccupantBailDetails; error: unknown }> {
    const [paymentsRes, documentsRes, registryRes, eventsRes] = await Promise.all([
      supabase
        .from('paiements')
        .select('id, montant_total, mois_concerne, date_paiement, statut, reliquat, reference')
        .eq('agency_id', input.agencyId)
        .eq('contrat_id', input.contratId)
        .eq('actif', true)
        .order('date_paiement', { ascending: false })
        .limit(8),
      supabase
        .from('documents')
        .select('id, name, document_category, entity_type, lifecycle_status, created_at')
        .eq('agency_id', input.agencyId)
        .neq('lifecycle_status', 'deleted')
        .or(`entity_id.eq.${input.contratId},entity_id.eq.${input.locataireId}`)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('document_registry')
        .select('id, document_type, reference, version, status, generated_at')
        .eq('agency_id', input.agencyId)
        .neq('status', 'deleted')
        .in('entity_id', [input.contratId, input.locataireId])
        .order('generated_at', { ascending: false })
        .limit(8),
      supabase
        .from('event_log')
        .select('id, event_type, created_at, payload')
        .eq('agency_id', input.agencyId)
        .eq('entity_type', 'contrats')
        .eq('entity_id', input.contratId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const firstError = paymentsRes.error ?? documentsRes.error ?? registryRes.error ?? eventsRes.error;
    if (firstError) {
      return {
        data: { payments: [], documents: [], events: [] },
        error: firstError,
      };
    }

    const payments = ((paymentsRes.data ?? []) as unknown as RawPayment[]).map((payment) => ({
      id: payment.id,
      montant_total: payment.montant_total,
      mois_concerne: payment.mois_concerne,
      date_paiement: payment.date_paiement,
      statut: payment.statut,
      reliquat: payment.reliquat,
      reference: payment.reference,
    }));

    const documents: OccupantBailDocument[] = [
      ...((documentsRes.data ?? []) as unknown as RawDocument[]).map((document) => ({
        id: document.id,
        title: document.name || document.document_category || 'Document',
        subtitle: document.entity_type || 'Fichier GED',
        source: 'documents' as const,
        status: document.lifecycle_status,
        created_at: document.created_at,
      })),
      ...((registryRes.data ?? []) as unknown as RawRegistryDocument[]).map((document) => ({
        id: document.id,
        title: document.document_type.replace(/_/g, ' '),
        subtitle: `${document.reference ?? 'Sans référence'} · v${document.version ?? 1}`,
        source: 'registry' as const,
        status: document.status,
        created_at: document.generated_at,
      })),
    ];

    if (input.pieceIdentite) {
      documents.push({
        id: `piece-identite-${input.locataireId}`,
        title: "Pièce d'identité renseignée",
        subtitle: input.pieceIdentite,
        source: 'profile',
        status: 'available',
        created_at: null,
      });
    }

    const events = ((eventsRes.data ?? []) as unknown as RawEvent[]).map((event) => ({
      id: event.id,
      event_type: event.event_type,
      created_at: event.created_at,
      payload: event.payload,
    }));

    return { data: { payments, documents, events }, error: null };
  },

  async listOccupants(agencyId: string): Promise<{ data: OccupantBailPersonOption[]; error: unknown }> {
    const { data, error } = await supabase
      .from('locataires')
      .select('id, nom, prenom, telephone, email')
      .eq('agency_id', agencyId)
      .eq('actif', true)
      .order('prenom', { ascending: true })
      .order('nom', { ascending: true });

    if (error) return { data: [], error };
    return { data: (data ?? []) as unknown as RawPersonOption[], error: null };
  },

  async listAvailableUnits(agencyId: string): Promise<{ data: OccupantBailAvailableUnit[]; error: unknown }> {
    const { data, error } = await supabase
      .from('unites')
      .select(`
        id,
        nom,
        numero,
        etage,
        loyer_base,
        immeubles(
          id,
          nom,
          bailleurs(commission, nom, prenom)
        )
      `)
      .eq('agency_id', agencyId)
      .eq('actif', true)
      .eq('statut', 'libre')
      .order('nom', { ascending: true });

    if (error) return { data: [], error };

    const units = ((data ?? []) as unknown as RawAvailableUnit[]).map((unit) => ({
      id: unit.id,
      nom: unit.nom,
      loyer_base: unit.loyer_base,
      numero: unit.numero ?? null,
      etage: unit.etage ?? null,
      immeuble_nom: unit.immeubles?.nom ?? null,
      immeuble_id: unit.immeubles?.id ?? null,
      bailleur_commission: unit.immeubles?.bailleurs?.commission ?? null,
      bailleur_nom: unit.immeubles?.bailleurs?.nom ?? null,
      bailleur_prenom: unit.immeubles?.bailleurs?.prenom ?? null,
    }));

    return { data: units, error: null };
  },

  async createOccupant(input: {
    agencyId: string;
    userId?: string | null;
    data: OccupantBailPersonInput;
  }): Promise<{ data: { id: string } | null; error: unknown }> {
    const { data, error } = await supabase
      .from('locataires')
      .insert([{
        ...input.data,
        agency_id: input.agencyId,
        created_by: input.userId ?? null,
      }])
      .select('id')
      .single();

    if (error) return { data: null, error };
    return { data: data as { id: string }, error: null };
  },

  async updateOccupant(input: {
    agencyId: string;
    occupantId: string;
    data: OccupantBailPersonInput;
  }): Promise<{ error: unknown }> {
    const { error } = await supabase
      .from('locataires')
      .update(input.data)
      .eq('id', input.occupantId)
      .eq('agency_id', input.agencyId)
      .select('id')
      .single();

    return { error };
  },

  async contractPdfData(input: {
    agencyId: string;
    contratId: string;
  }): Promise<{ data: OccupantBailContractPdfData | null; error: unknown }> {
    const { data, error } = await supabase
      .from('contrats')
      .select(`
        *,
        locataires(nom, prenom, telephone, email, adresse_personnelle, piece_identite),
        unites(
          nom,
          loyer_base,
          immeubles(
            nom,
            adresse,
            bailleurs(nom, prenom, telephone, adresse)
          )
        )
      `)
      .eq('id', input.contratId)
      .eq('agency_id', input.agencyId)
      .single();

    if (error) return { data: null, error };
    return { data: data as OccupantBailContractPdfData, error: null };
  },
};
