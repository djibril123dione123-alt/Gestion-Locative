import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Wallet, Building2, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../lib/formatters';
import { formatPaiementError } from '../services/domain/paiementService';
import { createPaiementViaEdge, PaiementApiError } from '../services/api/paiementApi';
import { emitEvent } from '../lib/eventBus';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { getOpenReceivables, type OpenReceivableStatus } from '../services/api/financeApi';
import { HandCoins } from 'lucide-react';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { CompactSection, CompactLabelValue } from '../components/ui/CompactSection';
import { Modal } from '../components/ui/Modal';
import { PremiumButton } from '../components/ui/PremiumButton';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { buildMonthFilterOptions, resolveMonthFilter } from '../lib/monthFilters';

const ITEMS_PER_PAGE = 20;
const LOOKBACK_MONTHS = 12;
const LOOKAHEAD_MONTHS = 2;

type LoyerStatut = OpenReceivableStatus;

interface LoyerImpaye {
    id: string;
    contrat_id: string;
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

import { CompactFinanceKpiGrid } from '../components/finance/FinancePrimitives';

const STATUS_META: Record<LoyerStatut, { label: string; classes: string }> = {
    a_venir: { label: 'À venir', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
    en_retard: { label: 'En retard', classes: 'bg-red-100 text-red-700 border-red-200' },
    partiel: { label: 'Partiel', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const getReceivableStatusTone = (statut: LoyerStatut): 'emerald' | 'amber' | 'red' | 'blue' | 'slate' => {
    if (statut === 'en_retard') return 'red';
    if (statut === 'partiel') return 'amber';
    return 'slate';
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
    const [selectedMois, setSelectedMois] = useState('current');
    const [bailleurs, setBailleurs] = useState<BailleurOption[]>([]);
    const [statusFilter, setStatusFilter] = useState('tous');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedLoyer, setSelectedLoyer] = useState<LoyerImpaye | null>(null);
    const [drawerLoyer, setDrawerLoyer] = useState<LoyerImpaye | null>(null);
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
    const monthOptions = useMemo(
        () => buildMonthFilterOptions(impayes.map((impaye) => impaye.mois_concerne)),
        [impayes],
    );

    useEffect(() => {
        let result = impayes;
        const targetMonth = resolveMonthFilter(selectedMois);

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

        if (targetMonth) {
            result = result.filter((item) => item.mois_concerne.slice(0, 7) === targetMonth);
        }

        if (statusFilter !== 'tous') {
            result = result.filter(i => {
                if (statusFilter === 'a_venir') return i.statut === 'a_venir';
                if (statusFilter === 'retard') return i.statut === 'en_retard';
                if (statusFilter === 'partiel') return i.statut === 'partiel';
                return true;
            });
        }

        setFiltered(result);
        setPage(1);
    }, [searchTerm, selectedBailleur, selectedMois, impayes, statusFilter]);

    const loadData = useCallback(async () => {
        if (!profile?.agency_id || !profile.id) return;
        const agencyId = profile.agency_id;
        const userId = profile.id;
        const reqId = ++requestIdRef.current;
        if (impayes.length === 0) setLoading(true);
        setError(null);
        const cacheScope = { agencyId, userId };
        const cacheKey = 'loyers-impayes-page:v2';
        try {
            const currentDate = new Date();
            const startPeriod = monthKey(addMonths(monthStart(currentDate), -LOOKBACK_MONTHS));
            const endPeriod = monthKey(addMonths(monthStart(currentDate), LOOKAHEAD_MONTHS));

            const result = await readWithCache<{ impayes: LoyerImpaye[]; bailleurs: BailleurOption[] }>(
                cacheScope,
                cacheKey,
                async () => {
                    const receivables = await getOpenReceivables({
                        agencyId,
                        start: startPeriod,
                        end: endPeriod,
                    });
                    const impayesList = receivables.map<LoyerImpaye>((row) => ({
                        id: row.id,
                        contrat_id: row.contrat_id,
                        locataire_nom: row.locataire_nom,
                        locataire_prenom: row.locataire_prenom,
                        telephone_locataire: row.telephone_locataire,
                        unite_nom: row.unite_nom,
                        immeuble_nom: row.immeuble_nom,
                        bailleur_nom: row.bailleur_nom,
                        bailleur_prenom: row.bailleur_prenom,
                        montant_attendu: Number(row.montant_attendu || 0),
                        montant_encaisse: Number(row.montant_encaisse || 0),
                        montant_du: Number(row.montant_du || 0),
                        mois_concerne: row.mois_concerne,
                        date_echeance: row.date_echeance,
                        statut: row.statut,
                    }));
                    const uniqueBailleurs = Array.from(
                        new Set(impayesList.map((i) => `${i.bailleur_prenom} ${i.bailleur_nom}`)),
                    ).filter((b) => b.trim());
                    return {
                        impayes: impayesList,
                        bailleurs: uniqueBailleurs.map((label) => ({ label })),
                    };
                },
                { timeoutMs: 7_000 },
            );

            if (reqId !== requestIdRef.current) return;

            const impayesList = [...result.data.impayes];
            impayesList.sort((a, b) => {
                const priority: Record<LoyerStatut, number> = { en_retard: 0, partiel: 1, a_venir: 2 };
                return priority[a.statut] - priority[b.statut] || a.mois_concerne.localeCompare(b.mois_concerne);
            });

            setImpayes(impayesList);
            setFiltered(impayesList);
            setPage(1);

            setBailleurs(result.data.bailleurs);
            setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);

        } catch (err) {
            if (reqId !== requestIdRef.current) return;
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement des créances à recouvrer');
        } finally {
            if (reqId === requestIdRef.current) setLoading(false);
        }
    }, [impayes.length, profile?.agency_id, profile?.id]);

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


    const handlePayerClick = (impaye: LoyerImpaye) => {
        setSelectedLoyer(impaye);
        setPaymentForm({
            montant: impaye.montant_du.toString(),
            date_paiement: toDateInput(new Date()),
            mode_paiement: 'especes',
            reference: '',
        });
        setDrawerLoyer(null);
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

            await createPaiementViaEdge({
                contrat_id: selectedLoyer.contrat_id,
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



    const quickChips = useMemo(() => [
        { id: 'tous', label: 'Toutes', count: impayes.length, isActive: statusFilter === 'tous', onClick: () => setStatusFilter('tous') },
        { id: 'retard', label: 'En retard', count: impayes.filter(i => i.statut === 'en_retard').length, isActive: statusFilter === 'retard', onClick: () => setStatusFilter('retard') },
        { id: 'partiel', label: 'Partiels', count: impayes.filter(i => i.statut === 'partiel').length, isActive: statusFilter === 'partiel', onClick: () => setStatusFilter('partiel') },
        { id: 'a_venir', label: 'À venir', count: impayes.filter(i => i.statut === 'a_venir').length, isActive: statusFilter === 'a_venir', onClick: () => setStatusFilter('a_venir') },
    ], [impayes, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paymentAmount = Number(paymentForm.montant || 0);
    const remainingAfterPayment = selectedLoyer
        ? Math.max(selectedLoyer.montant_du - paymentAmount, 0)
        : 0;

    const ALL_COLUMN_KEYS_LOYERS = ['locataire', 'bailleur', 'mois_concerne', 'statut', 'montant_encaisse', 'montant_du', 'telephone_locataire'] as const;
    const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('loyersImpayes', [...ALL_COLUMN_KEYS_LOYERS]);

    const allColumns = [
        {
            key: 'locataire',
            label: 'Locataire',
            render: (i: LoyerImpaye) => (
                <div className="min-w-0">
                    <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">{`${i.locataire_prenom} ${i.locataire_nom}`}</p>
                    <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-0.5">
                        {i.immeuble_nom} · {i.unite_nom}
                    </p>
                </div>
            ),
        },
        {
            key: 'bailleur',
            label: 'Bailleur',
            render: (i: LoyerImpaye) => <span className="text-[0.7rem] font-medium text-slate-600">{`${i.bailleur_prenom} ${i.bailleur_nom}`}</span>,
        },
        {
            key: 'mois_concerne',
            label: 'Mois',
            render: (i: LoyerImpaye) => (
                <span className="whitespace-nowrap text-[0.7rem] font-medium text-slate-600">
                    {new Date(i.mois_concerne).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                    })}
                </span>
            ),
        },
        {
            key: 'statut',
            label: 'Statut',
            render: (i: LoyerImpaye) => {
                const meta = STATUS_META[i.statut];
                return (
                    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap ${meta.classes}`}>
                        {meta.label}
                    </span>
                );
            },
        },
        {
            key: 'montant_encaisse',
            label: 'Encaissé',
            render: (i: LoyerImpaye) => <span className="whitespace-nowrap text-[0.72rem] font-semibold tabular-nums"><MoneyText value={i.montant_encaisse} className="text-slate-700" /></span>,
        },
        {
            key: 'montant_du',
            label: 'Montant dû',
            render: (i: LoyerImpaye) => <span className={`whitespace-nowrap text-[0.72rem] font-semibold tabular-nums ${Number(i.montant_du || 0) > 0 ? 'text-red-600' : 'text-slate-400 font-medium'}`}><MoneyText value={i.montant_du} /></span>,
        },
        {
            key: 'telephone_locataire',
            label: 'Téléphone',
            render: (i: LoyerImpaye) => {
                if (!i.telephone_locataire) return <span className="text-[0.68rem] font-medium text-slate-400">—</span>;
                const cleaned = i.telephone_locataire.replace(/\D/g, '');
                const formatted = cleaned.length === 9
                    ? `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`
                    : i.telephone_locataire;
                return <a href={`tel:${cleaned}`} className="text-[0.68rem] font-medium text-brand-600 hover:underline hover:text-brand-800" onClick={(e) => e.stopPropagation()}>{formatted}</a>;
            }
        },
    ];
    const columns = allColumns.filter((c) => {
        if (isIndividualOwner && c.key === 'bailleur') return false;
        if (!colIsVisible(c.key)) return false;
        if (drawerLoyer && (c.key === 'bailleur' || c.key === 'telephone_locataire')) return false;
        return true;
    });

    const kpis = useMemo(() => {
        return {
            ouvertes: filtered.length,
            retardsReliquats: filtered.filter(i => i.statut === 'en_retard' || i.statut === 'partiel').reduce((sum, i) => sum + i.montant_du, 0),
            dejaEncaisse: filtered.reduce((sum, i) => sum + i.montant_encaisse, 0),
            attendus: filtered.reduce((sum, i) => sum + i.montant_attendu, 0),
            aVenir: filtered.filter(i => i.statut === 'a_venir').length,
            partiels: filtered.filter(i => i.statut === 'partiel').length,
        };
    }, [filtered]);

    const financeMetrics = useMemo(() => [
        {
            label: 'Ouvertes',
            value: kpis.ouvertes,
            helper: 'Non soldées',
            icon: AlertCircle,
            tone: 'amber' as const,
        },
        {
            label: 'Retards',
            value: <MoneyText value={kpis.retardsReliquats} compact />,
            helper: 'À recouvrer',
            icon: Wallet,
            tone: 'red' as const,
        },
        {
            label: 'Encaissé',
            value: <MoneyText value={kpis.dejaEncaisse} compact />,
            helper: 'Sur créances',
            icon: HandCoins,
            tone: 'emerald' as const,
        },
        {
            label: 'Attendus',
            value: <MoneyText value={kpis.attendus} compact />,
            helper: 'Théorique',
            icon: Building2,
            tone: 'slate' as const,
        },
        {
            label: 'À venir',
            value: kpis.aVenir,
            helper: 'Mois futurs',
            icon: CalendarDays,
            tone: 'blue' as const,
        },
        {
            label: 'Partiels',
            value: kpis.partiels,
            helper: 'En cours',
            icon: CreditCard,
            tone: 'amber' as const,
        },
    ], [kpis]);

    const displayedMetrics = useMemo(() => {
        if (drawerLoyer) {
            return financeMetrics.filter((m) => m.label !== 'Attendus' && m.label !== 'À venir');
        }
        return financeMetrics;
    }, [financeMetrics, drawerLoyer]);

    if (loading) {
        return <PageSkeleton title="Créances à recouvrer" variant="table" />;
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
        <PageShell spacing="compact" variant="dataDense" tone="paper" verticalInset="compact">
            <SplitViewShell
                size="compact"
                desktopAt="lg"
                detailClassName="lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]"
                isDetailOpen={Boolean(drawerLoyer)}
                main={
                    <div className="space-y-4">
                        {cacheTimestamp && (
                            <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadData} retrying={loading} />
                        )}

                        {!embedded && (
                            <>
                                <PremiumPageHeader
                                    density="compact"
                                    eyebrow="ENCAISSEMENT & FINANCE"
                                    title={isIndividualOwner ? 'Mes créances à recouvrer' : 'Créances à recouvrer'}
                                    description="Retards, partiels et restes dus."
                                    mobileDescription="Suivi des impayés."
                                />
                                <div className="flex items-center justify-start pt-1 pb-2">
                                    <Tabs
                                        size="compact"
                                        tabs={[
                                            { id: 'paiements', label: 'Paiements reçus', icon: CreditCard },
                                            { id: 'loyers-impayes', label: 'Créances à recouvrer', icon: AlertCircle },
                                        ]}
                                        activeId="loyers-impayes"
                                        onChange={(id) => { window.location.hash = `#/${id}`; }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Statistiques */}
                        <CompactFinanceKpiGrid metrics={displayedMetrics} />

                        {/* Filtres + Table */}
                        <PremiumToolbar
                            density="compact"
                            layout="list"
                            ariaLabel="Filtres des créances à recouvrer"
                            isSplitOpen={Boolean(drawerLoyer)}
                            quickChips={quickChips}
                            search={
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-2.5 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setMobileFiltersOpen(true)}
                                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[0.6rem] border border-slate-200 bg-[#fffdf8] px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60 lg:hidden"
                                    >
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                        Filtres
                                    </button>
                                </div>
                            }
                            filters={
                                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                                    <SmartCombobox
                                        value={selectedMois}
                                        options={monthOptions}
                                        onChange={setSelectedMois}
                                        placeholder="Période"
                                        searchPlaceholder="Rechercher un mois"
                                        className={`shrink-0 ${drawerLoyer ? 'w-32' : 'w-40'}`}
                                        density="compact"
                                    />
                                    {!isIndividualOwner && (
                                        <SmartCombobox
                                            value={selectedBailleur}
                                            options={[
                                                { value: '', label: 'Tous Bailleurs' },
                                                ...bailleurs.map((b) => ({ value: b.label, label: b.label }))
                                            ]}
                                            onChange={setSelectedBailleur}
                                            placeholder="Tous Bailleurs"
                                            searchPlaceholder="Rechercher un bailleur..."
                                            className={`shrink-0 ${drawerLoyer ? 'hidden xl:block xl:w-32' : 'w-44'}`}
                                            density="compact"
                                        />
                                    )}

                                    <ColumnPicker
                                        columns={allColumns
                                            .filter((c) => !(isIndividualOwner && c.key === 'bailleur'))
                                            .map((c) => ({ key: c.key, label: c.label, required: false }))}
                                        visibility={colVis}
                                        onToggle={colToggle}
                                        onSetAll={colSetAll}
                                        className={`!h-8 !rounded-[0.6rem] !px-2.5 !py-1 !text-xs ${drawerLoyer ? 'hidden' : ''}`}
                                    />
                                </div>
                            }
                        />

                        <MobileFilterSheet
                        isOpen={mobileFiltersOpen}
                        title="Filtres Créances"
                        onClose={() => setMobileFiltersOpen(false)}
                        onReset={() => {
                            setSelectedBailleur('');
                            setSelectedMois('current');
                        }}
                    >
                        <div className="grid gap-3">
                            <SmartCombobox
                                value={selectedMois}
                                options={monthOptions}
                                onChange={setSelectedMois}
                                placeholder="Période"
                                searchPlaceholder="Rechercher un mois"
                            />
                            {!isIndividualOwner && (
                                <SmartCombobox
                                    value={selectedBailleur}
                                    options={[
                                        { value: '', label: 'Tous Bailleurs' },
                                        ...bailleurs.map((b) => ({ value: b.label, label: b.label }))
                                    ]}
                                    onChange={setSelectedBailleur}
                                    placeholder="Tous Bailleurs"
                                    searchPlaceholder="Rechercher un bailleur..."
                                />
                            )}
                        </div>
                    </MobileFilterSheet>

                    <PremiumTableSurface density="compact" ariaLabel="Table des créances à recouvrer">
                        <Table
                            compact
                            columns={columns}
                            data={paginated}
                            onRowClick={(i) => setDrawerLoyer(i)}
                            selectedId={drawerLoyer?.id}
                            mobileRender={(i) => {
                                const status = STATUS_META[i.statut] || STATUS_META['en_retard'];
                                const periodLabel = new Date(i.mois_concerne).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                                return (
                                    <PremiumMobileCard
                                        title={`${i.locataire_prenom} ${i.locataire_nom}`.trim() || 'Locataire inconnu'}
                                        subtitle={`${i.immeuble_nom || 'Bien non renseigné'} · ${i.unite_nom || 'Unité non renseignée'}`}
                                        icon={AlertCircle}
                                        status={status.label}
                                        statusTone={getReceivableStatusTone(i.statut)}
                                        amount={i.montant_du}
                                        amountLabel="Reste dû"
                                        amountTone={i.montant_du > 3 ? 'red' : 'emerald'}
                                        amountCompact
                                        secondaryAmount={i.montant_encaisse > 0 ? i.montant_encaisse : undefined}
                                        secondaryAmountLabel={i.montant_encaisse > 0 ? 'Déjà encaissé' : undefined}
                                        secondaryAmountTone="emerald"
                                        meta={[
                                            { label: 'Période', value: periodLabel },
                                            { label: 'Échéance', value: new Date(i.date_echeance).toLocaleDateString('fr-FR') },
                                        ]}
                                        selected={drawerLoyer?.id === i.id}
                                        onClick={() => setDrawerLoyer(i)}
                                        density="compact"
                                        emphasis="identity"
                                    />
                                );
                            }}
                        />

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
                                <span className="text-xs font-semibold text-slate-500">
                                    Page {page} sur {totalPages} ({filtered.length} résultats)
                                </span>
                                <div className="flex items-center gap-1">
                                    <button aria-label="Action"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => {
                                            if (totalPages <= 7) return true;
                                            if (p === 1 || p === totalPages) return true;
                                            if (Math.abs(p - page) <= 1) return true;
                                            return false;
                                        })
                                        .reduce((acc: (number | string)[], p, i, arr) => {
                                            if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
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
                                    <button aria-label="Action"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    >
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </PremiumTableSurface>

                </div>
            }
            detail={
                drawerLoyer && (
                    <PremiumDrawerShell
                        open
                        size="compact"
                        desktopMode="floating"
                        desktopAt="lg"
                        density="compact"
                        eyebrow="CRÉANCE À RECOUVRER"
                        title={`${drawerLoyer.locataire_prenom} ${drawerLoyer.locataire_nom}`}
                        description={
                            <div className="space-y-1">
                                <p className="text-base font-black tracking-tight text-slate-950">
                                    <MoneyText value={drawerLoyer.montant_du} />
                                </p>
                                <p className="truncate text-[0.72rem] font-semibold text-slate-500">
                                    {drawerLoyer.immeuble_nom || '—'} · {drawerLoyer.unite_nom || '—'}
                                </p>
                                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-emerald-700">
                                    {STATUS_META[drawerLoyer.statut].label} · {new Date(drawerLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        }
                        onClose={() => setDrawerLoyer(null)}
                        actions={
                            <>
                                {drawerLoyer.montant_du > 0 && (
                                    <PremiumButton
                                        variant="create"
                                        size="sm"
                                        icon={<HandCoins className="h-3.5 w-3.5" />}
                                        onClick={() => handlePayerClick(drawerLoyer)}
                                        className="!h-8 !text-[0.72rem]"
                                        fullWidth
                                    >
                                        Encaisser ce loyer
                                    </PremiumButton>
                                )}
                            </>
                        }
                        bodyClassName="space-y-2"
                    >
                        <CompactSection title="Résumé créance">
                            <CompactLabelValue label="Loyer attendu" value={<MoneyText value={drawerLoyer.montant_attendu} />} />
                            <CompactLabelValue label="Déjà encaissé" value={<MoneyText value={drawerLoyer.montant_encaisse} className="font-semibold text-emerald-800" />} />
                            <CompactLabelValue label="Reste dû" value={<MoneyText value={drawerLoyer.montant_du} className={drawerLoyer.montant_du > 3 ? 'font-black text-red-700' : 'font-black text-emerald-800'} />} />
                        </CompactSection>
                        <CompactSection title="Affectation">
                            <CompactLabelValue label="Bien" value={`${drawerLoyer.immeuble_nom} · ${drawerLoyer.unite_nom}`} />
                            <CompactLabelValue label={isIndividualOwner ? 'Propriétaire' : 'Bailleur'} value={`${drawerLoyer.bailleur_prenom} ${drawerLoyer.bailleur_nom}`} />
                            <CompactLabelValue label="Période" value={new Date(drawerLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
                        </CompactSection>
                        <CompactSection title="Contact">
                            <CompactLabelValue label="Locataire" value={`${drawerLoyer.locataire_prenom} ${drawerLoyer.locataire_nom}`} />
                            <CompactLabelValue label="Téléphone" value={drawerLoyer.telephone_locataire || '—'} />
                        </CompactSection>
                        <CompactSection title="Traçabilité certifiée">
                            <div className="text-[0.72rem] text-slate-500 space-y-1">
                                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Échéance issue de l’historique financier sécurisé</p>
                                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Montants confirmés par le traitement financier</p>
                            </div>
                        </CompactSection>
                    </PremiumDrawerShell>
                )
            }
        />

        {/* Workflow de paiement */}
            {showModal && selectedLoyer && (
                <Modal
                    isOpen={showModal && Boolean(selectedLoyer)}
                    onClose={() => setShowModal(false)}
                    title="Payer ce loyer"
                    description="Enregistrement d'un paiement partiel ou complet"
                >
                    <div className="space-y-4 pt-1">
                        <CompactSection title="Détails créance">
                            <CompactLabelValue label="Locataire" value={`${selectedLoyer.locataire_prenom} ${selectedLoyer.locataire_nom}`} />
                            <CompactLabelValue label="Bien" value={`${selectedLoyer.immeuble_nom} · ${selectedLoyer.unite_nom}`} />
                            <CompactLabelValue label="Période" value={new Date(selectedLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} />
                            <CompactLabelValue label="Reste dû" value={<span className="font-black text-red-600">{formatCurrency(selectedLoyer.montant_du)}</span>} />
                        </CompactSection>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-700">Montant encaissé</label>
                                <input aria-label="Champ de saisie"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={paymentForm.montant}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, montant: e.target.value })}
                                    className="sk-input !h-8 !text-xs"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-700">Date paiement</label>
                                <input aria-label="Champ de saisie"
                                    type="date"
                                    value={paymentForm.date_paiement}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, date_paiement: e.target.value })}
                                    className="sk-input !h-8 !text-xs"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-700">Mode paiement</label>
                                <select aria-label="Sélection"
                                    value={paymentForm.mode_paiement}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, mode_paiement: e.target.value })}
                                    className="sk-input !h-8 !text-xs"
                                >
                                    <option value="especes">Espèces</option>
                                    <option value="mobile_money">Mobile money</option>
                                    <option value="virement">Virement</option>
                                    <option value="cheque">Chèque</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-700">Référence</label>
                                <input
                                    value={paymentForm.reference}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                    className="sk-input !h-8 !text-xs"
                                    placeholder="Optionnel..."
                                />
                            </div>
                        </div>

                        <div className="rounded-lg bg-slate-100/80 p-2.5 text-xs grid grid-cols-2 gap-2 border border-slate-200/60">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Nouveau statut:</span>{' '}
                                <span className={`font-black ${remainingAfterPayment > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                                    {remainingAfterPayment > 0 ? 'Partiel' : 'Soldé'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Reliquat:</span>{' '}
                                <span className="font-black text-slate-900">{formatCurrency(remainingAfterPayment)}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <PremiumButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowModal(false)}
                                disabled={submitting}
                                className="!h-8 !text-xs"
                            >
                                Annuler
                            </PremiumButton>
                            <PremiumButton
                                variant="create"
                                size="sm"
                                onClick={handleConfirmPaiement}
                                disabled={submitting || paymentAmount <= 0}
                                className="!h-8 !text-xs"
                            >
                                {submitting ? 'Enregistrement...' : 'Enregistrer'}
                            </PremiumButton>
                        </div>
                    </div>
                </Modal>
            )}
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </PageShell>
    );
}

