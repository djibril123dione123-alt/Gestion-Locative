// Données fictives réalistes utilisées uniquement pour l'aperçu en direct des
// modèles de documents (Studio, Paramètres). Chaque fonction renvoie un objet
// dans la forme EXACTE attendue par le vrai générateur PDF (src/lib/pdf.ts) —
// aucun adaptateur n'est nécessaire, ces objets sont passés tels quels aux
// fonctions buildXxxPreviewDocument.
//
// Toute donnée ici est clairement fictive (noms/adresses de démonstration) et
// ne doit jamais être confondue avec une vraie entité — voir le nom du fichier.

import type { ContratPDFData, MandatPDFData, PaiementPDFData } from '../../types/pdf';
import type { OwnerReportSnapshotPayload } from '../../services/api/documentSnapshotApi';

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

export function getRapportPreviewSample(): OwnerReportSnapshotPayload {
  return {
    schemaVersion: 'owner_report_v1',
    generatedAt: '2026-07-31T00:00:00.000Z',
    agencyId: 'preview-agency',
    bailleurId: 'preview-bailleur',
    period: { start: '2026-07-01', end: '2026-07-31' },
    owner: { id: 'preview-bailleur', nom: 'Ndiaye', prenom: 'Moussa' },
    totals: {
      collected: 1250000,
      arrears: 150000,
      commissions: 125000,
      expenses: 45000,
      ownerShare: 1080000,
      netToPay: 1080000,
      activeContracts: 3,
      recoveryRate: 89,
    },
    contracts: [
      {
        contrat_id: 'preview-c1', immeuble_id: 'preview-i1', immeuble: 'Résidence Alima', unite_id: 'preview-u1', unite: 'Appt A1',
        locataire: 'Aissatou Diop', loyer_mensuel: 450000, encaisse: 450000, reliquat: 0, commission: 45000, part_bailleur: 405000, statut: 'paye',
      },
      {
        contrat_id: 'preview-c2', immeuble_id: 'preview-i1', immeuble: 'Résidence Alima', unite_id: 'preview-u2', unite: 'Appt A2',
        locataire: 'Ibrahima Fall', loyer_mensuel: 400000, encaisse: 250000, reliquat: 150000, commission: 40000, part_bailleur: 210000, statut: 'partiel',
      },
      {
        contrat_id: 'preview-c3', immeuble_id: 'preview-i2', immeuble: 'Villa Ngor', unite_id: 'preview-u3', unite: 'Villa entière',
        locataire: 'Cheikh Ba', loyer_mensuel: 550000, encaisse: 550000, reliquat: 0, commission: 40000, part_bailleur: 510000, statut: 'paye',
      },
    ],
    payments: [],
    expenses: [
      { id: 'preview-e1', date_depense: '2026-07-05', categorie: 'Plomberie', description: 'Réparation fuite Appt A2', beneficiaire: null, montant: 25000, piece_justificative: null, immeuble_id: 'preview-i1', immeuble: 'Résidence Alima' },
      { id: 'preview-e2', date_depense: '2026-07-18', categorie: 'Peinture', description: 'Rafraîchissement Villa Ngor', beneficiaire: null, montant: 20000, piece_justificative: null, immeuble_id: 'preview-i2', immeuble: 'Villa Ngor' },
    ],
    receivables: [],
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
