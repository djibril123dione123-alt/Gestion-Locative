import React, { useState, useEffect, useCallback } from 'react';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ensureE164, isValidInternationalPhone } from '../lib/formatters';
import { PhoneInput } from '../components/ui/PhoneInput';
import { closeAgencyAccount } from '../services/admin/adminActionsService';

type AgencyPlan = 'basic' | 'pro' | 'enterprise';
type AgencyStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

interface Agency {
  id: string;
  name: string;
  ninea: string | null;
  address: string | null;
  phone: string;
  email: string;
  website: string | null;
  logo_url: string | null;
  plan: AgencyPlan;
  status: AgencyStatus;
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
  plan: AgencyPlan;
  status: AgencyStatus;
  is_bailleur_account: boolean;
}

export default function Agences() {
  const { profile } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const loadAgencies = useCallback(async () => {
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
  }, [showToast]);

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      loadAgencies();
    }
  }, [loadAgencies, profile?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const normalizedPhone = ensureE164(formData.phone);
      if (!isValidInternationalPhone(normalizedPhone)) {
        showToast('Le téléphone doit être un numéro valide, par exemple 77 123 45 67.', 'error');
        return;
      }
      if (editingAgency) {
        const { error } = await supabase
          .from('agencies')
          .update({
            name: formData.name,
            ninea: formData.ninea || null,
            address: formData.address || null,
            phone: normalizedPhone,
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
          phone: normalizedPhone,
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

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const targetAgency = agencies.find((a) => a.id === deleteTargetId);
      if (!targetAgency) throw new Error('Organisation introuvable.');

      const { data: { user } } = await supabase.auth.getUser();
      await closeAgencyAccount(
        targetAgency,
        `Clôture depuis l'écran Agences super-admin : ${targetAgency.name}`,
        { actorId: user?.id, actorEmail: user?.email },
      );

      showToast('Organisation clôturée et accès révoqués', 'success');
      setDeleteTargetId(null);
      loadAgencies();
    } catch (error) {
      console.error('Error closing agency:', error);
      showToast('La clôture de l’organisation a échoué', 'error');
    } finally {
      setIsDeleting(false);
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
      phone: ensureE164(agency.phone),
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

  if (profile?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Accès refusé. Cette page est réservée au propriétaire du SaaS.</p>
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
        <div className="sk-action-group-right">
          <button
            type="button"
            onClick={() => openEditModal(agency)}
            className="sk-action sk-action-secondary sk-action-icon"
            title="Modifier"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(agency.id)}
            className="sk-action sk-action-danger sk-action-icon"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3 pb-8">
      <PremiumPageHeader
        density="compact"
        eyebrow="PARAMÈTRES AGENCE"
        title="Agences"
        description="Gérez les agences immobilières du système."
        mobileDescription="Gestion agences."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={openCreateModal} icon={<Plus className="h-4 w-4" />}>
            Nouvelle agence
          </PremiumButton>
        }
      />

      {loading ? (
        <PageSkeleton title="Agences" variant="table" />
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
              <PhoneInput
                label="Téléphone"
                required
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
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
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as AgencyPlan })}
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
                onChange={(e) => setFormData({ ...formData, status: e.target.value as AgencyStatus })}
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
              className="sk-action sk-action-primary px-4 py-2"
            >
              {editingAgency ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Clôturer cette organisation"
        message="Les accès seront révoqués et l’abonnement annulé. Les contrats, paiements, documents et journaux financiers seront conservés pour audit et restitution."
        confirmText="Clôturer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
