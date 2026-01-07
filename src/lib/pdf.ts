// src/lib/pdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

/**
 * ------------------------------
 * TYPES ET INTERFACES
 * ------------------------------
 */
interface AgencySettings {
  nom_agence: string | null;
  logo_url: string | null;
  couleur_primaire: string | null;
  ninea: string | null;
  devise: string | null;
  pied_page_personnalise: string | null;
  signature_url: string | null;
  qr_code_quittances: boolean;
}

/**
 * ------------------------------
 * FONCTIONS UTILITAIRES
 * ------------------------------
 */

/**
 * Charge les paramètres de l'agence depuis Supabase
 */
async function loadAgencySettings(): Promise<AgencySettings> {
  try {
    const { data, error } = await supabase
      .from('agency_settings')
      .select('nom_agence, logo_url, couleur_primaire, ninea, devise, pied_page_personnalise, signature_url, qr_code_quittances')
      .eq('id', 'default')
      .maybeSingle();

    if (error) throw error;

    return data || {
      nom_agence: 'Gestion Locative',
      logo_url: null,
      couleur_primaire: '#0066CC',
      ninea: null,
      devise: 'XOF',
      pied_page_personnalise: null,
      signature_url: null,
      qr_code_quittances: true,
    };
  } catch (error) {
    console.error('Erreur chargement paramètres agence:', error);
    return {
      nom_agence: 'Gestion Locative',
      logo_url: null,
      couleur_primaire: '#0066CC',
      ninea: null,
      devise: 'XOF',
      pied_page_personnalise: null,
      signature_url: null,
      qr_code_quittances: true,
    };
  }
}

/**
 * Ajoute le logo de l'agence en haut du document
 */
async function addAgencyLogo(doc: jsPDF, logoUrl: string | null): Promise<number> {
  if (!logoUrl) return 10;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = logoUrl;
    });

    const imgWidth = 30;
    const imgHeight = (img.height / img.width) * imgWidth;
    doc.addImage(img, 'PNG', 14, 10, imgWidth, imgHeight);

    return 10 + imgHeight + 5;
  } catch (error) {
    console.error('Erreur chargement logo:', error);
    return 10;
  }
}

/**
 * Format dynamique selon la devise
 */
export function formatCurrency(amount: number | string, devise: string = 'XOF'): string {
  if (!amount) {
    if (devise === 'XOF') return "0 F CFA";
    if (devise === 'EUR') return "0 €";
    if (devise === 'USD') return "0 $";
    return "0";
  }

  const cleaned = String(amount)
    .replace(/\//g, "")
    .replace(/\s/g, "");

  const num = Number(cleaned);
  const formatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 })
    .format(num)
    .replace(/\u00A0/g, " ");

  if (devise === 'XOF') return formatted + " F CFA";
  if (devise === 'EUR') return formatted + " €";
  if (devise === 'USD') return formatted + " $";
  return formatted;
}
export function drawPageBorder(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5; // distance entre la bordure et le bord de la page

  doc.setLineWidth(0.5); // épaisseur de la bordure
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
}


/**
 * Ajoute un footer avec numéro de page
 */
export function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Page ${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

/**
 * Génère une référence unique pour la facture
 */
export function generateFactureRef(p: any) {
  const d = new Date(p.created_at || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const suffix = (p.id || '').toString().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `FAC-${y}${m}-${suffix || 'XXXXXX'}`;
}

/**
 * Charger un template texte depuis un chemin
 */
export async function fetchTemplate(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Template introuvable: ' + path);
  return await res.text();
}

/**
 * Remplacer les variables dans le template sans laisser de ** visibles
 */
export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(.*?)\}\}/g, (_match, key) => {
    const val = vars[key.trim()] ?? '';
    return val;
  });
}

/**
 * Affiche du texte en gérant le gras si nécessaire
 */
