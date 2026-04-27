import { useState, useEffect, lazy, Suspense } from 'react';
import { BarChart3, Filter } from 'lucide-react';
import { Tabs, TabPanel } from '../components/ui/Tabs';

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

const PageLoader = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-200 border-t-orange-600" />
  </div>
);

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
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 bg-white border-b border-slate-200">
        <div className="mb-3">
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
