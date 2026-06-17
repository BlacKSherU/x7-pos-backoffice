import { describe, expect, it, afterEach } from 'vitest';
import { saasService, setSimulateApiFailure } from './saasService';

describe('saasService.getSubscriptionPlans', () => {
  afterEach(() => {
    setSimulateApiFailure(false);
  });

  it('returns an array with at least one plan', async () => {
    const plans = await saasService.getSubscriptionPlans();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
  });

  it('each plan has all required SubscriptionPlan fields', async () => {
    const plans = await saasService.getSubscriptionPlans();
    const plan = plans[0];
    expect(typeof plan.id).toBe('string');
    expect(typeof plan.name).toBe('string');
    expect(typeof plan.description).toBe('string');
    expect(typeof plan.price).toBe('number');
    expect(typeof plan.billingCycle).toBe('string');
    expect(typeof plan.status).toBe('string');
  });

  it('includes both active and inactive plans', async () => {
    const plans = await saasService.getSubscriptionPlans();
    expect(plans.some((p) => p.status === 'active')).toBe(true);
    expect(plans.some((p) => p.status === 'inactive')).toBe(true);
  });

  it('includes plans with more than one distinct billingCycle', async () => {
    const plans = await saasService.getSubscriptionPlans();
    const cycles = new Set(plans.map((p) => p.billingCycle));
    expect(cycles.size).toBeGreaterThan(1);
  });
});
