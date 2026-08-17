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
import { formatCurrency, formatInternationalPhone, formatDate } from './formatters';
import type { OwnerReportSnapshotPayload } from '../services/api/documentSnapshotApi';
import {
  announceGeneratedDocument,
  GeneratedDocumentKind,
  type GeneratedDocumentPreview,
} from './documentGenerated';
import { saveManagedDocument, type ManagedDocumentType } from '../services/documentRegistry';
import { resolveAgencySettingsAssets } from '../services/agencyIdentityAssets';
import {
  linkDocumentVerificationRegistryCommand,
  registerDocumentVerificationCommand,
  revokeDocumentVerificationCommand,
} from '../services/api/documentVerificationCommands';
import {
  allocateDocumentReference,
  resolvePublishedDocumentTemplate,
} from '../services/documentTemplateService';
import { renderDocumentTemplate } from './documents/templateEngine';
import type { DocumentTemplateContent, ResolvedDocumentTemplate } from '../types/documentStudio';
import type {
  DocumentArchiveStatus,
  DocumentGenerationLifecycle,
  DocumentVerificationStatus,
} from './documentGeneration';
import {
  applyPdfMetadata,
  type PdfMetadataDocumentType,
  type PdfMetadataInput,
} from './pdfMetadata';
import {
  getContratPreviewSample,
  getMandatPreviewSample,
  getPaiementPreviewSample,
  getRapportPreviewSample,
  PREVIEW_REFERENCE_PLACEHOLDER,
} from './documents/documentPreviewSamples';

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
  stamp_url: DEFAULT_AGENCY_SETTINGS.stamp_url ?? null,
  signature_enabled: DEFAULT_AGENCY_SETTINGS.signature_enabled ?? false,
  stamp_enabled: DEFAULT_AGENCY_SETTINGS.stamp_enabled ?? false,
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
const pendingVerificationByReference = new Map<string, string>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const AGENCY_SETTINGS_SELECT_LEGACY = `agency_id, nom_agence, adresse, telephone, email, site_web, logo_url, couleur_primaire, couleur_secondaire,
  ninea, rc, representant_nom, representant_fonction,
  manager_id_type, manager_id_number, city, devise,
  pied_page_personnalise, signature_url, stamp_url, signature_enabled, stamp_enabled, qr_code_quittances,
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
    template?: ResolvedDocumentTemplate;
    assetUrls?: Record<string, string | null | undefined>;
    generation?: DocumentGenerationLifecycle;
    verificationExpected?: boolean;
    metadata?: Omit<PdfMetadataInput, 'documentType'> & {
      documentType?: PdfMetadataDocumentType;
    };
  }
) {
  // ManagedDocumentType est désormais un sous-ensemble strict de PdfMetadataDocumentType
  // (les deux registres de types ont été réconciliés) — plus besoin de renarrowing manuel.
  const metadataDocumentType: PdfMetadataDocumentType =
    options.metadata?.documentType ??
    options.documentType ??
    (options.kind === 'commission'
      ? 'rapport_bailleur'
      : options.kind === 'inventaire'
        ? 'inventaire'
        : 'document');
  applyPdfMetadata(doc, {
    ...options.metadata,
    documentType: metadataDocumentType,
    reference: options.metadata?.reference ?? options.reference,
  });

  const blob = doc.output('blob');
  let url = '';
  let fileSize = blob.size;
  let reused = false;
  let version: number | undefined;
  let storagePath: string | undefined;
  const managedExpected = Boolean(
    options.documentType && options.entityId && options.reference,
  );
  let archiveStatus: DocumentArchiveStatus = managedExpected
    ? 'pending'
    : 'not-applicable';
  let verificationStatus: DocumentVerificationStatus = options.verificationExpected
    ? 'pending'
    : 'not-applicable';

  if (options.documentType && options.entityId && options.reference) {
    options.generation?.report('archiving-document', {
      reference: options.reference,
      archiveStatus: 'pending',
      verificationStatus,
    });
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
        template: options.template,
        assetUrls: options.assetUrls,
      });

      if (!managed) {
        throw new Error('REGISTRY_CONTEXT_REQUIRED');
      }

      url = managed.url;
      fileSize = managed.fileSize;
      reused = managed.reused;
      version = managed.version;
      storagePath = managed.storagePath;
      const verificationId = pendingVerificationByReference.get(options.reference);
      if (verificationId && managed.entry) {
        await linkDocumentVerificationRegistryCommand({
          verificationId,
          registryId: managed.entry.id,
          registryVersion: managed.version,
          templateChecksum: options.template?.checksum ?? null,
          metadata: {
            source: 'pdf_generation',
            registry_version: managed.version,
            renderer_version: options.template?.rendererVersion ?? null,
          },
        });
        pendingVerificationByReference.delete(options.reference);
        verificationStatus = 'active';
      } else if (options.verificationExpected) {
        verificationStatus = 'unavailable';
      }
      archiveStatus = 'ready';
    } catch (error) {
      const verificationId = pendingVerificationByReference.get(options.reference);
      if (verificationId) {
        await revokeDocumentVerificationCommand(verificationId, 'registry_archive_failed');
        pendingVerificationByReference.delete(options.reference);
      }
      console.error('[DocumentRegistry] Émission officielle interrompue.', error);
      options.generation?.report('archiving-document', {
        reference: options.reference,
        archiveStatus: 'incomplete',
        verificationStatus: options.verificationExpected
          ? 'unavailable'
          : 'not-applicable',
      });
      throw new Error(
        "L'archivage sécurisé du document a échoué. Aucun document officiel n'a été émis.",
      );
    }
  }

  if (!url) {
    url = URL.createObjectURL(blob);
  }

  options.generation?.report('loading-preview', {
    reference: options.reference,
    archiveStatus,
    verificationStatus,
  });

  if (!reused) {
    doc.save(options.fileName);
  }

  return announceGeneratedDocument({
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
    generationKey: options.generation?.key,
    reference: options.reference,
    archiveStatus,
    verificationStatus,
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

type DocumentVerificationRegistration =
  | { id: string; token: string; url: string; registered: true }
  | { token: null; url: null; registered: false };

async function registerDocumentVerification(
  payload: DocumentVerificationPayload,
  required = false,
): Promise<DocumentVerificationRegistration> {
  if (!payload.agencyId) {
    if (required) {
      throw new Error(
        "L'organisation emettrice est requise pour generer un document avec QR Verify.",
      );
    }
    console.warn('[PDF] QR omis : organisation émettrice absente.');
    return { token: null, url: null, registered: false };
  }

  try {
    const issuedAt = payload.date ? new Date(payload.date).toISOString() : new Date().toISOString();
    const payloadHash = await sha256Hex([
      payload.type,
      payload.ref,
      payload.agencyId,
      payload.agency,
      payload.amount ?? 0,
      payload.date?.slice(0, 10) ?? '',
      payload.paymentStatus ?? '',
    ].join('|'));

    const inserted = await registerDocumentVerificationCommand({
      agencyId: payload.agencyId,
      documentRef: payload.ref,
      documentType: payload.type,
      agencyName: payload.agency,
      issuedAt,
      amountXof: payload.amount ?? null,
      paymentStatus: payload.paymentStatus ?? null,
      payloadHash,
      metadata: {
        source: 'pdf_generation',
        version: 1,
      },
    });

    pendingVerificationByReference.set(payload.ref, inserted.id);
    return {
      id: inserted.id,
      token: inserted.token,
      registered: true,
      url: buildVerificationUrl({ type: payload.type, ref: payload.ref, token: inserted.token }),
    };
  } catch (error) {
    if (required) {
      console.error('[PDF] Échec bloquant du registre QR Verify.', error);
      throw new Error(
        "Le registre QR Verify est indisponible. Le document n'a pas été généré.",
      );
    }
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

export async function loadAgencySettings(): Promise<Partial<AgencySettings>> {
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
    const rawSettings = ({
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
    const settings = await resolveAgencySettingsAssets(rawSettings);
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

export function isDocumentQrEnabled(settings: Partial<AgencySettings> | undefined, type: PdfDocumentType): boolean {
  if (settings?.qr_code_quittances === false) return false;
  return getPdfDocumentPreferences(settings).qr_documents[type] !== false;
}

export function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const normalized = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function getBrandColors(settings?: Partial<AgencySettings>) {
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

function applyPublishedTemplateStyle(
  settings: Partial<AgencySettings>,
  template: ResolvedDocumentTemplate,
): Partial<AgencySettings> {
  return {
    ...settings,
    logo_url: settings.logo_url,
    signature_enabled: settings.signature_enabled === true,
    stamp_enabled: settings.stamp_enabled === true,
    document_preferences: {
      ...(settings.document_preferences ?? {}),
      header_style: template.content.style.header,
      show_document_number: template.content.style.showDocumentNumber,
    },
  };
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
  const signatureImage = settings?.signature_enabled
    ? await loadImageAsPngDataUrl(settings.signature_url, 460)
    : null;
  const stampImage = settings?.stamp_enabled
    ? await loadImageAsPngDataUrl(settings.stamp_url, 360)
    : null;
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
      const imageX = stampImage ? x + width - imageWidth - 5 : x + (width - imageWidth) / 2;
      const imageY = y + 11;
      doc.addImage(signatureImage.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
    }
    if (stampImage && index === agencySignatureIndex) {
      const ratio = Math.min(18 / stampImage.width, 12 / stampImage.height, 1);
      const stampWidth = Math.max(8, stampImage.width * ratio);
      const stampHeight = Math.max(6, stampImage.height * ratio);
      doc.addImage(stampImage.dataUrl, 'PNG', x + 5, y + 11, stampWidth, stampHeight);
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

async function drawSingleSignatureBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  settings?: Partial<AgencySettings>
): Promise<void> {
  const colors = getBrandColors(settings);
  const individualOwner = isIndividualOwnerSettings(settings);
  const signatureImage = settings?.signature_enabled
    ? await loadImageAsPngDataUrl(settings.signature_url, 460)
    : null;
  const stampImage = settings?.stamp_enabled
    ? await loadImageAsPngDataUrl(settings.stamp_url, 360)
    : null;

  if (!signatureImage && !stampImage) return;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(184, 196, 211);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 2.2, 2.2, 'FD');
  doc.setFillColor(...colors.paper);
  doc.roundedRect(x + 1.2, y + 1.2, width - 2.4, 8.2, 1.8, 1.8, 'F');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text(individualOwner ? 'Le propriétaire' : 'Le bailleur / mandataire', x + 4, y + 6.2);

  if (signatureImage) {
    const maxImageWidth = width - 12;
    const maxImageHeight = height - 20;
    const ratio = Math.min(maxImageWidth / signatureImage.width, maxImageHeight / signatureImage.height, 1);
    const imageWidth = Math.max(8, signatureImage.width * ratio);
    const imageHeight = Math.max(4, signatureImage.height * ratio);
    const imageX = stampImage ? x + width - imageWidth - 5 : x + (width - imageWidth) / 2;
    const imageY = y + 11;
    doc.addImage(signatureImage.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
  }
  if (stampImage) {
    const ratio = Math.min(18 / stampImage.width, 12 / stampImage.height, 1);
    const stampWidth = Math.max(8, stampImage.width * ratio);
    const stampHeight = Math.max(6, stampImage.height * ratio);
    doc.addImage(stampImage.dataUrl, 'PNG', x + 5, y + 11, stampWidth, stampHeight);
  }

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.22);
  doc.line(x + 4, y + height - 11.5, x + width - 4, y + height - 11.5);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...colors.muted);
  doc.text('Nom, date et signature', x + 4, y + height - 6.5);
  doc.text(individualOwner ? 'Cachet ou mention le cas échéant' : 'Cachet le cas échéant', x + 4, y + height - 2.7);
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
  const headerStyle = settings.document_preferences?.header_style ?? 'sobriete';

  doc.setFillColor(...(headerStyle === 'institutionnel' ? colors.paper : [255, 255, 255] as [number, number, number]));
  doc.rect(0, 0, pageWidth, 66, 'F');
  doc.setFillColor(...colors.primary);
  if (headerStyle === 'moderne') {
    doc.rect(0, 0, pageWidth, 5.2, 'F');
  } else {
    doc.rect(0, 0, headerStyle === 'institutionnel' ? 2.4 : 3.6, 66, 'F');
  }
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
    const maxLogoWidth = 65;
    const maxLogoHeight = 26;
    const imgRatio = logo.width / logo.height;
    const boxRatio = maxLogoWidth / maxLogoHeight;
    
    let logoWidth, logoHeight;
    if (imgRatio > boxRatio) {
      logoWidth = maxLogoWidth;
      logoHeight = maxLogoWidth / imgRatio;
    } else {
      logoHeight = maxLogoHeight;
      logoWidth = maxLogoHeight * imgRatio;
    }
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
    settings.telephone ? `Tél : ${formatInternationalPhone(settings.telephone, '')}` : null,
    settings.email ? `Email : ${settings.email}` : null,
    !individualOwner && settings.ninea ? `NINEA : ${settings.ninea}` : null,
    !individualOwner && settings.rc ? `RC : ${settings.rc}` : null,
    settings.site_web ? `Web : ${settings.site_web}` : null,
  ].filter(Boolean) as string[];
  infoLines.slice(0, 5).forEach((line, index) => {
    doc.text(line, infoX, 19.3 + index * 4.2, { align: infoAlign });
  });

  const textBottom = 19.3 + (infoLines.slice(0, 5).length - 1) * 4.2 + 2;
  const separatorY = Math.max(textBottom, logoBottom) + 4;
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
  if (meta.reference && settings.document_preferences?.show_document_number !== false) {
    details.push(`Réf. ${meta.reference}`);
  }
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
  const stableId = (p.id ?? `${y}${m}`)
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .padEnd(8, '0')
    .toUpperCase();
  return `QIT-${y}${m}-${stableId}`;
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
  const marginBottom = 18;
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

  for (let paragraph of paragraphs) {
    const isArticleTitle = /^(ARTICLE|Article)\s+[\dIVXLC]+/.test(paragraph);
    let isNumberedPoint = /^\d+[).]\s+/.test(paragraph);

    if (isArticleTitle) {
      const parts = paragraph.split('\n');
      const titleText = parts[0];
      paragraph = parts.slice(1).join('\n').trim();
      isNumberedPoint = /^\d+[).]\s+/.test(paragraph);

      const neededSpace = 14;
      ensureSpace(neededSpace);

      // Si y <= 25, cela signifie qu'on est tout en haut d'une nouvelle page (soit parce qu'ensureSpace a ajouté une page, soit parce que le paragraphe précédent s'est terminé pile en bas).
      if (y > 25 && y > startY + 2) {
        y += 5.5;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.1);
        doc.line(leftMargin, y - 3.8, leftMargin + usableWidth, y - 3.8);
      } else {
        y += 1.5;
      }

      doc.setFont(undefined as unknown as string, 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(...colors.primary);

      const titleLines = doc.splitTextToSize(titleText, usableWidth) as string[];
      doc.text(titleLines, leftMargin, y);
      y += titleLines.length * 4.5;
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 41, 59);

      if (!paragraph) continue;
      y += 1.5;
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

function renderStructuredTemplateToDoc(
  doc: jsPDF,
  template: ResolvedDocumentTemplate,
  variables: Record<string, string>,
  startY: number,
  leftMargin: number,
  usableWidth: number,
  settings?: Partial<AgencySettings>,
) {
  const rendered = renderDocumentTemplate(template.content, variables);
  const editorialBlocks = rendered.blocks.filter((block) => block.kind !== 'signature' && block.kind !== 'system');
  const body = editorialBlocks
    .map((block) => `${block.title.toUpperCase()}\n${block.content}`)
    .join('\n\n');
  const dynamicValues = [...new Set(Object.values(variables).filter(Boolean))];
  return renderTemplateToDoc(
    doc,
    cleanupLegalBody(body),
    dynamicValues,
    startY,
    leftMargin,
    usableWidth,
    template.content.style.density === 'compact' ? 5.6 : 6.4,
    template.content.style.density === 'compact' ? 9.2 : 10.5,
    settings,
  );
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
  doc.setTextColor(...colors.primary);
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
    /** En mode aperçu : ne jamais écrire de preuve de vérification en base. */
    previewMode?: boolean;
  }
): Promise<void> {
  const { x, y, width, ref, type, agency, amount, date, paymentStatus, settings, previewMode } = options;
  const colors = getBrandColors(settings);
  const individualOwner = isIndividualOwnerSettings(settings);
  const verification: DocumentVerificationRegistration = previewMode
    ? {
        id: 'preview',
        token: 'preview',
        registered: true,
        url: `${getPublicVerifyBaseUrl()}/verify?preview=1`,
      }
    : await registerDocumentVerification({
        type,
        ref,
        agency,
        agencyId: settings?.agency_id,
        amount,
        date,
        paymentStatus,
      }, true);
  const qrDataUrl = verification.registered
    ? await QRCode.toDataURL(verification.url, {
        width: 192,
        margin: 1,
        errorCorrectionLevel: 'H',
      })
    : null;

  const blockHeight = 28;
  doc.setFillColor(...colors.surface);
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, blockHeight, 2.5, 2.5, 'FD');

  const textX = qrDataUrl ? x + 26 : x + 15;
  if (qrDataUrl) {
    const qrSize = 18;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.roundedRect(x + 4, y + 5, qrSize + 2, qrSize + 2, 1.5, 1.5, 'FD');
    doc.addImage(qrDataUrl, 'PNG', x + 5, y + 6, qrSize, qrSize);
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
  doc.setFontSize(7.6);
  doc.setTextColor(...colors.primary);
  doc.text(
    verification.registered ? 'Vérification numérique' : 'Preuve numérique indisponible',
    textX,
    y + 9.5,
  );
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...colors.muted);
  const textWidth = width - (textX - x) - 5;
  doc.text(fitSingleLine(doc, 'Réf. ' + ref, textWidth), textX, y + 14.5);
  doc.text(
    fitSingleLine(
      doc,
      (individualOwner ? 'Propriétaire' : 'Émetteur') + ' : ' + safeText(agency, 'Samay Këur'),
      textWidth,
    ),
    textX,
    y + 19,
  );
  doc.text(
    verification.registered
      ? 'Enregistrement confirmé dans le registre'
      : 'Aucun QR public n’a été émis pour cette copie',
    textX,
    y + 23.5,
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
    previewMode?: boolean;
  }
): Promise<void> {
  const { ref, type, agency, date, settings, previewMode } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNumber = doc.getNumberOfPages();

  doc.setPage(pageNumber);
  const blockWidth = 80;
  const x = pageWidth - 14 - blockWidth;
  const y = pageHeight - 45;

  await drawVerificationBlock(doc, {
    x,
    y,
    width: blockWidth,
    ref,
    type,
    agency,
    date,
    settings,
    previewMode,
  });
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
  let sectionY = y + 4;
  const beforePage = doc.getCurrentPageInfo().pageNumber;

  sectionY = ensureDocumentSpace(doc, sectionY, neededHeight, settings, 22, 40);
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
  await drawSignatureBlocks(doc, sectionY + 6 + introLines.length * 3.5, labels, settings);
}

// ---------------------------------------------------------------------------
// PDF generators
// ---------------------------------------------------------------------------

/**
 * Dessine le contenu complet d'un contrat de location sur un jsPDF déjà créé.
 * Fonction pure côté effets de bord "documentaires" : le seul effet de bord
 * conditionnel est l'enregistrement de la preuve QR (drawLegalVerificationFooter),
 * neutralisé quand `previewMode` est vrai. N'alloue jamais de référence, n'écrit
 * jamais dans document_registry — c'est le rôle de l'appelant.
 */
async function buildContratDocument(
  contrat: ContratPDFData,
  contractTemplate: ResolvedDocumentTemplate,
  contractRef: string,
  settings: Partial<AgencySettings>,
  options?: { previewMode?: boolean; generation?: DocumentGenerationLifecycle },
): Promise<{ doc: jsPDF; qrEnabled: boolean }> {
  const previewMode = options?.previewMode ?? false;
  const generation = options?.generation;
  const individualOwner = isIndividualOwnerSettings(settings);
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
    const endY = renderStructuredTemplateToDoc(
      doc,
      contractTemplate,
      dynamicVars,
      bodyY,
      leftMargin,
      usableWidth,
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
  } catch (error) {
    console.error('Erreur génération contrat:', error);
    throw error;
  }

  addFooter(doc, settings);
  const contractQrEnabled =
    contractTemplate.content.style.showQr &&
    isDocumentQrEnabled(settings, 'contrat');
  if (contractQrEnabled) {
    generation?.report('securing-document', {
      reference: contractRef,
      verificationStatus: 'pending',
    });
    await drawLegalVerificationFooter(doc, {
      ref: contractRef,
      type: 'contrat',
      agency: settings.nom_agence ?? 'Samay Këur',
      date: new Date().toISOString(),
      settings,
      previewMode,
    });
  }

  return { doc, qrEnabled: contractQrEnabled };
}

export async function generateContratPDF(
  contrat: ContratPDFData,
  generation?: DocumentGenerationLifecycle,
): Promise<void> {
  if (!contrat) throw new Error('Aucun contrat fourni');

  const loadedSettings = await loadAgencySettings();
  const contractTemplate = await resolvePublishedDocumentTemplate('contrat', loadedSettings.agency_id);
  const settings = applyPublishedTemplateStyle(loadedSettings, contractTemplate);
  const contractRefFallback = applyDocumentPrefix(
    `CTR-${new Date().getFullYear()}-${(contrat.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    'contrat',
    settings,
  );
  const contractRef = await allocateDocumentReference({
    documentType: 'contrat',
    entityId: contrat.id ?? contractRefFallback,
    periodKey: contrat.date_debut?.slice(0, 7),
    format: settings.document_preferences?.numbering_format,
    prefix: getPdfDocumentPreferences(settings).prefixes.contrat,
    fallback: contractRefFallback,
  });
  generation?.report('building-document', { reference: contractRef });

  const { doc, qrEnabled: contractQrEnabled } = await buildContratDocument(
    contrat,
    contractTemplate,
    contractRef,
    settings,
    { generation },
  );

  const locataire = (contrat.locataires ?? {}) as {
    prenom?: string;
    nom?: string;
  };

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
      template: {
        revisionId: contractTemplate.revisionId,
        revision: contractTemplate.revision,
        checksum: contractTemplate.checksum,
        source: contractTemplate.source,
        rendererVersion: contractTemplate.rendererVersion,
      },
    },
    template: contractTemplate,
    generation,
    verificationExpected: contractQrEnabled,
    metadata: {
      documentType: 'contrat',
      reference: contractRef,
      agencyName: settings.nom_agence ?? undefined,
      partyName: `${locataire.prenom ?? ''} ${locataire.nom ?? ''}`.trim(),
      createdAt: new Date(),
    },
    assetUrls: {
      logo: settings.logo_url,
      signature: settings.signature_enabled ? settings.signature_url : null,
      stamp: settings.stamp_enabled ? settings.stamp_url : null,
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

interface PaiementReceiptComputed {
  loyer: number;
  paye: number;
  paiementsPrecedents: number;
  totalPayeMois: number;
  reliquat: number;
  statusLabel: string;
  paiementDocumentType: PdfDocumentType;
}

/**
 * Dessine le contenu complet d'une quittance/reçu de paiement sur un jsPDF déjà
 * créé. `computed` regroupe les valeurs dérivées de `paiement` qui ont déjà servi
 * à l'appelant à choisir le type de modèle et à allouer la référence — elles ne
 * sont jamais recalculées ici pour éviter toute divergence entre les deux calculs.
 */
async function buildPaiementReceiptDocument(
  paiement: PaiementPDFData,
  receiptTemplate: ResolvedDocumentTemplate,
  ref: string,
  settings: Partial<AgencySettings>,
  computed: PaiementReceiptComputed,
  options?: { previewMode?: boolean; generation?: DocumentGenerationLifecycle },
): Promise<{ doc: jsPDF; qrEnabled: boolean }> {
  const previewMode = options?.previewMode ?? false;
  const generation = options?.generation;
  const { loyer, paye, paiementsPrecedents, totalPayeMois, reliquat, statusLabel, paiementDocumentType } = computed;

  const contrat = (paiement.contrats ?? {}) as {
    locataires?: { prenom?: string; nom?: string };
    unites?: { nom?: string; immeubles?: { nom?: string; adresse?: string } };
    loyer_mensuel?: number;
  };
  const locataire = contrat.locataires ?? {};
  const unite = contrat.unites ?? {};

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const enabledReceiptSections = new Set(
    receiptTemplate.content.blocks
      .filter((block) => block.enabled && block.systemKey)
      .map((block) => block.systemKey),
  );

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
  if (enabledReceiptSections.has('payment_summary')) {
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
  }

  y = drawSubtleSectionTitle(
    doc,
    leftMargin,
    y,
    usableWidth,
    'Informations de quittance',
    settings,
    'Contexte locatif, période concernée et référence du paiement'
  );
  const receiptIdentityRows: [string, string][] = [
    ...(enabledReceiptSections.has('tenant_identity') ? [['Locataire', tenantName] as [string, string]] : []),
    ...(enabledReceiptSections.has('property_identity') ? [
      ['Logement', propertyLabel] as [string, string],
      ['Adresse', addressLabel] as [string, string],
    ] : []),
    ['Période', moisConcerne],
    ['Référence', ref],
    ['Date paiement', datePaiement],
  ];
  y = drawKeyValueGrid(
    doc,
    leftMargin,
    y,
    usableWidth,
    receiptIdentityRows,
    settings
  );
  y += 3;

  if (enabledReceiptSections.has('payment_breakdown')) autoTable(doc, {
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
  const receiptQrEnabled = receiptTemplate.content.style.showQr
    && enabledReceiptSections.has('qr_verification')
    && isDocumentQrEnabled(settings, paiementDocumentType);
  const mentionsWidth = usableWidth; // Pleine largeur

  const finalBlockBottom = doc.internal.pageSize.getHeight() - 23;
  const finalBlockHeight = 44; // 12 pour les mentions + 32 pour le QR/Signature
  if (finalY + finalBlockHeight > finalBlockBottom) {
    finalY = ensureDocumentSpace(doc, finalY, finalBlockHeight, settings, 24, 23);
  }

  const mentions = [
    receiptTemplate.content.blocks.find((block) => block.kind === 'footer' && block.enabled)?.content
      || getPdfDocumentPreferences(settings).receipt_notice,
    reliquat > 0
      ? 'Tout reliquat, charge ou obligation non réglée demeure exigible conformément au bail.'
      : null,
  ];

  let calculatedHeight = 12.5;
  const filteredMentions = mentions.filter(Boolean) as string[];
  const wrappedMentions = filteredMentions.map(m => doc.splitTextToSize(`- ${m}`, mentionsWidth - 10) as string[]);
  for (const lines of wrappedMentions) {
    calculatedHeight += lines.length * 3.6 + 1;
  }

  const colors = getBrandColors(settings);
  const mentionsHeight = Math.max(16, calculatedHeight + 2); // 2mm padding at the bottom
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.13);
  doc.roundedRect(leftMargin, finalY, mentionsWidth, mentionsHeight, 2.2, 2.2, 'FD');
  doc.setFillColor(...colors.goldSoft);
  doc.roundedRect(leftMargin + 2, finalY + 2, mentionsWidth - 4, 7.2, 1.8, 1.8, 'F');
  doc.setFont(undefined as unknown as string, 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...colors.gold);
  doc.text('Mentions légales', leftMargin + 5, finalY + 6.8);
  doc.setFont(undefined as unknown as string, 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(30, 41, 59);

  let yMentions = finalY + 12.5;
  for (const lines of wrappedMentions) {
    doc.text(lines, leftMargin + 5, yMentions);
    yMentions += lines.length * 3.6 + 1;
  }

  const qrAndSignatureY = finalY + mentionsHeight + 4;

  if (receiptQrEnabled) {
    generation?.report('securing-document', {
      reference: ref,
      verificationStatus: 'pending',
    });
    await drawVerificationBlock(doc, {
      x: leftMargin,
      y: qrAndSignatureY,
      width: 80,
      ref,
      type: paiementDocumentType,
      agency: settings.nom_agence ?? 'Samay Këur',
      amount: paye,
      date: paiement.date_paiement ?? new Date().toISOString(),
      paymentStatus: statusLabel,
      settings,
      previewMode,
    });
  }

  if (settings.signature_enabled || settings.stamp_enabled) {
    await drawSingleSignatureBox(
      doc,
      leftMargin + usableWidth - 76,
      qrAndSignatureY,
      76,
      34,
      settings
    );
  }

  addFooter(doc, settings);

  return { doc, qrEnabled: receiptQrEnabled };
}

export async function generatePaiementFacturePDF(
  paiement: PaiementPDFData,
  generation?: DocumentGenerationLifecycle,
): Promise<void> {
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

  const loadedSettings = await loadAgencySettings();

  const loyer = Number(paiement.montant_attendu ?? contrat.loyer_mensuel ?? 0);
  const paye = Number(paiement.montant_total ?? 0);
  const paiementsPrecedents = Number(paiement.paiements_precedents ?? Math.max(Number(paiement.montant_encaisse_cumul ?? 0) - paye, 0) ?? 0);
  const totalPayeMois = Number(paiement.total_paye_mois ?? paiement.montant_encaisse_cumul ?? (paiementsPrecedents + paye));
  const reliquat = paiement.reliquat != null
    ? Number(paiement.reliquat)
    : Math.max(loyer - totalPayeMois, 0);
  const statusLabel = reliquat > 0 ? 'Paiement partiel' : 'Soldé';
  const paiementDocumentType: PdfDocumentType = reliquat > 0 ? 'facture' : 'quittance';
  const templateType = reliquat > 0 ? 'facture' : 'quittance';
  const receiptTemplate = await resolvePublishedDocumentTemplate(templateType, loadedSettings.agency_id);
  const settings = applyPublishedTemplateStyle(loadedSettings, receiptTemplate);
  const referenceFallback = applyDocumentPrefix(
    paiement.reference ?? generateQuittanceRef(paiement),
    paiementDocumentType,
    settings,
  );
  const ref = await allocateDocumentReference({
    documentType: templateType,
    entityId: paiement.id ?? referenceFallback,
    periodKey: paiement.mois_concerne?.slice(0, 7),
    format: settings.document_preferences?.numbering_format,
    prefix: getPdfDocumentPreferences(settings).prefixes[paiementDocumentType],
    fallback: referenceFallback,
  });
  generation?.report('building-document', { reference: ref });

  const { doc, qrEnabled: receiptQrEnabled } = await buildPaiementReceiptDocument(
    paiement,
    receiptTemplate,
    ref,
    settings,
    { loyer, paye, paiementsPrecedents, totalPayeMois, reliquat, statusLabel, paiementDocumentType },
    { generation },
  );

  const devise = settings.devise ?? 'XOF';
  const moisConcerne = paiement.mois_concerne
    ? new Date(paiement.mois_concerne).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      })
    : '—';
  const tenantName = joinClean([locataire.prenom, locataire.nom]) || 'Locataire non renseigné';

  await saveGeneratedPdf(doc, {
    kind: paiementDocumentType === 'quittance' ? 'quittance' : 'facture',
    title:
      paiementDocumentType === 'quittance'
        ? 'Quittance de loyer'
        : 'Facture de loyer',
    fileName: `${ref}.pdf`,
    source: 'paiements',
    documentType: paiementDocumentType,
    entityId: paiement.id ?? ref,
    period: paiement.mois_concerne?.slice(0, 7) ?? null,
    reference: ref,
    data: {
      document: paiementDocumentType,
      reference: ref,
      paiement,
      loyer,
      paye,
      paiementsPrecedents,
      totalPayeMois,
      reliquat,
      agency: settings,
      template: {
        revisionId: receiptTemplate.revisionId,
        revision: receiptTemplate.revision,
        checksum: receiptTemplate.checksum,
        source: receiptTemplate.source,
        rendererVersion: receiptTemplate.rendererVersion,
      },
    },
    template: receiptTemplate,
    generation,
    verificationExpected: receiptQrEnabled,
    metadata: {
      documentType: paiementDocumentType,
      reference: ref,
      agencyName: settings.nom_agence ?? undefined,
      partyName: tenantName,
      period: moisConcerne,
      createdAt: paiement.date_paiement ?? new Date(),
    },
    assetUrls: {
      logo: settings.logo_url,
      signature: settings.signature_enabled ? settings.signature_url : null,
      stamp: settings.stamp_enabled ? settings.stamp_url : null,
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

/**
 * Dessine le contenu complet d'un mandat de gérance sur un jsPDF déjà créé.
 * Même contrat que buildContratDocument/buildPaiementReceiptDocument : aucune
 * allocation de référence, aucune écriture registre — seulement le dessin.
 */
async function buildMandatDocument(
  bailleur: MandatPDFData,
  mandateTemplate: ResolvedDocumentTemplate,
  mandatRef: string,
  settings: Partial<AgencySettings>,
  options?: { previewMode?: boolean; generation?: DocumentGenerationLifecycle },
): Promise<{ doc: jsPDF; qrEnabled: boolean }> {
  const previewMode = options?.previewMode ?? false;
  const generation = options?.generation;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  try {
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
        documentType: 'Mandat de gérance',
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
    const endY = renderStructuredTemplateToDoc(
      doc,
      mandateTemplate,
      vars,
      bodyY,
      leftMargin,
      usableWidth,
      settings
    );

    await drawEditorialSignatureSection(doc, {
      y: endY,
      title: 'Signatures',
      subtitle: 'Mandat de gérance',
      reference: mandatRef,
      intro: 'Les parties confirment la délégation de gestion décrite dans le présent mandat.',
      labels: ['Le mandataire', 'Le mandant'],
      leftMargin,
      usableWidth,
      settings,
    });
  } catch (error) {
    console.error('Erreur génération mandat:', error);
    throw error;
  }

  addFooter(doc, settings);
  const mandateQrEnabled =
    mandateTemplate.content.style.showQr &&
    isDocumentQrEnabled(settings, 'mandat');
  if (mandateQrEnabled) {
    generation?.report('securing-document', {
      reference: mandatRef,
      verificationStatus: 'pending',
    });
    await drawLegalVerificationFooter(doc, {
      ref: mandatRef,
      type: 'mandat',
      agency: settings.nom_agence ?? 'Samay Këur',
      date: new Date().toISOString(),
      settings,
      previewMode,
    });
  }

  return { doc, qrEnabled: mandateQrEnabled };
}

export async function generateMandatBailleurPDF(
  bailleur: MandatPDFData,
  generation?: DocumentGenerationLifecycle,
): Promise<void> {
  if (!bailleur) throw new Error('Aucun bailleur fourni');

  const loadedSettings = await loadAgencySettings();
  if (isIndividualOwnerSettings(loadedSettings)) {
    throw new Error("Le mandat de gérance est réservé aux agences et gestionnaires qui administrent des biens pour des tiers.");
  }
  const mandateTemplate = await resolvePublishedDocumentTemplate('mandat', loadedSettings.agency_id);
  const settings = applyPublishedTemplateStyle(loadedSettings, mandateTemplate);
  const mandateRefFallback = applyDocumentPrefix(
    `MDT-${new Date().getFullYear()}-${(bailleur.id ?? Date.now().toString()).toString().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    'mandat',
    settings,
  );
  const mandatRef = await allocateDocumentReference({
    documentType: 'mandat',
    entityId: bailleur.id ?? mandateRefFallback,
    periodKey: bailleur.debut_contrat?.slice(0, 7),
    format: settings.document_preferences?.numbering_format,
    prefix: getPdfDocumentPreferences(settings).prefixes.mandat,
    fallback: mandateRefFallback,
  });
  generation?.report('building-document', { reference: mandatRef });

  const { doc, qrEnabled: mandateQrEnabled } = await buildMandatDocument(
    bailleur,
    mandateTemplate,
    mandatRef,
    settings,
    { generation },
  );

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
      template: {
        revisionId: mandateTemplate.revisionId,
        revision: mandateTemplate.revision,
        checksum: mandateTemplate.checksum,
        source: mandateTemplate.source,
        rendererVersion: mandateTemplate.rendererVersion,
      },
    },
    template: mandateTemplate,
    generation,
    verificationExpected: mandateQrEnabled,
    metadata: {
      documentType: 'mandat',
      reference: mandatRef,
      agencyName: settings.nom_agence ?? undefined,
      partyName: `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim(),
      createdAt: new Date(),
    },
    assetUrls: {
      logo: settings.logo_url,
      signature: settings.signature_enabled ? settings.signature_url : null,
      stamp: settings.stamp_enabled ? settings.stamp_url : null,
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

function formatPdfAmount(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(Math.round(safeAmount))
    .replace(/[\u202f\u00a0]/g, ' ');
}

/**
 * Rapport financier (bailleur agence ou propriétaire individuel) : indicateurs,
 * détail par bien, répartition financière, dépenses, synthèse de reversement.
 * Source de vérité unique, remplaçant les 3 implémentations indépendantes
 * historiques (Bailleurs.tsx, OwnerWorkspace.tsx, Commissions.tsx) — cette
 * dernière ayant un format de données distinct (paiements de commission, pas
 * un rapport bailleur) n'est pas couverte ici.
 */
export async function buildRapportDocument(
  reportKind: 'rapport_bailleur' | 'rapport_proprietaire',
  reportData: OwnerReportSnapshotPayload,
  partyName: string,
  periodLabel: string,
  reportTemplate: ResolvedDocumentTemplate,
  reportRef: string,
  settings: Partial<AgencySettings>,
  options?: { previewMode?: boolean; generation?: DocumentGenerationLifecycle },
): Promise<{ doc: jsPDF; qrEnabled: boolean }> {
  const previewMode = options?.previewMode ?? false;
  const generation = options?.generation;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isOwnerReport = reportKind === 'rapport_proprietaire';
  const reportTitle = isOwnerReport ? 'Résumé mensuel propriétaire' : 'Rapport mensuel bailleur';
  const netLabel = isOwnerReport ? 'Revenus nets' : 'Net à reverser';
  const tableTheme = getAutoTableTheme(settings);

  const enabledReportSections = new Set(
    reportTemplate.content.blocks
      .filter((block) => block.enabled && block.systemKey)
      .map((block) => block.systemKey),
  );

  let reportQrEnabled = false;

  try {
    const totalLoyers = Number(reportData.totals.collected);
    const totalReliquats = Number(reportData.totals.arrears);
    const totalCommissions = Number(reportData.totals.commissions);
    const totalDepenses = Number(reportData.totals.expenses);
    const totalNet = Number(reportData.totals.netToPay);
    const recoveryRate = Number(reportData.totals.recoveryRate);

    drawPageBorder(doc, settings);
    let y = await drawDocumentHeader(doc, settings, reportTitle, partyName, {
      reference: reportRef,
      issueDate: new Date().toLocaleDateString('fr-FR'),
      documentType: 'Rapport financier',
    }) + 8;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 26) {
        addFooter(doc, settings);
        doc.addPage();
        drawPageBorder(doc, settings);
        y = 24;
      }
    };

    const sectionTitle = (title: string, subtitle?: string) => {
      ensureSpace(subtitle ? 18 : 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, y);
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, 14, y + 5);
        y += 10;
      } else {
        y += 5.5;
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.12);
      doc.line(14, y, pageWidth - 14, y);
      y += 5.5;
    };

    sectionTitle('Indicateurs du mois', `Période analysée : ${periodLabel}`);
    const indicatorItems: Array<[string, string]> = [
      ...(enabledReportSections.has('collections') ? [['Loyers encaissés', formatCurrency(totalLoyers)] as [string, string]] : []),
      ...(enabledReportSections.has('arrears') ? [['Reliquats à suivre', formatCurrency(totalReliquats)] as [string, string]] : []),
      ...(enabledReportSections.has('commissions') && !isOwnerReport
        ? [['Commissions agence', formatCurrency(totalCommissions)] as [string, string]]
        : []),
      [netLabel, formatCurrency(totalNet)],
      ['Taux de recouvrement', `${recoveryRate}%`],
      ...(enabledReportSections.has('occupancy')
        ? [[
            'Biens concernés',
            String(new Set(reportData.contracts.map((contract) => contract.immeuble_id)).size),
          ] as [string, string]]
        : []),
    ];
    const indicatorBody: string[][] = [];
    for (let index = 0; index < indicatorItems.length; index += 2) {
      const left = indicatorItems[index];
      const right = indicatorItems[index + 1] ?? ['', ''];
      indicatorBody.push([left[0], left[1], right[0], right[1]]);
    }
    autoTable(doc, {
      body: indicatorBody,
      startY: y,
      theme: 'grid',
      ...tableTheme,
      styles: {
        ...tableTheme.styles,
        fontSize: 8.5,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 42 },
        1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 40 },
        2: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 44 },
        3: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 11;

    sectionTitle('Synthèse propriétaire');
    const summaryText = [
      `Sur la période ${periodLabel}, ${partyName} présente ${formatCurrency(totalLoyers)} de loyers encaissés.`,
      enabledReportSections.has('arrears') && totalReliquats > 0
        ? `Les reliquats ouverts représentent ${formatCurrency(totalReliquats)} et doivent rester prioritaires dans le suivi de gestion.`
        : enabledReportSections.has('arrears')
          ? "Aucun reliquat significatif n'est rattaché aux paiements enregistrés sur cette période."
          : '',
      `Le montant ${netLabel.toLowerCase()} ressort à ${formatCurrency(totalNet)}.`,
    ].join(' ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const summaryLines = doc.splitTextToSize(summaryText, 178);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 4.7 + 9;

    const rows = reportData.contracts.map((contract) => ({
      immeuble: contract.immeuble || 'Bien non renseigné',
      unite: contract.unite || 'Unité non renseignée',
      locataire: contract.locataire || 'Locataire non renseigné',
      loyer: formatPdfAmount(Number(contract.loyer_mensuel)),
      statut: Number(contract.reliquat) > 0 ? 'Partiel' : 'Soldé',
      encaisse: formatPdfAmount(Number(contract.encaisse)),
      reliquat: formatPdfAmount(Number(contract.reliquat)),
      net: formatPdfAmount(Number(contract.part_bailleur)),
    }));

    if (enabledReportSections.has('collections') || enabledReportSections.has('occupancy')) {
      sectionTitle('Détail par bien', 'Lecture par immeuble, unité, locataire et situation financière.');
      autoTable(doc, {
        head: [['Bien', 'Unité', 'Locataire', 'Loyer (F CFA)', 'Statut', 'Encaissé (F CFA)', 'Reliquat (F CFA)', 'Net (F CFA)']],
        body: rows.length
          ? rows.map((row) => [row.immeuble, row.unite, row.locataire, row.loyer, row.statut, row.encaisse, row.reliquat, row.net])
          : [['-', '-', 'Aucun paiement enregistré sur la période', '-', '-', '-', '-', '-']],
        startY: y,
        theme: 'grid',
        ...tableTheme,
        styles: {
          ...tableTheme.styles,
          fontSize: 7.4,
          cellPadding: { top: 2.4, right: 2.1, bottom: 2.4, left: 2.1 },
          overflow: 'linebreak',
        },
        headStyles: {
          ...tableTheme.headStyles,
          fontSize: 7.2,
        },
        margin: { left: 14, right: 14 },
        columnStyles: {
          3: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 22 },
          6: { halign: 'right', cellWidth: 22 },
          7: { halign: 'right', cellWidth: 24 },
        },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 10;
    }

    if (enabledReportSections.has('collections') || enabledReportSections.has('expenses') || enabledReportSections.has('commissions')) {
      sectionTitle('Répartition financière');
      const chartY = y;
      const chartData: Array<{ label: string; value: number; color: [number, number, number] }> = [
        { label: 'Revenus bruts', value: totalLoyers, color: [16, 185, 129] },
        { label: 'Déductions', value: totalCommissions + totalDepenses, color: [244, 63, 94] },
        { label: netLabel, value: totalNet, color: [15, 23, 42] },
      ];
      const maxVal = Math.max(...chartData.map((d) => d.value));
      const chartWidth = 110;
      const barHeight = 5.5;
      const spacing = 4.5;

      chartData.forEach((item, idx) => {
        const itemY = chartY + idx * (barHeight + spacing);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(item.label, 14, itemY + 4);

        const barWidth = maxVal > 0 ? (item.value / maxVal) * chartWidth : 0;

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(42, itemY, chartWidth, barHeight, 1, 1, 'F');

        if (barWidth > 0) {
          doc.setFillColor(...item.color);
          doc.roundedRect(42, itemY, barWidth, barHeight, 1, 1, 'F');
        }

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(formatCurrency(item.value), 42 + chartWidth + 6, itemY + 4);
      });

      y = chartY + chartData.length * (barHeight + spacing) + 12;
    }

    if (enabledReportSections.has('expenses') && reportData.expenses.length > 0) {
      ensureSpace(34);
      sectionTitle('Dépenses rattachées');
      autoTable(doc, {
        head: [['Date', 'Catégorie', 'Description', 'Montant']],
        body: reportData.expenses.slice(0, 12).map((depense) => [
          formatDate(depense.date_depense),
          depense.categorie ?? 'Dépense',
          depense.description ?? 'Sans description',
          formatCurrency(depense.montant),
        ]),
        startY: y,
        theme: 'grid',
        ...tableTheme,
        margin: { left: 14, right: 14 },
        columnStyles: { 3: { halign: 'right' } },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 10;
    }

    ensureSpace(42);
    y = drawTotalsBlock(
      doc,
      14,
      y,
      pageWidth - 28,
      [
        ...(enabledReportSections.has('collections') ? [{ label: 'Loyers encaissés', value: formatCurrency(totalLoyers) }] : []),
        ...(enabledReportSections.has('arrears') ? [{ label: 'Reliquats à suivre', value: formatCurrency(totalReliquats) }] : []),
        ...(isOwnerReport && enabledReportSections.has('expenses')
          ? [{ label: 'Dépenses', value: formatCurrency(totalDepenses) }]
          : !isOwnerReport && enabledReportSections.has('commissions')
            ? [{ label: 'Commissions agence', value: formatCurrency(totalCommissions) }]
            : []),
        { label: netLabel, value: formatCurrency(totalNet), emphasis: true },
      ],
      settings,
    );

    ensureSpace(34);
    const closingY = drawSectionFrame(doc, 14, y, pageWidth - 28, 30, settings, {
      title: 'Reversement et authentification',
      subtitle: `${netLabel} : ${formatCurrency(totalNet)}`,
      accent: 'neutral',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(71, 85, 105);
    const closingLines = doc.splitTextToSize(
      `Aucune note particulière pour cette période. Le rapport consolide les encaissements, reliquats, ${isOwnerReport ? 'dépenses' : 'commissions'} et montants nets issus du registre financier Samay Këur.`,
      pageWidth - 42,
    );
    doc.text(closingLines, 19, closingY);
    y += 38;

    reportQrEnabled = reportTemplate.content.style.showQr && enabledReportSections.has('qr_verification');
    if (reportQrEnabled) {
      generation?.report('securing-document', {
        reference: reportRef,
        verificationStatus: 'pending',
      });
      await drawLegalVerificationFooter(doc, {
        ref: reportRef,
        type: 'rapport_bailleur',
        agency: settings.nom_agence ?? 'Samay Këur',
        date: new Date().toISOString(),
        settings,
        previewMode,
      });
    }
    addFooter(doc, settings);
  } catch (error) {
    console.error('Erreur génération rapport:', error);
    throw error;
  }

  return { doc, qrEnabled: reportQrEnabled };
}

// ---------------------------------------------------------------------------
// Aperçu en direct (Studio, Paramètres) — mêmes fonctions de dessin que la
// génération réelle, sans allocation de référence ni écriture registre.
// ---------------------------------------------------------------------------

/**
 * Enveloppe un contenu de modèle en cours d'édition (brouillon Studio, jamais
 * publié) dans la forme ResolvedDocumentTemplate attendue par les fonctions de
 * dessin. resolvePublishedDocumentTemplate ne peut pas servir ici : elle ne lit
 * jamais draft_content, seulement la dernière révision publiée.
 */
function wrapDraftAsResolvedTemplate(content: DocumentTemplateContent): ResolvedDocumentTemplate {
  return {
    content,
    source: 'agency',
    revisionId: null,
    revision: null,
    checksum: 'preview',
    catalogVersion: 'preview',
    rendererVersion: 'preview',
  };
}

/** Aperçu fidèle d'un contrat de location, à partir du brouillon Studio en cours d'édition. */
export async function buildContratPreviewDocument(
  content: DocumentTemplateContent,
  settings: Partial<AgencySettings>,
): Promise<jsPDF> {
  const { doc } = await buildContratDocument(
    getContratPreviewSample(),
    wrapDraftAsResolvedTemplate(content),
    PREVIEW_REFERENCE_PLACEHOLDER,
    settings,
    { previewMode: true },
  );
  return doc;
}

/**
 * Aperçu fidèle d'une quittance/reçu de paiement. `reliquat` permet de
 * prévisualiser la variante "paiement partiel" sans attendre un vrai paiement.
 */
export async function buildPaiementReceiptPreviewDocument(
  content: DocumentTemplateContent,
  settings: Partial<AgencySettings>,
  reliquat = 0,
): Promise<jsPDF> {
  const sample = getPaiementPreviewSample(reliquat);
  const statusLabel = reliquat > 0 ? 'Paiement partiel' : 'Soldé';
  const { doc } = await buildPaiementReceiptDocument(
    sample,
    wrapDraftAsResolvedTemplate(content),
    PREVIEW_REFERENCE_PLACEHOLDER,
    settings,
    {
      loyer: sample.montant_attendu ?? 0,
      paye: sample.montant_total,
      paiementsPrecedents: sample.paiements_precedents ?? 0,
      totalPayeMois: sample.total_paye_mois ?? sample.montant_total,
      reliquat,
      statusLabel,
      paiementDocumentType: reliquat > 0 ? 'facture' : 'quittance',
    },
    { previewMode: true },
  );
  return doc;
}

/** Aperçu fidèle d'un mandat de gérance, à partir du brouillon Studio en cours d'édition. */
export async function buildMandatPreviewDocument(
  content: DocumentTemplateContent,
  settings: Partial<AgencySettings>,
): Promise<jsPDF> {
  const { doc } = await buildMandatDocument(
    getMandatPreviewSample(),
    wrapDraftAsResolvedTemplate(content),
    PREVIEW_REFERENCE_PLACEHOLDER,
    settings,
    { previewMode: true },
  );
  return doc;
}

/** Aperçu fidèle d'un rapport financier (bailleur agence ou propriétaire individuel). */
export async function buildRapportPreviewDocument(
  reportKind: 'rapport_bailleur' | 'rapport_proprietaire',
  content: DocumentTemplateContent,
  settings: Partial<AgencySettings>,
): Promise<jsPDF> {
  const { doc } = await buildRapportDocument(
    reportKind,
    getRapportPreviewSample(),
    'Moussa Ndiaye',
    'Juillet 2026',
    wrapDraftAsResolvedTemplate(content),
    PREVIEW_REFERENCE_PLACEHOLDER,
    settings,
    { previewMode: true },
  );
  return doc;
}
