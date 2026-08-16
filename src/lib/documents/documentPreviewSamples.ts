// Données fictives réalistes utilisées uniquement pour l'aperçu en direct des
// modèles de documents (Studio, Paramètres). Chaque fonction renvoie un objet
// dans la forme EXACTE attendue par le vrai générateur PDF (src/lib/pdf.ts) —
// aucun adaptateur n'est nécessaire, ces objets sont passés tels quels aux
// fonctions buildXxxPreviewDocument.
//
// Toute donnée ici est clairement fictive (noms/adresses de démonstration) et
// ne doit jamais être confondue avec une vraie entité — voir le nom du fichier.

import type { ContratPDFData, MandatPDFData, PaiementPDFData } from '../../types/pdf';

/** Référence factice stable, jamais allouée via le compteur réel. */
export const PREVIEW_REFERENCE_PLACEHOLDER = 'APERCU-0000';

export function getContratPreviewSample(): ContratPDFData {
  return {
    id: 'preview-contrat',
    agency_id: 'preview-agency',
    locataire_id: 'preview-locataire',
    unite_id: 'preview-unite',
    date_debut: '2026-07-01',
    date_fin: '2027-06-30',
    loyer_mensuel: 300000,
    caution: 300000,
    commission: 10,
    statut: 'actif',
    notes: null,
    destination: 'Habitation',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    created_by: null,
    locataires: {
      nom: 'Sarr',
      prenom: 'Fatou',
      piece_identite: '2 01 19940112 00456 7',
      adresse_personnelle: 'Ouakam, Dakar',
    },
    unites: {
      nom: 'Appartement F4',
      immeubles: {
        nom: 'Résidence Alima',
        adresse: 'Rue 12, Ouakam, Dakar',
        bailleurs: {
          nom: 'Ndiaye',
          prenom: 'Moussa',
        },
      },
    },
  };
}

export function getPaiementPreviewSample(reliquat: number): PaiementPDFData {
  const loyer = 300000;
  const paye = Math.max(loyer - reliquat, 0);
  return {
    id: 'preview-paiement',
    agency_id: 'preview-agency',
    contrat_id: 'preview-contrat',
    montant_total: paye,
    mois_concerne: '2026-07-01',
    date_paiement: '2026-07-05',
    mode_paiement: 'virement',
    part_agence: Math.round(paye * 0.1),
    part_bailleur: Math.round(paye * 0.9),
    montant_attendu: loyer,
    montant_encaisse_cumul: paye,
    reliquat,
    statut: reliquat > 0 ? 'partiel' : 'paye',
    reference: null,
    piece_justificative: null,
    notes: null,
    created_at: '2026-07-05T00:00:00.000Z',
    updated_at: '2026-07-05T00:00:00.000Z',
    created_by: null,
    actif: true,
    deleted_at: null,
    paiements_precedents: 0,
    total_paye_mois: paye,
    statut_reel_mois: reliquat > 0 ? 'partiel' : 'paye',
    contrats: {
      loyer_mensuel: loyer,
      locataires: {
        nom: 'Sarr',
        prenom: 'Fatou',
      },
      unites: {
        immeubles: {
          adresse: 'Rue 12, Ouakam, Dakar',
        },
      },
    },
  };
}

export function getMandatPreviewSample(): MandatPDFData {
  return {
    id: 'preview-bailleur',
    agency_id: 'preview-agency',
    nom: 'Ndiaye',
    prenom: 'Moussa',
    telephone: '77 000 12 34',
    email: null,
    adresse: 'Point E, Dakar',
    piece_identite: '1 02 19850304 00789 3',
    notes: null,
    actif: true,
    commission: 10,
    debut_contrat: '2026-07-01',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    created_by: null,
    bien_adresse: 'Résidence Alima, Rue 12, Ouakam, Dakar',
    bien_composition: '4 appartements F3/F4',
    duree_annees: 3,
  };
}
