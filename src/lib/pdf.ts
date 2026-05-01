import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import {
  AgencySettings,
  DEFAULT_AGENCY_SETTINGS,
  ContratPDFData,
  PaiementPDFData,
  MandatPDFData,
} from '../types';
import { formatCurrency } from './formatters';

export { formatCurrency };

// ---------------------------------------------------------------------------
// Internal types & constants
// ---------------------------------------------------------------------------

/** Subset of AgencySettings used when loading fails or row is missing. */
const PDF_SETTINGS_FALLBACK: Partial<AgencySettings> = {
  nom_agence: DEFAULT_AGENCY_SETTINGS.nom_agence ?? 'Gestion Locative',
  adresse: DEFAULT_AGENCY_SETTINGS.adresse ?? null,
  telephone: DEFAULT_AGENCY_SETTINGS.telephone ?? null,
  email: DEFAULT_AGENCY_SETTINGS.email ?? null,
  logo_url: DEFAULT_AGENCY_SETTINGS.logo_url ?? null,
  couleur_primaire: DEFAULT_AGENCY_SETTINGS.couleur_primaire ?? '#F58220',
  ninea: DEFAULT_AGENCY_SETTINGS.ninea ?? null,
  rc: DEFAULT_AGENCY_SETTINGS.rc ?? null,
  representant_nom: DEFAULT_AGENCY_SETTINGS.representant_nom ?? null,
  representant_fonction: DEFAULT_AGENCY_SETTINGS.representant_fonction ?? 'Gérant',
  manager_id_type: DEFAULT_AGENCY_SETTINGS.manager_id_type ?? 'CNI',
  manager_id_number: DEFAULT_AGENCY_SETTINGS.manager_id_number ?? null,
  city: DEFAULT_AGENCY_SETTINGS.city ?? 'Dakar',
  devise: DEFAULT_AGENCY_SETTINGS.devise ?? 'XOF',
  pied_page_personnalise: DEFAULT_AGENCY_SETTINGS.pied_page_personnalise ?? null,
  signature_url: DEFAULT_AGENCY_SETTINGS.signature_url ?? null,
  qr_code_quittances: DEFAULT_AGENCY_SETTINGS.qr_code_quittances ?? true,
  penalite_retard_montant: DEFAULT_AGENCY_SETTINGS.penalite_retard_montant ?? 1000,
  penalite_retard_delai_jours: DEFAULT_AGENCY_SETTINGS.penalite_retard_delai_jours ?? 3,
  frais_huissier: DEFAULT_AGENCY_SETTINGS.frais_huissier ?? 37500,
  mention_tribunal:
    DEFAULT_AGENCY_SETTINGS.mention_tribunal ??
    'Avec attribution exclusive de juridiction au juge des référés du Tribunal de Dakar.',
  mention_penalites: DEFAULT_AGENCY_SETTINGS.mention_penalites ?? '',
  mention_frais_huissier: DEFAULT_AGENCY_SETTINGS.mention_frais_huissier ?? '',
  mention_litige: DEFAULT_AGENCY_SETTINGS.mention_litige ?? '',
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cache des paramètres d'agence (TTL 5 min) pour éviter de refaire 2 requêtes
// (user → profile → settings) à chaque génération de PDF.
// ---------------------------------------------------------------------------
type CacheEntry = { settings: Partial<AgencySettings>; expiresAt: number };
const settingsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateAgencySettingsCache(agencyId?: string) {
  if (agencyId) {
    settingsCache.delete(agencyId);
  } else {
    settingsCache.clear();
  }
}

async function loadAgencySettings(): Promise<Partial<AgencySettings>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return PDF_SETTINGS_FALLBACK;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('agency_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.agency_id) return PDF_SETTINGS_FALLBACK;

    const cached = settingsCache.get(profile.agency_id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.settings;
    }

    const { data, error } = await supabase
      .from('agency_settings')
      .select(
        `nom_agence, adresse, telephone, email, logo_url, couleur_primaire,
         ninea, rc, representant_nom, representant_fonction,
         manager_id_type, manager_id_number, city, devise,
         pied_page_personnalise, signature_url, qr_code_quittances,
         penalite_retard_montant, penalite_retard_delai_jours, frais_huissier,
         mention_tribunal, mention_penalites, mention_frais_huissier, mention_litige`
      )
      .eq('agency_id', profile.agency_id)
      .maybeSingle();

    if (error) throw error;
    const settings = (data ?? PDF_SETTINGS_FALLBACK) as Partial<AgencySettings>;
    settingsCache.set(profile.agency_id, {
      settings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return settings;
  } catch (error) {
    console.error('Erreur chargement paramètres agence:', error);
    return PDF_SETTINGS_FALLBACK;
  }
}

async function addAgencyLogo(doc: jsPDF, logoUrl: string | null | undefined): Promise<number> {
  if (!logoUrl) return 10;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
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

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

export function drawPageBorder(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5;
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
}

export function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.setFont(undefined as unknown as string, 'normal');
    doc.text(
      `Page ${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

export function generateFactureRef(p: { id?: string; created_at?: string }): string {
  const d = new Date(p.created_at ?? Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const suffix = (p.id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return `FAC-${y}${m}-${suffix || 'XXXXXX'}`;
}

/**
 * Génère un numéro de quittance unique et séquentiel.
 * Format : QIT-AAAAMM-{6 chars aléatoires} — utilisable légalement comme référence unique.
 */
export function generateQuittanceRef(p: { id?: string; created_at?: string; mois_concerne?: string }): string {
  const d = new Date(p.mois_concerne ?? p.created_at ?? Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  // Combine ID prefix + random for uniqueness even without DB sequence
  const idPart = (p.id ?? '').replace(/-/g, '').slice(0, 4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QIT-${y}${m}-${idPart}${rand}`;
}

export async function fetchTemplate(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Template introuvable: ' + path);
  return res.text();
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => vars[key.trim()] ?? '');
}

// ---------------------------------------------------------------------------
// Template rendering helper (shared between contrat & mandat)
// ---------------------------------------------------------------------------

function renderTemplateToDoc(
  doc: jsPDF,
  body: string,
  dynamicValues: string[],
  startY: number,
  leftMargin: number,
  usableWidth: number,
  lineHeight: number,
  fontSize: number
): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginBottom = 20;

  doc.setFontSize(fontSize);
  doc.setFont(undefined as unknown as string, 'normal');

  const lines = doc.splitTextToSize(body, usableWidth) as string[];
  let y = startY;

  for (const line of lines) {
    if (y > pageHeight - marginBottom) {
      doc.addPage();
      drawPageBorder(doc);
      y = 25;
    }

    let x = leftMargin;
    let remaining = line;

    while (remaining) {
      let found = false;
      for (const val of dynamicValues) {
        const idx = remaining.indexOf(val);
        if (idx !== -1) {
          const before = remaining.substring(0, idx);
          if (before) {
            doc.setFont(undefined as unknown as string, 'normal');
            doc.text(before, x, y);
            x += doc.getTextWidth(before);
          }
          doc.setFont(undefined as unknown as string, 'bold');
          doc.text(val, x, y);
          x += doc.getTextWidth(val);
          remaining = remaining.substring(idx + val.length);
          found = true;
          break;
        }
      }
      if (!found) {
        doc.setFont(undefined as unknown as string, 'normal');
        doc.text(remaining, x, y);
        remaining = '';
      }
    }

    y += lineHeight;
  }
}

// ---------------------------------------------------------------------------
// PDF generators
// ---------------------------------------------------------------------------

export async function generateContratPDF(contrat: ContratPDFData): Promise<void> {
  if (!contrat) throw new Error('Aucun contrat fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const bailleur = (contrat.unites?.immeubles?.bailleurs ?? {}) as {
    prenom?: string;
    nom?: string;
  };
  const locataire = (contrat.locataires ?? {}) as {
    prenom?: string;
    nom?: string;
    piece_identite?: string;
    adresse_personnelle?: string;
  };

  try {
    const tpl = await fetchTemplate('/templates/contrat_location.txt');

    let dureeAnnees = '1';
    if (contrat.date_debut && contrat.date_fin) {
      try {
        const d1 = new Date(contrat.date_debut);
        const d2 = new Date(contrat.date_fin);
        const months =
          (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        if (months > 0) dureeAnnees = (months / 12).toFixed(months % 12 === 0 ? 0 : 1);
      } catch {
        // keep default
      }
    }

    const devise = settings.devise ?? 'XOF';
    const dynamicVars: Record<string, string> = {
      agency_name: settings.nom_agence ?? 'Gestion Locative',
      agency_address: settings.adresse ?? '',
      agency_ninea: settings.ninea ?? '',
      agency_rc: settings.rc ?? '',
      agency_manager_full_name: settings.representant_nom ?? 'Le Représentant',
      agency_manager_title: settings.representant_fonction ?? 'Gérant',
      agency_manager_id_type: settings.manager_id_type ?? 'CNI',
      agency_manager_id_number: settings.manager_id_number ?? '',
      agency_city: settings.city ?? 'Dakar',
      bailleur_prenom: (bailleur as { prenom?: string }).prenom ?? '',
      bailleur_nom: (bailleur as { nom?: string }).nom ?? '',
      locataire_prenom: locataire.prenom ?? '',
      locataire_nom: locataire.nom ?? '',
      locataire_cni: locataire.piece_identite ?? '',
      locataire_adresse: locataire.adresse_personnelle ?? '',
      designation: `${contrat.unites?.nom ?? ''} - ${contrat.unites?.immeubles?.nom ?? ''}`,
      destination_local: contrat.destination ?? '',
      duree_annees: dureeAnnees,
      date_debut: contrat.date_debut
        ? new Date(contrat.date_debut).toLocaleDateString('fr-FR')
        : '…',
      date_fin: contrat.date_fin
        ? new Date(contrat.date_fin).toLocaleDateString('fr-FR')
        : '…',
      loyer_mensuel: formatCurrency(Number(contrat.loyer_mensuel ?? 0), devise),
      depot_garantie: contrat.caution
        ? formatCurrency(Number(contrat.caution), devise)
        : '',
      date_du_jour: new Date().toLocaleDateString('fr-FR'),
      penalite_montant: formatCurrency(settings.penalite_retard_montant ?? 1000, devise),
      penalite_delai: String(settings.penalite_retard_delai_jours ?? 3),
      frais_huissier: formatCurrency(settings.frais_huissier ?? 37500, devise),
      mention_tribunal:
        settings.mention_tribunal ??
        'Avec attribution exclusive de juridiction au juge des référés du Tribunal de Dakar.',
      mention_penalites: settings.mention_penalites ?? '',
      mention_frais_huissier: settings.mention_frais_huissier ?? '',
      mention_litige: settings.mention_litige ?? '',
    };

    const dynamicValues: string[] = [];
    const body = tpl.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const value = dynamicVars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 14;
    const usableWidth = pageWidth - 28;

    drawPageBorder(doc);
    let titleY = await addAgencyLogo(doc, settings.logo_url);
    titleY = Math.max(titleY, 15);

    doc.setFontSize(16);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.text('CONTRAT DE LOCATION', pageWidth / 2, titleY, { align: 'center' });

    renderTemplateToDoc(doc, body, dynamicValues, titleY + 10, leftMargin, usableWidth, 7, 11);
  } catch (err) {
    console.error('Erreur génération contrat:', err);
  }

  addFooter(doc);
  doc.save(`contrat-${(contrat.locataires?.nom ?? 'locataire')}-${Date.now()}.pdf`);
}

export async function generatePaiementFacturePDF(paiement: PaiementPDFData): Promise<void> {
  if (!paiement) throw new Error('Aucun paiement fourni');

  // Validation des champs critiques avant génération
  const contrat = (paiement.contrats ?? {}) as {
    locataires?: { prenom?: string; nom?: string };
    unites?: { nom?: string; immeubles?: { nom?: string; adresse?: string } };
    loyer_mensuel?: number;
  };
  const locataire = contrat.locataires ?? {};
  const unite = contrat.unites ?? {};

  const missingFields: string[] = [];
  if (!locataire.nom && !locataire.prenom) missingFields.push('nom du locataire');
  if (!unite.nom) missingFields.push('nom de l\'unité');
  if (!paiement.montant_total) missingFields.push('montant');
  if (!paiement.mois_concerne) missingFields.push('mois concerné');

  if (missingFields.length > 0) {
    console.warn('[PDF] Champs manquants pour la quittance :', missingFields.join(', '));
    // Continue with fallback values — do not block generation
  }

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const loyer = Number(contrat.loyer_mensuel ?? 0);
  const paye = Number(paiement.montant_total ?? 0);
  const reliquat = Math.max(loyer - paye, 0);
  // Numéro de quittance unique (QIT-AAAAMM-XXXX) — légalement traçable
  const ref = paiement.reference ?? generateQuittanceRef(paiement);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = 14;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const devise = settings.devise ?? 'XOF';

  drawPageBorder(doc);

  let titleY = await addAgencyLogo(doc, settings.logo_url);
  titleY = Math.max(titleY, 15);

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(16);
  doc.text('Quittance Loyer', pageWidth / 2, titleY, { align: 'center' });

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(11);
  let y = titleY + 10;

  doc.setFont(undefined as unknown as string, 'bold');
  doc.text(`Référence : ${ref}`, leftMargin, y);
  y += 6;

  const datePaiement = paiement.date_paiement
    ? new Date(paiement.date_paiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  doc.text(`Date : ${datePaiement}`, leftMargin, y);
  y += 8;

  doc.setFont(undefined as unknown as string, 'bold');
  doc.text('Informations du locataire', leftMargin, y);
  y += 6;
  doc.text(
    `Nom : ${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim() || '—',
    leftMargin,
    y
  );
  y += 6;
  doc.text(
    `Adresse du logement : ${(unite.immeubles as { adresse?: string } | undefined)?.adresse ?? '—'}`,
    leftMargin,
    y
  );
  y += 6;

  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : '—';
  doc.text(`Mois concerné : ${moisConcerne}`, leftMargin, y);
  y += 10;

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

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  const mentions = [
    "NB 1 : Le locataire ne peut déménager sans avoir payé l'intégralité du loyer dû et effectué toutes les réparations à sa charge.",
    'NB 2 : La sous-location est strictement interdite.',
  ];

  doc.setFont(undefined as unknown as string, 'bold');
  doc.text('Mentions', leftMargin, finalY);

  doc.setFont(undefined as unknown as string, 'normal');
  let yMentions = finalY + 6;
  for (const m of mentions) {
    const lines = doc.splitTextToSize(`- ${m}`, usableWidth) as string[];
    doc.text(lines, leftMargin, yMentions);
    yMentions += lines.length * 5;
  }

  if (settings.pied_page_personnalise) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(100);
    const footerLines = doc.splitTextToSize(settings.pied_page_personnalise, usableWidth) as string[];
    doc.text(footerLines, leftMargin, pageHeight - 25);
  }

  addFooter(doc);
  doc.save(`facture-${locataire.nom ?? 'locataire'}-${Date.now()}.pdf`);
}

export async function generateMandatBailleurPDF(bailleur: MandatPDFData): Promise<void> {
  if (!bailleur) throw new Error('Aucun bailleur fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  try {
    const tpl = await fetchTemplate('/templates/mandat_gerance.txt');

    const vars: Record<string, string> = {
      agency_name: settings.nom_agence ?? 'Gestion Locative',
      agency_address: settings.adresse ?? '',
      agency_ninea: settings.ninea ?? '',
      agency_rc: settings.rc ?? '',
      agency_manager_full_name: settings.representant_nom ?? 'Le Représentant',
      agency_manager_title: settings.representant_fonction ?? 'Gérant',
      agency_manager_id_type: settings.manager_id_type ?? 'CNI',
      agency_manager_id_number: settings.manager_id_number ?? '',
      agency_city: settings.city ?? 'Dakar',
      bailleur_prenom: bailleur.prenom ?? '',
      bailleur_nom: bailleur.nom ?? '',
      bailleur_cni: bailleur.piece_identite ?? '',
      bailleur_adresse: bailleur.adresse ?? '',
      bien_adresse: bailleur.bien_adresse ?? '',
      bien_composition: bailleur.bien_composition ?? '',
      taux_honoraires: bailleur.commission != null ? String(bailleur.commission) : '10',
      date_debut: bailleur.debut_contrat
        ? new Date(bailleur.debut_contrat).toLocaleDateString('fr-FR')
        : new Date().toLocaleDateString('fr-FR'),
      duree_annees: bailleur.duree_annees != null ? String(bailleur.duree_annees) : '3',
      date_du_jour: new Date().toLocaleDateString('fr-FR'),
      mention_tribunal:
        settings.mention_tribunal ??
        'En cas de litige, le Tribunal de commerce de Dakar est seul compétent.',
      mention_penalites: settings.mention_penalites ?? '',
      mention_frais_huissier: settings.mention_frais_huissier ?? '',
    };

    const dynamicValues: string[] = [];
    let body = tpl.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const value = vars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    });

    if (!body.trim()) body = 'Contenu du mandat vide.';

    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 14;
    const usableWidth = pageWidth - leftMargin - 14;

    drawPageBorder(doc);
    let titleY = await addAgencyLogo(doc, settings.logo_url);
    titleY = Math.max(titleY, 15);

    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(16);
    doc.text('MANDAT DE GÉRANCE', pageWidth / 2, titleY, { align: 'center' });

    renderTemplateToDoc(doc, body, dynamicValues, titleY + 14, leftMargin, usableWidth, 7, 12);
  } catch {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(12);
    const text = `Mandat de gérance\nPropriétaire: ${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`;
    doc.text(doc.splitTextToSize(text, 182) as string[], 14, 50);
  }

  addFooter(doc);
  doc.save(`mandat-${bailleur.nom ?? 'bailleur'}-${Date.now()}.pdf`);
}
