import { supabase } from '../lib/supabase';
import { assertCanUploadDocument, type RetentionPolicy } from './documentStorage';
import type { ResolvedDocumentTemplate } from '../types/documentStudio';

export type ManagedDocumentType =
  | 'contrat'
  | 'mandat'
  | 'quittance'
  | 'facture'
  | 'rapport_bailleur'
  | 'due_notice'
  | 'rent_invoice'
  | 'partial_payment_receipt'
  | 'rent_receipt'
  | 'credit_note'
  | 'export'
  | 'pdf'
  | 'document';

export interface DocumentRegistryEntry {
  id: string;
  agency_id: string;
  document_type: ManagedDocumentType;
  entity_id: string;
  period: string | null;
  reference: string;
  version: number;
  storage_path: string;
  file_hash: string;
  data_hash: string;
  generated_at: string;
  generated_by: string | null;
  status: 'pending' | 'active' | 'archived' | 'orphaned' | 'corrupt' | 'deleted';
  retention_policy?: RetentionPolicy;
  file_size: number;
  mime_type: string;
  metadata?: Record<string, unknown>;
  template_revision_id?: string | null;
  template_checksum?: string | null;
  renderer_version?: string | null;
  asset_checksums?: Record<string, string>;
}

export interface ManagedDocumentSaveInput {
  blob: Blob;
  documentType: ManagedDocumentType;
  entityId: string;
  period?: string | null;
  reference: string;
  fileName: string;
  data: unknown;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  retentionPolicy?: RetentionPolicy;
  template?: Pick<
    ResolvedDocumentTemplate,
    'revisionId' | 'checksum' | 'rendererVersion' | 'catalogVersion' | 'source'
  >;
  assetUrls?: Record<string, string | null | undefined>;
}

export interface ManagedDocumentSaveResult {
  url: string;
  storagePath: string;
  fileSize: number;
  fileHash?: string;
  dataHash: string;
  version: number;
  reused: boolean;
  entry?: DocumentRegistryEntry;
}

const DOCUMENT_BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const STORAGE_FOLDERS: Record<ManagedDocumentType, string> = {
  contrat: 'contrats',
  mandat: 'mandats',
  quittance: 'quittances',
  facture: 'factures',
  rapport_bailleur: 'rapports-bailleurs',
  due_notice: 'avis-echeance',
  rent_invoice: 'factures-loyer',
  partial_payment_receipt: 'recus-partiels',
  rent_receipt: 'quittances-loyer',
  credit_note: 'avoirs-locatifs',
  export: 'exports',
  pdf: 'exports',
  document: 'exports',
};

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === 'object') {
      if (seen.has(current)) return '[Circular]';
      seen.add(current);

      if (Array.isArray(current)) return current;

      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (current as Record<string, unknown>)[key];
          return acc;
        }, {});
    }

    return current;
  });
}

async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0;
  const view = new Uint8Array(bytes);
  for (const byte of view) {
    hash = (hash << 5) - hash + byte;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

async function sha256String(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value).buffer);
}

async function sha256Blob(blob: Blob): Promise<string> {
  return sha256Bytes(await blob.arrayBuffer());
}

async function checksumDocumentAssets(assetUrls?: ManagedDocumentSaveInput['assetUrls']) {
  const checksums: Record<string, string> = {};
  for (const [key, url] of Object.entries(assetUrls ?? {})) {
    if (!url) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`ASSET_HTTP_${response.status}`);
      checksums[key] = await sha256Blob(await response.blob());
    } catch {
      // The URL fingerprint still makes a visual identity change produce a new version.
      checksums[key] = await sha256String(url);
    }
  }
  return checksums;
}

function sanitizePathSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'document';
}

function resolvePeriodParts(period?: string | null) {
  const raw = period && /^\d{4}-\d{2}/.test(period) ? period : new Date().toISOString().slice(0, 7);
  return {
    period: raw.slice(0, 7),
    year: raw.slice(0, 4),
    month: raw.slice(5, 7),
  };
}

function buildStoragePath(params: {
  agencyId: string;
  documentType: ManagedDocumentType;
  period?: string | null;
  reference: string;
  version: number;
  fileName: string;
}) {
  const { year, month } = resolvePeriodParts(params.period);
  const folder = STORAGE_FOLDERS[params.documentType] ?? 'exports';
  const extension = params.fileName.split('.').pop()?.toLowerCase() || 'pdf';
  const reference = sanitizePathSegment(params.reference);
  const suffix = params.version > 1 ? `-v${params.version}` : '';

  return `agencies/${params.agencyId}/${folder}/${year}/${month}/${reference}${suffix}.${extension}`;
}

