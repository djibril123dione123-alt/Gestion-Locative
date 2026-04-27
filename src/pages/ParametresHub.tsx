import { useState, useEffect, lazy, Suspense } from 'react';
import { Building, UserPlus, CreditCard } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';

const Parametres = lazy(() => import('./Parametres').then((m) => ({ default: m.Parametres })));
const Equipe = lazy(() => import('./Equipe').then((m) => ({ default: m.Equipe })));
const Abonnement = lazy(() => import('./Abonnement').then((m) => ({ default: m.Abonnement })));

interface ParametresHubProps {
  initialTab?: 'agence' | 'equipe' | 'abonnement';
}

const TABS = [
  { id: 'agence', label: 'Mon agence', icon: Building },
  { id: 'equipe', label: 'Équipe', icon: UserPlus },
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
];

const PageLoader = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-200 border-t-orange-600" />
  </div>
);

/**
 * Page « Paramètres » consolidée : regroupe Mon agence (ex-Parametres),
 * Équipe et Abonnement sous des onglets — sortis du sidebar pour réduire
 * la charge cognitive (passage de 18 à 6 entrées top-level).
 */
export function ParametresHub({ initialTab = 'agence' }: ParametresHubProps) {
  const [active, setActive] = useState<'agence' | 'equipe' | 'abonnement'>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 bg-white border-b border-slate-200">
        <div className="mb-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800">Paramètres</h1>
          <p className="text-slate-500 text-sm mt-1">Configuration de l'agence, équipe et abonnement</p>
        </div>
        <Tabs
          tabs={TABS}
          activeId={active}
          onChange={(id) => setActive(id as 'agence' | 'equipe' | 'abonnement')}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          <TabPanel>
            {active === 'agence' && <Parametres />}
            {active === 'equipe' && <Equipe />}
            {active === 'abonnement' && <Abonnement />}
          </TabPanel>
        </Suspense>
      </div>
    </div>
  );
}

export default ParametresHub;
