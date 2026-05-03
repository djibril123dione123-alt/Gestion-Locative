import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';

interface Immeuble {
  id: string;
  nom: string;
  adresse: string;
  quartier: string | null;
  ville: string;
  bailleur_id: string;
  nombre_unites: number;
  description: string | null;
  actif: boolean;
  bailleurs?: { nom: string; prenom: string };
}

interface Bailleur {
  id: string;
  nom: string;
  prenom: string;
}

export function Immeubles() {
  const { user, profile } = useAuth();
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [filteredImmeubles, setFilteredImmeubles] = useState<Immeuble[]>([]);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Immeuble | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const planLimits = usePlanLimits();
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    quartier: '',
    ville: '',
    bailleur_id: '',
    description: '',
  });

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    const filtered = immeubles.filter(i =>
      `${i.nom} ${i.adresse} ${i.ville} ${i.quartier || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    setFilteredImmeubles(filtered);
  }, [searchTerm, immeubles]);

  const loadData = async () => {
    if (!profile?.agency_id) return;

    try {
      const [immeublesRes, bailleursRes] = await Promise.all([
        supabase
          .from('immeubles')
          .select('*, bailleurs(nom, prenom)')
          .eq('agency_id', profile.agency_id)
          .eq('actif', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('bailleurs')
          .select('id, nom, prenom')
          .eq('agency_id', profile.agency_id)
          .eq('actif', true),
      ]);

      if (immeublesRes.error) throw immeublesRes.error;
      if (bailleursRes.error) throw bailleursRes.error;

      setImmeubles(immeublesRes.data || []);
      setFilteredImmeubles(immeublesRes.data || []);
      setBailleurs(bailleursRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingImmeuble && !planLimits.canAddImmeuble) {
      toast.error('Limite atteinte sur votre plan actuel. Passez au plan Pro pour continuer.');
      return;
    }

    try {
      if (editingImmeuble) {
        const { error } = await supabase
          .from('immeubles')
          .update(formData)
          .eq('id', editingImmeuble.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('immeubles')
          .insert([{ ...formData, agency_id: profile?.agency_id, created_by: user?.id }]);

        if (error) throw error;
      }

      closeModal();
      loadData();
      toast.success(editingImmeuble ? 'Immeuble mis à jour' : 'Immeuble créé');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      toast.error(msg);
    }
  };

  const handleEdit = (immeuble: Immeuble) => {
    setEditingImmeuble(immeuble);
    setFormData({
      nom: immeuble.nom,
      adresse: immeuble.adresse,
      quartier: immeuble.quartier || '',
      ville: immeuble.ville,
      bailleur_id: immeuble.bailleur_id,
      description: immeuble.description || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (immeuble: Immeuble) => {
    setDeleteTarget(immeuble);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('immeubles')
        .update({ actif: false })
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Immeuble supprimé');
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingImmeuble(null);
    setFormData({
      nom: '',
      adresse: '',
      quartier: '',
      ville: '',
      bailleur_id: '',
      description: '',
    });
  };

  const ALL_COLUMN_KEYS_IMMEUBLES = ['nom', 'adresse', 'quartier', 'ville', 'bailleur', 'nombre_unites'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('immeubles', [...ALL_COLUMN_KEYS_IMMEUBLES]);

  const allColumns = [
    { key: 'nom', label: 'Nom' },
    { key: 'adresse', label: 'Adresse' },
    { key: 'quartier', label: 'Quartier', render: (i: Immeuble) => i.quartier || '-' },
    { key: 'ville', label: 'Ville' },
    {
      key: 'bailleur',
      label: 'Bailleur',
      render: (i: Immeuble) => i.bailleurs ? `${i.bailleurs.prenom} ${i.bailleurs.nom}` : '-'
    },
    { key: 'nombre_unites', label: 'Unités' },
  ];
  const columns = allColumns.filter((c) => colIsVisible(c.key));

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-lg text-slate-600">Chargement...</div></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Immeubles</h1>
          <p className="text-slate-600 text-sm lg:text-base">Gestion des bâtiments</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus} className="w-full sm:w-auto">
          Nouvel immeuble
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un immeuble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <Table
            columns={columns}
            data={filteredImmeubles}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingImmeuble ? 'Modifier l\'immeuble' : 'Nouvel immeuble'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
            <input
              type="text"
              required
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adresse *</label>
            <input
              type="text"
              required
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quartier</label>
              <input
                type="text"
                value={formData.quartier}
                onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ville *</label>
              <input
                type="text"
                required
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bailleur *</label>
            <select
              required
              value={formData.bailleur_id}
              onChange={(e) => setFormData({ ...formData, bailleur_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner un bailleur</option>
              {bailleurs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.prenom} {b.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition w-full sm:w-auto"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition w-full sm:w-auto"
            >
              {editingImmeuble ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer cet immeuble ?"
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.nom ?? ''}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