async function getRegistryContext() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('agency_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile?.agency_id) return null;

  return {
    userId: user.id,
    agencyId: profile.agency_id as string,
  };
}

async function createSignedDocumentUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to create signed document URL');
  }

  return data.signedUrl;
}

export async function touchManagedDocument(
  registryId: string,
  options: { markCorrupt?: boolean; reason?: string | null } = {},
) {
  const { error } = await supabase.rpc('fn_touch_managed_document', {
    p_registry_id: registryId,
    p_mark_corrupt: options.markCorrupt ?? false,
    p_reason: options.reason ?? null,
  });
  if (error) throw error;
}

export async function saveManagedDocument(
  input: ManagedDocumentSaveInput
): Promise<ManagedDocumentSaveResult | null> {
  const context = await getRegistryContext();
  if (!context) return null;

  const { period } = resolvePeriodParts(input.period);
  const assetChecksums = await checksumDocumentAssets(input.assetUrls);
  const dataHash = await sha256String(stableStringify({
    data: input.data,
    templateChecksum: input.template?.checksum ?? null,
    assetChecksums,
  }));
  await assertCanUploadDocument(context.agencyId, input.blob.size);
  const metadata = {
    file_name: input.fileName,
    template_catalog_version: input.template?.catalogVersion,
    template_source: input.template?.source,
    ...(input.metadata ?? {}),
  };
  const mimeType = input.mimeType ?? input.blob.type ?? 'application/pdf';
  const { data: reservationData, error: reservationError } = await supabase.rpc(
    'fn_prepare_managed_document',
    {
      p_document_type: input.documentType,
      p_entity_id: input.entityId,
      p_period: period,
      p_reference: input.reference,
      p_data_hash: dataHash,
      p_file_size: input.blob.size,
      p_mime_type: mimeType,
      p_retention_policy: input.retentionPolicy ?? 'critical',
      p_metadata: metadata,
      p_template_revision_id: input.template?.revisionId ?? null,
      p_template_checksum: input.template?.checksum ?? null,
      p_renderer_version: input.template?.rendererVersion ?? null,
      p_asset_checksums: assetChecksums,
    },
  );
  if (reservationError) throw reservationError;

  const reservation = reservationData as unknown as {
    reused: boolean;
    entry: DocumentRegistryEntry;
  };
  if (!reservation?.entry?.id) throw new Error('Réservation documentaire invalide.');

  if (reservation.reused) {
    const latest = reservation.entry;
    try {
      const url = await createSignedDocumentUrl(latest.storage_path);
      await touchManagedDocument(latest.id);
      return {
        url,
        storagePath: latest.storage_path,
        fileSize: latest.file_size,
        fileHash: latest.file_hash,
        dataHash,
        version: latest.version,
        reused: true,
        entry: latest,
      };
    } catch {
      await touchManagedDocument(latest.id, {
        markCorrupt: true,
        reason: 'storage_signed_url_failed',
      });
      return saveManagedDocument(input);
    }
  }

  const version = reservation.entry.version;

  const storagePath = buildStoragePath({
    agencyId: context.agencyId,
    documentType: input.documentType,
    period,
    reference: input.reference,
    version,
    fileName: input.fileName,
  });
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: input.mimeType ?? input.blob.type ?? 'application/pdf',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    await supabase.rpc('fn_abort_managed_document', { p_registry_id: reservation.entry.id });
    throw uploadError;
  }

  const { data: finalizeResponse, error: finalizeError } = await supabase.functions.invoke(
    'finalize-managed-document',
    {
      body: {
        registryId: reservation.entry.id,
        storagePath,
      },
    },
  );

  const finalizedEntry = finalizeResponse?.data as DocumentRegistryEntry | undefined;
  if (finalizeError || !finalizedEntry) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    await supabase.rpc('fn_abort_managed_document', { p_registry_id: reservation.entry.id });
    throw finalizeError ?? new Error('Le document n’a pas pu être finalisé.');
  }

  const url = await createSignedDocumentUrl(storagePath);

  return {
    url,
    storagePath,
    fileSize: input.blob.size,
    fileHash: finalizedEntry.file_hash,
    dataHash,
    version,
    reused: false,
    entry: finalizedEntry,
  };
}
