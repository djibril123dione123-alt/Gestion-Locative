import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
// import { Button } from '../components/ui/Button';
import { Plus, Search, XCircle, Pencil, SlidersHorizontal, TrendingDown, ReceiptText, Wallet, Building2 } from 'lucide-react';
import { CompactFinanceKpiGrid } from '../components/finance/FinancePrimitives';
import { CompactSection, CompactLabelValue } from '../components/ui/CompactSection';
import { DepenseFormModal, type DepenseFormData, type DepenseImmeubleOption } from '../components/finance/DepenseFormModal';
import { FinanceReasonModal } from '../components/finance/FinanceReasonModal';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { ToastContainer } from '../components/ui/Toast';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton, SkeletonCards, SkeletonTable } from '../components/ui/Skeleton';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { EmptyState } from '../components/ui/EmptyState';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { cancelDepenseViaRpc, createDepenseViaRpc, updateDepenseViaRpc } from '../services/api/financeApi';
import { buildMonthFilterOptions, resolveMonthFilter } from '../lib/monthFilters';

const EXPENSE_CATEGORIES = [
  'Maintenance',
  'Électricité',
  'Eau',
  'Salaires',
  'Transport',
  'Télécommunications',
  'Internet',
  'Autres',
];

interface Depense {
  id: string;
  montant: number;
  date_depense: string;
  categorie: string;
  description: string | null;
  beneficiaire: string | null;
  immeuble_id: string | null;
  piece_justificative?: string | null;
  immeubles?: { nom?: string | null } | null;
}

