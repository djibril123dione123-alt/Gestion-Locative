import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createContratViaEdge, updateContratViaEdge, ContratApiError } from '../services/api/contratApi';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, Search, Download, AlertCircle, TrendingUp, Ban, CalendarDays, FileText } from 'lucide-react';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { generateContratPDF } from '../lib/pdf';
import { formatCurrency } from '../lib/formatters';
import { useToast } from '../hooks/useToast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
import { runDocumentGeneration } from '../lib/documentGeneration';
import { EmptyState } from '../components/ui/EmptyState';

// =========================
//  PALETTE CONFORT IMMO ARCHI
// =========================
const BRAND_COLORS = {
  primary: '#166534',
  primaryLight: '#DCFCE7',
  red: '#B42318',
  gray: '#0F172A',
} as const;

// =========================
//  TYPES
// =========================
interface Locataire {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  email?: string;
  adresse_personnelle?: string;
  piece_identite?: string;
}

interface Bailleur {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  adresse?: string;
  commission?: number;
}

interface Immeuble {
  nom: string;
  adresse?: string;
  bailleurs?: Bailleur;
}

interface Unite {
  id: string;
  nom: string;
  loyer_base: number;
  statut: 'libre' | 'loue';
  immeubles?: Immeuble;
}

interface Contrat {
  id: string;
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin?: string;
  loyer_mensuel: number;
  commission?: number;
  caution?: number;
  statut: 'actif' | 'expire' | 'resilie' | 'archive';
  destination?: string;
  created_at?: string;
  locataires?: Locataire;
  unites?: Unite;
}

interface FormData {
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin: string;
  loyer_mensuel: string;
  caution: string;
  commission: string;
  statut: 'actif' | 'expire' | 'resilie' | 'archive';
  destination: 'Habitation' | 'Commercial' | '';
}

type ContratStatut = FormData['statut'];
type ContratDestination = FormData['destination'];

const CONTRAT_STATUS_LABELS: Record<ContratStatut, string> = {
  actif: 'Actif',
  expire: 'Expiré',
  resilie: 'Résilié',
  archive: 'Archivé',
};

// =========================
//  VALEURS INITIALES
// =========================
const INITIAL_FORM_DATA: FormData = {
  locataire_id: '',
  unite_id: '',
  date_debut: '',
  date_fin: '',
  loyer_mensuel: '',
  caution: '',
  commission: '',
  statut: 'actif',
  destination: '',
};

function addYearsToDateString(dateString: string, years: number): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year + years, month - 1, day));
  return date.toISOString().slice(0, 10);
}

