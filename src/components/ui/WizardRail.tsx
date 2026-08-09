import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';
import type { WizardStep } from './WizardShell';

interface WizardRailProps {
  eyebrow: string;
  subtitle?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  steps?: WizardStep[];
  currentStep?: number;
  children?: ReactNode;
  footer?: ReactNode;
}

export function WizardRail({
  eyebrow,
  subtitle,
  title,
  description,
  badge,
  steps = [],
  currentStep = 0,
  children,
  footer,
}: WizardRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div className="min-w-0">
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">{eyebrow}</p>
          {subtitle && <p className="mt-0.5 truncate text-[0.6rem] font-semibold text-white/[0.56]">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-3">
        <h3 className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">{title}</h3>
        {description && <p className="mt-1 max-w-[11rem] text-[0.6rem] font-medium leading-snug text-emerald-50/[0.56]">{description}</p>}
      </div>

      {badge && <div className="mt-2">{badge}</div>}

      {steps.length > 0 && (
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar-sm">
          <ol className="relative space-y-1" aria-label="Étapes du formulaire">
            {steps.map((step, index) => {
              const complete = index < currentStep;
              const active = index === currentStep;
              return (
                <li
                  key={step.id}
                  className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${
                    active
                      ? 'border-amber-100/16 bg-white/[0.038] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]'
                      : complete
                        ? 'border-white/10 bg-emerald-300/[0.038] text-emerald-50/[0.78]'
                        : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'
                  }`}
                >
                  <span className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${active ? 'bg-[#fff3ce]/94 text-emerald-950 ring-1 ring-amber-100/55' : complete ? 'bg-emerald-300/[0.12] text-emerald-50' : 'bg-white/[0.1] text-emerald-50/[0.84]'}`}>
                    {complete ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">Étape {index + 1}</span>
                    <span className="block truncate text-[0.67rem] font-semibold">{step.shortLabel || step.label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {children && <div className="mt-3 space-y-2 shrink-0">{children}</div>}
      {footer && (
        <div className="mt-4 shrink-0 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
          <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">Source de vérité</p>
          <div className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">{footer}</div>
        </div>
      )}
    </div>
  );
}
