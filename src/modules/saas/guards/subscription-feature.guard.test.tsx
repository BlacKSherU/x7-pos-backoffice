import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  validateTenantSubscriptionAndFeature,
  subscriptionFeatureMiddleware,
  interceptMerchantModuleRequest,
  isProtectedMerchantModuleRoute,
  extractMerchantSubmodule,
  SubscriptionGuardForbiddenException,
} from './subscription-feature.guard';
import {
  redisCacheService,
  type TenantCachedFeatures,
} from '../services/redis-cache.service';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

const ACTIVE_TENANT: TenantCachedFeatures = {
  companyId: 101,
  companyName: 'Acme Dining Group',
  planId: 2,
  planName: 'Professional',
  subscriptionStatus: 'ACTIVE',
  isExpired: false,
  features: [
    { id: 1, code: 'pos_core', name: 'POS Core', enabled: true },
    { id: 2, code: 'kds_display', name: 'Kitchen Display System', enabled: true },
    { id: 3, code: 'delivery_fleet', name: 'Delivery Fleet', enabled: true },
  ],
  featureCodes: ['pos_core', 'kds_display', 'delivery_fleet'],
  featureIds: [1, 2, 3],
  modulePermissions: ['pos', 'kds', 'delivery'],
  cachedAt: new Date().toISOString(),
  ttlSeconds: 3600,
};

