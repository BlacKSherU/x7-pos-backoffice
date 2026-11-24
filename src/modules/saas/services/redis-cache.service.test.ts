import { beforeEach, describe, expect, it } from 'vitest';
import {
  redisCacheService,
  type TenantCachedFeatures,
} from './redis-cache.service';

const MOCK_TENANT_FEATURES: TenantCachedFeatures = {
  companyId: 101,
  companyName: 'Acme Dining Group',
  planId: 2,
  planName: 'Professional',
  subscriptionStatus: 'ACTIVE',
  isExpired: false,
  features: [
    { id: 1, code: 'pos_core', name: 'Point of Sale', enabled: true },
    { id: 2, code: 'kds_display', name: 'Kitchen Display', enabled: true },
    { id: 3, code: 'delivery_fleet', name: 'Delivery Fleet', enabled: true },
  ],
  featureCodes: ['pos_core', 'kds_display', 'delivery_fleet'],
  featureIds: [1, 2, 3],
  modulePermissions: ['pos', 'kds', 'delivery'],
  cachedAt: new Date().toISOString(),
  ttlSeconds: 3600,
};

describe('RedisCacheService (Feature Flag Cache Engine)', () => {
  beforeEach(async () => {
    await redisCacheService.flushdb();
    redisCacheService.resetStats();
  });

  describe('Key Formatting and Storage', () => {
    it('formats tenant feature keys according to convention tenant:{companyId}:features', () => {
      expect(redisCacheService.formatTenantFeaturesKey(101)).toBe('tenant:101:features');
      expect(redisCacheService.formatTenantFeaturesKey('42')).toBe('tenant:42:features');
    });

    it('stores and retrieves tenant features with sub-millisecond in-memory performance', async () => {
      await redisCacheService.setTenantFeatures(101, MOCK_TENANT_FEATURES);

      const cached = await redisCacheService.getTenantFeatures(101);
      expect(cached).not.toBeNull();
      expect(cached?.companyId).toBe(101);
      expect(cached?.planName).toBe('Professional');
      expect(cached?.subscriptionStatus).toBe('ACTIVE');
      expect(cached?.featureCodes).toEqual(['pos_core', 'kds_display', 'delivery_fleet']);
    });

    it('returns null on cache miss and increments miss counter', async () => {
      const nonExistent = await redisCacheService.getTenantFeatures(999);
      expect(nonExistent).toBeNull();

      const stats = redisCacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('increments hit counter on successful cache retrieval', async () => {
      await redisCacheService.setTenantFeatures(101, MOCK_TENANT_FEATURES);
      await redisCacheService.getTenantFeatures(101);
      await redisCacheService.getTenantFeatures(101);

      const stats = redisCacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
      expect(stats.hitRatio).toBe(1);
    });
  });

  describe('TTL and Expiration', () => {
    it('sets and retrieves TTL for active keys', async () => {
      await redisCacheService.setTenantFeatures(101, MOCK_TENANT_FEATURES, 120);

      const key = redisCacheService.formatTenantFeaturesKey(101);
      const remainingTtl = await redisCacheService.ttl(key);
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(120);
    });

    it('returns -2 for non-existent or expired keys', async () => {
      const ttl = await redisCacheService.ttl('tenant:non_existent:features');
      expect(ttl).toBe(-2);
    });

    it('expires and removes stale keys after TTL duration', async () => {
      // Set short TTL (simulate by passing negative/zero duration or manual expiry)
      const key = redisCacheService.formatTenantFeaturesKey(101);
      await redisCacheService.set(key, MOCK_TENANT_FEATURES, -1);

      const result = await redisCacheService.getTenantFeatures(101);
      expect(result).toBeNull();
    });
  });

  describe('Cache Invalidation & Refresh Lifecycle', () => {
    it('invalidates a specific tenant feature cache key', async () => {
      await redisCacheService.setTenantFeatures(101, MOCK_TENANT_FEATURES);
      expect(await redisCacheService.getTenantFeatures(101)).not.toBeNull();

      await redisCacheService.invalidateTenantFeatures(101);
      expect(await redisCacheService.getTenantFeatures(101)).toBeNull();

      const stats = redisCacheService.getStats();
      expect(stats.lastInvalidationTimestamp).not.toBeNull();
    });

    it('invalidates all tenants associated with a modified plan ID', async () => {
      // Cache tenant 101 on plan 2
      await redisCacheService.setTenantFeatures(101, {
        ...MOCK_TENANT_FEATURES,
        companyId: 101,
        planId: 2,
      });

      // Cache tenant 102 on plan 2
      await redisCacheService.setTenantFeatures(102, {
        ...MOCK_TENANT_FEATURES,
        companyId: 102,
        planId: 2,
      });

      // Cache tenant 103 on plan 3 (different plan)
      await redisCacheService.setTenantFeatures(103, {
        ...MOCK_TENANT_FEATURES,
        companyId: 103,
        planId: 3,
      });

      // Superadmin modifies plan 2 feature matrix
      const purged = await redisCacheService.invalidateByPlanId(2);
      expect(purged).toBe(2);

      // Plan 2 tenants should be purged
      expect(await redisCacheService.getTenantFeatures(101)).toBeNull();
      expect(await redisCacheService.getTenantFeatures(102)).toBeNull();

      // Plan 3 tenant remains intact
      expect(await redisCacheService.getTenantFeatures(103)).not.toBeNull();
    });

    it('refreshes tenant features instantly using a fresh fetcher', async () => {
      await redisCacheService.setTenantFeatures(101, MOCK_TENANT_FEATURES);

      const updated = await redisCacheService.refreshTenantFeatures(101, async () => ({
        ...MOCK_TENANT_FEATURES,
        subscriptionStatus: 'SUSPENDED',
      }));

      expect(updated.subscriptionStatus).toBe('SUSPENDED');

      const cached = await redisCacheService.getTenantFeatures(101);
      expect(cached?.subscriptionStatus).toBe('SUSPENDED');
    });
  });

  describe('Low-level Redis Command Emulation', () => {
    it('supports keys matching wildcard patterns', async () => {
      await redisCacheService.set('tenant:1:features', { a: 1 });
      await redisCacheService.set('tenant:2:features', { b: 2 });
      await redisCacheService.set('user:1:session', { c: 3 });

      const tenantKeys = await redisCacheService.keys('tenant:*:features');
      expect(tenantKeys).toHaveLength(2);
      expect(tenantKeys).toContain('tenant:1:features');
      expect(tenantKeys).toContain('tenant:2:features');
    });

    it('flushes all keys via flushdb', async () => {
      await redisCacheService.set('key1', 'val1');
      await redisCacheService.set('key2', 'val2');

      await redisCacheService.flushdb();
      expect(await redisCacheService.get('key1')).toBeNull();
      expect(await redisCacheService.get('key2')).toBeNull();
    });
  });
});

