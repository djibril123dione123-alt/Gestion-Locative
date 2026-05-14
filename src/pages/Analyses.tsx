import { useState, useEffect, lazy, Suspense } from 'react';
import { BarChart3, Filter } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';
import { BrandMark } from '../components/brand/BrandLogo';
import { PageSkeleton } from '../components/ui/Skeleton';

const TableauDeBordFinancierGlobal = lazy(() =>
  import('./TableauDeBordFinancierGlobal').then((m) => ({ default: m.TableauDeBordFinancierGlobal })),
);
const FiltresAvances = lazy(() =>
  import('./FiltresAvances').then((m) => ({ default: m.FiltresAvances })),
);

interface AnalysesProps {
  initialTab?: 'rapports' | 'filtres';
}

const TABS = [
  { id: 'rapports', label: 'Rapports financiers', icon: BarChart3 },
  { id: 'filtres', label: 'Filtres avancés', icon: Filter },
];

const PageLoader = () => <PageSkeleton title="Analyses" variant="analytics" className="p-4 sm:p-6" />;

/**
 * Page « Analyses & rapports » : fusion Rapports financiers + Filtres avancés.
 * Toutes les vues analytiques regroupées au même endroit.
 */
export function Analyses({ initialTab = 'rapports' }: AnalysesProps) {
  const [active, setActive] = useState<'rapports' | 'filtres'>(initialTab);

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
            Pilotage financier
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800">Analyses</h1>
          <p className="text-slate-500 text-sm mt-1">Rapports financiers et exploration avancée des données</p>
        </div>
        <Tabs tabs={TABS} activeId={active} onChange={(id) => setActive(id as 'rapports' | 'filtres')} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          <TabPanel>
            {active === 'rapports' ? <TableauDeBordFinancierGlobal /> : <FiltresAvances />}
          </TabPanel>
        </Suspense>
      </div>
    </div>
  );
}

export default Analyses;
