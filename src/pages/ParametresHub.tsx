import { useState, useEffect, lazy, Suspense } from 'react';
import { Building, UserPlus, CreditCard } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { BrandMark } from '../components/brand/BrandLogo';
import { LoadingState } from '../components/ui/LoadingState';

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

const PageLoader = () => <LoadingState label="Paramètres" compact />;

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
    <div className="flex h-full flex-col bg-brand-paper">
      <div className="relative overflow-hidden border-b border-emerald-950/10 bg-brand-surface/90 px-4 pt-4 backdrop-blur-xl sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <div className="pointer-events-none absolute right-6 top-4 opacity-[0.045]">
          <BrandMark size="xl" tone="light" withTile={false} />
        </div>
        <div className="relative mb-3">
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-emerald-950/10 bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-brand-800">
            <BrandMark size="xs" tone="light" />
            Centre de contrôle
          </div>
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
