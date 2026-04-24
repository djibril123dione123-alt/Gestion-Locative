import React from 'react';
import { Lock, ArrowUpRight } from 'lucide-react';

interface PlanGateProps {
  allowed: boolean;
  featureName: string;
  onUpgrade?: () => void;
  children: React.ReactNode;
}

export function PlanGate({ allowed, featureName, onUpgrade, children }: PlanGateProps) {
  if (allowed) return <>{children}</>;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 my-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
          <Lock className="w-6 h-6" style={{ color: '#F58220' }} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{featureName} indisponible</p>
          <p className="text-sm text-slate-600 mt-1">
            Cette fonctionnalité nécessite le plan Pro. Passez au plan supérieur pour y accéder.
          </p>
        </div>
        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            data-testid="button-upgrade-plan"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold whitespace-nowrap transition hover:opacity-90"
            style={{ backgroundColor: '#F58220' }}
          >
            Passer au Pro
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
