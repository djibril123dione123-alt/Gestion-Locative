import { supabase } from '../lib/supabase';
import { assertCanUploadDocument, type RetentionPolicy } from './documentStorage';
import type { ResolvedDocumentTemplate } from '../types/documentStudio';

export type ManagedDocumentType =
  | 'contrat'
  | 'mandat'
  | 'quittance'
  | 'facture'
  | 'rapport_bailleur'
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
  status: 'active' | 'archived' | 'orphaned' | 'corrupt' | 'deleted';
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

async function getLatestEntry(params: {
  agencyId: string;
  documentType: ManagedDocumentType;
  entityId: string;
  period: string | null;
}) {
  let query = supabase
    .from('document_registry')
    .select('*')
    .eq('agency_id', params.agencyId)
    .eq('document_type', params.documentType)
    .eq('entity_id', params.entityId)
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1);

  query = params.period ? query.eq('period', params.period) : query.is('period', null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as DocumentRegistryEntry | null;
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
  const latest = await getLatestEntry({
    agencyId: context.agencyId,
    documentType: input.documentType,
    entityId: input.entityId,
    period,
  });

  if (latest?.data_hash === dataHash) {
    try {
      const url = await createSignedDocumentUrl(latest.storage_path);
      await supabase
        .from('document_registry')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', latest.id);
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
      await supabase
        .from('document_registry')
        .update({
          status: 'corrupt',
          metadata: {
            ...(latest.metadata ?? {}),
            corrupt_reason: 'storage_signed_url_failed',
            corrupt_at: new Date().toISOString(),
          },
        })
        .eq('id', latest.id);
    }
  }

  const version = latest ? latest.version + 1 : 1;
  await assertCanUploadDocument(context.agencyId, input.blob.size);

  const storagePath = buildStoragePath({
    agencyId: context.agencyId,
    documentType: input.documentType,
    period,
    reference: input.reference,
    version,
    fileName: input.fileName,
  });
  const fileHash = await sha256Blob(input.blob);

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: input.mimeType ?? input.blob.type ?? 'application/pdf',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: entry, error: insertError } = await supabase
    .from('document_registry')
    .insert({
      agency_id: context.agencyId,
      document_type: input.documentType,
      entity_id: input.entityId,
      period,
      reference: input.reference,
      version,
      storage_path: storagePath,
      file_hash: fileHash,
      data_hash: dataHash,
      generated_by: context.userId,
      status: 'active',
      retention_policy: input.retentionPolicy ?? 'critical',
      file_size: input.blob.size,
      mime_type: input.mimeType ?? input.blob.type ?? 'application/pdf',
      metadata: {
        file_name: input.fileName,
        template_catalog_version: input.template?.catalogVersion,
        template_source: input.template?.source,
        ...(input.metadata ?? {}),
      },
      template_revision_id: input.template?.revisionId ?? null,
      template_checksum: input.template?.checksum ?? null,
      renderer_version: input.template?.rendererVersion ?? null,
      asset_checksums: assetChecksums,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  const url = await createSignedDocumentUrl(storagePath);

  return {
    url,
    storagePath,
    fileSize: input.blob.size,
    fileHash,
    dataHash,
    version,
    reused: false,
    entry: entry as DocumentRegistryEntry,
  };
}
