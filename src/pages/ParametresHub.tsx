import { useState, useEffect, lazy, Suspense } from 'react';
import { Building, UserPlus, CreditCard } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';

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

const PageLoader = () => <PageSkeleton title="Paramètres" variant="form" className="p-4 sm:p-6" />;

/**
 * Page "Parametres" consolidee : garde les onglets utiles sans ajouter un
 * second gros bandeau au-dessus des formulaires.
 */
export function ParametresHub({ initialTab = 'agence' }: ParametresHubProps) {
  const { accountProfile } = useAuth();
  const [active, setActive] = useState<'agence' | 'equipe' | 'abonnement'>(initialTab);
  const tabs = accountProfile.isIndividualOwner
    ? TABS.filter((tab) => tab.id !== 'equipe').map((tab) =>
        tab.id === 'agence' ? { ...tab, label: 'Mon compte' } : tab,
      )
    : TABS;

  useEffect(() => {
    setActive(accountProfile.isIndividualOwner && initialTab === 'equipe' ? 'agence' : initialTab);
  }, [accountProfile.isIndividualOwner, initialTab]);

  return (
    <div className="bg-brand-paper">
      <div className="border-b border-emerald-950/10 bg-brand-paper/95 px-4 py-3 sm:px-6 lg:px-8">
        <Tabs
          tabs={tabs}
          activeId={active}
          onChange={(id) => setActive(id as 'agence' | 'equipe' | 'abonnement')}
          className="max-w-full"
        />
      </div>

      <Suspense fallback={<PageLoader />}>
        <TabPanel>
          {active === 'agence' && <Parametres />}
          {active === 'equipe' && <Equipe />}
          {active === 'abonnement' && <Abonnement />}
        </TabPanel>
      </Suspense>
    </div>
  );
}

export default ParametresHub;
