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

const AGENCY_SETTINGS_SELECT_LEGACY = `agency_id, nom_agence, adresse, telephone, email, site_web, logo_url, couleur_primaire, couleur_secondaire,
  ninea, rc, representant_nom, representant_fonction,
  manager_id_type, manager_id_number, city, devise,
  pied_page_personnalise, signature_url, qr_code_quittances,
  penalite_retard_montant, penalite_retard_delai_jours, frais_huissier,
  mention_tribunal, mention_penalites, mention_frais_huissier, mention_litige`;
const AGENCY_SETTINGS_SELECT_EXTENDED = `${AGENCY_SETTINGS_SELECT_LEGACY}, document_mode, enabled_modules, document_preferences, proprietaire_info`;

function shouldRetryLegacySelect(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '42703' || message.includes('organization_type') || message.includes('document_mode') || message.includes('enabled_modules') || message.includes('document_preferences') || message.includes('proprietaire_info') || message.includes('column');
}

async function loadAgencySettingsRow(agencyId: string): Promise<Partial<AgencySettings> | null> {
  const extended = await supabase
    .from('agency_settings')
    .select(AGENCY_SETTINGS_SELECT_EXTENDED)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!extended.error) return (extended.data as Partial<AgencySettings> | null) ?? null;
  if (!shouldRetryLegacySelect(extended.error)) throw extended.error;

  const legacy = await supabase
    .from('agency_settings')
    .select(AGENCY_SETTINGS_SELECT_LEGACY)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  return (legacy.data as Partial<AgencySettings> | null) ?? null;
}

async function loadAgencyAccountFlags(agencyId: string): Promise<{ is_bailleur_account?: boolean | null; organization_type?: string | null } | null> {
  const extended = await supabase
    .from('agencies')
    .select('is_bailleur_account, organization_type')
    .eq('id', agencyId)
    .maybeSingle();

  if (!extended.error) return extended.data ?? null;
  if (!shouldRetryLegacySelect(extended.error)) throw extended.error;

  const legacy = await supabase
    .from('agencies')
    .select('is_bailleur_account')
    .eq('id', agencyId)
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  return legacy.data ?? null;
}

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
    title: reused ? `${options.title} déjà généré` : options.title,
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
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto est requis pour enregistrer une preuve documentaire.');
  }

  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildVerificationUrl(payload: {
  type: string;
  ref: string;
  token: string;
}) {
  const base = getPublicVerifyBaseUrl();
  const params = new URLSearchParams({
    token: payload.token,
    ref: payload.ref,
    type: payload.type,
  });
  return base + '/verify?' + params.toString();
}

function getPublicVerifyBaseUrl() {
  const configuredBase = (import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL as string | undefined)?.trim();
  if (!configuredBase) return 'https://samaykeur.com';

  const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(configuredBase);
  if (isLocalBase) return 'https://samaykeur.com';

  return configuredBase.replace(/\/+$/, '') || 'https://samaykeur.com';
}

async function createDocumentVerificationToken(payload: DocumentVerificationPayload): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Un générateur aléatoire sécurisé est requis pour créer le QR documentaire.');
  }

  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const entropy = Array.from(random).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return sha256Hex([entropy, payload.ref, payload.type, payload.agency, Date.now()].join('|'));
}

type DocumentVerificationRegistration =
  | { token: string; url: string; registered: true }
  | { token: null; url: null; registered: false };

