import { useState, useEffect, lazy, Suspense } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { BrandMark } from '../components/brand/BrandLogo';
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
    <div className="flex h-full flex-col bg-brand-paper">
      <div className="relative overflow-hidden border-b border-emerald-950/10 bg-brand-surface/90 px-4 pt-3 backdrop-blur-xl sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <div className="pointer-events-none absolute right-6 top-4 hidden opacity-[0.045] sm:block">
          <BrandMark size="xl" tone="light" withTile={false} />
        </div>
        <div className="relative mb-0 sm:mb-3">
          <div className="mb-2 hidden items-center gap-2 rounded-lg border border-action-500/15 bg-action-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-action-700 sm:inline-flex">
            <BrandMark size="xs" tone="light" />
            Flux financiers
          </div>
          <h1 className="hidden text-3xl font-black text-slate-950 sm:block lg:text-4xl">Encaissements</h1>
          <p className="mt-1 hidden text-sm text-slate-500 sm:block">Suivi des loyers reçus et des impayés</p>
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
