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
import { formatCurrency, formatSenegalPhone } from './formatters';
import {
  announceGeneratedDocument,
  GeneratedDocumentKind,
  type GeneratedDocumentPreview,
} from './documentGenerated';
import { saveManagedDocument, type ManagedDocumentType } from '../services/documentRegistry';

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
  site_web: DEFAULT_AGENCY_SETTINGS.site_web ?? null,
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

export async function saveGeneratedPdf(
  doc: jsPDF,
  options: {
    kind: GeneratedDocumentKind;
    title: string;
    fileName: string;
    source?: string;
    preview?: GeneratedDocumentPreview;
    documentType?: ManagedDocumentType;
    entityId?: string;
    period?: string | null;
    reference?: string;
    data?: unknown;
  }
) {
  const blob = doc.output('blob');
  let url = URL.createObjectURL(blob);
  let fileSize = blob.size;
  let reused = false;
  let version: number | undefined;
  let storagePath: string | undefined;

  if (options.documentType && options.entityId && options.reference) {
    try {
      const managed = await saveManagedDocument({
        blob,
        documentType: options.documentType,
        entityId: options.entityId,
        period: options.period,
        reference: options.reference,
        fileName: options.fileName,
        data: options.data ?? {},
        mimeType: 'application/pdf',
        metadata: {
          kind: options.kind,
          title: options.title,
          source: options.source,
        },
      });

      if (managed) {
        url = managed.url;
        fileSize = managed.fileSize;
        reused = managed.reused;
        version = managed.version;
        storagePath = managed.storagePath;
      }
    } catch (error) {
      console.warn('[DocumentRegistry] Archive indisponible, generation locale utilisee.', error);
    }
  }

  if (!reused) {
    doc.save(options.fileName);
  }

  announceGeneratedDocument({
    kind: options.kind,
    title: reused ? `${options.title} deja genere` : options.title,
    fileName: options.fileName,
    source: options.source,
    url,
    blob: reused ? undefined : blob,
    mimeType: 'application/pdf',
    fileSize,
    preview: options.preview,
    reused,
    version,
    storagePath,
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
  token?: string;
}) {
  const token = payload.token ?? await sha256Hex(`${payload.type}|${payload.ref}|${payload.agency}|${payload.amount ?? 0}|${payload.date ?? ''}`);
  const configuredBase =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    '';
  const browserBase = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  const fallbackBase = 'https://samay-keur-gestion-locative.vercel.app/';
  const candidateBase = configuredBase || browserBase || fallbackBase;
  const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(candidateBase);
  const base = (isLocalBase ? fallbackBase : candidateBase).replace(/\/?$/, '/');
  const params = new URLSearchParams({
    token,
    ref: payload.ref,
    type: payload.type,
  });
  return `${base}#/verify-document?${params.toString()}`;
}

async function createDocumentVerificationToken(payload: DocumentVerificationPayload): Promise<string> {
  const random = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(random);
  } else {
    for (let index = 0; index < random.length; index++) {
      random[index] = Math.floor(Math.random() * 256);
    }
  }
  const entropy = Array.from(random).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return sha256Hex(`${entropy}|${payload.ref}|${payload.type}|${payload.agency}|${Date.now()}`);
}

