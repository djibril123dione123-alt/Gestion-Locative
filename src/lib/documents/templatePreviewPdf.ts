import jsPDF from 'jspdf';
import type { DocumentTemplateContent } from '../../types/documentStudio';
import {
  getSampleTemplateVariables,
  renderDocumentTemplate,
} from './templateEngine';

export function createDocumentTemplateTestPdf(content: DocumentTemplateContent) {
  const rendered = renderDocumentTemplate(content, getSampleTemplateVariables(content.documentType));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const usableWidth = pageWidth - margin * 2;
  let y = 20;

  const drawPageFrame = () => {
    doc.setDrawColor(15, 86, 68);
    doc.setLineWidth(0.35);
    doc.line(margin, 12, pageWidth - margin, 12);
    doc.setTextColor(203, 92, 22);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('APERÇU DE TEST · NON CONTRACTUEL', pageWidth - margin, 9, { align: 'right' });
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    drawPageFrame();
    y = 20;
  };

  drawPageFrame();
  doc.setTextColor(10, 35, 29);
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text(rendered.title, margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Données fictives de prévisualisation. Aucun registre ni QR public n’est créé.', margin, y);
  y += 9;

  for (const block of rendered.blocks) {
    const titleLines = doc.splitTextToSize(block.title, usableWidth);
    const body = block.kind === 'system'
      ? `Section alimentée automatiquement par les données métier : ${block.systemKey ?? block.code}.`
      : block.content;
    const bodyLines = doc.splitTextToSize(body, usableWidth);
    const needed = titleLines.length * 5 + bodyLines.length * 4 + 8;
    ensureSpace(needed);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 86, 68);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 5 + 1.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 4 + 6;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`TEST · Page ${page}/${pages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  return doc;
}