// =========================
//  COMPOSANT PRINCIPAL
// =========================
export function Contrats() {
  // Auth context
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;

  // États
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contrat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [resiliationTarget, setResiliationTarget] = useState<Contrat | null>(null);
  const [resiliating, setResiliating] = useState(false);
  const [resiliationForm, setResiliationForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    motif: '',
    observations: '',
  });
  const toast = useToast();
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  // Garde anti-race : si l'utilisateur change d'agence ou navigue
  // rapidement, une reponse tardive ne doit pas ecraser les donnees
  // fraiches. Pattern identique a Calendrier.tsx.
  const requestIdRef = useRef(0);

  // =========================
  //  CHARGEMENT DES DONNÉES
  // =========================
  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    const myRequestId = ++requestIdRef.current;

    try {
      if (contrats.length === 0) setLoading(true);
      setError(null);

      const result = await readWithCache(
        { agencyId: profile.agency_id, userId: profile.id },
        'contrats-page',
        async () => {
          const [contratsRes, locatairesRes, unitesRes] = await Promise.all([
            supabase
              .from('contrats')
              .select(`
                *,
                locataires(nom, prenom, telephone, email, adresse_personnelle, piece_identite),
                unites(
                  nom,
                  loyer_base,
                  immeubles(
                    nom,
                    adresse,
                    bailleurs(id, nom, prenom, telephone, adresse, commission)
                  )
                )
              `)
              .eq('agency_id', profile.agency_id)
              .order('created_at', { ascending: false }),
            supabase
              .from('locataires')
              .select('id, nom, prenom')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .order('nom', { ascending: true }),
            supabase
              .from('unites')
              .select('id, nom, loyer_base, statut, immeubles(nom, bailleurs(id, nom, prenom, commission))')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .eq('statut', 'libre')
              .order('nom', { ascending: true }),
          ]);

          if (contratsRes.error) throw contratsRes.error;
          if (locatairesRes.error) throw locatairesRes.error;
          if (unitesRes.error) throw unitesRes.error;

          const contratsData = Array.from(
            new Map(
              ((contratsRes.data || []) as unknown as Contrat[]).map((contrat) => [
                contrat.id,
                contrat,
              ])
            ).values()
          );

          return {
            contrats: contratsData,
            locataires: (locatairesRes.data || []) as unknown as Locataire[],
            unites: (unitesRes.data || []) as unknown as Unite[],
          };
        },
        { timeoutMs: 7_000 },
      );

      // Si une nouvelle requête a été lancée entre-temps, on ignore
      // ce résultat pour ne pas écraser des données plus récentes.
      if (myRequestId !== requestIdRef.current) return;

      setContrats(result.data.contrats);
      setLocataires(result.data.locataires);
      setUnites(result.data.unites);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (err: unknown) {
      if (myRequestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données');
    } finally {
      if (myRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [contrats.length, profile?.agency_id, profile?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
    const activeRequestRef = requestIdRef;
    // Cleanup : invalide les requêtes en vol au démontage / changement.
    return () => {
      activeRequestRef.current++;
    };
  }, [profile?.agency_id, loadData]);

  // =========================
  //  FILTRAGE DES CONTRATS
  // =========================
  const mainContrats = useMemo(
    () => contrats.filter((c) => c.statut !== 'archive'),
    [contrats]
  );

  const filteredContrats = useMemo(() => {
    if (!searchTerm.trim()) return mainContrats;

    const term = searchTerm.toLowerCase();
    return mainContrats.filter((c) => {
      const locataire = c.locataires
        ? `${c.locataires.prenom} ${c.locataires.nom}`.toLowerCase()
        : '';
      const unite = c.unites?.nom?.toLowerCase() || '';
      const immeuble = c.unites?.immeubles?.nom?.toLowerCase() || '';
      const statut = c.statut.toLowerCase();
      const destination = c.destination?.toLowerCase() || '';

      return (
        locataire.includes(term) ||
        unite.includes(term) ||
        immeuble.includes(term) ||
        statut.includes(term) ||
        destination.includes(term)
      );
    });
  }, [searchTerm, mainContrats]);

  // =========================
  //  STATISTIQUES
  // =========================
  const stats = useMemo(() => {
    const actifs = mainContrats.filter((c) => c.statut === 'actif');
    const revenuTotal = actifs.reduce((sum, c) => {
      if (isIndividualOwner) return sum + c.loyer_mensuel;
      const partAgence = (c.loyer_mensuel * (c.commission || 0)) / 100;
      return sum + partAgence;
    }, 0);

    return {
      total: mainContrats.length,
      actifs: actifs.length,
      expires: mainContrats.filter((c) => c.statut === 'expire').length,
      resilies: mainContrats.filter((c) => c.statut === 'resilie').length,
      revenuTotal,
    };
  }, [mainContrats, isIndividualOwner]);

  // =========================
  //  GESTION CHANGEMENT D'UNITÉ
  // =========================
  const handleUniteChange = useCallback(
    (uniteId: string) => {
      const unite = unites.find((u) => u.id === uniteId);
      let commissionBailleur = '';

      if (!isIndividualOwner && unite && unite.immeubles?.bailleurs) {
        commissionBailleur = (unite.immeubles.bailleurs.commission || 0).toString();
      }

      setFormData((prev) => ({
        ...prev,
        unite_id: uniteId,
        loyer_mensuel: unite ? unite.loyer_base.toString() : '',
        caution: unite ? (unite.loyer_base * 2).toString() : '',
        commission: isIndividualOwner ? '' : commissionBailleur,
      }));
    },
    [isIndividualOwner, unites]
  );

  const handleDateDebutChange = useCallback((dateDebut: string) => {
    setFormData((prev) => ({
      ...prev,
      date_debut: dateDebut,
      date_fin: addYearsToDateString(dateDebut, 2),
    }));
  }, []);

  // =========================
  // OK VALIDATION DU FORMULAIRE
  // =========================
  const validateForm = useCallback((): string | null => {
    if (!formData.locataire_id) return 'Veuillez sélectionner un locataire';
    if (!formData.unite_id) return 'Veuillez sélectionner un produit';
    if (!formData.date_debut) return 'Veuillez saisir la date de début';
    if (!formData.destination) return 'Veuillez sélectionner la destination';
    if (!formData.loyer_mensuel || parseFloat(formData.loyer_mensuel) <= 0) {
      return 'Veuillez saisir un loyer valide';
    }
    return null;
  }, [formData]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditing(null);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  // =========================
  //  CRÉATION DE CONTRAT
  // =========================
  const handleSubmit = useCallback(
    async (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      if (submitting || submitLockRef.current) return;
      submitLockRef.current = true;

      if (!profile?.agency_id) {
        submitLockRef.current = false;
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const msg = 'Connexion indisponible : la création de contrat doit être confirmée par le serveur.';
        setError(msg);
        toast.error(msg);
        submitLockRef.current = false;
        return;
      }

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        toast.warning(validationError);
        submitLockRef.current = false;
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        // Création via Edge Function (vérification unité + agency_id + event_log côté serveur)
        await createContratViaEdge({
          locataire_id: formData.locataire_id,
          unite_id: formData.unite_id,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin || null,
          loyer_mensuel: parseFloat(formData.loyer_mensuel),
          commission: isIndividualOwner ? 0 : formData.commission ? parseFloat(formData.commission) : null,
          caution: formData.caution ? parseFloat(formData.caution) : null,
          statut: formData.statut === 'archive' ? 'actif' : formData.statut,
          destination: formData.destination || null,
        });

        closeModal();
        toast.success('Contrat créé avec succès');
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'contrats', 'paiements', 'impayes', 'patrimoine', 'finances'],
        );
        notifyDataChanged(['contrats', 'paiements', 'impayes', 'dashboard', 'patrimoine', 'finances']);
        await loadData();
      } catch (err: unknown) {
        const msg = err instanceof ContratApiError
          ? err.message
          : err instanceof Error ? err.message : 'Erreur lors de la création du contrat';
        setError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [closeModal, formData, isIndividualOwner, validateForm, loadData, profile?.agency_id, profile?.id, submitting, toast]
  );

  // =========================
  //  MODIFICATION DE CONTRAT
  // =========================
  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editing) return;
      if (!profile?.agency_id) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        toast.error('Connexion indisponible : modification impossible hors ligne.');
        return;
      }

      setSubmitting(true);
      try {
        // Mise a jour via Edge Function (liberation unite si resiliation + event_log cote serveur)
        await updateContratViaEdge({
          id: editing.id,
          statut: formData.statut,
          date_fin: formData.date_fin || null,
          commission: isIndividualOwner ? 0 : formData.commission ? parseFloat(formData.commission) : null,
          caution: formData.caution ? parseFloat(formData.caution) : null,
        });

        closeEditModal();
        toast.success('Contrat modifié avec succès');
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'contrats', 'paiements', 'impayes', 'patrimoine', 'finances'],
        );
        notifyDataChanged(['contrats', 'paiements', 'impayes', 'dashboard', 'patrimoine', 'finances']);
        await loadData();
      } catch (err: unknown) {
        console.error('Erreur modification:', err);
        const msg = err instanceof ContratApiError
          ? err.message
          : err instanceof Error ? err.message : 'Erreur inconnue';
        toast.error(`Erreur : ${msg}`);
      } finally {
        setSubmitting(false);
      }
    },
    [closeEditModal, editing, formData, isIndividualOwner, loadData, profile?.agency_id, profile?.id, toast]
  );

  // =========================
  // OUVERTURE MODAL D'ÉDITION
  // =========================
  const handleEdit = useCallback((contrat: Contrat) => {
    setEditing(contrat);
    setFormData({
      locataire_id: contrat.locataire_id,
      unite_id: contrat.unite_id,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      loyer_mensuel: contrat.loyer_mensuel.toString(),
      caution: contrat.caution?.toString() || '',
      commission: contrat.commission?.toString() || '',
      statut: contrat.statut,
      destination: (contrat.destination as 'Habitation' | 'Commercial' | '') || '',
    });
    setIsEditModalOpen(true);
  }, []);

  // =========================
  //  TÉLÉCHARGEMENT PDF
  // =========================
  const handleDownloadPDF = useCallback(async (contratId: string) => {
    if (!profile?.agency_id) return;

    setDownloadingId(contratId);
    try {
      await runDocumentGeneration({
        key: `contrat:${profile.agency_id}:${contratId}`,
        kind: 'contrat',
        title: 'Préparation du contrat',
        source: 'contrats',
        archiveExpected: true,
        verificationExpected: true,
      }, async (generation) => {
        const { data: contrat, error } = await supabase
          .from('contrats')
          .select(`
            *,
            locataires(nom, prenom, telephone, email, adresse_personnelle, piece_identite),
            unites(
              nom,
              loyer_base,
              immeubles(
                nom,
                adresse,
                bailleurs(nom, prenom, telephone, adresse)
              )
            )
          `)
          .eq('id', contratId)
          .eq('agency_id', profile.agency_id)
          .single();

        if (error) throw error;
        if (!contrat) throw new Error('Contrat introuvable.');
        await generateContratPDF(contrat, generation);
      });
    } catch (err: unknown) {
      console.error('Erreur PDF:', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Erreur lors de la génération du PDF : ${message}`);
    } finally {
      setDownloadingId(null);
    }
  }, [profile?.agency_id, toast]);

  const openResiliation = useCallback((contrat: Contrat) => {
    setResiliationTarget(contrat);
    setResiliationForm({
      date: new Date().toISOString().slice(0, 10),
      motif: '',
      observations: '',
    });
  }, []);

  const closeResiliation = useCallback(() => {
    if (resiliating) return;
    setResiliationTarget(null);
    setResiliationForm({
      date: new Date().toISOString().slice(0, 10),
      motif: '',
      observations: '',
    });
  }, [resiliating]);

  const confirmResiliation = useCallback(async () => {
    if (!profile?.agency_id || !resiliationTarget) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Connexion indisponible : la résiliation doit être confirmée par le serveur.');
      return;
    }
    if (!resiliationForm.date) {
      toast.warning('Veuillez renseigner la date de résiliation');
      return;
    }
    if (resiliationForm.motif.trim().length < 3) {
      toast.warning('Veuillez renseigner un motif clair');
      return;
    }

    setResiliating(true);
    try {
      await updateContratViaEdge({
        id: resiliationTarget.id,
        statut: 'resilie',
        date_fin: resiliationForm.date,
        resiliation_motif: resiliationForm.motif.trim(),
        resiliation_observations: resiliationForm.observations.trim() || null,
      });
      toast.success('Contrat résilié et historisé');
      setResiliationTarget(null);
      setResiliationForm({
        date: new Date().toISOString().slice(0, 10),
        motif: '',
        observations: '',
      });
      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'contrats', 'paiements', 'impayes', 'patrimoine', 'finances'],
      );
      notifyDataChanged(['contrats', 'paiements', 'impayes', 'dashboard', 'patrimoine', 'finances']);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof ContratApiError
        ? err.message
        : err instanceof Error ? err.message : 'Erreur lors de la résiliation du contrat';
      setError(msg);
      toast.error(msg);
    } finally {
      setResiliating(false);
    }
  }, [loadData, profile?.agency_id, profile?.id, resiliationForm, resiliationTarget, toast]);

  // =========================
  // COLONNES DU TABLEAU
  // =========================
  const ALL_COLUMN_KEYS_CONTRATS = ['locataire', 'unite', 'immeuble', 'destination', 'date_debut', 'loyer_mensuel', 'revenue_total', 'statut', 'actions'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('contrats', [...ALL_COLUMN_KEYS_CONTRATS]);

  const allColumns = useMemo(
    () => [
      {
        key: 'locataire',
        label: 'Locataire',
        render: (c: Contrat) =>
          c.locataires ? `${c.locataires.prenom} ${c.locataires.nom}` : '-',
      },
      {
        key: 'unite',
        label: 'Produit',
        render: (c: Contrat) => c.unites?.nom || '-',
      },
      {
        key: 'immeuble',
        label: 'Immeuble',
        render: (c: Contrat) => c.unites?.immeubles?.nom || '-',
      },
      {
        key: 'destination',
        label: 'Destination',
        render: (c: Contrat) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              c.destination === 'Commercial'
                ? 'bg-violet-50 text-violet-800 border border-violet-200'
                : 'bg-brand-50 text-brand-800 border border-brand-100'
            }`}
          >
            {c.destination || 'Non spécifié'}
          </span>
        ),
      },
      {
        key: 'date_debut',
        label: 'Début',
        render: (c: Contrat) =>
          new Date(c.date_debut).toLocaleDateString('fr-FR'),
      },
      {
        key: 'loyer_mensuel',
        label: 'Loyer',
        render: (c: Contrat) => formatCurrency(c.loyer_mensuel),
      },
      {
        key: 'revenue_total',
        label: isIndividualOwner ? 'Loyer mensuel' : 'Revenu',
        render: (c: Contrat) => {
          if (isIndividualOwner) return formatCurrency(c.loyer_mensuel);
          const partAgence = (c.loyer_mensuel * (c.commission || 0)) / 100;
          return formatCurrency(partAgence);
        },
      },
      {
        key: 'statut',
        label: 'Statut',
        render: (c: Contrat) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              c.statut === 'actif'
                ? 'bg-green-100 text-green-700'
                : c.statut === 'resilie'
                ? 'bg-red-100 text-red-700'
                : c.statut === 'archive'
                ? 'bg-slate-200 text-slate-600'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {CONTRAT_STATUS_LABELS[c.statut]}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (c: Contrat) => (
          <div className="sk-action-group-right">
            <button
              type="button"
              onClick={() => handleDownloadPDF(c.id)}
              disabled={downloadingId === c.id}
              className="sk-action sk-action-financial"
            >
              <Download className="w-4 h-4" />
              {downloadingId === c.id ? '...' : 'PDF'}
            </button>
            {c.statut === 'actif' && (
              <button
                type="button"
                onClick={() => openResiliation(c)}
                className="sk-action sk-action-danger"
                title="Résilier le contrat"
              >
                <Ban className="w-4 h-4" />
                Résilier
              </button>
            )}
          </div>
        ),
      },
    ],
    [handleDownloadPDF, downloadingId, isIndividualOwner, openResiliation]
  );
  const columns = useMemo(
    () => allColumns.filter((c) => {
      if (isIndividualOwner && c.key === 'revenue_total') return false;
      return c.key === 'actions' || colIsVisible(c.key);
    }),
    [allColumns, colIsVisible, isIndividualOwner]
  );

  // =========================
  //  RENDU
  // =========================
  if (loading) {
    return <PageSkeleton title="Contrats" variant="table" />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="border rounded-lg p-6 flex items-start gap-3"
             style={{ 
               backgroundColor: '#FFF5F5',
               borderColor: BRAND_COLORS.red
             }}>
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" 
                       style={{ color: BRAND_COLORS.red }} />
          <div>
            <h3 className="text-lg font-semibold mb-1" 
                style={{ color: BRAND_COLORS.red }}>
              Erreur de chargement
            </h3>
            <p style={{ color: BRAND_COLORS.red }}>{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-brand-700 text-white rounded-lg font-bold transition hover:bg-brand-800"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sk-page-shell space-y-6 lg:space-y-8">
      {cacheTimestamp && (
        <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadData} retrying={loading} />
      )}

      {/*  En-tête et statistiques */}
      <PremiumPageHeader
        density="compact"
        eyebrow="PORTAIL LOCATIF"
        title="Contrats"
        description="Suivez les baux, échéances et statuts contractuels."
        mobileDescription="Gestion des baux."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Nouveau contrat
          </PremiumButton>
        }
      />

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="sk-card p-4">
          <p className="text-sm text-slate-600 font-bold">Total contrats</p>
          <p className="text-2xl font-black text-slate-950">{stats.total}</p>
        </div>
        <div className="sk-card p-4">
          <p className="text-sm text-brand-700 font-bold">Actifs</p>
          <p className="text-2xl font-black text-slate-950">{stats.actifs}</p>
        </div>
        <div className="bg-action-50 border border-action-200 rounded-lg p-4">
          <p className="text-sm font-bold text-action-700">
            Expirés
          </p>
          <p className="text-2xl font-black text-slate-950">
            {stats.expires}
          </p>
        </div>
        <div className="sk-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-brand-700 font-bold">
              {isIndividualOwner ? 'Loyers mensuels' : 'Revenu mensuel'}
            </p>
          </div>
          <p className="text-2xl font-black text-slate-950">
            {formatCurrency(stats.revenuTotal)}
          </p>
        </div>
      </div>

      {/* Recherche et tableau */}
      <div className="sk-card p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sk-input pl-10 pr-4 sm:hidden"
              />
              <input
                type="text"
                placeholder="Rechercher un locataire, produit, immeuble, destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sk-input pl-10 pr-4 hidden sm:block"
              />
            </div>
            <ColumnPicker
              columns={allColumns
                .filter((c) => !(isIndividualOwner && c.key === 'revenue_total'))
                .map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))}
              visibility={colVis}
              onToggle={colToggle}
              onSetAll={colSetAll}
            />
          </div>
        </div>

        {filteredContrats.length === 0 ? (
          <EmptyState
            bare
            icon={FileText}
            title={searchTerm ? 'Aucun résultat' : 'Aucun contrat enregistré'}
            description={
              searchTerm
                ? 'Aucun contrat ne correspond à votre recherche.'
                : 'Créez votre premier contrat pour commencer à suivre les baux et loyers.'
            }
            action={
              searchTerm
                ? { label: 'Réinitialiser la recherche', onClick: () => setSearchTerm('') }
                : { label: 'Nouveau contrat', onClick: () => setIsModalOpen(true) }
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={columns}
              data={filteredContrats}
              onEdit={handleEdit}
            />
          </div>
        )}
      </div>

      {/* Modal création */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Nouveau contrat">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Locataire *
            </label>
            <select aria-label="Sélection"
              required
              value={formData.locataire_id}
              onChange={(e) =>
                setFormData({ ...formData, locataire_id: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.locataire_id ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner un locataire</option>
              {locataires.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.prenom} {l.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Produit libre *
            </label>
            <select aria-label="Sélection"
              required
              value={formData.unite_id}
              onChange={(e) => handleUniteChange(e.target.value)}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.unite_id ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner un produit</option>
              {unites.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom} - {u.immeubles?.nom} ({formatCurrency(u.loyer_base)})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Seuls les produits libres sont affichés
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Destination *
            </label>
            <select aria-label="Sélection"
              required
              value={formData.destination}
              onChange={(e) =>
                setFormData({ ...formData, destination: e.target.value as ContratDestination })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none transition-all"
              style={{ 
                boxShadow: formData.destination ? `0 0 0 3px rgba(245, 130, 32, 0.1)` : 'none'
              }}
            >
              <option value="">Sélectionner la destination</option>
              <option value="Habitation">Habitation</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Date début *
              </label>
              <input aria-label="Champ de saisie"
                type="date"
                required
                value={formData.date_debut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Date fin
              </label>
              <input aria-label="Champ de saisie"
                type="date"
                value={formData.date_fin}
                onChange={(e) =>
                  setFormData({ ...formData, date_fin: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Loyer mensuel *
              </label>
              <input aria-label="Champ de saisie"
                type="number"
                required
                value={formData.loyer_mensuel}
                onChange={(e) =>
                  setFormData({ ...formData, loyer_mensuel: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            {!isIndividualOwner && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Commission (%)
              </label>
              <input
                type="number"
                value={formData.commission}
                onChange={(e) =>
                  setFormData({ ...formData, commission: e.target.value })
                }
                placeholder="Auto-rempli"
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none bg-slate-50"
                disabled
              />
              <p className="text-xs text-slate-500 mt-1">
                Taux défini par le bailleur
              </p>
            </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
                Caution (F CFA)
              </label>
              <input aria-label="Champ de saisie"
                type="number"
                value={formData.caution}
                onChange={(e) =>
                  setFormData({ ...formData, caution: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-brand-700 text-white rounded-lg font-bold transition hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-premium"
            >
              {submitting ? 'Création...' : 'Créer le contrat'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!resiliationTarget}
        onClose={closeResiliation}
        title="Résilier le contrat"
      >
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-red-700 ring-1 ring-red-100">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-slate-950">Action de cycle de vie</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  La résiliation met le contrat en statut terminal, libère l'unité et inscrit l'événement dans l'historique serveur.
                </p>
              </div>
            </div>
          </div>

          {resiliationTarget && (
            <div className="sk-card-premium p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Contrat concerné</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Locataire</p>
                  <p className="font-bold text-slate-950">
                    {resiliationTarget.locataires
                      ? `${resiliationTarget.locataires.prenom} ${resiliationTarget.locataires.nom}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Unité</p>
                  <p className="font-bold text-slate-950">{resiliationTarget.unites?.nom || '-'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Date de résiliation *</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input aria-label="Champ de saisie"
                  type="date"
                  value={resiliationForm.date}
                  onChange={(e) => setResiliationForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="sk-input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Motif *</label>
              <input
                value={resiliationForm.motif}
                onChange={(e) => setResiliationForm((prev) => ({ ...prev, motif: e.target.value }))}
                placeholder="Départ locataire, accord amiable..."
                className="sk-input"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Observations</label>
            <textarea
              value={resiliationForm.observations}
              onChange={(e) => setResiliationForm((prev) => ({ ...prev, observations: e.target.value }))}
              rows={4}
              placeholder="Notes internes, état des lieux, suivi à prévoir..."
              className="sk-input min-h-28 resize-y"
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-emerald-950/10 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={closeResiliation}
              disabled={resiliating}
              className="sk-action sk-action-secondary justify-center disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmResiliation}
              disabled={resiliating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 font-bold text-white shadow-lg shadow-red-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              {resiliating ? 'Résiliation...' : 'Confirmer la résiliation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal édition */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Modifier le contrat"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Statut *
            </label>
            <select aria-label="Sélection"
              required
              value={formData.statut}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  statut: e.target.value as ContratStatut,
                })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            >
              <option value="actif">Actif</option>
              <option value="expire">Expiré</option>
              <option value="resilie">Résilié</option>
              <option value="archive">Archivé</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Date de fin
            </label>
            <input aria-label="Champ de saisie"
              type="date"
              value={formData.date_fin}
              onChange={(e) =>
                setFormData({ ...formData, date_fin: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          {!isIndividualOwner && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Commission (%)
            </label>
            <input
              type="number"
              value={formData.commission}
              onChange={(e) =>
                setFormData({ ...formData, commission: e.target.value })
              }
              placeholder="Optionnel"
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND_COLORS.gray }}>
              Caution (F CFA)
            </label>
            <input
              type="number"
              value={formData.caution}
              onChange={(e) =>
                setFormData({ ...formData, caution: e.target.value })
              }
              placeholder="Optionnel"
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={submitting}
              className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-brand-700 text-white rounded-lg font-bold transition hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-premium"
            >
              {submitting ? 'Modification...' : 'Modifier le contrat'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
