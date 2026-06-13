import { supabase } from '../lib/supabase';

export type UserDocumentCategory =
  | 'bailleurs'
  | 'locataires'
  | 'immeubles'
  | 'unites'
  | 'contrats'
  | 'juridique'
  | 'administratif'
  | 'assurances'
  | 'personnel'
  | 'exports'
  | 'archives'
  | 'autre';

export type UserDocumentEntityType =
  | 'agency'
  | 'bailleur'
  | 'locataire'
  | 'immeuble'
  | 'unite'
  | 'contrat'
  | 'operation';

export type RetentionPolicy = 'critical' | 'standard' | 'temporary';

export interface StorageUsage {
  used_bytes: number;
  limit_bytes: number;
  available_bytes: number;
  usage_percent: number;
  generated_bytes: number;
  uploaded_bytes: number;
  critical_bytes: number;
  temporary_bytes: number;
  archived_bytes: number;
}

export interface StorageBreakdownBucket {
  bytes: number;
  count: number;
}

export interface StorageLargeFile {
  source: 'uploaded' | 'generated';
  category: UserDocumentCategory;
  retention_policy: RetentionPolicy;
  lifecycle_status: string;
  file_size: number;
  title: string;
  storage_path: string;
  created_at: string;
}

export interface StorageBreakdown {
  by_source: Record<string, StorageBreakdownBucket>;
  by_category: Record<string, StorageBreakdownBucket>;
  by_retention: Record<string, StorageBreakdownBucket>;
  by_lifecycle: Record<string, StorageBreakdownBucket>;
  large_files: StorageLargeFile[];
}

export interface DocumentMaintenanceResult {
  uploaded_cleaned?: number;
  generated_cleaned?: number;
  generated_duplicates_archived?: number;
  uploaded_duplicates_archived?: number;
  expired_temporaries_marked?: number;
  uploaded_marked?: number;
  generated_marked?: number;
  orphaned?: {
    uploaded_marked?: number;
    generated_marked?: number;
  };
}

export interface UploadUserDocumentInput {
  agencyId: string;
  userId?: string;
  file: File;
  name?: string;
  category: UserDocumentCategory;
  entityType?: UserDocumentEntityType | null;
  entityId?: string | null;
  description?: string | null;
  tags?: string[];
  retentionPolicy?: RetentionPolicy;
  relations?: {
    bailleur_id?: string | null;
    immeuble_id?: string | null;
    unite_id?: string | null;
    contrat_id?: string | null;
  };
}

const DOCUMENT_BUCKET = 'documents';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

export const DOCUMENT_CATEGORY_LABELS: Record<UserDocumentCategory, string> = {
  bailleurs: 'Bailleurs',
  locataires: 'Locataires',
  immeubles: 'Immeubles',
  unites: 'Unités',
  contrats: 'Contrats',
  juridique: 'Juridique',
  administratif: 'Administratif',
  assurances: 'Assurances',
  personnel: 'Personnel',
  exports: 'Exports',
  archives: 'Archives',
  autre: 'Autre',
};

export const DOCUMENT_ENTITY_LABELS: Record<UserDocumentEntityType, string> = {
  agency: 'Agence',
  bailleur: 'Bailleur',
  locataire: 'Locataire',
  immeuble: 'Immeuble',
  unite: 'Unité',
  contrat: 'Contrat',
  operation: 'Opération',
};

export function formatStorageSize(bytes?: number | null): string {
  const value = Number(bytes ?? 0);
  if (!value) return '0 o';
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} Mo`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} Go`;
}

function sanitizePathSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'document';
}

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0;
  for (const byte of new Uint8Array(buffer)) {
    hash = (hash << 5) - hash + byte;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function getExtension(file: File): string {
  const nameExtension = file.name.split('.').pop()?.toLowerCase();
  if (nameExtension) return nameExtension;
  if (file.type.includes('pdf')) return 'pdf';
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('jpeg')) return 'jpg';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('svg')) return 'svg';
  if (file.type.includes('csv')) return 'csv';
  return 'bin';
}

async function optimizeImageFile(file: File): Promise<File> {
  if (
    typeof document === 'undefined' ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size < 300 * 1024
  ) {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height, 1));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return file;
    }

    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(objectUrl);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type, file.type === 'image/png' ? undefined : 0.82);
    });

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function validateDocumentFile(file: File) {
  if (file.size <= 0) {
    throw new Error('Le fichier est vide.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Le fichier dépasse la limite de 50 Mo.');
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Utilisez PDF, PNG, JPG, WEBP, SVG, CSV ou Excel.');
  }
}

