import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
// import { Button } from '../components/ui/Button';
import { Plus, Search, XCircle, Pencil, SlidersHorizontal, TrendingDown, ReceiptText, Wallet, Building2 } from 'lucide-react';
import { FinanceDrawer, FinanceInfoCard, FinanceLine, FinancePageHeader, FinanceKpiGrid } from '../components/finance/FinancePrimitives';
import { DepenseFormModal, type DepenseFormData, type DepenseImmeubleOption } from '../components/finance/DepenseFormModal';
import { FinanceReasonModal } from '../components/finance/FinanceReasonModal';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { cancelDepenseViaRpc, createDepenseViaRpc, updateDepenseViaRpc } from '../services/api/financeApi';

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
  const toast = useToast();
  const notifyError = toast.error;
  const submittingRef = useRef(false);
  const filterCategories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...depenses.map((depense) => depense.categorie).filter(Boolean)])),
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
        return searchable.includes(q);
      }),
    );
  }, [searchTerm, depenses]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    if (!profile?.agency_id || submittingRef.current) return;
    e.preventDefault();
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

  const ALL_COLUMN_KEYS_DEPENSES = ['date_depense', 'categorie', 'montant', 'immeuble', 'beneficiaire', 'statut'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('depenses', [...ALL_COLUMN_KEYS_DEPENSES]);

  const allColumns = [
    { key: 'date_depense', label: 'Date', render: (d: Depense) => <span className="whitespace-nowrap">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</span> },
    { key: 'categorie', label: 'Catégorie', render: (d: Depense) => <span className="whitespace-nowrap font-medium text-slate-800">{d.categorie}</span> },
    { key: 'montant', label: 'Montant', render: (d: Depense) => <span className="whitespace-nowrap font-black text-emerald-800"><MoneyText value={d.montant} /></span> },
    { key: 'immeuble', label: 'Affectation', render: (d: Depense) => <span className="truncate max-w-[150px] inline-block">{d.immeubles?.nom || 'Général'}</span> },
    { key: 'beneficiaire', label: 'Bénéficiaire / Desc.', render: (d: Depense) => <div className="truncate max-w-[180px] text-slate-600 font-medium">{d.beneficiaire || d.description || '—'}</div> },
    { key: 'statut', label: 'Statut', render: () => <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 whitespace-nowrap"><ReceiptText className="h-3 w-3" /> Enregistrée</span> },
  ];
  const columns = allColumns.filter((c) => {
    if (!colIsVisible(c.key)) return false;
    if (selectedDepense && (c.key === 'categorie' || c.key === 'beneficiaire')) return false;
    return true;
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedMois, setSelectedMois] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState('');
  const [selectedImmeuble, setSelectedImmeuble] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const financeMetrics = useMemo(() => [
    {
      label: 'Dépenses du mois',
      value: <MoneyText value={kpis.depensesMois} />,
      helper: 'Mois en cours',
      icon: TrendingDown,
      tone: 'red' as const,
    },
    {
      label: 'Dépenses actives',
      value: kpis.depensesActives,
      helper: 'Écritures',
      icon: ReceiptText,
      tone: 'slate' as const,
    },
    {
      label: 'Dépenses agence',
      value: <MoneyText value={kpis.depensesAgence} />,
      helper: 'Sur fonds propres',
      icon: Wallet,
      tone: 'amber' as const,
    },
    {
      label: 'Dépenses bailleurs',
      value: <MoneyText value={kpis.depensesBailleurs} />,
      helper: 'Imputables aux biens',
      icon: Building2,
      tone: 'emerald' as const,
    },
    {
      label: 'Biens concernés',
      value: kpis.biensConcernes,
      helper: 'Immeubles / Unités',
      icon: Building2,
      tone: 'blue' as const,
    },
    {
      label: 'Net après dépenses',
      value: <MoneyText value={kpis.netApresDepenses} />,
      helper: 'Calcul global',
      icon: TrendingDown,
      tone: 'slate' as const,
    },
  ], [kpis]);

  if (loading) return <PageSkeleton title="Dépenses" variant="table" />;

  return (
    <div className="flex min-h-full">
      <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedDepense ? 'hidden xl:block xl:pr-[31.5rem]' : ''}`}>
        <section className="sk-page-shell space-y-6">
          <OfflineDataNotice
            cachedAt={cacheTimestamp}
            onRetry={loadData}
            message="Les dépenses affichées viennent du dernier chargement réussi. Les écritures financières restent bloquées hors ligne."
          />
          <FinancePageHeader
            eyebrow="CHARGES & EXPLOITATION"
            title="Dépenses"
            description="Suivez les charges, frais d’exploitation, dépenses rattachées et corrections via les workflows financiers contrôlés."
            primaryLabel="Nouvelle dépense"
            primaryIcon={<Plus className="h-4 w-4" />}
            onPrimary={openCreateModal}
          />

          <FinanceKpiGrid metrics={financeMetrics} />

          <div className="sk-premium-panel relative z-20 overflow-visible p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 relative min-w-0 flex-1">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#fffdf8] px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60 lg:hidden"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtres
                </button>
              </div>

              <div className="hidden lg:flex min-w-0 flex-row gap-2 items-center">
                <SmartCombobox
                  value={selectedMois}
                  options={[{ value: '', label: 'Mois en cours' }]}
                  onChange={setSelectedMois}
                  placeholder="Mois en cours"
                  searchPlaceholder="Rechercher..."
                  className="w-48 shrink-0"
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
                  className="w-56 shrink-0"
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
                  className="w-56 shrink-0"
                />

                <ColumnPicker
                  columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
                  visibility={colVis}
                  onToggle={colToggle}
                  onSetAll={colSetAll}
                />
              </div>
            </div>
          </div>

          <MobileFilterSheet
            isOpen={mobileFiltersOpen}
            title="Filtres Dépenses"
            onClose={() => setMobileFiltersOpen(false)}
            onReset={() => {
              setSelectedMois('');
              setSelectedCategorie('');
              setSelectedImmeuble('');
            }}
          >
            <div className="grid gap-3">
              <SmartCombobox
                value={selectedMois}
                options={[{ value: '', label: 'Mois en cours' }]}
                onChange={setSelectedMois}
                placeholder="Mois en cours"
                searchPlaceholder="Rechercher..."
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

          <div className="sk-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table
                columns={columns}
                data={filtered}
                onRowClick={(d) => setSelectedDepense(d)}
                selectedId={selectedDepense?.id}
                mobileRender={(d) => {
                  const status = { icon: ReceiptText, classes: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Enregistrée' };
                  return (
                    <div className="flex flex-col p-4 gap-2 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-black text-slate-900 truncate">
                          {d.categorie}
                        </span>
                        <span className="font-black tracking-tight text-slate-900 whitespace-nowrap">
                          <MoneyText value={d.montant} />
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-600 truncate">
                        {d.description || 'Dépense'}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[11px] font-bold text-slate-400">
                        <span className="truncate pr-2">
                          {new Date(d.date_depense).toLocaleDateString('fr-FR')} · {d.immeubles?.nom || 'Général'} · {status.label}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>

        </section>
      </div>

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

      {/* Drawer */}
      {selectedDepense && (
        <FinanceDrawer
          title="DÉPENSE ENREGISTRÉE"
          amount={<MoneyText value={selectedDepense.montant} />}
          details={[
            selectedDepense.categorie,
            new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')
          ]}
          subtitle="Enregistrée"
          onClose={() => setSelectedDepense(null)}
        >
          <div className="space-y-4">
            <FinanceInfoCard title="Résumé">
              <FinanceLine label="Montant" value={<MoneyText value={selectedDepense.montant} className="font-black text-emerald-800" />} strong />
              <FinanceLine label="Date" value={new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')} />
              <FinanceLine label="Catégorie" value={selectedDepense.categorie} />
            </FinanceInfoCard>

            <FinanceInfoCard title="Affectation & description">
              <FinanceLine label="Bien / Immeuble" value={selectedDepense.immeubles?.nom || 'Général (non affecté)'} />
              <FinanceLine label="Bénéficiaire" value={selectedDepense.beneficiaire || '—'} />
              <FinanceLine label="Description" value={selectedDepense.description || '—'} />
            </FinanceInfoCard>

            <FinanceInfoCard title="Justificatif">
              {selectedDepense.piece_justificative ? (
                <a
                  href={selectedDepense.piece_justificative}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                >
                  <ReceiptText className="h-4 w-4" /> Ouvrir le justificatif
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                  <ReceiptText className="h-4 w-4" /> Aucun justificatif référencé
                </div>
              )}
            </FinanceInfoCard>

            <FinanceInfoCard title="Impact financier">
              <FinanceLine label="Déduction loyer" value="Non applicable" />
              <FinanceLine label="À la charge de" value={selectedDepense.immeuble_id ? 'Bailleur' : 'Agence'} />
            </FinanceInfoCard>

            <FinanceInfoCard title="Historique">
              <div className="relative flex gap-3">
                <div className="relative flex h-3 w-3 mt-1 shrink-0 items-center justify-center rounded-full bg-emerald-700 ring-4 ring-[#fffdf8]" />
                <div>
                  <p className="text-sm font-black text-slate-900">Écriture financière créée</p>
                  <p className="text-xs font-semibold text-slate-500">{new Date(selectedDepense.date_depense).toLocaleString('fr-FR')}</p>
                </div>
              </div>
            </FinanceInfoCard>

            <FinanceInfoCard title="Actions contrôlées">
              <div className="grid grid-cols-1 gap-2">
                <PremiumButton
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => handleEdit(selectedDepense)}
                  fullWidth
                >
                  Modifier
                </PremiumButton>
                <PremiumButton
                  variant="danger"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => {
                    handleDelete(selectedDepense);
                    setSelectedDepense(null);
                  }}
                  fullWidth
                >
                  Annuler
                </PremiumButton>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <PremiumButton variant="secondary" size="sm" icon={<ReceiptText className="h-4 w-4" />} disabled>Justificatif</PremiumButton>
                  <PremiumButton variant="secondary" size="sm" icon={<Building2 className="h-4 w-4" />} disabled>Documents</PremiumButton>
                </div>
              </div>
            </FinanceInfoCard>
          </div>
        </FinanceDrawer>
      )}

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
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
