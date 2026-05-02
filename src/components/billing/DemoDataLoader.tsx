/**
 * DemoDataLoader — charge des données de démonstration pour tester l'app
 * sans partir de zéro. Inséré dans le Dashboard et le SetupWizard.
 */
import { useState } from 'react';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/Toast';

interface DemoDataLoaderProps {
  onLoaded?: () => void;
  compact?: boolean;
}

const DEMO_DATA = {
  bailleur: { nom: 'Diop', prenom: 'Moussa', telephone: '770000001', email: 'moussa.diop@demo.com', commission: 10 },
  immeuble: { nom: 'Résidence Baobab', adresse: 'Rue 10, Almadies', quartier: 'Almadies', ville: 'Dakar', nombre_unites: 4 },
  unites: [
    { nom: 'Appartement 1A', type: 'appartement', etage: 1, surface_m2: 65, loyer_base: 200000 },
    { nom: 'Appartement 1B', type: 'appartement', etage: 1, surface_m2: 80, loyer_base: 250000 },
    { nom: 'Studio 2A', type: 'studio', etage: 2, surface_m2: 35, loyer_base: 120000 },
  ],
  locataires: [
    { nom: 'Sow', prenom: 'Fatou', telephone: '770000002', email: 'fatou.sow@demo.com' },
    { nom: 'Ndiaye', prenom: 'Ibrahima', telephone: '770000003', email: 'ibrahima.ndiaye@demo.com' },
  ],
};

export function DemoDataLoader({ onLoaded, compact = false }: DemoDataLoaderProps) {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const loadDemo = async () => {
    if (!profile?.agency_id) return;
    setLoading(true);

    try {
      const agencyId = profile.agency_id;

      // 1. Bailleur
      const { data: bailleur, error: e1 } = await supabase
        .from('bailleurs')
        .insert({ ...DEMO_DATA.bailleur, agency_id: agencyId })
        .select('id')
        .single();
      if (e1) throw e1;

      // 2. Immeuble
      const { data: immeuble, error: e2 } = await supabase
        .from('immeubles')
        .insert({ ...DEMO_DATA.immeuble, agency_id: agencyId, bailleur_id: bailleur.id })
        .select('id')
        .single();
      if (e2) throw e2;

      // 3. Unités
      const unitesData = DEMO_DATA.unites.map((u) => ({
        ...u,
        agency_id: agencyId,
        immeuble_id: immeuble.id,
        statut: 'libre',
      }));
      const { data: unites, error: e3 } = await supabase
        .from('unites')
        .insert(unitesData)
        .select('id');
      if (e3) throw e3;

      // 4. Locataires
      const locatairesData = DEMO_DATA.locataires.map((l) => ({
        ...l,
        agency_id: agencyId,
      }));
      const { data: locataires, error: e4 } = await supabase
        .from('locataires')
        .insert(locatairesData)
        .select('id');
      if (e4) throw e4;

      // 5. Contrats (2 contrats actifs)
      const today = new Date().toISOString().split('T')[0];
      const contratsData = [
        {
          agency_id: agencyId,
          unite_id: unites![0].id,
          locataire_id: locataires![0].id,
          loyer_mensuel: DEMO_DATA.unites[0].loyer_base,
          commission: 10,
          date_debut: today,
          statut: 'actif',
        },
        {
          agency_id: agencyId,
          unite_id: unites![1].id,
          locataire_id: locataires![1].id,
          loyer_mensuel: DEMO_DATA.unites[1].loyer_base,
          commission: 10,
          date_debut: today,
          statut: 'actif',
        },
      ];
      const { data: contrats, error: e5 } = await supabase
        .from('contrats')
        .insert(contratsData)
        .select('id');
      if (e5) throw e5;

      // 6. Marquer unités comme louées
      await supabase.from('unites').update({ statut: 'loue' }).in('id', [unites![0].id, unites![1].id]);

      // 7. Paiement de démonstration (mois courant) via Edge Function
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const loyer = DEMO_DATA.unites[0].loyer_base;
      await supabase.functions.invoke('create-paiement', {
        body: {
          contrat_id: contrats![0].id,
          montant_total: loyer,
          mois_concerne: currentMonth,
          date_paiement: today,
          mode_paiement: 'mobile_money',
          statut: 'paye',
          reference: 'DEMO-001',
        },
      });

      // 8. Marquer demo_data_loaded
      await supabase.from('agencies').update({ demo_data_loaded: true }).eq('id', agencyId);

      setDone(true);
      success('Données de démonstration chargées avec succès !');
      onLoaded?.();
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : 'Impossible de charger les données de démonstration.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'} text-emerald-700`}>
        <CheckCircle2 className="w-4 h-4" />
        <span>Données de démo chargées</span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <button
          onClick={loadDemo}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Chargement…' : 'Charger données de démo'}
        </button>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-purple-900 mb-1">Tester avec des données de démonstration</h3>
            <p className="text-sm text-purple-700 mb-4">
              Chargez un jeu de données réaliste — 1 bailleur, 1 immeuble, 3 unités, 2 locataires,
              2 contrats actifs et un premier paiement — pour explorer toutes les fonctionnalités sans saisie manuelle.
            </p>
            <button
              onClick={loadDemo}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Chargement en cours…' : 'Charger les données de démo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
