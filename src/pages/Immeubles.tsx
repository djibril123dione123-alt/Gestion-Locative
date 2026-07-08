import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { getOrCreateIndividualOwnerBailleur } from '../services/individualOwner';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';

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
  const location = useLocation();
  const navigate = useNavigate();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Immeuble | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const {
    success: notifySuccess,
    error: notifyError,
    toasts,
    removeToast,
  } = useToast();
  const planLimits = usePlanLimits();
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

    if (immeubles.length === 0) setLoading(true);
    try {
      const result = await readWithCache<{ immeubles: Immeuble[]; bailleurs: Bailleur[] }>(
        { agencyId: profile.agency_id, userId: profile.id },
        'immeubles-page',
        async () => {
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

          const immeublesData = (immeublesRes.data || []) as Immeuble[];
          let bailleursData = (bailleursRes.data || []) as Bailleur[];

          if (isIndividualOwner) {
            const ownerBailleur = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
            bailleursData = [ownerBailleur];
          }

          return { immeubles: immeublesData, bailleurs: bailleursData };
        },
        { timeoutMs: 7_000 }
      );

      setImmeubles(result.data.immeubles);
      setBailleurs(result.data.bailleurs);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      console.error('[Immeubles] load failed', error);
      notifyError('Biens indisponibles hors connexion sans cache local.');
    } finally {
      setLoading(false);
    }
  }, [accountProfile, agency, immeubles.length, isIndividualOwner, notifyError, profile]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [loadData, profile?.agency_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      notifyError('Connexion indisponible : création ou modification impossible hors ligne.');
      return;
    }

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

      const existingTypeMatch = editingImmeuble?.description?.match(/\[Type:\s*([^\]]+)\]/i);
      const typeTag = existingTypeMatch ? existingTypeMatch[0] : '';
      const rawDesc = formData.description.trim();
      const descWithTag = typeTag ? `${typeTag}${rawDesc ? `\n${rawDesc}` : ''}` : (rawDesc || null);

      const submitData = {
        ...formData,
        bailleur_id: bailleurId,
        nom,
        adresse,
        ville,
        quartier: formData.quartier.trim() || null,
        description: descWithTag,
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
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'patrimoine', 'contrats', 'impayes', 'finances', 'documents'],
        );
        notifyDataChanged(['patrimoine', 'contrats', 'impayes', 'dashboard', 'finances', 'documents']);
      }
      await loadData();
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
      description: (immeuble.description || '').replace(/\[Type:\s*[^\]]+\]\s*\n?/i, '').trim(),
    });
    setIsModalOpen(true);
  };

  const handleDelete = (immeuble: Immeuble) => {
    setDeleteTarget(immeuble);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!navigator.onLine) {
      notifyError('Connexion indisponible : suppression impossible hors ligne.');
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('immeubles')
        .update({ actif: false })
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notifySuccess('Immeuble supprime');
      setDeleteTarget(null);
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'patrimoine', 'contrats', 'impayes', 'finances', 'documents'],
        );
        notifyDataChanged(['patrimoine', 'contrats', 'impayes', 'dashboard', 'finances', 'documents']);
      }
      await loadData();
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

  const openCreateModal = useCallback(async () => {
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
  }, [accountProfile, agency, isIndividualOwner, notifyError, profile]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') !== 'new') return;
    if (loading || isModalOpen || editingImmeuble) return;

    void openCreateModal();
    params.delete('action');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }, [editingImmeuble, isModalOpen, loading, location.pathname, location.search, navigate, openCreateModal]);

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
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={loadData}
        message="Les biens affichés viennent du dernier chargement réussi. Les modifications restent bloquées hors ligne pour protéger les relations bailleur/bien."
      />
      <PremiumPageHeader
        density="compact"
        eyebrow="DOMAINE PATRIMOINE"
        title={pageTitle}
        description={pageDescription}
        mobileDescription={isIndividualOwner ? 'Vos biens.' : 'Biens rattachés.'}
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={openCreateModal} icon={<Plus className="h-4 w-4" />}>
            {isIndividualOwner ? 'Nouveau bien' : 'Nouvel immeuble'}
          </PremiumButton>
        }
      />

      <div className="sk-card p-4 sm:p-6 lg:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={isIndividualOwner ? 'Rechercher un bien...' : 'Rechercher un immeuble...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 sk-input"
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
            <input aria-label="Champ de saisie"
              type="text"
              required
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full sk-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adresse *</label>
            <input aria-label="Champ de saisie"
              type="text"
              required
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              className="w-full sk-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quartier</label>
              <input aria-label="Champ de saisie"
                type="text"
                value={formData.quartier}
                onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                className="w-full sk-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ville *</label>
              <input aria-label="Champ de saisie"
                type="text"
                required
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                className="w-full sk-input"
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
              <select aria-label="Sélection"
                required
                value={formData.bailleur_id}
                onChange={(e) => setFormData({ ...formData, bailleur_id: e.target.value })}
                className="w-full sk-input"
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
            <textarea aria-label="Zone de texte"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full sk-input"
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