async function registerDocumentVerification(payload: DocumentVerificationPayload): Promise<{ token: string; url: string; registered: boolean }> {
  const token = await createDocumentVerificationToken(payload);
  const issuedAt = payload.date ? new Date(payload.date).toISOString() : new Date().toISOString();
  const payloadHash = await sha256Hex([
    payload.type,
    payload.ref,
    payload.agencyId ?? '',
    payload.agency,
    payload.amount ?? 0,
    issuedAt,
    payload.paymentStatus ?? '',
  ].join('|'));

  let registered = false;
  if (payload.agencyId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('document_verifications').insert({
      token,
      agency_id: payload.agencyId,
      document_ref: payload.ref,
      document_type: payload.type,
      agency_name: payload.agency,
      issued_at: issuedAt,
      amount_xof: payload.amount ?? null,
      payment_status: payload.paymentStatus ?? null,
      document_status: 'authentic',
      payload_hash: payloadHash,
      created_by: user?.id ?? null,
      metadata: {
        source: 'pdf_generation',
        version: 1,
      },
    });
    if (error) {
      console.warn('[PDF] Enregistrement de vérification impossible:', error.message);
    } else {
      registered = true;
    }
  }

  return {
    token,
    registered,
    url: await buildVerificationUrl({ ...payload, token }),
  };
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
        `agency_id, nom_agence, adresse, telephone, email, site_web, logo_url, couleur_primaire, couleur_secondaire,
         ninea, rc, representant_nom, representant_fonction,
         manager_id_type, manager_id_number, city, devise,
         pied_page_personnalise, signature_url, qr_code_quittances,
         penalite_retard_montant, penalite_retard_delai_jours, frais_huissier,
         mention_tribunal, mention_penalites, mention_frais_huissier, mention_litige`
      )
      .eq('agency_id', profile.agency_id)
      .maybeSingle();

    if (error) throw error;
    const settings = ({
      ...PDF_SETTINGS_FALLBACK,
      ...(data ?? {}),
      agency_id: profile.agency_id,
    }) as Partial<AgencySettings>;
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

type DocumentHeaderMeta = {
  reference?: string;
  issueDate?: string;
};

type DocumentVerificationPayload = {
  ref: string;
  type: string;
  agencyId?: string | null;
  agency: string;
  amount?: number;
  date?: string;
  paymentStatus?: string;
};

