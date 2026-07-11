import { PRICING_PLAN_DEFINITIONS, type PlanId } from '../pricingCatalog';

export type AdminPlanId = PlanId;

export const ADMIN_PLAN_DEFINITIONS = PRICING_PLAN_DEFINITIONS.map((plan, index) => ({
  ...plan,
  order: index,
  monthlyPrice: plan.price_xof,
  currency: 'XOF',
  status: plan.id === 'enterprise' ? 'contact' : 'active',
}));

export const ADMIN_PLAN_IDS = ADMIN_PLAN_DEFINITIONS.map((plan) => plan.id);

export const LEGACY_PLAN_ALIASES: Record<string, AdminPlanId> = {
  basic: 'starter',
  starter: 'starter',
  pro: 'pro',
  business: 'business',
  enterprise: 'enterprise',
};

export function normalizeAdminPlanId(planId: string | null | undefined): AdminPlanId {
  if (!planId) return 'starter';
  return LEGACY_PLAN_ALIASES[planId] ?? 'starter';
}

export function getAdminPlan(planId: string | null | undefined) {
  const normalized = normalizeAdminPlanId(planId);
  return ADMIN_PLAN_DEFINITIONS.find((plan) => plan.id === normalized) ?? ADMIN_PLAN_DEFINITIONS[0];
}

export function getAdminPlanPrice(planId: string | null | undefined) {
  return getAdminPlan(planId).price_xof;
}

