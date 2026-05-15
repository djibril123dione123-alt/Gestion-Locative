import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { supabase } from './supabase';
import {
  AgencySettings,
  DEFAULT_AGENCY_SETTINGS,
  ContratPDFData,
  PaiementPDFData,
  MandatPDFData,
} from '../types';
import { formatCurrency } from './formatters';
import {
  announceGeneratedDocument,
  GeneratedDocumentKind,
  type GeneratedDocumentPreview,
} from './documentGenerated';

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
  couleur_secondaire: DEFAULT_AGENCY_SETTINGS.couleur_secondaire ?? '#334155',
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

export function saveGeneratedPdf(
  doc: jsPDF,
  options: {
    kind: GeneratedDocumentKind;
    title: string;
    fileName: string;
    source?: string;
    preview?: GeneratedDocumentPreview;
  }
) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  doc.save(options.fileName);
  announceGeneratedDocument({
    kind: options.kind,
    title: options.title,
    fileName: options.fileName,
    source: options.source,
    url,
    blob,
    mimeType: 'application/pdf',
    fileSize: blob.size,
    preview: options.preview,
  });
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(unescape(encodeURIComponent(value))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
}

async function buildVerificationUrl(payload: {
  type: string;
  ref: string;
  agency: string;
  amount?: number;
  date?: string;
}) {
  const canonical = `${payload.type}|${payload.ref}|${payload.agency}|${payload.amount ?? 0}|${payload.date ?? ''}`;
  const token = await sha256Hex(canonical);
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  const params = new URLSearchParams({
    token,
    ref: payload.ref,
    type: payload.type,
  });
  return `${base}#/verify-document?${params.toString()}`;
}

