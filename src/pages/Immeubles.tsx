import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useBackup } from '../hooks/useBackup';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { getOrCreateIndividualOwnerBailleur } from '../services/individualOwner';

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
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  commission?: number | null;
}

export function Immeubles() {
  const { user, profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Immeuble | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const {
    success: notifySuccess,
    error: notifyError,
    warning: notifyWarning,
    toasts,
    removeToast,
  } = useToast();
  const planLimits = usePlanLimits();
  const { save: saveBackup, getSnapshot } = useBackup();
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    quartier: '',
    ville: '',
    bailleur_id: '',
    description: '',
  });

  const filteredImmeubles = useMemo(
    () =>
      immeubles.filter((immeuble) =>
        `${immeuble.nom} ${immeuble.adresse} ${immeuble.ville} ${immeuble.quartier || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [immeubles, searchTerm],
  );

  const loadData = useCallback(async () => {
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

      const immeublesData = immeublesRes.data || [];
      let bailleursData = (bailleursRes.data || []) as Bailleur[];

      if (isIndividualOwner) {
        const ownerBailleur = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
        bailleursData = [ownerBailleur];
      }

      setImmeubles(immeublesData);
      setBailleurs(bailleursData);
      saveBackup('immeubles', immeublesData).catch(() => {});
      saveBackup('bailleurs', bailleursData).catch(() => {});
    } catch (error) {
      const [cachedImmeubles, cachedBailleurs] = await Promise.all([
        getSnapshot('immeubles'),
        getSnapshot('bailleurs'),
      ]);

      if (cachedImmeubles) {
        setImmeubles(cachedImmeubles.data as Immeuble[]);
        if (cachedBailleurs) {
          setBailleurs(cachedBailleurs.data as Bailleur[]);
        }
        notifyWarning('Connexion instable : affichage des immeubles sauvegardes localement.');
      } else {
        console.error('[Immeubles] load failed', error);
        notifyError('Impossible de charger les immeubles. Verifiez votre connexion puis reessayez.');
      }
    } finally {
      setLoading(false);
    }
  }, [accountProfile, agency, getSnapshot, isIndividualOwner, notifyError, notifyWarning, profile, saveBackup]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [loadData, profile?.agency_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingImmeuble && !planLimits.canAddImmeuble) {
      notifyError('Limite atteinte sur votre plan actuel. Passez au plan Pro pour continuer.');
      return;
    }

    try {
      const nom = formData.nom.trim();
      const adresse = formData.adresse.trim();
      const ville = formData.ville.trim();

      if (!nom) {
        notifyError("Le nom de l'immeuble est obligatoire.");
        return;
      }
      if (!adresse) {
        notifyError("L'adresse de l'immeuble est obligatoire.");
        return;
      }
      if (!ville) {
        notifyError("La ville de l'immeuble est obligatoire.");
        return;
      }
      let bailleurId = formData.bailleur_id;
      if (isIndividualOwner) {
        const ownerBailleur = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
        bailleurId = ownerBailleur.id;
      }

      if (!bailleurId) {
        notifyError(
          isIndividualOwner
            ? 'Profil proprietaire indisponible. Completez votre compte puis reessayez.'
            : 'Selectionnez un bailleur pour rattacher cet immeuble.',
        );
        return;
      }

      const submitData = {
        ...formData,
        bailleur_id: bailleurId,
        nom,
        adresse,
        ville,
        quartier: formData.quartier.trim() || null,
        description: formData.description.trim() || null,
      };

      if (editingImmeuble) {
        const { error } = await supabase
          .from('immeubles')
          .update(submitData)
          .eq('id', editingImmeuble.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('immeubles')
          .insert([{ ...submitData, agency_id: profile?.agency_id, created_by: user?.id }]);

        if (error) throw error;
      }

      closeModal();
      loadData();
      notifySuccess(editingImmeuble ? 'Bien mis a jour' : isIndividualOwner ? 'Bien cree' : 'Immeuble cree');
    } catch (err: unknown) {
      console.error('[Immeubles] save failed', err);
      notifyError("Impossible d'enregistrer l'immeuble. Verifiez votre connexion puis reessayez.");
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
      notifySuccess('Immeuble supprime');
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      console.error('[Immeubles] delete failed', err);
      notifyError('Impossible de supprimer cet immeuble pour le moment.');
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

  const openCreateModal = async () => {
    if (isIndividualOwner) {
      try {
        const ownerBailleur = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
        setBailleurs([ownerBailleur]);
        setFormData((prev) => ({ ...prev, bailleur_id: ownerBailleur.id }));
      } catch (error) {
        console.error('[Immeubles] owner bailleur unavailable', error);
        notifyError('Impossible de preparer votre profil proprietaire. Verifiez votre connexion puis reessayez.');
        return;
      }
    }

    setIsModalOpen(true);
  };

  const ALL_COLUMN_KEYS_IMMEUBLES = ['nom', 'adresse', 'quartier', 'ville', 'bailleur', 'nombre_unites'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('immeubles', [...ALL_COLUMN_KEYS_IMMEUBLES]);

  const allColumns = [
    { key: 'nom', label: 'Nom' },
    { key: 'adresse', label: 'Adresse' },
    { key: 'quartier', label: 'Quartier', render: (i: Immeuble) => i.quartier || '-' },
    { key: 'ville', label: 'Ville' },
    ...(!isIndividualOwner
      ? [
          {
            key: 'bailleur',
            label: 'Bailleur',
            render: (i: Immeuble) => i.bailleurs ? `${i.bailleurs.prenom} ${i.bailleurs.nom}` : '-',
          },
        ]
      : []),
    { key: 'nombre_unites', label: 'Unites' },
  ];
  const columns = allColumns.filter((c) => colIsVisible(c.key));
  const ownerBailleur = isIndividualOwner ? bailleurs[0] : null;
  const pageTitle = isIndividualOwner ? 'Mes biens' : 'Immeubles';
  const pageDescription = isIndividualOwner ? 'Gestion de vos biens locatifs' : 'Gestion des batiments';

  if (loading) {
    return <PageSkeleton title={pageTitle} variant="table" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-2">{pageTitle}</h1>
          <p className="text-slate-600 text-sm lg:text-base">{pageDescription}</p>
        </div>
        <Button onClick={openCreateModal} icon={Plus} className="w-full sm:w-auto">
          {isIndividualOwner ? 'Nouveau bien' : 'Nouvel immeuble'}
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={isIndividualOwner ? 'Rechercher un bien...' : 'Rechercher un immeuble...'}
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
        title={editingImmeuble ? (isIndividualOwner ? 'Modifier le bien' : 'Modifier l\'immeuble') : (isIndividualOwner ? 'Nouveau bien' : 'Nouvel immeuble')}
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

          {isIndividualOwner ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-bold">Proprietaire rattache automatiquement</p>
              <p className="mt-1 text-emerald-800">
                {ownerBailleur ? `${ownerBailleur.prenom} ${ownerBailleur.nom}` : 'Votre profil proprietaire'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bailleur *</label>
              <select
                required
                value={formData.bailleur_id}
                onChange={(e) => setFormData({ ...formData, bailleur_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selectionner un bailleur</option>
                {bailleurs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.prenom} {b.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className="sk-action sk-action-primary px-4 sm:px-6 w-full sm:w-auto"
            >
              {editingImmeuble ? 'Mettre a jour' : 'Creer'}
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
