import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type EventType = 'paiement' | 'contrat' | 'intervention' | 'rendez_vous' | 'autre';

interface Evenement {
  id: string;
  titre: string;
  type: EventType;
  date: string;
  heure: string | null;
  description: string | null;
  bailleur_id: string | null;
  immeuble_id: string | null;
  unite_id: string | null;
  locataire_id: string | null;
}

const typeColors: Record<EventType, { bg: string; text: string; dot: string }> = {
  paiement: { bg: 'bg-green-100', text: 'text-green-800', dot: '#16a34a' },
  contrat: { bg: 'bg-blue-100', text: 'text-blue-800', dot: '#2563eb' },
  intervention: { bg: 'bg-orange-100', text: 'text-orange-800', dot: '#F58220' },
  rendez_vous: { bg: 'bg-purple-100', text: 'text-purple-800', dot: '#9333ea' },
  autre: { bg: 'bg-slate-100', text: 'text-slate-700', dot: '#64748b' },
};

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function Calendrier() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Evenement[]>([]);
  const [bailleurs, setBailleurs] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string }[]>([]);
  const [locataires, setLocataires] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    titre: '',
    type: 'rendez_vous' as EventType,
    date: new Date().toISOString().split('T')[0],
    heure: '',
    description: '',
    bailleur_id: '',
    immeuble_id: '',
    unite_id: '',
    locataire_id: '',
  });

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  // Tracking de la requête courante pour ignorer les réponses obsolètes
  // si l'utilisateur navigue rapidement de mois en mois.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!profile?.agency_id) return;
    const myRequestId = ++requestIdRef.current;
    try {
      const startStr = monthStart.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];
      const [evRes, bRes, iRes, uRes, lRes] = await Promise.all([
        supabase
          .from('evenements')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .gte('date', startStr)
          .lte('date', endStr),
        supabase.from('bailleurs').select('id, nom, prenom').eq('agency_id', profile.agency_id),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('unites').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('locataires').select('id, nom, prenom').eq('agency_id', profile.agency_id),
      ]);
      // Si une requête plus récente a été lancée entre-temps, on jette ces résultats.
      if (myRequestId !== requestIdRef.current) return;
      if (evRes.data) setItems(evRes.data as Evenement[]);
      if (bRes.data) setBailleurs(bRes.data);
      if (iRes.data) setImmeubles(iRes.data);
      if (uRes.data) setUnites(uRes.data);
      if (lRes.data) setLocataires(lRes.data);
    } catch (err: unknown) {
      if (myRequestId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    }
  }, [profile?.agency_id, monthStart, monthEnd, toast]);

  useEffect(() => {
    if (profile?.agency_id) load();
    return () => {
      // Au démontage, on incrémente pour invalider toute requête en cours.
      requestIdRef.current++;
    };
  }, [profile?.agency_id, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('evenements').insert({
        agency_id: profile.agency_id,
        titre: form.titre,
        type: form.type,
        date: form.date,
        heure: form.heure || null,
        description: form.description || null,
        bailleur_id: form.bailleur_id || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        locataire_id: form.locataire_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Événement créé');
      setIsOpen(false);
      setForm({
        titre: '',
        type: 'rendez_vous',
        date: new Date().toISOString().split('T')[0],
        heure: '',
        description: '',
        bailleur_id: '',
        immeuble_id: '',
        unite_id: '',
        locataire_id: '',
      });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    items.forEach((e) => {
      const key = e.date;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [items]);

  // Build calendar grid (Monday-first)
  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Mon
    const daysInMonth = monthEnd.getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor, monthStart, monthEnd]);

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendrier</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} événement{items.length > 1 ? 's' : ''} ce mois</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="button-new-event"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90"
          style={{ backgroundColor: '#F58220' }}
        >
          <Plus className="w-5 h-5" /> Ajouter événement
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} data-testid="button-prev-month" className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900" data-testid="text-current-month">
            {MOIS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} data-testid="button-next-month" className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {JOURS.map((j) => (
            <div key={j} className="text-center text-xs font-semibold text-slate-500 py-2">{j}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={idx} className="min-h-20" />;
            const dateStr = cell.toISOString().split('T')[0];
            const events = eventsByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                data-testid={`day-${dateStr}`}
                className={`min-h-20 p-1.5 rounded-lg border text-left transition ${isSelected ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-orange-600' : 'text-slate-700'}`}>
                  {cell.getDate()}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((e) => (
                    <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${typeColors[e.type].bg} ${typeColors[e.type].text}`}>
                      {e.titre}
                    </div>
                  ))}
                  {events.length > 3 && <div className="text-[10px] text-slate-500">+{events.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-3">
            Événements du {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun événement ce jour-là.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} data-testid={`event-${e.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeColors[e.type].dot }} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{e.titre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="capitalize">{e.type.replace('_', ' ')}</span>
                      {e.heure && ` · ${e.heure}`}
                    </p>
                    {e.description && <p className="text-sm text-slate-600 mt-1">{e.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Nouvel événement">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
            <input type="text" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} data-testid="input-event-titre" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EventType })} data-testid="select-event-type" className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="paiement">Paiement</option>
                <option value="contrat">Contrat</option>
                <option value="intervention">Intervention</option>
                <option value="rendez_vous">Rendez-vous</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
              <input type="time" value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bailleur (optionnel)</label>
              <select value={form.bailleur_id} onChange={(e) => setForm({ ...form, bailleur_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {bailleurs.map((b) => <option key={b.id} value={b.id}>{b.prenom} {b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Immeuble (optionnel)</label>
              <select value={form.immeuble_id} onChange={(e) => setForm({ ...form, immeuble_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unité (optionnel)</label>
              <select value={form.unite_id} onChange={(e) => setForm({ ...form, unite_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {unites.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Locataire (optionnel)</label>
              <select value={form.locataire_id} onChange={(e) => setForm({ ...form, locataire_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">—</option>
                {locataires.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={submitting} data-testid="button-submit-event" className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50" style={{ backgroundColor: '#F58220' }}>
              {submitting ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
