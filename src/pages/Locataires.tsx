import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search, Sheet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useExport } from '../hooks/useExport';
import { useBackup } from '../hooks/useBackup';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';

interface Locataire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse_personnelle: string | null;
  piece_identite: string | null;
}

const ITEMS_PER_PAGE = 10;

export function Locataires() {
  const { user, profile } = useAuth();
  const { exportLocataires, exporting: exportingXlsx } = useExport();
  const { save: saveBackup } = useBackup();
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [filtered, setFiltered] = useState<Locataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Locataire | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Locataire | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse_personnelle: '',
    piece_identite: '',
    notes: '',
  });

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    const f = locataires.filter(l =>
      `${l.nom} ${l.prenom} ${l.telephone} ${l.email ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFiltered(f);
    setCurrentPage(1);
  }, [searchTerm, locataires]);

  const loadData = async () => {
    if (!profile?.agency_id) return;
    try {
      const { data, error } = await supabase
        .from('locataires')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('actif', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocataires(data || []);
      setFiltered(data || []);
      saveBackup('locataires', data || []).catch(() => {});
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await supabase.from('locataires').update(formData).eq('id', editing.id);
      } else {
        await supabase.from('locataires').insert([{ ...formData, created_by: user?.id, agency_id: profile?.agency_id }]);
      }
      closeModal();
      loadData();
      toast.success(editing ? 'Locataire mis à jour' : 'Locataire créé');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    }
  };

  const handleEdit = (item: Locataire) => {
    setEditing(item);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      telephone: item.telephone,
      email: item.email || '',
      adresse_personnelle: item.adresse_personnelle || '',
      piece_identite: item.piece_identite || '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (item: Locataire) => setDeleteTarget(item);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('locataires').update({ actif: false }).eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Locataire supprimé');
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormData({ nom: '', prenom: '', telephone: '', email: '', adresse_personnelle: '', piece_identite: '', notes: '' });
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const ALL_COLUMN_KEYS_LOCATAIRES = ['nom', 'prenom', 'telephone', 'email'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('locataires', [...ALL_COLUMN_KEYS_LOCATAIRES]);

  const allColumns = [
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', render: (l: Locataire) => l.email || '-' },
  ];
  const columns = allColumns.filter((c) => colIsVisible(c.key));

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-lg text-slate-600">Chargement...</div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Locataires</h1>
          <p className="text-slate-600">Gestion des locataires · {locataires.length} enregistré{locataires.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportLocataires(locataires.map((l) => ({
              nom: l.nom,
              prenom: l.prenom,
              telephone: l.telephone,
              email: l.email,
              adresse_personnelle: l.adresse_personnelle,
            })))}
            disabled={exportingXlsx || loading || locataires.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition disabled:opacity-50"
            title="Exporter en Excel"
          >
            <Sheet className="w-4 h-4" />
            Exporter Excel
          </button>
          <Button onClick={() => setIsModalOpen(true)} icon={Plus}>
            Nouveau locataire
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone, email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <ColumnPicker
              columns={allColumns.map((c) => ({ key: c.key, label: c.label, required: false }))}
              visibility={colVis}
              onToggle={colToggle}
              onSetAll={colSetAll}
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-slate-500">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table columns={columns} data={paginated} onEdit={handleEdit} onDelete={handleDelete} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {currentPage} / {totalPages} · {filtered.length} locataire{filtered.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >«</button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >‹ Préc.</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = start + i;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 text-sm rounded-lg border transition font-medium ${
                      page === currentPage
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >{page}</button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >Suiv. ›</button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >»</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Modifier' : 'Nouveau locataire'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
              <input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
              <input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
              <input type="tel" required value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
            <input type="text" value={formData.adresse_personnelle} onChange={(e) => setFormData({ ...formData, adresse_personnelle: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pièce d'identité</label>
            <input type="text" value={formData.piece_identite} onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              {editing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce locataire ?"
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.prenom ?? ''} ${deleteTarget?.nom ?? ''}" ?`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
