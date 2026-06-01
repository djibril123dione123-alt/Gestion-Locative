import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Wallet, Building2, CalendarDays, ReceiptText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../lib/formatters';
import { formatPaiementError } from '../services/domain/paiementService';
import { createPaiementViaEdge, PaiementApiError } from '../services/api/paiementApi';
import { emitEvent } from '../lib/eventBus';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { LoadingState } from '../components/ui/LoadingState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { invalidateOperationalCaches, loadCachedValue, notifyDataChanged, saveCachedValue, withReadTimeout } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';

const ITEMS_PER_PAGE = 20;
const LOOKBACK_MONTHS = 12;
const LOOKAHEAD_MONTHS = 2;

type LoyerStatut = 'a_venir' | 'en_retard' | 'partiel' | 'paye_en_avance';

interface LoyerImpaye {
  id: string;
  locataire_nom: string;
  locataire_prenom: string;
  unite_nom: string;
  immeuble_nom: string;
  bailleur_nom: string;
  bailleur_prenom: string;
  montant_attendu: number;
  montant_encaisse: number;
  montant_du: number;
  mois_concerne: string;
  date_echeance: string;
  statut: LoyerStatut;
  telephone_locataire: string;
}

interface LoyersImpayesProps {
  embedded?: boolean;
}

interface BailleurOption {
  label: string;
}

interface ContratActifRow {
  id: string;
  loyer_mensuel: number;
  date_debut: string;
  date_fin?: string | null;
  locataires?: { nom?: string | null; prenom?: string | null; telephone?: string | null } | null;
  unites?: {
    nom?: string | null;
    immeubles?: {
      nom?: string | null;
      bailleurs?: { nom?: string | null; prenom?: string | null } | null;
    } | null;
  } | null;
}

interface PaiementAggregate {
  contrat_id: string;
  mois_concerne: string;
  statut: string;
  montant_total: number | null;
  date_paiement?: string | null;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function getDueDateForMonth(month: string, contractStart: string): Date {
  const monthDate = new Date(month);
  const startDate = new Date(contractStart);
  const desiredDay = Number.isFinite(startDate.getDate()) ? startDate.getDate() : 1;
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(desiredDay, lastDay));
}

function generateContractMonths(contract: ContratActifRow, today: Date): string[] {
  const startLimit = addMonths(monthStart(today), -LOOKBACK_MONTHS);
  const endLimit = addMonths(monthStart(today), LOOKAHEAD_MONTHS);
  const contractStart = monthStart(new Date(contract.date_debut));
  const contractEnd = contract.date_fin ? monthStart(new Date(contract.date_fin)) : endLimit;
  const start = contractStart > startLimit ? contractStart : startLimit;
  const end = contractEnd < endLimit ? contractEnd : endLimit;

  const months: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(monthKey(cursor));
  }
  return months;
}

