import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  Download,
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
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
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
  metadata?: { file_name?: string; [key: string]: unknown } | null;
}

interface DocumentItem {
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
}

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

const ENTITY_BY_CATEGORY: Partial<Record<UserDocumentCategory, UserDocumentEntityType>> = {
  bailleurs: 'bailleur',
  locataires: 'locataire',
  immeubles: 'immeuble',
  unites: 'unite',
  contrats: 'contrat',
};

const ENTITY_LABELS: Record<string, string> = {
  active: 'Actif',
  archived: 'Archivé',
  deleted: 'Supprimé',
  temporary: 'Temporaire',
  orphaned: 'À vérifier',
};

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
      title: 'Quota presque atteint',
      text: 'Archivez les doublons et nettoyez les temporaires avant de nouveaux uploads lourds.',
    };
  }
  if (percent >= 75) {
    return {
      tone: 'border-orange-200 bg-orange-50 text-orange-800',
      title: 'Stockage a surveiller',
      text: 'Le coffre documentaire approche de sa limite. Les fichiers critiques restent conserves.',
    };
  }
  return null;
}

function bucketValue(breakdown: StorageBreakdown | null, key: string) {
  return breakdown?.by_retention?.[key] ?? breakdown?.by_source?.[key] ?? breakdown?.by_lifecycle?.[key] ?? null;
}

function toDocumentItem(row: UserDocumentRow): DocumentItem {
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
  };
}

function registryCategory(documentType: string): UserDocumentCategory {
  if (documentType === 'contrat' || documentType === 'mandat') return 'contrats';
  if (documentType === 'rapport_bailleur' || documentType === 'export' || documentType === 'pdf') return 'exports';
  if (documentType === 'quittance' || documentType === 'facture') return 'administratif';
  return 'archives';
}

function registryToDocumentItem(row: RegistryDocumentRow): DocumentItem {
  return {
    id: row.id,
    source: 'generated',
    title: row.metadata?.file_name || row.reference,
    subtitle: `${row.document_type.replace(/_/g, ' ')} · v${row.version}${row.period ? ` · ${row.period}` : ''}`,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    size: Number(row.file_size ?? 0),
    category: registryCategory(row.document_type),
    entityType: null,
    lifecycleStatus: row.status,
    retentionPolicy: row.retention_policy ?? 'critical',
    createdAt: row.generated_at,
    reference: row.reference,
  };
}