async function registerDocumentVerification(payload: DocumentVerificationPayload): Promise<DocumentVerificationRegistration> {
  if (!payload.agencyId) {
    console.warn('[PDF] QR omis : organisation émettrice absente.');
    return { token: null, url: null, registered: false };
  }

  try {
    const token = await createDocumentVerificationToken(payload);
    const issuedAt = payload.date ? new Date(payload.date).toISOString() : new Date().toISOString();
    const payloadHash = await sha256Hex([
      payload.type,
      payload.ref,
      payload.agencyId,
      payload.agency,
      payload.amount ?? 0,
      issuedAt,
      payload.paymentStatus ?? '',
    ].join('|'));

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
      console.warn('[PDF] QR omis : enregistrement de vérification impossible:', error.message);
      return { token: null, url: null, registered: false };
    }

    return {
      token,
      registered: true,
      url: buildVerificationUrl({ type: payload.type, ref: payload.ref, token }),
    };
  } catch (error) {
    console.warn('[PDF] QR omis : preuve documentaire non enregistrée.', error);
    return { token: null, url: null, registered: false };
  }
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

    const [data, agency] = await Promise.all([
      loadAgencySettingsRow(profile.agency_id),
      loadAgencyAccountFlags(profile.agency_id),
    ]);

    const organizationType = agency?.organization_type
      ?? (agency?.is_bailleur_account ? 'individual_landlord' : 'agency');
    const settings = ({
      ...PDF_SETTINGS_FALLBACK,
      ...(data ?? {}),
      agency_id: profile.agency_id,
      is_bailleur_account: Boolean(agency?.is_bailleur_account),
      organization_type: organizationType === 'individual_landlord' || agency?.is_bailleur_account
        ? 'bailleur_individuel'
        : organizationType === 'property_manager'
          ? 'gestionnaire'
          : organizationType === 'group'
            ? 'groupe'
            : 'agence',
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

type PdfDocumentType = 'contrat' | 'mandat' | 'quittance' | 'rapport' | 'facture';

const DEFAULT_PDF_PREFIXES: Record<PdfDocumentType, string> = {
  contrat: 'CTR',
  mandat: 'MDT',
  quittance: 'QIT',
  rapport: 'RPT',
  facture: 'FAC',
};

function getPdfDocumentPreferences(settings?: Partial<AgencySettings>) {
  return {
    prefixes: {
      ...DEFAULT_PDF_PREFIXES,
      ...(settings?.document_preferences?.prefixes ?? {}),
    },
    qr_documents: {
      contrat: true,
      mandat: true,
      quittance: true,
      rapport: true,
      facture: true,
      ...(settings?.document_preferences?.qr_documents ?? {}),
    } as Record<PdfDocumentType, boolean>,
    receipt_notice:
      settings?.document_preferences?.receipt_notice ||
      "Cette quittance atteste le paiement enregistré pour la période indiquée, sous réserve de vérification du document et des conditions prévues au bail.",
  };
}

function normalizeDocumentPrefix(prefix: string | null | undefined, fallback: string): string {
  const normalized = String(prefix ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12)
    .toUpperCase();
  return normalized || fallback;
}

function applyDocumentPrefix(ref: string, type: PdfDocumentType, settings?: Partial<AgencySettings>): string {
  const preferences = getPdfDocumentPreferences(settings);
  const prefix = normalizeDocumentPrefix(preferences.prefixes[type], DEFAULT_PDF_PREFIXES[type]);
  return ref.replace(/^[A-Z0-9]+(?=-)/, prefix);
}

function isDocumentQrEnabled(settings: Partial<AgencySettings> | undefined, type: PdfDocumentType): boolean {
  if (settings?.qr_code_quittances === false) return false;
  return getPdfDocumentPreferences(settings).qr_documents[type] !== false;
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
  const primary = hexToRgb(settings?.couleur_primaire, [20, 83, 45]);
  const secondary = hexToRgb(settings?.couleur_secondaire, [15, 23, 42]);
  return {
    primary,
    secondary,
    emeraldSoft: [232, 246, 240] as [number, number, number],
    gold: [211, 139, 38] as [number, number, number],
    goldSoft: [255, 247, 232] as [number, number, number],
    orange: [226, 104, 22] as [number, number, number],
    paper: [255, 252, 246] as [number, number, number],
    surface: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    ink: [15, 23, 42] as [number, number, number],
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
  documentType?: string;
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

function cleanDocumentText(value: unknown, fallback = '—'): string {
  return String(value ?? '')
    .replace(/[\u00A0\u202F\u2009\u2007]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function joinClean(parts: Array<unknown>, separator = ' '): string {
  return parts
    .map((part) => cleanDocumentText(part, ''))
    .filter(Boolean)
    .join(separator)
    .trim();
}

function cleanupLegalBody(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^\{\{.*\}\}$/.test(line))
    .join('\n');
}

function isIndividualOwnerSettings(settings?: Partial<AgencySettings>): boolean {
  return settings?.organization_type === 'bailleur_individuel'
    || settings?.organization_type === 'individual_landlord'
    || settings?.organization_type === 'multi_property_landlord'
    || settings?.is_bailleur_account === true;
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
    doc.roundedRect(x, y, width, height, 2.2, 2.2, 'F');
  }
  doc.setDrawColor(184, 196, 211);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 2.2, 2.2, 'S');
  doc.setFillColor(...(options.accent === 'orange' ? colors.gold : options.accent === 'neutral' ? colors.border : colors.primary));
  doc.roundedRect(x, y, 1.7, height, 1.4, 1.4, 'F');

  let contentY = y + 5.5;
  if (options.title) {
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...colors.ink);
    doc.text(options.title, x + 5, contentY);
    contentY += 4.8;
  }
  if (options.subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    doc.text(options.subtitle, x + 5, contentY);
    contentY += 4;
  }
  doc.setTextColor(0, 0, 0);
  return contentY;
}

export async function drawSignatureBlocks(
  doc: jsPDF,
  y: number,
  labels: [string, string],
  settings?: Partial<AgencySettings>
): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colors = getBrandColors(settings);
  const individualOwner = isIndividualOwnerSettings(settings);
  const signatureImage = await loadImageAsPngDataUrl(settings?.signature_url, 460);
  const width = 76;
  const gap = pageWidth - 28 - width * 2;
  const leftX = 14;
  const rightX = leftX + width + gap;
  const agencySignatureIndex = labels[1].toLowerCase().includes('mandataire') ? 1 : 0;

  [leftX, rightX].forEach((x, index) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(184, 196, 211);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, width, 36, 2.2, 2.2, 'FD');
    doc.setFillColor(...colors.paper);
    doc.roundedRect(x + 1.2, y + 1.2, width - 2.4, 8.2, 1.8, 1.8, 'F');
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(labels[index], x + 4, y + 6.2);
    if (signatureImage && index === agencySignatureIndex) {
      const maxImageWidth = width - 12;
      const maxImageHeight = 12;
      const ratio = Math.min(maxImageWidth / signatureImage.width, maxImageHeight / signatureImage.height, 1);
      const imageWidth = Math.max(8, signatureImage.width * ratio);
      const imageHeight = Math.max(4, signatureImage.height * ratio);
      const imageX = x + width - imageWidth - 5;
      const imageY = y + 11;
      doc.addImage(signatureImage.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
    }
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.22);
    doc.line(x + 4, y + 24.5, x + width - 4, y + 24.5);
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text('Nom, date et signature', x + 4, y + 29.5);
    if (index === 0) {
      doc.text(individualOwner ? 'Cachet ou mention le cas échéant' : 'Cachet le cas échéant', x + 4, y + 33.3);
    }
  });
  doc.setTextColor(0, 0, 0);
}