const STATUS_META: Record<LoyerStatut, { label: string; classes: string }> = {
  a_venir: { label: 'À venir', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  en_retard: { label: 'En retard', classes: 'bg-red-100 text-red-700 border-red-200' },
  partiel: { label: 'Partiel', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
  paye_en_avance: { label: 'Payé en avance', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function LoyersImpayes(_props: LoyersImpayesProps = {}) {
  const { embedded = false } = _props;
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const [impayes, setImpayes] = useState<LoyerImpaye[]>([]);
  const [filtered, setFiltered] = useState<LoyerImpaye[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBailleur, setSelectedBailleur] = useState('');
  const [bailleurs, setBailleurs] = useState<BailleurOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLoyer, setSelectedLoyer] = useState<LoyerImpaye | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    montant: '',
    date_paiement: toDateInput(new Date()),
    mode_paiement: 'especes',
    reference: '',
  });
  const [page, setPage] = useState(1);
  const requestIdRef = useRef(0);
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  useEffect(() => {
    let result = impayes;

    if (searchTerm) {
      result = result.filter(i =>
        `${i.locataire_prenom} ${i.locataire_nom} ${i.unite_nom} ${i.immeuble_nom}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    if (selectedBailleur) {
      result = result.filter(i =>
        `${i.bailleur_prenom} ${i.bailleur_nom}` === selectedBailleur
      );
    }

    setFiltered(result);
  }, [searchTerm, selectedBailleur, impayes]);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    const reqId = ++requestIdRef.current;
    if (impayes.length === 0) setLoading(true);
    setError(null);
    const cacheScope = { agencyId: profile.agency_id, userId: profile.id };
    const cacheKey = 'loyers-impayes-page';
    try {
      const cached = await loadCachedValue<{ impayes: LoyerImpaye[]; bailleurs: BailleurOption[] }>(cacheScope, cacheKey);
      if (!isOnline && cached) {
        setImpayes(cached.data.impayes);
        setFiltered(cached.data.impayes);
        setBailleurs(cached.data.bailleurs);
        setPage(1);
        setCacheTimestamp(cached.timestamp);
        return;
      }

      const { data: contratsActifs, error: contratsError } = await withReadTimeout(
        supabase
          .from('contrats')
          .select(`
            id,
            loyer_mensuel,
            date_debut,
            date_fin,
            locataires(nom, prenom, telephone),
            unites(
              nom,
              immeubles(
                nom,
                bailleurs(nom, prenom)
              )
            )
          `)
          .eq('statut', 'actif')
          .eq('agency_id', profile.agency_id),
        7_000,
      );
      if (contratsError) throw contratsError;

      const contratsRows = ((contratsActifs ?? []) as ContratActifRow[]);
      const contratIds = contratsRows.map((c) => c.id);
      const currentDate = new Date();
      const startPeriod = monthKey(addMonths(monthStart(currentDate), -LOOKBACK_MONTHS));
      const endPeriod = monthKey(addMonths(monthStart(currentDate), LOOKAHEAD_MONTHS));

      if (contratIds.length === 0) {
        setImpayes([]);
        setFiltered([]);
        setBailleurs([]);
        setPage(1);
        return;
      }

      const { data: paiementsExistants, error: paiementsError } = await withReadTimeout(
        supabase
          .from('paiements')
          .select('contrat_id, mois_concerne, statut, montant_total, date_paiement')
          .eq('agency_id', profile.agency_id)
          .in('contrat_id', contratIds)
          .gte('mois_concerne', startPeriod)
          .lte('mois_concerne', endPeriod),
        7_000,
      );
      if (paiementsError) throw paiementsError;

      const paiementsMap = new Map<string, { amount: number; earliestDate: string | null }>();
      (paiementsExistants as PaiementAggregate[] | null)?.forEach(p => {
        if (p.statut !== 'paye' && p.statut !== 'partiel') return;
        const key = `${p.contrat_id}-${p.mois_concerne}`;
        const existing = paiementsMap.get(key) ?? { amount: 0, earliestDate: null };
        const paymentDate = p.date_paiement ?? null;
        paiementsMap.set(key, {
          amount: existing.amount + Number(p.montant_total || 0),
          earliestDate:
            !existing.earliestDate || (paymentDate && paymentDate < existing.earliestDate)
              ? paymentDate
              : existing.earliestDate,
        });
      });

      const impayesList: LoyerImpaye[] = [];

      contratsRows.forEach((contrat) => {
        generateContractMonths(contrat, currentDate).forEach(mois => {
          const key = `${contrat.id}-${mois}`;
          const paiementInfo = paiementsMap.get(key) ?? { amount: 0, earliestDate: null };
          const montantEncaisse = paiementInfo.amount;
          const montantAttendu = Number(contrat.loyer_mensuel || 0);
          const montantDu = Math.max(montantAttendu - montantEncaisse, 0);
          const dueDate = getDueDateForMonth(mois, contrat.date_debut);
          const isFutureMonth = monthStart(new Date(mois)) > monthStart(currentDate);
          const paidBeforePeriod =
            Boolean(paiementInfo.earliestDate) &&
            new Date(paiementInfo.earliestDate as string) < new Date(mois);

          let statut: LoyerStatut | null = null;
          if (montantDu <= 0 && (isFutureMonth || paidBeforePeriod)) {
            statut = 'paye_en_avance';
          } else if (montantDu > 0 && montantEncaisse > 0) {
            statut = 'partiel';
          } else if (montantDu > 0 && dueDate > currentDate) {
            statut = 'a_venir';
          } else if (montantDu > 0) {
            statut = 'en_retard';
          }

          if (statut) {
            impayesList.push({
              id: `${contrat.id}-${mois}`,
              locataire_nom: contrat.locataires?.nom || '',
              locataire_prenom: contrat.locataires?.prenom || '',
              unite_nom: contrat.unites?.nom || '',
              immeuble_nom: contrat.unites?.immeubles?.nom || '',
              bailleur_nom: contrat.unites?.immeubles?.bailleurs?.nom || '',
              bailleur_prenom: contrat.unites?.immeubles?.bailleurs?.prenom || '',
              montant_attendu: montantAttendu,
              montant_encaisse: montantEncaisse,
              montant_du: montantDu,
              mois_concerne: mois,
              date_echeance: toDateInput(dueDate),
              statut,
              telephone_locataire: contrat.locataires?.telephone || '',
            });
          }
        });
      });

      if (reqId !== requestIdRef.current) return;

      impayesList.sort((a, b) => {
        const priority: Record<LoyerStatut, number> = { en_retard: 0, partiel: 1, a_venir: 2, paye_en_avance: 3 };
        return priority[a.statut] - priority[b.statut] || a.mois_concerne.localeCompare(b.mois_concerne);
      });

      setImpayes(impayesList);
      setFiltered(impayesList);
      setPage(1);

      const uniqueBailleurs = Array.from(
        new Set(impayesList.map(i => `${i.bailleur_prenom} ${i.bailleur_nom}`))
      ).filter(b => b.trim());
      const nextBailleurs = uniqueBailleurs.map(b => ({ label: b }));
      setBailleurs(nextBailleurs);
      setCacheTimestamp(null);
      saveCachedValue(cacheScope, cacheKey, { impayes: impayesList, bailleurs: nextBailleurs }).catch(() => {});

    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const cached = await loadCachedValue<{ impayes: LoyerImpaye[]; bailleurs: BailleurOption[] }>(cacheScope, cacheKey);
      if (cached) {
        setImpayes(cached.data.impayes);
        setFiltered(cached.data.impayes);
        setBailleurs(cached.data.bailleurs);
        setPage(1);
        setCacheTimestamp(cached.timestamp);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des loyers impayés');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [impayes.length, isOnline, profile?.agency_id, profile?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [loadData, profile?.agency_id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const domains = (event as CustomEvent<{ domains?: string[] }>).detail?.domains ?? [];
      if (domains.length === 0 || domains.includes('impayes')) {
        void loadData();
      }
    };
    window.addEventListener('samaykeur:data-changed', handler);
    return () => window.removeEventListener('samaykeur:data-changed', handler);
  }, [loadData]);


  const handlePayerClick = (loyer: LoyerImpaye) => {
    setSelectedLoyer(loyer);
    setPaymentForm({
      montant: String(loyer.montant_du || ''),
      date_paiement: toDateInput(new Date()),
      mode_paiement: 'especes',
      reference: '',
    });
    setShowModal(true);
  };

  const handleConfirmPaiement = async () => {
    if (!selectedLoyer || !profile?.agency_id) return;
    if (!isOnline) {
      toast.error('Connexion indisponible : le paiement doit etre confirme par le serveur.');
      return;
    }
    setSubmitting(true);
    try {
      const montantSaisi = Number(paymentForm.montant);
      if (!Number.isFinite(montantSaisi) || montantSaisi <= 0) {
        throw new Error('Le montant du paiement doit etre superieur a zero.');
      }

      // L'id est de la forme "<uuid>-YYYY-MM". On extrait l'UUID via regex
      // plutôt qu'un slice fragile.
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = selectedLoyer.id.match(UUID_REGEX);
      if (!match) {
        throw new Error('Identifiant de loyer invalide');
      }
      const contratId = match[0];

      // Creation via Edge Function (validation Zod + commission + agency_id cote serveur)
      // Le trigger trg_update_bilan_mensuel met a jour bilans_mensuels automatiquement.
      await createPaiementViaEdge({
        contrat_id: contratId,
        montant_total: montantSaisi,
        mois_concerne: selectedLoyer.mois_concerne,
        date_paiement: paymentForm.date_paiement,
        mode_paiement: paymentForm.mode_paiement as 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'autre',
        statut: montantSaisi >= selectedLoyer.montant_du ? 'paye' : 'partiel',
        reference: paymentForm.reference.trim() || null,
      });

      emitEvent({
        type: 'paiement.created',
        agency_id: profile.agency_id,
        entity_type: 'paiements',
        payload: { source: 'loyers_impayes', montant: montantSaisi, mois: selectedLoyer.mois_concerne },
      });

      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'paiements', 'impayes', 'contrats', 'finances'],
      );
      notifyDataChanged(['paiements', 'impayes', 'dashboard', 'finances', 'contrats']);

      toast.success('Paiement enregistré avec succès');
      setShowModal(false);
      setSelectedLoyer(null);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof PaiementApiError) {
        toast.error(err.message);
      } else {
        toast.error(formatPaiementError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalImpaye = filtered.reduce((sum, i) => sum + i.montant_du, 0);
  const totalEnRetard = filtered
    .filter((i) => i.statut === 'en_retard' || i.statut === 'partiel')
    .reduce((sum, i) => sum + i.montant_du, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paymentAmount = Number(paymentForm.montant || 0);
  const remainingAfterPayment = selectedLoyer
    ? Math.max(selectedLoyer.montant_du - paymentAmount, 0)
    : 0;
  const advanceAfterPayment = selectedLoyer
    ? Math.max(paymentAmount - selectedLoyer.montant_du, 0)
    : 0;

  const ALL_COLUMN_KEYS_LOYERS = ['locataire', 'unite_nom', 'immeuble_nom', 'bailleur', 'mois_concerne', 'statut', 'montant_encaisse', 'montant_du', 'telephone_locataire', 'actions'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('loyersImpayes', [...ALL_COLUMN_KEYS_LOYERS]);

  const allColumns = [
    {
      key: 'locataire',
      label: 'Locataire',
      render: (i: LoyerImpaye) => `${i.locataire_prenom} ${i.locataire_nom}`,
    },
    { key: 'unite_nom', label: 'Produit' },
    { key: 'immeuble_nom', label: 'Immeuble' },
    {
      key: 'bailleur',
      label: 'Bailleur',
      render: (i: LoyerImpaye) => `${i.bailleur_prenom} ${i.bailleur_nom}`,
    },
    {
      key: 'mois_concerne',
      label: 'Mois',
      render: (i: LoyerImpaye) =>
        new Date(i.mois_concerne).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
        }),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (i: LoyerImpaye) => {
        const meta = STATUS_META[i.statut];
        return (
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.classes}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'montant_encaisse',
      label: 'Encaissé',
      render: (i: LoyerImpaye) => formatCurrency(i.montant_encaisse),
    },
    {
      key: 'montant_du',
      label: 'Montant dû',
      render: (i: LoyerImpaye) => formatCurrency(i.montant_du),
    },
    { key: 'telephone_locataire', label: 'Téléphone' },
    {
      key: 'actions',
      label: 'Action',
      render: (i: LoyerImpaye) => (
        i.montant_du > 0 ? (
          <button
            type="button"
            onClick={() => handlePayerClick(i)}
            className="sk-action sk-action-financial"
          >
            Payer ce loyer
          </button>
        ) : (
          <span className="text-xs font-semibold text-emerald-700">Soldé</span>
        )
      ),
    },
  ];
  const columns = allColumns.filter((c) => {
    if (isIndividualOwner && c.key === 'bailleur') return false;
    return c.key === 'actions' || colIsVisible(c.key);
  });

  if (loading) {
    return (
      <LoadingState
        label="Loyers impayés"
        description="Analyse des échéances, reliquats et paiements partiels."
        compact
        className="min-h-[45vh]"
      />
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <div>
            <p className="font-semibold text-red-800 mb-1">Erreur de chargement</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sk-page-shell space-y-5">
      {cacheTimestamp && (
        <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadData} retrying={loading} />
      )}

      {!embedded && (
        <div className="sk-page-hero flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              {isIndividualOwner ? 'Mes impayés' : 'Loyers impayés'}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">
              {isIndividualOwner
                ? 'Suivez vos loyers en retard, les reliquats et les paiements partiels.'
                : 'Suivi des loyers en retard, reliquats et paiements partiels'}
            </p>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sk-metric-tile border-red-200/80 p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 rounded-lg bg-red-50 text-red-600">
              <AlertCircle className="w-5 sm:w-6 h-5 sm:h-6" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-sm">Retards et reliquats</h3>
              <p className="mt-1 text-lg font-extrabold text-red-600 sm:text-2xl">{formatCurrency(totalEnRetard)}</p>
            </div>
          </div>
        </div>

        <div className="sk-metric-tile p-4 sm:p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-sm">Échéances ouvertes</h3>
          <p className="text-lg font-extrabold text-slate-950 sm:text-2xl">{filtered.length}</p>
        </div>

        <div className="sk-metric-tile p-4 sm:p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-sm">Solde a recouvrer</h3>
          <p className="text-lg font-extrabold text-slate-950 sm:text-2xl">
            {formatCurrency(totalImpaye)}
          </p>
        </div>
      </div>

      {/* Filtres + Table */}
      <div className="sk-premium-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4 mb-6">
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sk-input pl-10 pr-4"
            />
          </div>

          {!isIndividualOwner && (
            <div>
              <select
                value={selectedBailleur}
                onChange={(e) => setSelectedBailleur(e.target.value)}
                className="sk-input"
              >
                <option value="">Tous les bailleurs</option>
                {bailleurs.map((b, index) => (
                  <option key={index} value={b.label}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          </div>
          <ColumnPicker
            columns={allColumns
              .filter((c) => !(isIndividualOwner && c.key === 'bailleur'))
              .map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))}
            visibility={colVis}
            onToggle={colToggle}
            onSetAll={colSetAll}
          />
        </div>

        <div className="overflow-x-auto">
          <Table columns={columns} data={paginated} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-emerald-950/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''} — page {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`e${idx}`} className="px-2 text-slate-400 text-sm">…</span>
                    : <button
                        key={p}
                        onClick={() => setPage(p as number)}
                className={`sk-action sk-action-icon ${page === p ? 'sk-action-primary' : 'sk-action-secondary'}`}
                      >
                        {p}
                      </button>
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workflow de paiement */}
      {showModal && selectedLoyer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-brand-950/68 p-0 backdrop-blur-md sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] border border-white/70 bg-white shadow-2xl shadow-emerald-950/20 sm:rounded-[1.75rem]">
            <div className="relative overflow-hidden rounded-t-[1.75rem] bg-[radial-gradient(circle_at_100%_0%,rgba(255,138,0,0.22),transparent_14rem),linear-gradient(135deg,#08110e,#0d1b16_55%,#14251e)] px-5 py-5 text-white sm:px-7">
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-orange-400/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
                    Encaissement sécurisé
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Payer ce loyer</h2>
                  <p className="mt-1 text-sm text-emerald-100">
                    Paiement partiel, complet ou avance avec mise a jour automatique du reliquat.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <CreditCard className="h-6 w-6 text-orange-200" />
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sk-metric-tile">
                  <Wallet className="h-5 w-5 text-brand-700" />
                  <p className="mt-3 text-xs font-black uppercase text-slate-500">Montant dû</p>
                  <p className="mt-1 text-xl font-black text-slate-950">{formatCurrency(selectedLoyer.montant_du)}</p>
                </div>
                <div className="sk-metric-tile">
                  <ReceiptText className="h-5 w-5 text-brand-700" />
                  <p className="mt-3 text-xs font-black uppercase text-slate-500">Deja encaisse</p>
                  <p className="mt-1 text-xl font-black text-slate-950">{formatCurrency(selectedLoyer.montant_encaisse)}</p>
                </div>
                <div className="sk-metric-tile">
                  <CalendarDays className="h-5 w-5 text-brand-700" />
                  <p className="mt-3 text-xs font-black uppercase text-slate-500">Échéance</p>
                  <p className="mt-1 text-xl font-black text-slate-950">
                    {new Date(selectedLoyer.date_echeance).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="sk-card-premium p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Locataire</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {selectedLoyer.locataire_prenom} {selectedLoyer.locataire_nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Période</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {new Date(selectedLoyer.mois_concerne).toLocaleDateString('fr-FR', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-black uppercase text-slate-500">Bien concerné</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Building2 className="h-4 w-4 text-brand-700" />
                      {selectedLoyer.immeuble_nom} · {selectedLoyer.unite_nom}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Montant encaissé</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={paymentForm.montant}
                    onChange={(e) => setPaymentForm({ ...paymentForm, montant: e.target.value })}
                    className="sk-input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Un montant inférieur au solde créera un paiement partiel.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Date paiement</label>
                  <input
                    type="date"
                    value={paymentForm.date_paiement}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date_paiement: e.target.value })}
                    className="sk-input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Mode paiement</label>
                  <select
                    value={paymentForm.mode_paiement}
                    onChange={(e) => setPaymentForm({ ...paymentForm, mode_paiement: e.target.value })}
                    className="sk-input"
                  >
                    <option value="especes">Espèces</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Référence transaction</label>
                  <input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className="sk-input"
                    placeholder="Wave, Orange Money, reçu caisse..."
                  />
                </div>
              </div>

              <div className="sk-premium-panel p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Statut après paiement</p>
                    <p className={`mt-1 font-black ${remainingAfterPayment > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {remainingAfterPayment > 0 ? 'Partiel' : 'Soldé'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Reliquat restant</p>
                    <p className="mt-1 font-black text-slate-950">{formatCurrency(remainingAfterPayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Avance / trop-perçu</p>
                    <p className="mt-1 font-black text-slate-950">{formatCurrency(advanceAfterPayment)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="sk-action sk-action-secondary justify-center disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmPaiement}
                  disabled={submitting || paymentAmount <= 0}
                  className="sk-action sk-action-financial justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

