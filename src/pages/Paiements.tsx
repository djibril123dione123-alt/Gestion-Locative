import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ToastContainer } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { SkeletonCards, SkeletonTable } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Plus,
  Search,
  CreditCard,
  TrendingUp,
  Wallet,
  Percent,
  FileDown,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Sheet,
  AlertTriangle,
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
import { isCommissionMissing } from '../services/domain/commissionService';

interface PaiementRow {
  id: string;
  contrat_id: string;
  montant_total: number;
  mois_concerne: string;
  date_paiement: string;
  mode_paiement: string;
  statut: string;
  reference: string | null;
  contrats?: any;
}

interface ContratRow {
  id: string;
  loyer_mensuel: number;
  commission?: number;
  pourcentage_agence?: number;
  locataires?: { nom: string; prenom: string };
  unites?: { nom: string; id?: string };
}

type StatusFilter = 'tous' | 'paye' | 'en_attente' | 'impaye';

interface PaiementsProps {
  embedded?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  paye: { label: 'Payé', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  en_attente: { label: 'En attente', classes: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  impaye: { label: 'Impayé', classes: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
};

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
  const [editingPaiement, setEditingPaiement] = useState<PaiementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaiementRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const today = new Date();
  const currentMonthYYYYMM = today.toISOString().slice(0, 7);

  const initialFormData = {
    contrat_id: '',
    montant_total: '',
    mois_concerne: currentMonthYYYYMM + '-01',
    mois_display: currentMonthYYYYMM,
    date_paiement: today.toISOString().split('T')[0],
    mode_paiement: 'especes' as 'especes' | 'cheque' | 'virement' | 'mobile_money',
    statut: 'paye' as 'paye' | 'en_attente' | 'impaye',
    reference: '',
  };
  const [formData, setFormData] = useState(initialFormData);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPaiement(null);
    setFormData(initialFormData);
  };

  const loadData = async () => {
    if (!profile?.agency_id) return;

    try {
      const [paiementsRes, contratsRes] = await Promise.all([
        supabase
          .from('paiements')
          .select('*, contrats(loyer_mensuel, commission, locataires(nom, prenom), unites(nom,id))')
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contrats')
          .select('id, loyer_mensuel, commission, locataires(nom, prenom), unites(nom)')
          .eq('agency_id', profile.agency_id)
          .eq('statut', 'actif'),
      ]);

      const data = paiementsRes.data || [];
      setPaiements(data);
      setContrats((contratsRes.data || []) as unknown as ContratRow[]);
      // Sauvegarde locale automatique après chaque chargement
      saveBackup('paiements', data).catch(() => {});
    } catch (error) {
      showError('Impossible de charger les paiements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.agency_id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  // ===== Filtrage par statut + recherche (mémoïsé) =====
  const filtered = useMemo(() => {
    let list = paiements;
    if (statusFilter !== 'tous') {
      list = list.filter((p) => p.statut === statusFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) => {
        const loc = (p as any).contrats?.locataires;
        const searchable = [
          loc?.prenom,
          loc?.nom,
          (p as any).contrats?.unites?.nom,
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
  }, [paiements, statusFilter, searchTerm]);

  // ===== KPIs métier =====
  const kpis = useMemo(() => {
    const currentMonth = currentMonthYYYYMM;
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);

    let encaisseMois = 0;
    let nbPaiementsMois = 0;
    let encaissePrev = 0;
    let enAttente = 0;

    paiements.forEach((p) => {
      const moisP = (p.mois_concerne || '').slice(0, 7);
      if (p.statut === 'paye') {
        if (moisP === currentMonth) {
          encaisseMois += Number(p.montant_total || 0);
          nbPaiementsMois++;
        } else if (moisP === prevMonth) {
          encaissePrev += Number(p.montant_total || 0);
        }
      } else if (p.statut === 'en_attente') {
        enAttente += Number(p.montant_total || 0);
      }
    });

    // Loyer attendu ce mois (somme loyer_mensuel des contrats actifs)
    const attenduMois = contrats.reduce((s, c) => s + Number(c.loyer_mensuel || 0), 0);
    const tauxRecouvrement = attenduMois > 0 ? Math.round((encaisseMois / attenduMois) * 100) : 0;
    const variation = encaissePrev > 0 ? Math.round(((encaisseMois - encaissePrev) / encaissePrev) * 100) : null;

    return { encaisseMois, encaissePrev, nbPaiementsMois, enAttente, attenduMois, tauxRecouvrement, variation };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiements, contrats]);

  const counts = useMemo(() => {
    const c = { tous: paiements.length, paye: 0, en_attente: 0, impaye: 0 };
    paiements.forEach((p) => {
      if (p.statut in c) (c as any)[p.statut]++;
    });
    return c;
  }, [paiements]);

  const handleMoisChange = (monthValue: string) => {
    setFormData({ ...formData, mois_display: monthValue, mois_concerne: monthValue + '-01' });
  };

  const handleEdit = (paiement: any) => {
    setEditingPaiement(paiement);
    setFormData({
      contrat_id: paiement.contrat_id,
      montant_total: paiement.montant_total.toString(),
      mois_display: paiement.mois_concerne.slice(0, 7),
      mois_concerne: paiement.mois_concerne,
      date_paiement: paiement.date_paiement,
      mode_paiement: paiement.mode_paiement,
      statut: paiement.statut,
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
        { id: contrat.id, commission: contrat.commission ?? contrat.pourcentage_agence ?? null, loyer_mensuel: contrat.loyer_mensuel },
        profile.agency_id,
      );

      // ── Mode hors ligne : on met en file d'attente, on ne touche pas Supabase ──
      if (!isOnline && !editingPaiement) {
        await queueMutation({
          action: 'paiement_create',
          entity_type: 'paiements',
          payload: { ...data },
          timestamp: Date.now(),
        });
        success('Paiement enregistré localement — il sera synchronisé dès le retour de connexion');
        closeModal();
        return;
      }

      let error;
      if (editingPaiement) {
        const result = await supabase.from('paiements').update(data).eq('id', editingPaiement.id);
        error = result.error;
      } else {
        const result = await supabase.from('paiements').insert([data]);
        error = result.error;
      }

      if (error) throw error;

      if (!editingPaiement) {
        track({
          action: 'paiement_create',
          entity_type: 'paiements',
          metadata: { montant: data.montant_total, mois: data.mois_concerne, mode: data.mode_paiement },
        });
      }

      success(editingPaiement ? 'Paiement modifié avec succès' : 'Paiement enregistré avec succès');
      closeModal();
      loadData();
    } catch (error: unknown) {
      showError(formatPaiementError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (paiement: PaiementRow) => {
    if (!profile?.agency_id) return;
    setDeleteTarget(paiement);
  };

  const confirmDelete = async () => {
    if (!profile?.agency_id || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('paiements').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      if (deleteTarget.statut === 'paye') {
        await supabase.from('revenus').delete().eq('paiement_id', deleteTarget.id);
      }
      success('Paiement supprimé avec succès');
      setDeleteTarget(null);
      loadData();
    } catch (error: any) {
      showError(error.message || 'Impossible de supprimer ce paiement');
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
          `id, created_at, date_paiement, mois_concerne, montant_total, reference,
           contrats(id, loyer_mensuel, commission, locataires(nom, prenom), unites(id, nom))`,
        )
        .eq('agency_id', profile.agency_id)
        .eq('id', paiementId)
        .single();

      const paiement = pmt as unknown as {
        id: string; created_at: string; date_paiement: string; mois_concerne: string;
        montant_total: number; reference: string | null;
        contrats: {
          id: string; loyer_mensuel: number; commission: number;
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
        /* fallback */
      }

      const payload = {
        ...paiement,
        contrats: {
          ...paiement.contrats,
          unites: { ...paiement.contrats.unites, immeubles: { adresse } },
        },
      };

      await generatePaiementFacturePDF(payload as any);
      success('Facture générée avec succès');
    } catch (err: any) {
      showError(err?.message || 'Impossible de générer la facture PDF');
    } finally {
      setExportingId(null);
    }
  };

  // ============ Colonnes du tableau ============
  const columns = [
    {
      key: 'locataire',
      label: 'Locataire',
      render: (p: any) =>
        p.contrats?.locataires
          ? `${p.contrats.locataires.prenom} ${p.contrats.locataires.nom}`
          : '-',
    },
    { key: 'unite', label: 'Produit', render: (p: any) => p.contrats?.unites?.nom || '-' },
    {
      key: 'mois_concerne',
      label: 'Mois',
      render: (p: any) =>
        new Date(p.mois_concerne).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
    },
    {
      key: 'montant_total',
      label: 'Montant',
      render: (p: any) => <span className="font-semibold tabular-nums">{formatCurrency(p.montant_total)}</span>,
    },
    {
      key: 'date_paiement',
      label: 'Date paiement',
      render: (p: any) => new Date(p.date_paiement).toLocaleDateString('fr-FR'),
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (p: any) => <span className="text-slate-600 text-sm">{MODE_LABELS[p.mode_paiement] || p.mode_paiement}</span>,
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (p: any) => {
        const s = STATUS_LABELS[p.statut] || STATUS_LABELS.en_attente;
        const Icon = s.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.classes}`}>
            <Icon className="w-3.5 h-3.5" />
            {s.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p: any) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportFacture(p.id)}
            disabled={exportingId === p.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition disabled:opacity-50"
            title="Télécharger la facture PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingId === p.id ? '...' : 'Facture'}
          </button>
          <button
            type="button"
            onClick={() => handleEdit(p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </button>
          <button
            type="button"
            onClick={() => handleDelete(p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-md transition"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        </div>
      ),
    },
  ];

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'tous', label: 'Tous', count: counts.tous },
    { id: 'paye', label: 'Payés', count: counts.paye },
    { id: 'en_attente', label: 'En attente', count: counts.en_attente },
    { id: 'impaye', label: 'Impayés', count: counts.impaye },
  ];

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header — masqué quand intégré dans Encaissements (qui fournit son propre h1) */}
        {!embedded && (
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800">Paiements</h1>
              <p className="text-slate-500 text-sm mt-1">Encaissement des loyers</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportPaiements(
                  paiements.map((p) => ({
                    reference: p.reference,
                    date_paiement: p.date_paiement,
                    mois_concerne: p.mois_concerne,
                    montant_total: p.montant_total,
                    statut: p.statut,
                    mode_paiement: p.mode_paiement,
                    locataire_nom: `${(p.contrats as any)?.locataires?.prenom ?? ''} ${(p.contrats as any)?.locataires?.nom ?? ''}`.trim(),
                    unite_nom: (p.contrats as any)?.unites?.nom ?? '',
                  }))
                )}
                disabled={exportingXlsx || loading || paiements.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exporter en Excel"
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
              onClick={() => exportPaiements(
                paiements.map((p) => ({
                  reference: p.reference,
                  date_paiement: p.date_paiement,
                  mois_concerne: p.mois_concerne,
                  montant_total: p.montant_total,
                  statut: p.statut,
                  mode_paiement: p.mode_paiement,
                  locataire_nom: `${(p.contrats as any)?.locataires?.prenom ?? ''} ${(p.contrats as any)?.locataires?.nom ?? ''}`.trim(),
                  unite_nom: (p.contrats as any)?.unites?.nom ?? '',
                }))
              )}
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

        {/* KPIs */}
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
              label="En attente"
              value={formatCurrency(kpis.enAttente)}
              subtitle="à encaisser"
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

        {/* Toolbar : recherche + filtres rapides */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un locataire, une référence, un produit…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((f) => {
                const isActive = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 border-orange-300 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full ${
                        isActive ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tableau ou empty/loader */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
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
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table columns={columns} data={filtered} />
            </div>
          </div>
        )}

        {/* Modal nouveau / édition */}
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingPaiement ? 'Modifier le paiement' : 'Nouveau paiement'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contrat <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.contrat_id}
                onChange={(e) => {
                  const sel = contrats.find((c) => c.id === e.target.value);
                  setFormData({
                    ...formData,
                    contrat_id: e.target.value,
                    montant_total: sel?.loyer_mensuel?.toString() || '',
                  });
                }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              >
                <option value="">Sélectionner un contrat</option>
                {contrats.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.locataires?.prenom} {c.locataires?.nom} — {c.unites?.nom}
                  </option>
                ))}
              </select>
              {formData.contrat_id && (() => {
                const sel = contrats.find((c) => c.id === formData.contrat_id);
                const commission = sel?.commission ?? (sel as any)?.pourcentage_agence ?? null;
                return isCommissionMissing(commission) ? (
                  <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>Ce contrat n'a pas de commission configurée. Veuillez la définir dans la fiche contrat avant d'enregistrer.</span>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={formData.montant_total}
                  onChange={(e) => setFormData({ ...formData, montant_total: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mois concerné <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  required
                  value={formData.mois_display}
                  onChange={(e) => handleMoisChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date paiement <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_paiement}
                  onChange={(e) => setFormData({ ...formData, date_paiement: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.mode_paiement}
                  onChange={(e) =>
                    setFormData({ ...formData, mode_paiement: e.target.value as any })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="virement">Virement</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                <select
                  value={formData.statut}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                >
                  <option value="paye">Payé</option>
                  <option value="en_attente">En attente</option>
                  <option value="impaye">Impayé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Référence (facultatif)
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="N° de chèque, transaction…"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>
                Annuler
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingPaiement ? 'Enregistrer les modifications' : 'Créer le paiement'}
              </Button>
            </div>
          </form>
        </Modal>

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

// ============== Composant interne KPI ==============
type Accent = 'orange' | 'emerald' | 'amber' | 'slate';

const ACCENT_STYLES: Record<Accent, { iconBg: string; iconText: string; valueText: string; progressBg: string }> = {
  orange: { iconBg: 'bg-orange-50', iconText: 'text-orange-600', valueText: 'text-slate-900', progressBg: 'bg-gradient-to-r from-orange-500 to-red-600' },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', valueText: 'text-emerald-700', progressBg: 'bg-emerald-500' },
  amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-600', valueText: 'text-amber-700', progressBg: 'bg-amber-500' },
  slate: { iconBg: 'bg-slate-100', iconText: 'text-slate-600', valueText: 'text-slate-800', progressBg: 'bg-slate-400' },
};

interface KpiCardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  subtitle?: string;
  accent?: Accent;
  progress?: number;
}

function KpiCard({ icon: Icon, label, value, subtitle, accent = 'orange', progress }: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 truncate tabular-nums ${styles.valueText}`}>{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-5 h-5 ${styles.iconText}`} />
        </div>
      </div>
      {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${styles.progressBg}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
