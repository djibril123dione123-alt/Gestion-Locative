import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
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
  Trash2,
  Sheet,
} from 'lucide-react';
import { generatePaiementFacturePDF } from '../lib/pdf';
import { useToast } from '../hooks/useToast';
import { useTracking } from '../hooks/useTracking';
import { useExport } from '../hooks/useExport';
import { useBackup } from '../hooks/useBackup';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCurrency } from '../lib/formatters';
import {
  buildPaiementPayload,
  formatPaiementError,
} from '../services/domain/paiementService';
import {
  createPaiementViaEdge,
  updatePaiementViaEdge,
  cancelPaiementViaEdge,
  PaiementApiError,
} from '../services/api/paiementApi';
import { emitEvent } from '../lib/eventBus';
import { KpiCard } from '../components/paiements/KpiCard';
import { PaiementFormModal } from '../components/paiements/PaiementFormModal';
import {
  STATUS_LABELS,
  STATUS_LABEL_FALLBACK,
  MODE_LABELS,
  type PaiementRow,
  type ContratRow,
  type StatusFilter,
  type PaiementFormData,
} from '../components/paiements/paiementTypes';

interface PaiementsProps {
  embedded?: boolean;
}

export function Paiements({ embedded = false }: PaiementsProps = {}) {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();
  const { track } = useTracking();
  const { exportPaiements, exporting: exportingXlsx } = useExport();
  const { save: saveBackup } = useBackup();
  const { isOnline, enqueue: queueMutation } = useOfflineSync();

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
      const [paiementsRes, contratsRes] = await Promise.all([
        supabase
          .from('paiements')
          .select('*, contrats(loyer_mensuel, commission, locataires(nom, prenom), unites(nom,id,immeubles(nom,bailleurs(id,nom,prenom))))')
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contrats')
          .select('id, loyer_mensuel, commission, locataires(nom, prenom), unites(nom, id, immeubles(nom,bailleurs(id,nom,prenom))))')
          .eq('agency_id', profile.agency_id)
          .eq('statut', 'actif'),
      ]);

      const data = (paiementsRes.data || []) as unknown as PaiementRow[];
      setPaiements(data);
      setContrats((contratsRes.data || []) as unknown as ContratRow[]);
      saveBackup('paiements', data).catch(() => {});
    } catch {
      showError('Impossible de charger les paiements');
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
    const handler = () => { loadData(); };
    window.addEventListener('paiement:refresh', handler);
    return () => window.removeEventListener('paiement:refresh', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  const filtered = useMemo(() => {
    let list = paiements.filter((p) => p.statut === 'paye' || p.statut === 'partiel');
    if (statusFilter !== 'tous') {
      list = list.filter((p) => p.statut === statusFilter);
    }
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
        map.set(bailleur.id, `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim());
      }
    };
    paiements.forEach((row) => addBailleur(row.contrats));
    contrats.forEach((contrat) => addBailleur(contrat));
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [paiements, contrats]);

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

    return { encaisseMois, encaissePrev, nbPaiementsMois, reliquats, attenduMois, tauxRecouvrement, variation };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiements, contrats]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { tous: 0, paye: 0, partiel: 0 };
    paiements.forEach((p) => {
      if (p.statut === 'paye') c.paye++;
      else if (p.statut === 'partiel') c.partiel++;
    });
    c.tous = c.paye + c.partiel;
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
    setIsSaving(true);

    try {
      const contrat = contrats.find((c) => c.id === formData.contrat_id);
      if (!contrat) throw new Error('Contrat non trouvé');

      const moisConcerne = new Date(formData.mois_display + '-01').toISOString().split('T')[0];

      const data = buildPaiementPayload(
        {
          contrat_id: formData.contrat_id,
          montant_total: parseFloat(formData.montant_total),
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

      // ── Mode hors ligne : on stocke uniquement les champs d'entrée de l'Edge Function
      if (!isOnline && !editingPaiement) {
        const idempotencyKey = crypto.randomUUID();
        await queueMutation({
          action: 'paiement_create',
          entity_type: 'paiements',
          payload: {
            contrat_id: formData.contrat_id,
            montant_total: parseFloat(formData.montant_total),
            mois_concerne: moisConcerne,
            date_paiement: formData.date_paiement,
            mode_paiement: formData.mode_paiement,
            statut: formData.statut,
            idempotency_key: idempotencyKey,
            reference: formData.reference || null,
          },
          timestamp: Date.now(),
        });
        success('Paiement enregistré localement — il sera synchronisé dès le retour de connexion');
        closeModal();
        return;
      }

      if (editingPaiement) {
        await updatePaiementViaEdge({
          id: editingPaiement.id,
          montant_total: parseFloat(formData.montant_total),
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
          payload: { montant: parseFloat(formData.montant_total), mode: formData.mode_paiement },
        });
      } else {
        const idempotencyKey = crypto.randomUUID();
        await createPaiementViaEdge({
          contrat_id: formData.contrat_id,
          montant_total: parseFloat(formData.montant_total),
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
      loadData();
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
      loadData();
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
          `id, created_at, date_paiement, mois_concerne, montant_total, reliquat, reference,
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
        reliquat?: number | null;
        reference: string | null;
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

  const ALL_COLUMN_KEYS = ['locataire', 'unite', 'mois_concerne', 'montant_total', 'reliquat', 'date_paiement', 'mode', 'statut', 'actions'];
  const { visibility, toggle, setAll, isVisible } = useColumnVisibility('paiements', ALL_COLUMN_KEYS, { actions: true });

  const allColumns = [
    {
      key: 'locataire',
      label: 'Locataire',
      render: (p: PaiementRow) =>
        p.contrats?.locataires
          ? `${p.contrats.locataires.prenom} ${p.contrats.locataires.nom}`
          : '-',
    },
    {
      key: 'unite',
      label: 'Produit',
      render: (p: PaiementRow) => p.contrats?.unites?.nom || '-',
    },
    {
      key: 'mois_concerne',
      label: 'Mois',
      render: (p: PaiementRow) =>
        new Date(p.mois_concerne).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
    },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (p: PaiementRow) => (
        <span className="font-semibold tabular-nums">{formatCurrency(p.montant_total)}</span>
      ),
    },
    {
      key: 'reliquat',
      label: 'Reliquat',
      render: (p: PaiementRow) => (
        <span className={`font-semibold tabular-nums ${Number(p.reliquat || 0) > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
          {formatCurrency(Number(p.reliquat || 0))}
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
        const s = STATUS_LABELS[p.statut] ?? STATUS_LABEL_FALLBACK;
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
    {
      key: 'actions',
      label: 'Actions',
      render: (p: PaiementRow) => (
        <div className="sk-action-group-right">
          <button
            type="button"
            onClick={() => exportFacture(p.id)}
            disabled={exportingId === p.id}
            className="sk-action sk-action-financial"
            title="Télécharger la facture PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingId === p.id ? '...' : 'Facture'}
          </button>
          <button
            type="button"
            onClick={() => handleEdit(p)}
            className="sk-action sk-action-secondary"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </button>
          <button
            type="button"
            onClick={() => handleDelete(p)}
            className="sk-action sk-action-danger"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        </div>
      ),
    },
  ];

  const columns = allColumns.filter((c) => isVisible(c.key));

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'tous',        label: 'Tous',       count: counts.tous        },
    { id: 'paye',        label: 'Payés',      count: counts.paye        },
    { id: 'partiel',     label: 'Partiel',    count: counts.partiel     },
  ];

  const exportRows = paiements
    .filter((p) => p.statut === 'paye' || p.statut === 'partiel')
    .map((p) => ({
    reference:      p.reference,
    date_paiement:  p.date_paiement,
    mois_concerne:  p.mois_concerne,
    montant_total:  p.montant_total,
    statut:         p.statut,
    mode_paiement:  p.mode_paiement,
    locataire_nom:  `${p.contrats?.locataires?.prenom ?? ''} ${p.contrats?.locataires?.nom ?? ''}`.trim(),
    unite_nom:      p.contrats?.unites?.nom ?? '',
  }));

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="sk-page-shell space-y-6">
        {!embedded && (
          <header className="sk-page-hero flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">Paiements</h1>
              <p className="text-slate-600 text-sm font-medium mt-1">Encaissement des loyers</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportPaiements(exportRows)}
                disabled={exportingXlsx || loading || paiements.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sheet className="w-4 h-4" />
                Exporter Excel
              </button>
              <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
                Nouveau paiement
              </Button>
            </div>
          </header>
        )}

        {embedded && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => exportPaiements(exportRows)}
              disabled={exportingXlsx || loading || paiements.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sheet className="w-4 h-4" />
              Exporter Excel
            </button>
            <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
              Nouveau paiement
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Wallet}
              label="Encaissé ce mois"
              value={formatCurrency(kpis.encaisseMois)}
              subtitle={`${kpis.nbPaiementsMois} paiement${kpis.nbPaiementsMois > 1 ? 's' : ''}`}
              accent="emerald"
            />
            <KpiCard
              icon={TrendingUp}
              label="Mois précédent"
              value={formatCurrency(kpis.encaissePrev)}
              subtitle={
                kpis.variation !== null
                  ? `${kpis.variation >= 0 ? '+' : ''}${kpis.variation}% vs mois en cours`
                  : '—'
              }
              accent="slate"
            />
            <KpiCard
              icon={Clock}
              label="Reliquats"
              value={formatCurrency(kpis.reliquats)}
              subtitle="reste dû sur paiements partiels"
              accent="amber"
            />
            <KpiCard
              icon={Percent}
              label="Taux de recouvrement"
              value={`${kpis.tauxRecouvrement}%`}
              subtitle={`${formatCurrency(kpis.encaisseMois)} / ${formatCurrency(kpis.attenduMois)}`}
              accent="orange"
              progress={kpis.tauxRecouvrement}
            />
          </div>
        )}

        <div className="sk-premium-panel relative z-20 overflow-visible p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un locataire, une référence, un produit…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sk-input pl-10 pr-4"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:items-center">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="sk-input min-w-0 xl:w-48"
                aria-label="Filtrer par mois"
              >
                <option value="current">Mois en cours</option>
                <option value="all">Tous les mois</option>
                {Array.from(new Set(paiements.map((p) => (p.mois_concerne || '').slice(0, 7)).filter(Boolean)))
                  .sort()
                  .reverse()
                  .slice(0, 18)
                  .map((month) => (
                    <option key={month} value={month}>
                      {new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
              </select>
              <select
                value={bailleurFilter}
                onChange={(e) => setBailleurFilter(e.target.value)}
                className="sk-input min-w-0 xl:w-56"
                aria-label="Filtrer par bailleur"
              >
                <option value="all">Tous les bailleurs</option>
                {bailleurOptions.map((bailleur) => (
                  <option key={bailleur.id} value={bailleur.id}>
                    {bailleur.label}
                  </option>
                ))}
              </select>
              <ColumnPicker
                columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))}
                visibility={visibility}
                onToggle={toggle}
                onSetAll={setAll}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
              {statusFilters.map((f) => {
                const isActive = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                      isActive
                        ? 'bg-brand-950 text-white border-brand-950 shadow-sm'
                        : 'bg-white/85 text-slate-700 border-emerald-950/10 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-900 shadow-sm'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full ${
                        isActive ? 'bg-emerald-300 text-brand-950' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
          </div>
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
              <Table columns={columns} data={filtered} />
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
          isSaving={isSaving}
          onSubmit={handleSubmit}
          isOnline={isOnline}
        />

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Supprimer ce paiement"
          message="Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible."
          confirmText="Supprimer"
          cancelText="Annuler"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    </>
  );
}
