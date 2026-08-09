import { ArrowRight, BarChart3, Building2, Check, Crown, Zap } from 'lucide-react';
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
      className={`flex h-full flex-col rounded-lg border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isHighlighted
          ? 'border-emerald-900 bg-emerald-950 text-white'
          : 'border-emerald-950/10 bg-white text-slate-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
            isHighlighted ? 'bg-white/10 text-emerald-200' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {plan.badge && (
          <span
            className={`rounded-full px-2.5 py-1 text-[0.67rem] font-bold uppercase tracking-[0.08em] ${
              isHighlighted ? 'bg-orange-400 text-emerald-950' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {plan.badge}
          </span>
        )}
      </div>

      <p className={`mt-5 text-xs font-bold uppercase tracking-[0.08em] ${isHighlighted ? 'text-emerald-200' : 'text-emerald-800'}`}>
        {plan.audience}
      </p>
      <h3 className="mt-1 text-2xl font-black">{plan.name}</h3>
      <p className={`mt-2 min-h-[4.5rem] text-sm leading-6 ${isHighlighted ? 'text-emerald-50/75' : 'text-slate-600'}`}>
        {plan.positioning}
      </p>

      <div className="mt-5 flex items-end gap-2 border-t border-current/10 pt-5">
        <strong className="text-2xl font-black">{plan.priceLabel}</strong>
        <span className={`pb-0.5 text-xs font-semibold ${isHighlighted ? 'text-emerald-100/70' : 'text-slate-500'}`}>
          {plan.billingLabel}
        </span>
      </div>

      <p className={`mt-3 text-sm font-semibold leading-5 ${isHighlighted ? 'text-white' : 'text-slate-800'}`}>
        {plan.outcome}
      </p>

      <ul className="mt-5 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm leading-5">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isHighlighted ? 'text-orange-300' : 'text-emerald-700'}`} aria-hidden="true" />
            <span className={isHighlighted ? 'text-emerald-50/85' : 'text-slate-700'}>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={() => onSelect(plan)}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${
            isHighlighted
              ? 'bg-orange-400 text-emerald-950 hover:bg-orange-300'
              : plan.id === 'enterprise'
                ? 'border border-emerald-900/20 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                : 'bg-emerald-950 text-white hover:bg-emerald-900'
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
