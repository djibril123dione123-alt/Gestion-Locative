import React, { useEffect, useId } from 'react';
import { X, Check } from 'lucide-react';

export type WizardSize = "simple" | "standard" | "rich" | "business";
export type WizardStepStatus = "active" | "complete" | "future";

export type WizardStep = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: React.ReactNode;
  status?: WizardStepStatus;
};

export type WizardShellProps = {
  open?: boolean;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  mobileDescription?: React.ReactNode;
  steps?: WizardStep[];
  currentStep?: number;
  size?: WizardSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  ariaLabel?: string;
  className?: string;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

const sizeClasses: Record<WizardSize, string> = {
  simple: 'sm:max-w-[720px]',
  standard: 'sm:max-w-[860px]',
  rich: 'sm:max-w-[1040px]',
  business: 'sm:max-w-[1120px]',
};

export function WizardShell({
  open = true,
  title,
  eyebrow = 'SAMAY KËUR',
  description,
  mobileDescription,
  steps = [],
  currentStep = 0,
  size = 'standard',
  children,
  footer,
  primaryAction,
  secondaryAction,
  onClose,
  closeLabel = 'Fermer',
  ariaLabel,
  className = '',
  panelClassName = '',
  bodyClassName = '',
  footerClassName = '',
}: WizardShellProps) {
  const dialogId = useId();
  const titleId = ariaLabel ? undefined : `${dialogId}-title`;

  // Handle Escape key
  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  // Determine actual footer content
  const hasActions = primaryAction || secondaryAction;
  const showFooter = footer || hasActions;

  // Mobile stepper progress
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;
  const currentStepData = steps[currentStep] || steps[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={titleId}
      className={`fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4 ${className}`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`relative flex w-full flex-col overflow-hidden bg-[#fbf9f4] shadow-2xl transition-transform sm:rounded-[1.5rem] sm:max-h-[calc(100vh-48px)] sm:w-[90vw] ${sizeClasses[size]} rounded-t-[1.75rem] max-h-[95vh] ${panelClassName}`}
      >
        {/* Mobile Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />

        {/* Header */}
        <div className="shrink-0 px-5 pt-8 pb-4 sm:px-8 sm:pt-8 sm:pb-5 bg-white border-b border-emerald-950/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.15em] text-action-600">
                  {eyebrow}
                </p>
              )}
              <h2 id={titleId} className="truncate text-xl sm:text-2xl font-black text-slate-900">
                {title}
              </h2>
              {/* Desktop Description */}
              {description && (
                <p className="mt-1.5 hidden sm:block text-sm font-semibold text-slate-500 line-clamp-2">
                  {description}
                </p>
              )}
              {/* Mobile Description */}
              {(mobileDescription || description) && (
                <p className="mt-1.5 sm:hidden text-sm font-semibold text-slate-500 line-clamp-2">
                  {mobileDescription || description}
                </p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Steppers */}
          {steps.length > 0 && (
            <div className="mt-6">
              {/* Mobile Stepper */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-action-600">
                    Étape {currentStep + 1} sur {steps.length}
                  </p>
                  <p className="truncate text-xs font-black text-brand-950">
                    {currentStepData?.shortLabel || currentStepData?.label}
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-950/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-900 to-action-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Desktop Stepper */}
              <div className="hidden sm:grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-auto-fit">
                {steps.map((step, index) => {
                  let effectiveStatus = step.status;
                  if (!effectiveStatus) {
                    if (index < currentStep) effectiveStatus = 'complete';
                    else if (index === currentStep) effectiveStatus = 'active';
                    else effectiveStatus = 'future';
                  }

                  const isActive = effectiveStatus === 'active';
                  const isComplete = effectiveStatus === 'complete';
                  const isFuture = effectiveStatus === 'future';

                  return (
                    <div
                      key={step.id}
                      className={`relative flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                        isActive
                          ? 'border-emerald-300 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-100'
                          : isComplete
                          ? 'border-emerald-100 bg-white'
                          : 'border-slate-100 bg-slate-50/50'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-brand-900 text-white'
                            : isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isComplete ? (
                          <Check className="h-4 w-4" />
                        ) : step.icon ? (
                          <span className="h-4 w-4 flex items-center justify-center">{step.icon}</span>
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[0.65rem] font-black uppercase tracking-[0.1em] ${
                            isActive ? 'text-action-600' : isComplete ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          Étape {index + 1}
                        </p>
                        <p
                          className={`truncate text-sm font-black ${
                            isFuture ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.description && (
                          <p className="truncate text-xs font-medium text-slate-500 mt-0.5">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 ${showFooter ? 'pb-24 sm:pb-24' : ''} ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div
            className={`absolute bottom-0 left-0 right-0 z-10 border-t border-emerald-950/10 bg-white/95 px-5 py-4 pb-[max(env(safe-area-inset-bottom,16px),16px)] sm:px-8 sm:py-5 backdrop-blur-md ${footerClassName}`}
          >
            {footer ? (
              footer
            ) : (
              <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row sm:items-center">
                {secondaryAction && <div className="w-full sm:w-auto">{secondaryAction}</div>}
                {primaryAction && <div className="w-full sm:w-auto">{primaryAction}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
