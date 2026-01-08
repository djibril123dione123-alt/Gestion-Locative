import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';

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

export function FiltresAvances() {
  const { profile } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [bailleurs, setBailleurs] = useState<any[]>([]);
  const [immeubles, setImmeubles] = useState<any[]>([]);
  const [unites, setUnites] = useState<any[]>([]);
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

  useEffect(() => {
    if (profile?.agency_id) {
      loadFilterOptions();
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    if (filters.bailleur_id) {
      loadImmeublesByBailleur(filters.bailleur_id);
    } else {
      setImmeubles([]);
      setUnites([]);
    }
  }, [filters.bailleur_id]);

  useEffect(() => {
    if (filters.immeuble_id) {
      loadUnitesByImmeuble(filters.immeuble_id);
    } else {
      setUnites([]);
    }
  }, [filters.immeuble_id]);

  const loadFilterOptions = async () => {
    if (!profile?.agency_id) return;
    try {
      const { data: bailleursData } = await supabase
        .from('bailleurs')
        .select('id, nom, prenom')
        .eq('agency_id', profile.agency_id)
        .eq('actif', true)
        .order('nom');

      setBailleurs(bailleursData || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadImmeublesByBailleur = async (bailleurId: string) => {
    if (!profile?.agency_id) return;
    try {
      const { data } = await supabase
        .from('immeubles')
        .select('id, nom')
        .eq('agency_id', profile.agency_id)
        .eq('bailleur_id', bailleurId)
        .eq('actif', true)
        .order('nom');

      setImmeubles(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadUnitesByImmeuble = async (immeubleId: string) => {
    if (!profile?.agency_id) return;
    try {
      const { data } = await supabase
        .from('unites')
        .select('id, nom')
        .eq('agency_id', profile.agency_id)
        .eq('immeuble_id', immeubleId)
        .eq('actif', true)
        .order('nom');

      setUnites(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
        const contratsWithPaiements = await Promise.all(
          (data || []).map(async (contrat) => {
            const { data: paiements } = await supabase
              .from('paiements')
              .select('statut')
              .eq('agency_id', profile.agency_id)
              .eq('contrat_id', contrat.id)
              .order('created_at', { ascending: false })
              .limit(1);

            return {
              ...contrat,
              dernier_statut_paiement: paiements?.[0]?.statut || 'aucun',
            };
          })
        );

        const filtered = contratsWithPaiements.filter(
          c => c.dernier_statut_paiement === filters.statut_paiement
        );
        setResults(filtered);
      } else {
        setResults(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la recherche');
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
    setImmeubles([]);
    setUnites([]);
  };

  const exportToExcel = () => {
    const data = results.map(r => ({
      Locataire: r.locataires ? `${r.locataires.prenom} ${r.locataires.nom}` : '',
      Téléphone: r.locataires?.telephone || '',
      Unité: r.unites?.nom || '',
      Immeuble: r.unites?.immeubles?.nom || '',
      Bailleur: r.unites?.immeubles?.bailleurs ? `${r.unites.immeubles.bailleurs.prenom} ${r.unites.immeubles.bailleurs.nom}` : '',
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

const formatCurrency = (amount: number) => {
  if (!amount) return '0 F CFA';
  return (
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
      .format(amount)
      .replace(/\u00A0/g, ' ') + ' F CFA'
  );
};


  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Filtres Avancés</h1>
        <p className="text-slate-600">Recherche multicritères dans toutes les données</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Critères de recherche</h2>
          {activeFiltersCount > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bailleur</label>
            <select
              value={filters.bailleur_id}
              onChange={(e) => setFilters({ ...filters, bailleur_id: e.target.value, immeuble_id: '', unite_id: '' })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les bailleurs</option>
              {bailleurs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.prenom} {b.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Immeuble</label>
            <select
              value={filters.immeuble_id}
              onChange={(e) => setFilters({ ...filters, immeuble_id: e.target.value, unite_id: '' })}
              disabled={!filters.bailleur_id}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Produit</label>
            <select
              value={filters.unite_id}
              onChange={(e) => setFilters({ ...filters, unite_id: e.target.value })}
              disabled={!filters.immeuble_id}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Toutes les produits</option>
              {unites.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Statut produit</label>
            <select
              value={filters.statut_unite}
              onChange={(e) => setFilters({ ...filters, statut_unite: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="libre">Libre</option>
              <option value="loue">Loué</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Statut paiement</label>
            <select
              value={filters.statut_paiement}
              onChange={(e) => setFilters({ ...filters, statut_paiement: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="paye">Payé</option>
              <option value="impaye">Impayé</option>
              <option value="partiel">Partiel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Loyer minimum</label>
            <input
              type="number"
              value={filters.loyer_min}
              onChange={(e) => setFilters({ ...filters, loyer_min: e.target.value })}
              placeholder="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Loyer maximum</label>
            <input
              type="number"
              value={filters.loyer_max}
              onChange={(e) => setFilters({ ...filters, loyer_max: e.target.value })}
              placeholder="1000000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date début (min)</label>
            <input
              type="date"
              value={filters.date_debut_min}
              onChange={(e) => setFilters({ ...filters, date_debut_min: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date début (max)</label>
            <input
              type="date"
              value={filters.date_debut_max}
              onChange={(e) => setFilters({ ...filters, date_debut_max: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Search className="w-5 h-5" />
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>

          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <X className="w-5 h-5" />
            Réinitialiser
          </button>

          {results.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition ml-auto"
            >
              <Download className="w-5 h-5" />
              Export Excel
            </button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Résultats ({results.length} contrat{results.length > 1 ? 's' : ''})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Locataire</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Produit</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Immeuble</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Bailleur</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-700">Loyer</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Date début</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Statut</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b border-slate-100">
                    <td className="py-4 px-4 text-sm text-slate-700">
                      {result.locataires ? `${result.locataires.prenom} ${result.locataires.nom}` : '-'}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">{result.unites?.nom || '-'}</td>
                    <td className="py-4 px-4 text-sm text-slate-700">{result.unites?.immeubles?.nom || '-'}</td>
                    <td className="py-4 px-4 text-sm text-slate-700">
                      {result.unites?.immeubles?.bailleurs
                        ? `${result.unites.immeubles.bailleurs.prenom} ${result.unites.immeubles.bailleurs.nom}`
                        : '-'}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700 text-right font-medium">
                      {formatCurrency(result.loyer_mensuel)}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">{result.date_debut}</td>
                    <td className="py-4 px-4 text-sm text-slate-700">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          result.statut === 'actif'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {result.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && activeFiltersCount > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Aucun résultat</h3>
          <p className="text-slate-600">Essayez de modifier vos critères de recherche</p>
        </div>
      )}
    </div>
  );
}
