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
      className="text-red-600 hover:text-red-800 transition"
    >
      ✕
    </button>
  </div>
);

/**
 * Composant principal - Gestion des Bailleurs
 */
export function Bailleurs() {
  const { user } = useAuth();
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
   * Chargement initial des bailleurs
   */
  useEffect(() => {
    loadBailleurs();
  }, []);

  /**
   * Fonction de chargement des bailleurs
   */
  const loadBailleurs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bailleurs')
        .select('*')
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
  };

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
            created_by: user?.id,
            actif: true
          }]);

        if (insertError) throw insertError;
        toast.success(getSuccessMessage('create', 'Bailleur'));
      }

      closeModal();
      await loadBailleurs();
    } catch (err: any) {
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
      await generateMandatBailleurPDF(bailleur);
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
   * Formatage de la date
   */
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return '-';
    }
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
  const columns = [
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
          href={`tel:${b.telephone}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
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
          href={`mailto:${b.email}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
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
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-md 
                   transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #F58220 0%, #C0392B 100%)',
          }}
          title="Générer le mandat de gérance"
        >
          <FileText className="w-4 h-4" />
          Mandat PDF
        </button>
      )
    },
  ];

  /**
   * Affichage du loader
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-lg text-slate-600">Chargement des bailleurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Bailleurs
          </h1>
          <p className="text-slate-600">
            Gestion des propriétaires • {bailleurs.length} bailleur{bailleurs.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg 
                   hover:bg-blue-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Nouveau bailleur
        </button>
      </div>

      {/* Affichage des erreurs globales */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Conteneur principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Barre de recherche */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, téléphone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-all"
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-slate-600">
              {filteredBailleurs.length} résultat{filteredBailleurs.length > 1 ? 's' : ''} trouvé{filteredBailleurs.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Tableau */}
        <div className="p-6">
          {filteredBailleurs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-900 mb-1">
                Aucun bailleur trouvé
              </p>
              <p className="text-slate-600">
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Erreurs dans le modal */}
          {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

          {/* Informations principales */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Informations principales
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
                  placeholder="Amadou"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
                  placeholder="amadou.diop@example.com"
                />
              </div>
            </div>
          </div>

          {/* Informations complémentaires */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
                placeholder="CNI N° 1234567890123"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all"
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all resize-none"
                placeholder="Notes supplémentaires..."
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg 
                       hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition-all shadow-md hover:shadow-lg
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
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