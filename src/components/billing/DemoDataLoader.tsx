import { useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';
import { createPaiementViaEdge } from '../../services/api/paiementApi';
import { getOrCreateIndividualOwnerBailleur } from '../../services/individualOwner';
import { ToastContainer } from '../ui/Toast';

interface DemoDataLoaderProps {
  onLoaded?: () => void;
  compact?: boolean;
}

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

export function DemoDataLoader({ onLoaded, compact = false }: DemoDataLoaderProps) {
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const loadDemo = async () => {
    if (!profile?.agency_id) return;
    setLoading(true);

    try {
      const agencyId = profile.agency_id;

      const { count: existingCount } = await supabase
        .from('immeubles')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId);

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
              .insert({ ...DEMO_DATA.bailleur, agency_id: agencyId })
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
        .insert({ ...DEMO_DATA.immeuble, agency_id: agencyId, bailleur_id: bailleur.id })
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
          })),
        )
        .select('id, loyer_base');
      if (unitesError) throw unitesError;
      if (!unites || unites.length < 2) throw new Error('Les unites de demo n ont pas pu etre creees.');

      const { data: locataires, error: locatairesError } = await supabase
        .from('locataires')
        .insert(DEMO_DATA.locataires.map((locataire) => ({ ...locataire, agency_id: agencyId })))
        .select('id');
      if (locatairesError) throw locatairesError;
      if (!locataires || locataires.length < 2) throw new Error('Les locataires de demo n ont pas pu etre crees.');

      const today = new Date().toISOString().split('T')[0];
      const contratsData = [
        {
          agency_id: agencyId,
          unite_id: unites[0].id,
          locataire_id: locataires[0].id,
          loyer_mensuel: DEMO_DATA.unites[0].loyer_base,
          commission: commissionRate,
          date_debut: today,
          statut: 'actif',
        },
        {
          agency_id: agencyId,
          unite_id: unites[1].id,
          locataire_id: locataires[1].id,
          loyer_mensuel: DEMO_DATA.unites[1].loyer_base,
          commission: commissionRate,
          date_debut: today,
          statut: 'actif',
        },
      ];

      const { data: contrats, error: contratsError } = await supabase
        .from('contrats')
        .insert(contratsData)
        .select('id');
      if (contratsError) throw contratsError;
      if (!contrats || contrats.length < 2) throw new Error('Les contrats de demo n ont pas pu etre crees.');

      const { error: updateUnitesError } = await supabase
        .from('unites')
        .update({ statut: 'loue' })
        .in('id', [unites[0].id, unites[1].id]);
      if (updateUnitesError) throw updateUnitesError;

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
        }),
      ]);

      const paiementFailures = paiementResults.filter((result) => result.status === 'rejected');
      if (paiementFailures.length > 0) {
        console.warn('[DemoDataLoader] paiements demo partiellement indisponibles', paiementFailures);
      }

      const { error: demoFlagError } = await supabase
        .from('agencies')
        .update({ demo_data_loaded: true })
        .eq('id', agencyId);
      if (demoFlagError) {
        console.warn('[DemoDataLoader] demo_data_loaded flag skipped', demoFlagError.message);
      }

      setDone(true);
      if (paiementFailures.length > 0) {
        toast.warning(
          isIndividualOwner
            ? 'Exemples proprietaire charges sans paiements automatiques. Vous pouvez continuer et enregistrer un premier loyer.'
            : 'Donnees exemples chargees sans paiements automatiques. Vous pouvez continuer depuis Encaissements.',
        );
      } else {
        toast.success(
          isIndividualOwner
            ? 'Exemples proprietaire charges. Vous pouvez explorer votre espace tout de suite.'
            : 'Donnees exemples chargees. Vous pouvez explorer le produit tout de suite.',
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

  if (done) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'} font-bold text-emerald-700`}>
        <CheckCircle2 className="h-4 w-4" />
        <span>Donnees exemples chargees</span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        <button
          type="button"
          onClick={loadDemo}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-brand-800 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Chargement...' : 'Remplir avec des exemples'}
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
            <h3 className="font-black text-slate-950">Remplir avec des donnees exemples</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              {isIndividualOwner
                ? 'Ajoute vos premiers biens, unites, locataires, contrats et paiements exemples, sans selection manuelle de bailleur.'
                : 'Ajoute un bailleur, un immeuble, trois unites, deux locataires, deux contrats et deux paiements pour explorer sans repartir de zero.'}
            </p>
            <button
              type="button"
              onClick={loadDemo}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-brand-950 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Chargement en cours...' : 'Remplir avec des exemples'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
