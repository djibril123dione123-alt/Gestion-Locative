import {
  DOCUMENT_CATEGORY_LABELS,
  type RetentionPolicy,
  type StorageBreakdown,
  type UserDocumentCategory,
  type UserDocumentEntityType,
} from '../../services/documentStorage';
import { getDocumentProofState } from '../../components/documents/documentProofState';
import type { DocumentProofDrawerData } from '../../components/documents/DocumentProofDrawer';

export interface UserDocumentRow {
  id: string;
  name: string;
  file_url: string;
  storage_path: string | null;
  file_type: string | null;
  file_size: number | null;
  document_category: UserDocumentCategory | null;
  document_scope: 'user_uploaded' | 'generated' | 'imported' | null;
  entity_type: UserDocumentEntityType | null;
  entity_id: string | null;
  lifecycle_status: 'active' | 'archived' | 'deleted' | 'temporary' | 'orphaned' | null;
  retention_policy: RetentionPolicy | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface RegistryDocumentRow {
  id: string;
  document_type: string;
  entity_id: string;
  period: string | null;
  reference: string;
  version: number;
  storage_path: string;
  file_size: number;
  mime_type: string;
  status: string;
  retention_policy: RetentionPolicy | null;
  generated_at: string;
  generated_by: string | null;
  metadata?: { file_name?: string;[key: string]: unknown } | null;
}

export interface DocumentVerificationRow {
  document_ref: string;
  token: string;
  document_status: 'authentic' | 'revoked' | 'superseded';
  issued_at: string;
  created_at: string;
  agency_name: string;
  amount_xof: number | null;
  payment_status: string | null;
}

export interface DocumentBusinessContext {
  subject?: string;
  location?: string;
}

export interface DocumentItem extends DocumentProofDrawerData {
  id: string;
  source: 'uploaded' | 'generated';
  title: string;
  subtitle: string;
  storagePath: string;
  mimeType: string | null;
  size: number;
  category: UserDocumentCategory;
  entityType: UserDocumentEntityType | null;
  lifecycleStatus: string;
  retentionPolicy: RetentionPolicy;
  createdAt: string;
  reference?: string;
  documentType?: string;
  fileName: string;
  businessContext?: DocumentBusinessContext;
  period?: string | null;
  isVerifiable?: boolean;
}

export type DocumentTypeFilter = 'all' | 'quittance' | 'contrat' | 'mandat' | 'rapport' | 'facture' | 'justificatif' | 'archives' | 'unclassified' | 'noqr';
export type DocumentSourceFilter = 'all' | 'uploaded' | 'generated' | 'qr';
export type DocumentStatusFilter = 'all' | 'active' | 'archived' | 'unclassified' | 'review';

export const DOCUMENT_TYPE_FILTERS: Array<{ id: DocumentTypeFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'quittance', label: 'Quittances' },
  { id: 'contrat', label: 'Contrats' },
  { id: 'mandat', label: 'Mandats' },
  { id: 'rapport', label: 'Rapports' },
  { id: 'facture', label: 'Factures' },
  { id: 'justificatif', label: 'Justificatifs' },
  { id: 'archives', label: 'Archivés' },
  { id: 'unclassified', label: 'À classer' },
  { id: 'noqr', label: 'Sans QR' },
];

export const DOCUMENT_TYPE_TITLES: Record<string, string> = {
  quittance: 'Quittance',
  facture: 'Facture',
  contrat: 'Contrat de bail',
  mandat: 'Mandat de gestion',
  rapport: 'Rapport',
  rapport_bailleur: 'Rapport bailleur',
  rapport_proprietaire: 'Rapport propriétaire',
  export: 'Export financier',
  pdf: 'Document',
  document: 'Document',
};

export interface EntityOption {
  id: string;
  label: string;
}

export const CATEGORIES: UserDocumentCategory[] = [
  'bailleurs',
  'locataires',
  'immeubles',
  'unites',
  'contrats',
  'juridique',
  'administratif',
  'assurances',
  'personnel',
  'exports',
  'archives',
  'autre',
];

export const ENTITY_LABELS: Record<string, string> = {
  active: 'Actif',
  archived: 'Archivé',
  deleted: 'Supprimé',
  temporary: 'À revoir',
  orphaned: 'À vérifier',
};

export function formatPersonName(person?: { nom?: string | null; prenom?: string | null } | null) {
  return [person?.prenom, person?.nom].filter(Boolean).join(' ').trim();
}

