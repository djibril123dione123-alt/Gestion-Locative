import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search, FileText, AlertCircle } from 'lucide-react';
import { generateMandatBailleurPDF } from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { translateSupabaseError, getSuccessMessage } from '../lib/errorMessages';
import { formatDate } from '../lib/formatters';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';

/**
 * Interface Bailleur avec les champs commission et debut_contrat
 */
interface Bailleur {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  piece_identite: string | null;
  notes: string | null;
  commission: number | null;
  debut_contrat: string | null;
  actif: boolean;
  created_at: string;
  updated_at?: string;
}

interface FormData {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  piece_identite: string;
  notes: string;
  commission: string;
  debut_contrat: string;
}

/**
 * Composant d'alerte pour les erreurs
 */
const ErrorAlert: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="text-sm text-red-800">{message}</p>
    </div>
    <button
      onClick={onClose}
      className="text-red-700 hover:text-red-900 transition"
    >
      ✕
    </button>
  </div>
);

/**
 * Composant principal - Gestion des Bailleurs
 */
export function Bailleurs() {
  const { user, profile } = useAuth();
  const toast = useToast();

  // États
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBailleur, setEditingBailleur] = useState<Bailleur | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    bailleur: Bailleur | null;
    isDeleting: boolean;
  }>({ isOpen: false, bailleur: null, isDeleting: false });

  // État du formulaire avec commission et debut_contrat
  const [formData, setFormData] = useState<FormData>({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    piece_identite: '',
    notes: '',
    commission: '',
    debut_contrat: '',
  });

  /**
   * Fonction de chargement des bailleurs
   */
  const loadBailleurs = useCallback(async () => {
    if (!profile?.agency_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bailleurs')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('actif', true)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setBailleurs(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des bailleurs:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  /**
   * Chargement initial des bailleurs
   */
  useEffect(() => {
    if (profile?.agency_id) {
      loadBailleurs();
    }
  }, [loadBailleurs, profile?.agency_id]);

  /**
   * Filtrage des bailleurs
   */
  const filteredBailleurs = useMemo(() => {
    if (!searchTerm.trim()) return bailleurs;

    const searchLower = searchTerm.toLowerCase();
    return bailleurs.filter(b => {
      const searchableText = [
        b.nom,
        b.prenom,
        b.telephone,
        b.email || '',
        b.adresse || '',
        b.piece_identite || ''
      ].join(' ').toLowerCase();

      return searchableText.includes(searchLower);
    });
  }, [searchTerm, bailleurs]);

  /**
   * Soumission du formulaire
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation basique
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.telephone.trim()) {
      setError('Les champs Nom, Prénom et Téléphone sont obligatoires.');
      return;
    }

    if (!formData.debut_contrat) {
      setError('La date de début du contrat est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const submitData = {
        nom: formData.nom,
        prenom: formData.prenom,
        telephone: formData.telephone,
        email: formData.email || null,
        adresse: formData.adresse || null,
        piece_identite: formData.piece_identite || null,
        notes: formData.notes || null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        debut_contrat: formData.debut_contrat,
        updated_at: new Date().toISOString(),
      };

      if (editingBailleur) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('bailleurs')
          .update(submitData)
          .eq('id', editingBailleur.id);

        if (updateError) throw updateError;
        toast.success(getSuccessMessage('update', 'Bailleur'));
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('bailleurs')
          .insert([{
            ...submitData,
            agency_id: profile?.agency_id,
            created_by: user?.id,
            actif: true
          }]);

        if (insertError) throw insertError;
        toast.success(getSuccessMessage('create', 'Bailleur'));
      }

      closeModal();
      await loadBailleurs();
    } catch (err: unknown) {
      console.error('Erreur lors de l\'enregistrement:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Ouverture du modal en mode édition
   */
  const handleEdit = useCallback((bailleur: Bailleur) => {
    setEditingBailleur(bailleur);
    setFormData({
      nom: bailleur.nom,
      prenom: bailleur.prenom,
      telephone: bailleur.telephone,
      email: bailleur.email || '',
      adresse: bailleur.adresse || '',
      piece_identite: bailleur.piece_identite || '',
      notes: bailleur.notes || '',
      commission: bailleur.commission ? bailleur.commission.toString() : '',
      debut_contrat: bailleur.debut_contrat || '',
    });
    setError(null);
    setIsModalOpen(true);
  }, []);

  /**
   * Ouverture de la modal de confirmation de suppression
   */
  const handleDelete = (bailleur: Bailleur) => {
    setConfirmModal({ isOpen: true, bailleur, isDeleting: false });
  };

  /**
   * Suppression logique d'un bailleur
   */
  const confirmDelete = async () => {
    if (!confirmModal.bailleur) return;

    try {
      setConfirmModal((prev) => ({ ...prev, isDeleting: true }));
      setError(null);

      const { error: deleteError } = await supabase
        .from('bailleurs')
        .update({ actif: false, updated_at: new Date().toISOString() })
        .eq('id', confirmModal.bailleur.id);

      if (deleteError) throw deleteError;

      toast.success(getSuccessMessage('delete', 'Bailleur'));
      setConfirmModal({ isOpen: false, bailleur: null, isDeleting: false });
      await loadBailleurs();
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
      setConfirmModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  /**
   * Génération du PDF du mandat
   */
  const handleGenerateMandat = async (bailleur: Bailleur) => {
    try {
      await generateMandatBailleurPDF(bailleur as unknown as Parameters<typeof generateMandatBailleurPDF>[0]);
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      setError('Impossible de générer le mandat PDF.');
    }
  };

  /**
   * Fermeture du modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBailleur(null);
    setError(null);
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      email: '',
      adresse: '',
      piece_identite: '',
      notes: '',
      commission: '',
      debut_contrat: '',
    });
  };

  /**
   * Formatage de la commission
   */
  const formatCommission = (commission: number | null): string => {
    if (!commission) return '-';
    return `${commission}%`;
  };

  /**
   * Configuration des colonnes du tableau
   */
  const ALL_COLUMN_KEYS_BAILLEURS = ['nom', 'prenom', 'telephone', 'email', 'commission', 'debut_contrat', 'mandat'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('bailleurs', [...ALL_COLUMN_KEYS_BAILLEURS]);

  const allColumns = [
    { 
      key: 'nom', 
      label: 'Nom',
      render: (b: Bailleur) => (
        <span className="font-medium text-slate-900">{b.nom}</span>
      )
    },
    { 
      key: 'prenom', 
      label: 'Prénom',
      render: (b: Bailleur) => (
        <span className="font-medium text-slate-900">{b.prenom}</span>
      )
    },
    { 
      key: 'telephone', 
      label: 'Téléphone',
      render: (b: Bailleur) => (
        <a 
          href={`tel:${b.telephone.replace(/[^\d+]/g, '')}`}
          className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
        >
          {b.telephone}
        </a>
      )
    },
    { 
      key: 'email', 
      label: 'Email', 
      render: (b: Bailleur) => b.email ? (
        <a 
          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(b.email)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
        >
          {b.email}
        </a>
      ) : (
        <span className="text-slate-400">-</span>
      )
    },
    { 
      key: 'commission', 
      label: 'Commission', 
      render: (b: Bailleur) => (
        <span className="font-semibold text-slate-700">
          {formatCommission(b.commission)}
        </span>
      )
    },
    { 
      key: 'debut_contrat', 
      label: 'Début contrat', 
      render: (b: Bailleur) => (
        <span className={b.debut_contrat ? 'text-slate-700' : 'text-slate-400'}>
          {formatDate(b.debut_contrat)}
        </span>
      )
    },
    { 
      key: 'mandat', 
      label: 'Actions', 
      render: (b: Bailleur) => (
        <button
          onClick={() => handleGenerateMandat(b)}
          className="sk-action sk-action-financial"
          title="Générer le mandat de gérance"
        >
          <FileText className="w-4 h-4" />
          Mandat PDF
        </button>
      )
    },
  ];
  const columns = allColumns.filter((c) => c.key === 'mandat' || colIsVisible(c.key));

  /**
   * Affichage du loader
   */
  if (loading) {
    return <PageSkeleton title="Bailleurs" variant="table" />;
  }

  return (
    <div className="sk-page-shell max-w-7xl mx-auto animate-fadeIn">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:mb-6 lg:mb-8 mb-6">
        <div className="animate-slideInLeft w-full">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 mb-2">
            Bailleurs
          </h1>
          <p className="text-slate-600 text-base lg:text-lg">
            Gestion des propriétaires • {bailleurs.length} bailleur{bailleurs.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="sk-create-cta w-full animate-slideInRight sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Nouveau bailleur
        </button>
      </div>

      {/* Affichage des erreurs globales */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Conteneur principal */}
      <div className="sk-card-premium overflow-hidden transition-all duration-300">
        {/* Barre de recherche */}
        <div className="p-4 sm:p-6 border-b border-emerald-950/10 bg-brand-surface">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-700 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par nom, prénom, téléphone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sk-input pl-10 pr-4"
              />
            </div>
            <ColumnPicker
              columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: c.key === 'mandat' }))}
              visibility={colVis}
              onToggle={colToggle}
              onSetAll={colSetAll}
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-slate-600">
              {filteredBailleurs.length} résultat{filteredBailleurs.length > 1 ? 's' : ''} trouvé{filteredBailleurs.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Tableau */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          {filteredBailleurs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-900 mb-1">
                Aucun bailleur trouvé
              </p>
              <p className="text-slate-600 text-sm sm:text-base">
                {searchTerm
                  ? 'Essayez de modifier votre recherche'
                  : 'Commencez par créer votre premier bailleur'
                }
              </p>
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredBailleurs}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Modal de création/édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingBailleur ? 'Modifier le bailleur' : 'Nouveau bailleur'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          {/* Erreurs dans le modal */}
          {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

          {/* Informations principales */}
          <div className="space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Informations principales
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="sk-input"
                  placeholder="Diop"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  className="sk-input"
                  placeholder="Amadou"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="sk-input"
                  placeholder="+221 77 123 45 67"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="sk-input"
                  placeholder="amadou.diop@example.com"
                />
              </div>
            </div>
          </div>

          {/* Informations complémentaires */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Informations complémentaires
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                className="sk-input"
                placeholder="123 Avenue Blaise Diagne, Dakar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pièce d'identité
              </label>
              <input
                type="text"
                value={formData.piece_identite}
                onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })}
                className="sk-input"
                placeholder="CNI N° 1234567890123"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Commission (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                  className="sk-input"
                  placeholder="10"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Taux de commission appliqué aux contrats
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Début du contrat <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.debut_contrat}
                  onChange={(e) => setFormData({ ...formData, debut_contrat: e.target.value })}
                  className="sk-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="sk-input resize-none"
                placeholder="Notes supplémentaires..."
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg
                       hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-brand-700 text-white rounded-lg font-bold
                       shadow-premium hover:bg-brand-800 transition-all duration-300
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 transform hover:scale-105 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Enregistrement...
                </>
              ) : (
                editingBailleur ? 'Mettre à jour' : 'Créer'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, bailleur: null, isDeleting: false })}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer ${confirmModal.bailleur?.prenom} ${confirmModal.bailleur?.nom} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={confirmModal.isDeleting}
      />

      {/* Conteneur de toasts */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
