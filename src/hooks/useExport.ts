/**
 * useExport — export Excel (.xlsx) pour les données métier.
 * Génération 100% côté client avec ExcelJS.
 *
 * Usage:
 *   const { exportLocataires, exportPaiements, exportContrats, exporting } = useExport();
 */

import { useState, useCallback } from 'react';
import type { Workbook, Worksheet } from 'exceljs';
import { announceGeneratedDocument, type GeneratedDocumentPreview } from '../lib/documentGenerated';
import { formatSenegalPhone } from '../lib/formatters';

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

async function downloadWorkbook(
  workbook: Workbook,
  filename: string,
  title: string,
  preview: GeneratedDocumentPreview
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.click();

  announceGeneratedDocument({
    kind: 'xlsx',
    title,
    fileName: filename,
    url,
    blob,
    mimeType: blob.type,
    fileSize: blob.size,
    source: 'exports',
    preview,
  });
}

function addWorksheet(
  workbook: Workbook,
  name: string,
  rows: Array<Record<string, string | number | null>>,
  widths: number[],
): Worksheet {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: widths[index] ?? 18,
  }));
  worksheet.addRows(rows);
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FF0B3B2E' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF7F1' },
  };
  worksheet.autoFilter = headers.length
    ? { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
    : undefined;
  return worksheet;
}

async function createWorkbook(): Promise<Workbook> {
  const { Workbook: ExcelWorkbook } = await import('exceljs');
  return new ExcelWorkbook();
}

function fmt(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  return String(v);
}

function fmtPhone(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return formatSenegalPhone(String(v), '');
}

function buildPreview(
  rows: Array<Record<string, string | number | null>>,
  stats: GeneratedDocumentPreview['stats'] = []
): GeneratedDocumentPreview {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return {
    columns,
    rows: rows.slice(0, 6),
    rowCount: rows.length,
    stats: [{ label: 'Lignes', value: rows.length }, ...stats],
  };
}

export interface UseExportReturn {
  exporting: boolean;
  exportLocataires: (data: ExportLocataire[], filename?: string) => Promise<void>;
  exportPaiements: (data: ExportPaiement[], filename?: string) => Promise<void>;
  exportContrats: (data: ExportContrat[], filename?: string) => Promise<void>;
  exportAll: (data: {
    locataires?: ExportLocataire[];
    paiements?: ExportPaiement[];
    contrats?: ExportContrat[];
  }) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    setExporting(true);
    try {
      await fn();
    } finally {
      setExporting(false);
    }
  }, []);

  const exportLocataires = useCallback(
    (data: ExportLocataire[], filename = 'locataires.xlsx') => {
      return run(async () => {
        const rows = data.map((l) => ({
          Prénom: fmt(l.prenom),
          Nom: fmt(l.nom),
          Téléphone: fmtPhone(l.telephone),
          Email: fmt(l.email),
          Adresse: fmt(l.adresse_personnelle),
        }));
        const workbook = await createWorkbook();
        addWorksheet(workbook, 'Locataires', rows, [20, 20, 18, 28, 35]);
        await downloadWorkbook(workbook, filename, 'Export locataires', buildPreview(rows));
      });
    },
    [run],
  );

  const exportPaiements = useCallback(
    (data: ExportPaiement[], filename = 'paiements.xlsx') => {
      return run(async () => {
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
        const workbook = await createWorkbook();
        addWorksheet(workbook, 'Paiements', rows, [18, 14, 14, 14, 12, 18, 24, 20]);
        const total = data.reduce((sum, p) => sum + Number(p.montant_total ?? 0), 0);
        await downloadWorkbook(
          workbook,
          filename,
          'Export paiements',
          buildPreview(rows, [{ label: 'Montant total', value: total.toLocaleString('fr-FR') }])
        );
      });
    },
    [run],
  );

  const exportContrats = useCallback(
    (data: ExportContrat[], filename = 'contrats.xlsx') => {
      return run(async () => {
        const rows = data.map((c) => ({
          Locataire: fmt(c.locataire_nom),
          Unité: fmt(c.unite_nom),
          Immeuble: fmt(c.immeuble_nom),
          'Début': fmt(c.date_debut),
          'Fin': fmt(c.date_fin),
          'Loyer (F CFA)': fmt(c.loyer_mensuel),
          Statut: fmt(c.statut),
          Destination: fmt(c.destination),
        }));
        const workbook = await createWorkbook();
        addWorksheet(workbook, 'Contrats', rows, [24, 18, 20, 14, 14, 16, 12, 14]);
        await downloadWorkbook(workbook, filename, 'Export contrats', buildPreview(rows));
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
      return run(async () => {
        const workbook = await createWorkbook();
        const date = new Date().toISOString().slice(0, 10);

        if (data.locataires?.length) {
          const rows = data.locataires.map((l) => ({
            Prénom: fmt(l.prenom),
            Nom: fmt(l.nom),
            Téléphone: fmtPhone(l.telephone),
            Email: fmt(l.email),
          }));
          addWorksheet(workbook, 'Locataires', rows, [20, 20, 18, 28]);
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
          addWorksheet(workbook, 'Paiements', rows, [18, 14, 14, 14, 12, 24]);
        }

        if (data.contrats?.length) {
          const rows = data.contrats.map((c) => ({
            Locataire: fmt(c.locataire_nom),
            Unité: fmt(c.unite_nom),
            'Début': fmt(c.date_debut),
            'Loyer (F CFA)': fmt(c.loyer_mensuel),
            Statut: fmt(c.statut),
          }));
          addWorksheet(workbook, 'Contrats', rows, [24, 18, 14, 16, 12]);
        }

        if (workbook.worksheets.length === 0) return;
        const rows = [
          { Feuille: 'Locataires', Lignes: data.locataires?.length ?? 0 },
          { Feuille: 'Paiements', Lignes: data.paiements?.length ?? 0 },
          { Feuille: 'Contrats', Lignes: data.contrats?.length ?? 0 },
        ];
        await downloadWorkbook(
          workbook,
          `samay-keur-export-${date}.xlsx`,
          'Export complet Samay Këur',
          buildPreview(rows),
        );
      });
    },
    [run],
  );

  return { exporting, exportLocataires, exportPaiements, exportContrats, exportAll };
}
