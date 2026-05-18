import { lazy, Suspense } from 'react';
import { BrandMark } from '../components/brand/BrandLogo';
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
    <div className="flex h-full flex-col bg-brand-paper">
      <div className="relative overflow-hidden border-b border-emerald-950/10 bg-brand-surface/90 px-4 pt-4 backdrop-blur-xl sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <div className="pointer-events-none absolute right-6 top-4 opacity-[0.045]">
          <BrandMark size="xl" tone="light" withTile={false} />
        </div>
        <div className="relative mb-4">
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-emerald-950/10 bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-brand-800">
            <BrandMark size="xs" tone="light" />
            Pilotage financier
          </div>
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl lg:text-4xl">Rapports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Synthèse financière, performance du patrimoine et rapports bailleurs.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          <TableauDeBordFinancierGlobal />
        </Suspense>
      </div>
    </div>
  );
}

export default Analyses;
