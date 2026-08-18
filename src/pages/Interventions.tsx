import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumToolbar, type QuickChip } from '../components/ui/PremiumToolbar';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { Wrench, Plus, AlertTriangle, CheckCircle2, Clock, Search, SlidersHorizontal, MapPin } from 'lucide-react';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { PageSkeleton, SkeletonCards } from '../components/ui/Skeleton';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { IncidentTimeline } from '../components/maintenance/IncidentTimeline';
import { Incident, IncidentStatut, IncidentPriority, IncidentCategory, DemandePar } from '../types/maintenance';
import { WizardShell } from '../components/ui/WizardShell';
import { formatCurrency, formatInternationalPhone, ensureE164 } from '../lib/formatters';
import { PhoneInput } from '../components/ui/PhoneInput';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusMap: Record<IncidentStatut, { label: string, color: string }> = {
  signale: { label: 'Signalé', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  a_qualifier: { label: 'À qualifier', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  planifie: { label: 'Planifié', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  devis_a_valider: { label: 'Devis à valider', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  autorise: { label: 'Autorisé', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  en_cours: { label: 'En cours', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  resolu: { label: 'Résolu', color: 'bg-green-100 text-green-800 border-green-200' },
  annule: { label: 'Annulé', color: 'bg-red-100 text-red-800 border-red-200' },
};

const priorityColors: Record<IncidentPriority, string> = {
  urgente: 'bg-red-100 text-red-800 border-red-300',
  haute: 'bg-orange-100 text-orange-800 border-orange-300',
  normale: 'bg-slate-100 text-slate-700 border-slate-300',
  basse: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function Interventions() {
  const { profile, user } = useAuth();
  const toast = useToast();

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      const bienId = params.get('bienId');
      const uniteId = params.get('uniteId');
      const description = params.get('description');
      setForm((prev) => ({ 
        ...prev, 
        immeuble_id: bienId || prev.immeuble_id,
        unite_id: uniteId || prev.unite_id,
        description: description || prev.description,
      }));
      setIsOpenCreate(true);
    },
  });

  const [items, setItems] = useState<Incident[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string; immeuble_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isOpenCreate, setIsOpenCreate] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgence, setFilterUrgence] = useState<'all' | IncidentPriority>('all');
  const [filterStatut, setFilterStatut] = useState<'all' | IncidentStatut | 'ouverts'>('ouverts');
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (filterUrgence !== 'all' ? 1 : 0);

  const [form, setForm] = useState({
    titre: '',
    description: '',
    immeuble_id: '',
    unite_id: '',
    categorie: 'autre' as IncidentCategory,
    urgence: 'normale' as IncidentPriority,
    demande_par: 'locataire' as DemandePar,
    date_demande: new Date().toISOString().split('T')[0],
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
          .order('created_at', { ascending: false }),
        supabase.from('immeubles').select('id, nom').eq('agency_id', profile.agency_id),
        supabase.from('unites').select('id, nom, immeuble_id').eq('agency_id', profile.agency_id),
      ]);
      if (intRes.data) setItems(intRes.data as unknown as Incident[]);
      if (immRes.data) setImmeubles(immRes.data);
      if (unitesRes.data) setUnites(unitesRes.data);
      
      // Update selected incident if it's currently open
      if (selectedIncident) {
        const updated = intRes.data?.find(i => i.id === selectedIncident.id);
        if (updated) setSelectedIncident(updated as unknown as Incident);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, toast, selectedIncident]);

  useEffect(() => {
    if (profile?.agency_id) load();
  }, [profile?.agency_id, load]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.agency_id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('interventions').insert({
        agency_id: profile.agency_id,
        titre: form.titre.trim(),
        description: form.description.trim() || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        categorie: form.categorie,
        urgence: form.urgence,
        demande_par: form.demande_par,
        date_demande: form.date_demande,
        statut: 'signale',
        approval_required: false,
        approval_status: 'pending',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Incident signalé avec succès');
      setIsOpenCreate(false);
      setForm({
        titre: '', description: '', immeuble_id: '', unite_id: '',
        categorie: 'autre', urgence: 'normale', demande_par: 'locataire',
        date_demande: new Date().toISOString().split('T')[0],
      });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterStatut === 'ouverts' && (i.statut === 'resolu' || i.statut === 'annule')) return false;
      if (filterStatut !== 'all' && filterStatut !== 'ouverts' && i.statut !== filterStatut) return false;
      if (filterUrgence !== 'all' && i.urgence !== filterUrgence) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchRef = (i.reference || '').toLowerCase().includes(q);
        const matchTitre = i.titre.toLowerCase().includes(q);
        const matchDesc = (i.description || '').toLowerCase().includes(q);
        if (!matchRef && !matchTitre && !matchDesc) return false;
      }
      return true;
    });
  }, [items, filterStatut, filterUrgence, searchTerm]);

  const stats = useMemo(() => {
    const ouverts = items.filter(i => i.statut !== 'resolu' && i.statut !== 'annule').length;
    const urgents = items.filter(i => (i.urgence === 'urgente' || i.urgence === 'haute') && i.statut !== 'resolu' && i.statut !== 'annule').length;
    const attenteValid = items.filter(i => i.statut === 'devis_a_valider').length;
    const resolus = items.filter(i => i.statut === 'resolu').length;
    
    return { ouverts, urgents, attenteValid, resolus };
  }, [items]);

  const quickChips: QuickChip[] = useMemo(() => [
    {
      id: 'ouverts',
      label: 'Ouverts',
      count: stats.ouverts,
      isActive: filterStatut === 'ouverts',
      onClick: () => setFilterStatut('ouverts'),
    },
    {
      id: 'urgents',
      label: 'Urgences',
      count: stats.urgents,
      isActive: filterUrgence === 'urgente' || filterUrgence === 'haute',
      onClick: () => {
        setFilterUrgence(filterUrgence === 'urgente' ? 'all' : 'urgente');
        setFilterStatut('ouverts');
      },
    },
    {
      id: 'devis_a_valider',
      label: 'En attente devis',
      count: stats.attenteValid,
      isActive: filterStatut === 'devis_a_valider',
      onClick: () => setFilterStatut(filterStatut === 'devis_a_valider' ? 'ouverts' : 'devis_a_valider'),
    },
    {
      id: 'resolus',
      label: 'Résolus',
      count: stats.resolus,
      isActive: filterStatut === 'resolu',
      onClick: () => setFilterStatut(filterStatut === 'resolu' ? 'ouverts' : 'resolu'),
    },
  ], [stats, filterStatut, filterUrgence]);

  const filteredUnites = form.immeuble_id ? unites.filter((u) => u.immeuble_id === form.immeuble_id) : unites;

  if (loading && items.length === 0) {
    return <PageSkeleton title="Incidents & Maintenance" variant="table" />;
  }

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3">
      <PremiumPageHeader
        density="compact"
        eyebrow="OPÉRATIONS TERRAIN"
        title="Incidents & Maintenance"
        description="Gérez les signalements, suivez les prestataires, et validez les devis de bout en bout."
        mobileDescription="Maintenance terrain."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsOpenCreate(true)} icon={<Plus className="h-4 w-4" />}>
            Signaler un incident
          </PremiumButton>
        }
      />

      <PremiumKpiGrid density="compact">
        <MetricCard density="compact" label="Incidents ouverts" value={stats.ouverts} helper="En cours de traitement" icon={Wrench} tone="blue" />
        <MetricCard density="compact" label="Urgences absolues" value={stats.urgents} helper="Priorité haute/urgente" icon={AlertTriangle} tone="amber" />
        <MetricCard density="compact" label="À valider" value={stats.attenteValid} helper="Devis en attente bailleur" icon={Clock} tone="purple" />
        <MetricCard density="compact" label="Résolus" value={stats.resolus} helper="Interventions terminées" icon={CheckCircle2} tone="green" />
      </PremiumKpiGrid>

      <PremiumToolbar
        density="compact"
        ariaLabel="Filtres des incidents"
        quickChips={quickChips}
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par référence, titre..."
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
              value={filterStatut}
              options={[
                { value: 'all', label: 'Tous statuts' },
                { value: 'ouverts', label: 'Ouverts uniquement' },
                ...Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))
              ]}
              onChange={(val) => setFilterStatut((val || 'ouverts') as any)}
              placeholder="Statut"
              className="w-44 shrink-0"
              density="compact"
            />
          </div>
        }
        secondaryActions={
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className={`inline-flex h-8 flex-shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-[0.6rem] border px-3 py-1.5 text-xs font-bold shadow-sm transition lg:hidden ${activeFilterCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-[#fffdf8] text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>
            )}
          </button>
        }
      />

      {loading ? (
        <SkeletonCards count={4} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <EmptyState icon={Wrench} title="Aucun incident" description="Tout est en ordre sur vos propriétés." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(incident => (
            <div 
              key={incident.id} 
              onClick={() => setSelectedIncident(incident)}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusMap[incident.statut].color}`}>
                  {statusMap[incident.statut].label}
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${priorityColors[incident.urgence]}`}>
                  {incident.urgence}
                </span>
              </div>
              
              <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 mb-1">{incident.titre}</h3>
              <p className="text-xs text-slate-500 mb-3">{incident.reference || 'INC-N/A'}</p>

              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{incident.immeubles?.nom || 'Propriété non spécifiée'}</span>
                </div>
                <span className="shrink-0 pl-2">
                  {format(parseISO(incident.date_demande), 'dd/MM/yyyy')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <WizardShell
        open={isOpenCreate}
        onClose={() => {
          setIsOpenCreate(false);
          clearDirectRouteParams();
        }}
        size="simple"
        variant="classic"
        title="Signaler un incident"
        description="Créez un ticket d'incident pour démarrer le workflow de maintenance."
        primaryAction={
          <button
            type="button"
            onClick={submitCreate}
            disabled={submitting}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Créer l’incident'}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => { setIsOpenCreate(false); clearDirectRouteParams(); }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Annuler
          </button>
        }
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Titre de l'incident *</label>
            <input
              type="text"
              required
              placeholder="Ex : Fuite robinet salle de bain"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Immeuble</label>
              <SmartCombobox
                value={form.immeuble_id}
                options={[
                  { value: '', label: '— Aucun —' },
                  ...immeubles.map((i) => ({ value: i.id, label: i.nom })),
                ]}
                onChange={(val) => setForm({ ...form, immeuble_id: val, unite_id: '' })}
                placeholder="Sélectionner un immeuble"
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Unité (optionnel)</label>
              <SmartCombobox
                value={form.unite_id}
                options={[
                  { value: '', label: '— Aucune —' },
                  ...filteredUnites.map((u) => ({ value: u.id, label: u.nom })),
                ]}
                onChange={(val) => setForm({ ...form, unite_id: val })}
                placeholder="Sélectionner une unité"
                className="w-full"
                density="compact"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Catégorie</label>
              <SmartCombobox
                value={form.categorie}
                options={[
                  { value: 'plomberie', label: 'Plomberie' },
                  { value: 'electricite', label: 'Électricité' },
                  { value: 'peinture', label: 'Peinture' },
                  { value: 'serrurerie', label: 'Serrurerie' },
                  { value: 'climatisation', label: 'Climatisation' },
                  { value: 'autre', label: 'Autre' },
                ]}
                onChange={(val) => setForm({ ...form, categorie: (val || 'autre') as any })}
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Urgence</label>
              <SmartCombobox
                value={form.urgence}
                options={[
                  { value: 'urgente', label: 'Urgente' },
                  { value: 'haute', label: 'Haute' },
                  { value: 'normale', label: 'Normale' },
                  { value: 'basse', label: 'Basse' },
                ]}
                onChange={(val) => setForm({ ...form, urgence: (val || 'normale') as any })}
                className="w-full"
                density="compact"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Demandé par</label>
              <SmartCombobox
                value={form.demande_par}
                options={[
                  { value: 'locataire', label: 'Locataire' },
                  { value: 'bailleur', label: 'Bailleur' },
                  { value: 'agent', label: 'Agence' },
                ]}
                onChange={(val) => setForm({ ...form, demande_par: (val || 'locataire') as any })}
                className="w-full"
                density="compact"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Description détaillée</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              placeholder="Détaillez le problème constaté..."
            />
          </div>
        </form>
      </WizardShell>

      <IncidentTimeline 
        isOpen={!!selectedIncident}
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdate={() => load()}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