async function drawCompactSignatureSeal(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  settings?: Partial<AgencySettings>
): Promise<void> {
  const signatureImage = await loadImageAsPngDataUrl(settings?.signature_url, 360);
  if (!signatureImage) return;

  const colors = getBrandColors(settings);
  const maxImageWidth = Math.min(34, width - 10);
  const maxImageHeight = Math.min(10, height - 12);
  const ratio = Math.min(maxImageWidth / signatureImage.width, maxImageHeight / signatureImage.height, 1);
  const imageWidth = Math.max(10, signatureImage.width * ratio);
  const imageHeight = Math.max(4, signatureImage.height * ratio);
  const imageX = x + width - imageWidth - 5;
  const imageY = y + height - imageHeight - 4;

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...colors.muted);
  doc.text('Cachet / signature', x + width - 5, imageY - 1.5, { align: 'right' });
  doc.addImage(signatureImage.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
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
  const individualOwner = isIndividualOwnerSettings(settings);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 66, 'F');
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, 3.6, 66, 'F');
  doc.setFillColor(...colors.paper);
  doc.rect(3.6, 0, pageWidth - 3.6, 8.5, 'F');
  doc.setDrawColor(226, 213, 181);
  doc.setLineWidth(0.22);
  doc.line(3.6, 8.5, pageWidth, 8.5);

  const logoPosition = settings.logo_position ?? 'left';
  const infoAlign: 'left' | 'right' = logoPosition === 'right' ? 'left' : 'right';
  const infoX = logoPosition === 'right' ? 14 : pageWidth - 14;
  let logoBottom = 26;
  const logo = await loadImageAsPngDataUrl(settings.logo_url, 420);
  if (logo) {
    const logoWidth = Math.min(30, Math.max(15, logo.width * 0.07));
    const logoHeight = Math.min(18, (logo.height / logo.width) * logoWidth);
    const logoX = logoPosition === 'center'
      ? pageWidth / 2 - logoWidth / 2
      : logoPosition === 'right'
        ? pageWidth - 14 - logoWidth
        : 15;
    doc.addImage(logo.dataUrl, 'PNG', logoX, 14, logoWidth, logoHeight);
    logoBottom = 14 + logoHeight;
  } else {
    const fallbackLogoX = logoPosition === 'center' ? pageWidth / 2 - 6.5 : logoPosition === 'right' ? pageWidth - 27 : 15;
    doc.setFillColor(...colors.primary);
    doc.roundedRect(fallbackLogoX, 13, 13, 13, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8);
    doc.text((settings.nom_agence ?? 'SK').slice(0, 2).toUpperCase(), fallbackLogoX + 6.5, 21.5, {
      align: 'center',
    });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(10.2);
  doc.text(settings.nom_agence ?? 'Samay Këur', infoX, 14.5, { align: infoAlign });
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(71, 85, 105);
  const infoLines = [
    settings.adresse,
    [settings.telephone ? formatSenegalPhone(settings.telephone, '') : null, settings.email].filter(Boolean).join(' · '),
    !individualOwner && settings.ninea ? `NINEA ${settings.ninea}` : null,
    !individualOwner && settings.rc ? `RC ${settings.rc}` : null,
    settings.site_web ?? null,
  ].filter(Boolean) as string[];
  infoLines.slice(0, 5).forEach((line, index) => {
    doc.text(line, infoX, 19.3 + index * 4.2, { align: infoAlign });
  });

  const separatorY = Math.max(40, logoBottom + 8);
  doc.setDrawColor(191, 203, 218);
  doc.setLineWidth(0.24);
  doc.line(14, separatorY, pageWidth - 14, separatorY);

  const titleY = separatorY + 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(15.2);
  doc.setCharSpace(0.12);
  if (meta.documentType) {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(248, 197, 120);
    doc.setLineWidth(0.16);
    doc.roundedRect(14, titleY - 7.4, 38, 5.8, 1.6, 1.6, 'FD');
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(6.7);
    doc.setTextColor(...colors.orange);
    doc.text(fitSingleLine(doc, meta.documentType.toUpperCase(), 32), 17, titleY - 3.4);
    doc.setFontSize(15.2);
    doc.setTextColor(15, 23, 42);
  }
  doc.text(title, 14, titleY + (meta.documentType ? 3 : 0));
  doc.setCharSpace(0);
  if (subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(fitSingleLine(doc, subtitle, 112), 14, titleY + (meta.documentType ? 8.8 : 5.8));
  }

  const details: string[] = [];
  if (meta.reference) details.push(`Réf. ${meta.reference}`);
  if (meta.issueDate) details.push(`Date : ${meta.issueDate}`);
  if (details.length) {
    const detailText = details.join(' · ');
    const detailWidth = Math.min(74, doc.getTextWidth(detailText) + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.14);
    doc.roundedRect(pageWidth - 14 - detailWidth, titleY - 5.2, detailWidth, 7.2, 1.8, 1.8, 'FD');
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(fitSingleLine(doc, detailText, detailWidth - 6), pageWidth - 17, titleY, { align: 'right' });
  }

  doc.setTextColor(0);
  return titleY + (meta.documentType ? 16 : subtitle ? 12 : 8);
}

