import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { Wrench, Plus, ArrowRight, Phone, Building2 } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';

type Statut = 'a_faire' | 'en_cours' | 'termine';
type Urgence = 'urgente' | 'normale' | 'basse';
type Categorie = 'plomberie' | 'electricite' | 'peinture' | 'serrurerie' | 'climatisation' | 'autre';
type DemandePar = 'locataire' | 'bailleur' | 'agent';

interface Intervention {
  id: string;
  titre: string;
  description: string | null;
  immeuble_id: string | null;
  unite_id: string | null;
  categorie: Categorie | null;
  urgence: Urgence;
  demande_par: DemandePar | null;
  date_demande: string;
  date_souhaitee: string | null;
  prestataire_nom: string | null;
  prestataire_telephone: string | null;
  cout_estime: number | null;
  statut: Statut;
  immeubles?: { nom: string };
  unites?: { nom: string };
}

const urgenceColors: Record<Urgence, string> = {
  urgente: 'bg-red-100 text-red-800 border-red-300',
  normale: 'bg-orange-100 text-orange-800 border-orange-300',
  basse: 'bg-slate-100 text-slate-700 border-slate-300',
};

const colonnes: { id: Statut; label: string; bg: string }[] = [
  { id: 'a_faire', label: 'À faire', bg: 'bg-slate-50' },
  { id: 'en_cours', label: 'En cours', bg: 'bg-blue-50' },
  { id: 'termine', label: 'Terminé', bg: 'bg-green-50' },
];

