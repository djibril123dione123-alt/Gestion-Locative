import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar, type QuickChip } from '../components/ui/PremiumToolbar';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { WizardShell } from '../components/ui/WizardShell';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { ClipboardList, Plus, Download, Trash2, Search, FileCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, ShieldCheck, Building2, Sparkles, Layers } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { addFooter, drawPageBorder, drawSectionFrame, saveGeneratedPdf } from '../lib/pdf';
import { SkeletonTable } from '../components/ui/Skeleton';

interface Piece {
  nom: string;
  etat: 'bon' | 'moyen' | 'mauvais';
  observations: string;
}

interface Contrat {
  id: string;
  locataires?: { nom: string; prenom: string };
  unites?: { nom: string; immeubles?: { id?: string; nom: string } };
}

interface Inventaire {
  id: string;
  type: 'entree' | 'sortie';
  date: string;
  statut: 'en_cours' | 'termine' | 'litige';
  contrat_id: string;
  pieces: Piece[];
  observations: string | null;
  caution_retenue: number;
  locataire_present: boolean;
  proprietaire_present: boolean;
  agent_present: boolean;
  contrats?: Contrat;
}

const statutColors: Record<string, string> = {
  en_cours: 'bg-blue-100 text-blue-800',
  termine: 'bg-green-100 text-green-800',
  litige: 'bg-red-100 text-red-800',
};

const etatColors: Record<string, string> = {
  bon: 'bg-green-100 text-green-800',
  moyen: 'bg-yellow-100 text-yellow-800',
  mauvais: 'bg-red-100 text-red-800',
};

type InventaireTypeFilter = 'all' | 'entree' | 'sortie';
type InventaireStatutFilter = 'all' | 'en_cours' | 'termine' | 'litige';