export function Depenses() {
  const { profile } = useAuth();

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      setEditingDepense(null);
      const bienId = params.get('bienId');
      setFormData((prev) => ({
        ...prev,
        immeuble_id: bienId || prev.immeuble_id,
      }));
      setIsModalOpen(true);
    },
    onSelectId: (id) => {
      const match = depenses.find((d) => d.id === id);
      if (match) setSelectedDepense(match);
    },
  });

  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [filtered, setFiltered] = useState<Depense[]>([]);
  const [immeubles, setImmeubles] = useState<DepenseImmeubleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [selectedDepense, setSelectedDepense] = useState<Depense | null>(null);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Depense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMois, setSelectedMois] = useState('current');
  const [selectedCategorie, setSelectedCategorie] = useState('');
  const [selectedImmeuble, setSelectedImmeuble] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toast = useToast();
  const notifyError = toast.error;
  const submittingRef = useRef(false);
  const filterCategories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...depenses.map((depense) => depense.categorie).filter(Boolean)])),
    [depenses],
  );
  const monthOptions = useMemo(
    () => buildMonthFilterOptions(depenses.map((depense) => depense.date_depense)),
    [depenses],
  );

  const [formData, setFormData] = useState<DepenseFormData>({
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    categorie: 'Maintenance',
    description: '',
    beneficiaire: '',
    immeuble_id: '',
    piece_justificative: '',
    affectation: 'agence',
  });

  useEffect(() => {
    const q = searchTerm.toLowerCase();
    const targetMonth = resolveMonthFilter(selectedMois);
    setFiltered(
      depenses.filter((d) => {
        const searchable = [
          d.description,
          d.categorie,
          d.immeubles?.nom,
          d.montant != null ? String(d.montant) : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(q)
          && (!targetMonth || d.date_depense.slice(0, 7) === targetMonth)
          && (!selectedCategorie || d.categorie === selectedCategorie)
          && (!selectedImmeuble || d.immeuble_id === selectedImmeuble);
      }),
    );
  }, [depenses, searchTerm, selectedCategorie, selectedImmeuble, selectedMois]);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    if (depenses.length === 0) setLoading(true);
    try {
      const result = await readWithCache<{ depenses: Depense[]; immeubles: DepenseImmeubleOption[] }>(
        { agencyId: profile.agency_id, userId: profile.id },
        'depenses-page',
        async () => {
          const [depensesRes, immeublesRes] = await Promise.all([
            supabase
              .from('depenses')
              .select('*, immeubles(nom)')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .is('deleted_at', null)
              .order('created_at', { ascending: false }),
            supabase.from('immeubles').select('id, nom, bailleurs(id, nom, prenom)').eq('agency_id', profile.agency_id).eq('actif', true),
          ]);
          if (depensesRes.error) throw depensesRes.error;
          if (immeublesRes.error) throw immeublesRes.error;
          return {
            depenses: (depensesRes.data || []) as Depense[],
            immeubles: (immeublesRes.data || []) as unknown as DepenseImmeubleOption[],
          };
        },
        { timeoutMs: 7_000 }
      );

      setDepenses(result.data.depenses);
      setFiltered(result.data.depenses);
      setImmeubles(result.data.immeubles);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      console.error('Erreur:', error);
      notifyError('Dépenses indisponibles hors connexion sans cache local.');
    } finally {
      setLoading(false);
    }
  }, [depenses.length, notifyError, profile?.agency_id, profile?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [loadData, profile?.agency_id]);

  const handleSubmit = async () => {
    if (!profile?.agency_id || submittingRef.current) return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : enregistrement impossible hors ligne.');
      return;
    }
    const montant = Number(formData.montant);
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error('Le montant doit être supérieur à 0 F CFA.');
      return;
    }
    if (formData.affectation === 'bien' && !formData.immeuble_id) {
      toast.error('Sélectionnez le bien concerné par cette dépense.');
      return;
    }

    submittingRef.current = true;
    setIsSaving(true);
    try {
      const data = {
        montant,
        date_depense: formData.date_depense,
        categorie: formData.categorie,
        description: formData.description,
        beneficiaire: formData.beneficiaire,
        immeuble_id: formData.affectation === 'bien' ? formData.immeuble_id || null : null,
        piece_justificative: formData.piece_justificative || null,
      };

      if (editingDepense) {
        await updateDepenseViaRpc({
          id: editingDepense.id,
          agency_id: profile.agency_id,
          ...data,
        });
      } else {
        await createDepenseViaRpc({
          agency_id: profile.agency_id,
          ...data,
        });
      }

      closeModal();
      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'depenses', 'finances'],
      );
      notifyDataChanged(['depenses', 'dashboard', 'finances']);
      await loadData();
      toast.success(editingDepense ? 'Dépense mise à jour' : 'Dépense enregistrée');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleEdit = (depense: Depense) => {
    setEditingDepense(depense);
    setFormData({
      montant: depense.montant.toString(),
      date_depense: depense.date_depense,
      categorie: depense.categorie,
      description: depense.description ?? '',
      beneficiaire: depense.beneficiaire ?? '',
      immeuble_id: depense.immeuble_id || '',
      piece_justificative: depense.piece_justificative || '',
      affectation: depense.immeuble_id ? 'bien' : 'agence',
    });
    setSelectedDepense(null);
    setIsModalOpen(true);
  };

  const handleDelete = (depense: Depense) => {
    if (!profile?.agency_id) return;
    setDeleteTarget(depense);
  };

  const confirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    if (!profile?.agency_id || !profile.id) return;
    const agencyId = profile.agency_id;
    const userId = profile.id;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : annulation impossible hors ligne.');
      return;
    }
    setDeleting(true);
    try {
      await cancelDepenseViaRpc({
        agencyId,
        id: deleteTarget.id,
        reason,
      });
      toast.success('Dépense annulée');
      setDeleteTarget(null);
      await invalidateOperationalCaches(
        { agencyId, userId },
        ['dashboard', 'depenses', 'finances'],
      );
      notifyDataChanged(['depenses', 'dashboard', 'finances']);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepense(null);
    setFormData({
      montant: '',
      date_depense: new Date().toISOString().split('T')[0],
      categorie: 'Maintenance',
      description: '',
      beneficiaire: '',
      immeuble_id: '',
      piece_justificative: '',
      affectation: 'agence',
    });
    clearDirectRouteParams();
  };

  const openCreateModal = () => {
    setEditingDepense(null);
    setFormData({
      montant: '',
      date_depense: new Date().toISOString().split('T')[0],
      categorie: 'Maintenance',
      description: '',
      beneficiaire: '',
      immeuble_id: '',
      piece_justificative: '',
      affectation: 'agence',
    });
    setIsModalOpen(true);
  };

  const ALL_COLUMN_KEYS_DEPENSES = ['date_depense', 'categorie', 'montant', 'statut'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('depenses', [...ALL_COLUMN_KEYS_DEPENSES]);

  const allColumns = [
    {
      key: 'categorie',
      label: 'Catégorie',
      render: (d: Depense) => (
        <div className="min-w-0">
          <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">{d.categorie}</p>
          <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-0.5">
            {d.beneficiaire || d.description || '—'} · {d.immeubles?.nom || 'Général'}
          </p>
        </div>
      ),
    },
    { key: 'date_depense', label: 'Date', render: (d: Depense) => <span className="whitespace-nowrap text-[0.7rem] font-medium text-slate-600">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</span> },
    { key: 'montant', label: 'Montant', render: (d: Depense) => <span className="whitespace-nowrap text-[0.72rem] font-semibold tabular-nums"><MoneyText value={d.montant} className={`font-semibold ${Number(d.montant || 0) > 0 ? 'text-emerald-800' : 'text-slate-400'}`} /></span> },
    { key: 'statut', label: 'Statut', render: () => <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 whitespace-nowrap"><ReceiptText className="h-3 w-3" /> Enregistrée</span> },
  ];
  const columns = allColumns.filter((c) => {
    if (!colIsVisible(c.key)) return false;
    if (selectedDepense && c.key === 'date_depense') return false;
    return true;
  });
  const kpis = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const depensesMois = filtered
      .filter((d) => d.date_depense.slice(0, 7) === currentMonth)
      .reduce((sum, d) => sum + d.montant, 0);
    const depensesActives = filtered.length;
    const depensesAgence = filtered
      .filter((d) => !d.immeuble_id)
      .reduce((sum, d) => sum + d.montant, 0);
    const depensesBailleurs = filtered
      .filter((d) => d.immeuble_id)
      .reduce((sum, d) => sum + d.montant, 0);
    const biensConcernes = new Set(filtered.filter((d) => d.immeuble_id).map((d) => d.immeuble_id)).size;

    return {
      depensesMois,
      depensesActives,
      depensesAgence,
      depensesBailleurs,
      biensConcernes,
      netApresDepenses: 0,
    };
  }, [filtered]);

  const quickChips = useMemo(() => [
    { id: 'toutes', label: 'Toutes', count: depenses.length, isActive: !selectedCategorie && !selectedImmeuble, onClick: () => { setSelectedCategorie(''); setSelectedImmeuble(''); } },
    { id: 'maint', label: 'Maintenance', count: depenses.filter(d => d.categorie === 'Maintenance').length, isActive: selectedCategorie === 'Maintenance', onClick: () => setSelectedCategorie(selectedCategorie === 'Maintenance' ? '' : 'Maintenance') },
    { id: 'elec', label: 'Électricité / Eau', count: depenses.filter(d => d.categorie === 'Électricité' || d.categorie === 'Eau').length, isActive: selectedCategorie === 'Électricité' || selectedCategorie === 'Eau', onClick: () => setSelectedCategorie(selectedCategorie === 'Électricité' ? '' : 'Électricité') },
    { id: 'salaires', label: 'Salaires', count: depenses.filter(d => d.categorie === 'Salaires').length, isActive: selectedCategorie === 'Salaires', onClick: () => setSelectedCategorie(selectedCategorie === 'Salaires' ? '' : 'Salaires') },
  ], [depenses, selectedCategorie, selectedImmeuble]);

  const financeMetrics = useMemo(() => [
    {
      label: 'Dépenses',
      value: <MoneyText value={kpis.depensesMois} compact />,
      helper: 'Période active',
      icon: TrendingDown,
      tone: 'red' as const,
    },
    {
      label: 'Écritures',
      value: kpis.depensesActives,
      helper: 'Nombre total',
      icon: ReceiptText,
      tone: 'slate' as const,
    },
    {
      label: 'Agence',
      value: <MoneyText value={kpis.depensesAgence} compact />,
      helper: 'Fonds propres',
      icon: Wallet,
      tone: 'amber' as const,
    },
    {
      label: 'Bailleurs',
      value: <MoneyText value={kpis.depensesBailleurs} compact />,
      helper: 'Imputables',
      icon: Building2,
      tone: 'emerald' as const,
    },
    {
      label: 'Biens',
      value: kpis.biensConcernes,
      helper: 'Concernés',
      icon: Building2,
      tone: 'blue' as const,
    },
    {
      label: 'Net',
      value: <MoneyText value={kpis.netApresDepenses} compact />,
      helper: 'Après dépenses',
      icon: TrendingDown,
      tone: 'slate' as const,
    },
  ], [kpis]);

  const displayedMetrics = useMemo(() => {
    if (selectedDepense) {
      return financeMetrics.filter((m) => m.label !== 'Biens' && m.label !== 'Net');
    }
    return financeMetrics;
  }, [financeMetrics, selectedDepense]);

  if (loading && depenses.length === 0) {
    return <PageSkeleton title="Dépenses" variant="table" />;
  }

  return (
    <PageShell spacing="compact" variant="dataDense" tone="paper" verticalInset="compact">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <SplitViewShell
        size="compact"
        desktopAt="lg"
        detailClassName="lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]"
        isDetailOpen={Boolean(selectedDepense)}
        main={
          <div className="space-y-4">
            {cacheTimestamp && (
              <OfflineDataNotice
                cachedAt={cacheTimestamp}
                onRetry={loadData}
                message="Les dépenses affichées viennent du dernier chargement réussi. Les écritures financières restent bloquées hors ligne."
              />
            )}

            <PremiumPageHeader
              density="compact"
              eyebrow="CHARGES & EXPLOITATION"
              title="Dépenses"
              description="Charges et corrections contrôlées."
              mobileDescription="Suivi des charges."
              primaryAction={
                <PremiumButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
                  Nouvelle dépense
                </PremiumButton>
              }
            />

            {loading ? (
              <SkeletonCards count={4} />
            ) : (
              <CompactFinanceKpiGrid metrics={displayedMetrics} />
            )}

            <PremiumToolbar
              density="compact"
              layout="list"
              ariaLabel="Filtres des dépenses"
              isSplitOpen={Boolean(selectedDepense)}
              quickChips={quickChips}
              search={
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher une charge, un bénéficiaire..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-2.5 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[0.6rem] border border-slate-200 bg-[#fffdf8] px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60 lg:hidden"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtres
                  </button>
                </div>
              }
              filters={
                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <SmartCombobox
                    value={selectedMois}
                    options={monthOptions}
                    onChange={setSelectedMois}
                    placeholder="Période"
                    searchPlaceholder="Rechercher un mois"
                    className={`shrink-0 ${selectedDepense ? 'w-32' : 'w-40'}`}
                    density="compact"
                  />
                  <SmartCombobox
                    value={selectedCategorie}
                    options={[
                      { value: '', label: 'Catégories' },
                      ...filterCategories.map((category) => ({ value: category, label: category }))
                    ]}
                    onChange={setSelectedCategorie}
                    placeholder="Catégories"
                    searchPlaceholder="Rechercher..."
                    className={`shrink-0 ${selectedDepense ? 'hidden xl:block xl:w-32' : 'w-44'}`}
                    density="compact"
                  />
                  <SmartCombobox
                    value={selectedImmeuble}
                    options={[
                      { value: '', label: 'Affectations' },
                      ...immeubles.map((i) => ({ value: i.id, label: i.nom }))
                    ]}
                    onChange={setSelectedImmeuble}
                    placeholder="Affectations"
                    searchPlaceholder="Rechercher..."
                    className={`shrink-0 ${selectedDepense ? 'hidden xl:block xl:w-32' : 'w-44'}`}
                    density="compact"
                  />
                  <ColumnPicker
                    columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
                    visibility={colVis}
                    onToggle={colToggle}
                    onSetAll={colSetAll}
                    className={`!h-8 !rounded-[0.6rem] !px-2.5 !py-1 !text-xs ${selectedDepense ? 'hidden' : ''}`}
                  />
                </div>
              }
            />

            <MobileFilterSheet
              isOpen={mobileFiltersOpen}
              title="Filtres Dépenses"
              onClose={() => setMobileFiltersOpen(false)}
              onReset={() => {
                setSelectedMois('current');
                setSelectedCategorie('');
                setSelectedImmeuble('');
              }}
            >
              <div className="grid gap-3">
                <SmartCombobox
                  value={selectedMois}
                  options={monthOptions}
                  onChange={setSelectedMois}
                  placeholder="Période"
                  searchPlaceholder="Rechercher un mois"
                />
                <SmartCombobox
                  value={selectedCategorie}
                  options={[
                    { value: '', label: 'Catégories' },
                    ...filterCategories.map((category) => ({ value: category, label: category }))
                  ]}
                  onChange={setSelectedCategorie}
                  placeholder="Catégories"
                  searchPlaceholder="Rechercher..."
                />
                <SmartCombobox
                  value={selectedImmeuble}
                  options={[
                    { value: '', label: 'Affectations' },
                    ...immeubles.map((i) => ({ value: i.id, label: i.nom }))
                  ]}
                  onChange={setSelectedImmeuble}
                  placeholder="Affectations"
                  searchPlaceholder="Rechercher..."
                />
              </div>
            </MobileFilterSheet>

            {loading ? (
              <PremiumTableSurface density="compact" ariaLabel="Chargement des dépenses">
                <div className="p-4 sm:p-6">
                  <SkeletonTable rows={6} cols={6} />
                </div>
              </PremiumTableSurface>
            ) : filtered.length === 0 ? (
              <PremiumTableSurface density="compact" ariaLabel="Aucune dépense">
                <div className="p-6">
                  <EmptyState
                    icon={ReceiptText}
                    title={
                      !selectedCategorie && !selectedImmeuble && !searchTerm
                        ? 'Aucune dépense enregistrée'
                        : 'Aucun résultat'
                    }
                    description={
                      !selectedCategorie && !selectedImmeuble && !searchTerm
                        ? 'Commencez par enregistrer votre première charge ou dépense.'
                        : 'Essayez un autre filtre ou élargissez votre recherche.'
                    }
                    action={
                      !selectedCategorie && !selectedImmeuble && !searchTerm
                        ? { label: 'Nouvelle dépense', onClick: openCreateModal }
                        : undefined
                    }
                  />
                </div>
              </PremiumTableSurface>
            ) : (
              <PremiumTableSurface density="compact" ariaLabel="Table des dépenses">
                <Table
                  compact
                  columns={columns}
                  data={filtered}
                  onRowClick={(d) => setSelectedDepense(d)}
                  selectedId={selectedDepense?.id}
                  mobileRender={(d) => {
                    return (
                      <PremiumMobileCard
                        title={d.categorie}
                        subtitle={d.description || d.beneficiaire || 'Dépense enregistrée'}
                        icon={ReceiptText}
                        amount={d.montant}
                        amountLabel="Montant"
                        amountTone="slate"
                        amountCompact
                        meta={[
                          { label: 'Date', value: new Date(d.date_depense).toLocaleDateString('fr-FR') },
                          { label: 'Affectation', value: d.immeubles?.nom || 'Général' },
                        ]}
                        selected={selectedDepense?.id === d.id}
                        onClick={() => setSelectedDepense(d)}
                        density="compact"
                        emphasis="identity"
                      />
                    );
                  }}
                />
              </PremiumTableSurface>
            )}
          </div>
        }
        detail={
          selectedDepense ? (
            <PremiumDrawerShell
              open
              size="compact"
              desktopMode="floating"
              desktopAt="lg"
              density="compact"
              eyebrow="CHARGES & EXPLOITATION"
              title="DÉPENSE ENREGISTRÉE"
              description={
                <div className="space-y-1">
                  <p className="text-base font-black tracking-tight text-slate-950">
                    <MoneyText value={selectedDepense.montant} />
                  </p>
                  <p className="truncate text-[0.72rem] font-semibold text-slate-500">
                    {selectedDepense.categorie} · {selectedDepense.immeubles?.nom || 'Général'}
                  </p>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Enregistrée · {new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              }
              onClose={() => {
                setSelectedDepense(null);
                clearDirectRouteParams();
              }}
              actions={
                selectedDepense.piece_justificative ? (
                  <a
                    href={selectedDepense.piece_justificative}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[0.6rem] bg-emerald-700 px-3 text-[0.72rem] font-bold text-white shadow-sm transition hover:bg-emerald-800"
                  >
                    <ReceiptText className="h-3.5 w-3.5" /> Voir justificatif
                  </a>
                ) : (
                  <PremiumButton variant="secondary" size="sm" icon={<ReceiptText className="h-3.5 w-3.5" />} disabled className="!h-8 !text-[0.72rem]" fullWidth>
                    Aucun justificatif
                  </PremiumButton>
                )
              }
              bodyClassName="space-y-2"
            >
              <CompactSection title="Résumé">
                <CompactLabelValue label="Montant" value={<MoneyText value={selectedDepense.montant} className="font-black text-emerald-800" />} />
                <CompactLabelValue label="Date" value={new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')} />
                <CompactLabelValue label="Catégorie" value={selectedDepense.categorie} />
              </CompactSection>

              <CompactSection title="Affectation & description">
                <CompactLabelValue
                  label="Bien / Immeuble"
                  value={
                    selectedDepense.immeuble_id ? (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `#/patrimoine?id=${selectedDepense.immeuble_id}`; }}
                        className="font-bold text-brand-700 hover:text-brand-900 hover:underline transition"
                      >
                        {selectedDepense.immeubles?.nom || 'Bien immobilier'} &rarr;
                      </button>
                    ) : (
                      selectedDepense.immeubles?.nom || 'Général (non affecté)'
                    )
                  }
                />
                <CompactLabelValue label="Bénéficiaire" value={selectedDepense.beneficiaire || '—'} />
                <CompactLabelValue label="Description" value={selectedDepense.description || '—'} />
              </CompactSection>

              <CompactSection title="Justificatif">
                {selectedDepense.piece_justificative ? (
                  <a
                    href={selectedDepense.piece_justificative}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100/80"
                  >
                    <span className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-emerald-700" />
                      <span>Document justificatif attaché</span>
                    </span>
                    <span className="underline font-black">Ouvrir</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                    <ReceiptText className="h-4 w-4" /> Aucun justificatif référencé
                  </div>
                )}
              </CompactSection>

              <CompactSection title="Impact financier">
                <CompactLabelValue label="Déduction loyer" value="Non applicable" />
                <CompactLabelValue label="À la charge de" value={selectedDepense.immeuble_id ? 'Bailleur' : 'Agence'} />
              </CompactSection>

              <CompactSection title="Historique">
                <div className="text-[0.72rem] text-slate-500 space-y-2 pt-1">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0">
                    <span className="font-bold text-slate-700">Écriture financière créée</span>
                    <span className="font-semibold text-slate-500">{new Date(selectedDepense.date_depense).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </CompactSection>

              <CompactSection title="Actions contrôlées">
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <PremiumButton
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => handleEdit(selectedDepense)}
                    className="!h-8 !text-[0.72rem]"
                    fullWidth
                  >
                    Modifier
                  </PremiumButton>
                  <PremiumButton
                    variant="danger"
                    size="sm"
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    onClick={() => {
                      handleDelete(selectedDepense);
                      setSelectedDepense(null);
                    }}
                    className="!h-8 !text-[0.72rem]"
                    fullWidth
                  >
                    Annuler
                  </PremiumButton>
                </div>
              </CompactSection>
            </PremiumDrawerShell>
          ) : null
        }
      />

      <DepenseFormModal
        isOpen={isModalOpen}
        editing={Boolean(editingDepense)}
        formData={formData}
        setFormData={setFormData}
        immeubles={immeubles}
        isSaving={isSaving}
        originalAmount={editingDepense?.montant}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <FinanceReasonModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Annuler la dépense"
        description="Cette opération restera consultable dans l’historique sécurisé."
        warning="La dépense sera marquée annulée et retirée des vues actives, sans effacement de sa trace."
        confirmLabel="Confirmer l’annulation"
        isLoading={deleting}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Montant</p>
            <p className="mt-1 text-base font-black text-slate-950"><MoneyText value={deleteTarget?.montant ?? 0} /></p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Catégorie</p>
            <p className="mt-1 text-sm font-black text-slate-950">{deleteTarget?.categorie || '—'}</p>
          </div>
        </div>
      </FinanceReasonModal>
    </PageShell>
  );
}
