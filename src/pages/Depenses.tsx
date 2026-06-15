import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const categories = ['🌐 Internet', '⚡ Électricité', '💧 Eau', '👷 Salaires', '🚌 Prime de transport','📱 Crédit téléphonique', '📦 Autres'];

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

  if (loading) return <PageSkeleton title="Dépenses" variant="table" />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={loadData}
        message="Les dépenses affichées viennent du dernier chargement réussi. Les écritures financières restent bloquées hors ligne."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Dépenses</h1>
          <p className="text-sm sm:text-base text-slate-600">Gestion des frais d'exploitation</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus}>
          Nouvelle dépense
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              />
            </div>
            <ColumnPicker
              columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
              visibility={colVis}
              onToggle={colToggle}
              onSetAll={colSetAll}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table columns={columns} data={filtered} onEdit={handleEdit} onDelete={handleDelete} />
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
