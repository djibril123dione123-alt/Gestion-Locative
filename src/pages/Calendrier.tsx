import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar, type QuickChip } from '../components/ui/PremiumToolbar';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { WizardShell } from '../components/ui/WizardShell';
import { ToastContainer } from '../components/ui/Toast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ChevronLeft, ChevronRight, Plus, Calendar, CalendarClock, CheckCircle2, AlertCircle, Search, SlidersHorizontal } from 'lucide-react';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';

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
  const [loading, setLoading] = useState(true);
  const [bailleurs, setBailleurs] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string }[]>([]);
  const [locataires, setLocataires] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtres du toolbar
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const startStr = monthStart.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];
      const [evRes, bRes, iRes, uRes, lRes, intRes] = await Promise.all([
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
        supabase
          .from('interventions')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .gte('scheduled_at', `${startStr}T00:00:00Z`)
          .lte('scheduled_at', `${endStr}T23:59:59Z`),
      ]);
      if (myRequestId !== requestIdRef.current) return;
      
      let allEvents = (evRes.data || []) as Evenement[];
      
      // Inject interventions that have a scheduled_at date
      if (intRes.data) {
        const interventionsAsEvents: Evenement[] = intRes.data.map(int => {
          const dateObj = new Date(int.scheduled_at);
          return {
            id: `int-${int.id}`, // prefix to avoid collision
            titre: `Intervention: ${int.titre}`,
            type: 'intervention',
            date: dateObj.toISOString().split('T')[0],
            heure: `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`,
            description: int.description,
            bailleur_id: int.bailleur_id,
            immeuble_id: int.immeuble_id,
            unite_id: int.unite_id,
            locataire_id: int.locataire_id
          };
        });
        allEvents = [...allEvents, ...interventionsAsEvents];
      }
      
      setItems(allEvents);
      if (bRes.data) setBailleurs(bRes.data);
      if (iRes.data) setImmeubles(iRes.data);
      if (uRes.data) setUnites(uRes.data);
      if (lRes.data) setLocataires(lRes.data);
    } catch (err: unknown) {
      if (myRequestId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      if (myRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [profile?.agency_id, monthStart, monthEnd, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    setSubmitting(true);
    try {
      const payload = {
        agency_id: profile.agency_id,
        titre: form.titre.trim(),
        type: form.type,
        date: form.date,
        heure: form.heure || null,
        description: form.description.trim() || null,
        bailleur_id: form.bailleur_id || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        locataire_id: form.locataire_id || null,
        created_by: user?.id,
      };
      const { error } = await supabase.from('evenements').insert(payload);
      if (error) throw error;
      toast.success('Événement créé avec succès');
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

  const filteredItems = useMemo(() => {
    return items.filter((ev) => {
      if (selectedTypeFilter && ev.type !== selectedTypeFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitre = ev.titre.toLowerCase().includes(q);
        const matchDesc = (ev.description || '').toLowerCase().includes(q);
        if (!matchTitre && !matchDesc) return false;
      }
      return true;
    });
  }, [items, selectedTypeFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      rdv: items.filter((i) => i.type === 'rendez_vous').length,
      interventions: items.filter((i) => i.type === 'intervention').length,
      paiements: items.filter((i) => i.type === 'paiement').length,
    };
  }, [items]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    filteredItems.forEach((e) => {
      const key = e.date;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [filteredItems]);

  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const daysInMonth = monthEnd.getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor, monthStart, monthEnd]);

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  const quickChips: QuickChip[] = useMemo(() => [
    {
      id: 'all',
      label: 'Tous',
      count: items.length,
      isActive: selectedTypeFilter === '',
      onClick: () => setSelectedTypeFilter(''),
    },
    {
      id: 'rdv',
      label: 'Rendez-vous',
      count: stats.rdv,
      isActive: selectedTypeFilter === 'rendez_vous',
      onClick: () => setSelectedTypeFilter(selectedTypeFilter === 'rendez_vous' ? '' : 'rendez_vous'),
    },
    {
      id: 'intervention',
      label: 'Interventions',
      count: stats.interventions,
      isActive: selectedTypeFilter === 'intervention',
      onClick: () => setSelectedTypeFilter(selectedTypeFilter === 'intervention' ? '' : 'intervention'),
    },
    {
      id: 'paiement',
      label: 'Paiements',
      count: stats.paiements,
      isActive: selectedTypeFilter === 'paiement',
      onClick: () => setSelectedTypeFilter(selectedTypeFilter === 'paiement' ? '' : 'paiement'),
    },
  ], [items.length, stats, selectedTypeFilter]);

  if (loading && items.length === 0) {
    return <PageSkeleton title="Calendrier" variant="dashboard" />;
  }

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3">
      <PremiumPageHeader
        density="compact"
        eyebrow="OPÉRATIONS TERRAIN"
        title="Calendrier"
        description="Planning terrain, échéances locatives et rendez-vous."
        mobileDescription="Planning terrain."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsOpen(true)} data-testid="button-new-event" icon={<Plus className="h-4 w-4" />}>
            Ajouter événement
          </PremiumButton>
        }
      />

      <PremiumKpiGrid density="compact">
        <MetricCard density="compact" label="Événements du mois" value={stats.total} helper="Planning mensuel" icon={Calendar} tone="emerald" />
        <MetricCard density="compact" label="Rendez-vous" value={stats.rdv} helper="Visites & états des lieux" icon={CalendarClock} tone="blue" />
        <MetricCard density="compact" label="Interventions" value={stats.interventions} helper="Maintenance & travaux" icon={AlertCircle} tone="amber" />
        <MetricCard density="compact" label="Échéances de paiement" value={stats.paiements} helper="Loyers & rappels" icon={CheckCircle2} tone="green" />
      </PremiumKpiGrid>

      <PremiumToolbar
        density="compact"
        ariaLabel="Filtres du calendrier"
        quickChips={quickChips}
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un événement, un titre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-2.5 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10"
              />
            </div>
          </div>
        }
        filters={
          <div className="hidden lg:flex min-w-0 items-center gap-2">
            <SmartCombobox
              value={selectedTypeFilter}
              options={[
                { value: '', label: 'Tous les types' },
                { value: 'rendez_vous', label: 'Rendez-vous' },
                { value: 'intervention', label: 'Interventions' },
                { value: 'paiement', label: 'Paiements' },
                { value: 'contrat', label: 'Contrats' },
                { value: 'autre', label: 'Autres' },
              ]}
              onChange={setSelectedTypeFilter}
              placeholder="Type d'événement"
              className="w-44 shrink-0"
              density="compact"
            />
          </div>
        }
        secondaryActions={
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className={`inline-flex h-8 flex-shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-[0.6rem] border px-3 py-1.5 text-xs font-bold shadow-sm transition lg:hidden ${selectedTypeFilter ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-[#fffdf8] text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres
            {selectedTypeFilter && (
              <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">1</span>
            )}
          </button>
        }
      />

      <MobileFilterSheet
        isOpen={showFilters}
        title="Filtres calendrier"
        onClose={() => setShowFilters(false)}
        onReset={() => setSelectedTypeFilter('')}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Type d'événement</label>
            <SmartCombobox
              value={selectedTypeFilter}
              options={[
                { value: '', label: 'Tous les types' },
                { value: 'rendez_vous', label: 'Rendez-vous' },
                { value: 'intervention', label: 'Interventions' },
                { value: 'paiement', label: 'Paiements' },
                { value: 'contrat', label: 'Contrats' },
                { value: 'autre', label: 'Autres' },
              ]}
              onChange={(val) => setSelectedTypeFilter(val || '')}
              placeholder="Type d'événement"
              fullWidth
            />
          </div>
        </div>
      </MobileFilterSheet>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 mb-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} data-testid="button-prev-month" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
            <ChevronLeft className="w-4 h-4 text-slate-700" />
          </button>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider" data-testid="text-current-month">
            {MOIS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} data-testid="button-next-month" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {JOURS.map((j) => (
            <div key={j} className="text-center text-[11px] font-extrabold text-slate-500 py-1.5 uppercase tracking-wider">{j}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={idx} className="min-h-16 sm:min-h-24 rounded-xl bg-slate-50/40" />;
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
                className={`min-h-16 sm:min-h-24 p-1.5 sm:p-2 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/20 shadow-sm'
                    : isToday
                    ? 'border-amber-400 bg-amber-50/40 font-bold'
                    : 'border-slate-200/80 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs sm:text-sm font-extrabold ${isToday ? 'text-amber-700' : 'text-slate-800'}`}>
                    {cell.getDate()}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-800 uppercase tracking-tight">
                      Auj.
                    </span>
                  )}
                </div>
                {events.length > 0 && (
                  <div className="flex sm:hidden flex-wrap gap-1 mt-1">
                    {events.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: typeColors[e.type].dot }}
                      />
                    ))}
                    {events.length > 4 && (
                      <span className="text-[9px] text-slate-400 leading-none font-bold">+{events.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="hidden sm:block space-y-1 mt-1">
                  {events.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-semibold border ${typeColors[e.type].bg} ${typeColors[e.type].text}`}
                    >
                      {e.titre}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] font-extrabold text-emerald-800 pl-1">
                      +{events.length - 3} autres...
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              Événements du {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {selectedEvents.length} {selectedEvents.length > 1 ? 'événements' : 'événement'}
            </span>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 py-4 text-center">Aucun événement planifié à cette date.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedEvents.map((e) => (
                <li
                  key={e.id}
                  data-testid={`event-${e.id}`}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:shadow-sm transition"
                >
                  <span className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: typeColors[e.type].dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{e.titre}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase shrink-0 bg-white text-slate-700 border-slate-200">
                        {e.type.replace('_', ' ')}
                      </span>
                    </div>
                    {e.heure && (
                      <p className="text-xs font-semibold text-emerald-800 mt-1">
                        ⏰ {e.heure}
                      </p>
                    )}
                    {e.description && <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{e.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <WizardShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="simple"
        variant="classic"
        tone="agency"
        eyebrow="SAMAY KËUR"
        title="Nouvel événement"
        description="Planifiez une échéance, un rendez-vous ou une tâche opérationnelle."
        primaryAction={
          <button
            type="button"
            onClick={(e) => void submit(e as unknown as React.FormEvent)}
            disabled={submitting}
            data-testid="button-submit-event"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer l’événement'}
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
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Titre de l'événement *</label>
            <input
              type="text"
              required
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              data-testid="input-event-titre"
              placeholder="Ex: Visite appartement, Renouvellement bail..."
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Type *</label>
              <SmartCombobox
                value={form.type}
                options={[
                  { value: 'paiement', label: 'Paiement' },
                  { value: 'contrat', label: 'Contrat' },
                  { value: 'intervention', label: 'Intervention' },
                  { value: 'rendez_vous', label: 'Rendez-vous' },
                  { value: 'autre', label: 'Autre' },
                ]}
                onChange={(val) => setForm({ ...form, type: (val || 'rendez_vous') as EventType })}
                placeholder="Sélectionner le type"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Heure</label>
              <input
                type="time"
                value={form.heure}
                onChange={(e) => setForm({ ...form, heure: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Description optionnelle</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Détails, notes de préparation, contact..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Bailleur lié (optionnel)</label>
              <SmartCombobox
                value={form.bailleur_id}
                options={[
                  { value: '', label: '— Aucun —' },
                  ...bailleurs.map((b) => ({ value: b.id, label: `${b.prenom} ${b.nom}` })),
                ]}
                onChange={(val) => setForm({ ...form, bailleur_id: val })}
                placeholder="Sélectionner un bailleur"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Immeuble lié (optionnel)</label>
              <SmartCombobox
                value={form.immeuble_id}
                options={[
                  { value: '', label: '— Aucun —' },
                  ...immeubles.map((i) => ({ value: i.id, label: i.nom })),
                ]}
                onChange={(val) => setForm({ ...form, immeuble_id: val })}
                placeholder="Sélectionner un immeuble"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Unité liée (optionnel)</label>
              <SmartCombobox
                value={form.unite_id}
                options={[
                  { value: '', label: '— Aucune —' },
                  ...unites.map((u) => ({ value: u.id, label: u.nom })),
                ]}
                onChange={(val) => setForm({ ...form, unite_id: val })}
                placeholder="Sélectionner une unité"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Locataire lié (optionnel)</label>
              <SmartCombobox
                value={form.locataire_id}
                options={[
                  { value: '', label: '— Aucun —' },
                  ...locataires.map((l) => ({ value: l.id, label: `${l.prenom} ${l.nom}` })),
                ]}
                onChange={(val) => setForm({ ...form, locataire_id: val })}
                placeholder="Sélectionner un locataire"
                className="w-full"
                density="compact"
              />
            </div>
          </div>
        </form>
      </WizardShell>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
