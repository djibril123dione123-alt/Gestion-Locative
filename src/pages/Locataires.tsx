import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Locataire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse_personnelle: string | null;
  piece_identite: string | null;
}

export function Locataires() {
  const { user, profile } = useAuth();
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [filtered, setFiltered] = useState<Locataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Locataire | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse_personnelle: '',
    piece_identite: '',
    notes: '',
  });

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    const f = locataires.filter(l =>
      `${l.nom} ${l.prenom} ${l.telephone}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFiltered(f);
  }, [searchTerm, locataires]);

  const loadData = async () => {
    if (!profile?.agency_id) return;
    try {
      const { data, error } = await supabase
        .from('locataires')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('actif', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocataires(data || []);
      setFiltered(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await supabase.from('locataires').update(formData).eq('id', editing.id);
      } else {
        await supabase.from('locataires').insert([{ ...formData, created_by: user?.id, agency_id: profile?.agency_id }]);
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur');
    }
  };

  const handleEdit = (item: Locataire) => {
    setEditing(item);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      telephone: item.telephone,
      email: item.email || '',
      adresse_personnelle: item.adresse_personnelle || '',
      piece_identite: item.piece_identite || '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (item: Locataire) => {
    if (!confirm('Supprimer ?')) return;
    try {
      await supabase.from('locataires').update({ actif: false }).eq('id', item.id);
      loadData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormData({ nom: '', prenom: '', telephone: '', email: '', adresse_personnelle: '', piece_identite: '', notes: '' });
  };

  const columns = [
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', render: (l: Locataire) => l.email || '-' },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-lg text-slate-600">Chargement...</div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Locataires</h1>
          <p className="text-slate-600">Gestion des locataires</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          Nouveau locataire
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table columns={columns} data={filtered} onEdit={handleEdit} onDelete={handleDelete} />
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Modifier' : 'Nouveau locataire'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
              <input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
              <input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
              <input type="tel" required value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
            <input type="text" value={formData.adresse_personnelle} onChange={(e) => setFormData({ ...formData, adresse_personnelle: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pièce d'identité</label>
            <input type="text" value={formData.piece_identite} onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              {editing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