describe('Subscription Feature Guard & Interceptor', () => {
  beforeEach(async () => {
    await redisCacheService.flushdb();
    redisCacheService.resetStats();
  });

  describe('Route Pattern Identification', () => {
    it('identifies protected merchant module routes correctly', () => {
      expect(isProtectedMerchantModuleRoute('/api/v1/saas/merchant-modules/kitchen-display')).toBe(true);
      expect(isProtectedMerchantModuleRoute('/api/v1/saas/merchant-modules/delivery/orders')).toBe(true);
      expect(isProtectedMerchantModuleRoute('/api/v1/saas/subscription-plans')).toBe(false);
      expect(isProtectedMerchantModuleRoute('/api/public/health')).toBe(false);
    });

    it('extracts merchant sub-module identifier from request path', () => {
      expect(extractMerchantSubmodule('/api/v1/saas/merchant-modules/kds/orders')).toBe('kds');
      expect(extractMerchantSubmodule('/api/v1/saas/merchant-modules/delivery-fleet')).toBe('delivery-fleet');
      expect(extractMerchantSubmodule('/api/v1/saas/merchant-modules/reservations?date=2026-11-16')).toBe('reservations');
      expect(extractMerchantSubmodule('/api/unrelated/path')).toBeNull();
    });
  });

  describe('Redis Performance Integration & Cache Lookups', () => {
    it('loads tenant feature flags directly from Redis memory cache', async () => {
      await redisCacheService.setTenantFeatures(101, ACTIVE_TENANT);

      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/kds/orders',
      });

      expect(result.allowed).toBe(true);
      expect(result.tenantFeatures?.companyId).toBe(101);

      // Verify hit was recorded in Redis
      const stats = redisCacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('warms Redis cache when encountering a cache miss with fallback fetcher', async () => {
      const fallbackFetcher = vi.fn().mockResolvedValue(ACTIVE_TENANT);

      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/kds/orders',
        fallbackFetcher,
      });

      expect(result.allowed).toBe(true);
      expect(fallbackFetcher).toHaveBeenCalledWith(101);

      // Subsequent query should hit Redis without calling fetcher
      const cached = await redisCacheService.getTenantFeatures(101);
      expect(cached).not.toBeNull();
      expect(cached?.companyId).toBe(101);
    });
  });

  describe('Strict Subscription Status Interception', () => {
    it('blocks suspended tenant requests with 403 Forbidden and redirect payload', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        subscriptionStatus: 'SUSPENDED',
      });

      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/kds',
      });

      expect(result.allowed).toBe(false);
      expect(result.blockedResponse?.statusCode).toBe(403);
      expect(result.blockedResponse?.code).toBe('SUBSCRIPTION_SUSPENDED');
      expect(result.blockedResponse?.details.redirectTo).toBe('/platform-saas/subscription/hub');
      expect(result.blockedResponse?.details.actionRequired).toBe('PAYMENT_RESOLUTION');
    });

    it('blocks cancelled tenant requests with 403 Forbidden and reactivation redirect', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        subscriptionStatus: 'CANCELLED',
        isExpired: true,
      });

      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/delivery',
      });

      expect(result.allowed).toBe(false);
      expect(result.blockedResponse?.statusCode).toBe(403);
      expect(result.blockedResponse?.code).toBe('SUBSCRIPTION_CANCELLED');
      expect(result.blockedResponse?.details.redirectTo).toBe('/platform-saas/subscription/hub');
    });

    it('blocks expired subscriptions with 403 Forbidden and renewal notice', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        subscriptionStatus: 'ACTIVE',
        isExpired: true,
      });

      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/kds',
      });

      expect(result.allowed).toBe(false);
      expect(result.blockedResponse?.code).toBe('SUBSCRIPTION_EXPIRED');
    });
  });

  describe('Granular Feature Flag Gating', () => {
    it('blocks requests when tenant lacks required plan feature entitlement', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        planName: 'Essential',
        features: [{ id: 1, code: 'pos_core', name: 'POS Core', enabled: true }],
        featureCodes: ['pos_core'],
      });

      // Request requires KDS, which is not in Essential plan
      const result = await validateTenantSubscriptionAndFeature({
        companyId: 101,
        path: '/api/v1/saas/merchant-modules/kds/orders',
      });

      expect(result.allowed).toBe(false);
      expect(result.blockedResponse?.statusCode).toBe(403);
      expect(result.blockedResponse?.code).toBe('FEATURE_NOT_ENTITLED');
      expect(result.blockedResponse?.details.requiredFeature).toBe('kds_display');
      expect(result.blockedResponse?.details.redirectTo).toBe('/platform-saas/subscription/plans');
    });
  });

  describe('HTTP Middleware Guard Execution', () => {
    it('passes through and calls next() on unrestricted non-module routes', async () => {
      const nextMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: vi.fn() });

      await subscriptionFeatureMiddleware(
        { path: '/api/v1/saas/plans', headers: { 'x-company-id': '101' } },
        { status: statusMock },
        nextMock,
      );

      expect(nextMock).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('intercepts and returns 403 response on restricted route with suspended subscription', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        subscriptionStatus: 'SUSPENDED',
      });

      const nextMock = vi.fn();
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

      await subscriptionFeatureMiddleware(
        {
          path: '/api/v1/saas/merchant-modules/kds/orders',
          headers: { 'x-company-id': '101' },
        },
        { status: statusMock },
        nextMock,
      );

      expect(nextMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'SUBSCRIPTION_SUSPENDED',
        }),
      );
    });
  });

  describe('HTTP Client Request Interceptor', () => {
    it('intercepts fetch request and returns synthetic 403 response when tenant is suspended', async () => {
      await redisCacheService.setTenantFeatures(101, {
        ...ACTIVE_TENANT,
        subscriptionStatus: 'SUSPENDED',
      });

      const response = await interceptMerchantModuleRequest(
        '/api/v1/saas/merchant-modules/kds',
        {
          headers: { 'x-company-id': '101' },
        },
      );

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);

      const json = await response?.json();
      expect(json.code).toBe('SUBSCRIPTION_SUSPENDED');
      expect(json.details.redirectTo).toBe('/platform-saas/subscription/hub');
    });

    it('returns null when route is permitted to allow normal network pass-through', async () => {
      await redisCacheService.setTenantFeatures(101, ACTIVE_TENANT);

      const response = await interceptMerchantModuleRequest(
        '/api/v1/saas/merchant-modules/kds',
        {
          headers: { 'x-company-id': '101' },
        },
      );

      expect(response).toBeNull();
    });
  });

  describe('React Frontend Error Boundary Integration', () => {
    it('renders the subscription billing notice screen when SubscriptionGuardForbiddenException is thrown', () => {
      const ProblemComponent = () => {
        throw new SubscriptionGuardForbiddenException(
          'Tenant subscription is suspended.',
          'SUBSCRIPTION_SUSPENDED',
          {
            companyId: 101,
            subscriptionStatus: 'SUSPENDED',
            isExpired: false,
            actionRequired: 'PAYMENT_RESOLUTION',
            redirectTo: '/platform-saas/subscription/hub',
          },
        );
      };

      // Silence React error boundary console log for test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ProblemComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('subscription-billing-boundary-screen')).toBeInTheDocument();
      expect(screen.getByText('SUBSCRIPTION SUSPENDED')).toBeInTheDocument();
      expect(screen.getByText('Subscription Access Suspended')).toBeInTheDocument();
      expect(screen.getByText(/Tenant subscription is suspended/i)).toBeInTheDocument();

      const link = screen.getByRole('link', { name: /Go to Billing Notice & Hub/i });
      expect(link).toHaveAttribute('href', '/platform-saas/subscription/hub');

      consoleError.mockRestore();
    });
  });
});

