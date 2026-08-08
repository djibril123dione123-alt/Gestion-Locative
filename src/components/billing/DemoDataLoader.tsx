import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { isOfficialDemoTenant } from '../../lib/demoTenant';
import { isPresentationMode } from '../../lib/presentationMode';
import { supabase } from '../../lib/supabase';
import { createContratViaEdge } from '../../services/api/contratApi';
import { createPaiementViaEdge } from '../../services/api/paiementApi';
import { getOrCreateIndividualOwnerBailleur } from '../../services/individualOwner';
import { markTenantDemoDataLoaded } from '../../services/tenantProfileCommands';
import { ToastContainer } from '../ui/Toast';

interface DemoDataLoaderProps {
  onLoaded?: () => void;
  compact?: boolean;
  variant?: 'full' | 'compact' | 'resetBanner';
}

const DEMO_TABLES = ['bailleurs', 'immeubles', 'unites', 'locataires', 'contrats', 'paiements'] as const;

const DEMO_DATA = {
  bailleur: {
    nom: 'Diop',
    prenom: 'Moussa',
    telephone: '221770000001',
    email: 'moussa.diop@demo.com',
    commission: 10,
  },
  immeuble: {
    nom: 'Residence Baobab',
    adresse: 'Rue 10, Almadies',
    quartier: 'Almadies',
    ville: 'Dakar',
    nombre_unites: 4,
  },
  unites: [
    { nom: 'Appartement 1A', numero: '1A', etage: '1', superficie: 65, loyer_base: 200000 },
    { nom: 'Appartement 1B', numero: '1B', etage: '1', superficie: 80, loyer_base: 250000 },
    { nom: 'Studio 2A', numero: '2A', etage: '2', superficie: 35, loyer_base: 120000 },
  ],
  locataires: [
    { nom: 'Sow', prenom: 'Fatou', telephone: '221770000002', email: 'fatou.sow@demo.com' },
    { nom: 'Ndiaye', prenom: 'Ibrahima', telephone: '221770000003', email: 'ibrahima.ndiaye@demo.com' },
  ],
};

