import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ProductWizardStep<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

/**
 * Controlled wizard for multi-step product flows.
 *
 * Critical usage rules:
 * 1. Children must not include their own `<form onSubmit={...}>`.
 * 2. The intermediate "Continuer" action is always a plain button.
 * 3. `onFinalSubmit` is only reachable from the last step.
 * 4. Premature creation before the summary screen is impossible from this component.
 */
interface ProductWizardProps<T extends string> {
  steps: Array<ProductWizardStep<T>>;
  activeStep: T;
  onStepChange: (step: T) => void;
  children: ReactNode;
  onFinalSubmit: () => void;
  finalSubmitLabel: string;
  onCancel: () => void;
  isSubmitting?: boolean;
  onNextStep?: (currentStep: T) => boolean;
}

export function ProductWizard<T extends string>({
  steps,
  activeStep,
  onStepChange,
  children,
  onFinalSubmit,
  finalSubmitLabel,
  onCancel,
  isSubmitting = false,
  onNextStep,
}: ProductWizardProps<T>) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const active = steps[currentIndex] ?? steps[0];
  const progress = steps.length > 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;
  const ActiveIcon = active?.icon;
  const desktopStepperClass = steps.length >= 4
    ? 'hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4'
    : 'hidden gap-2 sm:grid sm:grid-cols-3';

  const isFirst = currentIndex === 0;
  const isFinal = currentIndex === steps.length - 1;

  const goNext = () => {
    if (isFinal) return;
    if (onNextStep && !onNextStep(activeStep)) {
      return;
    }
    const nextStep = steps[currentIndex + 1];
    if (nextStep) onStepChange(nextStep.id);
  };

  const submitFinal = () => {
    if (!isFinal || isSubmitting) return;
    onFinalSubmit();
  };

  const goPrevious = () => {
    const prevStep = steps[currentIndex - 1];
    if (prevStep) onStepChange(prevStep.id);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-emerald-950/10 bg-[#fffaf1]/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center gap-3 sm:hidden">
          {ActiveIcon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-950 text-white shadow-sm">
              <ActiveIcon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-action-600">
                Étape {currentIndex + 1} sur {steps.length}
              </p>
              <p className="truncate text-xs font-black text-brand-950">{active?.label}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-950/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-900 to-action-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className={desktopStepperClass}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const activeStepItem = step.id === activeStep;
            const done = index < currentIndex;
            const clickable = index <= currentIndex;

            return (
              <button
                key={step.id}
                type="button"
                disabled={!clickable || isSubmitting}
                onClick={() => clickable && onStepChange(step.id)}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  activeStepItem
                    ? 'border-emerald-300 bg-white text-brand-950 shadow-sm ring-1 ring-emerald-100'
                    : done
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                      : 'border-transparent bg-white/55 text-slate-500'
                } ${clickable ? 'hover:border-emerald-200 hover:bg-white' : 'cursor-default'}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  activeStepItem
                    ? 'bg-brand-900 text-white'
                    : done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.64rem] font-black uppercase tracking-[0.1em] opacity-65">
                    Étape {index + 1}
                  </span>
                  <span className="block truncate text-sm font-black">{step.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-[12rem] sm:min-h-[14rem]">{children}</div>
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-emerald-950/10 bg-[#fffdf8]/95 px-4 py-2.5 shadow-[0_-14px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:-mx-5 sm:px-5 sm:py-3">
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            type="button"
            onClick={isFirst ? onCancel : goPrevious}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isFirst ? 'Annuler' : 'Retour'}
          </button>
          <button
            type="button"
            onClick={isFinal ? submitFinal : goNext}
            disabled={isSubmitting}
            className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 ${
              isFinal
                ? 'bg-gradient-to-br from-brand-950 to-emerald-900 shadow-emerald-950/20 hover:-translate-y-0.5 hover:shadow-emerald-950/25'
                : 'bg-emerald-700 shadow-emerald-900/10 hover:bg-emerald-800'
            }`}
          >
            {isSubmitting ? 'Traitement...' : isFinal ? finalSubmitLabel : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  );
}
