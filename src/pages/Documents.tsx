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
  SlidersHorizontal,
  Sparkles,
  PanelsTopLeft,
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
import { PageSkeleton, SkeletonCards } from '../components/ui/Skeleton';
import {
  createDocumentSignedUrl,
  cleanupTemporaryDocuments,
  getAgencyStorageBreakdown,
  getAgencyStorageUsage,
  markOrphanDocumentRecords,
  optimizeDocumentStorage,
  uploadUserDocument,
  formatStorageSize,
  DOCUMENT_CATEGORY_LABELS,
  type StorageBreakdown,
  type StorageUsage,
  type UserDocumentCategory,
  type UserDocumentEntityType,
} from '../services/documentStorage';
import { readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { PremiumFilterSelect } from '../components/ui/PremiumFilterSelect';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { DocumentProofDrawer } from '../components/documents/DocumentProofDrawer';
import { DocumentUploadWizard, type DocumentUploadValue } from '../components/documents/DocumentUploadWizard';
import { supportsPublicVerification, getDocumentProofState } from '../components/documents/documentProofState';

import {
  type DocumentItem,
  type DocumentSourceFilter,
  type DocumentStatusFilter,
  type DocumentTypeFilter,
  type EntityOption,
  type RegistryDocumentRow,
  type DocumentVerificationRow,
  type DocumentBusinessContext,
  type UserDocumentRow,
  DOCUMENT_TYPE_FILTERS,
  CATEGORIES,
  bucketValue,
  documentTypeBadge,
  isQrVerifiableDocument,
  isDocumentUnclassified,
  formatDocumentPeriod,
  formatPersonName,
  lifecycleLabel,
  matchesTypeFilter,
  publicVerificationUrl,
  registryToDocumentItem,
  singleRelation,
  toDocumentItem,
  usageMessage,
  usageTone,
} from '../lib/documents/documentFormatters';

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

const DOCUMENT_TABLE_COLUMNS = [
  { key: 'document', label: 'Document', required: true },
  { key: 'context', label: 'Contexte' },
  { key: 'period', label: 'Période' },
  { key: 'status', label: 'Statut' },
  { key: 'proof', label: 'Preuve' },
  { key: 'date', label: 'Date' },
];

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
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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
      toast.error('Connexion indisponible : organisation du coffre impossible hors ligne.');
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
      toast.error(error instanceof Error ? error.message : 'Organisation du coffre impossible');
    } finally {
      setMaintenanceAction(null);
    }
  };

  const visibleCategories = useMemo(
    () => CATEGORIES.filter((category) => !(isIndividualOwner && category === 'bailleurs')),
    [isIndividualOwner]
  );
  const agencyId = profile?.agency_id ?? '';
  const usedPercent = Math.min(100, Number(usage?.usage_percent ?? 0));
  const currentUsageMessage = usageMessage(usedPercent);
  const uploadedBucket = bucketValue(breakdown, 'uploaded');
  const generatedBucket = bucketValue(breakdown, 'generated');
  const criticalBucket = bucketValue(breakdown, 'critical');
  const reviewBucket = bucketValue(breakdown, 'orphaned');
  const activeCount = items.filter((item) => item.lifecycleStatus === 'active').length;
  const verifiableCount = items.filter(isQrVerifiableDocument).length;
  const toClassifyCount = items.filter(isDocumentUnclassified).length;
  const archivedCount = items.filter((item) => item.lifecycleStatus === 'archived').length;

  // KPI filter handler: click on a KPI chip applies the relevant filter
  const handleKpiClick = (kpi: 'active' | 'qr' | 'unclassified' | 'archived') => {
    setQuery('');
    setSourceFilter('all');
    if (kpi === 'active') {
      setStatusFilter(statusFilter === 'active' ? 'all' : 'active');
      setTypeFilter('all');
    } else if (kpi === 'qr') {
      setTypeFilter(typeFilter === 'noqr' ? 'all' : typeFilter);
      setSourceFilter(sourceFilter === 'qr' ? 'all' : 'qr');
      setStatusFilter('all');
    } else if (kpi === 'unclassified') {
      setStatusFilter(statusFilter === 'unclassified' ? 'all' : 'unclassified');
      setTypeFilter('all');
    } else if (kpi === 'archived') {
      setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived');
      setTypeFilter('all');
    }
  };

  const drawerOpen = !!selectedDocument;
  const documentColumnKeys = DOCUMENT_TABLE_COLUMNS.map((column) => column.key);
  const {
    visibility: documentColumnVisibility,
    toggle: toggleDocumentColumn,
    setAll: setAllDocumentColumns,
    isVisible: isDocumentColumnVisible,
  } = useColumnVisibility('documents', documentColumnKeys);
  const sourceFilterOptions = [
    { value: 'all', label: 'Tous les documents' },
    { value: 'uploaded', label: 'Ajoutés manuellement' },
    { value: 'generated', label: 'Générés automatiquement' },
    { value: 'qr', label: 'Vérifiables QR' },
  ];
  const statusFilterOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'active', label: 'Actifs' },
    { value: 'unclassified', label: 'À classer' },
    { value: 'review', label: 'À revoir' },
    { value: 'archived', label: 'Archivés' },
  ];
  const activeMobileFilterCount = Number(sourceFilter !== 'all') + Number(statusFilter !== 'all');

  if (loading && items.length === 0) {
    return <PageSkeleton title="Documents" variant="table" />;
  }

  return (
    <>
    <PageShell spacing="standard" variant="dataDense" tone="paper" verticalInset="standard" ariaLabel="Coffre documentaire">
    <div className={`min-w-0 ${drawerOpen ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(23rem,28vw,26rem)] lg:items-start lg:gap-3' : ''}`}>
      <div className="flex min-w-0 flex-col gap-3.5 sm:gap-5">
        {/* ── HERO ── */}
      <PremiumPageHeader
        variant="darkVault"
        density="compact"
        className={`!gap-2 ${drawerOpen ? '!p-2.5 lg:!flex-row lg:!items-center lg:!justify-between' : '!p-3 sm:!p-3.5 lg:!flex-row lg:!items-center lg:!justify-between lg:!p-4'}`}
        eyebrow={drawerOpen ? undefined : 'COFFRE DOCUMENTAIRE'}
        title="Documents"
        description={drawerOpen ? undefined : 'Centralisez, retrouvez et vérifiez vos preuves.'}
        mobileDescription={drawerOpen ? undefined : 'Preuves vérifiables.'}
        secondaryAction={
          <div className="flex w-full gap-1.5 sm:w-auto">
            {profile?.role === 'admin' && (
              <PremiumButton
                variant="secondary"
                size="sm"
                onClick={() => navigate('/documents/studio')}
                icon={<PanelsTopLeft className="h-3.5 w-3.5" />}
                className="!h-8 flex-1 border-white/15 bg-white/10 !px-3 !text-xs text-white hover:bg-white/15 sm:flex-none"
              >
                Studio
              </PremiumButton>
            )}
            <PremiumButton
              variant="secondary"
              size="sm"
              onClick={() => navigate('/documents/scan')}
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              className="!h-8 flex-1 border-white/15 bg-white/10 !px-3 !text-xs text-white hover:bg-white/15 sm:flex-none"
            >
              Scanner
            </PremiumButton>
          </div>
        }
        primaryAction={
          <PremiumButton
            variant="create"
            size="sm"
            onClick={() => setUploadOpen(true)}
            data-testid="button-upload-document"
            icon={<Upload className="h-3.5 w-3.5" />}
            className="!h-8 w-full !px-3 !text-xs sm:w-auto"
          >
            Ajouter au coffre
          </PremiumButton>
        }
        sideContent={
          drawerOpen ? undefined : (
            <div className="hidden min-w-0 rounded-lg border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur sm:block sm:w-auto sm:min-w-[132px] sm:max-w-[150px]">
              <div className="flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-emerald-100/50">Espace sécurisé</p>
                  <p className="mt-0.5 whitespace-nowrap text-[0.68rem] font-bold text-white">
                    {formatStorageSize(usage?.used_bytes)}{' '}
                    <span className="text-[0.56rem] font-semibold text-emerald-100/45">/ {formatStorageSize(usage?.limit_bytes)}</span>
                  </p>
                </div>
                <HardDrive className="h-3 w-3 flex-shrink-0 text-emerald-200/60" />
              </div>
              <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={'h-full rounded-full transition-all duration-700 ' + usageTone(usedPercent)}
                  {...({ style: { width: usedPercent + '%' } } as React.HTMLAttributes<HTMLDivElement>)}
                />
              </div>
            </div>
          )
        }
      />

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

      {/* ── KPI MÉTIER — actionnables ── */}
      {!drawerOpen && (
        <PremiumKpiGrid density="compact">
          {[
            {
              id: 'active' as const,
              label: 'Preuves actives',
              value: activeCount,
              helper: 'Disponibles',
              icon: FileCheck2,
              isActive: statusFilter === 'active',
              tone: 'emerald' as const,
            },
            {
              id: 'qr' as const,
              label: 'Vérifiables QR',
              value: verifiableCount,
              helper: 'QR public',
              icon: ShieldCheck,
              isActive: sourceFilter === 'qr',
              tone: 'blue' as const,
            },
            {
              id: 'unclassified' as const,
              label: 'À classer',
              value: toClassifyCount,
              helper: 'Sans lien',
              icon: FolderOpen,
              isActive: statusFilter === 'unclassified',
              tone: 'amber' as const,
            },
            {
              id: 'archived' as const,
              label: 'Archivés',
              value: archivedCount,
              helper: 'Hors vue',
              icon: Archive,
              isActive: statusFilter === 'archived',
              tone: 'slate' as const,
            },
          ].map((metric) => (
            <MetricCard
              key={metric.id}
              density="compact"
              icon={metric.icon}
              title={metric.label}
              value={metric.value}
              helper={metric.helper}
              tone={metric.tone}
              isActive={metric.isActive}
              onClick={() => handleKpiClick(metric.id)}
            />
          ))}
        </PremiumKpiGrid>
      )}

          {/* LIST SECTION */}
          <section className="min-w-0 max-w-full space-y-3 pb-24 sm:space-y-4 sm:pb-0">

          {/* TOOLBAR */}
          <PremiumToolbar
            density="compact"
            layout="list"
            ariaLabel="Filtres du coffre documentaire"
            isSplitOpen={drawerOpen}
            search={
              <label className="relative block h-8 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un document, une référence, un locataire..."
                  className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 py-0 pl-8 pr-3 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            }
            filters={
              <div className="hidden items-center gap-2 lg:flex">
                <PremiumFilterSelect
                  value={sourceFilter === 'all' ? '' : sourceFilter}
                  placeholder="Source"
                  options={sourceFilterOptions.filter((option) => option.value !== 'all')}
                  onChange={(value) => setSourceFilter((value || 'all') as DocumentSourceFilter)}
                  className="w-[10.25rem]"
                />
                <PremiumFilterSelect
                  value={statusFilter === 'all' ? '' : statusFilter}
                  placeholder="Statut"
                  options={statusFilterOptions.filter((option) => option.value !== 'all')}
                  onChange={(value) => setStatusFilter((value || 'all') as DocumentStatusFilter)}
                  className="w-[8.75rem]"
                />
              </div>
            }
            secondaryActions={
              <>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(true)}
                  className={`inline-flex h-8 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[0.6rem] border px-2.5 py-1 text-xs font-bold shadow-sm transition lg:hidden ${activeMobileFilterCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-[#fffdf8] text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtres
                  {activeMobileFilterCount > 0 && (
                    <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">{activeMobileFilterCount}</span>
                  )}
                </button>
                <ColumnPicker
                  columns={DOCUMENT_TABLE_COLUMNS}
                  visibility={documentColumnVisibility}
                  onToggle={toggleDocumentColumn}
                  onSetAll={setAllDocumentColumns}
                  className="!h-8 !rounded-[0.6rem] !px-2.5 !py-1 !text-xs hidden lg:inline-flex"
                />
              </>
            }
            quickChips={visibleTypeFilters.map((filter) => ({
              id: filter.id,
              label: filter.label,
              count: typeFilterCounts[filter.id] ?? 0,
              isActive: typeFilter === filter.id,
              onClick: () => setTypeFilter(filter.id),
            }))}
          />

          <MobileFilterSheet
            isOpen={showMobileFilters}
            title="Filtres documents"
            onClose={() => setShowMobileFilters(false)}
            onReset={() => {
              setSourceFilter('all');
              setStatusFilter('all');
            }}
          >
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Source</p>
                <div className="grid gap-1.5">
                  {sourceFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSourceFilter(option.value as DocumentSourceFilter)}
                      className={`rounded-xl border px-2.5 py-2 text-left text-xs font-bold transition ${sourceFilter === option.value ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-[#fffdf8] text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Statut</p>
                <div className="grid gap-1.5">
                  {statusFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value as DocumentStatusFilter)}
                      className={`rounded-xl border px-2.5 py-2 text-left text-xs font-bold transition ${statusFilter === option.value ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-[#fffdf8] text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </MobileFilterSheet>

          {/* DOCUMENT LIST / TABLE */}
          {loading ? (
            <SkeletonCards count={4} />
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-950/10 bg-white/90 shadow-sm">
              {query || typeFilter !== 'all' || statusFilter !== 'all' || sourceFilter !== 'all' ? (
                <EmptyState
                  icon={FolderOpen}
                  title="Aucun document trouvé"
                  description="Ajustez les filtres ou réinitialisez la recherche."
                  action={{
                    label: "Réinitialiser",
                    onClick: () => {
                      setQuery('');
                      setTypeFilter('all');
                      setStatusFilter('all');
                      setSourceFilter('all');
                    }
                  }}
                />
              ) : (
                <EmptyState
                  icon={FolderOpen}
                  title="Aucun document"
                  description="Ajoutez votre premier document au coffre."
                  action={{
                    label: "Ajouter un document",
                    onClick: () => setUploadOpen(true)
                  }}
                  secondaryAction={{
                    label: "Scanner un document",
                    onClick: () => navigate('/documents/scan')
                  }}
                />
              )}
            </div>
          ) : (
            <>
              {/* Desktop: dense list when drawer closed, compact when open */}
              <div className="hidden lg:block">
                <PremiumTableSurface density="compact" withHorizontalScroll={!drawerOpen} ariaLabel="Table des documents">
                  <table className={`w-full text-left ${drawerOpen ? 'table-fixed' : ''}`}>
                    <thead>
                      <tr className="border-b border-emerald-950/8 bg-[#faf9f5]/95">
                        <th className={`${drawerOpen ? 'w-[46%]' : ''} px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500`}>Document</th>
                        {!drawerOpen && isDocumentColumnVisible('context') && <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Contexte</th>}
                        {isDocumentColumnVisible('period') && <th className={`${drawerOpen ? 'w-[18%]' : ''} px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500`}>Période</th>}
                        {isDocumentColumnVisible('status') && <th className={`${drawerOpen ? 'w-[17%]' : ''} px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500`}>Statut</th>}
                        {isDocumentColumnVisible('proof') && <th className={`${drawerOpen ? 'w-[15%]' : ''} px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500`}>Preuve</th>}
                        {!drawerOpen && isDocumentColumnVisible('date') && <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 text-right">Date</th>}
                        <th className={`${drawerOpen ? 'w-[4%]' : 'w-10'}`} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filteredItems.map((item) => {
                        const Icon = ['rapport', 'rapport_bailleur', 'rapport_proprietaire'].includes(item.documentType ?? '')
                          ? BarChart3
                          : CATEGORY_ICONS[item.category];
                        const proofState = getDocumentProofState(item);
                        const isSelected = `${item.source}-${item.id}` === selectedDocumentId;
                        const statusLabel = lifecycleLabel(item);
                        return (
                          <tr
                            key={`${item.source}-${item.id}`}
                            onClick={() => setSelectedDocumentId(`${item.source}-${item.id}`)}
                            className={`group cursor-pointer transition-colors duration-150 hover:bg-emerald-50/60 ${isSelected ? 'bg-emerald-50/80 shadow-[inset_3px_0_0_0_#047857]' : ''}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDocumentId(`${item.source}-${item.id}`); }}
                            {...(isSelected ? { 'aria-pressed': true } : {})}
                          >
                            {/* Document */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10 mt-0.5">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-extrabold text-slate-900">{item.title}</p>
                                  {drawerOpen ? (() => {
                                    const subject = item.businessContext?.subject || item.subtitle;
                                    const location = item.businessContext?.location;

                                    // Helper anti-duplication
                                    const secondaryParts = [subject, location]
                                      .filter((part): part is string => Boolean(part))
                                      .filter(part => !item.title.toLowerCase().includes(part.toLowerCase()));

                                    return (
                                      <div className="mt-0.5 flex flex-col gap-0.5">
                                        {secondaryParts.length > 0 ? (
                                          <p className="truncate text-[11px] font-bold text-slate-600">{secondaryParts.join(' · ')}</p>
                                        ) : item.reference ? (
                                          <p className="truncate font-mono text-[10px] font-semibold text-slate-400">Réf. {item.reference}</p>
                                        ) : null}
                                      </div>
                                    );
                                  })() : (
                                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                      <span className="flex-shrink-0 uppercase tracking-[0.05em] text-emerald-700/80">{documentTypeBadge(item)}</span>
                                      {item.reference && (
                                        <>
                                          <span className="flex-shrink-0 text-slate-300">•</span>
                                          <span className="flex-shrink-0 truncate font-mono max-w-[120px] sm:max-w-none">Réf. {item.reference}</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Contexte */}
                            {!drawerOpen && isDocumentColumnVisible('context') && (
                              <td className="px-3 py-2.5">
                                <div className="min-w-0 max-w-[200px]">
                                  {item.businessContext?.subject ? (
                                    <p className="truncate text-xs font-bold text-slate-700">{item.businessContext.subject}</p>
                                  ) : item.subtitle ? (
                                    <p className="truncate text-xs font-bold text-slate-700">{item.subtitle}</p>
                                  ) : (
                                    <p className="text-xs font-semibold text-slate-400">—</p>
                                  )}
                                  {item.businessContext?.location && (
                                    <p className="truncate text-[10px] font-semibold text-slate-500 mt-0.5">{item.businessContext.location}</p>
                                  )}
                                </div>
                              </td>
                            )}
                            {/* Période / Version */}
                            {isDocumentColumnVisible('period') && (
                              <td className="px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700">
                                  {item.period ? formatDocumentPeriod(item.period) : '—'}
                                </p>
                                {item.version && item.version > 1 && (
                                  <span className="inline-block mt-0.5 rounded bg-emerald-100/50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                    v{item.version}
                                  </span>
                                )}
                              </div>
                              </td>
                            )}
                            {/* Statut */}
                            {isDocumentColumnVisible('status') && (
                              <td className="px-3 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusLabel === 'Archivé'
                                ? 'bg-slate-100 text-slate-600'
                                : statusLabel === 'À classer' || statusLabel === 'À revoir'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-800'
                                }`}>{statusLabel}</span>
                              </td>
                            )}
                            {/* Preuve */}
                            {isDocumentColumnVisible('proof') && (
                              <td className="px-3 py-2.5">
                              {proofState.kind === 'verifiable' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                  <ShieldCheck className="h-3 w-3" />
                                  QR
                                </span>
                              ) : proofState.kind === 'revoked' ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Révoquée</span>
                              ) : proofState.kind === 'review' ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">À revoir</span>
                              ) : item.source === 'generated' ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Sans QR</span>
                              ) : (
                                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Ajouté</span>
                              )}
                              </td>
                            )}
                            {/* Date */}
                            {!drawerOpen && isDocumentColumnVisible('date') && (
                              <td className="px-3 py-2.5 text-right">
                              <p className="text-xs font-semibold text-slate-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</p>
                              </td>
                            )}
                            {/* Chevron */}
                            <td className="px-2 py-2.5">
                              <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </PremiumTableSurface>
              </div>

              {/* Mobile + tablet: cards */}
              <div className="grid min-w-0 max-w-full gap-2 lg:hidden">
                {filteredItems.map((item) => {
                  const Icon = ['rapport', 'rapport_bailleur', 'rapport_proprietaire'].includes(item.documentType ?? '')
                    ? BarChart3
                    : CATEGORY_ICONS[item.category];
                  const statusLabel = lifecycleLabel(item);
                  const isSelected = `${item.source}-${item.id}` === selectedDocumentId;
                  const statusTone = item.lifecycleStatus === 'archived'
                    ? 'slate'
                    : ['orphaned', 'temporary', 'corrupt'].includes(item.lifecycleStatus)
                      ? 'amber'
                      : 'emerald';
                  const compactSubtitle = item.businessContext?.subject || item.subtitle;
                  return (
                    <PremiumMobileCard
                      key={`${item.source}-${item.id}`}
                      title={item.title}
                      subtitle={compactSubtitle}
                      eyebrow={documentTypeBadge(item)}
                      icon={Icon}
                      status={statusLabel}
                      statusTone={statusTone}
                      density="dense"
                      emphasis="identity"
                      selected={isSelected}
                      onClick={() => setSelectedDocumentId(`${item.source}-${item.id}`)}
                      ariaLabel={`Consulter la fiche de ${item.title}`}
                      className="max-w-full min-w-0 overflow-hidden !rounded-[0.85rem] shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* MAINTENANCE — masquée par défaut, vocabulaire métier */}
          <details className="sk-premium-panel group/details min-w-0 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-bold text-slate-700 sm:px-4">
              <span className="flex min-w-0 items-center gap-2">
                <RefreshCw className={`h-4 w-4 flex-shrink-0 text-emerald-700 ${maintenanceAction ? 'animate-spin' : ''}`} />
                <span className="truncate">Organisation du coffre</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open/details:rotate-90" />
            </summary>
            <div className="border-t border-slate-100 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Ajoutés', bucket: uploadedBucket },
                  { label: 'Générés', bucket: generatedBucket },
                  { label: 'Protégés', bucket: criticalBucket },
                  { label: 'À classer', bucket: reviewBucket },
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
      </div>

      {/* DRAWER — pleine hauteur colonne droite sur xl, à côté du Hero et du reste */}
      {selectedDocument && (
        <div className="w-full lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-2rem)]">
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
          </div>
        )}
      </div>
    </PageShell>

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
    </>
  );
}
