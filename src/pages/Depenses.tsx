import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
// import { Button } from '../components/ui/Button';
import { Plus, Search, XCircle, Pencil, SlidersHorizontal, TrendingDown, ReceiptText, Wallet, Building2 } from 'lucide-react';
import { FinanceDrawer, FinanceInfoCard, FinanceLine, FinancePageHeader, FinanceKpiGrid } from '../components/finance/FinancePrimitives';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../lib/formatters';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { cancelDepenseViaRpc, createDepenseViaRpc, updateDepenseViaRpc } from '../services/api/financeApi';

interface Depense {
  id: string;
  montant: number;
  date_depense: string;
  categorie: string;
  description: string | null;
  beneficiaire: string | null;
  immeuble_id: string | null;
  immeubles?: { nom?: string | null } | null;
}

interface ImmeubleOption {
  id: string;
  nom: string;
}

interface DepenseFormData {
  montant: string;
  date_depense: string;
  categorie: string;
  description: string;
  beneficiaire: string;
  immeuble_id: string;
}

export function Depenses() {
  const { profile } = useAuth();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [filtered, setFiltered] = useState<Depense[]>([]);
  const [immeubles, setImmeubles] = useState<ImmeubleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [selectedDepense, setSelectedDepense] = useState<Depense | null>(null);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Depense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const notifyError = toast.error;

  const [formData, setFormData] = useState<DepenseFormData>({
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    categorie: 'maintenance' as const,
    description: '',
    beneficiaire: '',
    immeuble_id: '',
  });

  const categories = ['🌐 Internet', '⚡ Électricité', '💧 Eau', '👷 Salaires', '🚌 Prime de transport', '📱 Crédit téléphonique', '📦 Autres'];

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
      const result = await readWithCache<{ depenses: Depense[]; immeubles: ImmeubleOption[] }>(
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
            supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id).eq('actif', true),
          ]);
          if (depensesRes.error) throw depensesRes.error;
          if (immeublesRes.error) throw immeublesRes.error;
          return {
            depenses: (depensesRes.data || []) as Depense[],
            immeubles: (immeublesRes.data || []) as ImmeubleOption[],
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
    if (!profile?.agency_id) return;
    e.preventDefault();
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : enregistrement impossible hors ligne.');
      return;
    }
    try {
      const data = {
        montant: parseFloat(formData.montant),
        date_depense: formData.date_depense,
        categorie: formData.categorie,
        description: formData.description,
        beneficiaire: formData.beneficiaire,
        immeuble_id: formData.immeuble_id || null,
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
    });
    setSelectedDepense(null);
    setIsModalOpen(true);
  };

  const handleDelete = (depense: Depense) => {
    if (!profile?.agency_id) return;
    setDeleteTarget(depense);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!profile?.agency_id || !profile.id) return;
    const agencyId = profile.agency_id;
    const userId = profile.id;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : suppression impossible hors ligne.');
      return;
    }
    setDeleting(true);
    try {
      await cancelDepenseViaRpc({
        agencyId,
        id: deleteTarget.id,
        reason: 'Annulation depuis la page Depenses',
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
      categorie: 'maintenance',
      description: '',
      beneficiaire: '',
      immeuble_id: '',
    });
  };

  const ALL_COLUMN_KEYS_DEPENSES = ['date_depense', 'categorie', 'description', 'beneficiaire', 'montant', 'immeuble'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('depenses', [...ALL_COLUMN_KEYS_DEPENSES]);

  const allColumns = [
    { key: 'date_depense', label: 'Date' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'description', label: 'Description' },
    { key: 'beneficiaire', label: 'Bénéficiaire' },
    { key: 'montant', label: 'Montant', render: (d: Depense) => formatCurrency(d.montant) },
    { key: 'immeuble', label: 'Immeuble', render: (d: Depense) => d.immeubles?.nom || '-' },
  ];
  const columns = allColumns.filter((c) => colIsVisible(c.key));
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
    <div className="sk-page-shell space-y-6">
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={loadData}
        message="Les dépenses affichées viennent du dernier chargement réussi. Les écritures financières restent bloquées hors ligne."
      />
      <FinancePageHeader
        eyebrow="Charges & exploitation"
        title="Dépenses"
        description="Suivez les charges, frais d'exploitation, dépenses rattachées et corrections via les workflows financiers contrôlés."
        primaryLabel="Nouvelle dépense"
        primaryIcon={<Plus className="h-4 w-4" />}
        onPrimary={() => setIsModalOpen(true)}
      />

      <FinanceKpiGrid metrics={financeMetrics} />

      <div className="sk-premium-panel relative z-20 overflow-visible p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 relative min-w-0 flex-1">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une dépense..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sk-input pl-9"
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
                ...categories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
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
              searchPlaceholder="Rechercher un mois..."
            />
            <SmartCombobox
              value={selectedCategorie}
              options={[
                { value: '', label: 'Toutes les catégories' },
                ...categories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
              ]}
              onChange={setSelectedCategorie}
              placeholder="Toutes les catégories"
              searchPlaceholder="Rechercher une catégorie..."
            />
            <SmartCombobox
              value={selectedImmeuble}
              options={[
                { value: '', label: 'Toutes les affectations' },
                ...immeubles.map((i) => ({ value: i.id, label: i.nom }))
              ]}
              onChange={setSelectedImmeuble}
              placeholder="Toutes les affectations"
              searchPlaceholder="Rechercher une affectation..."
            />
          </div>
        </MobileFilterSheet>
      </div>

      <div className="sk-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table columns={columns} data={filtered} onRowClick={(d) => setSelectedDepense(d)} />
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingDepense ? 'Modifier dépense' : 'Nouvelle dépense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Montant *</label>
              <input
                type="number"
                required
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
              <input
                type="date"
                required
                value={formData.date_depense}
                onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Catégorie *</label>
            <select
              required
              value={formData.categorie}
              onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bénéficiaire</label>
            <input
              type="text"
              value={formData.beneficiaire}
              onChange={(e) => setFormData({ ...formData, beneficiaire: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Immeuble</label>
            <select
              value={formData.immeuble_id}
              onChange={(e) => setFormData({ ...formData, immeuble_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Sélectionner (optionnel)</option>
              {immeubles.map((i) => (
                <option key={i.id} value={i.id}>{i.nom}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-4 py-2 sm:px-6 sm:py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm sm:text-base">
              Annuler
            </button>
            <button type="submit" className="sk-action sk-action-primary px-4 sm:px-6">
              {editingDepense ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Drawer */}
      {selectedDepense && (
        <FinanceDrawer
          title={`Dépense ${selectedDepense.categorie}`}
          subtitle={`Enregistrée le ${new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')}`}
          onClose={() => setSelectedDepense(null)}
          badge={
            <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 border-slate-200">
              {selectedDepense.categorie}
            </span>
          }
          actions={
            <>
              <PremiumButton
                variant="secondary"
                size="sm"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => handleEdit(selectedDepense)}
                fullWidth
              >
                Corriger
              </PremiumButton>
              <PremiumButton
                variant="danger"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => {
                  handleDelete(selectedDepense);
                  setSelectedDepense(null);
                }}
                fullWidth
              >
                Annuler
              </PremiumButton>
            </>
          }
        >
          <div className="space-y-4">
            <FinanceInfoCard title="Détail Financier">
              <FinanceLine label="Montant" value={<span className="font-black text-slate-900">{formatCurrency(selectedDepense.montant)}</span>} />
              <FinanceLine label="Date" value={new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')} />
            </FinanceInfoCard>
            <FinanceInfoCard title="Affectation & Description">
              <FinanceLine label="Bénéficiaire" value={selectedDepense.beneficiaire || '—'} />
              <FinanceLine label="Immeuble" value={selectedDepense.immeubles?.nom || '—'} />
              <FinanceLine label="Description" value={selectedDepense.description || '—'} />
            </FinanceInfoCard>
          </div>
        </FinanceDrawer>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Annuler cette dépense ?"
        message={`Cette dépense de ${deleteTarget?.montant ?? 0} sera conservée dans l'historique, mais retirée des vues actives.`}
        confirmLabel="Annuler la dépense"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
