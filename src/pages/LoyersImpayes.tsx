import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Wallet, Building2, CalendarDays, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
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
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { getOpenReceivables, type OpenReceivableStatus } from '../services/api/financeApi';
import { FinanceDrawer, FinanceInfoCard, FinanceKpiGrid, FinanceLine, FinancePageHeader } from '../components/finance/FinancePrimitives';
import { PremiumButton } from '../components/ui/PremiumButton';
import { HandCoins } from 'lucide-react';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { FinanceStatusTabs } from '../components/finance/FinancePrimitives';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { MoneyText } from '../components/ui/MoneyText';
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

const STATUS_META: Record<LoyerStatut, { label: string; classes: string }> = {
    a_venir: { label: 'À venir', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
    en_retard: { label: 'En retard', classes: 'bg-red-100 text-red-700 border-red-200' },
    partiel: { label: 'Partiel', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
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



    const statusTabs = [
        { id: 'tous', label: 'Toutes', count: impayes.length },
        { id: 'retard', label: 'En retard', count: impayes.filter(i => i.statut === 'en_retard').length },
        { id: 'partiel', label: 'Partiels', count: impayes.filter(i => i.statut === 'partiel').length },
        { id: 'a_venir', label: 'À venir', count: impayes.filter(i => i.statut === 'a_venir').length },
    ];

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paymentAmount = Number(paymentForm.montant || 0);
    const remainingAfterPayment = selectedLoyer
        ? Math.max(selectedLoyer.montant_du - paymentAmount, 0)
        : 0;
    const advanceAfterPayment = selectedLoyer
        ? Math.max(paymentAmount - selectedLoyer.montant_du, 0)
        : 0;

    const ALL_COLUMN_KEYS_LOYERS = ['locataire', 'unite_nom', 'immeuble_nom', 'bailleur', 'mois_concerne', 'statut', 'montant_encaisse', 'montant_du', 'telephone_locataire'] as const;
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
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${meta.classes}`}>
                        {meta.label}
                    </span>
                );
            },
        },
        {
            key: 'montant_encaisse',
            label: 'Encaissé',
            render: (i: LoyerImpaye) => <MoneyText value={i.montant_encaisse} />,
        },
        {
            key: 'montant_du',
            label: 'Montant dû',
            render: (i: LoyerImpaye) => <span className="text-red-600 font-bold"><MoneyText value={i.montant_du} /></span>,
        },
        {
            key: 'telephone_locataire',
            label: 'Téléphone',
            render: (i: LoyerImpaye) => {
                if (!i.telephone_locataire) return '—';
                const cleaned = i.telephone_locataire.replace(/\D/g, '');
                const formatted = cleaned.length === 9
                    ? `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`
                    : i.telephone_locataire;
                return <a href={`tel:${cleaned}`} className="text-brand-600 hover:underline hover:text-brand-800" onClick={(e) => e.stopPropagation()}>{formatted}</a>;
            }
        },
    ];
    const columns = allColumns.filter((c) => {
        if (isIndividualOwner && c.key === 'bailleur') return false;
        if (!colIsVisible(c.key)) return false;
        if (drawerLoyer && (c.key === 'immeuble_nom' || c.key === 'bailleur' || c.key === 'telephone_locataire')) return false;
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

    const financeMetrics = [
        {
            label: 'Créances ouvertes',
            value: kpis.ouvertes,
            helper: 'Échéances non soldées',
            icon: AlertCircle,
            tone: 'amber' as const,
        },
        {
            label: 'Retards et reliquats',
            value: <MoneyText value={kpis.retardsReliquats} />,
            helper: 'À recouvrer',
            icon: Wallet,
            tone: 'red' as const,
        },
        {
            label: 'Déjà encaissé',
            value: <MoneyText value={kpis.dejaEncaisse} />,
            helper: 'Sur ces créances',
            icon: HandCoins,
            tone: 'emerald' as const,
        },
        {
            label: 'Loyers attendus',
            value: <MoneyText value={kpis.attendus} />,
            helper: 'Total théorique',
            icon: Building2,
            tone: 'slate' as const,
        },
        {
            label: 'Échéances à venir',
            value: kpis.aVenir,
            helper: 'Mois futurs',
            icon: CalendarDays,
            tone: 'blue' as const,
        },
        {
            label: 'Partiels',
            value: kpis.partiels,
            helper: 'En cours de paiement',
            icon: CreditCard,
            tone: 'amber' as const,
        },
    ];

    if (loading) {
        return (
            <LoadingState
                label="Créances à recouvrer"
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
        <div className="flex min-h-full">
            <div className={`flex-1 min-w-0 transition-all duration-300 ${drawerLoyer ? 'hidden xl:block xl:pr-[31.5rem]' : ''}`}>
                <section className="sk-page-shell space-y-6">
                    {cacheTimestamp && (
                        <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadData} retrying={loading} />
                    )}

                    {!embedded && (
                        <>
                            <FinancePageHeader
                                eyebrow="Encaissement & finance"
                                title={isIndividualOwner ? 'Mes créances à recouvrer' : 'Créances à recouvrer'}
                                description="Retards, partiels et restes dus."
                            />
                            <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-emerald-950/10">
                                <Tabs
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
                    <FinanceKpiGrid metrics={financeMetrics} />

                    {/* Filtres + Table */}
                    <div className="sk-premium-panel relative z-20 overflow-visible p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3 relative min-w-0 flex-1">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setMobileFiltersOpen(true)}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#fffdf8] px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60 lg:hidden"
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filtres
                                </button>
                            </div>

                            <div className="hidden lg:flex min-w-0 flex-row gap-2 items-center">
                                <SmartCombobox
                                    value={selectedMois}
                                    options={monthOptions}
                                    onChange={setSelectedMois}
                                    placeholder="Période"
                                    searchPlaceholder="Rechercher un mois"
                                    className="w-48 shrink-0"
                                />
                                {!isIndividualOwner && (
                                    <SmartCombobox
                                        value={selectedBailleur}
                                        options={[
                                            { value: '', label: 'Tous les bailleurs' },
                                            ...bailleurs.map((b) => ({ value: b.label, label: b.label }))
                                        ]}
                                        onChange={setSelectedBailleur}
                                        placeholder="Tous les bailleurs"
                                        searchPlaceholder="Rechercher un bailleur..."
                                        className="w-56"
                                    />
                                )}

                                <ColumnPicker
                                    columns={allColumns
                                        .filter((c) => !(isIndividualOwner && c.key === 'bailleur'))
                                        .map((c) => ({ key: c.key, label: c.label, required: false }))}
                                    visibility={colVis}
                                    onToggle={colToggle}
                                    onSetAll={colSetAll}
                                />
                            </div>
                        </div>

                        <div className="flex items-center px-4 py-2 lg:px-5">
                            <FinanceStatusTabs tabs={statusTabs} active={statusFilter} onChange={setStatusFilter} />
                        </div>
                    </div>

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
                                        { value: '', label: 'Tous les bailleurs' },
                                        ...bailleurs.map((b) => ({ value: b.label, label: b.label }))
                                    ]}
                                    onChange={setSelectedBailleur}
                                    placeholder="Tous les bailleurs"
                                    searchPlaceholder="Rechercher un bailleur..."
                                />
                            )}
                        </div>
                    </MobileFilterSheet>

                    <div className="sk-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table
                                columns={columns}
                                data={paginated}
                                onRowClick={(i) => setDrawerLoyer(i)}
                                selectedId={drawerLoyer?.id}
                                mobileRender={(i) => {
                                    const status = STATUS_META[i.statut] || STATUS_META['en_retard'];
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const StatusIcon = (status as any).icon || AlertCircle;
                                    return (
                                        <div className="flex flex-col p-4 gap-2 bg-white hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="font-black text-slate-900 truncate">{i.locataire_prenom} {i.locataire_nom}</span>
                                                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${status.classes}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {status.label}
                                                </span>
                                            </div>

                                            <div className="text-xs font-semibold text-slate-500 truncate">
                                                {i.immeuble_nom || '—'} · {i.unite_nom || '—'}
                                            </div>

                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-base font-black text-red-600"><MoneyText value={i.montant_du} /></span>
                                                <span className="text-xs font-semibold text-slate-600 capitalize truncate">{new Date(i.mois_concerne).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                                            </div>

                                            {i.montant_encaisse > 0 && (
                                                <div className="flex items-center justify-between mt-1 text-[11px] font-bold text-slate-400">
                                                    <span>Déjà encaissé: <MoneyText value={i.montant_encaisse} /></span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }}
                            />
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

                </section>
            </div>

            {/* Drawer */}
            {drawerLoyer && (
                <FinanceDrawer
                    title="CRÉANCE À RECOUVRER"
                    amount={<MoneyText value={drawerLoyer.montant_du} />}
                    details={[
                        `${drawerLoyer.locataire_prenom} ${drawerLoyer.locataire_nom}`,
                        `${drawerLoyer.immeuble_nom || '—'} · ${drawerLoyer.unite_nom || '—'}`
                    ]}
                    subtitle={`${STATUS_META[drawerLoyer.statut].label} · ${new Date(drawerLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`}
                    onClose={() => setDrawerLoyer(null)}
                    actions={
                        <>
                            {drawerLoyer.montant_du > 0 && (
                                <PremiumButton
                                    variant="create"
                                    size="sm"
                                    icon={<HandCoins className="h-4 w-4" />}
                                    onClick={() => handlePayerClick(drawerLoyer)}
                                    fullWidth
                                >
                                    Encaisser ce loyer
                                </PremiumButton>
                            )}
                        </>
                    }
                >
                    <div className="space-y-4">
                        <FinanceInfoCard title="Résumé créance">
                            <FinanceLine label="Loyer attendu" value={<MoneyText value={drawerLoyer.montant_attendu} />} />
                            <FinanceLine label="Déjà encaissé" value={<MoneyText value={drawerLoyer.montant_encaisse} className="font-semibold text-emerald-800" />} />
                            <FinanceLine label="Reste dû" value={<MoneyText value={drawerLoyer.montant_du} className={drawerLoyer.montant_du > 3 ? 'font-black text-red-700' : 'font-black text-emerald-800'} />} strong />
                        </FinanceInfoCard>
                        <FinanceInfoCard title="Affectation">
                            <FinanceLine label="Bien" value={`${drawerLoyer.immeuble_nom} · ${drawerLoyer.unite_nom}`} />
                            <FinanceLine label={isIndividualOwner ? 'Propriétaire' : 'Bailleur'} value={`${drawerLoyer.bailleur_prenom} ${drawerLoyer.bailleur_nom}`} />
                            <FinanceLine label="Période" value={new Date(drawerLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
                        </FinanceInfoCard>
                        <FinanceInfoCard title="Contact">
                            <FinanceLine label="Locataire" value={`${drawerLoyer.locataire_prenom} ${drawerLoyer.locataire_nom}`} />
                            <FinanceLine label="Téléphone" value={drawerLoyer.telephone_locataire || '—'} />
                        </FinanceInfoCard>
                        <FinanceInfoCard title="Traçabilité certifiée">
                            <div className="text-xs text-slate-500">
                                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Échéance issue de l’historique financier sécurisé</p>
                                <p className="mt-1.5 flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Montants confirmés par le traitement financier</p>
                            </div>
                        </FinanceInfoCard>
                    </div>
                </FinanceDrawer>
            )}

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

