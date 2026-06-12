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

export type ContratStatut = 'actif' | 'resilie' | 'expire' | 'archive' | 'en_attente';

export interface OccupantBailRow {
  /** Identifiant du contrat (bail) */
  contrat_id: string;
  /** Identifiant du locataire */
  locataire_id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;

  /** Référence du contrat – numéro court lisible */
  contrat_ref: string;

  /** Bail */
  date_debut: string;
  date_fin: string | null;
  loyer_mensuel: number;
  statut: ContratStatut;
  destination: string;

  /** Unité */
  unite_id: string;
  unite_nom: string;

  /** Bien (immeuble) */
  immeuble_id: string | null;
  immeuble_nom: string | null;
  immeuble_adresse: string | null;

  /** Bailleur */
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
  statut,
  destination,
  locataires(id, nom, prenom, telephone, email),
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
  statut: string;
  destination: string;
  locataires: { id: string; nom: string; prenom: string; telephone: string | null; email: string | null } | null;
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

function mapRow(row: RawRow): OccupantBailRow {
  return {
    contrat_id: row.id,
    locataire_id: row.locataire_id,
    nom: row.locataires?.nom ?? '',
    prenom: row.locataires?.prenom ?? '',
    telephone: row.locataires?.telephone ?? null,
    email: row.locataires?.email ?? null,
    contrat_ref: buildContratRef(row.id),
    date_debut: row.date_debut,
    date_fin: row.date_fin,
    loyer_mensuel: row.loyer_mensuel,
    statut: row.statut as ContratStatut,
    destination: row.destination,
    unite_id: row.unites?.id ?? '',
    unite_nom: row.unites?.nom ?? '—',
    immeuble_id: row.unites?.immeubles?.id ?? null,
    immeuble_nom: row.unites?.immeubles?.nom ?? null,
    immeuble_adresse: row.unites?.immeubles?.adresse ?? null,
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
};