export function Inventaires() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Inventaire[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<InventaireTypeFilter>('all');
  const [filterStatut, setFilterStatut] = useState<InventaireStatutFilter>('all');
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all');

  const [deleteTarget, setDeleteTarget] = useState<Inventaire | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    contrat_id: '',
    type: 'entree' as 'entree' | 'sortie',
    date: new Date().toISOString().split('T')[0],
    locataire_present: true,
    proprietaire_present: false,
    agent_present: true,
    pieces: [{ nom: 'Salon', etat: 'bon' as Piece['etat'], observations: '' }],
    observations: '',
    caution_retenue: 0,
  });

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [invRes, contratsRes, immRes] = await Promise.all([
        supabase
          .from('inventaires')
          .select(`*, contrats(id, locataires(nom, prenom), unites(nom, immeubles(nom, id)))`)
          .eq('agency_id', profile.agency_id)
          .order('date', { ascending: false }),
        supabase
          .from('contrats')
          .select('id, locataires(nom, prenom), unites(nom, immeubles(nom, id))')
          .eq('agency_id', profile.agency_id)
          .eq('statut', 'actif'),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
      ]);
      if (invRes.data) setItems(invRes.data as unknown as Inventaire[]);
      if (contratsRes.data) setContrats(contratsRes.data as unknown as Contrat[]);
      if (immRes.data) setImmeubles(immRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inventaires').insert({
        agency_id: profile.agency_id,
        contrat_id: form.contrat_id,
        type: form.type,
        date: form.date,
        statut: 'en_cours',
        pieces: form.pieces,
        observations: form.observations.trim() || null,
        caution_retenue: form.caution_retenue || 0,
        locataire_present: form.locataire_present,
        proprietaire_present: form.proprietaire_present,
        agent_present: form.agent_present,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('État des lieux créé avec succès');
      setIsOpen(false);
      setForm({
        contrat_id: '',
        type: 'entree',
        date: new Date().toISOString().split('T')[0],
        locataire_present: true,
        proprietaire_present: false,
        agent_present: true,
        pieces: [{ nom: 'Salon', etat: 'bon', observations: '' }],
        observations: '',
        caution_retenue: 0,
      });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async (inv: Inventaire) => {
    const loc = `${inv.contrats?.locataires?.prenom ?? ''} ${inv.contrats?.locataires?.nom ?? ''}`;
    const bien = `${inv.contrats?.unites?.immeubles?.nom ?? ''} - ${inv.contrats?.unites?.nom ?? ''}`;
    const typeTitle = inv.type === 'entree' ? 'ÉTAT DES LIEUX D’ENTRÉE' : 'ÉTAT DES LIEUX DE SORTIE';

    let agenceInfo = {
      nom: 'SAMAY KEUR',
      adresse: 'Sénégal',
      contact: '',
    };
    if (profile?.agency_id) {
      const { data } = await supabase.from('agencies').select('name, address, email, phone').eq('id', profile.agency_id).maybeSingle();
      if (data) {
        agenceInfo = {
          nom: data.name || 'SAMAY KEUR',
          adresse: data.address || 'Sénégal',
          contact: [data.phone, data.email].filter(Boolean).join(' · '),
        };
      }
    }

    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    let y = 16;

    drawPageBorder(doc);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(typeTitle, 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${agenceInfo.nom} — Date : ${new Date(inv.date).toLocaleDateString('fr-FR')}`, 14, y);
    y += 10;

    y = drawSectionFrame(doc, y, 32);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('INFORMATIONS CONTRAT & BIEN', 18, y + 6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Locataire : ${loc}`, 18, y + 14);
    doc.text(`Bien : ${bien}`, 18, y + 21);
    doc.text(`Statut : ${inv.statut === 'termine' ? 'Terminé' : inv.statut === 'litige' ? 'En litige' : 'En cours'}`, 115, y + 14);
    y += 38;

    autoTable(doc, {
      startY: y,
      head: [['Pièce / Élément', 'État constaté', 'Observations']],
      body: (inv.pieces || []).map((p) => [
        p.nom,
        p.etat === 'bon' ? 'Bon état' : p.etat === 'moyen' ? 'État moyen' : 'Mauvais état',
        p.observations || '-',
      ]),
      headStyles: { fillColor: [24, 160, 88], textColor: 255 },
      styles: { fontSize: 9 },
    });

    addFooter(doc, profile?.agency_id || null, 'État des lieux officiel - Samay Keur');

    const fileName = `Etat_des_lieux_${inv.type}_${loc.replace(/\s+/g, '_')}.pdf`;
    saveGeneratedPdf(doc, fileName, 'documents');
  };

  const updateStatut = async (id: string, statut: Inventaire['statut']) => {
    const { error } = await supabase.from('inventaires').update({ statut }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('inventaires').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Inventaire supprimé');
      setDeleteTarget(null);
      load();
    }
    setDeleting(false);
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterType !== 'all' && i.type !== filterType) return false;
      if (filterStatut !== 'all' && i.statut !== filterStatut) return false;
      if (filterImmeuble !== 'all' && i.contrats?.unites?.immeubles?.id !== filterImmeuble) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const loc = `${i.contrats?.locataires?.prenom ?? ''} ${i.contrats?.locataires?.nom ?? ''}`.toLowerCase();
        const bien = `${i.contrats?.unites?.immeubles?.nom ?? ''} ${i.contrats?.unites?.nom ?? ''}`.toLowerCase();
        if (!loc.includes(q) && !bien.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterType, filterStatut, filterImmeuble, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      entrees: items.filter((i) => i.type === 'entree').length,
      sorties: items.filter((i) => i.type === 'sortie').length,
      litiges: items.filter((i) => i.statut === 'litige').length,
    };
  }, [items]);

  const updatePiece = (idx: number, patch: Partial<Piece>) => {
    setForm((f) => ({ ...f, pieces: f.pieces.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };

  const addPiece = () => setForm((f) => ({ ...f, pieces: [...f.pieces, { nom: '', etat: 'bon', observations: '' }] }));
  const removePiece = (idx: number) => setForm((f) => ({ ...f, pieces: f.pieces.filter((_, i) => i !== idx) }));

  const ALL_COLUMN_KEYS_INVENTAIRES = ['date', 'type', 'contrat', 'statut', 'actions'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('inventaires', [...ALL_COLUMN_KEYS_INVENTAIRES]);

  const allColumns = [
    {
      key: 'date',
      label: 'Date constat',
      render: (i: Inventaire) => (
        <span className="text-xs font-semibold text-slate-800">
          {new Date(i.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (i: Inventaire) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            i.type === 'entree'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-2xs'
          }`}
        >
          {i.type === 'entree' ? (
            <>
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
              Entrée
            </>
          ) : (
            <>
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
              Sortie
            </>
          )}
        </span>
      ),
    },
    {
      key: 'contrat',
      label: 'Locataire & Bien',
      render: (i: Inventaire) => {
        const prenom = i.contrats?.locataires?.prenom ?? '';
        const nom = i.contrats?.locataires?.nom ?? '';
        const init = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || 'L';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {init}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {prenom} {nom}
              </p>
              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                {i.contrats?.unites?.immeubles?.nom ?? 'Immeuble'} – {i.contrats?.unites?.nom ?? 'Unité'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'pieces',
      label: 'Inspection & Retenue',
      render: (i: Inventaire) => {
        const nbPieces = Array.isArray(i.pieces) ? i.pieces.length : 0;
        const retenue = Number(i.caution_retenue) || 0;
        return (
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <Layers className="w-3 h-3 text-slate-500" />
              {nbPieces} {nbPieces > 1 ? 'pièces inspectées' : 'pièce inspectée'}
            </span>
            {retenue > 0 ? (
              <div className="text-[11px] font-bold text-amber-700">
                Retenue : {formatCurrency(retenue)}
              </div>
            ) : (
              <div className="text-[11px] font-medium text-emerald-700">
                ✓ Aucune retenue caution
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (i: Inventaire) => (
        <select
          aria-label="Sélection du statut"
          value={i.statut}
          onChange={(e) => updateStatut(i.id, e.target.value as Inventaire['statut'])}
          data-testid={`select-statut-${i.id}`}
          className={`text-[11px] font-bold px-3 py-1 rounded-full border cursor-pointer transition shadow-2xs outline-none ${statutColors[i.statut]}`}
        >
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé & signé</option>
          <option value="litige">Litige ou réserve</option>
        </select>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (i: Inventaire) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => generatePDF(i)}
            data-testid={`button-download-pdf-${i.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/70 transition shadow-2xs"
            title="Générer l'état des lieux en PDF probant"
          >
            <Download className="w-3.5 h-3.5" />
            Rapport PDF
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(i)}
            data-testid={`button-delete-${i.id}`}
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-red-200/70 text-red-600 hover:bg-red-50 transition"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const columns = allColumns.filter((c) => c.key === 'actions' || colIsVisible(c.key));

  const quickChips: QuickChip[] = useMemo(() => [
    {
      id: 'all',
      label: 'Tous',
      count: items.length,
      isActive: filterType === 'all' && filterStatut === 'all',
      onClick: () => {
        setFilterType('all');
        setFilterStatut('all');
      },
    },
    {
      id: 'entree',
      label: 'Entrées',
      count: stats.entrees,
      isActive: filterType === 'entree',
      onClick: () => setFilterType(filterType === 'entree' ? 'all' : 'entree'),
    },
    {
      id: 'sortie',
      label: 'Sorties',
      count: stats.sorties,
      isActive: filterType === 'sortie',
      onClick: () => setFilterType(filterType === 'sortie' ? 'all' : 'sortie'),
    },
    {
      id: 'litige',
      label: 'En litige',
      count: stats.litiges,
      isActive: filterStatut === 'litige',
      onClick: () => setFilterStatut(filterStatut === 'litige' ? 'all' : 'litige'),
    },
  ], [items.length, stats, filterType, filterStatut]);

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3">
      <PremiumPageHeader
        density="compact"
        eyebrow="OPÉRATIONS TERRAIN"
        title="États des lieux"
        description="Préparez, suivez et archivez les inventaires d'entrée et de sortie."
        mobileDescription="États des lieux."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsOpen(true)} data-testid="button-new-inventaire" icon={<Plus className="h-4 w-4" />}>
            Nouvel inventaire
          </PremiumButton>
        }
      />

      <PremiumKpiGrid density="compact">
        <MetricCard density="compact" label="Total états des lieux" value={stats.total} icon={ClipboardList} tone="emerald" />
        <MetricCard density="compact" label="Entrées (Baux neufs)" value={stats.entrees} icon={ArrowUpRight} tone="blue" />
        <MetricCard density="compact" label="Sorties (Fin de bail)" value={stats.sorties} icon={ArrowDownRight} tone="green" />
        <MetricCard density="compact" label="En litige" value={stats.litiges} icon={AlertTriangle} tone="amber" />
      </PremiumKpiGrid>

      <PremiumToolbar
        density="compact"
        ariaLabel="Filtres des états des lieux"
        quickChips={quickChips}
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par locataire, immeuble ou unité..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-2.5 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10"
              />
            </div>
          </div>
        }
        filters={
          <div className="flex min-w-0 items-center gap-2">
            <SmartCombobox
              value={filterType}
              options={[
                { value: 'all', label: 'Tous types' },
                { value: 'entree', label: 'Entrée' },
                { value: 'sortie', label: 'Sortie' },
              ]}
              onChange={(val) => setFilterType((val || 'all') as InventaireTypeFilter)}
              placeholder="Type"
              className="w-36 shrink-0"
              density="compact"
            />
            <SmartCombobox
              value={filterStatut}
              options={[
                { value: 'all', label: 'Tous statuts' },
                { value: 'en_cours', label: 'En cours' },
                { value: 'termine', label: 'Terminé' },
                { value: 'litige', label: 'Litige' },
              ]}
              onChange={(val) => setFilterStatut((val || 'all') as InventaireStatutFilter)}
              placeholder="Statut"
              className="w-40 shrink-0"
              density="compact"
            />
            <SmartCombobox
              value={filterImmeuble}
              options={[
                { value: 'all', label: 'Tous immeubles' },
                ...immeubles.map((im) => ({ value: im.id, label: im.nom })),
              ]}
              onChange={(val) => setFilterImmeuble(val || 'all')}
              placeholder="Immeuble"
              className="w-44 shrink-0"
              density="compact"
            />
          </div>
        }
        secondaryActions={
          <ColumnPicker
            columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))}
            visibility={colVis}
            onToggle={colToggle}
            onSetAll={colSetAll}
          />
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-4 sm:p-6">
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucun inventaire" description="Créez votre premier état des lieux." />
        ) : (
          <Table data={filtered} columns={columns} />
        )}
      </div>

      <WizardShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="simple"
        variant="classic"
        tone="agency"
        eyebrow="SAMAY KËUR"
        title="Nouvel état des lieux"
        description="Renseignez le contrat, les présences et l'inspection minutieuse des pièces du bien."
        primaryAction={
          <button
            type="button"
            onClick={(e) => void submit(e as unknown as React.FormEvent)}
            disabled={submitting || !form.contrat_id}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer l’état des lieux'}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Annuler
          </button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Contrat concerné *</label>
              <SmartCombobox
                value={form.contrat_id}
                options={[
                  { value: '', label: '— Sélectionner un contrat —' },
                  ...contrats.map((c) => ({
                    value: c.id,
                    label: `${c.locataires?.prenom ?? ''} ${c.locataires?.nom ?? ''} (${c.unites?.immeubles?.nom ?? ''} - ${c.unites?.nom ?? ''})`,
                  })),
                ]}
                onChange={(val) => setForm({ ...form, contrat_id: val })}
                placeholder="Sélectionner un contrat"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Type d'état des lieux</label>
              <SmartCombobox
                value={form.type}
                options={[
                  { value: 'entree', label: 'État des lieux d’entrée' },
                  { value: 'sortie', label: 'État des lieux de sortie' },
                ]}
                onChange={(val) => setForm({ ...form, type: (val || 'entree') as 'entree' | 'sortie' })}
                placeholder="Type"
                className="w-full"
                density="compact"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Date du constat *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Caution retenue (FCFA)</label>
              <input
                type="number"
                value={form.caution_retenue}
                onChange={(e) => setForm({ ...form, caution_retenue: parseFloat(e.target.value) || 0 })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <label className="block text-[11px] font-semibold text-slate-700 mb-2">Présences lors de la visite</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.locataire_present}
                  onChange={(e) => setForm({ ...form, locataire_present: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Locataire présent
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.proprietaire_present}
                  onChange={(e) => setForm({ ...form, proprietaire_present: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Bailleur présent
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agent_present}
                  onChange={(e) => setForm({ ...form, agent_present: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                Agent Samay Keur présent
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-800">Pièces / Éléments inspectés</label>
              <button
                type="button"
                onClick={addPiece}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une pièce
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {form.pieces.map((p, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <input
                    type="text"
                    placeholder="Pièce (ex: Salon, Cuisine)"
                    value={p.nom}
                    onChange={(e) => updatePiece(idx, { nom: e.target.value })}
                    className="flex-1 h-9 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-emerald-700 outline-none"
                  />
                  <select
                    aria-label="Sélection de l'état"
                    value={p.etat}
                    onChange={(e) => updatePiece(idx, { etat: e.target.value as Piece['etat'] })}
                    className="w-full sm:w-32 h-9 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-emerald-700 outline-none"
                  >
                    <option value="bon">Bon état</option>
                    <option value="moyen">État moyen</option>
                    <option value="mauvais">Mauvais état</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Observations"
                    value={p.observations}
                    onChange={(e) => updatePiece(idx, { observations: e.target.value })}
                    className="flex-1 h-9 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-emerald-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePiece(idx)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0 self-start sm:self-center transition"
                    title="Supprimer cette pièce"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Observations générales</label>
            <textarea
              rows={2}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              placeholder="Constat global, compteurs, remise des clés..."
            />
          </div>
        </form>
      </WizardShell>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer l'état des lieux"
        message="Êtes-vous sûr de vouloir supprimer définitivement cet état des lieux ? Cette action est irréversible."
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        variant="danger"
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
