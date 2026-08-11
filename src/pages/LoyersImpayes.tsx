import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Wallet, Building2, CalendarDays, SlidersHorizontal, CheckCircle2, Sparkles, Clock, ReceiptText, BellRing, Loader2, FileCheck2, XCircle } from 'lucide-react';
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
import { useDirectRoute } from '../hooks/useDirectRoute';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { getOpenReceivables, type OpenReceivableStatus } from '../services/api/financeApi';
import {
    cancelRentalDue,
    generateRentalDuesBulk,
    getRentalDueDetail,
    isCanonicalRentalDueId,
    prepareRentalDueDocument,
    previewRentalDueGeneration,
    recordRentalDueDelivery,
    scheduleRentalDueReminders,
    type RentalDueDetail,
    type RentalDueDocumentType,
    type RentalDueGenerationPreview,
} from '../services/api/rentalDueApi';
import { runDocumentGeneration } from '../lib/documentGeneration';
import { generateRentalDuePdf, rentalDueDocumentLabel } from '../lib/rentalDuePdf';
import { HandCoins } from 'lucide-react';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { CompactSection, CompactLabelValue } from '../components/ui/CompactSection';
import { WizardShell } from '../components/ui/WizardShell';
import { PremiumButton } from '../components/ui/PremiumButton';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { buildMonthFilterOptions, resolveMonthFilter } from '../lib/monthFilters';

const ITEMS_PER_PAGE = 20;
const LOOKBACK_MONTHS = 12;
const LOOKAHEAD_MONTHS = 2;

const PAYMENT_MODE_OPTIONS = [
    { value: 'especes', label: 'Espèces' },
    { value: 'mobile_money', label: 'Mobile Money (Wave / OM)' },
    { value: 'virement', label: 'Virement bancaire' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'autre', label: 'Autre mode' },
];

