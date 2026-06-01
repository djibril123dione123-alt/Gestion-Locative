import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, DoorOpen, Home, Percent } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Immeubles } from './Immeubles';
import { Unites } from './Unites';
import { readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';

interface ImmeubleStatRow {
  id: string;
  bailleur_id: string | null;
}

interface UniteStatRow {
  id: string;
  statut: string | null;
  loyer_base: number | null;
  immeuble_id: string | null;
}

type PatrimoineTab = 'immeubles' | 'unites';

export function Patrimoine() {
  const { profile, accountProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<PatrimoineTab>('immeubles');
  const [immeubles, setImmeubles] = useState<ImmeubleStatRow[]>([]);
  const [unites, setUnites] = useState<UniteStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    if (immeubles.length === 0 && unites.length === 0) setLoading(true);
    try {
      const result = await readWithCache<{ immeubles: ImmeubleStatRow[]; unites: UniteStatRow[] }>(
        { agencyId: profile.agency_id, userId: profile.id },
        'patrimoine-stats',
        async () => {
          const [immeublesRes, unitesRes] = await Promise.all([
            supabase
              .from('immeubles')
              .select('id, bailleur_id')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true),
            supabase
              .from('unites')
              .select('id, statut, loyer_base, immeuble_id')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true),
          ]);

          if (immeublesRes.error) throw immeublesRes.error;
          if (unitesRes.error) throw unitesRes.error;
          return {
            immeubles: (immeublesRes.data ?? []) as ImmeubleStatRow[],
            unites: (unitesRes.data ?? []) as UniteStatRow[],
          };
        },
        { timeoutMs: 7_000 }
      );

      setImmeubles(result.data.immeubles);
      setUnites(result.data.unites);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      console.error('Erreur chargement patrimoine:', error);
    } finally {
      setLoading(false);
    }
  }, [immeubles.length, profile?.agency_id, profile?.id, unites.length]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const stats = useMemo(() => {
    const occupied = unites.filter((unite) => unite.statut === 'loue').length;
    const free = unites.filter((unite) => unite.statut !== 'loue').length;
    const potentialRevenue = unites.reduce((sum, unite) => sum + Number(unite.loyer_base ?? 0), 0);
    const occupancyRate = unites.length > 0 ? Math.round((occupied / unites.length) * 100) : 0;

    return {
      immeubles: immeubles.length,
      unites: unites.length,
      occupied,
      free,
      potentialRevenue,
      occupancyRate,
    };
  }, [immeubles.length, unites]);

  const tabs: Array<{ id: PatrimoineTab; label: string }> = [
    { id: 'immeubles', label: accountProfile.isIndividualOwner ? 'Mes biens' : 'Immeubles' },
    { id: 'unites', label: accountProfile.isIndividualOwner ? 'Mes unites' : 'Unites' },
  ];

  if (loading) {
    return <PageSkeleton title={accountProfile.isIndividualOwner ? 'Mes biens' : 'Patrimoine'} variant="analytics" />;
  }

  return (
    <div className="sk-page-shell space-y-5 sm:space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-brand-900 to-slate-950 p-5 text-white shadow-2xl shadow-emerald-950/15 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              {accountProfile.isIndividualOwner ? 'Patrimoine personnel' : 'Portefeuille locatif'}
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-4xl">
              {accountProfile.isIndividualOwner ? 'Mes biens' : 'Biens & patrimoine'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-50/75">
              Une vue commune pour suivre immeubles, unites, occupation et potentiel locatif sans multiplier les entrees de navigation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[34rem]">
            {[
              { label: 'Immeubles', value: stats.immeubles, icon: Building2 },
              { label: 'Unites', value: stats.unites, icon: DoorOpen },
              { label: 'Occupees', value: stats.occupied, icon: Home },
              { label: 'Occupation', value: `${stats.occupancyRate}%`, icon: Percent },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur">
                <metric.icon className="h-4 w-4 text-orange-200" />
                <p className="mt-2 text-xl font-black">{metric.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-100/70">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={loadStats}
        message="Les indicateurs de patrimoine affichent le dernier état connu. La création ou modification d'un bien nécessite une connexion."
      />

      <div className="rounded-2xl border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-brand-950 text-white shadow-lg shadow-emerald-950/15'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'immeubles' && <Immeubles />}
      {activeTab === 'unites' && <Unites />}
    </div>
  );
}
