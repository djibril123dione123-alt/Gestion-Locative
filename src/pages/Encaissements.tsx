import { useState, useEffect, lazy, Suspense } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { BrandMark } from '../components/brand/BrandLogo';
import { LoadingState } from '../components/ui/LoadingState';

const Paiements = lazy(() => import('./Paiements').then((m) => ({ default: m.Paiements })));
const LoyersImpayes = lazy(() => import('./LoyersImpayes').then((m) => ({ default: m.LoyersImpayes })));

interface EncaissementsProps {
  initialTab?: 'recus' | 'impayes';
}

const TABS = [
  { id: 'recus', label: 'Paiements reçus', icon: CreditCard },
  { id: 'impayes', label: 'Loyers impayés', icon: AlertCircle },
];

const PageLoader = () => <LoadingState label="Encaissements" compact />;

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
      <div className="relative overflow-hidden border-b border-emerald-950/10 bg-brand-surface/90 px-4 pt-4 backdrop-blur-xl sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <div className="pointer-events-none absolute right-6 top-4 opacity-[0.045]">
          <BrandMark size="xl" tone="light" withTile={false} />
        </div>
        <div className="relative mb-3">
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-action-500/15 bg-action-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-action-700">
            <BrandMark size="xs" tone="light" />
            Flux financiers
          </div>
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
