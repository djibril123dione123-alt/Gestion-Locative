import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  ChevronRight,
  FileArchive,
  FileCheck2,
  FileText,
  FolderOpen,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCards } from '../components/ui/Skeleton';
import {
  createDocumentSignedUrl,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_ENTITY_LABELS,
  formatStorageSize,
  cleanupTemporaryDocuments,
  getAgencyStorageBreakdown,
  getAgencyStorageUsage,
  markOrphanDocumentRecords,
  optimizeDocumentStorage,
  uploadUserDocument,
  type RetentionPolicy,
  type StorageBreakdown,
  type StorageUsage,
  type UserDocumentCategory,
  type UserDocumentEntityType,
} from '../services/documentStorage';
import { readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { DocumentProofDrawer, type DocumentProofDrawerData } from '../components/documents/DocumentProofDrawer';
import {
  DocumentUploadWizard,
  type DocumentUploadValue,
} from '../components/documents/DocumentUploadWizard';
import { getDocumentProofState, supportsPublicVerification } from '../components/documents/documentProofState';

interface UserDocumentRow {
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

interface RegistryDocumentRow {
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

interface DocumentVerificationRow {
  document_ref: string;
  token: string;
  document_status: 'authentic' | 'revoked' | 'superseded';
  issued_at: string;
  created_at: string;
  agency_name: string;
  amount_xof: number | null;
  payment_status: string | null;
}

interface DocumentBusinessContext {
  subject?: string;
  location?: string;
}

interface DocumentItem extends DocumentProofDrawerData {
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

type DocumentTypeFilter = 'all' | 'quittance' | 'contrat' | 'mandat' | 'rapport' | 'facture' | 'justificatif' | 'archives' | 'unclassified';
type DocumentSourceFilter = 'all' | 'uploaded' | 'generated' | 'qr';
type DocumentStatusFilter = 'all' | 'active' | 'archived' | 'unclassified' | 'review';

const DOCUMENT_TYPE_FILTERS: Array<{ id: DocumentTypeFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'quittance', label: 'Quittances' },
  { id: 'contrat', label: 'Contrats' },
  { id: 'mandat', label: 'Mandats' },
  { id: 'rapport', label: 'Rapports' },
  { id: 'facture', label: 'Factures' },
  { id: 'justificatif', label: 'Justificatifs' },
  { id: 'archives', label: 'Archives' },
  { id: 'unclassified', label: 'À classer' },
];

const DOCUMENT_TYPE_TITLES: Record<string, string> = {
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

interface EntityOption {
  id: string;
  label: string;
}

const CATEGORIES: UserDocumentCategory[] = [
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

const CATEGORY_ICONS: Record<UserDocumentCategory, typeof FileText> = {
  bailleurs: UserRound,
  locataires: UserRound,
  immeubles: Building2,
  unites: Building2,
  contrats: FileCheck2,
  juridique: ShieldCheck,
  administratif: FileText,
  assurances: LockKeyhole,
  personnel: UserRound,
  exports: FileArchive,
  archives: Archive,
  autre: FolderOpen,
};


const ENTITY_LABELS: Record<string, string> = {
  active: 'Actif',
  archived: 'Archivé',
  deleted: 'Supprimé',
  temporary: 'Temporaire',
  orphaned: 'À vérifier',
};

function formatPersonName(person?: { nom?: string | null; prenom?: string | null } | null) {
  return [person?.prenom, person?.nom].filter(Boolean).join(' ').trim();
}

function singleRelation<T>(value?: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function formatDocumentPeriod(period?: string | null) {
  if (!period) return '';
  const normalized = /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : period;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

function documentTypeTitle(documentType?: string) {
  if (!documentType) return 'Document';
  return DOCUMENT_TYPE_TITLES[documentType] ?? documentType.replace(/_/g, ' ');
}

function lifecycleLabel(item: DocumentItem) {
  if (item.lifecycleStatus === 'archived') return 'Archivé';
  if (item.lifecycleStatus === 'temporary') return 'À revoir';
  if (item.lifecycleStatus === 'orphaned' || (item.source === 'uploaded' && !item.businessContext?.subject)) return 'À classer';
  return ENTITY_LABELS[item.lifecycleStatus] ?? item.lifecycleStatus;
}

function isQrVerifiableDocument(item: DocumentItem) {
  return getDocumentProofState(item).kind === 'verifiable';
}

function isDocumentUnclassified(item: DocumentItem) {
  return item.lifecycleStatus === 'orphaned' || (item.source === 'uploaded' && !item.businessContext?.subject);
}

function documentTypeBadge(item: DocumentItem) {
  if (item.documentType === 'quittance') return 'QUITTANCES';
  if (item.documentType === 'facture') return 'FACTURES';
  if (item.documentType === 'contrat') return 'CONTRATS';
  if (item.documentType === 'mandat') return 'MANDATS';
  if (item.documentType === 'rapport' || item.documentType === 'rapport_bailleur' || item.documentType === 'rapport_proprietaire') return 'RAPPORTS';
  if (item.source === 'uploaded' && !item.businessContext?.subject) return 'DOCUMENT LIBRE';
  if (item.source === 'uploaded' && ['bailleurs', 'locataires', 'immeubles', 'unites', 'assurances'].includes(item.category)) return 'JUSTIFICATIFS';
  return 'ADMINISTRATIF';
}

function matchesTypeFilter(item: DocumentItem, filter: DocumentTypeFilter) {
  if (filter === 'all') return true;
  if (filter === 'archives') return item.lifecycleStatus === 'archived';
  if (filter === 'unclassified') return isDocumentUnclassified(item);
  if (filter === 'justificatif') return documentTypeBadge(item) === 'JUSTIFICATIFS';
  if (filter === 'rapport') return ['rapport', 'rapport_bailleur', 'rapport_proprietaire'].includes(item.documentType ?? '');
  return item.documentType === filter;
}

function normalizeCategory(value?: string | null): UserDocumentCategory {
  if (value && CATEGORIES.includes(value as UserDocumentCategory)) return value as UserDocumentCategory;
  return 'administratif';
}

function usageTone(percent: number) {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-orange-500';
  return 'bg-emerald-600';
}

function usageMessage(percent: number) {
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

function bucketValue(breakdown: StorageBreakdown | null, key: string) {
  return breakdown?.by_retention?.[key] ?? breakdown?.by_source?.[key] ?? breakdown?.by_lifecycle?.[key] ?? null;
}

function toDocumentItem(row: UserDocumentRow, uploadedBy?: string): DocumentItem {
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

function publicVerificationUrl(item: DocumentItem) {
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

function registryCategory(documentType: string): UserDocumentCategory {
  if (documentType === 'contrat' || documentType === 'mandat') return 'contrats';
  if (documentType === 'rapport_bailleur' || documentType === 'export' || documentType === 'pdf') return 'exports';
  if (documentType === 'quittance' || documentType === 'facture') return 'administratif';
  return 'archives';
}

function registryToDocumentItem(
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

export function Documents() {
  const { profile, user, accountProfile } = useAuth();
  const navigate = useNavigate();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const toast = useToast();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const hasLoadedDocumentsRef = React.useRef(false);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocumentItem | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<DocumentSourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>('all');
  const [entityOptions, setEntityOptions] = useState<Record<UserDocumentEntityType, EntityOption[]>>({
    agency: [],
    bailleur: [],
    locataire: [],
    immeuble: [],
    unite: [],
    contrat: [],
    operation: [],
  });


  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    const scopedAgencyId = profile.agency_id;
    const scopedUserId = user?.id ?? null;
    if (!hasLoadedDocumentsRef.current) setLoading(true);
    try {
      const result = await readWithCache<{
        items: DocumentItem[];
        usage: StorageUsage | null;
        breakdown: StorageBreakdown | null;
        entityOptions: Record<UserDocumentEntityType, EntityOption[]>;
      }>(
        { agencyId: scopedAgencyId, userId: scopedUserId },
        'documents-page',
        async () => {
          const [docRes, registryRes, storageUsage, storageBreakdown, bailleursRes, locatairesRes, immeublesRes, unitesRes, contratsRes, profilesRes] =
            await Promise.all([
              supabase
                .from('documents')
                .select(
                  'id, name, file_url, storage_path, file_type, file_size, document_category, document_scope, entity_type, entity_id, lifecycle_status, retention_policy, description, uploaded_by, created_at'
                )
                .eq('agency_id', scopedAgencyId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
              supabase
                .from('document_registry')
                .select('id, document_type, entity_id, period, reference, version, storage_path, file_size, mime_type, status, retention_policy, generated_at, generated_by, metadata')
                .eq('agency_id', scopedAgencyId)
                .neq('status', 'deleted')
                .order('generated_at', { ascending: false })
                .limit(80),
              getAgencyStorageUsage(scopedAgencyId),
              getAgencyStorageBreakdown(scopedAgencyId),
              supabase.from('bailleurs').select('id, nom, prenom').eq('agency_id', scopedAgencyId),
              supabase.from('locataires').select('id, nom, prenom').eq('agency_id', scopedAgencyId),
              supabase.from('immeubles').select('id, nom').eq('agency_id', scopedAgencyId),
              supabase.from('unites').select('id, nom').eq('agency_id', scopedAgencyId),
              supabase.from('contrats').select('id, locataires(nom, prenom), unites(nom, immeubles(nom))').eq('agency_id', scopedAgencyId),
              supabase.from('user_profiles').select('id, nom, prenom').eq('agency_id', scopedAgencyId),
            ]);

          if (docRes.error) throw docRes.error;
          if (registryRes.error) throw registryRes.error;
          if (bailleursRes.error) throw bailleursRes.error;
          if (locatairesRes.error) throw locatairesRes.error;
          if (immeublesRes.error) throw immeublesRes.error;
          if (unitesRes.error) throw unitesRes.error;
          if (contratsRes.error) throw contratsRes.error;

          const registryRows = (registryRes.data ?? []) as RegistryDocumentRow[];
          const registryReferences = registryRows.map((row) => row.reference);
          const verificationRes = registryReferences.length
            ? await supabase
              .from('document_verifications')
              .select('document_ref, token, document_status, issued_at, created_at, agency_name, amount_xof, payment_status')
              .eq('agency_id', scopedAgencyId)
              .in('document_ref', registryReferences)
            : { data: [], error: null };
          const verificationsByReference = new Map(
            ((verificationRes.error ? [] : verificationRes.data ?? []) as DocumentVerificationRow[]).map((row) => [row.document_ref, row])
          );
          const paymentIds = registryRows
            .filter((row) => row.document_type === 'quittance' || row.document_type === 'facture')
            .map((row) => row.entity_id);
          const paiementsRes = paymentIds.length
            ? await supabase
              .from('paiements')
              .select('id, contrats(locataires(nom, prenom), unites(nom, immeubles(nom)))')
              .eq('agency_id', scopedAgencyId)
              .in('id', paymentIds)
            : { data: [], error: null };
          if (paiementsRes.error) throw paiementsRes.error;

          type ContractContextRow = {
            id: string;
            locataires?: { nom?: string | null; prenom?: string | null } | Array<{ nom?: string | null; prenom?: string | null }> | null;
            unites?: {
              nom?: string | null;
              immeubles?: { nom?: string | null } | Array<{ nom?: string | null }> | null;
            } | Array<{
              nom?: string | null;
              immeubles?: { nom?: string | null } | Array<{ nom?: string | null }> | null;
            }> | null;
          };
          type PaymentContextRow = {
            id: string;
            contrats?: ContractContextRow | ContractContextRow[] | null;
          };

          const bailleurLabels = new Map(
            ((bailleursRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => [row.id, formatPersonName(row)])
          );
          const profileLabels = new Map(
            ((profilesRes.error ? [] : profilesRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => [row.id, formatPersonName(row)])
          );
          const contractContexts = new Map(
            ((contratsRes.data ?? []) as unknown as ContractContextRow[]).map((row) => {
              const locataire = singleRelation(row.locataires);
              const unite = singleRelation(row.unites);
              const immeuble = singleRelation(unite?.immeubles);
              return [
                row.id,
                {
                  subject: formatPersonName(locataire) || undefined,
                  location: [unite?.nom, immeuble?.nom].filter(Boolean).join(' · ') || undefined,
                } satisfies DocumentBusinessContext,
              ];
            })
          );
          const paymentContexts = new Map(
            ((paiementsRes.data ?? []) as unknown as PaymentContextRow[]).map((row) => {
              const contrat = singleRelation(row.contrats);
              const locataire = singleRelation(contrat?.locataires);
              const unite = singleRelation(contrat?.unites);
              const immeuble = singleRelation(unite?.immeubles);
              return [
                row.id,
                {
                  subject: formatPersonName(locataire) || undefined,
                  location: [unite?.nom, immeuble?.nom].filter(Boolean).join(' · ') || undefined,
                } satisfies DocumentBusinessContext,
              ];
            })
          );

          const nextEntityOptions = {
            agency: [{ id: scopedAgencyId, label: isIndividualOwner ? 'Compte propriétaire' : 'Agence' }],
            bailleur: ((bailleursRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => ({ id: row.id, label: [row.prenom, row.nom].filter(Boolean).join(' ').trim() })),
            locataire: ((locatairesRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => ({ id: row.id, label: [row.prenom, row.nom].filter(Boolean).join(' ').trim() })),
            immeuble: ((immeublesRes.data ?? []) as Array<{ id: string; nom: string }>).map((row) => ({ id: row.id, label: row.nom })),
            unite: ((unitesRes.data ?? []) as Array<{ id: string; nom: string }>).map((row) => ({ id: row.id, label: row.nom })),
            contrat: ((contratsRes.data ?? []) as unknown as ContractContextRow[]).map((row) => ({
              id: row.id,
              label: `${formatPersonName(singleRelation(row.locataires))} - ${singleRelation(row.unites)?.nom ?? 'Unité'}`.trim(),
            })),
            operation: [],
          };

          const entityLabels = new Map<string, string>();
          Object.entries(nextEntityOptions).forEach(([entityType, options]) => {
            options.forEach((option) => entityLabels.set(`${entityType}:${option.id}`, option.label));
          });
          const uploaded = ((docRes.data ?? []) as UserDocumentRow[]).map((row) => {
            const item = toDocumentItem(row, row.uploaded_by ? profileLabels.get(row.uploaded_by) : undefined);
            const subject = row.entity_type && row.entity_id ? entityLabels.get(`${row.entity_type}:${row.entity_id}`) : undefined;
            return {
              ...item,
              title: `Document libre — ${row.name}`,
              subtitle: subject
                ? `${subject} · ${DOCUMENT_CATEGORY_LABELS[item.category]}`
                : row.description || 'Document à classer',
              businessContext: subject ? { subject } : undefined,
            };
          });
          const generated = registryRows.map((row) => {
            let context: DocumentBusinessContext | undefined;
            if (row.document_type === 'quittance' || row.document_type === 'facture') context = paymentContexts.get(row.entity_id);
            else if (row.document_type === 'contrat') context = contractContexts.get(row.entity_id);
            else if (row.document_type === 'mandat' || row.document_type === 'rapport_bailleur' || row.document_type === 'rapport_proprietaire') {
              const subject = bailleurLabels.get(row.entity_id);
              context = subject ? { subject } : undefined;
            }
            const verification = supportsPublicVerification(row.document_type) ? verificationsByReference.get(row.reference) : undefined;
            return registryToDocumentItem(row, context, verification, row.generated_by ? profileLabels.get(row.generated_by) : undefined);
          });
          const nextItems = [...uploaded, ...generated].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return { items: nextItems, usage: storageUsage, breakdown: storageBreakdown, entityOptions: nextEntityOptions };
        },
        { timeoutMs: 7_000 }
      );

      setItems(result.data.items);
      hasLoadedDocumentsRef.current = true;
      setUsage(result.data.usage);
      setBreakdown(result.data.breakdown);
      setEntityOptions(result.data.entityOptions);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Documents indisponibles hors connexion sans cache local.');
    } finally {
      setLoading(false);
    }
  }, [isIndividualOwner, profile?.agency_id, toast, user?.id]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceFilter === 'uploaded' && item.source !== 'uploaded') return false;
      if (sourceFilter === 'generated' && item.source !== 'generated') return false;
      if (sourceFilter === 'qr' && !isQrVerifiableDocument(item)) return false;
      if (statusFilter === 'active' && item.lifecycleStatus !== 'active') return false;
      if (statusFilter === 'archived' && item.lifecycleStatus !== 'archived') return false;
      if (statusFilter === 'unclassified' && !isDocumentUnclassified(item)) return false;
      if (statusFilter === 'review' && item.lifecycleStatus !== 'temporary' && getDocumentProofState(item).kind !== 'review') return false;
      if (!matchesTypeFilter(item, typeFilter)) return false;
      if (!normalizedQuery) return true;
      return [
        item.title,
        item.subtitle,
        item.fileName,
        item.reference,
        item.businessContext?.subject,
        item.businessContext?.location,
        DOCUMENT_CATEGORY_LABELS[item.category],
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [items, query, sourceFilter, statusFilter, typeFilter]);
  const selectedDocument = useMemo(
    () => items.find((item) => `${item.source}-${item.id}` === selectedDocumentId) ?? null,
    [items, selectedDocumentId]
  );

  useEffect(() => {
    if (!selectedDocumentId) return;
    const remainsVisible = filteredItems.some((item) => `${item.source}-${item.id}` === selectedDocumentId);
    if (!selectedDocument || !remainsVisible) setSelectedDocumentId(null);
  }, [filteredItems, selectedDocument, selectedDocumentId]);

  const typeFilterCounts = useMemo(() => {
    return DOCUMENT_TYPE_FILTERS.reduce<Record<DocumentTypeFilter, number>>((acc, filter) => {
      acc[filter.id] = items.filter((item) => matchesTypeFilter(item, filter.id)).length;
      return acc;
    }, {} as Record<DocumentTypeFilter, number>);
  }, [items]);
  const visibleTypeFilters = useMemo(
    () => DOCUMENT_TYPE_FILTERS.filter((filter) => filter.id === 'all' || (typeFilterCounts[filter.id] ?? 0) > 0),
    [typeFilterCounts]
  );

  const resolveDocumentUrl = async (item: DocumentItem) => {
    if (!navigator.onLine) {
      throw new Error('Connexion indisponible : le fichier ne peut pas être chargé hors ligne.');
    }
    const url = await createDocumentSignedUrl(item.storagePath);
    if (item.source === 'uploaded') {
      void supabase.from('documents').update({ last_accessed_at: new Date().toISOString() }).eq('id', item.id);
    } else {
      void supabase.from('document_registry').update({ last_accessed_at: new Date().toISOString() }).eq('id', item.id);
    }
    return url;
  };

  const openDocument = async (item: DocumentItem) => {
    try {
      const url = await resolveDocumentUrl(item);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ouverture du document impossible');
    }
  };

  const downloadDocument = async (item: DocumentItem) => {
    try {
      const url = await resolveDocumentUrl(item);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Téléchargement du document impossible');
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = item.fileName || `${item.reference || 'document'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Téléchargement du document impossible');
    }
  };

  const verifyDocument = (item: DocumentItem) => {
    const url = publicVerificationUrl(item);
    if (!url) {
      toast.warning('Ce document ne possède pas encore de preuve QR enregistrée.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyVerificationLink = async (item: DocumentItem) => {
    const url = publicVerificationUrl(item);
    if (!url) throw new Error('Lien de vérification indisponible');
    await navigator.clipboard.writeText(url);
    toast.success('Lien de vérification copié');
  };

  const submitUpload = async (value: DocumentUploadValue) => {
    if (!profile?.agency_id) throw new Error('Organisation indisponible.');
    if (!navigator.onLine) {
      throw new Error('Connexion indisponible : ajout impossible hors ligne.');
    }

    const tags = value.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    const entityType = value.entityType || null;

    await uploadUserDocument({
      agencyId: profile.agency_id,
      userId: user?.id,
      file: value.file,
      name: value.name,
      category: value.category,
      entityType,
      entityId: value.entityId || null,
      description: value.description,
      retentionPolicy: value.retentionPolicy,
      tags,
      relations: {
        bailleur_id: entityType === 'bailleur' ? value.entityId || null : null,
        immeuble_id: entityType === 'immeuble' ? value.entityId || null : null,
        unite_id: entityType === 'unite' ? value.entityId || null : null,
        contrat_id: entityType === 'contrat' ? value.entityId || null : null,
      },
    });

    toast.success('Document ajouté au coffre');
    await load();
  };
  const archiveDocument = async () => {
    if (!archiveTarget || archiveTarget.source !== 'uploaded') return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : archivage impossible hors ligne.');
      return;
    }
    try {
      const { error } = await supabase.rpc('archive_document_soft', { p_document_id: archiveTarget.id });
      if (error) throw error;
      toast.success('Document archivé');
      setArchiveTarget(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archivage impossible");
    }
  };

  const runMaintenance = async (
    action: 'optimize' | 'temporary' | 'orphans',
    runner: () => Promise<unknown>
  ) => {
    if (!profile?.agency_id) return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : maintenance documentaire impossible hors ligne.');
      return;
    }
    setMaintenanceAction(action);
    try {
      const result = (await runner()) as Record<string, unknown>;
      const total = Object.values(result).reduce<number>((count, value) => {
        if (typeof value === 'number') return count + value;
        if (value && typeof value === 'object') {
          return count + Object.values(value as Record<string, unknown>).reduce<number>(
            (nested, nestedValue) => nested + (typeof nestedValue === 'number' ? nestedValue : 0),
            0
          );
        }
        return count;
      }, 0);
      toast.success(total > 0 ? `${total} document(s) classé(s)` : 'Votre coffre est déjà bien classé');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Maintenance documentaire impossible');
    } finally {
      setMaintenanceAction(null);
    }
  };

  const visibleCategories = useMemo(
    () => CATEGORIES.filter((category) => !(isIndividualOwner && category === 'bailleurs')),
    [isIndividualOwner]
  );
  const entityLabel = (entityType: UserDocumentEntityType) => {
    if (isIndividualOwner && entityType === 'agency') return 'Compte propriétaire';
    if (isIndividualOwner && entityType === 'bailleur') return 'Propriétaire';
    return DOCUMENT_ENTITY_LABELS[entityType];
  };
  const agencyId = profile?.agency_id ?? '';
  const usedPercent = Math.min(100, Number(usage?.usage_percent ?? 0));
  const currentUsageMessage = usageMessage(usedPercent);
  const uploadedBucket = bucketValue(breakdown, 'uploaded');
  const generatedBucket = bucketValue(breakdown, 'generated');
  const criticalBucket = bucketValue(breakdown, 'critical');
  const reviewBucket = bucketValue(breakdown, 'orphaned');
  const verifiableCount = items.filter(isQrVerifiableDocument).length;
  const toClassifyCount = items.filter(isDocumentUnclassified).length;
  const archivedCount = items.filter((item) => item.lifecycleStatus === 'archived').length;

  return (
    <div className="sk-mobile-page min-w-0 space-y-3.5 sm:space-y-5">
      <div className="sk-mobile-hero max-w-full bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-3.5 text-white shadow-2xl shadow-emerald-950/15 sm:p-6">
        <div className="absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-orange-300/15 blur-3xl sm:block" />
        <div className="relative flex min-w-0 flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
              <LockKeyhole className="h-3.5 w-3.5 text-orange-200" />
              Coffre documentaire
            </div>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight sm:mt-4 sm:text-4xl">Documents</h1>
            <p className="mt-1.5 max-w-xl text-sm font-medium leading-5 text-emerald-50/75 sm:mt-2 sm:text-base sm:leading-6">
              <span className="sm:hidden">Centralisez, retrouvez et vérifiez vos documents.</span>
              <span className="hidden sm:inline">
                {isIndividualOwner
                  ? 'Centralisez, retrouvez et vérifiez les preuves liées à vos biens.'
                  : 'Centralisez, retrouvez et vérifiez les preuves de votre agence.'}
              </span>
            </p>
          </div>

          <div className="min-w-0 w-full max-w-full rounded-xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur sm:rounded-2xl sm:p-4 lg:max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100/65">Espace sécurisé</p>
                <p className="mt-1 text-lg font-extrabold">
                  {formatStorageSize(usage?.used_bytes)} <span className="text-sm font-semibold text-emerald-100/55">/ {formatStorageSize(usage?.limit_bytes)}</span>
                </p>
              </div>
              <HardDrive className="h-5 w-5 text-orange-200 sm:h-7 sm:w-7" />
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10 sm:mt-4 sm:h-2">
              <div className={`h-full rounded-full ${usageTone(usedPercent)} transition-all duration-700`} style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="mt-2 grid min-w-0 grid-cols-3 gap-1.5 text-[10px] text-emerald-50/70 sm:mt-3 sm:gap-2 sm:text-xs">
              <span className="min-w-0"><span className="block truncate">Uploads</span><strong className="block truncate text-emerald-50/90">{formatStorageSize(usage?.uploaded_bytes)}</strong></span>
              <span className="min-w-0"><span className="block truncate">Générés</span><strong className="block truncate text-emerald-50/90">{formatStorageSize(usage?.generated_bytes)}</strong></span>
              <span className="min-w-0"><span className="block truncate">Archives</span><strong className="block truncate text-emerald-50/90">{formatStorageSize(usage?.archived_bytes)}</strong></span>
            </div>
          </div>
        </div>
        <div className="relative mt-3 min-w-0 sm:mt-5">
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => navigate('/documents/scan')}
              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-2.5 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
            >
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span className="min-w-0">Scanner un document</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              data-testid="button-upload-document"
              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/18 bg-white/[0.1] px-2.5 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.16] sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
            >
              <Upload className="h-4 w-4 flex-shrink-0" />
              <span className="min-w-0">Ajouter un document</span>
            </button>
            <p className="hidden min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-semibold leading-5 text-emerald-50/70 sm:block sm:flex-1">
              Scannez un QR ou collez une référence pour vérifier une preuve.
            </p>
          </div>
          <p className="mt-1.5 text-center text-[11px] font-semibold text-emerald-50/65 sm:hidden">Scannez un QR ou une référence.</p>
        </div>
      </div>

      {currentUsageMessage && (
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${currentUsageMessage.tone}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{currentUsageMessage.title}</p>
              <p className="mt-1 text-sm font-medium opacity-80">{currentUsageMessage.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runMaintenance('optimize', () => optimizeDocumentStorage(agencyId))}
            disabled={maintenanceAction !== null || !agencyId}
            className="sk-action sk-action-secondary justify-center disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Optimiser
          </button>
        </div>
      )}

      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={load}
        message="Les documents affichés viennent du dernier chargement réussi. Les fichiers eux-mêmes nécessitent une connexion pour être ouverts ou modifiés."
      />

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {[
          { label: 'Documents actifs', value: items.filter((item) => item.lifecycleStatus === 'active').length, helper: 'Disponibles', icon: FileCheck2 },
          { label: 'Vérifiables QR', value: verifiableCount, helper: 'Preuves contrôlables', icon: ShieldCheck },
          { label: 'À classer', value: toClassifyCount, helper: 'Sans lien métier', icon: FolderOpen },
          { label: 'Archivés', value: archivedCount, helper: 'Conservés', icon: Archive },
        ].map((metric) => (
          <div key={metric.label} className="sk-metric-tile min-w-0 p-2.5 sm:p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-slate-500 sm:text-xs sm:tracking-[0.08em]">{metric.label}</p>
              <metric.icon className="h-3.5 w-3.5 flex-shrink-0 text-emerald-700 sm:h-4 sm:w-4" />
            </div>
            <p className="mt-1.5 text-lg font-extrabold leading-none text-slate-950 sm:mt-2 sm:text-xl">{metric.value}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-400 sm:text-xs">{metric.helper}</p>
          </div>
        ))}
      </div>

      <div className={`grid min-w-0 items-start gap-4 ${selectedDocument ? 'xl:grid-cols-[minmax(0,1fr)_31.5rem]' : ''}`}>
        <section className="min-w-0 max-w-full space-y-3 pb-24 sm:space-y-4 sm:pb-0">
          <div className="sk-premium-panel min-w-0 max-w-full p-3">
            <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:flex lg:items-center">
              <label className="relative col-span-2 min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un document..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 sm:hidden"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un document, une référence, un locataire..."
                  className="hidden sm:block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
                />
              </label>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as DocumentSourceFilter)}
                className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 sm:text-sm lg:w-[210px]"
              >
                <option value="all">Tous les documents</option>
                <option value="uploaded">Ajoutés manuellement</option>
                <option value="generated">Générés automatiquement</option>
                <option value="qr">Vérifiables QR</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as DocumentStatusFilter)}
                className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 sm:text-sm lg:w-[170px]"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="unclassified">À classer</option>
                <option value="review">À revoir</option>
                <option value="archived">Archivés</option>
              </select>
            </div>
            <div className="scrollbar-hide -mx-1 mt-2.5 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pb-1">
              {visibleTypeFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setTypeFilter(filter.id)}
                  className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${typeFilter === filter.id
                      ? 'border-emerald-950 bg-emerald-950 text-white shadow-sm'
                      : 'border-emerald-950/10 bg-white text-slate-600 hover:border-emerald-800/25 hover:bg-emerald-50'
                    }`}
                >
                  {filter.label}
                  <span className="text-[10px] opacity-60">{typeFilterCounts[filter.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonCards count={6} />
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-950/10 bg-white/90 shadow-sm">
              <EmptyState icon={FolderOpen} title="Aucun document" description="Ajustez les filtres ou archivez un premier fichier." />
            </div>
          ) : (
            <div className={`grid min-w-0 max-w-full gap-3 ${selectedDocument ? 'xl:grid-cols-1 2xl:grid-cols-2' : 'xl:grid-cols-2'}`}>
              {filteredItems.map((item) => {
                const Icon = ['rapport', 'rapport_bailleur', 'rapport_proprietaire'].includes(item.documentType ?? '')
                  ? BarChart3
                  : CATEGORY_ICONS[item.category];
                const statusLabel = lifecycleLabel(item);
                const proofState = getDocumentProofState(item);
                const showProofBadge = ['verifiable', 'review', 'revoked', 'superseded'].includes(proofState.kind);
                const isSelected = `${item.source}-${item.id}` === selectedDocumentId;
                return (
                  <article
                    key={`${item.source}-${item.id}`}
                    className={`group sk-mobile-card min-w-0 max-w-full overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-800/20 hover:shadow-premium active:scale-[0.992] ${isSelected ? 'border-emerald-700/45 bg-emerald-50/45 ring-2 ring-emerald-700/10' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentId(`${item.source}-${item.id}`)}
                      className="block w-full min-w-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                      aria-label={`Consulter la fiche de ${item.title}`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10 sm:h-11 sm:w-11 sm:rounded-2xl">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">{documentTypeBadge(item)}</p>
                          <h2 className="mt-1 line-clamp-2 break-words text-[15px] font-extrabold leading-5 text-slate-950 [overflow-wrap:anywhere] sm:text-base">{item.title}</h2>
                          <p className="mt-0.5 line-clamp-2 break-words text-xs font-semibold leading-5 text-slate-500 [overflow-wrap:anywhere] sm:text-sm">{item.subtitle}</p>
                        </div>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-bold text-emerald-800">
                          <span className="hidden sm:inline">Détails</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                          {item.source === 'generated' ? 'Généré' : 'Ajouté'}
                        </span>
                        {showProofBadge && (
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${proofState.kind === 'verifiable'
                              ? 'bg-sky-50 text-sky-700'
                              : proofState.kind === 'revoked'
                                ? 'bg-red-50 text-red-700'
                                : proofState.kind === 'superseded'
                                  ? 'bg-orange-50 text-orange-700'
                                  : 'bg-amber-50 text-amber-700'
                            }`}>
                            {proofState.label}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusLabel === 'Archivé'
                              ? 'bg-slate-100 text-slate-600'
                              : statusLabel === 'À classer' || statusLabel === 'À revoir'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                        >
                          {statusLabel}
                        </span>
                        {item.retentionPolicy === 'critical' && proofState.kind !== 'verifiable' && (
                          <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">Protégé</span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 sm:text-xs">
                        <span>{formatStorageSize(item.size)}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</span>
                        {item.entityType && <span>{entityLabel(item.entityType)}</span>}
                      </div>
                      {item.reference && (
                        <p className="mt-1.5 truncate font-mono text-[10px] font-semibold text-slate-400 sm:text-[11px]" title={item.reference}>
                          Réf. {item.reference}
                        </p>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          <details className="sk-premium-panel group/details min-w-0 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-bold text-slate-700 sm:px-4">
              <span className="flex min-w-0 items-center gap-2">
                <RefreshCw className={`h-4 w-4 flex-shrink-0 text-emerald-700 ${maintenanceAction ? 'animate-spin' : ''}`} />
                <span className="truncate">Organisation et classement du coffre</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open/details:rotate-90" />
            </summary>
            <div className="border-t border-slate-100 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Ajoutés', bucket: uploadedBucket },
                  { label: 'Générés', bucket: generatedBucket },
                  { label: 'Protégés', bucket: criticalBucket },
                  { label: 'À revoir', bucket: reviewBucket },
                ].map((entry) => (
                  <div key={entry.label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{entry.label}</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{entry.bucket?.count ?? 0}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:justify-end sm:gap-2">
                <button type="button" onClick={() => runMaintenance('optimize', () => optimizeDocumentStorage(agencyId))} disabled={maintenanceAction !== null || !agencyId} className="sk-action sk-action-primary min-w-0 justify-center px-2 text-xs disabled:opacity-60">Classer</button>
                <button type="button" onClick={() => runMaintenance('temporary', () => cleanupTemporaryDocuments(agencyId, 30))} disabled={maintenanceAction !== null || !agencyId} className="sk-action sk-action-secondary min-w-0 justify-center px-2 text-xs disabled:opacity-60">À revoir</button>
                <button type="button" onClick={() => runMaintenance('orphans', () => markOrphanDocumentRecords(agencyId))} disabled={maintenanceAction !== null || !agencyId} className="sk-action sk-action-secondary min-w-0 justify-center px-2 text-xs disabled:opacity-60">Sans lien</button>
              </div>
            </div>
          </details>
        </section>

        {selectedDocument && (
          <DocumentProofDrawer
            document={selectedDocument}
            canArchive={selectedDocument.source === 'uploaded' && selectedDocument.retentionPolicy !== 'critical' && selectedDocument.lifecycleStatus === 'active'}
            onClose={() => setSelectedDocumentId(null)}
            onOpen={(item) => openDocument(item as DocumentItem)}
            onDownload={(item) => downloadDocument(item as DocumentItem)}
            onArchive={(item) => {
              setSelectedDocumentId(null);
              setArchiveTarget(item as DocumentItem);
            }}
            onVerify={selectedDocument.verification ? (item) => verifyDocument(item as DocumentItem) : undefined}
            onCopyLink={selectedDocument.verification ? (item) => copyVerificationLink(item as DocumentItem) : undefined}
            onNotify={(message) => toast.success(message)}
            onError={(message) => toast.error(message)}
          />
        )}
      </div>

      <DocumentUploadWizard
        isOpen={uploadOpen}
        isIndividualOwner={isIndividualOwner}
        categories={visibleCategories}
        entityOptions={entityOptions}
        onClose={() => setUploadOpen(false)}
        onUpload={submitUpload}
      />
      <ConfirmModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={archiveDocument}
        title="Archiver ce document ?"
        message="Le fichier reste conservé et traçable, mais il sort de la vue active."
        confirmLabel="Archiver"
        cancelLabel="Annuler"
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