export function Interventions() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Intervention[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string; immeuble_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterUrgence, setFilterUrgence] = useState<'all' | Urgence>('all');
  const [filterCategorie, setFilterCategorie] = useState<'all' | Categorie>('all');
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all');
  const [activeColumn, setActiveColumn] = useState<Statut>('a_faire');

  const [form, setForm] = useState({
    titre: '',
    description: '',
    immeuble_id: '',
    unite_id: '',
    categorie: 'autre' as Categorie,
    urgence: 'normale' as Urgence,
    demande_par: 'locataire' as DemandePar,
    date_demande: new Date().toISOString().split('T')[0],
    date_souhaitee: '',
    prestataire_nom: '',
    prestataire_telephone: '',
    cout_estime: '',
  });

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const [intRes, immRes, unitesRes] = await Promise.all([
        supabase
          .from('interventions')
          .select('*, immeubles(nom), unites(nom)')
          .eq('agency_id', profile.agency_id)
          .order('date_demande', { ascending: false }),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('unites').select('id, nom, immeuble_id').eq('agency_id', profile.agency_id),
      ]);
      if (intRes.data) setItems(intRes.data as unknown as Intervention[]);
      if (immRes.data) setImmeubles(immRes.data);
      if (unitesRes.data) setUnites(unitesRes.data);
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
      const { error } = await supabase.from('interventions').insert({
        agency_id: profile.agency_id,
        titre: form.titre,
        description: form.description || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        categorie: form.categorie,
        urgence: form.urgence,
        demande_par: form.demande_par,
        date_demande: form.date_demande,
        date_souhaitee: form.date_souhaitee || null,
        prestataire_nom: form.prestataire_nom || null,
        prestataire_telephone: form.prestataire_telephone || null,
        cout_estime: form.cout_estime ? parseFloat(form.cout_estime) : null,
        statut: 'a_faire',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Intervention créée');
      setIsOpen(false);
      setForm({
        titre: '',
        description: '',
        immeuble_id: '',
        unite_id: '',
        categorie: 'autre',
        urgence: 'normale',
        demande_par: 'locataire',
        date_demande: new Date().toISOString().split('T')[0],
        date_souhaitee: '',
        prestataire_nom: '',
        prestataire_telephone: '',
        cout_estime: '',
      });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const move = async (id: string, statut: Statut) => {
    const { error } = await supabase.from('interventions').update({ statut }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  const filtered = items.filter((i) => {
    if (filterUrgence !== 'all' && i.urgence !== filterUrgence) return false;
    if (filterCategorie !== 'all' && i.categorie !== filterCategorie) return false;
    if (filterImmeuble !== 'all' && i.immeuble_id !== filterImmeuble) return false;
    return true;
  });

  const filteredUnites = form.immeuble_id ? unites.filter((u) => u.immeuble_id === form.immeuble_id) : unites;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} intervention{items.length > 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="button-new-intervention"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90"
          style={{ backgroundColor: '#F58220' }}
        >
          <Plus className="w-5 h-5" /> Nouvelle intervention
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterUrgence} onChange={(e) => setFilterUrgence(e.target.value as any)} data-testid="filter-urgence" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Toute urgence</option>
          <option value="urgente">Urgente</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </select>
        <select value={filterCategorie} onChange={(e) => setFilterCategorie(e.target.value as any)} data-testid="filter-categorie" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Toute catégorie</option>
          <option value="plomberie">Plomberie</option>
          <option value="electricite">Électricité</option>
          <option value="peinture">Peinture</option>
          <option value="serrurerie">Serrurerie</option>
          <option value="climatisation">Climatisation</option>
          <option value="autre">Autre</option>
        </select>
        <select value={filterImmeuble} onChange={(e) => setFilterImmeuble(e.target.value)} data-testid="filter-immeuble-int" className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="all">Tous immeubles</option>
          {immeubles.map((im) => (
            <option key={im.id} value={im.id}>{im.nom}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <EmptyState icon={Wrench} title="Aucune intervention" description="Créez votre première fiche de maintenance." />
        </div>
      ) : (
        <>
          {/* Mobile column tabs */}
          <div className="flex lg:hidden gap-1 bg-slate-100 p-1 rounded-xl mb-4">
            {colonnes.map((col) => {
              const count = filtered.filter((i) => i.statut === col.id).length;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setActiveColumn(col.id)}
                  className={`flex-1 text-xs font-semibold py-2 px-1 rounded-lg transition-all ${
                    activeColumn === col.id ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {col.label}
                  <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${
                    activeColumn === col.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {colonnes.map((col) => {
            const list = filtered.filter((i) => i.statut === col.id);
            return (
              <div key={col.id} className={`${col.bg} rounded-xl border border-slate-200 p-4 ${activeColumn === col.id ? 'block' : 'hidden'} lg:block`} data-testid={`column-${col.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{col.label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Aucune carte</p>
                  ) : (
                    list.map((i) => (
                      <div key={i.id} data-testid={`card-intervention-${i.id}`} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-slate-900 text-sm">{i.titre}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${urgenceColors[i.urgence]}`}>
                            {i.urgence}
                          </span>
                        </div>
                        {i.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{i.description}</p>}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-2">
                          {i.categorie && <span className="px-1.5 py-0.5 rounded bg-slate-100">{i.categorie}</span>}
                          {(i.immeubles?.nom || i.unites?.nom) && (
                            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{i.immeubles?.nom}{i.unites?.nom ? ` – ${i.unites.nom}` : ''}</span>
                          )}
                        </div>
                        {i.prestataire_nom && (
                          <div className="text-xs text-slate-600 mb-2">
                            <span className="font-medium">{i.prestataire_nom}</span>
                            {i.prestataire_telephone && (
                              <a href={`tel:${i.prestataire_telephone}`} className="inline-flex items-center gap-1 ml-2 text-orange-600">
                                <Phone className="w-3 h-3" />{i.prestataire_telephone}
                              </a>
                            )}
                          </div>
                        )}
                        {i.cout_estime && <p className="text-xs text-slate-500">Coût estimé : {formatCurrency(i.cout_estime)}</p>}
                        <div className="flex gap-1 mt-3 pt-2 border-t border-slate-100">
                          {col.id !== 'a_faire' && (
                            <button type="button" onClick={() => move(i.id, col.id === 'en_cours' ? 'a_faire' : 'en_cours')} data-testid={`button-back-${i.id}`} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">←</button>
                          )}
                          {col.id !== 'termine' && (
                            <button type="button" onClick={() => move(i.id, col.id === 'a_faire' ? 'en_cours' : 'termine')} data-testid={`button-forward-${i.id}`} className="text-xs px-2 py-1 rounded text-white inline-flex items-center gap-1" style={{ backgroundColor: '#F58220' }}>
                              {col.id === 'a_faire' ? 'En cours' : 'Terminé'} <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Nouvelle intervention">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
            <input type="text" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} data-testid="input-titre" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Immeuble</label>
              <select value={form.immeuble_id} onChange={(e) => setForm({ ...form, immeuble_id: e.target.value, unite_id: '' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">— Aucun —</option>
                {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unité</label>
              <select value={form.unite_id} onChange={(e) => setForm({ ...form, unite_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">— Aucune —</option>
                {filteredUnites.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
              <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value as Categorie })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="plomberie">Plomberie</option>
                <option value="electricite">Électricité</option>
                <option value="peinture">Peinture</option>
                <option value="serrurerie">Serrurerie</option>
                <option value="climatisation">Climatisation</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Urgence</label>
              <select value={form.urgence} onChange={(e) => setForm({ ...form, urgence: e.target.value as Urgence })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Demandé par</label>
              <select value={form.demande_par} onChange={(e) => setForm({ ...form, demande_par: e.target.value as DemandePar })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="locataire">Locataire</option>
                <option value="bailleur">Bailleur</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date demande</label>
              <input type="date" required value={form.date_demande} onChange={(e) => setForm({ ...form, date_demande: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date souhaitée</label>
              <input type="date" value={form.date_souhaitee} onChange={(e) => setForm({ ...form, date_souhaitee: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prestataire</label>
              <input type="text" value={form.prestataire_nom} onChange={(e) => setForm({ ...form, prestataire_nom: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone prestataire</label>
              <input type="tel" value={form.prestataire_telephone} onChange={(e) => setForm({ ...form, prestataire_telephone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Coût estimé</label>
              <input type="number" min={0} value={form.cout_estime} onChange={(e) => setForm({ ...form, cout_estime: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={submitting} data-testid="button-submit-intervention" className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50" style={{ backgroundColor: '#F58220' }}>
              {submitting ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
