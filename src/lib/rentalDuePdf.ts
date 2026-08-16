import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AgencySettings } from '../types';
import type {
  RentalDue,
  RentalDueAllocation,
  RentalDueDetail,
  RentalDueDocument,
  RentalDueDocumentType,
  RentalDueLine,
} from '../services/api/rentalDueApi';
import type { DocumentGenerationLifecycle } from './documentGeneration';
import {
  addFooter,
  drawDocumentHeader,
  drawKeyValueGrid,
  drawLegalVerificationFooter,
  drawPageBorder,
  drawPaymentSummaryCard,
  drawSignatureBlocks,
  drawSubtleSectionTitle,
  formatCurrency,
  getAutoTableTheme,
  loadAgencySettings,
  saveGeneratedPdf,
} from './pdf';
import { getDocumentTypeLabel } from './documents/documentTypes';

interface RentalDuePdfInput {
  detail: RentalDueDetail;
  preparedDocument: RentalDueDocument;
  generation: DocumentGenerationLifecycle;
}

interface RentalDueDocumentCopy {
  title: string;
  shortTitle: string;
  subject: string;
  kind: 'facture' | 'quittance';
  verificationType: string;
}

const DOCUMENT_COPY: Record<RentalDueDocumentType, RentalDueDocumentCopy> = {
  due_notice: {
    title: getDocumentTypeLabel('due_notice'),
    shortTitle: "Avis d'échéance",
    subject: "Avis d'échéance de loyer",
    kind: 'facture',
    verificationType: 'avis_echeance',
  },
  rent_invoice: {
    title: getDocumentTypeLabel('rent_invoice'),
    shortTitle: 'Facture',
    subject: 'Facture de loyer',
    kind: 'facture',
    verificationType: 'facture_loyer',
  },
  partial_payment_receipt: {
    title: getDocumentTypeLabel('partial_payment_receipt'),
    shortTitle: 'Reçu partiel',
    subject: 'Reçu de paiement partiel de loyer',
    kind: 'quittance',
    verificationType: 'recu_paiement_partiel',
  },
  rent_receipt: {
    title: getDocumentTypeLabel('rent_receipt'),
    shortTitle: 'Quittance',
    subject: 'Quittance de loyer acquittée',
    kind: 'quittance',
    verificationType: 'quittance_loyer',
  },
  credit_note: {
    title: getDocumentTypeLabel('credit_note'),
    shortTitle: 'Avoir',
    subject: 'Avoir sur échéance locative',
    kind: 'facture',
    verificationType: 'avoir_locatif',
  },
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOf(value: unknown, fallback = 'Non renseigné'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} au ${end}`;
  }
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()
  ) {
    return startDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }
  return `${formatDate(start)} au ${formatDate(end)}`;
}

function dueFromSnapshot(
  preparedDocument: RentalDueDocument,
  fallback: RentalDueDetail,
): RentalDueDetail {
  const snapshot = recordOf(preparedDocument.data_snapshot);
  const due = recordOf(snapshot.due);
  return {
    due: Object.keys(due).length ? due as unknown as RentalDue : fallback.due,
    lines: arrayOf<RentalDueLine>(snapshot.lines).length
      ? arrayOf<RentalDueLine>(snapshot.lines)
      : fallback.lines,
    allocations: arrayOf<RentalDueAllocation>(snapshot.allocations).length
      ? arrayOf<RentalDueAllocation>(snapshot.allocations)
      : fallback.allocations,
    documents: fallback.documents,
    deliveries: fallback.deliveries,
    reminders: fallback.reminders,
    events: fallback.events,
  };
}

function settingsFromSnapshot(
  settings: Partial<AgencySettings>,
  due: RentalDue,
): Partial<AgencySettings> {
  const issuer = recordOf(due.issuer_snapshot);
  const address = stringOf(issuer.address, '');
  return {
    ...settings,
    nom_agence: stringOf(issuer.name, settings.nom_agence ?? 'Samay Këur'),
    adresse: address || settings.adresse,
    ninea: stringOf(issuer.ninea, '') || settings.ninea,
    rc: stringOf(issuer.rccm, '') || settings.rc,
  };
}

function partySnapshot(due: RentalDue) {
  const parties = recordOf(due.parties_snapshot);
  return {
    tenant: recordOf(parties.tenant),
    landlord: recordOf(parties.landlord),
  };
}

function contractSnapshot(due: RentalDue) {
  const contract = recordOf(due.contract_snapshot);
  return {
    contract,
    property: recordOf(contract.property),
    unit: recordOf(contract.unit),
  };
}

export function rentalDueDocumentLabel(type: RentalDueDocumentType) {
  return DOCUMENT_COPY[type].title;
}

export function buildRentalDueFinancialSummary(detail: RentalDueDetail) {
  const allocated = detail.allocations.reduce((total, allocation) => (
    total + (allocation.allocation_type === 'reversal' ? -1 : 1) * numberOf(allocation.amount)
  ), 0);
  return {
    amountHt: numberOf(detail.due.amount_ht),
    taxAmount: numberOf(detail.due.tax_amount),
    amountTtc: numberOf(detail.due.amount_ttc),
    allocatedAmount: numberOf(detail.due.allocated_amount) || Math.max(allocated, 0),
    outstandingAmount: Math.max(numberOf(detail.due.outstanding_amount), 0),
    priorBalance: Math.max(numberOf(detail.due.prior_balance), 0),
    creditApplied: Math.max(numberOf(detail.due.credit_applied), 0),
  };
}

function statusLabel(type: RentalDueDocumentType, outstanding: number): string {
  if (type === 'rent_receipt') return 'ACQUITTÉ';
  if (type === 'partial_payment_receipt') return 'PAIEMENT PARTIEL';
  if (type === 'credit_note') return 'AVOIR ÉMIS';
  return outstanding > 0 ? 'À RÉGLER' : 'SOLDÉ';
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  neededHeight: number,
  settings: Partial<AgencySettings>,
): number {
  if (y + neededHeight <= doc.internal.pageSize.getHeight() - 58) return y;
  doc.addPage();
  drawPageBorder(doc, settings);
  return 22;
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function renderFiscalNotice(
  doc: jsPDF,
  y: number,
  due: RentalDue,
): number {
  const fiscal = recordOf(due.fiscal_snapshot);
  const legal = recordOf(due.legal_snapshot);
  const validation = stringOf(fiscal.validation_status, 'pending');
  const treatment = stringOf(fiscal.rent_tax_treatment, 'unknown');
  if (validation === 'validated' && treatment !== 'unknown') return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 146, 60);
  doc.roundedRect(14, y, pageWidth - 28, 15, 2, 2, 'FD');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(154, 52, 18);
  doc.text('Traitement fiscal à confirmer', 18, y + 5.5);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7);
  const warning = stringOf(
    legal.warning,
    "Le profil fiscal du bailleur doit être validé avant utilisation comptable définitive.",
  );
  doc.text(doc.splitTextToSize(warning, pageWidth - 38), 18, y + 10);
  doc.setTextColor(0, 0, 0);
  return y + 20;
}

export async function generateRentalDuePdf({
  detail,
  preparedDocument,
  generation,
}: RentalDuePdfInput) {
  const snapshotDetail = dueFromSnapshot(preparedDocument, detail);
  const due = snapshotDetail.due;
  const copy = DOCUMENT_COPY[preparedDocument.document_type];
  const reference = preparedDocument.reference ?? due.reference ?? preparedDocument.id;
  const parties = partySnapshot(due);
  const contract = contractSnapshot(due);
  const summary = buildRentalDueFinancialSummary(snapshotDetail);
  const period = formatPeriod(due.period_start, due.period_end);
  const settings = settingsFromSnapshot(await loadAgencySettings(), due);
  const issuerName = settings.nom_agence ?? 'Samay Këur';
  const tenantName = stringOf(parties.tenant.name);
  const landlordName = stringOf(parties.landlord.name);
  const propertyName = stringOf(contract.property.name);
  const unitName = stringOf(contract.unit.name ?? contract.unit.number);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;

  generation.report('building-document', { reference });
  drawPageBorder(doc, settings);
  let y = await drawDocumentHeader(
    doc,
    settings,
    copy.title,
    `Période : ${period}`,
    {
      documentType: copy.shortTitle,
      reference,
      issueDate: formatDate(preparedDocument.created_at),
    },
  );

  y = drawKeyValueGrid(doc, 14, y, contentWidth, [
    ['Locataire', tenantName],
    ['Bailleur', landlordName],
    ['Bien', propertyName],
    ['Unité', unitName],
    ['Date d’échéance', formatDate(due.due_date)],
    ['Référence contrat', stringOf(contract.contract.id ?? due.contract_id)],
  ], settings);

  y = drawSubtleSectionTitle(
    doc,
    14,
    y + 3,
    contentWidth,
    'Composition de l’échéance',
    settings,
    'Montants issus du snapshot canonique enregistré lors de la préparation.',
  );

  const taxable = snapshotDetail.lines.some((line) => numberOf(line.tax_amount) !== 0);
  const tableHead = taxable
    ? [['Libellé', 'Qté', 'Base HT', 'Taxe', 'Total TTC']]
    : [['Libellé', 'Qté', 'Montant']];
  const tableBody = snapshotDetail.lines.length
    ? snapshotDetail.lines.map((line) => taxable
      ? [
          line.label,
          numberOf(line.quantity).toLocaleString('fr-FR'),
          formatCurrency(numberOf(line.amount_ht)),
          formatCurrency(numberOf(line.tax_amount)),
          formatCurrency(numberOf(line.amount_ttc)),
        ]
      : [
          line.label,
          numberOf(line.quantity).toLocaleString('fr-FR'),
          formatCurrency(numberOf(line.amount_ttc)),
        ])
    : [['Loyer de la période', '1', formatCurrency(summary.amountTtc)]];

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    ...getAutoTableTheme(settings),
    columnStyles: taxable
      ? {
          0: { cellWidth: 72 },
          1: { halign: 'center', cellWidth: 16 },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        }
      : {
          0: { cellWidth: 118 },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'right' },
        },
  });
  y = lastTableY(doc, y + 20) + 6;

  y = ensureSpace(doc, y, 70, settings);
  y = drawPaymentSummaryCard(doc, 14, y, contentWidth, {
    paid: formatCurrency(summary.allocatedAmount),
    due: formatCurrency(summary.amountTtc),
    remaining: formatCurrency(summary.outstandingAmount),
    status: statusLabel(preparedDocument.document_type, summary.outstandingAmount),
    period,
  }, settings);

  if (summary.priorBalance > 0 || summary.creditApplied > 0) {
    y = drawKeyValueGrid(doc, 14, y, contentWidth, [
      ['Solde antérieur', formatCurrency(summary.priorBalance)],
      ['Crédit appliqué', formatCurrency(summary.creditApplied)],
    ], settings);
  }

  if (snapshotDetail.allocations.length > 0 && (
    preparedDocument.document_type === 'partial_payment_receipt' ||
    preparedDocument.document_type === 'rent_receipt'
  )) {
    y = ensureSpace(doc, y, 38, settings);
    y = drawSubtleSectionTitle(doc, 14, y + 2, contentWidth, 'Paiements affectés', settings);
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Mode d’affectation', 'Montant']],
      body: snapshotDetail.allocations.map((allocation) => [
        formatDate(allocation.allocated_at),
        allocation.strategy === 'manual' ? 'Affectation manuelle' : 'Affectation automatique',
        formatCurrency(numberOf(allocation.amount)),
      ]),
      ...getAutoTableTheme(settings),
      columnStyles: { 0: { cellWidth: 48 }, 2: { halign: 'right', cellWidth: 48 } },
    });
    y = lastTableY(doc, y + 18) + 6;
  }

  y = renderFiscalNotice(doc, y, due);
  y = ensureSpace(doc, y, 46, settings);
  if (preparedDocument.document_type === 'partial_payment_receipt') {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    doc.text(
      doc.splitTextToSize(
        `Ce reçu constate un paiement partiel. Il ne vaut pas quittance complète. Reliquat restant : ${formatCurrency(summary.outstandingAmount)}.`,
        contentWidth,
      ),
      14,
      y,
    );
    y += 12;
  } else if (preparedDocument.document_type === 'rent_receipt') {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    doc.text(
      doc.splitTextToSize(
        "Cette quittance atteste du règlement intégral de l'échéance indiquée, sous réserve d'encaissement effectif des moyens de paiement.",
        contentWidth,
      ),
      14,
      y,
    );
    y += 12;
  }

  if (preparedDocument.document_type !== 'due_notice') {
    y = ensureSpace(doc, y, 42, settings);
    await drawSignatureBlocks(
      doc,
      y,
      ['Émetteur', preparedDocument.document_type.includes('receipt') ? 'Locataire' : 'Destinataire'],
      settings,
    );
  }

  generation.report('securing-document', {
    reference,
    verificationStatus: 'pending',
  });
  await drawLegalVerificationFooter(doc, {
    ref: reference,
    type: copy.verificationType,
    agency: issuerName,
    date: preparedDocument.created_at,
    settings,
  });
  addFooter(doc, settings);

  const safeReference = reference.replace(/[^a-z0-9_-]+/gi, '-');
  return saveGeneratedPdf(doc, {
    kind: copy.kind,
    title: copy.title,
    fileName: `${safeReference}.pdf`,
    source: 'Échéances locatives',
    documentType: preparedDocument.document_type,
    entityId: due.id,
    period: due.period_start,
    reference,
    data: preparedDocument.data_snapshot,
    generation,
    verificationExpected: true,
    metadata: {
      documentType: preparedDocument.document_type,
      reference,
      agencyName: issuerName,
      partyName: tenantName,
      period,
      subject: copy.subject,
      createdAt: preparedDocument.created_at,
    },
    assetUrls: {
      logo: settings.logo_url,
      signature: settings.signature_enabled ? settings.signature_url : null,
      stamp: settings.stamp_enabled ? settings.stamp_url : null,
    },
    preview: {
      columns: ['Document', 'Locataire', 'Période', 'Total', 'Réglé', 'Reliquat'],
      rows: [{
        Document: copy.shortTitle,
        Locataire: tenantName,
        Période: period,
        Total: formatCurrency(summary.amountTtc),
        Réglé: formatCurrency(summary.allocatedAmount),
        Reliquat: formatCurrency(summary.outstandingAmount),
      }],
      stats: [
        { label: 'Référence', value: reference },
        { label: 'Statut', value: statusLabel(preparedDocument.document_type, summary.outstandingAmount) },
      ],
      period,
      rowCount: 1,
    },
  });
}
