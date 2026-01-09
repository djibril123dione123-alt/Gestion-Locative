import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface Agency {
  id: string;
  name: string;
  ninea: string | null;
  address: string | null;
  phone: string;
  email: string;
  website: string | null;
  logo_url: string | null;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  trial_ends_at: string | null;
  is_bailleur_account: boolean;
  created_at: string;
}

interface AgencyFormData {
  name: string;
  ninea: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  is_bailleur_account: boolean;
}

export default function Agences() {
  const { profile } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [formData, setFormData] = useState<AgencyFormData>({
    name: '',
    ninea: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    plan: 'basic',
    status: 'active',
    is_bailleur_account: false,
  });
  const { showToast } = useToast();

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAgencies();
    }
  }, [profile]);

  const loadAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error loading agencies:', error);
      showToast('Erreur lors du chargement des agences', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingAgency) {
        const { error } = await supabase
          .from('agencies')
          .update({
            name: formData.name,
            ninea: formData.ninea || null,
            address: formData.address || null,
            phone: formData.phone,
            email: formData.email,
            website: formData.website || null,
            plan: formData.plan,
            status: formData.status,
            is_bailleur_account: formData.is_bailleur_account,
          })
          .eq('id', editingAgency.id);

        if (error) throw error;
        showToast('Agence modifiée avec succès', 'success');
      } else {
        const { error } = await supabase.from('agencies').insert({
          name: formData.name,
          ninea: formData.ninea || null,
          address: formData.address || null,
          phone: formData.phone,
          email: formData.email,
          website: formData.website || null,
          plan: formData.plan,
          status: formData.status,
          is_bailleur_account: formData.is_bailleur_account,
        });

        if (error) throw error;
        showToast('Agence créée avec succès', 'success');
      }

      setShowModal(false);
      setEditingAgency(null);
      resetForm();
      loadAgencies();
    } catch (error) {
      console.error('Error saving agency:', error);
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette agence ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { error } = await supabase.from('agencies').delete().eq('id', id);

      if (error) throw error;
      showToast('Agence supprimée avec succès', 'success');
      loadAgencies();
    } catch (error) {
      console.error('Error deleting agency:', error);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ninea: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      plan: 'basic',
      status: 'active',
      is_bailleur_account: false,
    });
  };

  const openEditModal = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      ninea: agency.ninea || '',
      address: agency.address || '',
      phone: agency.phone,
      email: agency.email,
      website: agency.website || '',
      plan: agency.plan,
      status: agency.status,
      is_bailleur_account: agency.is_bailleur_account,
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingAgency(null);
    resetForm();
    setShowModal(true);
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Vous n'avez pas accès à cette page. Seuls les administrateurs peuvent gérer les agences.</p>
        </div>
      </div>
    );
  }

  const columns = [
    { key: 'name', label: 'Nom' },
    { key: 'ninea', label: 'NINEA' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    {
      key: 'plan',
      label: 'Plan',
      render: (agency: Agency) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          agency.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
          agency.plan === 'pro' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {agency.plan.toUpperCase()}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (agency: Agency) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          agency.status === 'active' ? 'bg-green-100 text-green-800' :
          agency.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
          agency.status === 'suspended' ? 'bg-orange-100 text-orange-800' :
          'bg-red-100 text-red-800'
        }`}>
          {agency.status === 'active' ? 'Actif' :
           agency.status === 'trial' ? 'Essai' :
           agency.status === 'suspended' ? 'Suspendu' :
           'Annulé'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (agency: Agency) => (
        <div className="flex space-x-2">
          <button
            onClick={() => openEditModal(agency)}
            className="text-blue-600 hover:text-blue-800"
            title="Modifier"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(agency.id)}
            className="text-red-600 hover:text-red-800"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-blue-600" />
            Gestion des Agences
          </h1>
          <p className="text-gray-600 mt-2">Gérez les agences immobilières du système</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle Agence
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      ) : (
        <Table columns={columns} data={agencies} />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAgency(null);
          resetForm();
        }}
        title={editingAgency ? 'Modifier l\'agence' : 'Nouvelle agence'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'agence *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NINEA
              </label>
              <input
                type="text"
                value={formData.ninea}
                onChange={(e) => setFormData({ ...formData, ninea: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site web
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan
              </label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Actif</option>
                <option value="trial">Essai</option>
                <option value="suspended">Suspendu</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_bailleur"
              checked={formData.is_bailleur_account}
              onChange={(e) => setFormData({ ...formData, is_bailleur_account: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="is_bailleur" className="ml-2 text-sm text-gray-700">
              Compte bailleur (accès limité)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingAgency(null);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingAgency ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
