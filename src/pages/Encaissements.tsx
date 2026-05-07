import { useState, useEffect, lazy, Suspense } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';

const Paiements = lazy(() => import('./Paiements').then((m) => ({ default: m.Paiements })));
const LoyersImpayes = lazy(() => import('./LoyersImpayes').then((m) => ({ default: m.LoyersImpayes })));

interface EncaissementsProps {
  initialTab?: 'recus' | 'impayes';
}

const TABS = [
  { id: 'recus', label: 'Paiements reçus', icon: CreditCard },
  { id: 'impayes', label: 'Loyers impayés', icon: AlertCircle },
];

const PageLoader = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-100 border-t-brand-700" />
  </div>
);

/**
 * Page « Encaissements » : fusion des anciennes pages Paiements + Loyers impayés.
 * Les deux faces d'un même flux financier (ce qui est rentré / ce qui est dû).
 * Garde les deux composants enfants intacts pour préserver leur logique métier.
 */
export function Encaissements({ initialTab = 'recus' }: EncaissementsProps) {
  const [active, setActive] = useState<'recus' | 'impayes'>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full bg-brand-paper">
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 bg-brand-surface/80 border-b border-emerald-950/10 backdrop-blur-xl">
        <div className="mb-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950">Encaissements</h1>
          <p className="text-slate-500 text-sm mt-1">Suivi des loyers reçus et des impayés</p>
        </div>
        <Tabs tabs={TABS} activeId={active} onChange={(id) => setActive(id as 'recus' | 'impayes')} />
      </div>

      <div className="flex-1 overflow-y-auto">
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
