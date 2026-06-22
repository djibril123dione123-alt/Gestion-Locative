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

function KpiTile({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  isActive,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  helper: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'stone';
  isActive: boolean;
  onClick: () => void;
}) {
  const tones = {
    emerald: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100', activeRing: 'ring-emerald-700/25 border-emerald-700/30' },
    blue: { gradient: 'from-white to-sky-50/75', text: 'text-sky-800', icon: 'bg-sky-50 text-sky-700 ring-sky-100', activeRing: 'ring-sky-700/25 border-sky-700/30' },
    amber: { gradient: 'from-white to-amber-50/70', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-800 ring-amber-100', activeRing: 'ring-amber-700/25 border-amber-700/30' },
    red: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100', activeRing: 'ring-red-700/25 border-red-700/30' },
    stone: { gradient: 'from-white to-stone-50/70', text: 'text-slate-700', icon: 'bg-stone-50 text-slate-700 ring-stone-100', activeRing: 'ring-slate-700/25 border-slate-700/30' },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      {...(isActive ? { 'aria-pressed': true } : {})}
      className={`@container text-left group min-w-0 rounded-[1.05rem] border bg-gradient-to-br ${tones.gradient} p-2.5 shadow-[0_9px_24px_rgba(15,23,42,0.045)] ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_13px_30px_rgba(15,23,42,0.075)] ${isActive ? `${tones.activeRing} shadow-inner` : 'border-emerald-950/10 hover:border-emerald-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`line-clamp-2 min-h-[2.5em] text-[0.68rem] font-bold uppercase tracking-[0.12em] ${tones.text}`}>{label}</p>
          <p className="mt-1.5 whitespace-nowrap text-[1.02rem] font-extrabold tracking-tight text-slate-950 sm:text-[1.1rem]">{value}</p>
          {helper && <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{helper}</p>}
        </div>
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${tones.icon} group-hover:scale-105`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
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

  return (
    <>
    <div className={`sk-mobile-page min-w-0 ${drawerOpen ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] xl:items-start xl:gap-5' : ''}`}>
      <div className="flex min-w-0 flex-col gap-3.5 sm:gap-5">
        {/* ── HERO ── */}
      <div className="sk-mobile-hero max-w-full bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-3.5 text-white shadow-2xl shadow-emerald-950/15 sm:p-5">
        <div className="absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-orange-300/15 blur-3xl sm:block" />
        <div className="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">

          {/* Left: title + CTA */}
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
              <LockKeyhole className="h-3 w-3 text-orange-200" />
              Coffre documentaire
            </div>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-brand-950 sm:text-4xl">
              Documents
            </h1>
            <p className="mt-1 text-sm font-medium leading-5 text-emerald-50/70 sm:text-sm max-w-lg">
              {isIndividualOwner
                ? 'Centralisez, retrouvez et vérifiez vos preuves.'
                : 'Centralisez, retrouvez et vérifiez vos preuves.'}
            </p>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/documents/scan')}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-3 py-2 text-xs font-black text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F]"
              >
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                Scanner un document
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                data-testid="button-upload-document"
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/18 bg-white/[0.1] px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.16]"
              >
                <Upload className="h-3.5 w-3.5 flex-shrink-0" />
                Ajouter au coffre
              </button>
            </div>
          </div>

          {/* Right: storage — compact/secondary */}
          <div className="min-w-0 w-full sm:w-auto sm:min-w-[200px] sm:max-w-[220px] rounded-xl border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100/55">Espace sécurisé</p>
                <p className="mt-0.5 text-sm font-extrabold">
                  {formatStorageSize(usage?.used_bytes)}{' '}
                  <span className="text-xs font-semibold text-emerald-100/45">/ {formatStorageSize(usage?.limit_bytes)}</span>
                </p>
              </div>
              <HardDrive className="h-4 w-4 text-emerald-200/60 flex-shrink-0" />
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${usageTone(usedPercent)} transition-all duration-700`}
                {...({ style: { width: `${usedPercent}%` } } as React.HTMLAttributes<HTMLDivElement>)}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── USAGE WARNING ── */}
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
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {[
              {
                id: 'active' as const,
                label: 'Preuves actives',
                value: activeCount,
                helper: 'Documents disponibles',
                icon: FileCheck2,
                isActive: statusFilter === 'active',
                tone: 'emerald' as const,
              },
              {
                id: 'qr' as const,
                label: 'Vérifiables QR',
                value: verifiableCount,
                helper: 'Contrôlables publiquement',
                icon: ShieldCheck,
                isActive: sourceFilter === 'qr',
                tone: 'blue' as const,
              },
              {
                id: 'unclassified' as const,
                label: 'À classer',
                value: toClassifyCount,
                helper: 'Sans lien métier',
                icon: FolderOpen,
                isActive: statusFilter === 'unclassified',
                tone: 'amber' as const,
              },
              {
                id: 'archived' as const,
                label: 'Archivés',
                value: archivedCount,
                helper: 'Conservés hors vue active',
                icon: Archive,
                isActive: statusFilter === 'archived',
                tone: 'stone' as const,
              },
            ].map((metric) => (
              <KpiTile
                key={metric.id}
                icon={metric.icon}
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
                tone={metric.tone}
                isActive={metric.isActive}
                onClick={() => handleKpiClick(metric.id)}
              />
            ))}
          </div>

          {/* LIST SECTION */}
          <section className="min-w-0 max-w-full space-y-3 pb-24 sm:space-y-4 sm:pb-0">

          {/* TOOLBAR */}
          <div className="sk-premium-panel min-w-0 max-w-full p-3">
            {/* Line 1: search + selects */}
            <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:flex lg:items-center">
              <label className="relative col-span-2 min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un document, une référence, un locataire..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
                />
              </label>
              <select aria-label="Sélection"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as DocumentSourceFilter)}
                className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 lg:w-[190px]"
              >
                <option value="all">Tous les documents</option>
                <option value="uploaded">Ajoutés manuellement</option>
                <option value="generated">Générés automatiquement</option>
                <option value="qr">Vérifiables QR</option>
              </select>
              <select aria-label="Sélection"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as DocumentStatusFilter)}
                className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 lg:w-[155px]"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="unclassified">À classer</option>
                <option value="review">À revoir</option>
                <option value="archived">Archivés</option>
              </select>
            </div>

            {/* Line 2: type chips */}
            <div className="scrollbar-hide -mx-1 mt-2.5 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pb-1">
              {visibleTypeFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setTypeFilter(filter.id)}
                  className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${typeFilter === filter.id
                    ? filter.id === 'noqr'
                      ? 'border-amber-700 bg-amber-700 text-white shadow-sm'
                      : 'border-emerald-950 bg-emerald-950 text-white shadow-sm'
                    : filter.id === 'noqr'
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100'
                      : 'border-emerald-950/10 bg-white text-slate-600 hover:border-emerald-800/25 hover:bg-emerald-50'
                    }`}
                >
                  {filter.label}
                  <span className="text-[10px] opacity-60">{typeFilterCounts[filter.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* DOCUMENT LIST / TABLE */}
          {loading ? (
            <SkeletonCards count={6} />
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
              <div className={`hidden xl:block`}>
                <div className="sk-table-shell overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-emerald-950/8 bg-[#faf9f5]/95">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Document</th>
                        {!drawerOpen && <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Contexte</th>}
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Période</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Statut</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Preuve</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 text-right">Date</th>
                        <th className="w-10" />
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
                            {!drawerOpen && (
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
                            {/* Statut */}
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusLabel === 'Archivé'
                                ? 'bg-slate-100 text-slate-600'
                                : statusLabel === 'À classer' || statusLabel === 'À revoir'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-800'
                                }`}>{statusLabel}</span>
                            </td>
                            {/* Preuve */}
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
                            {/* Date */}
                            <td className="px-3 py-2.5 text-right">
                              <p className="text-xs font-semibold text-slate-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</p>
                            </td>
                            {/* Chevron */}
                            <td className="px-2 py-2.5">
                              <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile + tablet: cards */}
              <div className={`xl:hidden grid min-w-0 max-w-full gap-3`}>
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
                        {...(isSelected ? { 'aria-pressed': true } : {})}
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
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700 mt-1" />
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
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 sm:text-xs">
                          <span>{formatStorageSize(item.size)}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</span>
                          {item.period && <span>{formatDocumentPeriod(item.period)}</span>}
                          {item.version && item.version > 1 && <span className="text-emerald-700 font-bold">v{item.version}</span>}
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
        <div className="xl:sticky xl:top-4 xl:self-start xl:h-[calc(100vh-2rem)] w-full">
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
