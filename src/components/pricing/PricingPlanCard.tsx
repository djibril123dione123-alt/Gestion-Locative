import { ArrowRight, BarChart3, Building2, Check, Crown, DoorOpen, Users, Zap } from 'lucide-react';
import type { PlanId, PricingPlanDefinition } from '../../lib/pricingCatalog';

const PLAN_ICONS = {
  starter: Zap,
  pro: Building2,
  business: BarChart3,
  enterprise: Crown,
} satisfies Record<PlanId, typeof Zap>;

interface PricingPlanCardProps {
  plan: PricingPlanDefinition;
  onSelect: (plan: PricingPlanDefinition) => void;
}

export function PricingPlanCard({ plan, onSelect }: PricingPlanCardProps) {
  const Icon = PLAN_ICONS[plan.id];
  const isHighlighted = plan.highlighted === true;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-lg border p-4 transition duration-200 hover:-translate-y-0.5 sm:p-5 ${
        isHighlighted
          ? 'border-champagne/70 bg-emerald-950 text-white shadow-premium hover:shadow-premium-lg hover:border-champagne'
          : 'border-emerald-950/10 bg-white text-slate-950 shadow-sm hover:shadow-md'
      }`}
    >
      {isHighlighted && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(217,170,94,0.16),_transparent_60%)]"
          aria-hidden="true"
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
            isHighlighted ? 'bg-white/10 text-champagne-100' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
        {plan.badge && (
          <span
            className={`rounded-full px-2.5 py-1 text-[0.67rem] font-bold uppercase tracking-[0.08em] ${
              isHighlighted
                ? 'bg-gradient-to-r from-champagne-300 to-champagne text-emerald-950 shadow-sm'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {plan.badge}
          </span>
        )}
      </div>

      <p className={`mt-4 text-xs font-bold uppercase tracking-[0.08em] ${isHighlighted ? 'text-emerald-200' : 'text-emerald-800'}`}>
        {plan.audience}
      </p>
      <h3 className="mt-1 text-2xl font-black">{plan.name}</h3>
      <p className={`mt-2 text-sm leading-5 sm:min-h-[4.5rem] sm:leading-6 ${isHighlighted ? 'text-emerald-50/75' : 'text-slate-600'}`}>
        {plan.positioning}
      </p>

      <div className="mt-4 flex items-end gap-2 border-t border-current/10 pt-4 sm:mt-5 sm:pt-5">
        <strong className="text-2xl font-black">{plan.priceLabel}</strong>
        <span className={`pb-0.5 text-xs font-semibold ${isHighlighted ? 'text-emerald-100/70' : 'text-slate-500'}`}>
          {plan.billingLabel}
        </span>
      </div>

      <p className={`mt-2 text-sm font-semibold leading-5 sm:mt-3 ${isHighlighted ? 'text-white' : 'text-slate-800'}`}>
        {plan.outcome}
      </p>

      <div className={`mt-3 grid grid-cols-2 gap-2 rounded-lg p-2.5 sm:mt-4 sm:p-3 ${isHighlighted ? 'bg-white/[0.07]' : 'bg-slate-50'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Users className={`h-4 w-4 shrink-0 ${isHighlighted ? 'text-emerald-200' : 'text-emerald-700'}`} aria-hidden="true" />
          <span className={`truncate text-xs font-bold ${isHighlighted ? 'text-emerald-50/85' : 'text-slate-700'}`}>
            {plan.capacities.users}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <DoorOpen className={`h-4 w-4 shrink-0 ${isHighlighted ? 'text-emerald-200' : 'text-emerald-700'}`} aria-hidden="true" />
          <span className={`truncate text-xs font-bold ${isHighlighted ? 'text-emerald-50/85' : 'text-slate-700'}`}>
            {plan.capacities.unites}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 sm:mt-5 sm:space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm leading-5">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isHighlighted ? 'text-champagne-100' : 'text-emerald-700'}`} aria-hidden="true" />
            <span className={isHighlighted ? 'text-emerald-50/85' : 'text-slate-700'}>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5 sm:pt-6">
        <button
          type="button"
          onClick={() => onSelect(plan)}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isHighlighted
              ? 'bg-gradient-to-r from-champagne-300 to-champagne text-emerald-950 shadow-premium hover:from-champagne-100 hover:to-champagne-300 focus-visible:ring-champagne'
              : plan.id === 'enterprise'
                ? 'border border-emerald-900/20 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 focus-visible:ring-emerald-700'
                : 'bg-emerald-950 text-white hover:bg-emerald-900 focus-visible:ring-emerald-700'
          }`}
        >
          {plan.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className={`mt-3 text-center text-xs leading-5 ${isHighlighted ? 'text-emerald-100/65' : 'text-slate-500'}`}>
          {plan.bestFor}
        </p>
      </div>
    </article>
  );
}