const RENTAL_DUE_DOCUMENT_OPTIONS: Array<{
    value: RentalDueDocumentType;
    label: string;
    subtitle: string;
}> = [
    { value: 'due_notice', label: "Avis d'échéance", subtitle: 'Annonce le montant attendu avant règlement.' },
    { value: 'rent_invoice', label: 'Facture de loyer', subtitle: 'Formalise la somme exigible pour la période.' },
    { value: 'partial_payment_receipt', label: 'Reçu de paiement partiel', subtitle: 'Justifie un encaissement laissant un reliquat.' },
    { value: 'rent_receipt', label: 'Quittance de loyer', subtitle: 'Confirme le règlement intégral de la période.' },
    { value: 'credit_note', label: "Avoir d'annulation", subtitle: 'Documente une correction ou une annulation.' },
];

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
    const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
    const { clearDirectRouteParams } = useDirectRoute({
        onSelectId: (id) => {
            setSelectedDrawerId(id);
        },
    });
    const drawerLoyer = useMemo(
        () => impayes.find((i) => i.id === selectedDrawerId || i.contrat_id === selectedDrawerId) ?? null,
        [impayes, selectedDrawerId],
    );
    const [dueDetail, setDueDetail] = useState<RentalDueDetail | null>(null);
    const [dueDetailLoading, setDueDetailLoading] = useState(false);
    const [dueDetailError, setDueDetailError] = useState<string | null>(null);
    const [dueAction, setDueAction] = useState<'document' | 'reminders' | 'cancel' | null>(null);
    const [dueDocumentType, setDueDocumentType] = useState<RentalDueDocumentType>('rent_invoice');
    const [cancelDueOpen, setCancelDueOpen] = useState(false);
    const [cancelDueReason, setCancelDueReason] = useState('');
    const [bulkGenerationOpen, setBulkGenerationOpen] = useState(false);
    const [bulkGenerationPeriod, setBulkGenerationPeriod] = useState(monthKey(monthStart(new Date())));
    const [bulkGenerationPreview, setBulkGenerationPreview] = useState<RentalDueGenerationPreview | null>(null);
    const [bulkGenerationLoading, setBulkGenerationLoading] = useState(false);
    const [bulkGenerationError, setBulkGenerationError] = useState<string | null>(null);
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

    useEffect(() => {
        let active = true;
        setDueDetail(null);
        setDueDetailError(null);

        if (!drawerLoyer || !isCanonicalRentalDueId(drawerLoyer.id)) {
            setDueDetailLoading(false);
            return () => { active = false; };
        }

        setDueDetailLoading(true);
        void getRentalDueDetail(drawerLoyer.id)
            .then((detail) => {
                if (active) setDueDetail(detail);
            })
            .catch((detailError: unknown) => {
                if (active) {
                    setDueDetailError(detailError instanceof Error ? detailError.message : "Le détail canonique est indisponible.");
                }
            })
            .finally(() => {
                if (active) setDueDetailLoading(false);
            });

        return () => { active = false; };
    }, [drawerLoyer]);

    const recommendedDueDocumentType = useMemo<RentalDueDocumentType>(() => {
        if (dueDetail?.due.status === 'PAID') return 'rent_receipt';
        if (dueDetail?.due.status === 'PARTIALLY_PAID') return 'partial_payment_receipt';
        return 'rent_invoice';
    }, [dueDetail?.due.status]);

    useEffect(() => {
        setDueDocumentType(recommendedDueDocumentType);
    }, [recommendedDueDocumentType, dueDetail?.due.id]);

    const dueDocumentOptions = useMemo(() => {
        if (!dueDetail) return RENTAL_DUE_DOCUMENT_OPTIONS;
        const hasIssuedBillingDocument = dueDetail.documents.some((document) =>
            (document.document_type === 'rent_invoice' || document.document_type === 'due_notice')
            && (document.status === 'issued' || document.status === 'archived'),
        );
        const hasIssuedCreditNote = dueDetail.documents.some((document) =>
            document.document_type === 'credit_note'
            && (document.status === 'issued' || document.status === 'archived'),
        );
        return RENTAL_DUE_DOCUMENT_OPTIONS.filter((option) => {
            if (option.value === 'rent_receipt') return dueDetail.due.status === 'PAID';
            if (option.value === 'partial_payment_receipt') return dueDetail.due.status === 'PARTIALLY_PAID';
            if (option.value === 'credit_note') {
                return dueDetail.due.status === 'CANCELLED' || (hasIssuedBillingDocument && !hasIssuedCreditNote);
            }
            return dueDetail.due.status !== 'CANCELLED';
        });
    }, [dueDetail]);

    const cancellationRequiresCreditNote = useMemo(() => {
        if (!dueDetail) return false;
        const hasIssuedBillingDocument = dueDetail.documents.some((document) =>
            (document.document_type === 'rent_invoice' || document.document_type === 'due_notice')
            && (document.status === 'issued' || document.status === 'archived'),
        );
        const hasIssuedCreditNote = dueDetail.documents.some((document) =>
            document.document_type === 'credit_note'
            && (document.status === 'issued' || document.status === 'archived'),
        );
        return hasIssuedBillingDocument && !hasIssuedCreditNote;
    }, [dueDetail]);

    const dueDocumentActionLabel = dueDocumentType === 'rent_receipt'
        ? 'Préparer la quittance'
        : dueDocumentType === 'partial_payment_receipt'
            ? 'Préparer le reçu partiel'
            : dueDocumentType === 'credit_note'
                ? "Préparer l'avoir"
            : 'Préparer la facture';

    const handlePrepareDueDocument = async (requestedType: RentalDueDocumentType = dueDocumentType) => {
        if (!dueDetail || dueAction) return;
        setDueAction('document');
        let preparedDocumentId: string | null = null;
        try {
            const generationKey = [
                'rental-due',
                dueDetail.due.id,
                requestedType,
                dueDetail.due.version,
            ].join(':');
            const result = await runDocumentGeneration({
                key: generationKey,
                kind: requestedType.includes('receipt') ? 'quittance' : 'facture',
                title: rentalDueDocumentLabel(requestedType),
                source: 'Échéances locatives',
                reference: dueDetail.due.reference ?? undefined,
                archiveExpected: true,
                verificationExpected: true,
                steps: [
                    'loading-data',
                    'building-document',
                    'securing-document',
                    'archiving-document',
                    'loading-preview',
                ],
            }, async (generation) => {
                const prepared = await prepareRentalDueDocument(dueDetail.due.id, requestedType);
                preparedDocumentId = prepared.document.id;
                generation.report('building-document', {
                    reference: prepared.document.reference ?? undefined,
                });
                return generateRentalDuePdf({
                    detail: dueDetail,
                    preparedDocument: prepared.document,
                    generation,
                });
            });
            toast.success(result.archiveStatus === 'ready'
                ? 'Document généré, enregistré et prêt à consulter.'
                : 'Document généré. Son archivage reste à vérifier.');
            if (preparedDocumentId) {
                try {
                    await recordRentalDueDelivery(dueDetail.due.id, preparedDocumentId, 'download');
                } catch {
                    toast.warning("Le téléchargement est prêt, mais sa livraison n'a pas pu être journalisée.");
                }
            }
            setDueDetail(await getRentalDueDetail(dueDetail.due.id));
        } catch (documentError) {
            toast.error(documentError instanceof Error ? documentError.message : "Le document n'a pas pu être préparé.");
        } finally {
            setDueAction(null);
        }
    };

    const handleScheduleDueReminders = async () => {
        if (!dueDetail || dueAction) return;
        setDueAction('reminders');
        try {
            const scheduled = await scheduleRentalDueReminders(dueDetail.due.id);
            toast.success(`${scheduled ?? 0} rappel(s) planifié(s).`);
            setDueDetail(await getRentalDueDetail(dueDetail.due.id));
        } catch (reminderError) {
            toast.error(reminderError instanceof Error ? reminderError.message : "Les rappels n'ont pas pu être planifiés.");
        } finally {
            setDueAction(null);
        }
    };

    const canManageDueEngine = profile?.role === 'admin' || profile?.role === 'super_admin';

    const handleCancelDue = async () => {
        if (!dueDetail || dueAction || cancellationRequiresCreditNote || cancelDueReason.trim().length < 8) return;
        setDueAction('cancel');
        try {
            const detail = await cancelRentalDue(dueDetail.due.id, cancelDueReason.trim());
            setDueDetail(detail);
            setCancelDueOpen(false);
            setCancelDueReason('');
            toast.success("L'échéance a été annulée et la correction est tracée.");
            await loadData();
        } catch (cancelError) {
            toast.error(cancelError instanceof Error ? cancelError.message : "L'échéance n'a pas pu être annulée.");
        } finally {
            setDueAction(null);
        }
    };

    const openBulkGeneration = () => {
        const resolvedMonth = resolveMonthFilter(selectedMois);
        setBulkGenerationPeriod(resolvedMonth ? `${resolvedMonth}-01` : monthKey(monthStart(new Date())));
        setBulkGenerationPreview(null);
        setBulkGenerationError(null);
        setBulkGenerationOpen(true);
    };

    const handleBulkPreview = async () => {
        if (!bulkGenerationPeriod || bulkGenerationLoading) return;
        setBulkGenerationLoading(true);
        setBulkGenerationError(null);
        try {
            setBulkGenerationPreview(await previewRentalDueGeneration(bulkGenerationPeriod));
        } catch (previewError) {
            setBulkGenerationError(previewError instanceof Error ? previewError.message : "Le contrôle de la période a échoué.");
        } finally {
            setBulkGenerationLoading(false);
        }
    };

    const handleBulkGeneration = async () => {
        if (!bulkGenerationPreview || bulkGenerationPreview.blocked_count > 0 || bulkGenerationLoading) return;
        setBulkGenerationLoading(true);
        setBulkGenerationError(null);
        try {
            const result = await generateRentalDuesBulk(bulkGenerationPreview.period_start);
            toast.success(`${result.run.generated_count} échéance(s) générée(s), ${result.run.reused_count} déjà existante(s).`);
            setBulkGenerationOpen(false);
            setBulkGenerationPreview(null);
            await loadData();
        } catch (generationError) {
            setBulkGenerationError(generationError instanceof Error ? generationError.message : 'La génération mensuelle a échoué.');
        } finally {
            setBulkGenerationLoading(false);
        }
    };


    const handlePayerClick = (impaye: LoyerImpaye) => {
        setSelectedLoyer(impaye);
        setPaymentForm({
            montant: impaye.montant_du.toString(),
            date_paiement: toDateInput(new Date()),
            mode_paiement: 'especes',
            reference: '',
        });
        setSelectedDrawerId(null);
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
        if (drawerLoyer && (c.key === 'bailleur' || c.key === 'telephone_locataire' || c.key === 'mois_concerne')) return false;
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
                                    secondaryAction={canManageDueEngine ? (
                                        <PremiumButton
                                            variant="secondary"
                                            size="sm"
                                            icon={<CalendarDays className="h-3.5 w-3.5" />}
                                            onClick={openBulkGeneration}
                                        >
                                            Préparer le mois
                                        </PremiumButton>
                                    ) : undefined}
                                >
                                    <div className="mt-2.5 pt-2.5 border-t border-emerald-950/10 flex items-center justify-start w-full sm:w-auto">
                                        <Tabs
                                            size="compact"
                                            fullWidthMobile
                                            tabs={[
                                                { id: 'paiements', label: 'Paiements reçus', icon: CreditCard },
                                                { id: 'loyers-impayes', label: 'Créances à recouvrer', icon: AlertCircle, badge: kpis.ouvertes > 0 ? kpis.ouvertes : undefined },
                                            ]}
                                            activeId="loyers-impayes"
                                            onChange={(id) => { window.location.hash = `#/${id}`; }}
                                        />
                                    </div>
                                </PremiumPageHeader>
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
                            onRowClick={(i) => setSelectedDrawerId(i.id)}
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
                                        secondaryAmount={i.montant_encaisse > 0 ? i.montant_encaisse : undefined}
                                        secondaryAmountLabel={i.montant_encaisse > 0 ? 'Déjà encaissé' : undefined}
                                        secondaryAmountTone="emerald"
                                        meta={[
                                            { label: 'Période', value: periodLabel },
                                        ]}
                                        selected={drawerLoyer?.id === i.id}
                                        onClick={() => setSelectedDrawerId(i.id)}
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
                        onClose={() => {
                            setSelectedDrawerId(null);
                            clearDirectRouteParams();
                        }}
                        actions={
                            <>
                                {drawerLoyer.montant_du > 0 && (
                                    <PremiumButton
                                        variant="create"
                                        size="sm"
                                        icon={<HandCoins className="h-3.5 w-3.5" />}
                                        onClick={() => handlePayerClick(drawerLoyer)}
                                        className="!h-7 !min-h-7 !text-[0.7rem]"
                                        fullWidth
                                    >
                                        Encaisser ce loyer
                                    </PremiumButton>
                                )}
                                {dueDetail && (
                                    <PremiumButton
                                        variant="secondary"
                                        size="sm"
                                        icon={dueAction === 'document' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}
                                        onClick={() => void handlePrepareDueDocument()}
                                        disabled={Boolean(dueAction)}
                                        className="!h-7 !min-h-7 !text-[0.7rem]"
                                        fullWidth
                                    >
                                        {dueAction === 'document' ? 'Génération en cours…' : dueDocumentActionLabel}
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
                        {dueDetailLoading && (
                            <CompactSection title="Échéance canonique" icon={Loader2}>
                                <div className="flex items-center gap-2 py-1 text-[0.72rem] font-medium text-slate-500">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                                    Chargement des lignes et affectations…
                                </div>
                            </CompactSection>
                        )}
                        {dueDetailError && (
                            <CompactSection title="Échéance canonique" icon={AlertCircle}>
                                <p className="py-1 text-[0.7rem] font-medium text-amber-800">{dueDetailError}</p>
                            </CompactSection>
                        )}
                        {dueDetail && (
                            <>
                                <CompactSection title="Composition de l'échéance" icon={ReceiptText}>
                                    {dueDetail.lines.map((line) => (
                                        <CompactLabelValue
                                            key={line.id}
                                            label={line.label}
                                            value={<MoneyText value={Number(line.amount_ttc || 0)} />}
                                        />
                                    ))}
                                    <CompactLabelValue label="Montant HT" value={<MoneyText value={Number(dueDetail.due.amount_ht || 0)} />} />
                                    <CompactLabelValue label="Taxes" value={<MoneyText value={Number(dueDetail.due.tax_amount || 0)} />} />
                                    <CompactLabelValue label="Total TTC" value={<MoneyText value={Number(dueDetail.due.amount_ttc || 0)} />} strong />
                                    {Number(dueDetail.due.credit_applied || 0) > 0 && (
                                        <CompactLabelValue label="Crédit appliqué" value={<MoneyText value={Number(dueDetail.due.credit_applied)} />} />
                                    )}
                                </CompactSection>
                                <CompactSection title="Paiements affectés">
                                    {dueDetail.allocations.length === 0 ? (
                                        <p className="py-1 text-[0.7rem] font-medium text-slate-500">Aucune affectation enregistrée.</p>
                                    ) : dueDetail.allocations.map((allocation) => (
                                        <CompactLabelValue
                                            key={allocation.id}
                                            label={new Date(allocation.allocated_at).toLocaleDateString('fr-FR')}
                                            value={<MoneyText value={allocation.allocation_type === 'reversal' ? -Number(allocation.amount) : Number(allocation.amount)} />}
                                        />
                                    ))}
                                </CompactSection>
                                <CompactSection title="Documents & relances">
                                    <SmartCombobox
                                        value={dueDocumentType}
                                        options={dueDocumentOptions}
                                        onChange={(value) => setDueDocumentType(value as RentalDueDocumentType)}
                                        placeholder="Type de document"
                                        searchPlaceholder="Rechercher un document..."
                                        density="compact"
                                        className="mb-2 w-full"
                                    />
                                    {dueDetail.documents.length > 0 ? (
                                        <div className="mb-2 space-y-1">
                                            {dueDetail.documents.slice(0, 3).map((document) => (
                                                <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1.5">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[0.66rem] font-bold text-slate-800">{rentalDueDocumentLabel(document.document_type)}</p>
                                                        <p className="truncate text-[0.58rem] font-medium text-slate-500">{document.reference ?? 'Référence en préparation'} · v{document.version}</p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-wider text-emerald-800">
                                                        {document.status === 'archived' ? 'Archivé' : document.status === 'issued' ? 'Émis' : document.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mb-2 py-1 text-[0.66rem] font-medium text-slate-500">Aucun document émis pour cette échéance.</p>
                                    )}
                                    <CompactLabelValue label="Livraisons" value={`${dueDetail.deliveries.length} trace(s)`} />
                                    <CompactLabelValue label="Rappels" value={`${dueDetail.reminders.length} planifié(s)`} />
                                    <CompactLabelValue label="Journal" value={`${dueDetail.events.length} événement(s)`} />
                                    {dueDetail.reminders.slice(0, 2).map((reminder) => (
                                        <CompactLabelValue
                                            key={reminder.id}
                                            label={reminder.reminder_type === 'overdue' ? 'Relance retard' : reminder.reminder_type === 'final' ? 'Dernier rappel' : "Rappel d'échéance"}
                                            value={`${new Date(reminder.scheduled_for).toLocaleDateString('fr-FR')} · ${reminder.status}`}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => void handleScheduleDueReminders()}
                                        disabled={Boolean(dueAction) || dueDetail.due.status === 'PAID' || dueDetail.due.status === 'CANCELLED'}
                                        className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-900/15 bg-emerald-50/70 px-2 text-[0.68rem] font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {dueAction === 'reminders' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                                        Planifier les rappels
                                    </button>
                                </CompactSection>
                                {canManageDueEngine && dueDetail.due.status !== 'PAID' && dueDetail.due.status !== 'CANCELLED' && (
                                    <CompactSection title="Correction contrôlée" icon={XCircle}>
                                        <p className="mb-2 text-[0.66rem] font-medium leading-relaxed text-slate-500">
                                            {cancellationRequiresCreditNote
                                                ? "Une facture a déjà été émise. Un avoir doit être enregistré avant l'annulation."
                                                : "L'annulation conserve l'échéance, ses documents et son historique. Un motif est obligatoire."}
                                        </p>
                                        {cancellationRequiresCreditNote && (
                                            <button
                                                type="button"
                                                onClick={() => void handlePrepareDueDocument('credit_note')}
                                                disabled={Boolean(dueAction)}
                                                className="mb-1.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2 text-[0.68rem] font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FileCheck2 className="h-3.5 w-3.5" />
                                                Émettre l'avoir requis
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setCancelDueOpen(true)}
                                            disabled={Boolean(dueAction) || cancellationRequiresCreditNote}
                                            className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2 text-[0.68rem] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                            Annuler l'échéance
                                        </button>
                                    </CompactSection>
                                )}
                            </>
                        )}
                        <CompactSection title="Affectation">
                            <CompactLabelValue
                                label="Bien"
                                value={
                                    <button
                                        type="button"
                                        onClick={() => { window.location.hash = '#/patrimoine'; }}
                                        className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700 hover:text-brand-900 underline underline-offset-2 transition"
                                    >
                                        {`${drawerLoyer.immeuble_nom} · ${drawerLoyer.unite_nom}`} &rarr;
                                    </button>
                                }
                            />
                            <CompactLabelValue
                                label={isIndividualOwner ? 'Propriétaire' : 'Bailleur'}
                                value={
                                    <button
                                        type="button"
                                        onClick={() => { window.location.hash = '#/bailleurs'; }}
                                        className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700 hover:text-brand-900 underline underline-offset-2 transition"
                                    >
                                        {`${drawerLoyer.bailleur_prenom} ${drawerLoyer.bailleur_nom}`} &rarr;
                                    </button>
                                }
                            />
                            <CompactLabelValue label="Période" value={new Date(drawerLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
                        </CompactSection>
                        <CompactSection title="Contact">
                            <CompactLabelValue
                                label="Locataire"
                                value={
                                    <button
                                        type="button"
                                        onClick={() => { window.location.hash = `#/occupants-baux?id=${drawerLoyer.contrat_id}`; }}
                                        className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700 hover:text-brand-900 underline underline-offset-2 transition"
                                    >
                                        {`${drawerLoyer.locataire_prenom} ${drawerLoyer.locataire_nom}`} &rarr;
                                    </button>
                                }
                            />
                            <CompactLabelValue label="Téléphone" value={drawerLoyer.telephone_locataire || '—'} />
                        </CompactSection>
                        <CompactSection title="Traçabilité financière">
                            <div className="text-[0.72rem] text-slate-500 space-y-1">
                                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {dueDetail ? 'Échéance enregistrée dans le moteur canonique' : 'Créance calculée depuis les données financières existantes'}</p>
                                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {dueDetail ? 'Lignes, affectations et versions traçables' : 'Migration progressive sans altération des paiements'}</p>
                            </div>
                        </CompactSection>
                    </PremiumDrawerShell>
                )
            }
        />

        {bulkGenerationOpen && (
            <WizardShell
                open
                title="Préparer les échéances du mois"
                eyebrow="FACTURATION LOCATIVE"
                description="Contrôlez les contrats éligibles avant toute génération."
                steps={[
                    { id: 'period', label: 'Période' },
                    { id: 'control', label: 'Contrôle' },
                ]}
                currentStep={bulkGenerationPreview ? 1 : 0}
                size="simple"
                variant="workstation"
                tone="finance"
                onClose={() => {
                    if (bulkGenerationLoading) return;
                    setBulkGenerationOpen(false);
                    setBulkGenerationPreview(null);
                    setBulkGenerationError(null);
                }}
                panelClassName="sm:!w-[min(92vw,720px)] sm:!max-w-[720px]"
                bodyClassName="!py-3"
                secondaryAction={
                    <PremiumButton
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setBulkGenerationOpen(false);
                            setBulkGenerationPreview(null);
                            setBulkGenerationError(null);
                        }}
                        disabled={bulkGenerationLoading}
                    >
                        Fermer
                    </PremiumButton>
                }
                primaryAction={
                    <PremiumButton
                        variant="create"
                        size="sm"
                        icon={bulkGenerationLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : bulkGenerationPreview
                                ? <FileCheck2 className="h-3.5 w-3.5" />
                                : <Search className="h-3.5 w-3.5" />}
                        onClick={() => void (bulkGenerationPreview ? handleBulkGeneration() : handleBulkPreview())}
                        disabled={bulkGenerationLoading || !bulkGenerationPeriod || Boolean(bulkGenerationPreview?.blocked_count)}
                    >
                        {bulkGenerationLoading
                            ? 'Traitement en cours…'
                            : bulkGenerationPreview
                                ? `Générer ${bulkGenerationPreview.ready_count} échéance(s)`
                                : 'Analyser la période'}
                    </PremiumButton>
                }
            >
                <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-950/10 bg-white/80 p-3">
                        <label htmlFor="bulk-due-period" className="mb-1.5 block text-[0.62rem] font-black uppercase tracking-[0.13em] text-slate-500">
                            Mois de facturation
                        </label>
                        <input
                            id="bulk-due-period"
                            type="month"
                            value={bulkGenerationPeriod.slice(0, 7)}
                            onChange={(event) => {
                                setBulkGenerationPeriod(event.target.value ? `${event.target.value}-01` : '');
                                setBulkGenerationPreview(null);
                                setBulkGenerationError(null);
                            }}
                            className="h-9 w-full rounded-lg border border-emerald-950/15 bg-[#fffdf8] px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-emerald-700/35 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        <p className="mt-1.5 text-[0.66rem] font-medium leading-relaxed text-slate-500">
                            Le contrôle détecte les contrats prêts, les doublons et les données bloquantes sans créer d'échéance.
                        </p>
                    </div>

                    {bulkGenerationError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] font-semibold text-red-700">
                            {bulkGenerationError}
                        </div>
                    )}

                    {bulkGenerationPreview && (
                        <>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {[
                                    ['Contrats', bulkGenerationPreview.candidate_count, 'slate'],
                                    ['Prêts', bulkGenerationPreview.ready_count, 'emerald'],
                                    ['Alertes', bulkGenerationPreview.warning_count, 'amber'],
                                    ['Bloqués', bulkGenerationPreview.blocked_count, 'red'],
                                    ['Existants', bulkGenerationPreview.existing_count, 'blue'],
                                ].map(([label, value, tone]) => (
                                    <div key={String(label)} className={`rounded-xl border px-2.5 py-2 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'red' ? 'border-red-200 bg-red-50' : tone === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                                        <p className="text-[0.55rem] font-black uppercase tracking-wider text-slate-500">{label}</p>
                                        <p className="mt-0.5 text-base font-black tabular-nums text-slate-950">{value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="max-h-[16rem] space-y-1.5 overflow-y-auto pr-1">
                                {bulkGenerationPreview.items.map((item) => {
                                    const issues = Object.values(item.issues ?? {}).filter(Boolean);
                                    return (
                                        <div key={item.contract_id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-[0.72rem] font-bold text-slate-900">{item.tenant_name || 'Locataire non renseigné'}</p>
                                                <p className="truncate text-[0.62rem] font-medium text-slate-500">{item.property_name || 'Bien non renseigné'} · {item.unit_name || 'Unité non renseignée'}</p>
                                                {issues.length > 0 && <p className="mt-1 text-[0.6rem] font-semibold text-amber-700">{issues.join(' · ')}</p>}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <MoneyText value={item.rent_amount} className="text-[0.7rem] font-black text-slate-900" />
                                                <p className={`mt-1 text-[0.52rem] font-black uppercase tracking-wider ${item.readiness === 'ready' ? 'text-emerald-700' : item.readiness === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>
                                                    {item.existing_due_id ? 'Déjà créée' : item.readiness === 'ready' ? 'Prêt' : item.readiness === 'warning' ? 'À vérifier' : 'Bloqué'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </WizardShell>
        )}

        {cancelDueOpen && dueDetail && (
            <WizardShell
                open
                title="Annuler l'échéance"
                eyebrow="CORRECTION FINANCIÈRE"
                description="L'échéance reste conservée dans le journal d'audit."
                size="compact"
                variant="workstation"
                tone="finance"
                onClose={() => {
                    if (dueAction === 'cancel') return;
                    setCancelDueOpen(false);
                    setCancelDueReason('');
                }}
                secondaryAction={
                    <PremiumButton
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setCancelDueOpen(false);
                            setCancelDueReason('');
                        }}
                        disabled={dueAction === 'cancel'}
                    >
                        Conserver
                    </PremiumButton>
                }
                primaryAction={
                    <button
                        type="button"
                        onClick={() => void handleCancelDue()}
                        disabled={dueAction === 'cancel' || cancellationRequiresCreditNote || cancelDueReason.trim().length < 8}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-700/30 bg-red-700 px-4 text-[0.72rem] font-black text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {dueAction === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Confirmer l'annulation
                    </button>
                }
            >
                <div className="space-y-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[0.72rem] font-bold text-amber-950">{dueDetail.due.reference ?? "Échéance sans référence"}</p>
                        <p className="mt-0.5 text-[0.66rem] font-medium text-amber-800">
                            {new Date(dueDetail.due.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} · {formatCurrency(Number(dueDetail.due.amount_ttc || 0))}
                        </p>
                    </div>
                    {cancellationRequiresCreditNote && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                            <p className="text-[0.7rem] font-bold text-red-800">Avoir obligatoire avant annulation</p>
                            <p className="mt-0.5 text-[0.64rem] font-medium leading-relaxed text-red-700">
                                La facture d'origine reste traçable. Fermez cette fenêtre et émettez l'avoir proposé dans la fiche.
                            </p>
                        </div>
                    )}
                    <div>
                        <label htmlFor="cancel-due-reason" className="mb-1.5 block text-[0.62rem] font-black uppercase tracking-[0.13em] text-slate-500">
                            Motif de l'annulation
                        </label>
                        <textarea
                            id="cancel-due-reason"
                            rows={3}
                            value={cancelDueReason}
                            onChange={(event) => setCancelDueReason(event.target.value)}
                            placeholder="Ex. bail résilié avant la période facturée"
                            className="w-full resize-none rounded-xl border border-emerald-950/15 bg-[#fffdf8] px-3 py-2 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700/35 focus:ring-2 focus:ring-emerald-700/10"
                        />
                        <p className={`mt-1 text-[0.62rem] font-medium ${cancelDueReason.trim().length > 0 && cancelDueReason.trim().length < 8 ? 'text-red-600' : 'text-slate-500'}`}>
                            {cancelDueReason.trim().length > 0 && cancelDueReason.trim().length < 8 ? 'Précisez le motif en au moins 8 caractères.' : 'Le motif sera enregistré avec la correction.'}
                        </p>
                    </div>
                </div>
            </WizardShell>
        )}

        {/* Workflow de paiement */}
            {showModal && selectedLoyer && (
                <WizardShell
                    open={showModal && Boolean(selectedLoyer)}
                    title="Encaisser ce loyer"
                    eyebrow="CRÉANCES & RECOUVREMENT"
                    description="Paiement partiel ou complet avec traçabilité et quittance."
                    size="compact"
                    variant="workstation"
                    tone="finance"
                    onClose={() => setShowModal(false)}
                    panelClassName="sm:!w-[min(90vw,580px)] sm:!max-w-[580px]"
                    bodyClassName="!py-2.5 sm:!py-3"
                    footerClassName="!py-1.5"
                    secondaryAction={
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            disabled={submitting}
                            className="inline-flex h-8 min-h-0 w-full min-w-[6rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-950/10 bg-white/85 px-3 py-1 text-[0.72rem] font-semibold leading-none text-slate-600 shadow-sm outline-none transition hover:bg-white disabled:opacity-50 sm:w-auto"
                        >
                            Annuler
                        </button>
                    }
                    primaryAction={
                        <button
                            type="button"
                            onClick={handleConfirmPaiement}
                            disabled={submitting || paymentAmount <= 0}
                            className="inline-flex h-8 min-h-0 w-full min-w-[7rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-3 py-1 text-[0.72rem] font-semibold leading-none text-white shadow-[0_10px_22px_rgba(6,45,35,0.16)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        >
                            <HandCoins className="h-3.5 w-3.5" />
                            {submitting ? 'Enregistrement...' : `Enregistrer (${formatCurrency(paymentAmount)})`}
                        </button>
                    }
                >
                    <div className="flex flex-col gap-3">
                        {/* Bandeau locataire / lot / créance */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-950/15 bg-gradient-to-r from-emerald-900 via-emerald-800 to-[#073125] px-3 py-2 text-white shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/15">
                                    <HandCoins className="h-3.5 w-3.5 text-emerald-300" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black truncate">{selectedLoyer.locataire_prenom} {selectedLoyer.locataire_nom}</span>
                                        <span className="rounded bg-emerald-700/80 px-1.5 py-0.5 text-[0.62rem] font-bold capitalize text-emerald-100">
                                            {new Date(selectedLoyer.mois_concerne).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="text-[0.65rem] font-medium text-emerald-200/90 truncate">
                                        {selectedLoyer.immeuble_nom} · {selectedLoyer.unite_nom}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1 border border-white/10 shrink-0">
                                <span className="text-[0.62rem] font-bold uppercase tracking-wider text-emerald-200">Reste à encaisser :</span>
                                <span className="font-black text-amber-300 text-xs">{formatCurrency(selectedLoyer.montant_du)}</span>
                            </div>
                        </div>

                        {/* Saisie rapide */}
                        <div className="flex items-center justify-between gap-2 bg-emerald-50/70 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                            <span className="text-[0.68rem] font-bold text-emerald-900 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-emerald-700" />
                                Remplissage rapide :
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPaymentForm({ ...paymentForm, montant: String(selectedLoyer.montant_du) })}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-0.5 text-[0.66rem] font-bold text-white shadow-sm transition hover:bg-emerald-800"
                                >
                                    Solde complet ({formatCurrency(selectedLoyer.montant_du)})
                                </button>
                                {selectedLoyer.montant_du > 1000 && (
                                    <button
                                        type="button"
                                        onClick={() => setPaymentForm({ ...paymentForm, montant: String(Math.round(selectedLoyer.montant_du / 2)) })}
                                        className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[0.66rem] font-bold text-emerald-800 transition hover:bg-emerald-50"
                                    >
                                        50%
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Champs de saisie */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Montant encaissé <span className="text-red-500">*</span></p>
                                <input
                                    aria-label="Champ de saisie"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={paymentForm.montant}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, montant: e.target.value })}
                                    placeholder="Ex: 100000"
                                    className="!h-8 !min-h-8 w-full rounded-[0.6rem] border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600/15"
                                />
                                {paymentAmount > 0 && (
                                    <p className="mt-0.5 text-[0.66rem] font-bold text-emerald-700">Saisi : {formatCurrency(paymentAmount)}</p>
                                )}
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Date paiement <span className="text-red-500">*</span></p>
                                <input
                                    aria-label="Champ de saisie"
                                    type="date"
                                    value={paymentForm.date_paiement}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, date_paiement: e.target.value })}
                                    className="!h-8 !min-h-8 w-full rounded-[0.6rem] border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600/15"
                                />
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Mode de paiement <span className="text-red-500">*</span></p>
                                <SmartCombobox
                                    value={paymentForm.mode_paiement}
                                    options={PAYMENT_MODE_OPTIONS}
                                    onChange={(val) => setPaymentForm({ ...paymentForm, mode_paiement: val })}
                                    placeholder="Sélectionner le mode"
                                    searchPlaceholder="Rechercher un mode..."
                                    density="compact"
                                />
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Référence transaction</p>
                                <input
                                    value={paymentForm.reference}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                    className="!h-8 !min-h-8 w-full rounded-[0.6rem] border border-emerald-950/15 bg-[#fffdf8]/95 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600/15"
                                    placeholder="N° Wave, chèque ou virement..."
                                />
                            </div>
                        </div>

                        {/* Simulation statut */}
                        <div className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between transition ${
                            remainingAfterPayment > 0
                                ? 'border-orange-200 bg-orange-50/70 text-orange-950'
                                : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        }`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                                    remainingAfterPayment > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {remainingAfterPayment > 0 ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[0.64rem] font-bold uppercase tracking-wider text-slate-500">Nouveau statut du loyer</div>
                                    <div className={`text-xs font-black ${
                                        remainingAfterPayment > 0 ? 'text-orange-700' : 'text-emerald-700'
                                    }`}>
                                        {remainingAfterPayment > 0 ? 'PAIEMENT PARTIEL' : 'SOLDÉ (APURÉ COMPLET)'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[0.64rem] font-bold uppercase tracking-wider text-slate-500">Reliquat restant</div>
                                <div className={`text-xs font-black ${remainingAfterPayment > 0 ? 'text-orange-700' : 'text-emerald-800'}`}>
                                    {formatCurrency(remainingAfterPayment)}
                                </div>
                            </div>
                        </div>
                    </div>
                </WizardShell>
            )}
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </PageShell>
    );
}