export function getAutoTableTheme(settings?: Partial<AgencySettings>) {
  const colors = getBrandColors(settings);
  return {
    styles: {
      fontSize: 8.1,
      cellPadding: { top: 2.6, right: 3, bottom: 2.6, left: 3 },
      textColor: [30, 41, 59] as [number, number, number],
      lineColor: [190, 202, 216] as [number, number, number],
      lineWidth: 0.16,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: colors.primary,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      lineColor: [20, 83, 45] as [number, number, number],
      lineWidth: 0.16,
      minCellHeight: 7.6,
    },
    bodyStyles: {
      lineColor: [196, 207, 220] as [number, number, number],
      lineWidth: 0.14,
    },
    alternateRowStyles: { fillColor: [253, 252, 248] as [number, number, number] },
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
  doc.setDrawColor(190, 202, 216);
  doc.setLineWidth(0.2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  doc.setDrawColor(...colors.gold);
  doc.setLineWidth(0.2);
  doc.line(10, 10, 34, 10);
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.11);
  doc.line(10, 10, 10, 36);
}

export function addFooter(doc: jsPDF, settings?: Partial<AgencySettings>): void {
  const pageCount = doc.getNumberOfPages();
  const colors = getBrandColors(settings);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(210, 220, 231);
    doc.setLineWidth(0.13);
    doc.line(14, pageHeight - 16.5, pageWidth - 14, pageHeight - 16.5);
    doc.setDrawColor(...colors.gold);
    doc.setLineWidth(0.16);
    doc.line(14, pageHeight - 16.5, 36, pageHeight - 16.5);
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.muted);
    doc.setFont(undefined as unknown as string, 'normal');
    const footer = settings?.pied_page_personnalise || settings?.nom_agence || 'Samay Këur';
    const city = cleanDocumentText(settings?.city, '');
    const footerLabel = city ? `${cleanDocumentText(footer)} - ${city}` : cleanDocumentText(footer);
    doc.text(fitSingleLine(doc, footerLabel, 118), 14, pageHeight - 10.5);
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

export function drawSubtleSectionTitle(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  settings?: Partial<AgencySettings>,
  subtitle?: string
): number {
  const colors = getBrandColors(settings);
  doc.setFillColor(...colors.gold);
  doc.roundedRect(x, y - 3.2, 1.2, subtitle ? 9.2 : 6.4, 1, 1, 'F');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(9.4);
  doc.setTextColor(...colors.ink);
  doc.text(title, x + 4, y);
  doc.setDrawColor(195, 207, 221);
  doc.setLineWidth(0.16);
  doc.line(x + 4, y + 3, x + width, y + 3);
  if (subtitle) {
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...colors.muted);
    doc.text(subtitle, x + 4, y + 8);
    return y + 14;
  }
  return y + 8;
}

export function drawKeyValueGrid(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  rows: Array<[string, string]>,
  settings?: Partial<AgencySettings>
): number {
  const colors = getBrandColors(settings);
  const colWidth = width / 2;
  const rowHeight = 10;
  rows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + col * colWidth;
    const cellY = y + row * rowHeight;
    doc.setDrawColor(195, 207, 221);
    doc.setLineWidth(0.15);
    doc.setFillColor(index % 4 < 2 ? 255 : 248, index % 4 < 2 ? 255 : 250, index % 4 < 2 ? 255 : 252);
    doc.roundedRect(cellX, cellY, colWidth - 2, rowHeight - 1.5, 1.5, 1.5, 'FD');
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.muted);
    doc.text(label, cellX + 3, cellY + 3.5);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text(fitSingleLine(doc, value, colWidth - 8), cellX + 3, cellY + 7.4);
  });
  return y + Math.ceil(rows.length / 2) * rowHeight + 2;
}

