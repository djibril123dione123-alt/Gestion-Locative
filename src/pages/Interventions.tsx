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
import { WizardShell } from '../components/ui/WizardShell';
import { ToastContainer } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { Wrench, Plus, ArrowRight, Phone, Building2, AlertTriangle, CheckCircle2, Clock, Search } from 'lucide-react';
import { formatCurrency, formatSenegalPhone, formatSenegalPhoneInput, getSenegalPhoneHref, normalizeSenegalPhone } from '../lib/formatters';
import { PageSkeleton, SkeletonCards } from '../components/ui/Skeleton';
import { useDirectRoute } from '../hooks/useDirectRoute';

type Statut = 'a_faire' | 'en_cours' | 'termine';
type Urgence = 'urgente' | 'normale' | 'basse';
type Categorie = 'plomberie' | 'electricite' | 'peinture' | 'serrurerie' | 'climatisation' | 'autre';
type DemandePar = 'locataire' | 'bailleur' | 'agent';
type UrgenceFilter = 'all' | Urgence;
type CategorieFilter = 'all' | Categorie;

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

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      const bienId = params.get('bienId');
      setForm((prev) => ({ ...prev, immeuble_id: bienId || prev.immeuble_id }));
      setIsOpen(true);
    },
  });

  const [items, setItems] = useState<Intervention[]>([]);
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([]);
  const [unites, setUnites] = useState<{ id: string; nom: string; immeuble_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toolbar & filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgence, setFilterUrgence] = useState<UrgenceFilter>('all');
  const [filterCategorie, setFilterCategorie] = useState<CategorieFilter>('all');
  const [filterImmeuble, setFilterImmeuble] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<'all' | Statut>('all');
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
        titre: form.titre.trim(),
        description: form.description.trim() || null,
        immeuble_id: form.immeuble_id || null,
        unite_id: form.unite_id || null,
        categorie: form.categorie,
        urgence: form.urgence,
        demande_par: form.demande_par,
        date_demande: form.date_demande,
        date_souhaitee: form.date_souhaitee || null,
        prestataire_nom: form.prestataire_nom.trim() || null,
        prestataire_telephone: normalizeSenegalPhone(form.prestataire_telephone) || null,
        cout_estime: form.cout_estime ? parseFloat(form.cout_estime) : null,
        statut: 'a_faire',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Intervention créée avec succès');
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

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterStatut !== 'all' && i.statut !== filterStatut) return false;
      if (filterUrgence !== 'all' && i.urgence !== filterUrgence) return false;
      if (filterCategorie !== 'all' && i.categorie !== filterCategorie) return false;
      if (filterImmeuble !== 'all' && i.immeuble_id !== filterImmeuble) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitre = i.titre.toLowerCase().includes(q);
        const matchDesc = (i.description || '').toLowerCase().includes(q);
        const matchPrest = (i.prestataire_nom || '').toLowerCase().includes(q);
        if (!matchTitre && !matchDesc && !matchPrest) return false;
      }
      return true;
    });
  }, [items, filterStatut, filterUrgence, filterCategorie, filterImmeuble, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      aFaire: items.filter((i) => i.statut === 'a_faire').length,
      enCours: items.filter((i) => i.statut === 'en_cours').length,
      termine: items.filter((i) => i.statut === 'termine').length,
      urgentes: items.filter((i) => i.urgence === 'urgente' && i.statut !== 'termine').length,
    };
  }, [items]);

  const filteredUnites = form.immeuble_id ? unites.filter((u) => u.immeuble_id === form.immeuble_id) : unites;

  const quickChips: QuickChip[] = useMemo(() => [
    {
      id: 'all',
      label: 'Toutes',
      count: items.length,
      isActive: filterStatut === 'all',
      onClick: () => setFilterStatut('all'),
    },
    {
      id: 'a_faire',
      label: 'À faire',
      count: stats.aFaire,
      isActive: filterStatut === 'a_faire',
      onClick: () => setFilterStatut(filterStatut === 'a_faire' ? 'all' : 'a_faire'),
    },
    {
      id: 'en_cours',
      label: 'En cours',
      count: stats.enCours,
      isActive: filterStatut === 'en_cours',
      onClick: () => setFilterStatut(filterStatut === 'en_cours' ? 'all' : 'en_cours'),
    },
    {
      id: 'termine',
      label: 'Terminé',
      count: stats.termine,
      isActive: filterStatut === 'termine',
      onClick: () => setFilterStatut(filterStatut === 'termine' ? 'all' : 'termine'),
    },
  ], [items.length, stats, filterStatut]);

  if (loading && items.length === 0) {
    return <PageSkeleton title="Maintenance" variant="table" />;
  }

  return (
    <div className="space-y-4 pt-2.5 sm:pt-3">
      <PremiumPageHeader
        density="compact"
        eyebrow="OPÉRATIONS TERRAIN"
        title="Maintenance"
        description="Pilotez les interventions, travaux et réparations terrain."
        mobileDescription="Maintenance terrain."
        primaryAction={
          <PremiumButton variant="create" size="sm" onClick={() => setIsOpen(true)} data-testid="button-new-intervention" icon={<Plus className="h-4 w-4" />}>
            Nouvelle intervention
          </PremiumButton>
        }
      />

      <PremiumKpiGrid density="compact">
        <MetricCard density="compact" label="Total interventions" value={stats.total} icon={Wrench} tone="emerald" />
        <MetricCard density="compact" label="À faire" value={stats.aFaire} icon={Clock} tone="amber" />
        <MetricCard density="compact" label="En cours" value={stats.enCours} icon={AlertTriangle} tone="blue" />
        <MetricCard density="compact" label="Terminées" value={stats.termine} icon={CheckCircle2} tone="green" />
      </PremiumKpiGrid>

      <PremiumToolbar
        density="compact"
        ariaLabel="Filtres des interventions"
        quickChips={quickChips}
        search={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une intervention ou prestataire..."
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
              value={filterUrgence}
              options={[
                { value: 'all', label: 'Toute urgence' },
                { value: 'urgente', label: 'Urgente' },
                { value: 'normale', label: 'Normale' },
                { value: 'basse', label: 'Basse' },
              ]}
              onChange={(val) => setFilterUrgence((val || 'all') as UrgenceFilter)}
              placeholder="Urgence"
              className="w-36 shrink-0"
              density="compact"
            />
            <SmartCombobox
              value={filterCategorie}
              options={[
                { value: 'all', label: 'Toute catégorie' },
                { value: 'plomberie', label: 'Plomberie' },
                { value: 'electricite', label: 'Électricité' },
                { value: 'peinture', label: 'Peinture' },
                { value: 'serrurerie', label: 'Serrurerie' },
                { value: 'climatisation', label: 'Climatisation' },
                { value: 'autre', label: 'Autre' },
              ]}
              onChange={(val) => setFilterCategorie((val || 'all') as CategorieFilter)}
              placeholder="Catégorie"
              className="w-40 shrink-0"
              density="compact"
            />
            <SmartCombobox
              value={filterImmeuble}
              options={[
                { value: 'all', label: 'Tous immeubles' },
                ...immeubles.map((i) => ({ value: i.id, label: i.nom })),
              ]}
              onChange={(val) => setFilterImmeuble(val || 'all')}
              placeholder="Immeuble"
              className="w-44 shrink-0"
              density="compact"
            />
          </div>
        }
      />

      {loading ? (
        <SkeletonCards count={4} />
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
                <div key={col.id} className={`${col.bg} rounded-2xl border border-slate-200/80 p-4 ${activeColumn === col.id ? 'block' : 'hidden'} lg:block shadow-xs`} data-testid={`column-${col.id}`}>
                  <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-200/60">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      {col.label}
                    </h3>
                    <span className="bg-white border border-slate-200 text-slate-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                      {list.length}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {list.map((i) => (
                      <div key={i.id} data-testid={`intervention-${i.id}`} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">{i.titre}</h4>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase shrink-0 tracking-wider ${urgenceColors[i.urgence]}`}>
                            {i.urgence}
                          </span>
                        </div>

                        {i.description && <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{i.description}</p>}

                        <div className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                          {(i.immeubles?.nom || i.unites?.nom) && (
                            <p className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              {[i.immeubles?.nom, i.unites?.nom].filter(Boolean).join(' - ')}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            {i.categorie && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold capitalize">
                                {i.categorie}
                              </span>
                            )}

                            {i.cout_estime && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                                {formatCurrency(i.cout_estime)}
                              </span>
                            )}
                          </div>

                          {i.prestataire_nom && (
                            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 mt-1">
                              <div className="text-[11px] font-medium text-slate-700 truncate">
                                <span className="text-slate-400">Artisan:</span> <strong className="text-slate-900">{i.prestataire_nom}</strong>
                              </div>
                              {i.prestataire_telephone && (
                                <a
                                  href={getSenegalPhoneHref(i.prestataire_telephone) ?? undefined}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs transition shrink-0"
                                  title="Appeler l'artisan"
                                >
                                  <Phone className="h-3 w-3" />
                                  {formatSenegalPhone(i.prestataire_telephone)}
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions de changement de statut */}
                        <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-slate-100">
                          {i.statut !== 'a_faire' && (
                            <button
                              type="button"
                              onClick={() => move(i.id, 'a_faire')}
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-600 transition"
                            >
                              À faire
                            </button>
                          )}
                          {i.statut !== 'en_cours' && (
                            <button
                              type="button"
                              onClick={() => move(i.id, 'en_cours')}
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100 font-bold text-blue-700 transition"
                            >
                              En cours
                            </button>
                          )}
                          {i.statut !== 'termine' && (
                            <button
                              type="button"
                              onClick={() => move(i.id, 'termine')}
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 font-bold text-emerald-800 flex items-center gap-1 transition"
                            >
                              Terminer <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <WizardShell
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          clearDirectRouteParams();
        }}
        size="simple"
        variant="classic"
        tone="agency"
        eyebrow="SAMAY KËUR"
        title="Nouvelle intervention"
        description="Planifiez ou consignez une intervention de maintenance sur l'un de vos immeubles ou unités."
        primaryAction={
          <button
            type="button"
            onClick={(e) => void submit(e as unknown as React.FormEvent)}
            disabled={submitting}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Créer l’intervention'}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              clearDirectRouteParams();
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Annuler
          </button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Titre de l'intervention *</label>
            <input
              type="text"
              required
              placeholder="Ex : Fuite robinet salle de bain"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
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
                onChange={(val) => setForm({ ...form, categorie: (val || 'autre') as Categorie })}
                placeholder="Catégorie"
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
                  { value: 'normale', label: 'Normale' },
                  { value: 'basse', label: 'Basse' },
                ]}
                onChange={(val) => setForm({ ...form, urgence: (val || 'normale') as Urgence })}
                placeholder="Urgence"
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
                onChange={(val) => setForm({ ...form, demande_par: (val || 'locataire') as DemandePar })}
                placeholder="Demandeur"
                className="w-full"
                density="compact"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Description détaillée</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              placeholder="Détaillez le problème ou les travaux à effectuer..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Prestataire</label>
              <input
                type="text"
                placeholder="Nom artisan / société"
                value={form.prestataire_nom}
                onChange={(e) => setForm({ ...form, prestataire_nom: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Téléphone prestataire</label>
              <input
                type="tel"
                placeholder="+221 77 000 00 00"
                value={form.prestataire_telephone}
                onChange={(e) => setForm({ ...form, prestataire_telephone: formatSenegalPhoneInput(e.target.value) })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Coût estimé (FCFA)</label>
              <input
                type="number"
                placeholder="0"
                value={form.cout_estime}
                onChange={(e) => setForm({ ...form, cout_estime: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
          </div>
        </form>
      </WizardShell>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
