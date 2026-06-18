import { Check } from 'lucide-react';

interface FinanceWizardStep {
  id: number;
  label: string;
  description: string;
}

interface FinanceWizardStepperProps {
  currentStep: number;
  steps: FinanceWizardStep[];
}

export function FinanceWizardStepper({ currentStep, steps }: FinanceWizardStepperProps) {
  return (
    <nav aria-label="Progression" className="rounded-2xl border border-emerald-950/10 bg-white/90 p-3 shadow-sm">
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((step) => {
          const isCurrent = step.id === currentStep;
          const isComplete = step.id < currentStep;

          return (
            <li key={step.id} className="min-w-0" aria-current={isCurrent ? 'step' : undefined}>
              <div
                className={`flex min-h-[3.5rem] items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors sm:px-3 ${
                  isCurrent
                    ? 'border-emerald-800 bg-emerald-950 text-white shadow-sm'
                    : isComplete
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    isCurrent
                      ? 'bg-white text-emerald-950'
                      : isComplete
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : step.id}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-black uppercase tracking-[0.08em] sm:text-xs">
                    {step.label}
                  </span>
                  <span className={`mt-0.5 hidden truncate text-[10px] font-semibold sm:block ${isCurrent ? 'text-white/70' : 'text-current/70'}`}>
                    {step.description}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