function drawTextWithBold(doc: jsPDF, text: string, x: number, y: number) {
  const parts = text.split('**'); // on peut conserver pour futur, ici aucun ** ne sera présent
  let cursorX = x;
  let bold = false;

  parts.forEach(part => {
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    doc.text(part, cursorX, y);
    cursorX += doc.getTextWidth(part);
    bold = !bold;
  });
}

/**
 * ------------------------------
 * CONTRAT LOCATION
 * ------------------------------
 */
export async function generateContratPDF(contrat: any) {
  if (!contrat) throw new Error('Aucun contrat fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const bailleur = contrat?.unites?.immeubles?.bailleurs || {};
  const locataire = contrat?.locataires || {};

  try {
    const tpl = await fetchTemplate('/templates/contrat_location.txt');

    // Calcul de la durée en années
    let dureeAnnees = '1';
    if (contrat.date_debut && contrat.date_fin) {
      try {
        const d1 = new Date(contrat.date_debut);
        const d2 = new Date(contrat.date_fin);
        const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        if (months > 0) dureeAnnees = (months / 12).toFixed(months % 12 === 0 ? 0 : 1);
      } catch {}
    }

    // Remplacement des variables dans le template et récupération des valeurs dynamiques pour le gras
    const dynamicVars: Record<string, string> = {
      bailleur_prenom: bailleur.prenom || '',
      bailleur_nom: bailleur.nom || '',
      locataire_prenom: locataire.prenom || '',
      locataire_nom: locataire.nom || '',
      locataire_cni: locataire.piece_identite || '',
      locataire_adresse: locataire.adresse_personnelle || '',
      designation: `${contrat?.unites?.nom || ''} - ${contrat?.unites?.immeubles?.nom || ''}`,
      destination_local: contrat.destination || '',
      duree_annees: dureeAnnees,
      date_debut: contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '…',
      date_fin: contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : '…',
      loyer_mensuel: formatCurrency(Number(contrat.loyer_mensuel || 0), settings.devise || 'XOF'),
      depot_garantie: contrat.caution ? formatCurrency(Number(contrat.caution), settings.devise || 'XOF') : '',
      date_du_jour: new Date().toLocaleDateString('fr-FR'),
    };

    let body = tpl;
    const dynamicValues: string[] = [];

    // Remplacer les {{key}} par la valeur réelle et enregistrer les valeurs dynamiques
    body = body.replace(/\{\{(.*?)\}\}/g, (_match, key) => {
      const value = dynamicVars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 14;
    const usableWidth = pageWidth - 28;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();

    drawPageBorder(doc);

    let titleY = await addAgencyLogo(doc, settings.logo_url);
    titleY = Math.max(titleY, 15);

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CONTRAT DE LOCATION', pageWidth / 2, titleY, { align: 'center' });

    let y = titleY + 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    const lines = doc.splitTextToSize(body, usableWidth);
    let isFirstPage = true;

    for (const line of lines) {
      // Passage à la page suivante si besoin
      if (y > pageHeight - 20) {
        doc.addPage();
        drawPageBorder(doc); // bordure sur la nouvelle page
        y = 25;

        // **Ne pas répéter le titre sur les pages suivantes**
        isFirstPage = false;
      }

      // Dessiner le texte avec les valeurs dynamiques en gras
      let x = leftMargin;
      let remainingLine = line;

      while (remainingLine) {
        let found = false;
        for (const val of dynamicValues) {
          const index = remainingLine.indexOf(val);
          if (index !== -1) {
            const before = remainingLine.substring(0, index);
            if (before) {
              doc.setFont(undefined, 'normal');
              doc.text(before, x, y);
              x += doc.getTextWidth(before);
            }
            doc.setFont(undefined, 'bold');
            doc.text(val, x, y);
            x += doc.getTextWidth(val);
            remainingLine = remainingLine.substring(index + val.length);
            found = true;
            break;
          }
        }
        if (!found) {
          doc.setFont(undefined, 'normal');
          doc.text(remainingLine, x, y);
          remainingLine = '';
        }
      }

      y += lineHeight;
    }
  } catch (err) {
    console.error('Erreur génération contrat:', err);
  }

  // Ajouter le footer avec numéro de page
  addFooter(doc);

  // Sauvegarder le PDF
  doc.save(`contrat-${locataire?.nom || 'locataire'}-${Date.now()}.pdf`);
}


/**
 * ------------------------------
 * FACTURE DE PAIEMENT
 * ------------------------------
 */
export async function generatePaiementFacturePDF(paiement: any) {
  if (!paiement) throw new Error('Aucun paiement fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const contrat = paiement?.contrats || {};
  const locataire = contrat?.locataires || {};
  const unite = contrat?.unites || {};

  const loyer = Number(contrat?.loyer_mensuel || 0);
  const paye = Number(paiement?.montant_total || 0);
  const reliquat = Math.max(loyer - paye, 0);
  const ref = paiement.reference || generateFactureRef(paiement);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = 14;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const title = 'Quittance Loyer';
  const titleFontSize = 16;
  const bodyFontSize = 11;

  drawPageBorder(doc);

  let titleY = await addAgencyLogo(doc, settings.logo_url);
  titleY = Math.max(titleY, 15);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(titleFontSize);
  doc.text(title, pageWidth / 2, titleY, { align: 'center' });

  doc.setFont(undefined, 'normal');
  doc.setFontSize(bodyFontSize);
  let y = titleY + 10;

  // Référence
  doc.setFont(undefined, 'bold');
  doc.text(`Référence : ${ref}`, leftMargin, y);
  y += 6;

  // Date
  const datePaiement = paiement.date_paiement
    ? new Date(paiement.date_paiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  doc.text(`Date : ${datePaiement}`, leftMargin, y);
  y += 8;

  // Informations du locataire
  doc.setFont(undefined, 'bold');
  doc.text('Informations du locataire', leftMargin, y);
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text(
    `Nom : ${locataire ? `${locataire.prenom || ''} ${locataire.nom || ''}` : '—'}`,
    leftMargin,
    y
  );
  y += 6;

  doc.text(`Adresse du logement : ${unite?.immeubles?.adresse || '—'}`, leftMargin, y);
  y += 6;

  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : '—';
  doc.text(`Mois concerné : ${moisConcerne}`, leftMargin, y);
  y += 10;

  // Tableau autoTable
  const devise = settings.devise || 'XOF';
  autoTable(doc, {
    startY: y,
    head: [['Libellé', 'Montant']],
    body: [
      ['Montant du loyer', formatCurrency(loyer, devise)],
      ['Montant payé', formatCurrency(paye, devise)],
      ['Reliquat (reste à payer)', formatCurrency(reliquat, devise)],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fontStyle: 'bold' },
    bodyStyles: { fontStyle: 'bold' },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: usableWidth,
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : y + 10;

  const mentions = [
    "NB 1 : Le locataire ne peut déménager sans avoir payé l'intégralité du loyer dû et effectué toutes les réparations à sa charge.",
    'NB 2 : La sous-location est strictement interdite.',
  ];

  doc.setFont(undefined, 'bold');
  doc.text('Mentions', leftMargin, finalY);

  doc.setFont(undefined, 'normal');
  let yMentions = finalY + 6;
  mentions.forEach((m) => {
    const lines = doc.splitTextToSize(`- ${m}`, usableWidth);
    doc.text(lines, leftMargin, yMentions);
    yMentions += lines.length * 5;
  });

  if (settings.pied_page_personnalise) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(100);
    const footerLines = doc.splitTextToSize(settings.pied_page_personnalise, usableWidth);
    doc.text(footerLines, leftMargin, pageHeight - 25);
  }

  addFooter(doc);
  doc.save(`facture-${locataire?.nom || 'locataire'}-${Date.now()}.pdf`);
}

/**
 * ------------------------------
 * MANDAT DE GÉRANCE BAILLEUR
 * ------------------------------
 * Génère un mandat de gérance avec les valeurs dynamiques en gras
 * Le titre n'apparaît que sur la première page
 */
export async function generateMandatBailleurPDF(bailleur: any) {
  if (!bailleur) throw new Error('Aucun bailleur fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  try {
    const tpl = await fetchTemplate('/templates/mandat_gerance.txt');

    // Champs dynamiques incluant les paramètres de l'agence
    const vars: Record<string, string> = {
      nom_agence: settings.nom_agence || 'Gestion Locative',
      agence_ninea: settings.ninea || '',
      agence_adresse: 'Dakar',
      agence_directeur: 'Le Directeur',
      lieu: 'Dakar',
      bailleur_prenom: bailleur.prenom || '',
      bailleur_nom: bailleur.nom || '',
      bailleur_cni: bailleur.piece_identite || '',
      bailleur_adresse: bailleur.adresse || '',
      bien_adresse: bailleur.bien_adresse || '',
      bien_composition: bailleur.bien_composition || '',
      taux_honoraires: bailleur.commission ? String(bailleur.commission) : '10',
      date_debut: bailleur.debut_contrat
        ? new Date(bailleur.debut_contrat).toLocaleDateString('fr-FR')
        : new Date().toLocaleDateString('fr-FR'),
      duree_annees: bailleur.duree_annees ? String(bailleur.duree_annees) : '1',
      date_du_jour: new Date().toLocaleDateString('fr-FR'),
    };

    let body = tpl;
    const dynamicValues: string[] = [];

    // Remplacer les {{key}} par la valeur réelle et garder la liste pour gras
    body = body.replace(/\{\{(.*?)\}\}/g, (_match, key) => {
      const value = vars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    });

    if (!body.trim()) body = 'Contenu du mandat vide.';

    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 14;
    const usableWidth = pageWidth - leftMargin - 14;

    const title = 'MANDAT DE GÉRANCE';
    const titleFontSize = 16;
    const bodyFontSize = 12;
    const lineHeight = 7;

    drawPageBorder(doc);

    let titleY = await addAgencyLogo(doc, settings.logo_url);
    titleY = Math.max(titleY, 15);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(titleFontSize);
    doc.text(title, pageWidth / 2, titleY, { align: 'center' });

    doc.setFont(undefined, 'normal');
    doc.setFontSize(bodyFontSize);

    const lines = doc.splitTextToSize(body, usableWidth);
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 20;

    let y = titleY + lineHeight * 2;

    for (const line of lines) {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        drawPageBorder(doc);

        // Nouvelle page = pas de titre, pas d'espace logo
        y = 25;
      }

      // Vérifier si la ligne contient une valeur dynamique et mettre en gras
      let x = leftMargin;
      let remainingLine = line;

      while (remainingLine) {
        let found = false;

        for (const val of dynamicValues) {
          const index = remainingLine.indexOf(val);

          if (index !== -1) {
            const before = remainingLine.substring(0, index);

            if (before) {
              doc.setFont(undefined, 'normal');
              doc.text(before, x, y);
              x += doc.getTextWidth(before);
            }

            doc.setFont(undefined, 'bold');
            doc.text(val, x, y);
            x += doc.getTextWidth(val);

            remainingLine = remainingLine.substring(index + val.length);
            found = true;
            break;
          }
        }

        if (!found) {
          doc.setFont(undefined, 'normal');
          doc.text(remainingLine, x, y);
          remainingLine = '';
        }
      }

      y += lineHeight;
    }
    
  } catch {
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    const text = `Mandat de gérance\nPropriétaire: ${bailleur.prenom || ''} ${bailleur.nom || ''}`;
    doc.text(doc.splitTextToSize(text, 182), 14, 50);
  }

  addFooter(doc);
  doc.save(`mandat-${bailleur.nom || 'bailleur'}-${Date.now()}.pdf`);
}