export async function getAgencyStorageUsage(agencyId: string): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc('get_agency_storage_usage', { p_agency_id: agencyId });
  if (error) throw error;
  return {
    used_bytes: Number(data?.used_bytes ?? 0),
    limit_bytes: Number(data?.limit_bytes ?? 0),
    available_bytes: Number(data?.available_bytes ?? 0),
    usage_percent: Number(data?.usage_percent ?? 0),
    generated_bytes: Number(data?.generated_bytes ?? 0),
    uploaded_bytes: Number(data?.uploaded_bytes ?? 0),
    critical_bytes: Number(data?.critical_bytes ?? 0),
    temporary_bytes: Number(data?.temporary_bytes ?? 0),
    archived_bytes: Number(data?.archived_bytes ?? 0),
  };
}

export async function getAgencyStorageBreakdown(agencyId: string): Promise<StorageBreakdown> {
  const { data, error } = await supabase.rpc('get_agency_storage_breakdown', { p_agency_id: agencyId });
  if (error) throw error;
  return {
    by_source: data?.by_source ?? {},
    by_category: data?.by_category ?? {},
    by_retention: data?.by_retention ?? {},
    by_lifecycle: data?.by_lifecycle ?? {},
    large_files: data?.large_files ?? [],
  };
}

export async function cleanupTemporaryDocuments(agencyId: string, olderThanDays = 30): Promise<DocumentMaintenanceResult> {
  const { data, error } = await supabase.rpc('cleanup_temporary_documents', {
    p_agency_id: agencyId,
    p_older_than_days: olderThanDays,
  });
  if (error) throw error;
  return data ?? {};
}

export async function markOrphanDocumentRecords(agencyId: string): Promise<DocumentMaintenanceResult> {
  const { data, error } = await supabase.rpc('mark_orphan_document_records', { p_agency_id: agencyId });
  if (error) throw error;
  return data ?? {};
}

export async function optimizeDocumentStorage(agencyId: string): Promise<DocumentMaintenanceResult> {
  const { data, error } = await supabase.rpc('optimize_document_storage', { p_agency_id: agencyId });
  if (error) throw error;
  return data ?? {};
}

export async function assertCanUploadDocument(agencyId: string, fileSize: number) {
  const { data, error } = await supabase.rpc('can_upload_document', {
    p_agency_id: agencyId,
    p_file_size: fileSize,
  });
  if (error) throw error;

  if (data && data.allowed === false) {
    throw new Error(
      `Quota de stockage dépassé. Utilisé : ${formatStorageSize(data.used_bytes)} / ${formatStorageSize(data.limit_bytes)}.`
    );
  }
}

export function buildUploadedDocumentPath(params: {
  agencyId: string;
  category: UserDocumentCategory;
  file: File;
  fileHash: string;
}) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const extension = getExtension(params.file);
  const baseName = sanitizePathSegment(params.file.name.replace(/\.[^.]+$/, ''));
  const hashPrefix = params.fileHash.slice(0, 12);

  return `agencies/${params.agencyId}/uploads/${params.category}/${year}/${month}/${baseName}-${hashPrefix}.${extension}`;
}

export async function createDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error('URL du document indisponible.');
  return data.signedUrl;
}

export async function uploadUserDocument(input: UploadUserDocumentInput) {
  validateDocumentFile(input.file);
  const optimizedFile = await optimizeImageFile(input.file);
  validateDocumentFile(optimizedFile);
  await assertCanUploadDocument(input.agencyId, optimizedFile.size);

  const fileHash = await sha256File(optimizedFile);
  const storagePath = buildUploadedDocumentPath({
    agencyId: input.agencyId,
    category: input.category,
    file: optimizedFile,
    fileHash,
  });

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, optimizedFile, {
    cacheControl: '31536000',
    contentType: optimizedFile.type || 'application/octet-stream',
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      agency_id: input.agencyId,
      name: input.name?.trim() || input.file.name,
      file_url: storagePath,
      storage_path: storagePath,
      file_type: optimizedFile.type || getExtension(optimizedFile),
      file_size: optimizedFile.size,
      file_hash: fileHash,
      folder: input.category,
      document_category: input.category,
      document_scope: 'user_uploaded',
      lifecycle_status: 'active',
      retention_policy: input.retentionPolicy ?? 'standard',
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      description: input.description?.trim() || null,
      tags: input.tags ?? [],
      uploaded_by: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw error;
  }

  return data;
}
