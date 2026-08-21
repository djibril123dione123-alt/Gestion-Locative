import { describe, expect, it } from 'vitest';
import { resolveEffectivePlanLimits, STARTER_PLAN_ID } from '../usePlanLimits';

describe('resolveEffectivePlanLimits', () => {
  it('falls back to the starter plan for an individual owner with no paid subscription', () => {
    const result = resolveEffectivePlanLimits(true, false, { max_users: -1, max_immeubles: -1, max_unites: -1, plan: 'pro' });
    expect(result.plan).toBe(STARTER_PLAN_ID);
    expect(result).toEqual({ max_users: 1, max_immeubles: 3, max_unites: 10, plan: 'starter' });
  });

  it('never falls back to a phantom plan id such as "basic"', () => {
    // Regression : usePlanLimits.ts comparait auparavant a 'basic', un id qui
    // n'existe ni dans subscription_plans ni dans le catalogue frontend — un
    // bailleur individuel sans abonnement payant recevait alors silencieusement
    // les limites illimitees du plan par defaut au lieu des limites starter.
    const result = resolveEffectivePlanLimits(true, false, null);
    expect(result.plan).not.toBe('basic');
    expect(result.plan).toBe('starter');
  });

  it('trusts the server-provided limits once the individual owner has a paid subscription', () => {
    const serverLimits = { max_users: 5, max_immeubles: 20, max_unites: 100, plan: 'pro' };
    const result = resolveEffectivePlanLimits(true, true, serverLimits);
    expect(result).toBe(serverLimits);
  });

  it('trusts the server-provided limits for agency accounts regardless of subscription flag', () => {
    const serverLimits = { max_users: 15, max_immeubles: 100, max_unites: 500, plan: 'business' };
    const result = resolveEffectivePlanLimits(false, false, serverLimits);
    expect(result).toBe(serverLimits);
  });

  it('defaults to unlimited "pro" only when the server returns nothing for a non-individual account', () => {
    const result = resolveEffectivePlanLimits(false, false, null);
    expect(result).toEqual({ max_users: -1, max_immeubles: -1, max_unites: -1, plan: 'pro' });
  });
});