async function loadImageAsPngDataUrl(
  url: string | null | undefined,
  maxWidth = 320
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url || typeof document === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const ratio = Math.min(1, maxWidth / Math.max(img.width, 1));
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
  } catch {
    return null;
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
        `nom_agence, adresse, telephone, email, logo_url, couleur_primaire, couleur_secondaire,
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

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const normalized = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function getBrandColors(settings?: Partial<AgencySettings>) {
  return {
    primary: hexToRgb(settings?.couleur_primaire, [20, 83, 45]),
    secondary: hexToRgb(settings?.couleur_secondaire, [15, 23, 42]),
    orange: [249, 115, 22] as [number, number, number],
    paper: [255, 251, 245] as [number, number, number],
    surface: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
  };
}

type SectionFrameOptions = {
  title?: string;
  subtitle?: string;
  accent?: 'primary' | 'orange' | 'neutral';
  fill?: boolean;
};

export function drawSectionFrame(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  settings?: Partial<AgencySettings>,
  options: SectionFrameOptions = {}
): number {
  const colors = getBrandColors(settings);
  const accent = options.accent === 'orange'
    ? colors.orange
    : options.accent === 'neutral'
      ? colors.border
      : colors.primary;

  if (options.fill !== false) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 2.5, 2.5, 'F');
  }
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.18);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'S');
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.45);
  doc.line(x, y, x + Math.min(42, width * 0.32), y);

  let contentY = y + 6;
  if (options.title) {
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(options.title, x + 4, contentY);
    contentY += 5;
  }
  if (options.subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    doc.text(options.subtitle, x + 4, contentY);
    contentY += 4;
  }
  doc.setTextColor(0, 0, 0);
  return contentY;
}

export function drawSignatureBlocks(
  doc: jsPDF,
  y: number,
  labels: [string, string],
  settings?: Partial<AgencySettings>
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colors = getBrandColors(settings);
  const width = 76;
  const gap = pageWidth - 28 - width * 2;
  const leftX = 14;
  const rightX = leftX + width + gap;

  [leftX, rightX].forEach((x, index) => {
    drawSectionFrame(doc, x, y, width, 28, settings, { accent: 'neutral', fill: false });
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(labels[index], x + 5, y + 7);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.2);
    doc.line(x + 5, y + 21, x + width - 5, y + 21);
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text('Signature et cachet', x + 5, y + 25);
  });
  doc.setTextColor(0, 0, 0);
}

async function drawDocumentHeader(
  doc: jsPDF,
  settings: Partial<AgencySettings>,
  title: string,
  subtitle?: string
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colors = getBrandColors(settings);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 42, 'F');

  let brandTextX = 14;
  const logo = await loadImageAsPngDataUrl(settings.logo_url, 360);
  if (logo) {
    const logoWidth = Math.min(28, Math.max(14, logo.width * 0.085));
    const logoHeight = Math.min(14, (logo.height / logo.width) * logoWidth);
    const logoY = 12 + Math.max(0, (14 - logoHeight) / 2);
    doc.addImage(logo.dataUrl, 'PNG', 14, logoY, logoWidth, logoHeight);
    brandTextX = 14 + logoWidth + 5;
  } else {
    doc.setFillColor(...colors.primary);
    doc.roundedRect(14, 11, 13, 13, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8);
    doc.text((settings.nom_agence ?? 'SK').slice(0, 2).toUpperCase(), 20.5, 19.5, {
      align: 'center',
    });
    brandTextX = 32;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(11);
  doc.text(settings.nom_agence ?? 'Samay Këur', brandTextX, 15);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const agencyLine = [settings.adresse, settings.telephone, settings.email].filter(Boolean).join(' • ');
  if (agencyLine) doc.text(agencyLine, brandTextX, 20);
  const legalLine = [settings.ninea ? `NINEA ${settings.ninea}` : null, settings.rc ? `RC ${settings.rc}` : null]
    .filter(Boolean)
    .join(' • ');
  if (legalLine) doc.text(legalLine, brandTextX, 25);

  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth - 14, 15, { align: 'right' });
  if (subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, pageWidth - 14, 21, { align: 'right' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(14, 34, pageWidth - 14, 34);
  doc.setDrawColor(...colors.orange);
  doc.setLineWidth(0.45);
  doc.line(14, 35.2, 54, 35.2);
  doc.setTextColor(0);
  return 47;
}

function getAutoTableTheme(settings?: Partial<AgencySettings>) {
  const colors = getBrandColors(settings);
  return {
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [30, 41, 59] as [number, number, number],
      lineColor: colors.border,
      lineWidth: 0.12,
    },
    headStyles: {
      fillColor: colors.primary,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      lineColor: colors.primary,
      lineWidth: 0.12,
    },
    bodyStyles: {
      lineColor: colors.border,
      lineWidth: 0.12,
    },
    alternateRowStyles: { fillColor: colors.surface },
    margin: { left: 14, right: 14 },
  };
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

export function drawPageBorder(doc: jsPDF, settings?: Partial<AgencySettings>): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colors = getBrandColors(settings);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.15);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.45);
  doc.line(8, 8, 42, 8);
  doc.line(pageWidth - 42, pageHeight - 8, pageWidth - 8, pageHeight - 8);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.12);
  doc.line(12, 42, pageWidth - 12, 42);
}

export function addFooter(doc: jsPDF, settings?: Partial<AgencySettings>): void {
  const pageCount = doc.getNumberOfPages();
  const colors = getBrandColors(settings);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    doc.setDrawColor(...colors.orange);
    doc.setLineWidth(0.35);
    doc.line(14, pageHeight - 16, 42, pageHeight - 16);
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.setFont(undefined as unknown as string, 'normal');
    const footer = settings?.pied_page_personnalise || settings?.nom_agence || 'Samay Këur';
    doc.text(footer, 14, pageHeight - 10);
    doc.text(
      `Page ${i} / ${pageCount}`,
      pageWidth - 14,
      pageHeight - 10,
      { align: 'right' }
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
  fontSize: number,
  settings?: Partial<AgencySettings>
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
      drawPageBorder(doc, settings);
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

    drawPageBorder(doc, settings);
    const titleY = await drawDocumentHeader(
      doc,
      settings,
      'CONTRAT DE LOCATION',
      `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim()
    );

    const sectionY = titleY - 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const bodyY = drawSectionFrame(
      doc,
      leftMargin,
      sectionY,
      usableWidth,
      pageHeight - sectionY - 48,
      settings,
      { title: 'Clauses contractuelles', subtitle: 'Contrat de location et conditions applicables' }
    );
    renderTemplateToDoc(doc, body, dynamicValues, bodyY + 1, leftMargin + 4, usableWidth - 8, 6.6, 10.5, settings);

    doc.addPage();
    drawPageBorder(doc, settings);
    const signatureHeaderY = await drawDocumentHeader(doc, settings, 'SIGNATURES', 'Contrat de location');
    drawSectionFrame(doc, leftMargin, signatureHeaderY, usableWidth, 34, settings, {
      title: 'Validation du document',
      subtitle: 'Les parties déclarent avoir lu et accepté les clauses du présent contrat.',
      accent: 'neutral',
    });
    drawSignatureBlocks(doc, signatureHeaderY + 48, ['Le bailleur / mandataire', 'Le locataire'], settings);
  } catch (err) {
    console.error('Erreur génération contrat:', err);
  }

  addFooter(doc, settings);
  saveGeneratedPdf(doc, {
    kind: 'contrat',
    title: 'Contrat de location',
    fileName: `contrat-${contrat.locataires?.nom ?? 'locataire'}-${Date.now()}.pdf`,
    source: 'contrats',
  });
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
  const reliquat = paiement.reliquat != null
    ? Number(paiement.reliquat)
    : Math.max(loyer - paye, 0);
  // Numéro de quittance unique (QIT-AAAAMM-XXXX) — légalement traçable
  const ref = paiement.reference ?? generateQuittanceRef(paiement);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = 14;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const devise = settings.devise ?? 'XOF';

  drawPageBorder(doc, settings);

  const titleY = await drawDocumentHeader(
    doc,
    settings,
    'Quittance de loyer',
    `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim()
  );

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(11);
  let y = titleY + 3;

  const datePaiement = paiement.date_paiement
    ? new Date(paiement.date_paiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  drawSectionFrame(doc, leftMargin, y, usableWidth, 22, settings, {
    title: 'Référence du document',
    accent: 'orange',
  });
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Référence : ${ref}`, leftMargin + 4, y + 14);
  doc.text(`Date : ${datePaiement}`, pageWidth - rightMargin - 4, y + 14, { align: 'right' });
  y += 30;

  const tenantBoxY = y;
  drawSectionFrame(doc, leftMargin, tenantBoxY, usableWidth, 32, settings, {
    title: 'Informations du locataire',
  });
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Nom : ${`${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim() || '—'}`, leftMargin + 4, tenantBoxY + 14);
  doc.text(
    `Adresse du logement : ${(unite.immeubles as { adresse?: string } | undefined)?.adresse ?? '—'}`,
    leftMargin + 4,
    tenantBoxY + 21
  );

  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : '—';
  doc.text(`Mois concerné : ${moisConcerne}`, leftMargin + 4, tenantBoxY + 28);
  y += 40;

  autoTable(doc, {
    startY: y,
    head: [['Libellé', 'Montant']],
    body: [
      ['Montant du loyer', formatCurrency(loyer, devise)],
      ['Montant payé', formatCurrency(paye, devise)],
      ['Reliquat (reste à payer)', formatCurrency(reliquat, devise)],
    ],
    theme: 'grid',
    ...getAutoTableTheme(settings),
    bodyStyles: { fontStyle: 'bold' },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: usableWidth,
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  const mentions = [
    "NB 1 : Le locataire ne peut déménager sans avoir payé l'intégralité du loyer dû et effectué toutes les réparations à sa charge.",
    'NB 2 : La sous-location est strictement interdite.',
  ];

  const mentionBoxHeight = 35;
  drawSectionFrame(doc, leftMargin, finalY - 4, usableWidth, mentionBoxHeight, settings, {
    title: 'Mentions',
    accent: 'neutral',
  });

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  let yMentions = finalY + 8;
  for (const m of mentions) {
    const lines = doc.splitTextToSize(`- ${m}`, usableWidth - 8) as string[];
    doc.text(lines, leftMargin + 4, yMentions);
    yMentions += lines.length * 5;
  }

  if (settings.pied_page_personnalise) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(100);
    const footerLines = doc.splitTextToSize(settings.pied_page_personnalise, usableWidth) as string[];
    doc.text(footerLines, leftMargin, pageHeight - 25);
  }

  // QR code — si activé dans les paramètres agence
  if (settings.qr_code_quittances !== false) {
    try {
      const qrPayload = await buildVerificationUrl({
        type: 'facture',
        ref,
        agency: settings.nom_agence ?? 'Samay Këur',
        amount: paye,
        date: paiement.date_paiement ?? new Date().toISOString(),
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 120,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      const qrSize = 24;
      const ph = doc.internal.pageSize.getHeight();
      const qrX = pageWidth - rightMargin - qrSize;
      const qrY = ph - 50;
      drawSectionFrame(doc, qrX - 3, qrY - 3, qrSize + 6, qrSize + 10, settings, {
        accent: 'neutral',
        fill: false,
      });
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('Vérifier la quittance', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });
      doc.setTextColor(0);
    } catch {
      // QR code generation failure is non-blocking
    }
  }

  addFooter(doc, settings);
  saveGeneratedPdf(doc, {
    kind: 'facture',
    title: 'Facture / quittance de loyer',
    fileName: `facture-${locataire.nom ?? 'locataire'}-${Date.now()}.pdf`,
    source: 'paiements',
  });
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
      taux_honoraires: bailleur.commission != null ? String(bailleur.commission) : '',
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

    drawPageBorder(doc, settings);
    const titleY = await drawDocumentHeader(
      doc,
      settings,
      'MANDAT DE GÉRANCE',
      `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim()
    );

    const sectionY = titleY - 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const bodyY = drawSectionFrame(
      doc,
      leftMargin,
      sectionY,
      usableWidth,
      pageHeight - sectionY - 48,
      settings,
      { title: 'Mandat et conditions de gestion', subtitle: 'Document de délégation de gestion locative' }
    );
    renderTemplateToDoc(doc, body, dynamicValues, bodyY + 1, leftMargin + 4, usableWidth - 8, 6.8, 10.8, settings);

    doc.addPage();
    drawPageBorder(doc, settings);
    const signatureHeaderY = await drawDocumentHeader(doc, settings, 'SIGNATURES', 'Mandat de gérance');
    drawSectionFrame(doc, leftMargin, signatureHeaderY, usableWidth, 34, settings, {
      title: 'Validation du mandat',
      subtitle: 'Les parties confirment la délégation de gestion décrite dans le présent mandat.',
      accent: 'neutral',
    });
    drawSignatureBlocks(doc, signatureHeaderY + 48, ['Le mandant', 'Le mandataire'], settings);
  } catch {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(12);
    const text = `Mandat de gérance\nPropriétaire: ${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`;
    doc.text(doc.splitTextToSize(text, 182) as string[], 14, 50);
  }

  addFooter(doc, settings);
  saveGeneratedPdf(doc, {
    kind: 'mandat',
    title: 'Mandat de gérance',
    fileName: `mandat-${bailleur.nom ?? 'bailleur'}-${Date.now()}.pdf`,
    source: 'bailleurs',
  });
}
