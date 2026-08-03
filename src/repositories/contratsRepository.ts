/**
 * contratsRepository — accès Supabase pour la table contrats.
 *
 * Responsabilité unique : exécuter les requêtes DB et retourner les données brutes.
 * Aucune logique métier ici — voir contratService pour les validations.
 *
 * Pattern : UI -> Service domain -> Repository -> Supabase
 */

import { supabase } from '../lib/supabase';

export interface ContratListItem {
  id: string;
  unite_id: string;
  locataire_id: string;
  loyer_mensuel: number;
  caution: number | null;
  commission: number | null;
  date_debut: string;
  date_fin: string | null;
  statut: 'actif' | 'resilie' | 'expire' | 'archive' | 'en_attente';
  destination: 'Habitation' | 'Commercial' | string;
  notes: string | null;
  actif: boolean;
  created_at: string;
  locataires: { nom: string; prenom: string; telephone?: string } | null;
  unites: {
    id: string;
    nom: string;
    loyer_base: number;
    immeubles: {
      id: string;
      nom: string;
      adresse?: string;
      bailleurs: { id: string; nom: string; prenom: string; commission?: number } | null;
    } | null;
  } | null;
}

export interface ContratInsert {
  unite_id: string;
  locataire_id: string;
  loyer_mensuel: number;
  caution?: number | null;
  commission: number;
  date_debut: string;
  date_fin?: string | null;
  statut: string;
  destination: string;
  notes?: string | null;
  agency_id: string;
}

export type ContratUpdate = Partial<Omit<ContratInsert, 'agency_id' | 'unite_id' | 'locataire_id'>>;

const CONTRAT_SELECT = `
  id, unite_id, locataire_id, loyer_mensuel, caution, commission,
  date_debut, date_fin, statut, destination, notes, actif, created_at,
  locataires(nom, prenom, telephone),
  unites(id, nom, loyer_base, immeubles(id, nom, adresse, bailleurs(id, nom, prenom, commission)))
` as const;

export const contratsRepository = {
  /**
   * Charge tous les contrats d'une agence.
   * @param statut — filtre optionnel : 'actif' | 'resilie' | ...
   */
  async list(agencyId: string, statut?: string) {
    let query = supabase
      .from('contrats')
      .select(CONTRAT_SELECT)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data, error } = await query;
    return { data: (data ?? []) as unknown as ContratListItem[], error };
  },

  /**
   * Charge un contrat par ID, avec vérification multi-tenant.
   */
  async findById(id: string, agencyId: string) {
    const { data, error } = await supabase
      .from('contrats')
      .select(CONTRAT_SELECT)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();
    return { data: data as unknown as ContratListItem | null, error };
  },

  /**
   * Charge uniquement la commission d'un contrat (utilisé pour les paiements).
   */
  async findCommission(contratId: string) {
    const { data, error } = await supabase
      .from('contrats')
      .select('id, loyer_mensuel, commission')
      .eq('id', contratId)
      .maybeSingle();
    return { data, error };
  },

  /**
   * Charge les contrats actifs pour le sélecteur du formulaire de paiement.
   */
  async listActive(agencyId: string) {
    const { data, error } = await supabase
      .from('contrats')
      .select('id, loyer_mensuel, commission, locataires(nom, prenom), unites(nom)')
      .eq('agency_id', agencyId)
      .eq('statut', 'actif');
    return { data: data ?? [], error };
  },

  /**
   * Les mutations contractuelles sont transactionnelles et passent
   * obligatoirement par les Edge Functions du contratApi.
   */
  async insert(_payload: ContratInsert) {
    void _payload;
    throw new Error('DIRECT_CONTRACT_WRITE_BLOCKED');
  },

  /**
   * Voir createContratViaEdge / updateContratViaEdge / renewContratViaEdge.
   */
  async update(_id: string, _payload: ContratUpdate) {
    void _id;
    void _payload;
    throw new Error('DIRECT_CONTRACT_WRITE_BLOCKED');
  },
};