export function drawPaymentSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  values: {
    paid: string;
    due: string;
    remaining: string;
    status: string;
    period: string;
  },
  settings?: Partial<AgencySettings>
): number {
  const colors = getBrandColors(settings);
  const height = 32;
  doc.setFillColor(...colors.primary);
  doc.roundedRect(x, y, width, height, 2.4, 2.4, 'F');
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(209, 250, 229);
  doc.text('Montant encaissé', x + 5, y + 7.8);
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(values.paid, x + 5, y + 18.5);

  doc.setFontSize(7.3);
  doc.setTextColor(226, 232, 240);
  doc.text(`Période : ${values.period}`, x + 5, y + 26.4);

  const rightX = x + width - 5;
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(226, 232, 240);
  doc.text('Statut', rightX, y + 8, { align: 'right' });
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(255, 247, 237);
  doc.text(values.status, rightX, y + 13.5, { align: 'right' });
  doc.setFontSize(7.4);
  doc.setTextColor(226, 232, 240);
  doc.text(`Loyer : ${values.due}`, rightX, y + 21, { align: 'right' });
  doc.text(`Reliquat : ${values.remaining}`, rightX, y + 26.5, { align: 'right' });

  doc.setTextColor(0);
  return y + height + 8;
}

function drawCompactPaymentSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  values: {
    paid: string;
    due: string;
    remaining: string;
    status: string;
    period: string;
  },
  settings?: Partial<AgencySettings>
): number {
  const colors = getBrandColors(settings);
  const height = 28;
  const isSettled = !/partiel/i.test(values.status);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(184, 196, 211);
  doc.setLineWidth(0.22);
  doc.roundedRect(x, y, width, height, 2.6, 2.6, 'FD');
  doc.setFillColor(...colors.paper);
  doc.roundedRect(x + 1.2, y + 1.2, width - 2.4, height - 2.4, 2.2, 2.2, 'F');
  doc.setFillColor(...colors.gold);
  doc.roundedRect(x + 3, y + 4, 1.3, height - 8, 1.2, 1.2, 'F');

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(...colors.gold);
  doc.text('MONTANT ENCAISSÉ', x + 7, y + 7.4);
  doc.setFontSize(17);
  doc.setTextColor(...colors.primary);
  doc.text(values.paid, x + 7, y + 18.2);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...colors.muted);
  doc.text(`Période : ${values.period}`, x + 7, y + 24.2);

  const rightX = x + width - 5;
  const statusWidth = Math.min(40, Math.max(22, doc.getTextWidth(values.status) + 10));
  const badgeX = x + width - statusWidth - 5;
  doc.setFillColor(...(isSettled ? colors.emeraldSoft : colors.goldSoft));
  doc.setDrawColor(...(isSettled ? colors.primary : colors.gold));
  doc.setLineWidth(0.12);
  doc.roundedRect(badgeX, y + 5, statusWidth, 7.5, 1.8, 1.8, 'FD');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(...(isSettled ? colors.primary : colors.gold));
  doc.text(values.status, badgeX + statusWidth / 2, y + 10, { align: 'center' });

  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(...colors.muted);
  doc.text('Loyer total', rightX, y + 17.2, { align: 'right' });
  doc.text('Reliquat', rightX, y + 23.5, { align: 'right' });
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setTextColor(...colors.ink);
  doc.text(values.due, rightX - 30, y + 17.2, { align: 'right' });
  doc.text(values.remaining, rightX - 30, y + 23.5, { align: 'right' });

  doc.setTextColor(0);
  return y + height + 6;
}

export function drawTotalsBlock(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  items: Array<{ label: string; value: string; emphasis?: boolean }>,
  settings?: Partial<AgencySettings>
): number {
  const colors = getBrandColors(settings);
  const height = 14 + Math.ceil(items.length / 2) * 12;
  doc.setFillColor(255, 252, 246);
  doc.setDrawColor(226, 180, 101);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 2.2, 2.2, 'FD');
  doc.setFillColor(255, 247, 232);
  doc.roundedRect(x + 2, y + 2, width - 4, 7.4, 1.7, 1.7, 'F');

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...colors.orange);
  doc.text('Synthèse du mois', x + 4, y + 6.2);

  const colWidth = width / 2;
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + 4 + col * colWidth;
    const cellY = y + 13 + row * 12;
    doc.setFont(undefined as unknown as string, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.muted);
    doc.text(item.label, cellX, cellY);
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(item.emphasis ? 10 : 8.5);
    doc.setTextColor(...(item.emphasis ? colors.primary : ([15, 23, 42] as [number, number, number])));
    doc.text(fitSingleLine(doc, item.value, colWidth - 11), cellX, cellY + 5);
  });

  doc.setTextColor(0);
  return y + height + 8;
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
  const individualOwner = isIndividualOwnerSettings(settings);
  const verification = await registerDocumentVerification({
    type,
    ref,
    agency,
    agencyId: settings?.agency_id,
    amount,
    date,
    paymentStatus,
  });
  const qrDataUrl = verification.registered
    ? await QRCode.toDataURL(verification.url, {
        width: 192,
        margin: 1,
        errorCorrectionLevel: 'H',
      })
    : null;

  const blockHeight = 28;
  drawSectionFrame(doc, x, y, width, blockHeight, settings, {
    accent: verification.registered ? 'neutral' : 'orange',
    fill: true,
  });

  const textX = qrDataUrl ? x + 24 : x + 15;
  if (qrDataUrl) {
    const qrSize = 17;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x + 3.5, y + 4.6, qrSize + 2, qrSize + 2, 1.4, 1.4, 'F');
    doc.addImage(qrDataUrl, 'PNG', x + 4.5, y + 5.5, qrSize, qrSize);
  } else {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(234, 88, 12);
    doc.roundedRect(x + 4, y + 7, 7, 7, 1.5, 1.5, 'FD');
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(194, 65, 12);
    doc.text('!', x + 7.5, y + 12, { align: 'center' });
  }

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    verification.registered ? 'Authentification numérique' : 'Preuve numérique indisponible',
    textX,
    y + 8,
  );
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(...colors.muted);
  const textWidth = width - (textX - x) - 5;
  doc.text(fitSingleLine(doc, 'Réf. ' + ref, textWidth), textX, y + 12.6);
  doc.text(
    fitSingleLine(
      doc,
      (individualOwner ? 'Propriétaire' : 'Émetteur') + ' : ' + safeText(agency, 'Samay Këur'),
      textWidth,
    ),
    textX,
    y + 16.8,
  );
  doc.text(
    verification.registered
      ? 'Authenticité enregistrée dans le registre'
      : 'Aucun QR public n’a été émis pour cette copie',
    textX,
    y + 21,
  );
  doc.setTextColor(0);
}

