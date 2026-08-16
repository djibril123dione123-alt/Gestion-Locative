import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { Plus, Search, Sheet, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useExport } from '../hooks/useExport';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ensureE164, formatInternationalPhone, isValidInternationalPhone } from '../lib/formatters';
import { PhoneInput } from '../components/ui/PhoneInput';
import { formatPersonName } from '../lib/people';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';

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
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Locataire | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Locataire | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const {
    success: notifySuccess,
    error: notifyError,
    toasts,
    removeToast,
  } = useToast();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse_personnelle: '',
    piece_identite: '',
    notes: '',
  });

  const filtered = useMemo(
    () =>
      locataires.filter((locataire) =>
        `${formatPersonName(locataire, '')} ${locataire.telephone} ${locataire.email ?? ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [locataires, searchTerm],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, locataires.length]);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) return;
    if (locataires.length === 0) setLoading(true);
    try {
      const result = await readWithCache<Locataire[]>(
        { agencyId: profile.agency_id, userId: profile.id },
        'locataires-page',
        async () => {
          const { data, error } = await supabase
            .from('locataires')
            .select('*')
            .eq('agency_id', profile.agency_id)
            .eq('actif', true)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return (data || []) as Locataire[];
        },
        { timeoutMs: 7_000 }
      );
      setLocataires(result.data);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      console.error('[Locataires] load failed', error);
      notifyError('Locataires indisponibles hors connexion sans cache local.');
    } finally {
      setLoading(false);
    }
  }, [locataires.length, notifyError, profile?.agency_id, profile?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [loadData, profile?.agency_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      notifyError('Connexion indisponible : création ou modification impossible hors ligne.');
      return;
    }
    try {
      const nom = formData.nom.trim();
      const prenom = formData.prenom.trim();
      const email = formData.email.trim();

      if (!prenom) {
        notifyError('Le prenom du locataire est obligatoire.');
        return;
      }
      if (!nom) {
        notifyError('Le nom du locataire est obligatoire.');
        return;
      }

      const normalizedPhone = ensureE164(formData.telephone);
      if (!isValidInternationalPhone(normalizedPhone)) {
        notifyError('Le telephone doit etre un numero valide, par exemple 77 123 45 67.');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        notifyError("L'email du locataire n'est pas valide.");
        return;
      }

      const submitData = {
        ...formData,
        nom,
        prenom,
        telephone: normalizedPhone,
        email: email || null,
        adresse_personnelle: formData.adresse_personnelle.trim() || null,
        piece_identite: formData.piece_identite.trim() || null,
      };
      if (editing) {
        await supabase.from('locataires').update(submitData).eq('id', editing.id);
      } else {
        await supabase.from('locataires').insert([{ ...submitData, created_by: user?.id, agency_id: profile?.agency_id }]);
      }
      closeModal();
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'locataires', 'contrats', 'paiements', 'impayes', 'finances', 'documents'],
        );
        notifyDataChanged(['locataires', 'contrats', 'paiements', 'impayes', 'dashboard', 'finances', 'documents']);
      }
      await loadData();
      notifySuccess(editing ? 'Locataire mis a jour' : 'Locataire cree');
    } catch (err: unknown) {
      console.error('[Locataires] save failed', err);
      notifyError("Impossible d'enregistrer le locataire. Verifiez votre connexion puis reessayez.");
    }
  };

  const handleEdit = (item: Locataire) => {
    setEditing(item);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      telephone: ensureE164(item.telephone),
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
    if (!navigator.onLine) {
      notifyError('Connexion indisponible : suppression impossible hors ligne.');
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from('locataires').update({ actif: false }).eq('id', deleteTarget.id);
      if (error) throw error;
      notifySuccess('Locataire supprime');
      setDeleteTarget(null);
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['dashboard', 'locataires', 'contrats', 'paiements', 'impayes', 'finances', 'documents'],
        );
        notifyDataChanged(['locataires', 'contrats', 'paiements', 'impayes', 'dashboard', 'finances', 'documents']);
      }
      await loadData();
    } catch (err: unknown) {
      console.error('[Locataires] delete failed', err);
      notifyError('Impossible de supprimer ce locataire pour le moment.');
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

  const ALL_COLUMN_KEYS_LOCATAIRES = ['prenom', 'nom', 'telephone', 'email'] as const;
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility('locataires', [...ALL_COLUMN_KEYS_LOCATAIRES]);

  const allColumns = [
    { key: 'prenom', label: 'Prénom' },
    { key: 'nom', label: 'Nom' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
  ];
  const columns = allColumns.filter((c) => colIsVisible(c.key));

  if (loading) return <PageSkeleton title="Locataires" variant="table" />;

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3 pb-8">
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={loadData}
        message="Les locataires affichés viennent du dernier chargement réussi. Les créations et modifications sont bloquées hors ligne."
      />
      <PremiumPageHeader
        density="compact"
        eyebrow="PORTAIL LOCATIF"
        title="Locataires"
        description="Consultez et gérez les dossiers de vos occupants actifs."
        mobileDescription="Gestion des occupants."
        secondaryAction={
          <PremiumButton
            variant="secondary"
            size="sm"
            onClick={() => exportLocataires(locataires.map((l) => ({
              nom: l.nom,
              prenom: l.prenom,
              telephone: formatInternationalPhone(l.telephone, ''),
              email: l.email,
              adresse_personnelle: l.adresse_personnelle,
            })))}
            disabled={exportingXlsx || loading || locataires.length === 0}
            icon={<Sheet className="h-4 w-4" />}
          >
            Exporter
          </PremiumButton>
        }
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Nouveau locataire
          </PremiumButton>
        }
      />

      <div className="sk-card p-4 sm:p-6 lg:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-3 sk-input sm:hidden"
              />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone, email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="hidden sm:block w-full pl-10 pr-4 py-2 sm:py-3 sk-input"
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
          <Table
            columns={columns}
            data={paginated}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyState={{
              icon: Users,
              title: searchTerm ? 'Aucun résultat' : 'Aucun locataire enregistré',
              description: searchTerm
                ? 'Aucun locataire ne correspond à votre recherche.'
                : 'Ajoutez votre premier locataire pour commencer à suivre ses occupations et paiements.',
              action: searchTerm
                ? { label: 'Réinitialiser la recherche', onClick: () => setSearchTerm('') }
                : { label: 'Nouveau locataire', onClick: () => setIsModalOpen(true) },
            }}
          />
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
              <input aria-label="Champ de saisie" type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full sk-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
              <input aria-label="Champ de saisie" type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full sk-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <PhoneInput
                label="Téléphone"
                required
                value={formData.telephone}
                onChange={(value) => setFormData({ ...formData, telephone: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input aria-label="Champ de saisie" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full sk-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
            <input aria-label="Champ de saisie" type="text" value={formData.adresse_personnelle} onChange={(e) => setFormData({ ...formData, adresse_personnelle: e.target.value })} className="w-full sk-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pièce d'identité</label>
            <input aria-label="Champ de saisie" type="text" value={formData.piece_identite} onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })} className="w-full sk-input" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={closeModal} className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" className="sk-action sk-action-primary px-4 sm:px-6">
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}



