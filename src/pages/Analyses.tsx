import { lazy, Suspense } from 'react';
import { PageSkeleton } from '../components/ui/Skeleton';

const TableauDeBordFinancierGlobal = lazy(() =>
  import('./TableauDeBordFinancierGlobal').then((m) => ({ default: m.TableauDeBordFinancierGlobal })),
);

interface AnalysesProps {
  initialTab?: 'rapports' | 'filtres';
}

const PageLoader = () => <PageSkeleton title="Rapports" variant="analytics" className="p-4 sm:p-6" />;

export function Analyses(_props?: AnalysesProps) {
  void _props;
  return (
    <div className="bg-brand-paper">
      <Suspense fallback={<PageLoader />}>
        <TableauDeBordFinancierGlobal />
      </Suspense>
    </div>
  );
}

export default Analyses;