export function singleRelation<T>(value?: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function formatDocumentPeriod(period?: string | null) {
  if (!period) return '';
  const normalized = /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : period;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

export function documentTypeTitle(documentType?: string) {
  if (!documentType) return 'Document';
  return DOCUMENT_TYPE_TITLES[documentType] ?? documentType.replace(/_/g, ' ');
}

export function lifecycleLabel(item: DocumentItem) {
  if (item.lifecycleStatus === 'archived') return 'Archivé';
  if (item.lifecycleStatus === 'temporary') return 'À revoir';
  if (item.lifecycleStatus === 'orphaned' || (item.source === 'uploaded' && !item.businessContext?.subject)) return 'À classer';
  return ENTITY_LABELS[item.lifecycleStatus] ?? item.lifecycleStatus;
}

export function isQrVerifiableDocument(item: DocumentItem) {
  return getDocumentProofState(item).kind === 'verifiable';
}

export function isDocumentUnclassified(item: DocumentItem) {
  return item.lifecycleStatus === 'orphaned' || (item.source === 'uploaded' && !item.businessContext?.subject);
}

export function documentTypeBadge(item: DocumentItem) {
  if (item.documentType === 'quittance') return 'QUITTANCES';
  if (item.documentType === 'facture') return 'FACTURES';
  if (item.documentType === 'contrat') return 'CONTRATS';
  if (item.documentType === 'mandat') return 'MANDATS';
  if (item.documentType === 'rapport' || item.documentType === 'rapport_bailleur' || item.documentType === 'rapport_proprietaire') return 'RAPPORTS';
  if (item.source === 'uploaded' && !item.businessContext?.subject) return 'DOCUMENT LIBRE';
  if (item.source === 'uploaded' && ['bailleurs', 'locataires', 'immeubles', 'unites', 'assurances'].includes(item.category)) return 'JUSTIFICATIFS';
  return 'ADMINISTRATIF';
}

export function matchesTypeFilter(item: DocumentItem, filter: DocumentTypeFilter) {
  if (filter === 'all') return true;
  if (filter === 'archives') return item.lifecycleStatus === 'archived';
  if (filter === 'unclassified') return isDocumentUnclassified(item);
  if (filter === 'noqr') return !isQrVerifiableDocument(item) && item.source === 'generated';
  if (filter === 'justificatif') return documentTypeBadge(item) === 'JUSTIFICATIFS';
  if (filter === 'rapport') return ['rapport', 'rapport_bailleur', 'rapport_proprietaire'].includes(item.documentType ?? '');
  return item.documentType === filter;
}

export function normalizeCategory(value?: string | null): UserDocumentCategory {
  if (value && CATEGORIES.includes(value as UserDocumentCategory)) return value as UserDocumentCategory;
  return 'administratif';
}

export function usageTone(percent: number) {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-orange-500';
  return 'bg-emerald-600';
}

export function usageMessage(percent: number) {
  if (percent >= 90) {
    return {
      tone: 'border-red-200 bg-red-50 text-red-800',
      title: 'Espace presque plein',
      text: 'Classez les doublons et les documents temporaires avant de nouveaux ajouts.',
    };
  }
  if (percent >= 75) {
    return {
      tone: 'border-orange-200 bg-orange-50 text-orange-800',
      title: 'Espace à surveiller',
      text: 'Le coffre approche de sa limite. Les preuves protégées restent conservées.',
    };
  }
  return null;
}

export function bucketValue(breakdown: StorageBreakdown | null, key: string) {
  return breakdown?.by_retention?.[key] ?? breakdown?.by_source?.[key] ?? breakdown?.by_lifecycle?.[key] ?? null;
}

export function toDocumentItem(row: UserDocumentRow, uploadedBy?: string): DocumentItem {
  const category = normalizeCategory(row.document_category);
  const storagePath = row.storage_path || row.file_url;
  return {
    id: row.id,
    source: 'uploaded',
    title: row.name,
    subtitle: row.description || DOCUMENT_CATEGORY_LABELS[category],
    storagePath,
    mimeType: row.file_type,
    size: Number(row.file_size ?? 0),
    category,
    entityType: row.entity_type,
    lifecycleStatus: row.lifecycle_status ?? 'active',
    retentionPolicy: row.retention_policy ?? 'standard',
    createdAt: row.created_at,
    fileName: row.name,
    entityId: row.entity_id,
    description: row.description,
    uploadedBy,
  };
}

export function publicVerificationUrl(item: DocumentItem) {
  if (!item.verification?.token || !item.reference) return null;
  const configuredBase = (import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL as string | undefined)?.trim();
  const base = (configuredBase || 'https://samaykeur.com').replace(/\/+$/, '');
  const params = new URLSearchParams({
    token: item.verification.token,
    ref: item.reference,
    type: item.documentType || 'document',
  });
  return `${base}/verify?${params.toString()}`;
}

export function registryCategory(documentType: string): UserDocumentCategory {
  if (documentType === 'contrat' || documentType === 'mandat') return 'contrats';
  if (documentType === 'rapport_bailleur' || documentType === 'export' || documentType === 'pdf') return 'exports';
  if (documentType === 'quittance' || documentType === 'facture') return 'administratif';
  return 'archives';
}

export function registryToDocumentItem(
  row: RegistryDocumentRow,
  businessContext?: DocumentBusinessContext,
  verification?: DocumentVerificationRow,
  generatedBy?: string
): DocumentItem {
  const fallbackFileName = row.metadata?.file_name || row.reference;
  const typeTitle = documentTypeTitle(row.document_type);
  const metadataTitle = typeof row.metadata?.title === 'string' ? row.metadata.title.trim() : '';
  const periodLabel = formatDocumentPeriod(row.period);
  const locationLabel = row.document_type === 'mandat' && businessContext?.subject ? 'Agence / Bailleur' : businessContext?.location;
  const contextualSubtitle = [locationLabel, periodLabel].filter(Boolean).join(' · ');
  return {
    id: row.id,
    source: 'generated',
    title: businessContext?.subject ? `${typeTitle} — ${businessContext.subject}` : metadataTitle || fallbackFileName,
    subtitle: contextualSubtitle || 'Document à classer',
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    size: Number(row.file_size ?? 0),
    category: registryCategory(row.document_type),
    entityType: null,
    lifecycleStatus: row.status,
    retentionPolicy: row.retention_policy ?? 'critical',
    createdAt: row.generated_at,
    reference: row.reference,
    documentType: row.document_type,
    fileName: fallbackFileName,
    businessContext,
    period: row.period,
    isVerifiable: verification?.document_status === 'authentic',
    entityId: row.entity_id,
    version: row.version,
    metadata: row.metadata ?? undefined,
    uploadedBy: generatedBy,
    verification: verification
      ? {
        token: verification.token,
        status: verification.document_status,
        issuedAt: verification.issued_at,
        registeredAt: verification.created_at,
        agencyName: verification.agency_name,
        amountXof: verification.amount_xof,
        paymentStatus: verification.payment_status,
      }
      : undefined,
  };
}