export async function drawLegalVerificationFooter(
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
  const qrDataUrl = verification.registered
    ? await QRCode.toDataURL(verification.url, {
        width: 192,
        margin: 1,
        errorCorrectionLevel: 'H',
      })
    : null;

  doc.setPage(pageNumber);
  const qrSize = 15;
  const blockWidth = 70;
  const blockHeight = 22;
  const x = pageWidth - 14 - blockWidth;
  const y = pageHeight - 45;
  const textX = qrDataUrl ? x + qrSize + 7 : x + 13;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(184, 196, 211);
  doc.setLineWidth(0.17);
  doc.roundedRect(x, y, blockWidth, blockHeight, 1.8, 1.8, 'FD');

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', x + 3, y + 3.5, qrSize, qrSize);
  } else {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(234, 88, 12);
    doc.roundedRect(x + 3.5, y + 7.5, 6, 6, 1.3, 1.3, 'FD');
    doc.setFont(undefined as unknown as string, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(194, 65, 12);
    doc.text('!', x + 6.5, y + 11.9, { align: 'center' });
  }

  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(30, 41, 59);
  doc.text(
    verification.registered ? 'Authentification numérique' : 'Preuve numérique indisponible',
    textX,
    y + 6.5,
  );
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...colors.muted);
  const availableWidth = blockWidth - (textX - x) - 4;
  doc.text(fitSingleLine(doc, 'Réf. ' + ref, availableWidth), textX, y + 11);
  doc.text(
    verification.registered ? 'Authenticité enregistrée' : 'QR public non émis',
    textX,
    y + 15.2,
  );
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
  const neededHeight = 48;
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
  await drawSignatureBlocks(doc, sectionY + 15 + introLines.length * 1.3, labels, settings);
}

// ---------------------------------------------------------------------------
// PDF generators
// ---------------------------------------------------------------------------