export function DemoDataLoader({ onLoaded, compact = false, variant = 'full' }: DemoDataLoaderProps) {
  const location = useLocation();
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const officialDemoTenant = isOfficialDemoTenant(profile?.agency_id ?? agency?.id);
  const presentationMode = isPresentationMode(
    location.search,
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [demoPresent, setDemoPresent] = useState(false);

  const ensureDemoFlagReady = async (agencyId: string) => {
    const { error } = await supabase
      .from('immeubles')
      .select('is_demo_data')
      .eq('agency_id', agencyId)
      .limit(1);

    if (error) {
      throw new Error("Le marquage des donnees exemples n'est pas encore disponible. Appliquez la migration demo data avant de charger les exemples.");
    }
  };

  const refreshDemoPresence = async (agencyId: string) => {
    const checks = await Promise.allSettled(
      DEMO_TABLES.map((table) =>
        supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('is_demo_data', true),
      ),
    );

    return checks.some((result) => result.status === 'fulfilled' && (result.value.count ?? 0) > 0);
  };

  useEffect(() => {
    if (!profile?.agency_id || officialDemoTenant) {
      setDemoPresent(false);
      return;
    }
    const agencyId = profile.agency_id;
    let alive = true;
    void (async () => {
      try {
        const hasDemoData = await refreshDemoPresence(agencyId);
        if (!alive) return;
        setDemoPresent(hasDemoData);
      } catch {
        if (alive) setDemoPresent(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [officialDemoTenant, profile?.agency_id]);

  const loadDemo = async () => {
    if (!profile?.agency_id || officialDemoTenant) return;
    setLoading(true);

    try {
      const agencyId = profile.agency_id;
      await ensureDemoFlagReady(agencyId);
      if (demoPresent) {
        toast.warning('Des donnees exemples sont deja presentes. Reinitialisez-les avant de relancer un jeu de test.');
        return;
      }

      const { count: existingCount } = await supabase
        .from('immeubles')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .or('is_demo_data.is.false,is_demo_data.is.null');

      if ((existingCount ?? 0) > 0) {
        toast.warning(
          isIndividualOwner
            ? 'Votre espace contient deja des donnees. Les exemples sont reserves aux espaces vides.'
            : 'Votre agence contient deja des donnees. La demo est reservee aux espaces vides.',
        );
        return;
      }

      const bailleur = isIndividualOwner
        ? await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile })
        : await (async () => {
            const { data, error } = await supabase
              .from('bailleurs')
              .insert({ ...DEMO_DATA.bailleur, agency_id: agencyId, is_demo_data: true })
              .select('id')
              .single();
            if (error) throw error;
            return data;
          })();

      if (!bailleur?.id) {
        throw new Error('Profil proprietaire indisponible.');
      }

      const commissionRate = isIndividualOwner ? 0 : DEMO_DATA.bailleur.commission;

      const { data: immeuble, error: immeubleError } = await supabase
        .from('immeubles')
        .insert({ ...DEMO_DATA.immeuble, agency_id: agencyId, bailleur_id: bailleur.id, is_demo_data: true })
        .select('id')
        .single();
      if (immeubleError) throw immeubleError;

      const { data: unites, error: unitesError } = await supabase
        .from('unites')
        .insert(
          DEMO_DATA.unites.map((unite) => ({
            ...unite,
            agency_id: agencyId,
            immeuble_id: immeuble.id,
            statut: 'libre',
            actif: true,
            is_demo_data: true,
          })),
        )
        .select('id, loyer_base');
      if (unitesError) throw unitesError;
      if (!unites || unites.length < 2) throw new Error('Les unites de demo n ont pas pu etre creees.');

      const { data: locataires, error: locatairesError } = await supabase
        .from('locataires')
        .insert(DEMO_DATA.locataires.map((locataire) => ({ ...locataire, agency_id: agencyId, is_demo_data: true })))
        .select('id');
      if (locatairesError) throw locatairesError;
      if (!locataires || locataires.length < 2) throw new Error('Les locataires de demo n ont pas pu etre crees.');

      const today = new Date().toISOString().split('T')[0];
      const contrats = await Promise.all([
        createContratViaEdge({
          unite_id: unites[0].id,
          locataire_id: locataires[0].id,
          loyer_mensuel: DEMO_DATA.unites[0].loyer_base,
          commission: commissionRate,
          date_debut: today,
          statut: 'actif',
          is_demo_data: true,
        }),
        createContratViaEdge({
          unite_id: unites[1].id,
          locataire_id: locataires[1].id,
          loyer_mensuel: DEMO_DATA.unites[1].loyer_base,
          commission: commissionRate,
          date_debut: today,
          statut: 'actif',
          is_demo_data: true,
        }),
      ]);

      const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`;
      const loyerComplet = DEMO_DATA.unites[0].loyer_base;
      const montantPartiel = 150000;

      const paiementResults = await Promise.allSettled([
        createPaiementViaEdge({
          contrat_id: contrats[0].id,
          montant_total: loyerComplet,
          mois_concerne: currentMonth,
          date_paiement: today,
          mode_paiement: 'mobile_money',
          statut: 'paye',
          reference: 'DEMO-001',
          idempotency_key: `demo:${agencyId}:${contrats[0].id}:${currentMonth}:full`,
          is_demo_data: true,
        }),
        createPaiementViaEdge({
          contrat_id: contrats[1].id,
          montant_total: montantPartiel,
          mois_concerne: currentMonth,
          date_paiement: today,
          mode_paiement: 'especes',
          statut: 'partiel',
          reference: 'DEMO-002',
          idempotency_key: `demo:${agencyId}:${contrats[1].id}:${currentMonth}:partial`,
          is_demo_data: true,
        }),
      ]);

      const paiementFailures = paiementResults.filter((result) => result.status === 'rejected');
      if (paiementFailures.length > 0) {
        console.warn('[DemoDataLoader] paiements demo partiellement indisponibles', paiementFailures);
      }

      try {
        await markTenantDemoDataLoaded();
      } catch (demoFlagError) {
        console.warn('[DemoDataLoader] demo_data_loaded flag skipped', demoFlagError);
      }

      setDone(true);
      setDemoPresent(true);
      if (paiementFailures.length > 0) {
        toast.warning(
          isIndividualOwner
            ? 'Exemples proprietaire charges sans paiements automatiques. Vous pouvez continuer et enregistrer un premier loyer.'
            : 'Données exemples chargées sans paiements automatiques. Vous pouvez continuer depuis Encaissements.',
        );
      } else {
        toast.success(
          isIndividualOwner
            ? 'Exemples proprietaire charges. Vous pouvez explorer votre espace tout de suite.'
            : 'Données exemples chargées. Vous pouvez explorer le produit tout de suite.',
        );
      }
      onLoaded?.();
    } catch (err) {
      console.warn('[DemoDataLoader] exemples indisponibles', err);
      if (isIndividualOwner) {
        toast.warning('Les exemples ne sont pas disponibles pour le moment. Vous pouvez continuer en ajoutant votre premier bien.');
      } else {
        toast.error('Impossible de charger les donnees exemples. Vous pouvez continuer en ajoutant votre premier bien.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetDemo = async () => {
    if (!profile?.agency_id || officialDemoTenant) return;
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    const agencyId = profile.agency_id;
    setResetting(true);
    try {
      await ensureDemoFlagReady(agencyId);

      const { error: resetError } = await supabase.rpc('reset_demo_data', { p_agency_id: agencyId });
      if (resetError) {
        if (import.meta.env.DEV) {
          console.error('[DemoDataLoader] reset_demo_data RPC error', resetError);
        }
        throw new Error(
          resetError.message ||
            resetError.details ||
            resetError.hint ||
            'Impossible de supprimer les donnees exemples.',
        );
      }

      setDone(false);
      setDemoPresent(await refreshDemoPresence(agencyId));
      setConfirmReset(false);
      toast.success('Les donnees exemples ont ete supprimees. Vos vraies donnees sont conservees.');
      onLoaded?.();
    } catch (err) {
      console.warn('[DemoDataLoader] reset exemples indisponible', err);
      toast.error(err instanceof Error ? err.message : 'Impossible de supprimer les donnees exemples.');
    } finally {
      setResetting(false);
    }
  };

  if (officialDemoTenant) return null;

  if (variant === 'resetBanner') {
    if (!demoPresent || presentationMode) return null;

    return (
      <>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-emerald-50 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          {confirmReset && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-white/85 p-3 text-sm font-semibold text-orange-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Supprimer les donnees exemples ? Cette action retire uniquement les exemples generes par Samay Keur. Vos vraies donnees ne seront pas supprimees.</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-slate-950">Données exemples actives</p>
                <p className="mt-0.5 text-sm font-semibold leading-5 text-slate-600">
                  Vous explorez Samay Këur avec des données de test. Vous pouvez les supprimer sans toucher à vos vraies données.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void resetDemo()}
              disabled={resetting || loading}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-black text-orange-700 shadow-sm transition hover:bg-orange-50 disabled:opacity-50"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {confirmReset ? 'Confirmer la réinitialisation' : 'Réinitialiser les exemples'}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (done && compact) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'} font-bold text-emerald-700`}>
        <CheckCircle2 className="h-4 w-4" />
        <span>Données exemples chargées</span>
      </div>
    );
  }

  if (compact || variant === 'compact') {
    return (
      <>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        <button
          type="button"
          onClick={loadDemo}
          disabled={loading || demoPresent}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-brand-800 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Chargement...' : demoPresent ? 'Exemples deja charges' : 'Remplir avec des exemples'}
        </button>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-lg shadow-emerald-900/15">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-slate-950">
              {isIndividualOwner ? 'Explorer avec des exemples proprietaire' : 'Explorer avec des exemples agence'}
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              {isIndividualOwner
                ? 'Ajoute un bien, des unites, des locataires, des baux et des paiements exemples sans vous demander de selectionner un bailleur.'
                : 'Ajoute un bailleur, un bien, trois unites, deux locataires, deux contrats et deux paiements pour explorer sans repartir de zero.'}
            </p>
            <button
              type="button"
              onClick={loadDemo}
              disabled={loading || demoPresent}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-brand-950 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Chargement en cours...' : demoPresent ? 'Exemples deja charges' : 'Remplir avec des exemples'}
            </button>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3">
              {confirmReset && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Cette action supprimera uniquement les exemples generes par Samay Keur. Vos vraies donnees ne seront pas supprimees.</span>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  Besoin de repartir proprement ? Le reset supprime uniquement les lignes marquees comme exemples et conserve la fin du wizard.
                </p>
                <button
                  type="button"
                  onClick={() => void resetDemo()}
                  disabled={resetting || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {confirmReset ? 'Supprimer les exemples' : 'Réinitialiser les exemples'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
