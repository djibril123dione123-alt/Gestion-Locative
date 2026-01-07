import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Unite {
  id: string;
  nom: string;
  numero: string | null;
  etage: string | null;
  loyer_base: number;
  statut: 'libre' | 'loue' | 'maintenance';
  immeuble_id: string;
  immeubles?: { nom: string };
}

export function Unites() {
  const { user, profile } = useAuth();
  const [unites, setUnites] = useState<Unite[]>([]);
  const [filteredUnites, setFilteredUnites] = useState<Unite[]>([]);
  const [immeubles, setImmeubles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnite, setEditingUnite] = useState<Unite | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    numero: '',
    etage: '',
    loyer_base: '',
    statut: 'libre' as const,
    immeuble_id: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const filtered = unites.filter(u =>
      `${u.nom} ${u.numero || ''} ${u.immeubles?.nom || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    setFilteredUnites(filtered);
  }, [searchTerm, unites]);

  const loadData = async () => {
    try {
      const [unitesRes, immeublesRes] = await Promise.all([
        supabase
          .from('unites')
          .select('*, immeubles(nom)')
          .eq('actif', true)
          .order('created_at', { ascending: false }),
        supabase.from('immeubles').select('id, nom').eq('actif', true),
      ]);

      if (unitesRes.error) throw unitesRes.error;
      if (immeublesRes.error) throw immeublesRes.error;

      setUnites(unitesRes.data || []);
      setFilteredUnites(unitesRes.data || []);
      setImmeubles(immeublesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        ...formData,
        loyer_base: parseFloat(formData.loyer_base),
      };

      if (editingUnite) {
        const { error } = await supabase
          .from('unites')
          .update(data)
          .eq('id', editingUnite.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('unites')
          .insert([{ ...data, created_by: user?.id }]);

        if (error) throw error;
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving unite:', error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (unite: Unite) => {
    setEditingUnite(unite);
    setFormData({
      nom: unite.nom,
      numero: unite.numero || '',
      etage: unite.etage || '',
      loyer_base: unite.loyer_base.toString(),
      statut: unite.statut,
      immeuble_id: unite.immeuble_id,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (unite: Unite) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette produit ?')) return;

    try {
      const { error } = await supabase
        .from('unites')
        .update({ actif: false })
        .eq('id', unite.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting unite:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUnite(null);
    setFormData({
      nom: '',
      numero: '',
      etage: '',
      loyer_base: '',
      statut: 'libre',
      immeuble_id: '',
      description: '',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatutBadge = (statut: string) => {
    const badges = {
      libre: 'bg-green-100 text-green-700',
      loue: 'bg-blue-100 text-blue-700',
      maintenance: 'bg-orange-100 text-orange-700',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[statut as keyof typeof badges]}`}>{statut}</span>;
  };

  const columns = [
    { key: 'nom', label: 'Type' },
    { key: 'numero', label: 'Numéro', render: (u: Unite) => u.numero || '-' },
    { key: 'etage', label: 'Étage', render: (u: Unite) => u.etage || '-' },
    { key: 'immeuble', label: 'Immeuble', render: (u: Unite) => u.immeubles?.nom || '-' },
    { key: 'loyer_base', label: 'Loyer', render: (u: Unite) => formatCurrency(u.loyer_base) },
    { key: 'statut', label: 'Statut', render: (u: Unite) => getStatutBadge(u.statut) },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-lg text-slate-600">Chargement...</div></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Produit</h1>
          <p className="text-slate-600">Gestion des appartements et locaux</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nouveau produit
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <Table columns={columns} data={filteredUnites} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingUnite ? 'Modifier le produit' : 'Nouveau produit'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Immeuble *</label>
            <select
              required
              value={formData.immeuble_id}
              onChange={(e) => setFormData({ ...formData, immeuble_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner un immeuble</option>
              {immeubles.map((i) => (
                <option key={i.id} value={i.id}>{i.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
              <select
                required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner</option>
                <option>Appartement F3</option>
                <option>Appartement F4</option>
                <option>Appartement F5</option>
                <option>Appartement F6</option>
                <option>Villa</option>
                <option>Chambre</option>
                <option>Chambre + SDB</option>
                <option>Studio</option>
                <option>Mini Studio</option>
                <option>Magasin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Numéro</label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Étage</label>
              <input
                type="text"
                value={formData.etage}
                onChange={(e) => setFormData({ ...formData, etage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loyer de base *</label>
              <input
                type="number"
                required
                value={formData.loyer_base}
                onChange={(e) => setFormData({ ...formData, loyer_base: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Statut *</label>
            <select
              required
              value={formData.statut}
              onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="libre">Libre</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeModal}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {editingUnite ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
