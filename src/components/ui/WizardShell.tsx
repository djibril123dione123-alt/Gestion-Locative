import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';

export type WizardSize = "compact" | "simple" | "standard" | "rich" | "business";
export type WizardVariant = "classic" | "workstation";
export type WizardTone = "agency" | "owner" | "finance" | "documents";
export type WizardMobileMode = "sheet" | "fullscreen";
export type WizardStepStatus = "active" | "complete" | "future";

export type WizardStep = {
  id: string | number;
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
  variant?: WizardVariant;
  tone?: WizardTone;
  rail?: React.ReactNode;
  stepContext?: React.ReactNode;
  contentTitle?: React.ReactNode;
  contentDescription?: React.ReactNode;
  mobileMode?: WizardMobileMode;
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
  compact: 'sm:w-[min(92vw,580px)] sm:max-w-[580px]',
  simple: 'sm:w-[min(92vw,720px)] sm:max-w-[720px]',
  standard: 'sm:w-[min(92vw,860px)] sm:max-w-[860px]',
  rich: 'sm:max-w-[1040px]',
  business: 'sm:max-w-[1120px]',
};

const toneAccent: Record<WizardTone, string> = {
  agency: 'from-emerald-600 to-amber-500',
  owner: 'from-emerald-700 to-amber-500',
  finance: 'from-emerald-600 to-cyan-500',
  documents: 'from-amber-600 to-emerald-600',
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
  variant = 'classic',
  tone = 'agency',
  rail,
  stepContext,
  contentTitle,
  contentDescription,
  mobileMode = 'sheet',
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

  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const hasActions = primaryAction || secondaryAction;
  const showFooter = footer || hasActions;
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;
  const currentStepData = steps[currentStep] || steps[0];
  const isWorkstation = variant === 'workstation';
  const hasRail = isWorkstation && !!rail;
  const shouldShowDesktopStepper = steps.length > 0 && !hasRail;
  const isFullscreenMobile = isWorkstation && mobileMode === 'fullscreen';

  const panelClasses = isWorkstation
    ? `relative flex w-full flex-col overflow-hidden border border-emerald-950/10 bg-[#f8f3e8]/95 shadow-[0_30px_96px_rgba(6,17,13,0.2)] ring-1 ring-white/60 ${
        isFullscreenMobile ? 'min-h-dvh rounded-none' : 'max-h-[91dvh] rounded-t-[1.35rem]'
      } sm:max-h-[min(680px,calc(100vh-36px))] sm:w-[min(92vw,920px)] sm:max-w-[920px] sm:rounded-[1.6rem] ${
        hasRail ? 'sm:grid sm:grid-cols-[minmax(11.75rem,0.53fr)_minmax(0,1.47fr)]' : ''
      } ${panelClassName}`
    : `sk-premium-panel flex w-full flex-col sm:w-[90vw] ${sizeClasses[size] || sizeClasses.standard} rounded-t-[1.5rem] sm:rounded-t-[1.35rem] sm:rounded-[1.35rem] max-h-[94dvh] sm:max-h-[calc(100vh-48px)] ${panelClassName}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={titleId}
      className={`fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center sm:p-4 ${className}`}
    >
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={panelClasses}>
        {!isFullscreenMobile && (
          <div className="absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300/80 sm:hidden" />
        )}

        {hasRail && (
          <aside className="relative hidden min-h-0 overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_22%_8%,rgba(251,191,36,0.085),transparent_24%),radial-gradient(circle_at_8%_100%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,#05261d_0%,#073728_52%,#041812_100%)] p-3.5 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.11),inset_-14px_0_30px_rgba(4,24,18,0.13)] sm:flex sm:flex-col">
            {rail}
            <span className="pointer-events-none absolute inset-y-3 right-0 w-px bg-gradient-to-b from-white/18 via-emerald-100/22 to-white/10" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-y-0 right-0 w-10 translate-x-8 bg-gradient-to-r from-emerald-950/18 to-transparent" aria-hidden="true" />
          </aside>
        )}

        <div className={isWorkstation ? 'flex min-h-0 flex-col overflow-hidden' : 'flex min-h-0 flex-1 flex-col overflow-hidden'}>
          <div
            className={
              isWorkstation
                ? 'shrink-0 border-b border-emerald-950/10 bg-[#fffdf8]/94 px-4 pb-1.5 pt-3 sm:px-4 sm:pb-2.5 sm:pt-[0.8125rem]'
                : 'shrink-0 border-b border-emerald-950/10 bg-[#fcfaf6]/80 px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6'
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-amber-700">
                    {eyebrow}
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  <div className={isWorkstation ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white/70 shadow-sm' : 'flex shrink-0 items-center justify-center'}>
                    <BrandMark
                      size="xs"
                      tone="dark"
                      animated
                      withTile={false}
                      className={isWorkstation ? 'h-[21px] w-[21px] sm:h-[22px] sm:w-[22px]' : 'h-[22px] w-[22px] sm:h-[26px] sm:w-[26px]'}
                    />
                  </div>
                  <h2 id={titleId} className="truncate text-[0.92rem] font-semibold leading-tight text-slate-950 sm:text-[1.02rem]">
                    {contentTitle || title}
                  </h2>
                </div>
                {(contentDescription || description) && (
                  <p className="mt-0.5 hidden max-w-[29rem] text-[0.7rem] font-medium text-slate-500 line-clamp-1 sm:block">
                    {contentDescription || description}
                  </p>
                )}
                {(mobileDescription || description) && (
                  <p className="mt-1 text-[0.67rem] font-medium text-slate-500 line-clamp-1 sm:hidden">
                    {mobileDescription || description}
                  </p>
                )}
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className={isWorkstation ? 'shrink-0 rounded-lg border border-emerald-950/10 bg-white/60 p-1.5 text-slate-400 shadow-[0_1px_3px_rgba(15,23,42,0.035)] transition-colors hover:bg-white hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] sm:p-1.5' : 'shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'}
                >
                  <X className={isWorkstation ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </button>
              )}
            </div>

            {steps.length > 0 && (
              <div className={isWorkstation ? 'mt-2 sm:mt-4' : 'mt-2.5 sm:mt-4'}>
                <div className="sm:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-500">
                      Étape {currentStep + 1} sur {steps.length}
                    </p>
                    <p className="truncate text-[0.72rem] font-semibold text-slate-800">
                      {currentStepData?.shortLabel || currentStepData?.label}
                    </p>
                  </div>
                  <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${toneAccent[tone]} transition-all duration-300`}
                      {...{ style: { width: `${progress}%` } }}
                    />
                  </div>
                </div>

                {shouldShowDesktopStepper && (
                  <div className="hidden grid-cols-1 gap-2 sm:grid md:grid-cols-3 lg:grid-cols-auto-fit">
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
                          className={`relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                            isActive
                              ? 'border border-emerald-400/40 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400/20'
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
                            <p className={`truncate text-[0.72rem] font-semibold ${isFuture ? 'text-slate-500' : 'text-slate-800'}`}>
                              {step.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`min-h-0 overflow-y-auto px-3.5 py-2.5 sm:px-4 sm:py-3.5 ${isWorkstation ? 'bg-[#fffdf8]' : 'flex-1 bg-white'} ${bodyClassName}`}>
            {stepContext && (
              <div className="mb-2 rounded-lg border border-l-2 border-emerald-950/10 border-l-emerald-700/18 bg-[#fffdf8]/82 px-2 py-1.5 text-[0.73rem] font-medium leading-snug text-slate-600 shadow-[0_5px_12px_rgba(15,23,42,0.016)] sm:mb-2.5 sm:rounded-xl sm:px-2.5 sm:py-[0.45rem] sm:text-[0.67rem]">
                {stepContext}
              </div>
            )}
            {children}
          </div>

          {showFooter && (
            <div
              className={`shrink-0 border-t border-emerald-950/5 ${isWorkstation ? 'bg-[#fffdf8]/95' : 'bg-white/95'} px-3.5 py-1.5 pb-[max(env(safe-area-inset-bottom,10px),10px)] sm:px-4 sm:py-2 sm:pb-2 ${footerClassName}`}
            >
              {footer ? (
                footer
              ) : (
                <div className={`flex flex-col-reverse gap-2 sm:flex-row sm:items-center ${isWorkstation && steps.length > 0 ? 'sm:justify-between' : 'sm:justify-end'}`}>
                  {isWorkstation && steps.length > 0 && (
                    <p className="hidden text-[0.68rem] font-semibold text-slate-500 sm:block">
                      Étape {currentStep + 1} sur {steps.length} · {currentStepData?.label}
                    </p>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    {secondaryAction && <div className="w-full sm:w-auto [&_button]:h-10 [&_button]:w-full [&_button]:font-semibold [&_button]:sm:h-9 [&_button]:sm:w-auto">{secondaryAction}</div>}
                    {primaryAction && <div className="w-full sm:w-auto [&_button]:h-11 [&_button]:w-full [&_button]:font-semibold [&_button]:sm:h-9 [&_button]:sm:w-auto">{primaryAction}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