function safeText(value: unknown, fallback = '—'): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function fitSingleLine(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let output = text;
  while (output.length > 3 && doc.getTextWidth(`${output}…`) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output.trim()}…`;
}

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
  if (options.fill !== false) {
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, width, height, 'F');
  }
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.12);
  doc.rect(x, y, width, height, 'S');

  let contentY = y + 5.5;
  if (options.title) {
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(31, 41, 55);
    doc.text(options.title, x + 4, contentY);
    contentY += 4.8;
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
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(labels[index], x, y + 6);
    doc.setDrawColor(205, 213, 224);
    doc.setLineWidth(0.16);
    doc.line(x, y + 24, x + width, y + 24);
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text('Nom, date et signature', x, y + 29);
    if (index === 0) {
      doc.text('Cachet le cas échéant', x, y + 33);
    }
  });
  doc.setTextColor(0, 0, 0);
}

export async function drawDocumentHeader(
  doc: jsPDF,
  settings: Partial<AgencySettings>,
  title: string,
  subtitle?: string,
  meta: DocumentHeaderMeta = {}
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colors = getBrandColors(settings);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 62, 'F');

  let logoBottom = 26;
  const logo = await loadImageAsPngDataUrl(settings.logo_url, 360);
  if (logo) {
    const logoWidth = Math.min(26, Math.max(13, logo.width * 0.065));
    const logoHeight = Math.min(16.5, (logo.height / logo.width) * logoWidth);
    doc.addImage(logo.dataUrl, 'PNG', 15, 13, logoWidth, logoHeight);
    logoBottom = 13 + logoHeight;
  } else {
    doc.setFillColor(...colors.primary);
    doc.roundedRect(15, 12, 13, 13, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8);
    doc.text((settings.nom_agence ?? 'SK').slice(0, 2).toUpperCase(), 21.5, 20.5, {
      align: 'center',
    });
  }

  const infoX = pageWidth - 14;
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(10.2);
  doc.text(settings.nom_agence ?? 'Samay Këur', infoX, 14.5, { align: 'right' });
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(71, 85, 105);
  const infoLines = [
    settings.adresse,
    [settings.telephone ? formatSenegalPhone(settings.telephone, '') : null, settings.email].filter(Boolean).join(' · '),
    settings.ninea ? `NINEA ${settings.ninea}` : null,
    settings.rc ? `RC ${settings.rc}` : null,
    settings.site_web ?? null,
  ].filter(Boolean) as string[];
  infoLines.slice(0, 5).forEach((line, index) => {
    doc.text(line, infoX, 19.3 + index * 4.2, { align: 'right' });
  });

  const separatorY = Math.max(37, logoBottom + 8);
  doc.setDrawColor(218, 226, 232);
  doc.setLineWidth(0.18);
  doc.line(14, separatorY, pageWidth - 14, separatorY);

  const titleY = separatorY + 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(15.2);
  doc.setCharSpace(0.12);
  doc.text(title, 14, titleY);
  doc.setCharSpace(0);
  if (subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 14, titleY + 5.8);
  }

  const details: string[] = [];
  if (meta.reference) details.push(`Réf. ${meta.reference}`);
  if (meta.issueDate) details.push(`Date : ${meta.issueDate}`);
  if (details.length) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(details.join(' · '), pageWidth - 14, titleY, { align: 'right' });
  }

  doc.setTextColor(0);
  return titleY + (subtitle ? 12 : 8);
}

export function getAutoTableTheme(settings?: Partial<AgencySettings>) {
  const colors = getBrandColors(settings);
  return {
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.4, right: 2.8, bottom: 2.4, left: 2.8 },
      textColor: [30, 41, 59] as [number, number, number],
      lineColor: colors.border,
      lineWidth: 0.1,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: [246, 248, 250] as [number, number, number],
      textColor: [15, 23, 42] as [number, number, number],
      fontStyle: 'bold' as const,
      lineColor: colors.border,
      lineWidth: 0.1,
      minCellHeight: 7.5,
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
  doc.setLineWidth(0.1);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
}

export function addFooter(doc: jsPDF, settings?: Partial<AgencySettings>): void {
  const pageCount = doc.getNumberOfPages();
  const colors = getBrandColors(settings);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(232, 236, 242);
    doc.setLineWidth(0.1);
    doc.line(14, pageHeight - 16.5, pageWidth - 14, pageHeight - 16.5);
    doc.setFontSize(6.9);
    doc.setTextColor(...colors.muted);
    doc.setFont(undefined as unknown as string, 'normal');
    const footer = settings?.pied_page_personnalise || settings?.nom_agence || 'Samay Këur';
    doc.text(footer, 14, pageHeight - 10.5);
    doc.text(
      `Page ${i} / ${pageCount}`,
      pageWidth - 14,
      pageHeight - 10.5,
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
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginBottom = 24;
  const colors = getBrandColors(settings);

  doc.setFontSize(fontSize);
  doc.setFont(undefined as unknown as string, 'normal');

  let y = startY;
  const paragraphs = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const ensureSpace = (needed = lineHeight) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      drawPageBorder(doc, settings);
      y = 24;
    }
  };

  const drawRichLine = (line: string, xStart: number, yPos: number) => {
    let x = xStart;
    let remaining = line;

    while (remaining) {
      let found = false;
      for (const val of dynamicValues) {
        const idx = remaining.indexOf(val);
        if (idx !== -1) {
          const before = remaining.substring(0, idx);
          if (before) {
            doc.setFont(undefined as unknown as string, 'normal');
            doc.text(before, x, yPos);
            x += doc.getTextWidth(before);
          }
          doc.setFont(undefined as unknown as string, 'bold');
          doc.text(val, x, yPos);
          x += doc.getTextWidth(val);
          remaining = remaining.substring(idx + val.length);
          found = true;
          break;
        }
      }
      if (!found) {
        doc.setFont(undefined as unknown as string, 'normal');
        doc.text(remaining, x, yPos);
        remaining = '';
      }
    }
  };

  for (const paragraph of paragraphs) {
    const isArticleTitle = /^(ARTICLE|Article)\s+[\dIVXLC]+/.test(paragraph);
    const isNumberedPoint = /^\d+[).]\s+/.test(paragraph);

    if (isArticleTitle) {
      ensureSpace(22);
      y += 2.2;
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.1);
      doc.line(leftMargin, y - 2.4, leftMargin + usableWidth, y - 2.4);
      doc.setFont(undefined as unknown as string, 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(15, 23, 42);
      doc.text(paragraph, leftMargin, y + 2.4);
      y += 8;
      doc.setFontSize(fontSize);
      continue;
    }

    const textX = isNumberedPoint ? leftMargin + 4 : leftMargin;
    const textWidth = isNumberedPoint ? usableWidth - 4 : usableWidth;
    const lines = doc.splitTextToSize(paragraph, textWidth) as string[];
    const paragraphHeight = lines.length * lineHeight + 2;
    const availablePageHeight = pageHeight - marginBottom - 24;

    if (paragraphHeight <= availablePageHeight) {
      ensureSpace(paragraphHeight);
      for (const line of lines) {
        drawRichLine(line, textX, y);
        y += lineHeight;
      }
    } else {
      for (const line of lines) {
        ensureSpace(lineHeight + 1);
        drawRichLine(line, textX, y);
        y += lineHeight;
      }
    }
    y += isNumberedPoint ? 1.2 : 2.1;
  }

  return y;
}

function getDocumentBottomLimit(doc: jsPDF, reserve = 24): number {
  return doc.internal.pageSize.getHeight() - reserve;
}

function ensureDocumentSpace(
  doc: jsPDF,
  y: number,
  neededHeight: number,
  settings?: Partial<AgencySettings>,
  topY = 24,
  reserve = 24
): number {
  if (y + neededHeight <= getDocumentBottomLimit(doc, reserve)) {
    return y;
  }
  doc.addPage();
  drawPageBorder(doc, settings);
  return topY;
}

function drawSubtleSectionTitle(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  settings?: Partial<AgencySettings>,
  subtitle?: string
): number {
  const colors = getBrandColors(settings);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(9.4);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x, y);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.12);
  doc.line(x, y + 3, x + width, y + 3);
  if (subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...colors.muted);
    doc.text(subtitle, x, y + 8);
    return y + 14;
  }
  return y + 8;
}

async function drawVerificationBlock(
  doc: jsPDF,
  options: {
    x: number;
    y: number;
    width: number;
    ref: string;
    type: string;
    agency: string;
    amount?: number;
    date?: string;
    paymentStatus?: string;
    settings?: Partial<AgencySettings>;
  }
): Promise<void> {
  const { x, y, width, ref, type, agency, amount, date, paymentStatus, settings } = options;
  const colors = getBrandColors(settings);
  const verification = await registerDocumentVerification({
    type,
    ref,
    agency,
    agencyId: settings?.agency_id,
    amount,
    date,
    paymentStatus,
  });
  if (!verification.registered) return;

  const qrDataUrl = await QRCode.toDataURL(verification.url, {
    width: 144,
    margin: 1,
    errorCorrectionLevel: 'Q',
  });

  const blockHeight = 24;
  drawSectionFrame(doc, x, y, width, blockHeight, settings, { accent: 'neutral', fill: true });

  const qrSize = 13.5;
  doc.addImage(qrDataUrl, 'PNG', x + 5, y + 5.2, qrSize, qrSize);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Vérification du document', x + 22, y + 7.7);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(...colors.muted);
  const textWidth = width - 27;
  doc.text(fitSingleLine(doc, `Réf. ${ref}`, textWidth), x + 22, y + 12.1);
  doc.text(fitSingleLine(doc, `Agence : ${safeText(agency, 'Agence')}`, textWidth), x + 22, y + 16.1);
  doc.text(verification.registered ? 'Authenticité enregistrée' : 'Vérification locale', x + 22, y + 20);
  doc.setTextColor(0);
}

async function drawLegalVerificationFooter(
  doc: jsPDF,
  options: {
    ref: string;
    type: string;
    agency: string;
    date?: string;
    settings?: Partial<AgencySettings>;
  }
): Promise<void> {
  const { ref, type, agency, date, settings } = options;
  const colors = getBrandColors(settings);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNumber = doc.getNumberOfPages();

  const verification = await registerDocumentVerification({
    type,
    ref,
    agency,
    agencyId: settings?.agency_id,
    date,
  });
  if (!verification.registered) return;

  const qrDataUrl = await QRCode.toDataURL(verification.url, {
    width: 160,
    margin: 1,
    errorCorrectionLevel: 'Q',
  });

  doc.setPage(pageNumber);
  const qrSize = 12;
  const blockWidth = 62;
  const blockHeight = 18;
  const x = pageWidth - 14 - blockWidth;
  const y = pageHeight - 38;
  const textX = x + qrSize + 3;

  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.1);
  doc.roundedRect(x, y, blockWidth, blockHeight, 1.8, 1.8, 'S');
  doc.addImage(qrDataUrl, 'PNG', x + 3, y + 3, qrSize, qrSize);

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(30, 41, 59);
  doc.text('Authentification numérique', textX + 3, y + 6);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...colors.muted);
  doc.text(fitSingleLine(doc, `Réf. ${ref}`, blockWidth - qrSize - 10), textX + 3, y + 10.2);
  doc.text('Vérification en ligne', textX + 3, y + 14.2);
  doc.setTextColor(0);
}

async function drawEditorialSignatureSection(
  doc: jsPDF,
  options: {
    y: number;
    title: string;
    subtitle: string;
    reference: string;
    intro: string;
    labels: [string, string];
    leftMargin: number;
    usableWidth: number;
    settings?: Partial<AgencySettings>;
  }
): Promise<void> {
  const {
    y,
    title,
    subtitle,
    reference,
    intro,
    labels,
    leftMargin,
    usableWidth,
    settings,
  } = options;
  const neededHeight = 58;
  let sectionY = y + 8;
  const beforePage = doc.getCurrentPageInfo().pageNumber;

  sectionY = ensureDocumentSpace(doc, sectionY, neededHeight, settings, 22, 24);
  const afterPage = doc.getCurrentPageInfo().pageNumber;

  if (afterPage !== beforePage) {
    sectionY = await drawDocumentHeader(doc, settings ?? {}, title, subtitle, {
      reference,
    });
  } else {
    sectionY = drawSubtleSectionTitle(doc, leftMargin, sectionY, usableWidth, title, settings, subtitle);
  }

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const introLines = doc.splitTextToSize(intro, usableWidth) as string[];
  doc.text(introLines, leftMargin, sectionY + 2);
  drawSignatureBlocks(doc, sectionY + 15 + introLines.length * 1.3, labels, settings);
}

// ---------------------------------------------------------------------------
// PDF generators
// ---------------------------------------------------------------------------

export async function generateContratPDF(contrat: ContratPDFData): Promise<void> {
  if (!contrat) throw new Error('Aucun contrat fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const contractRef = `CTR-${new Date().getFullYear()}-${(contrat.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

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
      'Contrat de location',
      `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim(),
      {
        reference: contractRef,
        issueDate: new Date().toLocaleDateString('fr-FR'),
      }
    );

    const bodyY = drawSubtleSectionTitle(
      doc,
      leftMargin,
      titleY + 3,
      usableWidth,
      'Clauses contractuelles',
      settings,
      'Conditions applicables au présent bail'
    );
    const endY = renderTemplateToDoc(
      doc,
      body,
      dynamicValues,
      bodyY,
      leftMargin,
      usableWidth,
      6.4,
      10.5,
      settings
    );

    await drawEditorialSignatureSection(doc, {
      y: endY,
      title: 'Signatures',
      subtitle: 'Contrat de location',
      reference: contractRef,
      intro: 'Les parties déclarent avoir lu le présent contrat et en accepter les conditions.',
      labels: ['Le bailleur / mandataire', 'Le locataire'],
      leftMargin,
      usableWidth,
      settings,
    });
  } catch (err) {
    console.error('Erreur génération contrat:', err);
  }

  addFooter(doc, settings);
  if (settings.qr_code_quittances !== false) {
    try {
      await drawLegalVerificationFooter(doc, {
        ref: contractRef,
        type: 'contrat',
        agency: settings.nom_agence ?? 'Samay Këur',
        date: new Date().toISOString(),
        settings,
      });
    } catch {
      // Document verification QR is non-blocking.
    }
  }
  await saveGeneratedPdf(doc, {
    kind: 'contrat',
    title: 'Contrat de location',
    fileName: `${contractRef}.pdf`,
    source: 'contrats',
    documentType: 'contrat',
    entityId: contrat.id ?? contractRef,
    period: contrat.date_debut?.slice(0, 7) ?? null,
    reference: contractRef,
    data: {
      document: 'contrat',
      reference: contractRef,
      contrat,
      agency: settings,
    },
    preview: {
      columns: ['Champ', 'Valeur'],
      rows: [
        { Champ: 'Locataire', Valeur: `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim() || '—' },
        { Champ: 'Bien', Valeur: `${contrat.unites?.nom ?? ''} - ${contrat.unites?.immeubles?.nom ?? ''}`.trim() },
        { Champ: 'Loyer mensuel', Valeur: formatCurrency(Number(contrat.loyer_mensuel ?? 0), settings.devise ?? 'XOF') },
        { Champ: 'Durée', Valeur: `${contrat.date_debut ?? '—'} → ${contrat.date_fin ?? '—'}` },
      ],
      rowCount: 4,
      stats: [
        { label: 'Type', value: 'Contrat' },
        { label: 'Statut', value: 'À signer' },
      ],
    },
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
  const datePaiement = paiement.date_paiement
    ? new Date(paiement.date_paiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  drawPageBorder(doc, settings);

  const titleY = await drawDocumentHeader(
    doc,
    settings,
    'Quittance de loyer',
    `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim(),
    {
      reference: ref,
      issueDate: datePaiement,
    }
  );

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(11);
  let y = titleY + 3;

  y = drawSubtleSectionTitle(doc, leftMargin, y, usableWidth, 'Références', settings);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Référence : ${ref}`, leftMargin, y + 2);
  doc.text(`Date : ${datePaiement}`, pageWidth - rightMargin, y + 2, { align: 'right' });
  y += 12;

  const tenantBoxY = y;
  const tenantContentY = drawSubtleSectionTitle(doc, leftMargin, tenantBoxY, usableWidth, 'Informations du locataire', settings);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Nom : ${`${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim() || '—'}`, leftMargin, tenantContentY + 2);
  doc.text(
    `Adresse du logement : ${(unite.immeubles as { adresse?: string } | undefined)?.adresse ?? '—'}`,
    leftMargin,
    tenantContentY + 8
  );

  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : '—';
  doc.text(`Mois concerné : ${moisConcerne}`, leftMargin, tenantContentY + 14);
  y = tenantContentY + 24;

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
    bodyStyles: { fontStyle: 'normal' },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: usableWidth,
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  const mentions = [
    "NB 1 : Le locataire ne peut déménager sans avoir payé l'intégralité du loyer dû et effectué toutes les réparations à sa charge.",
    'NB 2 : La sous-location est strictement interdite.',
  ];

  const mentionsTitleY = drawSubtleSectionTitle(doc, leftMargin, finalY - 2, usableWidth, 'Mentions', settings);

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  let yMentions = mentionsTitleY + 1;
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

  // QR code — contrôle d'authenticité imprimable.
  if (settings.qr_code_quittances !== false) {
    try {
      const ph = doc.internal.pageSize.getHeight();
      const qrWidth = 78;
      await drawVerificationBlock(doc, {
        x: pageWidth - rightMargin - qrWidth,
        y: ph - 43,
        width: qrWidth,
        ref,
        type: 'quittance',
        agency: settings.nom_agence ?? 'Samay Këur',
        amount: paye,
        date: paiement.date_paiement ?? new Date().toISOString(),
        paymentStatus: reliquat > 0 ? 'Paiement partiel' : 'Payé',
        settings,
      });
    } catch {
      // QR code generation failure is non-blocking
    }
  }

  addFooter(doc, settings);
  await saveGeneratedPdf(doc, {
    kind: 'facture',
    title: 'Facture / quittance de loyer',
    fileName: `${ref}.pdf`,
    source: 'paiements',
    documentType: 'quittance',
    entityId: paiement.id ?? ref,
    period: paiement.mois_concerne?.slice(0, 7) ?? null,
    reference: ref,
    data: {
      document: 'quittance',
      reference: ref,
      paiement,
      loyer,
      paye,
      reliquat,
      agency: settings,
    },
    preview: {
      columns: ['Ligne', 'Montant'],
      rows: [
        { Ligne: 'Loyer attendu', Montant: formatCurrency(loyer, devise) },
        { Ligne: 'Montant encaissé', Montant: formatCurrency(paye, devise) },
        { Ligne: 'Reliquat', Montant: formatCurrency(reliquat, devise) },
      ],
      rowCount: 3,
      period: moisConcerne,
      stats: [
        { label: 'Référence', value: ref },
        { label: 'Statut', value: reliquat > 0 ? 'Partiel' : 'Payé' },
      ],
    },
  });
}

