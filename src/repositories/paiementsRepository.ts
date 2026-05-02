/**
 * paiementsRepository — accès Supabase pour la table paiements.
 *
 * Responsabilité unique : exécuter les requêtes DB et retourner les données brutes.
 * Aucune logique métier ici — voir paiementService pour les calculs.
 *
 * Pattern : chaque méthode retourne { data, error } pour permettre au hook
 * appelant de gérer l'affichage d'erreur.
 */

import { supabase } from '../lib/supabase';

export interface PaiementListItem {
  id: string;
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  reference: string | null;
  created_at: string;
  contrats: {
    loyer_mensuel: number;
    commission: number | null;
    locataires: { nom: string; prenom: string } | null;
    unites: { nom: string; id: string } | null;
  } | null;
}

export interface PaiementInsert {
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  reference: string | null;
  part_agence: number;
  part_bailleur: number;
  agency_id: string;
}

export interface PaiementUpdate extends Partial<Omit<PaiementInsert, 'agency_id' | 'contrat_id'>> {}

const PAIEMENT_SELECT = `
  id, contrat_id, montant_total, mois_concerne, date_paiement,
  mode_paiement, statut, reference, created_at,
  contrats(loyer_mensuel, commission, locataires(nom, prenom), unites(nom, id))
` as const;

export const paiementsRepository = {
  /**
   * Charge tous les paiements d'une agence, triés par date de création desc.
   * Pagination serveur : from/to (0-indexed, inclus).
   */
  async list(
    agencyId: string,
    options: { from?: number; to?: number } = {},
  ) {
    let query = supabase
      .from('paiements')
      .select(PAIEMENT_SELECT)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (options.from !== undefined && options.to !== undefined) {
      query = query.range(options.from, options.to);
    }

    const { data, error } = await query;
    return { data: (data ?? []) as unknown as PaiementListItem[], error };
  },

  /** Charge les contrats actifs pour le sélecteur du formulaire */
  async listActiveContrats(agencyId: string) {
    const { data, error } = await supabase
      .from('contrats')
      .select('id, loyer_mensuel, commission, locataires(nom, prenom), unites(nom)')
      .eq('agency_id', agencyId)
      .eq('statut', 'actif');
    return { data: data ?? [], error };
  },

  /** Charge un paiement complet pour la génération PDF */
  async findForPDF(agencyId: string, paiementId: string) {
    const { data, error } = await supabase
      .from('paiements')
      .select(
        `id, created_at, date_paiement, mois_concerne, montant_total, reference,
         contrats(id, loyer_mensuel, commission, locataires(nom, prenom), unites(id, nom))`,
      )
      .eq('agency_id', agencyId)
      .eq('id', paiementId)
      .single();
    return { data, error };
  },

  /** Insère un nouveau paiement */
  async insert(payload: PaiementInsert) {
    const { data, error } = await supabase
      .from('paiements')
      .insert([payload])
      .select('id')
      .single();
    return { data, error };
  },

  /** Met à jour un paiement existant */
  async update(id: string, payload: PaiementUpdate) {
    const { error } = await supabase
      .from('paiements')
      .update(payload)
      .eq('id', id);
    return { error };
  },

  /**
   * Suppression logique (soft delete) : set deleted_at au lieu de DELETE.
   * Garantit un audit trail complet et la possibilité de restauration.
   */
  async softDelete(id: string) {
    const { error } = await supabase
      .from('paiements')
      .update({ deleted_at: new Date().toISOString(), actif: false })
      .eq('id', id);
    return { error };
  },

  /** Suppression physique (pour les purges administratives) */
  async hardDelete(id: string) {
    const { error } = await supabase.from('paiements').delete().eq('id', id);
    return { error };
  },
};
