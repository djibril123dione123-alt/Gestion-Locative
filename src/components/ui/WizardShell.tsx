import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';

export type WizardSize = "compact" | "simple" | "standard" | "rich" | "business";
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

const sizeClasses: Record<WizardSize | 'compact', string> = {
  compact: 'sm:w-[min(92vw,660px)] sm:max-w-[660px]',
  simple: 'sm:w-[min(92vw,720px)] sm:max-w-[720px]',
  standard: 'sm:w-[min(92vw,860px)] sm:max-w-[860px]',
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

  if (!open || typeof document === 'undefined') return null;

  // Determine actual footer content
  const hasActions = primaryAction || secondaryAction;
  const showFooter = footer || hasActions;

  // Mobile stepper progress
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;
  const currentStepData = steps[currentStep] || steps[0];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={titleId}
      className={`fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center sm:p-4 ${className}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`sk-premium-panel flex w-full flex-col sm:w-[90vw] ${sizeClasses[size] || sizeClasses.standard} rounded-t-[1.5rem] sm:rounded-t-[1.35rem] sm:rounded-[1.35rem] max-h-[94dvh] sm:max-h-[calc(100vh-48px)] ${panelClassName}`}
      >
        {/* Mobile Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />

        {/* Header */}
        <div className="shrink-0 px-4 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-4 bg-white border-b border-emerald-950/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-amber-700">
                  {eyebrow}
                </p>
              )}
              <div className="flex items-center gap-2.5">
                <div className="flex shrink-0 items-center justify-center">
                  <img src="/brand/logo-sans-fond.png" alt="Samay Këur" className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] object-contain drop-shadow-sm" />
                </div>
                <h2 id={titleId} className="truncate text-[1.05rem] sm:text-[1.15rem] font-semibold text-slate-950 leading-tight">
                  {title}
                </h2>
              </div>
              {/* Desktop Description */}
              {description && (
                <p className="mt-1.5 hidden sm:block text-xs font-medium text-slate-500 line-clamp-2">
                  {description}
                </p>
              )}
              {/* Mobile Description */}
              {(mobileDescription || description) && (
                <p className="mt-1.5 sm:hidden text-[0.72rem] font-medium text-slate-500 line-clamp-2">
                  {mobileDescription || description}
                </p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Steppers */}
          {steps.length > 0 && (
            <div className="mt-4">
              {/* Mobile Stepper */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">
                    Étape {currentStep + 1} sur {steps.length}
                  </p>
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {currentStepData?.shortLabel || currentStepData?.label}
                  </p>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                    {...{ style: { width: `${progress}%` } }}
                  />
                </div>
              </div>

              {/* Desktop Stepper */}
              <div className="hidden sm:grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-auto-fit">
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
                      className={`relative flex items-center gap-2 rounded-lg py-1.5 px-2.5 transition-colors ${
                        isActive
                          ? 'bg-emerald-50/40 border border-emerald-400/40 ring-1 ring-emerald-400/20 shadow-sm'
                          : isComplete
                          ? 'border border-emerald-950/5 bg-slate-50/30'
                          : 'border border-transparent opacity-60'
                      }`}
                    >
                      <div
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                            : isComplete
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isComplete ? (
                          <Check className="h-3 w-3" />
                        ) : step.icon ? (
                          <span className="flex h-3 w-3 items-center justify-center">{step.icon}</span>
                        ) : (
                          <span className="text-[9px] font-bold">{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[0.56rem] font-semibold uppercase tracking-widest ${
                            isActive ? 'text-emerald-700' : isComplete ? 'text-emerald-600/80' : 'text-slate-400'
                          }`}
                        >
                          Étape {index + 1}
                        </p>
                        <p
                          className={`truncate text-[0.72rem] font-semibold ${
                            isFuture ? 'text-slate-500' : 'text-slate-800'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className={`flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div
            className={`shrink-0 border-t border-emerald-950/5 bg-white/95 sm:bg-[#fffdf8]/95 px-4 py-2.5 pb-[max(env(safe-area-inset-bottom,12px),12px)] sm:px-6 sm:py-2.5 ${footerClassName}`}
          >
            {footer ? (
              footer
            ) : (
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row sm:items-center">
                {secondaryAction && <div className="w-full sm:w-auto [&_button]:w-full [&_button]:sm:w-auto [&_button]:h-9 [&_button]:font-semibold">{secondaryAction}</div>}
                {primaryAction && <div className="w-full sm:w-auto [&_button]:w-full [&_button]:sm:w-auto [&_button]:h-9 [&_button]:font-semibold">{primaryAction}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