export function Documents() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocumentItem | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<UserDocumentCategory | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'uploaded' | 'generated'>('all');
  const [entityOptions, setEntityOptions] = useState<Record<UserDocumentEntityType, EntityOption[]>>({
    agency: [],
    bailleur: [],
    locataire: [],
    immeuble: [],
    unite: [],
    contrat: [],
    operation: [],
  });

  const [form, setForm] = useState({
    file: null as File | null,
    name: '',
    category: 'administratif' as UserDocumentCategory,
    entityType: '' as UserDocumentEntityType | '',
    entityId: '',
    retentionPolicy: 'standard' as RetentionPolicy,
    description: '',
    tags: '',
  });

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [docRes, registryRes, storageUsage, storageBreakdown, bailleursRes, locatairesRes, immeublesRes, unitesRes, contratsRes] =
        await Promise.all([
          supabase
            .from('documents')
            .select(
              'id, name, file_url, storage_path, file_type, file_size, document_category, document_scope, entity_type, entity_id, lifecycle_status, retention_policy, description, created_at'
            )
            .eq('agency_id', profile.agency_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('document_registry')
            .select('id, document_type, entity_id, period, reference, version, storage_path, file_size, mime_type, status, retention_policy, generated_at, metadata')
            .eq('agency_id', profile.agency_id)
            .neq('status', 'deleted')
            .order('generated_at', { ascending: false })
            .limit(80),
          getAgencyStorageUsage(profile.agency_id),
          getAgencyStorageBreakdown(profile.agency_id),
          supabase.from('bailleurs').select('id, nom, prenom').eq('agency_id', profile.agency_id),
          supabase.from('locataires').select('id, nom, prenom').eq('agency_id', profile.agency_id),
          supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
          supabase.from('unites').select('id, nom').eq('agency_id', profile.agency_id),
          supabase.from('contrats').select('id, locataires(nom, prenom), unites(nom)').eq('agency_id', profile.agency_id),
        ]);

      if (docRes.error) throw docRes.error;
      if (registryRes.error) throw registryRes.error;

      const uploaded = ((docRes.data ?? []) as UserDocumentRow[]).map(toDocumentItem);
      const generated = ((registryRes.data ?? []) as RegistryDocumentRow[]).map(registryToDocumentItem);
      setItems([...uploaded, ...generated].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setUsage(storageUsage);
      setBreakdown(storageBreakdown);

      setEntityOptions({
        agency: [{ id: profile.agency_id, label: 'Agence' }],
        bailleur: ((bailleursRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => ({
          id: row.id,
          label: `${row.prenom ?? ''} ${row.nom}`.trim(),
        })),
        locataire: ((locatairesRes.data ?? []) as Array<{ id: string; nom: string; prenom?: string | null }>).map((row) => ({
          id: row.id,
          label: `${row.prenom ?? ''} ${row.nom}`.trim(),
        })),
        immeuble: ((immeublesRes.data ?? []) as Array<{ id: string; nom: string }>).map((row) => ({
          id: row.id,
          label: row.nom,
        })),
        unite: ((unitesRes.data ?? []) as Array<{ id: string; nom: string }>).map((row) => ({
          id: row.id,
          label: row.nom,
        })),
        contrat: ((contratsRes.data ?? []) as Array<{
          id: string;
          locataires?: { nom?: string | null; prenom?: string | null } | null;
          unites?: { nom?: string | null } | null;
        }>).map((row) => ({
          id: row.id,
          label: `${row.locataires?.prenom ?? ''} ${row.locataires?.nom ?? ''} · ${row.unites?.nom ?? 'Unité'}`.trim(),
        })),
        operation: [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement des documents impossible');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.subtitle, item.reference, DOCUMENT_CATEGORY_LABELS[item.category]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [categoryFilter, items, query, sourceFilter]);

  const categoryCounts = useMemo(() => {
    return CATEGORIES.reduce<Record<UserDocumentCategory, number>>((acc, category) => {
      acc[category] = items.filter((item) => item.category === category).length;
      return acc;
    }, {} as Record<UserDocumentCategory, number>);
  }, [items]);

  const openDocument = async (item: DocumentItem) => {
    try {
      const url = await createDocumentSignedUrl(item.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
      if (item.source === 'uploaded') {
        await supabase.from('documents').update({ last_accessed_at: new Date().toISOString() }).eq('id', item.id);
      } else {
        await supabase.from('document_registry').update({ last_accessed_at: new Date().toISOString() }).eq('id', item.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ouverture du document impossible');
    }
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.agency_id || !form.file) {
      toast.warning('Sélectionnez un fichier à archiver.');
      return;
    }

    setUploading(true);
    try {
      const inferredEntityType = form.entityType || ENTITY_BY_CATEGORY[form.category] || null;
      const tags = form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      await uploadUserDocument({
        agencyId: profile.agency_id,
        userId: user?.id,
        file: form.file,
        name: form.name,
        category: form.category,
        entityType: inferredEntityType,
        entityId: form.entityId || null,
        description: form.description,
        retentionPolicy: form.retentionPolicy,
        tags,
        relations: {
          bailleur_id: inferredEntityType === 'bailleur' ? form.entityId || null : null,
          locataire_id: inferredEntityType === 'locataire' ? form.entityId || null : null,
          immeuble_id: inferredEntityType === 'immeuble' ? form.entityId || null : null,
          unite_id: inferredEntityType === 'unite' ? form.entityId || null : null,
          contrat_id: inferredEntityType === 'contrat' ? form.entityId || null : null,
        },
      });

      toast.success('Document archivé dans la GED');
      setUploadOpen(false);
      setForm({
        file: null,
        name: '',
        category: 'administratif',
        entityType: '',
        entityId: '',
        retentionPolicy: 'standard',
        description: '',
        tags: '',
      });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const archiveDocument = async () => {
    if (!archiveTarget || archiveTarget.source !== 'uploaded') return;
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
      toast.success(total > 0 ? `${total} element(s) mis a jour` : 'Aucune action necessaire');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Maintenance documentaire impossible');
    } finally {
      setMaintenanceAction(null);
    }
  };

  const selectedEntityType = form.entityType || ENTITY_BY_CATEGORY[form.category] || '';
  const selectedEntityOptions = selectedEntityType ? entityOptions[selectedEntityType] ?? [] : [];
  const agencyId = profile?.agency_id ?? '';
  const usedPercent = Math.min(100, Number(usage?.usage_percent ?? 0));
  const currentUsageMessage = usageMessage(usedPercent);
  const uploadedBucket = bucketValue(breakdown, 'uploaded');
  const generatedBucket = bucketValue(breakdown, 'generated');
  const criticalBucket = bucketValue(breakdown, 'critical');
  const temporaryBucket = bucketValue(breakdown, 'temporary');

  return (
    <div className="sk-mobile-page space-y-4 sm:space-y-6">
      <div className="sk-mobile-hero bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-4 text-white shadow-2xl shadow-emerald-950/15 sm:p-7">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
              <LockKeyhole className="h-3.5 w-3.5 text-orange-200" />
              Coffre documentaire
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">Documents</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/75 sm:text-base">
              Archivez, retrouvez et sécurisez les documents métier de l'agence sans dupliquer inutilement les fichiers générés.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur lg:max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100/65">Stockage</p>
                <p className="mt-1 text-lg font-black">
                  {formatStorageSize(usage?.used_bytes)} <span className="text-sm font-semibold text-emerald-100/55">/ {formatStorageSize(usage?.limit_bytes)}</span>
                </p>
              </div>
              <HardDrive className="h-7 w-7 text-orange-200" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${usageTone(usedPercent)} transition-all duration-700`} style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-emerald-50/70">
              <span>Uploads {formatStorageSize(usage?.uploaded_bytes)}</span>
              <span>Générés {formatStorageSize(usage?.generated_bytes)}</span>
              <span>Archives {formatStorageSize(usage?.archived_bytes)}</span>
            </div>
          </div>
        </div>
      </div>

      {currentUsageMessage && (
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${currentUsageMessage.tone}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-black">{currentUsageMessage.title}</p>
              <p className="mt-1 text-sm font-semibold opacity-80">{currentUsageMessage.text}</p>
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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Documents actifs', value: items.filter((item) => item.lifecycleStatus === 'active').length, icon: FileCheck2 },
          { label: 'Fichiers uploadés', value: items.filter((item) => item.source === 'uploaded').length, icon: Upload },
          { label: 'Documents générés', value: items.filter((item) => item.source === 'generated').length, icon: FileText },
          { label: 'Documents critiques', value: items.filter((item) => item.retentionPolicy === 'critical').length, icon: ShieldCheck },
        ].map((metric) => (
          <div key={metric.label} className="sk-metric-tile p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="sk-premium-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Repartition stockage</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Usage documentaire</h2>
            </div>
            <BarChart3 className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Uploads utilisateurs', bucket: uploadedBucket },
              { label: 'Generes par le systeme', bucket: generatedBucket },
              { label: 'Critiques', bucket: criticalBucket },
              { label: 'Temporaires', bucket: temporaryBucket },
            ].map((entry) => (
              <div key={entry.label} className="rounded-[1.15rem] border border-emerald-950/10 bg-white/75 p-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{entry.label}</p>
                <p className="mt-1 text-base font-black text-slate-950">{formatStorageSize(entry.bucket?.bytes ?? 0)}</p>
                <p className="text-xs font-semibold text-slate-500">{entry.bucket?.count ?? 0} fichier(s)</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sk-premium-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Lifecycle management</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Maintenance non destructive</h2>
            </div>
            <RefreshCw className={`h-5 w-5 text-emerald-700 ${maintenanceAction ? 'animate-spin' : ''}`} />
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-500">
            Les documents critiques restent proteges. Les actions ci-dessous archivent ou marquent les fichiers a revoir sans supprimer brutalement les preuves.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => runMaintenance('optimize', () => optimizeDocumentStorage(agencyId))}
              disabled={maintenanceAction !== null || !agencyId}
              className="sk-action sk-action-primary justify-center disabled:opacity-60"
            >
              Optimiser
            </button>
            <button
              type="button"
              onClick={() => runMaintenance('temporary', () => cleanupTemporaryDocuments(agencyId, 30))}
              disabled={maintenanceAction !== null || !agencyId}
              className="sk-action sk-action-secondary justify-center disabled:opacity-60"
            >
              Temporaires
            </button>
            <button
              type="button"
              onClick={() => runMaintenance('orphans', () => markOrphanDocumentRecords(agencyId))}
              disabled={maintenanceAction !== null || !agencyId}
              className="sk-action sk-action-secondary justify-center disabled:opacity-60"
            >
              Orphelins
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="sk-action sk-action-financial w-full justify-center py-3"
            data-testid="button-upload-document"
          >
            <Upload className="h-4 w-4" />
            Ajouter un document
          </button>

          <div className="sk-premium-panel p-3">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-black transition ${
                categoryFilter === 'all' ? 'bg-emerald-950 text-white' : 'text-slate-700 hover:bg-emerald-50'
              }`}
            >
              <span>Tous les dossiers</span>
              <span>{items.length}</span>
            </button>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              {CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`flex min-w-[10rem] items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition lg:w-full ${
                      categoryFilter === category ? 'bg-emerald-50 text-emerald-950' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {DOCUMENT_CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-slate-400">{categoryCounts[category] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {breakdown?.large_files?.length ? (
            <div className="sk-premium-panel p-3">
              <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Fichiers lourds</p>
              <div className="mt-2 space-y-2">
                {breakdown.large_files.slice(0, 4).map((file) => (
                  <button
                    key={file.storage_path}
                    type="button"
                    onClick={() => createDocumentSignedUrl(file.storage_path).then((url) => window.open(url, '_blank', 'noopener,noreferrer')).catch(() => toast.error('Ouverture du document impossible'))}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left transition hover:border-emerald-800/20 hover:bg-emerald-50/60"
                  >
                    <p className="truncate text-sm font-black text-slate-800">{file.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatStorageSize(file.file_size)} · {DOCUMENT_CATEGORY_LABELS[normalizeCategory(file.category)]}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="space-y-4">
          <div className="sk-premium-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un contrat, justificatif, quittance..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              />
            </label>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
            >
              <option value="all">Toutes sources</option>
              <option value="uploaded">Uploads utilisateurs</option>
              <option value="generated">Documents générés</option>
            </select>
          </div>

          {loading ? (
            <SkeletonCards count={6} />
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-950/10 bg-white/90 shadow-sm">
              <EmptyState icon={FolderOpen} title="Aucun document" description="Ajustez les filtres ou archivez un premier fichier." />
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredItems.map((item) => {
                const Icon = CATEGORY_ICONS[item.category];
                return (
                  <article
                    key={`${item.source}-${item.id}`}
                    className="group sk-mobile-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-800/20 hover:shadow-premium active:scale-[0.992]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                            {DOCUMENT_CATEGORY_LABELS[item.category]}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">
                            {item.source === 'generated' ? 'Généré' : 'Upload'}
                          </span>
                          {item.retentionPolicy === 'critical' && (
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-orange-700">
                              Critique
                            </span>
                          )}
                        </div>
                        <h2 className="mt-3 truncate text-base font-black text-slate-950">{item.title}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{item.subtitle}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
                          <span>{formatStorageSize(item.size)}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</span>
                          <span>{ENTITY_LABELS[item.lifecycleStatus] ?? item.lifecycleStatus}</span>
                          {item.entityType && <span>{DOCUMENT_ENTITY_LABELS[item.entityType]}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 sm:flex sm:justify-end">
                      {item.source === 'uploaded' && item.retentionPolicy !== 'critical' && item.lifecycleStatus === 'active' && (
                        <button type="button" onClick={() => setArchiveTarget(item)} className="sk-action sk-action-secondary justify-center">
                          <Archive className="h-4 w-4" />
                          Archiver
                        </button>
                      )}
                      <button type="button" onClick={() => openDocument(item)} className="sk-action sk-action-primary justify-center">
                        <Download className="h-4 w-4" />
                        Ouvrir
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Ajouter un document">
        <form onSubmit={submitUpload} className="space-y-4">
          <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50/60 p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-800/30 bg-white px-4 py-7 text-center transition hover:border-emerald-800">
              <Upload className="h-8 w-8 text-emerald-800" />
              <span className="mt-3 text-sm font-black text-slate-950">
                {form.file ? form.file.name : 'Déposer ou sélectionner un fichier'}
              </span>
              <span className="mt-1 text-xs font-semibold text-slate-500">PDF, images, CSV ou Excel · compression image automatique · 50 Mo maximum</span>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-bold text-slate-700">Nom du document</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ex : CNI locataire, assurance immeuble..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Dossier métier</span>
              <select
                value={form.category}
                onChange={(event) => {
                  const category = event.target.value as UserDocumentCategory;
                  setForm({
                    ...form,
                    category,
                    entityType: ENTITY_BY_CATEGORY[category] ?? '',
                    entityId: '',
                  });
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {DOCUMENT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Conservation</span>
              <select
                value={form.retentionPolicy}
                onChange={(event) => setForm({ ...form, retentionPolicy: event.target.value as RetentionPolicy })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              >
                <option value="standard">Standard</option>
                <option value="critical">Critique</option>
                <option value="temporary">Temporaire</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Type de lien</span>
              <select
                value={selectedEntityType}
                onChange={(event) => setForm({ ...form, entityType: event.target.value as UserDocumentEntityType | '', entityId: '' })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              >
                <option value="">Aucun lien</option>
                {Object.entries(DOCUMENT_ENTITY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Élément lié</span>
              <select
                value={form.entityId}
                disabled={!selectedEntityType || selectedEntityOptions.length === 0}
                onChange={(event) => setForm({ ...form, entityId: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition disabled:bg-slate-50 disabled:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              >
                <option value="">{selectedEntityType ? 'Sélectionner' : 'Aucun lien'}</option>
                {selectedEntityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-bold text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="Contexte, validité, observations internes..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-bold text-slate-700">Tags</span>
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                placeholder="urgent, signé, original..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setUploadOpen(false)} className="sk-action sk-action-secondary justify-center">
              Annuler
            </button>
            <button type="submit" disabled={uploading} className="sk-action sk-action-financial justify-center disabled:opacity-60">
              {uploading ? 'Archivage...' : 'Archiver le document'}
            </button>
          </div>
        </form>
      </Modal>

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
