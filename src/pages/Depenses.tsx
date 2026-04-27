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
import { formatCurrency } from '../lib/formatters';

export function Depenses() {
  const { user, profile } = useAuth();
  const [depenses, setDepenses] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [immeubles, setImmeubles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepense, setEditingDepense] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  const [formData, setFormData] = useState({
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    categorie: 'maintenance' as const,
    description: '',
    beneficiaire: '',
    immeuble_id: '',
  });

  const categories = ['🌐 Internet', '⚡ Électricité', '💧 Eau', '👷 Salaires', '🚌 Prime de transport','📱 Crédit téléphonique', '📦 Autres'];

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    setFiltered(depenses.filter((d) => JSON.stringify(d).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [searchTerm, depenses]);

  const loadData = async () => {
    if (!profile?.agency_id) return;
    try {
      const [depensesRes, immeublesRes] = await Promise.all([
        supabase.from('depenses').select('*, immeubles(nom)').eq('agency_id', profile.agency_id).order('created_at', { ascending: false }),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id).eq('actif', true),
      ]);

      setDepenses(depensesRes.data || []);
      setFiltered(depensesRes.data || []);
      setImmeubles(immeublesRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (!profile?.agency_id) return;
    e.preventDefault();
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
        await supabase.from('depenses').update(data).eq('id', editingDepense.id);
      } else {
        await supabase.from('depenses').insert([{ ...data, created_by: user?.id, agency_id: profile.agency_id }]);
      }

      closeModal();
      loadData();
      toast.success(editingDepense ? 'Dépense mise à jour' : 'Dépense enregistrée');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    }
  };

  const handleEdit = (depense: any) => {
    setEditingDepense(depense);
    setFormData({
      montant: depense.montant.toString(),
      date_depense: depense.date_depense,
      categorie: depense.categorie,
      description: depense.description,
      beneficiaire: depense.beneficiaire,
      immeuble_id: depense.immeuble_id || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (depense: any) => {
    if (!profile?.agency_id) return;
    setDeleteTarget(depense);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('depenses').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Dépense supprimée');
      setDeleteTarget(null);
      loadData();
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

  const columns = [
    { key: 'date_depense', label: 'Date' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'description', label: 'Description' },
    { key: 'beneficiaire', label: 'Bénéficiaire' },
    { key: 'montant', label: 'Montant', render: (d: any) => formatCurrency(d.montant) },
    { key: 'immeuble', label: 'Immeuble', render: (d: any) => d.immeubles?.nom || '-' },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><div>Chargement...</div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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
              onChange={(e) => setFormData({ ...formData, categorie: e.target.value as any })}
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
            <button type="submit" className="px-4 py-2 sm:px-6 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base">
              {editingDepense ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer cette dépense ?"
        message={`Cette dépense de ${deleteTarget?.montant ?? 0} sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}