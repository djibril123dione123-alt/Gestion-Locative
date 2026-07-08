import { useCallback, useEffect, useState } from 'react';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { supabase } from '../lib/supabase';
import { Search, Filter, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatSenegalPhone } from '../lib/formatters';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';

interface FiltersState {
  bailleur_id: string;
  immeuble_id: string;
  unite_id: string;
  statut_unite: string;
  statut_paiement: string;
  loyer_min: string;
  loyer_max: string;
  date_debut_min: string;
  date_debut_max: string;
}

interface OptionRow {
  id: string;
  nom: string;
  prenom?: string | null;
}

interface SearchResult {
  id: string;
  locataires?: { nom?: string | null; prenom?: string | null; telephone?: string | null } | null;
  unites?: {
    nom?: string | null;
    statut?: string | null;
    immeubles?: {
      nom?: string | null;
      bailleurs?: { nom?: string | null; prenom?: string | null } | null;
    } | null;
  } | null;
  loyer_mensuel: number;
  date_debut: string;
  date_fin?: string | null;
  statut: string;
  dernier_statut_paiement?: string;
}

export function FiltresAvances() {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { error: showError, toasts, removeToast } = useToast();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [bailleurs, setBailleurs] = useState<OptionRow[]>([]);
  const [immeubles, setImmeubles] = useState<OptionRow[]>([]);
  const [unites, setUnites] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    bailleur_id: '',
    immeuble_id: '',
    unite_id: '',
    statut_unite: '',
    statut_paiement: '',
    loyer_min: '',
    loyer_max: '',
    date_debut_min: '',
    date_debut_max: '',
  });

  const loadFilterOptions = useCallback(async () => {
    if (!profile?.agency_id) return;
    try {
      if (isIndividualOwner) {
        const { data: immeublesData } = await supabase
          .from('immeubles')
          .select('id, nom')
          .eq('agency_id', profile.agency_id)
          .eq('actif', true)
          .order('nom');
        setBailleurs([]);
        setImmeubles((immeublesData || []) as OptionRow[]);
        return;
      }

      const { data: bailleursData } = await supabase
        .from('bailleurs')
        .select('id, nom, prenom')
        .eq('agency_id', profile.agency_id)
        .eq('actif', true)
        .order('nom');

      setBailleurs((bailleursData || []) as OptionRow[]);
    } catch {
      // Les options seront rechargées à la prochaine ouverture.
    }
  }, [isIndividualOwner, profile?.agency_id]);

  const loadImmeublesByBailleur = useCallback(async (bailleurId: string) => {
    if (!profile?.agency_id) return;
    try {
      const { data } = await supabase
        .from('immeubles')
        .select('id, nom')
        .eq('agency_id', profile.agency_id)
        .eq('bailleur_id', bailleurId)
        .eq('actif', true)
        .order('nom');

      setImmeubles((data || []) as OptionRow[]);
    } catch {
      // Les options seront rechargées au prochain changement de bailleur.
    }
  }, [profile?.agency_id]);

  const loadUnitesByImmeuble = useCallback(async (immeubleId: string) => {
    if (!profile?.agency_id) return;
    try {
      const { data } = await supabase
        .from('unites')
        .select('id, nom')
        .eq('agency_id', profile.agency_id)
        .eq('immeuble_id', immeubleId)
        .eq('actif', true)
        .order('nom');

      setUnites((data || []) as OptionRow[]);
    } catch {
      // Les options seront rechargées au prochain changement d'immeuble.
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadFilterOptions();
    }
  }, [loadFilterOptions, profile?.agency_id]);

  useEffect(() => {
    if (isIndividualOwner) return;
    if (filters.bailleur_id) {
      loadImmeublesByBailleur(filters.bailleur_id);
    } else {
      setImmeubles([]);
      setUnites([]);
    }
  }, [filters.bailleur_id, isIndividualOwner, loadImmeublesByBailleur]);

  useEffect(() => {
    if (filters.immeuble_id) {
      loadUnitesByImmeuble(filters.immeuble_id);
    } else {
      setUnites([]);
    }
  }, [filters.immeuble_id, loadUnitesByImmeuble]);

  const handleSearch = async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('contrats')
        .select(`
          *,
          locataires(nom, prenom, telephone),
          unites(
            nom,
            loyer_base,
            statut,
            immeubles(
              nom,
              bailleurs(nom, prenom)
            )
          )
        `)
        .eq('agency_id', profile.agency_id);

      if (filters.bailleur_id) {
        const { data: immeublesFiltered } = await supabase
          .from('immeubles')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .eq('bailleur_id', filters.bailleur_id);

        const immeubleIds = immeublesFiltered?.map(i => i.id) || [];

        const { data: unitesFiltered } = await supabase
          .from('unites')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .in('immeuble_id', immeubleIds);

        const uniteIds = unitesFiltered?.map(u => u.id) || [];
        query = query.in('unite_id', uniteIds);
      }

      if (filters.immeuble_id) {
        const { data: unitesFiltered } = await supabase
          .from('unites')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .eq('immeuble_id', filters.immeuble_id);

        const uniteIds = unitesFiltered?.map(u => u.id) || [];
        query = query.in('unite_id', uniteIds);
      }

      if (filters.unite_id) {
        query = query.eq('unite_id', filters.unite_id);
      }

      if (filters.loyer_min) {
        query = query.gte('loyer_mensuel', parseFloat(filters.loyer_min));
      }

      if (filters.loyer_max) {
        query = query.lte('loyer_mensuel', parseFloat(filters.loyer_max));
      }

      if (filters.date_debut_min) {
        query = query.gte('date_debut', filters.date_debut_min);
      }

      if (filters.date_debut_max) {
        query = query.lte('date_debut', filters.date_debut_max);
      }

      if (filters.statut_unite) {
        const { data: unitesFiltered } = await supabase
          .from('unites')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .eq('statut', filters.statut_unite);

        const uniteIds = unitesFiltered?.map(u => u.id) || [];
        query = query.in('unite_id', uniteIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (filters.statut_paiement) {
        const contratIds = (data || []).map((c: { id: string }) => c.id);
        const latestByContrat = new Map<string, string>();

        if (contratIds.length > 0) {
          const { data: allPaiements } = await supabase
            .from('paiements')
            .select('contrat_id, statut, created_at')
            .eq('agency_id', profile.agency_id)
            .in('contrat_id', contratIds)
            .order('created_at', { ascending: false });

          (allPaiements || []).forEach((p: { contrat_id: string; statut: string }) => {
            if (!latestByContrat.has(p.contrat_id)) {
              latestByContrat.set(p.contrat_id, p.statut);
            }
          });
        }

        const filtered = (data || [])
          .map((c: { id: string }) => ({
            ...c,
            dernier_statut_paiement: latestByContrat.get(c.id) || 'aucun',
          }))
          .filter((c: { dernier_statut_paiement: string }) =>
            c.dernier_statut_paiement === filters.statut_paiement
          );
        setResults(filtered as SearchResult[]);
      } else {
        setResults((data || []) as SearchResult[]);
      }
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      bailleur_id: '',
      immeuble_id: '',
      unite_id: '',
      statut_unite: '',
      statut_paiement: '',
      loyer_min: '',
      loyer_max: '',
      date_debut_min: '',
      date_debut_max: '',
    });
    setResults([]);
    if (!isIndividualOwner) setImmeubles([]);
    setUnites([]);
  };

  const exportToExcel = () => {
    const data = results.map(r => ({
      Locataire: r.locataires ? `${r.locataires.prenom} ${r.locataires.nom}` : '',
      Téléphone: formatSenegalPhone(r.locataires?.telephone, ''),
      Unité: r.unites?.nom || '',
      Immeuble: r.unites?.immeubles?.nom || '',
      ...(!isIndividualOwner
        ? { Bailleur: r.unites?.immeubles?.bailleurs ? `${r.unites.immeubles.bailleurs.prenom} ${r.unites.immeubles.bailleurs.nom}` : '' }
        : {}),
      'Loyer mensuel': r.loyer_mensuel,
      'Statut produit': r.unites?.statut || '',
      'Date début': r.date_debut,
      'Date fin': r.date_fin || '',
      'Statut contrat': r.statut,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Résultats');
    XLSX.writeFile(wb, 'filtres-avances.xlsx');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PremiumPageHeader
        density="compact"
        eyebrow="PILOTAGE AGENCE"
        title="Filtres avancés"
        description="Recherchez rapidement dans les données locatives et financières."
        mobileDescription="Recherche avancée."
      />

      <div className="sk-card p-4 sm:p-6 lg:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h2 className="text-base lg:text-lg font-semibold text-slate-900">Critères de recherche</h2>
          {activeFiltersCount > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm font-medium rounded-full">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {!isIndividualOwner && (
            <div>
              <label htmlFor="filter-bailleur" className="block text-sm font-medium text-slate-700 mb-2">Bailleur</label>
              <select
                id="filter-bailleur"
                aria-label="Filtrer par bailleur"
                value={filters.bailleur_id}
                onChange={(e) => setFilters({ ...filters, bailleur_id: e.target.value, immeuble_id: '', unite_id: '' })}
                className="w-full sk-input"
              >
                <option value="">Tous les bailleurs</option>
                {bailleurs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.prenom} {b.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="filter-immeuble" className="block text-sm font-medium text-slate-700 mb-2">Immeuble</label>
            <select
              id="filter-immeuble"
              aria-label="Filtrer par immeuble"
              value={filters.immeuble_id}
              onChange={(e) => setFilters({ ...filters, immeuble_id: e.target.value, unite_id: '' })}
              className="w-full sk-input"
              disabled={!isIndividualOwner && !filters.bailleur_id && bailleurs.length > 0}
            >
              <option value="">Tous les immeubles</option>
              {immeubles.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-unite" className="block text-sm font-medium text-slate-700 mb-2">Unité</label>
            <select
              id="filter-unite"
              aria-label="Filtrer par unité"
              value={filters.unite_id}
              onChange={(e) => setFilters({ ...filters, unite_id: e.target.value })}
              className="w-full sk-input"
              disabled={!filters.immeuble_id && immeubles.length > 0}
            >
              <option value="">Toutes les unités</option>
              {unites.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-statut-unite" className="block text-sm font-medium text-slate-700 mb-2">Statut produit</label>
            <select
              id="filter-statut-unite"
              aria-label="Filtrer par statut produit"
              value={filters.statut_unite}
              onChange={(e) => setFilters({ ...filters, statut_unite: e.target.value })}
              className="w-full sk-input"
            >
              <option value="">Tous les statuts</option>
              <option value="libre">Libre</option>
              <option value="loue">Loué</option>
              <option value="maintenance">En maintenance</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-statut-paiement" className="block text-sm font-medium text-slate-700 mb-2">Statut paiement</label>
            <select
              id="filter-statut-paiement"
              aria-label="Filtrer par statut de paiement"
              value={filters.statut_paiement}
              onChange={(e) => setFilters({ ...filters, statut_paiement: e.target.value })}
              className="w-full sk-input"
            >
              <option value="">Tous</option>
              <option value="paye">Payé</option>
              <option value="en_retard">En retard</option>
              <option value="partiel">Partiel</option>
              <option value="aucun">Aucun paiement</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-loyer-min" className="block text-sm font-medium text-slate-700 mb-2">Loyer minimum</label>
            <input
              id="filter-loyer-min"
              aria-label="Loyer minimum"
              type="number"
              value={filters.loyer_min}
              onChange={(e) => setFilters({ ...filters, loyer_min: e.target.value })}
              placeholder="0"
              className="w-full sk-input"
            />
          </div>

          <div>
            <label htmlFor="filter-loyer-max" className="block text-sm font-medium text-slate-700 mb-2">Loyer maximum</label>
            <input
              id="filter-loyer-max"
              aria-label="Loyer maximum"
              type="number"
              value={filters.loyer_max}
              onChange={(e) => setFilters({ ...filters, loyer_max: e.target.value })}
              placeholder="1000000"
              className="w-full sk-input"
            />
          </div>

          <div>
            <label htmlFor="filter-date-debut-min" className="block text-sm font-medium text-slate-700 mb-2">Date début (min)</label>
            <input
              id="filter-date-debut-min"
              aria-label="Date de début minimum"
              type="date"
              value={filters.date_debut_min}
              onChange={(e) => setFilters({ ...filters, date_debut_min: e.target.value })}
              className="w-full sk-input"
            />
          </div>

          <div>
            <label htmlFor="filter-date-debut-max" className="block text-sm font-medium text-slate-700 mb-2">Date début (max)</label>
            <input
              id="filter-date-debut-max"
              aria-label="Date de début maximum"
              type="date"
              value={filters.date_debut_max}
              onChange={(e) => setFilters({ ...filters, date_debut_max: e.target.value })}
              className="w-full sk-input"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm sm:text-base"
          >
            <Search className="w-4 sm:w-5 h-4 sm:h-5" />
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>

          <button
            onClick={resetFilters}
            className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 sm:px-6 sm:py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm sm:text-base"
          >
            <X className="w-4 sm:w-5 h-4 sm:h-5" />
            Réinitialiser
          </button>

          {results.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition sm:ml-auto text-sm sm:text-base"
            >
              <Download className="w-4 sm:w-5 h-4 sm:h-5" />
              Export Excel
            </button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="sk-card p-4 sm:p-6 lg:p-6">
          <h2 className="text-base lg:text-lg font-semibold text-slate-900 mb-4">
            Résultats ({results.length} contrat{results.length > 1 ? 's' : ''})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Locataire</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Produit</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Immeuble</th>
                  {!isIndividualOwner && (
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Bailleur</th>
                  )}
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Loyer mensuel</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Période</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Statut</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-900">
                        {c.locataires ? `${c.locataires.prenom} ${c.locataires.nom}` : '-'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatSenegalPhone(c.locataires?.telephone, '')}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-900">{c.unites?.nom || '-'}</p>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {c.unites?.statut || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      {c.unites?.immeubles?.nom || '-'}
                    </td>
                    {!isIndividualOwner && (
                      <td className="py-4 px-4 text-slate-700">
                        {c.unites?.immeubles?.bailleurs
                          ? `${c.unites.immeubles.bailleurs.prenom} ${c.unites.immeubles.bailleurs.nom}`
                          : '-'}
                      </td>
                    )}
                    <td className="py-4 px-4 font-semibold text-slate-900">
                      {formatCurrency(c.loyer_mensuel)}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      Du {new Date(c.date_debut).toLocaleDateString('fr-FR')}
                      {c.date_fin && (
                        <>
                          <br />
                          Au {new Date(c.date_fin).toLocaleDateString('fr-FR')}
                        </>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          c.statut === 'actif'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {c.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
