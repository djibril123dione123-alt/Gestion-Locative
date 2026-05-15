import React, { useEffect, useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { ClipboardList, Plus, Download, Trash2 } from 'lucide-react';
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

export function Inventaires() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Inventaire[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  type InventaireTypeFilter = 'all' | 'entree' | 'sortie';
  type InventaireStatutFilter = 'all' | 'en_cours' | 'termine' | 'litige';
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
    if (!profile?.agency_id || !form.contrat_id) {
      toast.warning('Sélectionnez un contrat');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inventaires').insert({
        agency_id: profile.agency_id,
        contrat_id: form.contrat_id,
        type: form.type,
        date: form.date,
        locataire_present: form.locataire_present,
        proprietaire_present: form.proprietaire_present,
        agent_present: form.agent_present,
        pieces: form.pieces,
        observations: form.observations || null,
        caution_retenue: form.type === 'sortie' ? form.caution_retenue : 0,
        statut: 'en_cours',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Inventaire créé');
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

  const updateStatut = async (id: string, statut: Inventaire['statut']) => {
    const { error } = await supabase.from('inventaires').update({ statut }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Statut mis à jour');
      load();
    }
  };

  const exportPDF = (inv: Inventaire) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    drawPageBorder(doc);

    const title = `État des lieux ${inv.type === 'entree' ? "d'entrée" : 'de sortie'}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Référence : ${inv.id.slice(0, 8).toUpperCase()} • ${new Date(inv.date).toLocaleDateString('fr-FR')}`, 14, 31);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 38, 196, 38);

    drawSectionFrame(doc, 14, 48, 182, 34, undefined, {
      title: 'Informations générales',
      accent: 'primary',
    });
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Locataire : ${inv.contrats?.locataires?.prenom ?? ''} ${inv.contrats?.locataires?.nom ?? ''}`, 18, 62);
    doc.text(`Logement : ${inv.contrats?.unites?.nom ?? ''} (${inv.contrats?.unites?.immeubles?.nom ?? ''})`, 18, 69);
    doc.text(`Statut : ${inv.statut}`, 18, 76);

    drawSectionFrame(doc, 14, 92, 182, 12, undefined, {
      title: 'Pièces inspectées',
      accent: 'orange',
      fill: false,
    });
    autoTable(doc, {
      startY: 110,
      head: [['Pièce', 'État', 'Observations']],
      body: (inv.pieces || []).map((p) => [
        p.nom || '—',
        p.etat,
        p.observations || '—',
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.6, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.12 },
      headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    let y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110) + 12;
    if (inv.observations) {
      if (y > 235) {
        doc.addPage();
        drawPageBorder(doc);
        y = 28;
      }
      drawSectionFrame(doc, 14, y, 182, 34, undefined, {
        title: 'Observations',
        accent: 'neutral',
      });
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(inv.observations, 170) as string[], 18, y + 15);
    }
    addFooter(doc);
    saveGeneratedPdf(doc, {
      kind: 'inventaire',
      title: `État des lieux ${inv.type === 'entree' ? "d'entrée" : 'de sortie'}`,
      fileName: `inventaire-${inv.id.slice(0, 8)}.pdf`,
      source: 'inventaires',
    });
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

  const filtered = items.filter((i) => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterStatut !== 'all' && i.statut !== filterStatut) return false;
    if (filterImmeuble !== 'all' && i.contrats?.unites?.immeubles?.id !== filterImmeuble) return false;
    return true;
  });

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
      label: 'Date',
      render: (i: Inventaire) => new Date(i.date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'type',
      label: 'Type',
      render: (i: Inventaire) => (
        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${i.type === 'entree' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
          {i.type === 'entree' ? 'Entrée' : 'Sortie'}
        </span>
      ),
    },
    {
      key: 'contrat',
      label: 'Contrat',
      render: (i: Inventaire) => (
        <div>
          <p className="text-sm font-medium">{i.contrats?.locataires?.prenom ?? ''} {i.contrats?.locataires?.nom ?? ''}</p>
          <p className="text-xs text-slate-500">{i.contrats?.unites?.immeubles?.nom ?? ''} – {i.contrats?.unites?.nom ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (i: Inventaire) => (
        <select
          value={i.statut}
          onChange={(e) => updateStatut(i.id, e.target.value as Inventaire['statut'])}
          data-testid={`select-statut-${i.id}`}
          className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${statutColors[i.statut]}`}
        >
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
          <option value="litige">Litige</option>
        </select>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (i: Inventaire) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportPDF(i)}
            data-testid={`button-pdf-${i.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(i)}
            data-testid={`button-delete-${i.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ];
  const columns = allColumns.filter((c) => c.key === 'actions' || colIsVisible(c.key));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">États des lieux</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} inventaire{items.length > 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="button-new-inventaire"
          className="sk-create-cta w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" /> Nouvel inventaire
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as InventaireTypeFilter)} data-testid="filter-type" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous types</option>
          <option value="entree">Entrée</option>
          <option value="sortie">Sortie</option>
        </select>
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as InventaireStatutFilter)} data-testid="filter-statut" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous statuts</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
          <option value="litige">Litige</option>
        </select>
        <select value={filterImmeuble} onChange={(e) => setFilterImmeuble(e.target.value)} data-testid="filter-immeuble" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous immeubles</option>
          {immeubles.map((im) => (
            <option key={im.id} value={im.id}>{im.nom}</option>
          ))}
        </select>
        <ColumnPicker
          columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: c.key === 'actions' }))}
          visibility={colVis}
          onToggle={colToggle}
          onSetAll={colSetAll}
        />
      </div>

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

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Nouvel état des lieux">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contrat</label>
              <select required value={form.contrat_id} onChange={(e) => setForm({ ...form, contrat_id: e.target.value })} data-testid="select-contrat" className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">— Sélectionner —</option>
                {contrats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.locataires?.prenom} {c.locataires?.nom} – {c.unites?.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'entree' | 'sortie' })} data-testid="select-type" className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="entree">Entrée</option>
                <option value="sortie">Sortie</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            {form.type === 'sortie' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Caution retenue (XOF)</label>
                <input type="number" min={0} value={form.caution_retenue} onChange={(e) => setForm({ ...form, caution_retenue: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.locataire_present} onChange={(e) => setForm({ ...form, locataire_present: e.target.checked })} /> Locataire présent</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.proprietaire_present} onChange={(e) => setForm({ ...form, proprietaire_present: e.target.checked })} /> Propriétaire présent</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.agent_present} onChange={(e) => setForm({ ...form, agent_present: e.target.checked })} /> Agent présent</label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Pièces</label>
              <button type="button" onClick={addPiece} className="text-sm text-orange-600 hover:text-orange-700 font-medium">+ Ajouter une pièce</button>
            </div>
            <div className="space-y-2">
              {form.pieces.map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" placeholder="Nom de la pièce" required value={p.nom} onChange={(e) => updatePiece(idx, { nom: e.target.value })} className="col-span-4 px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  <select value={p.etat} onChange={(e) => updatePiece(idx, { etat: e.target.value as Piece['etat'] })} className={`col-span-3 px-2 py-1.5 border rounded text-sm ${etatColors[p.etat]}`}>
                    <option value="bon">Bon</option>
                    <option value="moyen">Moyen</option>
                    <option value="mauvais">Mauvais</option>
                  </select>
                  <input type="text" placeholder="Observations" value={p.observations} onChange={(e) => updatePiece(idx, { observations: e.target.value })} className="col-span-4 px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  <button type="button" onClick={() => removePiece(idx)} className="col-span-1 text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observations générales</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={submitting} data-testid="button-submit-inventaire" className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50" style={{ backgroundColor: '#F58220' }}>
              {submitting ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer cet inventaire ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
