import { useState, useEffect, lazy, Suspense } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { PageSkeleton } from '../components/ui/Skeleton';

const Paiements = lazy(() => import('./Paiements').then((m) => ({ default: m.Paiements })));
const LoyersImpayes = lazy(() => import('./LoyersImpayes').then((m) => ({ default: m.LoyersImpayes })));

interface EncaissementsProps {
  initialTab?: 'recus' | 'impayes';
}

const TABS = [
  { id: 'recus', label: 'Paiements reçus', icon: CreditCard },
  { id: 'impayes', label: 'Loyers impayés', icon: AlertCircle },
];

const PageLoader = () => <PageSkeleton title="Encaissements" variant="table" className="p-4 sm:p-6" />;

/**
 * Page "Encaissements" : fusion des anciennes pages Paiements + Loyers impayes.
 * Les deux faces d'un meme flux financier (ce qui est rentre / ce qui est du).
 * Garde les deux composants enfants intacts pour preserver leur logique metier.
 */
export function Encaissements({ initialTab = 'recus' }: EncaissementsProps) {
  const [active, setActive] = useState<'recus' | 'impayes'>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  return (
    <div className="bg-brand-paper">
      <div className="border-b border-emerald-950/10 bg-brand-paper/95 px-4 py-3 sm:px-6 lg:px-8">
        <Tabs
          tabs={TABS}
          activeId={active}
          onChange={(id) => setActive(id as 'recus' | 'impayes')}
          className="max-w-full"
        />
      </div>

      <div>
        <Suspense fallback={<PageLoader />}>
          <TabPanel>
            {active === 'recus' ? <Paiements embedded /> : <LoyersImpayes embedded />}
          </TabPanel>
        </Suspense>
      </div>
    </div>
  );
}

export default Encaissements;
