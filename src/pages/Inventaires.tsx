import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar, type QuickChip } from '../components/ui/PremiumToolbar';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { PageSkeleton, SkeletonTable } from '../components/ui/Skeleton';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { ClipboardList, Plus, Download, Trash2, Search, AlertTriangle, ArrowUpRight, ArrowDownRight, Building2, Layers, SlidersHorizontal, Scale } from 'lucide-react';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { formatCurrency } from '../lib/formatters';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { runDocumentGeneration } from '../lib/documentGeneration';

// Types
import { Inventaire, InventaireType, InventaireStatut } from '../types/inventaire';
import { InventaireEditor } from '../components/inventaires/InventaireEditor';
import { generateInventairePdf } from '../lib/inventairePdf';

const statutColors: Record<string, string> = {
  en_cours: 'bg-blue-100 text-blue-800',
  termine: 'bg-green-100 text-green-800',
  litige: 'bg-red-100 text-red-800',
};

type InventaireTypeFilter = 'all' | InventaireType;
type InventaireStatutFilter = 'all' | InventaireStatut;

export function Inventaires() {
  const { profile, user } = useAuth();
  const toast = useToast();

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      setIsOpenCreate(true);
    },
  });

  const [items, setItems] = useState<Inventaire[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpenCreate, setIsOpenCreate] = useState(false);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<InventaireTypeFilter>('all');
  const [filterStatut, setFilterStatut] = useState<InventaireStatutFilter>('all');
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (filterType !== 'all' ? 1 : 0) + (filterStatut !== 'all' ? 1 : 0) + (filterImmeuble !== 'all' ? 1 : 0);

  const [deleteTarget, setDeleteTarget] = useState<Inventaire | null>(null);

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [invRes, contratsRes, immRes] = await Promise.all([
        supabase
          .from('inventaires')
          .select(`*, contrats(id, locataires(nom, prenom), unites(nom, immeubles(nom, id)))`)
          .eq('agency_id', profile.agency_id)
          .order('date', { ascending: false }),
        supabase
          .from('contrats')
          .select('id, locataires(nom, prenom), unites(nom, immeubles(nom, id))')
          .eq('agency_id', profile.agency_id)
          .eq('statut', 'actif'),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
      ]);
      if (invRes.data) setItems(invRes.data as unknown as Inventaire[]);
      if (contratsRes.data) setContrats(contratsRes.data);
      if (immRes.data) setImmeubles(immRes.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const generatePDF = async (inv: Inventaire) => {
    toast.info("Génération PDF en cours...");
    try {
      await generateInventairePdf(inv, profile);
      toast.success("PDF généré !");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const updateStatut = async (id: string, statut: InventaireStatut) => {
    const { error } = await supabase.from('inventaires').update({ statut }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('inventaires').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Inventaire supprimé');
      setDeleteTarget(null);
      load();
    }
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterType !== 'all' && i.type !== filterType) return false;
      if (filterStatut !== 'all' && i.statut !== filterStatut) return false;
      if (filterImmeuble !== 'all' && i.contrats?.unites?.immeubles?.id !== filterImmeuble) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const loc = `${i.contrats?.locataires?.prenom ?? ''} ${i.contrats?.locataires?.nom ?? ''}`.toLowerCase();
        const bien = `${i.contrats?.unites?.immeubles?.nom ?? ''} ${i.contrats?.unites?.nom ?? ''}`.toLowerCase();
        if (!loc.includes(q) && !bien.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterType, filterStatut, filterImmeuble, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      entrees: items.filter((i) => i.type === 'entree').length,
      sorties: items.filter((i) => i.type === 'sortie').length,
      litiges: items.filter((i) => i.statut === 'litige').length,
    };
  }, [items]);

  const ALL_COLUMN_KEYS_INVENTAIRES = ['date', 'type', 'contrat', 'pieces', 'statut', 'actions'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('inventaires', [...ALL_COLUMN_KEYS_INVENTAIRES]);

  const allColumns = [
    {
      key: 'date',
      label: 'Date constat',
      render: (i: Inventaire) => (
        <span className="text-xs font-semibold text-slate-800">
          {new Date(i.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (i: Inventaire) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            i.type === 'entree'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs'
              : i.type === 'sortie' ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-2xs'
              : 'bg-amber-50 text-amber-800 border-amber-200/80'
          }`}
        >
          {i.type === 'entree' ? <ArrowDownRight className="w-3.5 h-3.5" /> : i.type === 'sortie' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Scale className="w-3.5 h-3.5" />}
          {i.type.charAt(0).toUpperCase() + i.type.slice(1)}
        </span>
      ),
    },
    {
      key: 'contrat',
      label: 'Locataire & Bien',
      render: (i: Inventaire) => {
        const prenom = i.contrats?.locataires?.prenom ?? '';
        const nom = i.contrats?.locataires?.nom ?? '';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {`${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || 'L'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">{prenom} {nom}</p>
              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                {i.contrats?.unites?.immeubles?.nom ?? 'Immeuble'} – {i.contrats?.unites?.nom ?? 'Unité'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'pieces',
      label: 'Inspection',
      render: (i: Inventaire) => {
        const nbPieces = Array.isArray(i.pieces) ? i.pieces.length : 0;
        const retenue = Number(i.caution_retenue) || 0;
        return (
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <Layers className="w-3 h-3 text-slate-500" />
              {nbPieces} pièce(s)
            </span>
            {retenue > 0 ? (
              <div className="text-[11px] font-bold text-amber-700">Retenue: {formatCurrency(retenue)}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (i: Inventaire) => (
        <select
          value={i.statut}
          onChange={(e) => updateStatut(i.id, e.target.value as Inventaire['statut'])}
          className={`text-[11px] font-bold px-3 py-1 rounded-full border cursor-pointer outline-none ${statutColors[i.statut]}`}
        >
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé & signé</option>
          <option value="litige">Litige ou réserve</option>
        </select>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (i: Inventaire) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const bienId = i.contrats?.unites?.immeubles?.id || '';
              // Collect elements in bad state
              const badElements = (i.pieces || []).flatMap(p => 
                (p.elements || []).filter(e => e.etat === 'a_reparer' || e.etat === 'degrade')
                  .map(e => `${p.nom} - ${e.nom}: ${e.observations}`)
              );
              const desc = badElements.join('\n') || 'Signalement depuis état des lieux';
              window.location.href = `/interventions?bienId=${bienId}&description=${encodeURIComponent(desc)}`;
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-orange-200/80 bg-orange-50/50 text-orange-800 hover:bg-orange-100/70 transition shadow-2xs"
            title="Signaler un incident"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Incident
          </button>
          <button
            type="button"
            onClick={() => generatePDF(i)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/70 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteTarget(i);
              if (confirm('Voulez-vous supprimer cet EDL ?')) confirmDelete(); // Simple native confirm for now
            }}
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-red-200/70 text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const columns = allColumns.filter((c) => c.key === 'actions' || colIsVisible(c.key));

  const quickChips: QuickChip[] = useMemo(() => [
    { id: 'all', label: 'Tous', count: items.length, isActive: filterType === 'all' && filterStatut === 'all', onClick: () => { setFilterType('all'); setFilterStatut('all'); } },
    { id: 'entree', label: 'Entrées', count: stats.entrees, isActive: filterType === 'entree', onClick: () => setFilterType(filterType === 'entree' ? 'all' : 'entree') },
    { id: 'sortie', label: 'Sorties', count: stats.sorties, isActive: filterType === 'sortie', onClick: () => setFilterType(filterType === 'sortie' ? 'all' : 'sortie') },
    { id: 'litige', label: 'En litige', count: stats.litiges, isActive: filterStatut === 'litige', onClick: () => setFilterStatut(filterStatut === 'litige' ? 'all' : 'litige') },
  ], [items.length, stats, filterType, filterStatut]);

  if (loading && items.length === 0) return <PageSkeleton title="États des lieux" variant="table" />;

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3">
      <PremiumPageHeader
        density="compact"
        eyebrow="OPÉRATIONS TERRAIN"
        title="États des lieux"
        description="Préparez, suivez et archivez les inventaires détaillés d'entrée et de sortie."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsOpenCreate(true)} icon={<Plus className="h-4 w-4" />}>
            Nouvel inventaire
          </PremiumButton>
        }
      />

      <PremiumKpiGrid density="compact">
        <MetricCard density="compact" label="Total états des lieux" value={stats.total} icon={ClipboardList} tone="emerald" />
        <MetricCard density="compact" label="Entrées" value={stats.entrees} icon={ArrowDownRight} tone="blue" />
        <MetricCard density="compact" label="Sorties" value={stats.sorties} icon={ArrowUpRight} tone="green" />
        <MetricCard density="compact" label="En litige" value={stats.litiges} icon={AlertTriangle} tone="amber" />
      </PremiumKpiGrid>

      <PremiumToolbar
        density="compact"
        ariaLabel="Filtres des états des lieux"
        quickChips={quickChips}
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par locataire, immeuble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-2.5 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none"
              />
            </div>
          </div>
        }
        filters={
          <div className="hidden lg:flex min-w-0 items-center gap-2">
            <SmartCombobox value={filterType} options={[{ value: 'all', label: 'Tous types' }, { value: 'entree', label: 'Entrée' }, { value: 'intermediaire', label: 'Intermédiaire' }, { value: 'sortie', label: 'Sortie' }]} onChange={(val) => setFilterType((val || 'all') as InventaireTypeFilter)} placeholder="Type" className="w-36" density="compact" />
            <SmartCombobox value={filterStatut} options={[{ value: 'all', label: 'Tous statuts' }, { value: 'en_cours', label: 'En cours' }, { value: 'termine', label: 'Terminé' }, { value: 'litige', label: 'Litige' }]} onChange={(val) => setFilterStatut((val || 'all') as InventaireStatutFilter)} placeholder="Statut" className="w-40" density="compact" />
          </div>
        }
        secondaryActions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowFilters(true)} className="lg:hidden inline-flex h-8 items-center justify-center gap-1.5 rounded-[0.6rem] border px-3 py-1.5 text-xs font-bold shadow-sm border-slate-200 bg-white"><SlidersHorizontal className="h-3.5 w-3.5" /> Filtres</button>
            <ColumnPicker columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))} visibility={colVis} onToggle={colToggle} onSetAll={colSetAll} className="!h-8 hidden lg:inline-flex" />
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-4 sm:p-6"><SkeletonTable rows={6} cols={5} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState bare icon={ClipboardList} title="Aucun inventaire" description="Créez votre premier état des lieux." action={{ label: 'Nouvel inventaire', onClick: () => setIsOpenCreate(true) }} />
        ) : (
          <Table data={filtered} columns={columns} />
        )}
      </div>

      <InventaireEditor 
        isOpen={isOpenCreate} 
        onClose={() => { setIsOpenCreate(false); clearDirectRouteParams(); }} 
        onSuccess={() => { setIsOpenCreate(false); load(); }} 
        contrats={contrats}
        agencyId={profile?.agency_id || ''}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
