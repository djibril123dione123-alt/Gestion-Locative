import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { FolderOpen, Upload, Download, Trash2 } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  folder: string | null;
  bailleur_id: string | null;
  immeuble_id: string | null;
  unite_id: string | null;
  contrat_id: string | null;
  created_at: string;
}

const FOLDERS = ['contrat', 'immeuble', 'locataire', 'autre'] as const;
type Folder = (typeof FOLDERS)[number];

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function Documents() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [contrats, setContrats] = useState<{ id: string; label: string }[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string }[]>([]);
  const [locataires, setLocataires] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [bailleurs, setBailleurs] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterFolder, setFilterFolder] = useState<'all' | Folder>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    folder: 'autre' as Folder,
    file: null as File | null,
    contrat_id: '',
    immeuble_id: '',
    unite_id: '',
    locataire_id: '',
    bailleur_id: '',
  });

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [docRes, cRes, iRes, uRes, lRes, bRes] = await Promise.all([
        supabase.from('documents').select('*').eq('agency_id', profile.agency_id).order('created_at', { ascending: false }),
        supabase.from('contrats').select('id, locataires(nom, prenom), unites(nom)').eq('agency_id', profile.agency_id),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('unites').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('locataires').select('id, nom, prenom').eq('agency_id', profile.agency_id),
        supabase.from('bailleurs').select('id, nom, prenom').eq('agency_id', profile.agency_id),
      ]);
      if (docRes.data) setItems(docRes.data as Document[]);
      if (cRes.data) {
        setContrats(
          (cRes.data as any[]).map((c) => ({
            id: c.id,
            label: `${c.locataires?.prenom ?? ''} ${c.locataires?.nom ?? ''} – ${c.unites?.nom ?? ''}`.trim(),
          })),
        );
      }
      if (iRes.data) setImmeubles(iRes.data);
      if (uRes.data) setUnites(uRes.data);
      if (lRes.data) setLocataires(lRes.data);
      if (bRes.data) setBailleurs(bRes.data);
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
    if (!profile?.agency_id || !form.file) {
      toast.warning('Veuillez sélectionner un fichier');
      return;
    }
    setUploading(true);
    try {
      const ext = form.file.name.split('.').pop() ?? 'bin';
      const path = `${profile.agency_id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, form.file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('documents').insert({
        agency_id: profile.agency_id,
        name: form.name || form.file.name,
        file_url: path,
        file_type: form.file.type || ext,
        file_size: form.file.size,
        folder: form.folder,
        contrat_id: form.contrat_id || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        locataire_id: form.locataire_id || null,
        bailleur_id: form.bailleur_id || null,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;
      toast.success('Document uploadé');
      setIsOpen(false);
      setForm({
        name: '',
        folder: 'autre',
        file: null,
        contrat_id: '',
        immeuble_id: '',
        unite_id: '',
        locataire_id: '',
        bailleur_id: '',
      });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.file_url && !deleteTarget.file_url.startsWith('http')) {
        await supabase.storage.from('documents').remove([deleteTarget.file_url]);
      }
      const { error } = await supabase.from('documents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Document supprimé');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const downloadDoc = async (d: Document) => {
    try {
      if (d.file_url.startsWith('http')) {
        window.open(d.file_url, '_blank', 'noopener,noreferrer');
        return;
      }
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(d.file_url, 60);
      if (error || !data?.signedUrl) throw error ?? new Error('URL non disponible');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Téléchargement impossible';
      toast.error(msg);
    }
  };

  const fileTypes = Array.from(new Set(items.map((d) => d.file_type).filter((t): t is string => !!t)));

  const filtered = items.filter((d) => {
    if (filterFolder !== 'all' && d.folder !== filterFolder) return false;
    if (filterType !== 'all' && d.file_type !== filterType) return false;
    return true;
  });

  const columns = [
    {
      key: 'name',
      label: 'Nom',
      render: (d: Document) => (
        <div>
          <p className="font-medium text-slate-900">{d.name}</p>
          <p className="text-xs text-slate-500">{d.file_type ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'folder',
      label: 'Dossier',
      render: (d: Document) => (
        <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 capitalize">
          {d.folder ?? '—'}
        </span>
      ),
    },
    { key: 'file_size', label: 'Taille', render: (d: Document) => formatSize(d.file_size) },
    {
      key: 'created_at',
      label: 'Date',
      render: (d: Document) => new Date(d.created_at).toLocaleDateString('fr-FR'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (d: Document) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadDoc(d)}
            data-testid={`button-download-${d.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
          >
            <Download className="w-3 h-3" /> Télécharger
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(d)}
            data-testid={`button-delete-doc-${d.id}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} document{items.length > 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="button-upload-document"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90"
          style={{ backgroundColor: '#F58220' }}
        >
          <Upload className="w-5 h-5" /> Uploader
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value as any)} data-testid="filter-folder" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous dossiers</option>
          {FOLDERS.map((f) => (
            <option key={f} value={f} className="capitalize">{f}</option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} data-testid="filter-filetype" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous types</option>
          {fileTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Aucun document" description="Uploadez votre premier document." />
        ) : (
          <Table data={filtered} columns={columns} />
        )}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Uploader un document">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fichier</label>
            <input type="file" required onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} data-testid="input-file" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom (optionnel)</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Laisser vide pour utiliser le nom du fichier" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dossier</label>
            <select value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value as Folder })} data-testid="select-folder" className="w-full px-3 py-2 border border-slate-300 rounded-lg">
              {FOLDERS.map((f) => (
                <option key={f} value={f} className="capitalize">{f}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contrat</label>
              <select value={form.contrat_id} onChange={(e) => setForm({ ...form, contrat_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {contrats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Immeuble</label>
              <select value={form.immeuble_id} onChange={(e) => setForm({ ...form, immeuble_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unité</label>
              <select value={form.unite_id} onChange={(e) => setForm({ ...form, unite_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {unites.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Locataire</label>
              <select value={form.locataire_id} onChange={(e) => setForm({ ...form, locataire_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {locataires.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bailleur</label>
              <select value={form.bailleur_id} onChange={(e) => setForm({ ...form, bailleur_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {bailleurs.map((b) => <option key={b.id} value={b.id}>{b.prenom} {b.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={uploading} data-testid="button-submit-upload" className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50" style={{ backgroundColor: '#F58220' }}>
              {uploading ? 'Upload…' : 'Uploader'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce document ?"
        message={`"${deleteTarget?.name ?? ''}" sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
