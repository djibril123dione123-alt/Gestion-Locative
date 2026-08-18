import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Inventaire } from '../types/inventaire';
import { formatCurrency, formatDate } from './formatters';

export async function generateInventairePdf(inventaire: Inventaire, agencySettings: any): Promise<void> {
  const doc = new jsPDF();
  const title = `État des lieux - ${inventaire.type.toUpperCase()}`;
  
  // Header
  doc.setFontSize(20);
  doc.text(title, 14, 20);
  doc.setFontSize(12);
  doc.text(`Date: ${formatDate(inventaire.date)}`, 14, 30);
  
  if (inventaire.contrats) {
    const locataire = `${inventaire.contrats.locataires?.prenom} ${inventaire.contrats.locataires?.nom}`;
    const bien = `${inventaire.contrats.unites?.immeubles?.nom} - ${inventaire.contrats.unites?.nom}`;
    doc.text(`Locataire: ${locataire}`, 14, 40);
    doc.text(`Bien: ${bien}`, 14, 50);
  }
  
  let y = 65;

  // Pièces
  if (inventaire.pieces && inventaire.pieces.length > 0) {
    for (const piece of inventaire.pieces) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(piece.nom, 14, y);
      y += 5;
      
      const tableData = piece.elements.map(el => [
        el.nom,
        el.etat.replace(/_/g, ' '),
        el.observations || '-'
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Élément', 'État', 'Observations']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [4, 120, 87] }
      });
      
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  } else {
    doc.setFontSize(10);
    doc.text('Aucune pièce détaillée.', 14, y);
    y += 10;
  }

  // Compteurs
  if (inventaire.compteurs && inventaire.compteurs.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compteurs', 14, y);
    y += 5;
    const compteurData = inventaire.compteurs.map(c => [c.type, c.valeur]);
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Relevé']],
      body: compteurData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Clés
  if (inventaire.cles && inventaire.cles.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Remise des clés', 14, y);
    y += 5;
    const clesData = inventaire.cles.map(c => [c.type, c.quantite.toString()]);
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Quantité']],
      body: clesData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    y = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Bilan
  if (inventaire.observations) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text('Bilan et observations générales', 14, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(inventaire.observations, 14, y + 10, { maxWidth: 180 });
    y += 30;
  }
  
  if (inventaire.type === 'sortie' && inventaire.caution_retenue > 0) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Retenue sur caution estimée : ${formatCurrency(inventaire.caution_retenue)}`, 14, y);
    y += 20;
  }

  // Signatures
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.text('Signatures', 14, y);
  doc.setLineWidth(0.1);
  doc.rect(14, y + 5, 80, 30);
  doc.text('Le Locataire', 16, y + 10);
  
  doc.rect(100, y + 5, 80, 30);
  doc.text('Le Bailleur / Mandataire', 102, y + 10);

  doc.save(`EDL_${inventaire.type}_${inventaire.contrat_id.substring(0, 8)}.pdf`);
}
