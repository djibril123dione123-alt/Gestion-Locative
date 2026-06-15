import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { SkeletonCards, SkeletonTable } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import {
  Plus,
  Search,
  CreditCard,
  TrendingUp,
  Wallet,
  Percent,
  Clock,
  FileDown,
  Pencil,
  FileCheck2,
  Mail,
  ReceiptText,
  XCircle,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { generatePaiementFacturePDF } from '../lib/pdf';
import { useToast } from '../hooks/useToast';
import { useTracking } from '../hooks/useTracking';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { formatCurrency } from '../lib/formatters';
import {
  buildPaiementPayload,
  formatPaiementError,
} from '../services/domain/paiementService';
import { getPaymentMonthState } from '../services/domain/paymentSchedule';
import {
  createPaiementViaEdge,
  updatePaiementViaEdge,
  cancelPaiementViaEdge,
  PaiementApiError,
} from '../services/api/paiementApi';
import { emitEvent } from '../lib/eventBus';
import { PaiementFormModal } from '../components/paiements/PaiementFormModal';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { FinanceDrawer, FinanceInfoCard, FinanceKpiGrid, FinanceLine, FinancePageHeader, FinanceStatusTabs } from '../components/finance/FinancePrimitives';
import { getAgencyFinancialSummary, type AgencyFinancialSummary } from '../services/api/financeApi';
import {
  STATUS_LABELS,
  STATUS_LABEL_FALLBACK,
  MODE_LABELS,
  type PaiementRow,
  type ContratRow,
  type StatusFilter,
  type PaiementFormData,
} from '../components/paiements/paiementTypes';
import { formatPersonName } from '../lib/people';

interface PaiementsProps {
  embedded?: boolean;
}

// eslint-disable-next-line no-empty-pattern
export function Paiements({ }: PaiementsProps) {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { success, error: showError, toasts, removeToast } = useToast();
  const { track } = useTracking();
  const { isOnline } = useOfflineSync();

  const [paiements, setPaiements] = useState<PaiementRow[]>([]);
  const [contrats, setContrats] = useState<ContratRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tous');
  const [monthFilter, setMonthFilter] = useState('current');
  const [bailleurFilter, setBailleurFilter] = useState('all');
  const [editingPaiement, setEditingPaiement] = useState<PaiementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaiementRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [selectedPaiement, setSelectedPaiement] = useState<PaiementRow | null>(null);
  const [financeSummary, setFinanceSummary] = useState<AgencyFinancialSummary | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const today = new Date();
  const currentMonthYYYYMM = today.toISOString().slice(0, 7);

  const makeInitialForm = (): PaiementFormData => ({
    contrat_id: '',
    montant_total: '',
    mois_concerne: currentMonthYYYYMM + '-01',
    mois_display: currentMonthYYYYMM,
    date_paiement: today.toISOString().split('T')[0],
    mode_paiement: 'especes',
    statut: 'paye',
    reference: '',
  });

  const [formData, setFormData] = useState<PaiementFormData>(makeInitialForm);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPaiement(null);
    setFormData(makeInitialForm());
  };

  const loadData = async () => {
    if (!profile?.agency_id) return;
    try {
      if (paiements.length === 0) setLoading(true);
      const result = await readWithCache(
        { agencyId: profile.agency_id, userId: profile.id },
        'paiements-page',
        async () => {
          const [paiementsRes, contratsRes] = await Promise.all([
            supabase
              .from('paiements')
              .select('*, contrats(loyer_mensuel, commission, locataires(nom, prenom), unites(nom,id,immeubles(nom,bailleurs(id,nom,prenom))))')
              .eq('agency_id', profile.agency_id)
              .order('created_at', { ascending: false }),
            supabase
              .from('contrats')
              .select('id, date_debut, date_fin, loyer_mensuel, commission, locataires(nom, prenom), unites(nom, id, immeubles(nom,bailleurs(id,nom,prenom))))')
              .eq('agency_id', profile.agency_id)
              .eq('statut', 'actif'),
          ]);
          if (paiementsRes.error) throw paiementsRes.error;
          if (contratsRes.error) throw contratsRes.error;
          return {
            paiements: (paiementsRes.data || []) as unknown as PaiementRow[],
            contrats: (contratsRes.data || []) as unknown as ContratRow[],
          };
        },
        { timeoutMs: 7_000 },
      );

      setPaiements(result.data.paiements);
      setContrats(result.data.contrats);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
      const monthStart = `${currentMonthYYYYMM}-01`;
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
      getAgencyFinancialSummary({
        agencyId: profile.agency_id,
        start: monthStart,
        end: nextMonth,
      })
        .then(setFinanceSummary)
        .catch(() => setFinanceSummary(null));
    } catch {
      showError('Impossible de charger les paiements. Vérifiez votre connexion puis réessayez.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.agency_id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  // Listen for cross-component payment creation events (e.g. from LoyersImpayes)
  useEffect(() => {
    const handler = (event?: Event) => {
      const domains = event
        ? (event as CustomEvent<{ domains?: string[] }>).detail?.domains ?? []
        : [];
      if (domains.length === 0 || domains.includes('paiements')) {
        void loadData();
      }
    };
    window.addEventListener('paiement:refresh', handler);
    window.addEventListener('samaykeur:data-changed', handler);
    return () => {
      window.removeEventListener('paiement:refresh', handler);
      window.removeEventListener('samaykeur:data-changed', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  const filtered = useMemo(() => {
    let list = paiements.filter((p) => p.statut !== 'en_attente');
    if (statusFilter === 'paye') list = list.filter((p) => p.statut === 'paye' && Number(p.reliquat ?? 0) <= 3);
    if (statusFilter === 'partiel') list = list.filter((p) => p.statut === 'partiel' || Number(p.reliquat ?? 0) > 3);
    if (statusFilter === 'annule') list = list.filter((p) => p.statut === 'annule' || p.deleted_at);
    if (statusFilter === 'avance') list = list.filter((p) => Number(p.montant_total ?? 0) > Number(p.montant_attendu ?? p.contrats?.loyer_mensuel ?? 0));
    if (monthFilter !== 'all') {
      const targetMonth = monthFilter === 'current' ? currentMonthYYYYMM : monthFilter;
      list = list.filter((p) => (p.mois_concerne || '').slice(0, 7) === targetMonth);
    }
    if (bailleurFilter !== 'all') {
      list = list.filter((p) => p.contrats?.unites?.immeubles?.bailleurs?.id === bailleurFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) => {
        const loc = p.contrats?.locataires;
        const bailleur = p.contrats?.unites?.immeubles?.bailleurs;
        const searchable = [
          loc?.prenom,
          loc?.nom,
          p.contrats?.unites?.nom,
          p.contrats?.unites?.immeubles?.nom,
          bailleur?.prenom,
          bailleur?.nom,
          p.reference,
          p.mois_concerne,
          p.mode_paiement,
          p.statut,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(q);
      });
    }
    return list;
  }, [paiements, statusFilter, monthFilter, bailleurFilter, searchTerm, currentMonthYYYYMM]);

  const bailleurOptions = useMemo(() => {
    const map = new Map<string, string>();
    const addBailleur = (contrat?: PaiementRow['contrats'] | ContratRow | null) => {
      const bailleur = contrat?.unites?.immeubles?.bailleurs;
      if (bailleur?.id) {
        map.set(bailleur.id, formatPersonName(bailleur));
      }
    };
    paiements.forEach((row) => addBailleur(row.contrats));
    contrats.forEach((contrat) => addBailleur(contrat));
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [paiements, contrats]);

  const monthOptions = useMemo(() => {
    return [
      { value: 'current', label: 'Mois en cours' },
      { value: 'all', label: 'Tous les mois' },
      ...Array.from(new Set(paiements.map((p) => (p.mois_concerne || '').slice(0, 7)).filter(Boolean)))
        .sort()
        .reverse()
        .slice(0, 18)
        .map((month) => ({
          value: month,
          label: new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        })),
    ];
  }, [paiements]);

  const bailleurOptionsFilter = useMemo(() => {
    return [
      { value: 'all', label: 'Tous les bailleurs' },
      ...bailleurOptions.map(b => ({ value: b.id, label: b.label })),
    ];
  }, [bailleurOptions]);

  const kpis = useMemo(() => {
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);

    let encaisseMois = 0;
    let nbPaiementsMois = 0;
    let encaissePrev = 0;
    let reliquats = 0;

    paiements.forEach((p) => {
      const moisP = (p.mois_concerne || '').slice(0, 7);
      if (p.statut === 'paye' || p.statut === 'partiel') {
        if (moisP === currentMonthYYYYMM) {
          encaisseMois += Number(p.montant_total || 0);
          nbPaiementsMois++;
        } else if (moisP === prevMonth) {
          encaissePrev += Number(p.montant_total || 0);
        }
      }
      if (moisP === currentMonthYYYYMM && p.statut === 'partiel') {
        reliquats += Number(p.reliquat || 0);
      }
    });

    const attenduMois = contrats.reduce((s, c) => s + Number(c.loyer_mensuel || 0), 0);
    const tauxRecouvrement = attenduMois > 0 ? Math.round((encaisseMois / attenduMois) * 100) : 0;
    const variation =
      encaissePrev > 0
        ? Math.round(((encaisseMois - encaissePrev) / encaissePrev) * 100)
        : null;

    const avances = paiements
      .filter((p) => (p.mois_concerne || '').slice(0, 7) === currentMonthYYYYMM)
      .filter((p) => Number(p.montant_total ?? 0) > Number(p.montant_attendu ?? p.contrats?.loyer_mensuel ?? 0))
      .length;
    const partiels = paiements
      .filter((p) => (p.mois_concerne || '').slice(0, 7) === currentMonthYYYYMM)
      .filter((p) => p.statut === 'partiel' || Number(p.reliquat ?? 0) > 3)
      .length;

    return { encaisseMois, encaissePrev, nbPaiementsMois, reliquats, attenduMois, tauxRecouvrement, variation, avances, partiels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiements, contrats]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { tous: 0, paye: 0, partiel: 0, avance: 0, annule: 0 };
    paiements.forEach((p) => {
      if (p.statut === 'annule' || p.deleted_at) c.annule++;
      else if (Number(p.montant_total ?? 0) > Number(p.montant_attendu ?? p.contrats?.loyer_mensuel ?? 0)) c.avance++;
      else if (p.statut === 'partiel' || Number(p.reliquat ?? 0) > 3) c.partiel++;
      else if (p.statut === 'paye') c.paye++;
    });
    c.tous = c.paye + c.partiel + c.avance + c.annule;
    return c;
  }, [paiements]);

  const handleEdit = (paiement: PaiementRow) => {
    setEditingPaiement(paiement);
    setFormData({
      contrat_id: paiement.contrat_id,
      montant_total: paiement.montant_total.toString(),
      mois_display: paiement.mois_concerne.slice(0, 7),
      mois_concerne: paiement.mois_concerne,
      date_paiement: paiement.date_paiement,
      mode_paiement: paiement.mode_paiement as PaiementFormData['mode_paiement'],
      statut: paiement.statut === 'partiel' ? 'partiel' : 'paye',
      reference: paiement.reference || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;

    const montant = Number(formData.montant_total);
    if (!formData.contrat_id) {
      showError('Selectionnez le contrat concerne par ce paiement.');
      return;
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      showError('Le montant doit etre positif.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(formData.mois_display)) {
      showError('Selectionnez le mois concerne par le paiement.');
      return;
    }
    if (!formData.date_paiement || Number.isNaN(new Date(`${formData.date_paiement}T00:00:00`).getTime())) {
      showError('Selectionnez une date de paiement valide.');
      return;
    }

    const moisConcerne = `${formData.mois_display}-01`;
    setIsSaving(true);

    try {
      const contrat = contrats.find((c) => c.id === formData.contrat_id);
      if (!contrat) throw new Error('Contrat non trouvé');

      const monthState = getPaymentMonthState(
        contrat,
        paiements,
        formData.mois_display,
        editingPaiement?.id,
      );
      if (!editingPaiement && monthState?.isSold) {
        showError('Ce mois est deja solde pour ce contrat. Choisissez une autre echeance ou modifiez le paiement existant.');
        setIsSaving(false);
        return;
      }
      if (monthState && montant > monthState.remainingAmount) {
        showError(`Le reliquat de ce mois est de ${formatCurrency(monthState.remainingAmount)}. Impossible d'enregistrer un paiement superieur.`);
        setIsSaving(false);
        return;
      }

      const data = buildPaiementPayload(
        {
          contrat_id: formData.contrat_id,
          montant_total: montant,
          mois_concerne: moisConcerne,
          date_paiement: formData.date_paiement,
          mode_paiement: formData.mode_paiement,
          statut: formData.statut,
          reference: formData.reference || null,
        },
        {
          id: contrat.id,
          commission: contrat.commission ?? contrat.pourcentage_agence ?? null,
          loyer_mensuel: contrat.loyer_mensuel,
        },
        profile.agency_id,
      );

      if (!isOnline) {
        showError("Connexion indisponible : les paiements doivent etre confirmes par le serveur. Retablissez le reseau puis reessayez.");
        return;
      }

      if (editingPaiement) {
        await updatePaiementViaEdge({
          id: editingPaiement.id,
          montant_total: montant,
          mode_paiement: formData.mode_paiement as 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre',
          statut: formData.statut as 'paye' | 'partiel',
          date_paiement: formData.date_paiement,
          reference: formData.reference || null,
        });
        emitEvent({
          type: 'paiement.updated',
          agency_id: profile.agency_id,
          entity_type: 'paiements',
          entity_id: editingPaiement.id,
          payload: { montant, mode: formData.mode_paiement },
        });
      } else {
        const idempotencyKey = crypto.randomUUID();
        await createPaiementViaEdge({
          contrat_id: formData.contrat_id,
          montant_total: montant,
          mois_concerne: moisConcerne,
          date_paiement: formData.date_paiement,
          mode_paiement: formData.mode_paiement as 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre',
          statut: formData.statut as 'paye' | 'partiel',
          idempotency_key: idempotencyKey,
          reference: formData.reference || null,
        });
        track({
          action: 'paiement_create',
          entity_type: 'paiements',
          metadata: { montant: data.montant_total, mois: data.mois_concerne, mode: data.mode_paiement },
        });
        emitEvent({
          type: 'paiement.created',
          agency_id: profile.agency_id,
          entity_type: 'paiements',
          payload: { montant: data.montant_total, mois: data.mois_concerne, mode: data.mode_paiement },
        });
      }

      success(editingPaiement ? 'Paiement modifié avec succès' : 'Paiement enregistré avec succès');
      closeModal();
      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'paiements', 'impayes', 'contrats', 'finances'],
      );
      notifyDataChanged(['paiements', 'impayes', 'dashboard', 'finances', 'contrats']);
      await loadData();
    } catch (error: unknown) {
      if (error instanceof PaiementApiError) {
        showError(error.message);
      } else {
        showError(formatPaiementError(error));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (paiement: PaiementRow) => {
    setDeleteTarget(paiement);
  };

  const confirmDelete = async () => {
    if (!profile?.agency_id || !deleteTarget) return;
    if (!isOnline) {
      showError('Connexion indisponible : annulation impossible hors ligne.');
      return;
    }
    setIsDeleting(true);
    try {
      await cancelPaiementViaEdge({ id: deleteTarget.id });
      emitEvent({
        type: 'paiement.cancelled',
        agency_id: profile.agency_id,
        entity_type: 'paiements',
        entity_id: deleteTarget.id,
        payload: { montant: deleteTarget.montant_total },
      });
      success('Paiement annulé avec succès');
      setDeleteTarget(null);
      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'paiements', 'impayes', 'contrats', 'finances'],
      );
      notifyDataChanged(['paiements', 'impayes', 'dashboard', 'finances', 'contrats']);
      await loadData();
    } catch (error: unknown) {
      if (error instanceof PaiementApiError) {
        showError(error.message);
      } else {
        showError(
          error instanceof Error ? error.message : "Impossible d'annuler ce paiement",
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const exportFacture = async (paiementId: string) => {
    if (!profile?.agency_id) return;
    setExportingId(paiementId);
    try {
      const { data: pmt, error: e1 } = await supabase
        .from('paiements')
        .select(
          `id, created_at, date_paiement, mois_concerne, montant_total, montant_attendu, montant_encaisse_cumul, reliquat, reference, statut,
           contrats(id, loyer_mensuel, commission, locataires(nom, prenom), unites(id, nom))`,
        )
        .eq('agency_id', profile.agency_id)
        .eq('id', paiementId)
        .single();

      const paiement = pmt as unknown as {
        id: string;
        created_at: string;
        date_paiement: string;
        mois_concerne: string;
        montant_total: number;
        montant_attendu?: number | null;
        montant_encaisse_cumul?: number | null;
        reliquat?: number | null;
        reference: string | null;
        statut: string;
        contrats: {
          id: string;
          loyer_mensuel: number;
          commission: number;
          locataires: { nom: string; prenom: string } | null;
          unites: { id: string; nom: string } | null;
        } | null;
      };

      if (e1 || !paiement?.contrats?.locataires || !paiement.contrats.unites) {
        throw new Error('Données de facturation incomplètes.');
      }

      let adresse = '—';
      const paiementCreatedAt = new Date(paiement.created_at).getTime();
      const paiementsPrecedents = paiements
        .filter((row) => {
          if (row.id === paiement.id) return false;
          if (row.contrat_id !== paiement.contrats?.id) return false;
          if ((row.mois_concerne || '').slice(0, 7) !== paiement.mois_concerne.slice(0, 7)) return false;
          if (row.statut !== 'paye' && row.statut !== 'partiel') return false;
          return new Date(row.created_at ?? '').getTime() < paiementCreatedAt;
        })
        .reduce((sum, row) => sum + Number(row.montant_total || 0), 0);
      const totalPayeMois = paiement.montant_encaisse_cumul ?? (paiementsPrecedents + Number(paiement.montant_total || 0));

      try {
        const { data: u } = await supabase
          .from('unites')
          .select('immeubles(adresse)')
          .eq('agency_id', profile.agency_id)
          .eq('id', paiement.contrats.unites.id)
          .maybeSingle();
        const uniteRow = u as unknown as { immeubles: { adresse: string } | null } | null;
        if (uniteRow?.immeubles?.adresse) adresse = uniteRow.immeubles.adresse;
      } catch {
        /* fallback silencieux uniquement pour l'adresse */
      }

      const payload = {
        ...paiement,
        paiements_precedents: paiementsPrecedents,
        total_paye_mois: totalPayeMois,
        statut_reel_mois: Number(paiement.reliquat || 0) > 0 ? 'Partiel' : 'Soldé',
        contrats: {
          ...paiement.contrats,
          unites: { ...paiement.contrats.unites, immeubles: { adresse } },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generatePaiementFacturePDF(payload as any);
      success('Facture générée avec succès');
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : 'Impossible de générer la facture PDF',
      );
    } finally {
      setExportingId(null);
    }
  };

  const ALL_COLUMN_KEYS = ['locataire', 'unite', 'mois_concerne', 'montant_total', 'reliquat', 'date_paiement', 'mode', 'statut'];
  const { visibility, toggle, setAll, isVisible } = useColumnVisibility('paiements', ALL_COLUMN_KEYS, {});

  const allColumns = [
    {
      key: 'locataire',
      label: 'Locataire',
      render: (p: PaiementRow) =>
        formatPersonName(p.contrats?.locataires),
    },
    {
      key: 'unite',
      label: 'Bien / unité',
      render: (p: PaiementRow) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{p.contrats?.unites?.immeubles?.nom || '-'}</p>
          <p className="truncate text-xs font-medium text-slate-500">{p.contrats?.unites?.nom || '-'}</p>
        </div>
      ),
    },
    {
      key: 'mois_concerne',
      label: 'Période',
      render: (p: PaiementRow) =>
        new Date(p.mois_concerne).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
    },
    {
      key: 'montant_total',
      label: 'Montant reçu',
      render: (p: PaiementRow) => (
        <MoneyText value={p.montant_total} className="font-black text-emerald-800" />
      ),
    },
    {
      key: 'reliquat',
      label: 'Reliquat',
      render: (p: PaiementRow) => (
        <span className={`font-semibold tabular-nums ${Number(p.reliquat || 0) > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
          <MoneyText value={Number(p.reliquat || 0)} />
        </span>
      ),
    },
    {
      key: 'date_paiement',
      label: 'Date paiement',
      render: (p: PaiementRow) => new Date(p.date_paiement).toLocaleDateString('fr-FR'),
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (p: PaiementRow) => (
        <span className="text-slate-600 text-sm">
          {MODE_LABELS[p.mode_paiement] || p.mode_paiement}
        </span>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (p: PaiementRow) => {
        const s = getPaiementStatusMeta(p);
        const Icon = s.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.classes}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {s.label}
          </span>
        );
      },
    },
  ];

  const columns = allColumns.filter((c) => isVisible(c.key));

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'tous', label: 'Tous', count: counts.tous },
    { id: 'paye', label: 'Soldés', count: counts.paye },
    { id: 'partiel', label: 'Partiels', count: counts.partiel },
    { id: 'avance', label: 'Avances', count: counts.avance },
    { id: 'annule', label: 'Annulés', count: counts.annule },
  ];

  const getPaiementStatusMeta = (p: PaiementRow) => {
    if (p.statut === 'annule' || p.deleted_at) return STATUS_LABELS.annule;
    if (Number(p.montant_total ?? 0) > Number(p.montant_attendu ?? p.contrats?.loyer_mensuel ?? 0)) {
      return {
        label: 'Avance',
        classes: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: TrendingUp,
      };
    }
    if (p.statut === 'partiel' || Number(p.reliquat ?? 0) > 3) return STATUS_LABELS.partiel;
    return STATUS_LABELS[p.statut] ?? STATUS_LABEL_FALLBACK;
  };

  const summaryBase = financeSummary
    ? Number(financeSummary.loyers_encaisses || 0) + Number(financeSummary.reliquats_ouverts || 0)
    : kpis.attenduMois;
  const summaryRecoveryRate = summaryBase > 0
    ? Math.round((Number(financeSummary?.loyers_encaisses ?? kpis.encaisseMois) / summaryBase) * 100)
    : kpis.tauxRecouvrement;
  const financeMetrics = [
    {
      label: 'Encaissements du mois',
      value: <MoneyText value={financeSummary?.loyers_encaisses ?? kpis.encaisseMois} />,
      helper: `${financeSummary?.paiements_count ?? kpis.nbPaiementsMois} paiement${(financeSummary?.paiements_count ?? kpis.nbPaiementsMois) > 1 ? 's' : ''}`,
      icon: Wallet,
      tone: 'emerald' as const,
    },
    {
      label: 'Paiements reçus',
      value: financeSummary?.paiements_count ?? kpis.nbPaiementsMois,
      helper: 'Ce mois',
      icon: CreditCard,
      tone: 'slate' as const,
    },
    {
      label: 'Paiements partiels',
      value: kpis.partiels,
      helper: 'À suivre',
      icon: Clock,
      tone: 'amber' as const,
    },
    {
      label: 'Avances / trop-perçus',
      value: kpis.avances,
      helper: 'Ce mois',
      icon: TrendingUp,
      tone: 'blue' as const,
    },
    {
      label: 'Commissions agence',
      value: <MoneyText value={financeSummary?.commissions_agence ?? 0} />,
      helper: 'Revenus agence',
      icon: Percent,
      tone: 'green' as const,
    },
    {
      label: 'Taux de recouvrement',
      value: `${summaryRecoveryRate}%`,
      helper: <MoneyText value={financeSummary?.loyers_encaisses ?? kpis.encaisseMois} suffix={`/ ${formatCurrency(summaryBase)}`} />,
      icon: FileCheck2,
      tone: summaryRecoveryRate >= 80 ? 'emerald' as const : 'amber' as const,
    },
  ];

  const selectedStatus = selectedPaiement ? getPaiementStatusMeta(selectedPaiement) : null;
  const selectedLoyerAttendu = selectedPaiement
    ? Number(selectedPaiement.montant_attendu ?? selectedPaiement.contrats?.loyer_mensuel ?? 0)
    : 0;
  const selectedTotalEncaisse = selectedPaiement
    ? Number(selectedPaiement.montant_encaisse_cumul ?? selectedPaiement.montant_total ?? 0)
    : 0;
  const selectedReliquat = selectedPaiement ? Number(selectedPaiement.reliquat ?? 0) : 0;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="sk-page-shell space-y-6">
        <FinancePageHeader
          eyebrow="Encaissement & finance"
          title={isIndividualOwner ? 'Mes loyers reçus' : 'Paiements reçus'}
          description={
            isIndividualOwner
              ? 'Suivez les loyers validés, paiements partiels, avances et quittances générées.'
              : 'Suivez les encaissements validés, paiements partiels, avances et quittances générées.'
          }
          primaryLabel="Nouveau paiement"
          primaryIcon={<Plus className="h-4 w-4" />}
          onPrimary={() => setIsModalOpen(true)}
        />

        <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-emerald-950/10">
          <Tabs
            tabs={[
              { id: 'paiements', label: 'Paiements reçus', icon: CreditCard },
              { id: 'loyers-impayes', label: 'Créances à recouvrer', icon: AlertCircle },
            ]}
            activeId="paiements"
            onChange={(id) => { window.location.hash = `#/${id}`; }}
          />
        </div>

        {cacheTimestamp && (
          <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadData} retrying={loading} />
        )}

        {loading ? (
          <SkeletonCards count={6} />
        ) : (
          <FinanceKpiGrid metrics={financeMetrics} />
        )}

        <div className="sk-premium-panel relative z-20 overflow-visible p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 relative min-w-0 flex-1">
              <div className="relative min-w-0 flex-1 lg:max-w-[280px] xl:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher..."
                  className="lg:hidden h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un locataire, contrat, référence..."
                  className="hidden lg:block h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div className="flex shrink-0 gap-2 items-center lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#fffdf8] px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtres
                </button>
                <ColumnPicker
                  columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
                  visibility={visibility}
                  onToggle={toggle}
                  onSetAll={setAll}
                />
              </div>
            </div>

            <div className="hidden lg:flex min-w-0 flex-row gap-2 items-center">
              <SmartCombobox
                value={monthFilter}
                options={monthOptions}
                onChange={setMonthFilter}
                placeholder="Période"
                searchPlaceholder="Rechercher une période..."
                className="w-48"
              />

              {!isIndividualOwner && (
                <SmartCombobox
                  value={bailleurFilter}
                  options={bailleurOptionsFilter}
                  onChange={setBailleurFilter}
                  placeholder="Tous les bailleurs"
                  searchPlaceholder="Rechercher un bailleur..."
                  className="w-56"
                />
              )}

              <ColumnPicker
                columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
                visibility={visibility}
                onToggle={toggle}
                onSetAll={setAll}
              />
            </div>
          </div>

          <div className="flex items-center">
            <FinanceStatusTabs tabs={statusFilters} active={statusFilter} onChange={setStatusFilter} />
          </div>

          <MobileFilterSheet
            isOpen={mobileFiltersOpen}
            title="Filtres Paiements"
            onClose={() => setMobileFiltersOpen(false)}
            onReset={() => {
              setMonthFilter('current');
              setBailleurFilter('all');
            }}
          >
            <div className="grid gap-3">
              <SmartCombobox
                value={monthFilter}
                options={monthOptions}
                onChange={setMonthFilter}
                placeholder="Période"
                searchPlaceholder="Rechercher une période..."
              />
              {!isIndividualOwner && (
                <SmartCombobox
                  value={bailleurFilter}
                  options={bailleurOptionsFilter}
                  onChange={setBailleurFilter}
                  placeholder="Tous les bailleurs"
                  searchPlaceholder="Rechercher un bailleur..."
                />
              )}
            </div>
          </MobileFilterSheet>
        </div>

        {loading ? (
          <div className="sk-premium-panel p-4 sm:p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="sk-card">
            <EmptyState
              icon={CreditCard}
              title={
                statusFilter === 'tous' && !searchTerm
                  ? 'Aucun paiement enregistré'
                  : 'Aucun résultat'
              }
              description={
                statusFilter === 'tous' && !searchTerm
                  ? 'Commencez par enregistrer un premier encaissement de loyer.'
                  : 'Essayez un autre filtre ou élargissez votre recherche.'
              }
              action={
                statusFilter === 'tous' && !searchTerm
                  ? { label: 'Nouveau paiement', onClick: () => setIsModalOpen(true) }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="sk-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table
                columns={columns}
                data={filtered}
                onRowClick={(p) => setSelectedPaiement(p)}
              />
            </div>
          </div>
        )}

        <PaiementFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          editingPaiement={editingPaiement}
          formData={formData}
          setFormData={setFormData}
          contrats={contrats}
          paiements={paiements}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          isOnline={isOnline}
        />

        {selectedPaiement && selectedStatus && (
          <FinanceDrawer
            title={`Paiement ${selectedPaiement.reference || selectedPaiement.id.slice(0, 8)}`}
            subtitle={`Enregistré le ${new Date(selectedPaiement.date_paiement).toLocaleDateString('fr-FR')} · ${formatPersonName(selectedPaiement.contrats?.locataires, 'Locataire')}`}
            onClose={() => setSelectedPaiement(null)}
            badge={(() => {
              const Icon = selectedStatus.icon;
              return (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${selectedStatus.classes}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {selectedStatus.label}
                </span>
              );
            })()}
            actions={
              <>
                <PremiumButton
                  variant="primary"
                  size="sm"
                  icon={<ReceiptText className="h-4 w-4" />}
                  onClick={() => exportFacture(selectedPaiement.id)}
                  disabled={exportingId === selectedPaiement.id}
                >
                  Voir quittance
                </PremiumButton>
                <PremiumButton
                  variant="secondary"
                  size="sm"
                  icon={<FileDown className="h-4 w-4" />}
                  onClick={() => exportFacture(selectedPaiement.id)}
                  disabled={exportingId === selectedPaiement.id}
                >
                  Télécharger PDF
                </PremiumButton>
                <PremiumButton
                  variant="secondary"
                  size="sm"
                  icon={<Mail className="h-4 w-4" />}
                  disabled
                  title="Envoi email à brancher sur le service notification"
                >
                  Envoyer
                </PremiumButton>
              </>
            }
          >
            <div className="space-y-4">
              <FinanceInfoCard title="Résumé paiement">
                <FinanceLine label="Montant reçu" value={<MoneyText value={selectedPaiement.montant_total} className="font-black text-emerald-800" />} strong />
                <FinanceLine
                  label="Période"
                  value={new Date(selectedPaiement.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                />
                <FinanceLine label="Date paiement" value={new Date(selectedPaiement.date_paiement).toLocaleDateString('fr-FR')} />
                <FinanceLine label="Mode paiement" value={MODE_LABELS[selectedPaiement.mode_paiement] || selectedPaiement.mode_paiement} />
                <FinanceLine label="Référence" value={selectedPaiement.reference || '—'} />
              </FinanceInfoCard>

              <FinanceInfoCard title="Affectation">
                <FinanceLine label="Locataire" value={formatPersonName(selectedPaiement.contrats?.locataires, '—')} />
                <FinanceLine label="Bien / unité" value={`${selectedPaiement.contrats?.unites?.immeubles?.nom || '—'} · ${selectedPaiement.contrats?.unites?.nom || '—'}`} />
                <FinanceLine label={isIndividualOwner ? 'Propriétaire' : 'Bailleur'} value={formatPersonName(selectedPaiement.contrats?.unites?.immeubles?.bailleurs, '—')} />
                <FinanceLine label="Contrat" value={selectedPaiement.contrat_id.slice(0, 8).toUpperCase()} />
              </FinanceInfoCard>

              <FinanceInfoCard title="Impact financier">
                <FinanceLine label="Loyer attendu" value={<MoneyText value={selectedLoyerAttendu} />} />
                <FinanceLine label="Total déjà encaissé" value={<MoneyText value={selectedTotalEncaisse} />} />
                <FinanceLine label="Reliquat" value={<MoneyText value={selectedReliquat} className={selectedReliquat > 3 ? 'text-orange-700' : 'text-emerald-700'} />} />
                <FinanceLine label="Commission agence" value={<MoneyText value={selectedPaiement.part_agence ?? 0} />} />
                <FinanceLine label="Net bailleur" value={<MoneyText value={selectedPaiement.part_bailleur ?? Math.max(selectedTotalEncaisse - Number(selectedPaiement.part_agence ?? 0), 0)} className="font-black text-emerald-800" />} strong />
              </FinanceInfoCard>

              <FinanceInfoCard title="Documents liés">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">Quittance / facture</p>
                      <p className="text-xs font-semibold text-slate-500">QR vérifiable selon registre documentaire</p>
                    </div>
                  </div>
                  <PremiumButton
                    variant="secondary"
                    size="sm"
                    icon={<FileDown className="h-4 w-4" />}
                    onClick={() => exportFacture(selectedPaiement.id)}
                  >
                    PDF
                  </PremiumButton>
                </div>
              </FinanceInfoCard>

              <FinanceInfoCard title="Historique">
                {[
                  { label: 'Paiement enregistré', detail: selectedPaiement.created_at || selectedPaiement.date_paiement, isDate: true },
                  { label: 'Écriture ledger créée', detail: 'Journal de caisse', isDate: false },
                  { label: 'Quittance générable', detail: 'Document prêt', isDate: false },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-700" />
                    <div>
                      <p className="text-sm font-black text-slate-900">{item.label}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {item.isDate && item.detail ? new Date(item.detail).toLocaleString('fr-FR') : item.detail || '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </FinanceInfoCard>

              <FinanceInfoCard title="Actions contrôlées">
                <div className="grid grid-cols-1 gap-2">
                  <PremiumButton
                    variant="secondary"
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => {
                      handleEdit(selectedPaiement);
                      setSelectedPaiement(null);
                    }}
                    fullWidth
                  >
                    Corriger / réconcilier
                  </PremiumButton>
                  <PremiumButton
                    variant="danger"
                    icon={<XCircle className="h-4 w-4" />}
                    onClick={() => {
                      handleDelete(selectedPaiement);
                      setSelectedPaiement(null);
                    }}
                    fullWidth
                  >
                    Annuler le paiement
                  </PremiumButton>
                </div>
              </FinanceInfoCard>
            </div>
          </FinanceDrawer>
        )}

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Annuler ce paiement"
          message="Le paiement sera annulé via le workflow serveur et conservé dans l'historique financier. Aucune suppression physique ne sera effectuée."
          confirmText="Annuler le paiement"
          cancelText="Annuler"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    </>
  );
}