export async function generateMandatBailleurPDF(bailleur: MandatPDFData): Promise<void> {
  if (!bailleur) throw new Error('Aucun bailleur fourni');

  const settings = await loadAgencySettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const mandatRef = `MDT-${new Date().getFullYear()}-${(bailleur.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

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
      'Mandat de gérance',
      `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim(),
      {
        reference: mandatRef,
        issueDate: new Date().toLocaleDateString('fr-FR'),
      }
    );

    const bodyY = drawSubtleSectionTitle(
      doc,
      leftMargin,
      titleY + 3,
      usableWidth,
      'Conditions du mandat',
      settings,
      'Délégation de gestion locative'
    );
    const endY = renderTemplateToDoc(
      doc,
      body,
      dynamicValues,
      bodyY,
      leftMargin,
      usableWidth,
      6.4,
      10.5,
      settings
    );

    await drawEditorialSignatureSection(doc, {
      y: endY,
      title: 'Signatures',
      subtitle: 'Mandat de gérance',
      reference: mandatRef,
      intro: 'Les parties confirment la délégation de gestion décrite dans le présent mandat.',
      labels: ['Le mandant', 'Le mandataire'],
      leftMargin,
      usableWidth,
      settings,
    });
  } catch {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(12);
    const text = `Mandat de gérance\nPropriétaire: ${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`;
    doc.text(doc.splitTextToSize(text, 182) as string[], 14, 50);
  }

  addFooter(doc, settings);
  if (settings.qr_code_quittances !== false) {
    try {
      await drawLegalVerificationFooter(doc, {
        ref: mandatRef,
        type: 'mandat',
        agency: settings.nom_agence ?? 'Samay Këur',
        date: new Date().toISOString(),
        settings,
      });
    } catch {
      // Document verification QR is non-blocking.
    }
  }
  await saveGeneratedPdf(doc, {
    kind: 'mandat',
    title: 'Mandat de gérance',
    fileName: `${mandatRef}.pdf`,
    source: 'bailleurs',
    documentType: 'mandat',
    entityId: bailleur.id ?? mandatRef,
    period: bailleur.debut_contrat?.slice(0, 7) ?? null,
    reference: mandatRef,
    data: {
      document: 'mandat',
      reference: mandatRef,
      bailleur,
      agency: settings,
    },
    preview: {
      columns: ['Champ', 'Valeur'],
      rows: [
        { Champ: 'Bailleur', Valeur: `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim() || '—' },
        { Champ: 'Bien', Valeur: bailleur.bien_adresse ?? '—' },
        { Champ: 'Commission', Valeur: bailleur.commission != null ? `${bailleur.commission}%` : '—' },
        { Champ: 'Durée', Valeur: bailleur.duree_annees != null ? `${bailleur.duree_annees} ans` : '—' },
      ],
      rowCount: 4,
      stats: [
        { label: 'Type', value: 'Mandat' },
        { label: 'Statut', value: 'À signer' },
      ],
    },
  });
}