export async function generateContratPDF(contrat: ContratPDFData): Promise<void> {
  if (!contrat) throw new Error('Aucun contrat fourni');

  const settings = await loadAgencySettings();
  const individualOwner = isIndividualOwnerSettings(settings);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const contractRef = applyDocumentPrefix(
    `CTR-${new Date().getFullYear()}-${(contrat.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    'contrat',
    settings,
  );

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
    let templateSource = tpl;
    if (individualOwner) {
      const lines = tpl.split(/\r?\n/);
      if (lines[2]?.toLowerCase().includes('mandataire')) {
        lines[2] = "M. {{bailleur_prenom}} {{bailleur_nom}} (Propriétaire), d'une part;";
      }
      templateSource = lines.join('\n').replace(/\bmandataire\b/gi, 'bailleur');
    }

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
      locataire_cni: locataire.piece_identite ?? 'non renseignée',
      locataire_adresse: locataire.adresse_personnelle ?? 'adresse non renseignée',
      designation: joinClean([contrat.unites?.nom, contrat.unites?.immeubles?.nom], ' - ') || 'bien immobilier désigné dans les informations du contrat',
      destination_local: contrat.destination ?? 'habitation',
      duree_annees: dureeAnnees,
      date_debut: contrat.date_debut
        ? new Date(contrat.date_debut).toLocaleDateString('fr-FR')
        : 'à déterminer',
      date_fin: contrat.date_fin
        ? new Date(contrat.date_fin).toLocaleDateString('fr-FR')
        : 'à déterminer',
      loyer_mensuel: formatCurrency(Number(contrat.loyer_mensuel ?? 0), devise),
      depot_garantie: contrat.caution
        ? formatCurrency(Number(contrat.caution), devise)
        : 'non renseigné',
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
    const body = cleanupLegalBody(templateSource.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const value = dynamicVars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    }));

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
        documentType: 'Document juridique',
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
      labels: [individualOwner ? 'Le propriétaire' : 'Le bailleur / mandataire', 'Le locataire'],
      leftMargin,
      usableWidth,
      settings,
    });
  } catch (err) {
    console.error('Erreur génération contrat:', err);
  }

  addFooter(doc, settings);
  if (isDocumentQrEnabled(settings, 'contrat')) {
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

  const loyer = Number(paiement.montant_attendu ?? contrat.loyer_mensuel ?? 0);
  const paye = Number(paiement.montant_total ?? 0);
  const paiementsPrecedents = Number(paiement.paiements_precedents ?? Math.max(Number(paiement.montant_encaisse_cumul ?? 0) - paye, 0) ?? 0);
  const totalPayeMois = Number(paiement.total_paye_mois ?? paiement.montant_encaisse_cumul ?? (paiementsPrecedents + paye));
  const reliquat = paiement.reliquat != null
    ? Number(paiement.reliquat)
    : Math.max(loyer - totalPayeMois, 0);
  const statusLabel = reliquat > 0 ? 'Paiement partiel' : 'Soldé';
  const paiementDocumentType: PdfDocumentType = reliquat > 0 ? 'facture' : 'quittance';
  // Numéro de quittance unique (QIT-AAAAMM-XXXX) — légalement traçable
  const ref = applyDocumentPrefix(paiement.reference ?? generateQuittanceRef(paiement), paiementDocumentType, settings);

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
        documentType: reliquat > 0 ? 'Facture partielle' : 'Quittance',
      }
  );

  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : '—';
  const tenantName = joinClean([locataire.prenom, locataire.nom]) || 'Locataire non renseigné';
  const propertyLabel = joinClean([unite.nom, unite.immeubles?.nom], ' - ') || 'Logement non renseigné';
  const addressLabel = cleanDocumentText(
    (unite.immeubles as { adresse?: string } | undefined)?.adresse,
    'Adresse non renseignée'
  );

  let y = titleY + 4;
  y = drawCompactPaymentSummaryCard(
    doc,
    leftMargin,
    y,
    usableWidth,
    {
      paid: formatCurrency(paye, devise),
      due: formatCurrency(loyer, devise),
      remaining: formatCurrency(reliquat, devise),
      status: statusLabel,
      period: moisConcerne,
    },
    settings
  );

  y = drawSubtleSectionTitle(
    doc,
    leftMargin,
    y,
    usableWidth,
    'Informations de quittance',
    settings,
    'Contexte locatif, période concernée et référence du paiement'
  );
  y = drawKeyValueGrid(
    doc,
    leftMargin,
    y,
    usableWidth,
    [
      ['Locataire', tenantName],
      ['Logement', propertyLabel],
      ['Adresse', addressLabel],
      ['Période', moisConcerne],
      ['Référence', ref],
      ['Date paiement', datePaiement],
    ],
    settings
  );
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Libellé', 'Montant']],
    body: [
      ['Montant du loyer', formatCurrency(loyer, devise)],
      ['Paiements précédents', formatCurrency(paiementsPrecedents, devise)],
      ['Nouveau paiement', formatCurrency(paye, devise)],
      ['Total payé à ce jour', formatCurrency(totalPayeMois, devise)],
      ['Reliquat (reste à payer)', formatCurrency(reliquat, devise)],
    ],
    theme: 'grid',
    ...getAutoTableTheme(settings),
    bodyStyles: { fontStyle: 'normal' },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      const raw = Array.isArray(data.row.raw) ? data.row.raw : [];
      if (raw[0] === 'Total payé à ce jour') {
        data.cell.styles.fillColor = [232, 246, 240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [20, 83, 45];
      }
      if (raw[0]?.toString().startsWith('Reliquat')) {
        data.cell.styles.fillColor = reliquat > 0 ? [255, 247, 232] : [248, 250, 252];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = reliquat > 0 ? [180, 83, 9] : [71, 85, 105];
      }
    },
    margin: { left: leftMargin, right: rightMargin },
    tableWidth: usableWidth,
  });

  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : y + 8;
  const finalBlockHeight = 30;
  const finalBlockBottom = doc.internal.pageSize.getHeight() - 23;
  if (finalY + finalBlockHeight > finalBlockBottom) {
    finalY = ensureDocumentSpace(doc, finalY, finalBlockHeight, settings, 24, 23);
  }
  const qrWidth = isDocumentQrEnabled(settings, paiementDocumentType) ? 74 : 0;
  const qrGap = qrWidth > 0 ? 7 : 0;
  const mentionsWidth = usableWidth - qrWidth - qrGap;

  const mentions = [
    getPdfDocumentPreferences(settings).receipt_notice,
    reliquat > 0
      ? 'Tout reliquat, charge ou obligation non réglée demeure exigible conformément au bail.'
      : null,
  ];

  const colors = getBrandColors(settings);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.13);
  doc.roundedRect(leftMargin, finalY, mentionsWidth, finalBlockHeight, 2.2, 2.2, 'FD');
  doc.setFillColor(...colors.goldSoft);
  doc.roundedRect(leftMargin + 2, finalY + 2, mentionsWidth - 4, 7.2, 1.8, 1.8, 'F');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...colors.gold);
  doc.text('Mentions légales', leftMargin + 5, finalY + 6.8);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(30, 41, 59);
  let yMentions = finalY + 13.7;
  for (const m of mentions.filter(Boolean) as string[]) {
    const lines = doc.splitTextToSize(`- ${m}`, mentionsWidth - 10) as string[];
    doc.text(lines, leftMargin + 5, yMentions);
    yMentions += lines.length * 3.6 + 1;
  }

  if (settings.pied_page_personnalise) {
    doc.setFontSize(5.9);
    doc.setTextColor(100, 116, 139);
    const footerLines = doc.splitTextToSize(settings.pied_page_personnalise, mentionsWidth - 10) as string[];
    doc.text(footerLines.slice(0, 1), leftMargin + 5, finalY + 27.2);
  }

  await drawCompactSignatureSeal(doc, leftMargin, finalY, mentionsWidth, finalBlockHeight, settings);

  if (isDocumentQrEnabled(settings, paiementDocumentType)) {
    try {
      await drawVerificationBlock(doc, {
        x: leftMargin + mentionsWidth + qrGap,
        y: finalY,
        width: qrWidth,
        ref,
        type: 'quittance',
        agency: settings.nom_agence ?? 'Samay Këur',
        amount: paye,
        date: paiement.date_paiement ?? new Date().toISOString(),
        paymentStatus: statusLabel,
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
      paiementsPrecedents,
      totalPayeMois,
      reliquat,
      agency: settings,
    },
    preview: {
      columns: ['Ligne', 'Montant'],
      rows: [
        { Ligne: 'Loyer attendu', Montant: formatCurrency(loyer, devise) },
        { Ligne: 'Paiements précédents', Montant: formatCurrency(paiementsPrecedents, devise) },
        { Ligne: 'Nouveau paiement', Montant: formatCurrency(paye, devise) },
        { Ligne: 'Total payé à ce jour', Montant: formatCurrency(totalPayeMois, devise) },
        { Ligne: 'Reliquat', Montant: formatCurrency(reliquat, devise) },
      ],
      rowCount: 5,
      period: moisConcerne,
      stats: [
        { label: 'Référence', value: ref },
        { label: 'Statut', value: statusLabel },
      ],
    },
  });
}

export async function generateMandatBailleurPDF(bailleur: MandatPDFData): Promise<void> {
  if (!bailleur) throw new Error('Aucun bailleur fourni');

  const settings = await loadAgencySettings();
  if (isIndividualOwnerSettings(settings)) {
    throw new Error("Le mandat de gérance est réservé aux agences et gestionnaires qui administrent des biens pour des tiers.");
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const mandatRef = applyDocumentPrefix(
    `MDT-${new Date().getFullYear()}-${(bailleur.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    'mandat',
    settings,
  );

  try {
    const tpl = await fetchTemplate('/templates/mandat_gerance.txt');

    const bienAdresse = cleanDocumentText(bailleur.bien_adresse, '');
    const bienComposition = cleanDocumentText(bailleur.bien_composition, '');
    const bienDescription = bienAdresse
      ? bienComposition
        ? `la gestion complète de son bien immobilier sis à ${bienAdresse}, composé de ${bienComposition}, dans son état actuel à la remise des clés`
        : `la gestion complète de son bien immobilier sis à ${bienAdresse}, dans son état actuel à la remise des clés`
      : 'la gestion complète du bien immobilier désigné dans les informations du mandat';

    const vars: Record<string, string> = {
      agency_name: settings.nom_agence ?? 'Gestion Locative',
      agency_address: settings.adresse ?? '',
      agency_ninea: settings.ninea ?? '',
      agency_rc: settings.rc ?? '',
      agency_manager_full_name: settings.representant_nom ?? 'Le représentant habilité',
      agency_manager_title: settings.representant_fonction ?? 'Gérant',
      agency_manager_id_type: settings.manager_id_type ?? 'CNI',
      agency_manager_id_number: settings.manager_id_number ?? 'non renseigné',
      agency_city: settings.city ?? 'Dakar',
      bailleur_prenom: bailleur.prenom ?? '',
      bailleur_nom: bailleur.nom ?? '',
      bailleur_cni: bailleur.piece_identite ?? 'non renseignée',
      bailleur_adresse: bailleur.adresse ?? 'adresse non renseignée',
      bien_adresse: bienAdresse,
      bien_composition: bienComposition,
      bien_description: bienDescription,
      taux_honoraires: bailleur.commission != null ? String(bailleur.commission) : 'non renseigné',
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
    let body = cleanupLegalBody(tpl.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const value = vars[key.trim()] ?? '';
      if (value) dynamicValues.push(value);
      return value;
    }));

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
        documentType: 'Mandat de gestion',
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
  if (isDocumentQrEnabled(settings, 'mandat')) {
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
        { Champ: 'Bien', Valeur: bailleur.bien_adresse ?? 'Bien désigné au mandat' },
        { Champ: 'Commission', Valeur: bailleur.commission != null ? `${bailleur.commission}%` : 'Non renseignée' },
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
