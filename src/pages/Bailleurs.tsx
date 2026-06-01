import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search, FileText, AlertCircle, Ban, ShieldAlert, Building2, Home, ClipboardList } from 'lucide-react';
import { generateMandatBailleurPDF } from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { translateSupabaseError, getSuccessMessage } from '../lib/errorMessages';
import { formatDate, formatSenegalPhone, formatSenegalPhoneInput, getSenegalPhoneHref, normalizeSenegalPhone } from '../lib/formatters';
import { formatPersonName } from '../lib/people';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import {
  updateBailleurLifecycleViaEdge,
  type BailleurLifecycleStatus,
  type BailleurLifecycleImpacts,
} from '../services/api/bailleurApi';

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
  statut?: string | null;
  resiliation_date?: string | null;
  resiliation_motif?: string | null;
  resiliation_observations?: string | null;
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

interface LifecycleFormData {
  statut: BailleurLifecycleStatus;
  date: string;
  motif: string;
  observations: string;
  acknowledge_impacts: boolean;
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
      ×
    </button>
  </div>
);

const todayInput = () => new Date().toISOString().split('T')[0];

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
  const [lifecycleTarget, setLifecycleTarget] = useState<Bailleur | null>(null);
  const [lifecycleForm, setLifecycleForm] = useState<LifecycleFormData>({
    statut: 'resilie',
    date: todayInput(),
    motif: '',
    observations: '',
    acknowledge_impacts: false,
  });
  const [lifecycleImpacts, setLifecycleImpacts] = useState<BailleurLifecycleImpacts | null>(null);
  const [loadingImpacts, setLoadingImpacts] = useState(false);
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

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
      if (bailleurs.length === 0) setLoading(true);
      setError(null);

      const result = await readWithCache<Bailleur[]>(
        { agencyId: profile.agency_id, userId: user?.id ?? null },
        'bailleurs-page',
        async () => {
          const { data, error: fetchError } = await supabase
            .from('bailleurs')
            .select('*')
            .eq('agency_id', profile.agency_id)
            .eq('actif', true)
            .order('created_at', { ascending: false });

          if (fetchError) throw fetchError;
          return (data || []) as Bailleur[];
        },
        { timeoutMs: 7_000 },
      );

      setBailleurs(result.data);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (err) {
      console.error('Erreur lors du chargement des bailleurs:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [bailleurs.length, profile?.agency_id, toast, user?.id]);

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
        formatPersonName(b, ''),
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
    if (!formData.prenom.trim() || !formData.nom.trim() || !formData.telephone.trim()) {
      setError('Les champs Prénom, Nom et Téléphone sont obligatoires.');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connexion indisponible : enregistrement impossible hors ligne.');
      toast.error('Connexion indisponible : enregistrement impossible hors ligne.');
      return;
    }

    const normalizedPhone = normalizeSenegalPhone(formData.telephone);
    if (!normalizedPhone) {
      setError('Le numéro de téléphone doit être un numéro sénégalais valide, par exemple 77 123 45 67.');
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
        telephone: normalizedPhone,
        email: formData.email || null,
        adresse: formData.adresse || null,
        piece_identite: formData.piece_identite || null,
        notes: formData.notes || null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        debut_contrat: formData.debut_contrat,
        updated_at: new Date().toISOString(),
      };

      if (editingBailleur) {

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
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['bailleurs', 'patrimoine', 'dashboard', 'finances', 'documents'],
        );
        notifyDataChanged(['bailleurs', 'patrimoine', 'dashboard', 'finances', 'documents']);
      }
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
      telephone: formatSenegalPhone(bailleur.telephone, ''),
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

  const loadLifecycleImpacts = async (bailleur: Bailleur) => {
    if (!profile?.agency_id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLifecycleImpacts(null);
      setLoadingImpacts(false);
      return;
    }
    setLoadingImpacts(true);
    try {
      const { data: immeubles } = await supabase
        .from('immeubles')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .eq('bailleur_id', bailleur.id)
        .eq('actif', true);

      const immeubleIds = (immeubles || []).map((row) => row.id);
      let unitesLiees = 0;
      let contratsActifs = 0;

      if (immeubleIds.length > 0) {
        const { data: unites } = await supabase
          .from('unites')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .in('immeuble_id', immeubleIds);

        const uniteIds = (unites || []).map((row) => row.id);
        unitesLiees = uniteIds.length;

        if (uniteIds.length > 0) {
          const { count } = await supabase
            .from('contrats')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', profile.agency_id)
            .eq('statut', 'actif')
            .in('unite_id', uniteIds);
          contratsActifs = count ?? 0;
        }
      }

      setLifecycleImpacts({
        immeubles_actifs: immeubleIds.length,
        unites_liees: unitesLiees,
        contrats_actifs: contratsActifs,
      });
    } catch (err) {
      console.error('Erreur lors du calcul des impacts bailleur:', err);
      setLifecycleImpacts(null);
    } finally {
      setLoadingImpacts(false);
    }
  };

  const openLifecycleModal = (bailleur: Bailleur) => {
    setLifecycleTarget(bailleur);
    setLifecycleForm({
      statut: 'resilie',
      date: todayInput(),
      motif: '',
      observations: '',
      acknowledge_impacts: false,
    });
    setLifecycleImpacts(null);
    setError(null);
    void loadLifecycleImpacts(bailleur);
  };

  const closeLifecycleModal = () => {
    if (isLifecycleSubmitting) return;
    setLifecycleTarget(null);
    setLifecycleImpacts(null);
    setLifecycleForm({
      statut: 'resilie',
      date: todayInput(),
      motif: '',
      observations: '',
      acknowledge_impacts: false,
    });
  };

  const confirmLifecycle = async () => {
    if (!lifecycleTarget) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connexion indisponible : cette action métier doit être confirmée par le serveur.');
      return;
    }
    if (!lifecycleForm.motif.trim() || lifecycleForm.motif.trim().length < 3) {
      setError('Le motif doit contenir au moins 3 caracteres.');
      return;
    }
    if (!lifecycleForm.date) {
      setError('La date de prise d effet est obligatoire.');
      return;
    }

    try {
      setIsLifecycleSubmitting(true);
      setError(null);
      await updateBailleurLifecycleViaEdge({
        id: lifecycleTarget.id,
        statut: lifecycleForm.statut,
        date: lifecycleForm.date,
        motif: lifecycleForm.motif.trim(),
        observations: lifecycleForm.observations.trim() || null,
        acknowledge_impacts: lifecycleForm.acknowledge_impacts,
      });
      toast.success('Cycle de vie du bailleur mis a jour');
      setLifecycleTarget(null);
      setLifecycleImpacts(null);
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['bailleurs', 'patrimoine', 'dashboard', 'finances'],
        );
        notifyDataChanged(['bailleurs', 'patrimoine', 'dashboard', 'finances']);
      }
      await loadBailleurs();
    } catch (err) {
      console.error('Erreur cycle de vie bailleur:', err);
      const errorMessage = err instanceof Error ? err.message : translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLifecycleSubmitting(false);
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
  const ALL_COLUMN_KEYS_BAILLEURS = ['prenom', 'nom', 'telephone', 'email', 'commission', 'debut_contrat', 'mandat'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('bailleurs', [...ALL_COLUMN_KEYS_BAILLEURS]);

  const allColumns = [
    { 
      key: 'prenom', 
      label: 'Prénom',
      render: (b: Bailleur) => (
        <span className="font-medium text-slate-900">{b.prenom}</span>
      )
    },
    { 
      key: 'nom', 
      label: 'Nom',
      render: (b: Bailleur) => (
        <span className="font-medium text-slate-900">{b.nom}</span>
      )
    },
    { 
      key: 'telephone', 
      label: 'Téléphone',
      render: (b: Bailleur) => (
        <a 
          href={getSenegalPhoneHref(b.telephone) ?? undefined}
          className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
        >
          {formatSenegalPhone(b.telephone)}
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
        <div className="sk-action-group-right">
          <button
            onClick={() => handleGenerateMandat(b)}
            className="sk-action sk-action-financial"
            title="Generer le mandat de gerance"
          >
            <FileText className="w-4 h-4" />
            Mandat PDF
          </button>
          <button
            type="button"
            onClick={() => openLifecycleModal(b)}
            className="sk-action sk-action-danger"
            title="Ouvrir le workflow de resiliation"
          >
            <Ban className="w-4 h-4" />
            Resilier
          </button>
        </div>
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
    <div className="sk-page-shell animate-fadeIn">
      {/* En-tête */}
      <div className="sk-page-hero mb-6 flex flex-col items-start justify-between gap-4 sm:mb-6 sm:flex-row sm:items-center lg:mb-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-action-500/10 blur-3xl" />
        <div className="animate-slideInLeft relative w-full">
          <p className="sk-section-eyebrow">Portefeuille propriétaire</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl lg:text-4xl">
            Bailleurs
          </h1>
          <p className="mt-2 text-base leading-7 text-slate-600 lg:text-lg">
            Gestion des propriétaires · {bailleurs.length} bailleur{bailleurs.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="sk-create-cta relative w-full animate-slideInRight sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Nouveau bailleur
        </button>
      </div>

      {/* Affichage des erreurs globales */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
      {cacheTimestamp && (
        <OfflineDataNotice
          cachedAt={cacheTimestamp}
          onRetry={loadBailleurs}
          retrying={loading}
        />
      )}

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
        <div className="p-3 sm:p-4 xl:p-5">
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
                  onChange={(e) => setFormData({ ...formData, telephone: formatSenegalPhoneInput(e.target.value) })}
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

      <Modal
        isOpen={!!lifecycleTarget}
        onClose={closeLifecycleModal}
        title="Cycle de vie du bailleur"
      >
        {lifecycleTarget && (
          <div className="space-y-5">
            {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

            <div className="rounded-[1.25rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-black text-amber-950">
                    Action métier sensible
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    La résiliation conserve l'historique financier et documentaire. Les biens,
                    contrats et encaissements liés restent traçables.
                  </p>
                </div>
              </div>
            </div>

            <div className="sk-card-premium p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Bailleur concerné</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {lifecycleTarget.prenom} {lifecycleTarget.nom}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Commission {formatCommission(lifecycleTarget.commission)} · début {formatDate(lifecycleTarget.debut_contrat)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sk-metric-tile">
                <Building2 className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Immeubles</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.immeubles_actifs ?? 0}
                </p>
              </div>
              <div className="sk-metric-tile">
                <Home className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Unités liées</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.unites_liees ?? 0}
                </p>
              </div>
              <div className="sk-metric-tile">
                <ClipboardList className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Contrats actifs</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.contrats_actifs ?? 0}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Statut</label>
                <select
                  value={lifecycleForm.statut}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, statut: e.target.value as BailleurLifecycleStatus })}
                  className="sk-input"
                >
                  <option value="resilie">Résilié</option>
                  <option value="suspendu">Suspendu</option>
                  <option value="cloture">Clôturé</option>
                  <option value="archive">Archivé</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Date d'effet</label>
                <input
                  type="date"
                  value={lifecycleForm.date}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, date: e.target.value })}
                  className="sk-input"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Motif</label>
              <input
                value={lifecycleForm.motif}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, motif: e.target.value })}
                className="sk-input"
                placeholder="Fin de mandat, changement de gestion, décision du bailleur..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Observations</label>
              <textarea
                value={lifecycleForm.observations}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, observations: e.target.value })}
                rows={3}
                className="sk-input resize-none"
                placeholder="Notes internes, prochaines actions, documents à récupérer..."
              />
            </div>

            <label className="flex items-start gap-3 rounded-[1.25rem] border border-emerald-950/10 bg-emerald-50/50 p-4 shadow-sm">
              <input
                type="checkbox"
                checked={lifecycleForm.acknowledge_impacts}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, acknowledge_impacts: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
              />
              <span className="text-sm leading-6 text-slate-700">
                Je confirme avoir vérifié les impacts sur les biens, contrats actifs,
                locataires et encaissements futurs.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-3 border-t border-emerald-950/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLifecycleModal}
                disabled={isLifecycleSubmitting}
                className="sk-action sk-action-secondary justify-center"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmLifecycle}
                disabled={isLifecycleSubmitting || !lifecycleForm.acknowledge_impacts}
                className="sk-action sk-action-danger justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLifecycleSubmitting ? 'Validation...' : 'Valider le changement'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Conteneur de toasts */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

