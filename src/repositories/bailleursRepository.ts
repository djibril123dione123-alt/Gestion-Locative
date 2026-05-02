/**
 * bailleursRepository — accès Supabase pour la table bailleurs.
 *
 * Responsabilité unique : exécuter les requêtes DB et retourner les données brutes.
 * Aucune logique métier ici.
 *
 * Pattern : UI → Service domain → Repository → Supabase
 */

import { supabase } from '../lib/supabase';

export interface BailleurListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  piece_identite: string | null;
  notes: string | null;
  commission: number | null;
  debut_contrat: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface BailleurInsert {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string | null;
  adresse?: string | null;
  piece_identite?: string | null;
  notes?: string | null;
  commission?: number | null;
  debut_contrat?: string | null;
  agency_id: string;
}

export interface BailleurUpdate
  extends Partial<Omit<BailleurInsert, 'agency_id'>> {}

const BAILLEUR_SELECT =
  'id, nom, prenom, telephone, email, adresse, piece_identite, notes, commission, debut_contrat, actif, created_at, updated_at' as const;

export const bailleursRepository = {
  /**
   * Charge tous les bailleurs actifs d'une agence, triés par date de création desc.
   */
  async list(agencyId: string) {
    const { data, error } = await supabase
      .from('bailleurs')
      .select(BAILLEUR_SELECT)
      .eq('agency_id', agencyId)
      .eq('actif', true)
      .order('created_at', { ascending: false });
    return { data: (data ?? []) as BailleurListItem[], error };
  },

  /**
   * Charge un bailleur par ID, avec vérification multi-tenant.
   */
  async findById(id: string, agencyId: string) {
    const { data, error } = await supabase
      .from('bailleurs')
      .select(BAILLEUR_SELECT)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();
    return { data: data as BailleurListItem | null, error };
  },

  /**
   * Charge un bailleur avec ses immeubles associés (pour le mandat PDF).
   */
  async findWithImmeubles(id: string, agencyId: string) {
    const { data, error } = await supabase
      .from('bailleurs')
      .select(
        `${BAILLEUR_SELECT},
         immeubles(id, nom, adresse, nb_unites)`,
      )
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();
    return { data, error };
  },

  /**
   * Insère un nouveau bailleur.
   */
  async insert(payload: BailleurInsert) {
    const { data, error } = await supabase
      .from('bailleurs')
      .insert([payload])
      .select('id')
      .single();
    return { data, error };
  },

  /**
   * Met à jour un bailleur existant (multi-tenant safe : eq agency_id dans la policy RLS).
   */
  async update(id: string, payload: BailleurUpdate) {
    const { error } = await supabase
      .from('bailleurs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { error };
  },

  /**
   * Suppression logique : marque actif = false et deleted_at.
   */
  async softDelete(id: string) {
    const { error } = await supabase
      .from('bailleurs')
      .update({ actif: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    return { error };
  },
};
