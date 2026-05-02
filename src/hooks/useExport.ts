/**
 * useExport — export Excel (.xlsx) et PDF pour les données métier.
 * Génération 100% côté client. Librairies : xlsx (SheetJS) + jsPDF (déjà installées).
 *
 * Usage:
 *   const { exportLocataires, exportPaiements, exportContrats, exporting } = useExport();
 */

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';

export interface ExportLocataire {
  nom: string;
  prenom: string;
  telephone?: string | null;
  email?: string | null;
  adresse_personnelle?: string | null;
}

export interface ExportPaiement {
  reference?: string | null;
  date_paiement?: string | null;
  mois_concerne?: string | null;
  montant_total?: number | null;
  statut?: string | null;
  mode_paiement?: string | null;
  locataire_nom?: string | null;
  unite_nom?: string | null;
}

export interface ExportContrat {
  locataire_nom?: string | null;
  unite_nom?: string | null;
  immeuble_nom?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  loyer_mensuel?: number | null;
  statut?: string | null;
  destination?: string | null;
}

function downloadXlsx(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

function fmt(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  return String(v);
}

export interface UseExportReturn {
  exporting: boolean;
  exportLocataires: (data: ExportLocataire[], filename?: string) => void;
  exportPaiements: (data: ExportPaiement[], filename?: string) => void;
  exportContrats: (data: ExportContrat[], filename?: string) => void;
  exportAll: (data: {
    locataires?: ExportLocataire[];
    paiements?: ExportPaiement[];
    contrats?: ExportContrat[];
  }) => void;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);

  const run = useCallback(<T>(fn: () => T): T => {
    setExporting(true);
    try {
      return fn();
    } finally {
      setExporting(false);
    }
  }, []);

  const exportLocataires = useCallback(
    (data: ExportLocataire[], filename = 'locataires.xlsx') => {
      run(() => {
        const rows = data.map((l) => ({
          Nom: fmt(l.nom),
          Prénom: fmt(l.prenom),
          Téléphone: fmt(l.telephone),
          Email: fmt(l.email),
          Adresse: fmt(l.adresse_personnelle),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [20, 20, 18, 28, 35].map((w) => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Locataires');
        downloadXlsx(wb, filename);
      });
    },
    [run],
  );

  const exportPaiements = useCallback(
    (data: ExportPaiement[], filename = 'paiements.xlsx') => {
      run(() => {
        const rows = data.map((p) => ({
          Référence: fmt(p.reference),
          Date: fmt(p.date_paiement),
          'Mois concerné': fmt(p.mois_concerne),
          Montant: fmt(p.montant_total),
          Statut: fmt(p.statut),
          'Mode de paiement': fmt(p.mode_paiement),
          Locataire: fmt(p.locataire_nom),
          Unité: fmt(p.unite_nom),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [18, 14, 14, 14, 12, 18, 24, 20].map((w) => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
        downloadXlsx(wb, filename);
      });
    },
    [run],
  );

  const exportContrats = useCallback(
    (data: ExportContrat[], filename = 'contrats.xlsx') => {
      run(() => {
        const rows = data.map((c) => ({
          Locataire: fmt(c.locataire_nom),
          Unité: fmt(c.unite_nom),
          Immeuble: fmt(c.immeuble_nom),
          'Début': fmt(c.date_debut),
          'Fin': fmt(c.date_fin),
          'Loyer (FCFA)': fmt(c.loyer_mensuel),
          Statut: fmt(c.statut),
          Destination: fmt(c.destination),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [24, 18, 20, 14, 14, 16, 12, 14].map((w) => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contrats');
        downloadXlsx(wb, filename);
      });
    },
    [run],
  );

  const exportAll = useCallback(
    (data: {
      locataires?: ExportLocataire[];
      paiements?: ExportPaiement[];
      contrats?: ExportContrat[];
    }) => {
      run(() => {
        const wb = XLSX.utils.book_new();
        const date = new Date().toISOString().slice(0, 10);

        if (data.locataires?.length) {
          const rows = data.locataires.map((l) => ({
            Nom: fmt(l.nom),
            Prénom: fmt(l.prenom),
            Téléphone: fmt(l.telephone),
            Email: fmt(l.email),
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [20, 20, 18, 28].map((w) => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, 'Locataires');
        }

        if (data.paiements?.length) {
          const rows = data.paiements.map((p) => ({
            Référence: fmt(p.reference),
            Date: fmt(p.date_paiement),
            'Mois': fmt(p.mois_concerne),
            Montant: fmt(p.montant_total),
            Statut: fmt(p.statut),
            Locataire: fmt(p.locataire_nom),
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [18, 14, 14, 14, 12, 24].map((w) => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
        }

        if (data.contrats?.length) {
          const rows = data.contrats.map((c) => ({
            Locataire: fmt(c.locataire_nom),
            Unité: fmt(c.unite_nom),
            'Début': fmt(c.date_debut),
            'Loyer (FCFA)': fmt(c.loyer_mensuel),
            Statut: fmt(c.statut),
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [24, 18, 14, 16, 12].map((w) => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, 'Contrats');
        }

        if (wb.SheetNames.length === 0) return;
        downloadXlsx(wb, `samay-keur-export-${date}.xlsx`);
      });
    },
    [run],
  );

  return { exporting, exportLocataires, exportPaiements, exportContrats, exportAll };
}
