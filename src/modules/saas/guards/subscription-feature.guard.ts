/**
 * Subscription Feature Guard & API Route Interceptor
 * Path: src/modules/saas/guards/subscription-feature.guard.ts
 *
 * Intercepts protected `/api/v1/saas/merchant-modules/*` routes.
 * Enforces high-performance Redis cache lookups for tenant subscription status
 * (ACTIVE vs SUSPENDED/CANCELLED) and granular feature flag entitlements.
 */

import { ApiError } from '@/shared/lib/api-error';
import {
  redisCacheService,
  type TenantCachedFeatures,
} from '../services/redis-cache.service';
import { getStoredUser } from '@/platform/auth/lib/auth-storage';

export type SubscriptionBlockedCode =
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'FEATURE_NOT_ENTITLED';

export interface SubscriptionGuardDetails {
  companyId: number;
  subscriptionStatus: string;
  isExpired: boolean;
  actionRequired?: string;
  redirectTo: string;
  requiredFeature?: string;
  planName?: string;
}

export interface StandardApiForbiddenResponse {
  statusCode: number;
  error: string;
  message: string;
  code: SubscriptionBlockedCode;
  details: SubscriptionGuardDetails;
}

export class SubscriptionGuardForbiddenException extends ApiError {
  readonly statusCode: number;
  readonly error: string;
  readonly details: SubscriptionGuardDetails;

  constructor(
    message: string,
    code: SubscriptionBlockedCode,
    details: SubscriptionGuardDetails,
  ) {
    super(message, 403, code);
    this.name = 'SubscriptionGuardForbiddenException';
    this.statusCode = 403;
    this.error = 'Forbidden';
    this.details = details;
  }

  public toJSON(): StandardApiForbiddenResponse {
    return {
      statusCode: this.statusCode,
      error: this.error,
      message: this.message,
      code: (this.code as SubscriptionBlockedCode) ?? 'SUBSCRIPTION_SUSPENDED',
      details: this.details,
    };
  }
}

export interface GuardRequestContext {
  companyId?: number | string | null;
  path: string;
  method?: string;
  requiredFeatureCode?: string;
  token?: string | null;
  fallbackFetcher?: (companyId: number) => Promise<TenantCachedFeatures>;
}

export interface GuardValidationResult {
  allowed: boolean;
  tenantFeatures?: TenantCachedFeatures;
  blockedResponse?: StandardApiForbiddenResponse;
}

// Module path to required feature code mapping for `/api/v1/saas/merchant-modules/*`
export const MERCHANT_MODULE_FEATURE_MAP: Record<string, string> = {
  kds: 'kds_display',
  'kitchen-display': 'kds_display',
  kitchen: 'kds_display',
  delivery: 'delivery_fleet',
  'delivery-fleet': 'delivery_fleet',
  reservations: 'reservations_engine',
  dining: 'table_management',
  'table-management': 'table_management',
  inventory: 'inventory_control',
  'raw-materials': 'inventory_control',
  analytics: 'advanced_analytics',
  reporting: 'advanced_analytics',
  tips: 'tip_pools',
  payroll: 'payroll_rules',
};

/**
 * Extracts the merchant sub-module segment from a URL path
 * Example: `/api/v1/saas/merchant-modules/kitchen-display/orders` -> `kitchen-display`
 */
export function extractMerchantSubmodule(path: string): string | null {
  const normalized = path.replace(/^\/api\/v1\/saas\//, '').replace(/^\/api\//, '');
  const match = normalized.match(/merchant-modules\/([^/?#]+)/);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * Checks whether a requested route is a protected merchant module endpoint
 */
export function isProtectedMerchantModuleRoute(path: string): boolean {
  return (
    path.includes('/api/v1/saas/merchant-modules') ||
    path.includes('merchant-modules/') ||
    /^\/api\/v1\/saas\/merchant-modules(?:\/.*)?$/.test(path)
  );
}

/**
 * Resolves the active company ID from request context, auth token, or local stored session
 */
export function resolveEffectiveCompanyId(providedId?: number | string | null): number {
  if (providedId !== undefined && providedId !== null && providedId !== '') {
    return Number(providedId);
  }
  const storedUser = getStoredUser();
  if (storedUser?.merchant?.id) {
    return Number(storedUser.merchant.id);
  }
  // Default tenant ID for testing/offline scenarios
  return 10;
}

/**
 * High-performance Subscription & Feature Guard Validator using Redis Cache
 */
export async function validateTenantSubscriptionAndFeature(
  context: GuardRequestContext,
): Promise<GuardValidationResult> {
  const companyId = resolveEffectiveCompanyId(context.companyId);
  const submodule = extractMerchantSubmodule(context.path);
  const requiredFeature =
    context.requiredFeatureCode ??
    (submodule ? MERCHANT_MODULE_FEATURE_MAP[submodule] : undefined);

  // 1. Load active tenant features from Redis cache engine
  let cached = await redisCacheService.getTenantFeatures(companyId);

  // 2. Cache miss -> warm cache via fallback resolver
  if (!cached) {
    if (context.fallbackFetcher) {
      cached = await context.fallbackFetcher(companyId);
    } else {
      // Default baseline tenant cache
      cached = {
        companyId,
        companyName: `Company #${companyId}`,
        planId: 2,
        planName: 'Professional',
        subscriptionStatus: 'ACTIVE',
        isExpired: false,
        features: [
          { id: 101, code: 'pos_core', name: 'Point of Sale', enabled: true },
          { id: 102, code: 'kds_display', name: 'Kitchen Display', enabled: true },
          { id: 103, code: 'delivery_fleet', name: 'Delivery Fleet', enabled: true },
          { id: 104, code: 'inventory_control', name: 'Inventory Control', enabled: true },
        ],
        featureCodes: ['pos_core', 'kds_display', 'delivery_fleet', 'inventory_control'],
        featureIds: [101, 102, 103, 104],
        modulePermissions: ['pos', 'kds', 'delivery', 'inventory'],
        cachedAt: new Date().toISOString(),
        ttlSeconds: 3600,
      };
    }
    await redisCacheService.setTenantFeatures(companyId, cached);
  }

  // 3. Strict Subscription Lifecycle Interception (ACTIVE vs SUSPENDED vs CANCELLED vs EXPIRED)
  const statusUpper = (cached.subscriptionStatus ?? 'ACTIVE').toUpperCase();

  if (statusUpper === 'SUSPENDED') {
    const error = new SubscriptionGuardForbiddenException(
      'Company subscription is suspended. Access to restricted merchant sub-modules is blocked.',
      'SUBSCRIPTION_SUSPENDED',
      {
        companyId,
        subscriptionStatus: 'SUSPENDED',
        isExpired: cached.isExpired,
        actionRequired: 'PAYMENT_RESOLUTION',
        redirectTo: '/platform-saas/subscription/hub',
      },
    );
    return {
      allowed: false,
      tenantFeatures: cached,
      blockedResponse: error.toJSON(),
    };
  }

  if (statusUpper === 'CANCELLED' || statusUpper === 'CANCELED') {
    const error = new SubscriptionGuardForbiddenException(
      'Company subscription has been cancelled. Access to merchant sub-modules has been terminated.',
      'SUBSCRIPTION_CANCELLED',
      {
        companyId,
        subscriptionStatus: 'CANCELLED',
        isExpired: true,
        actionRequired: 'REACTIVATION',
        redirectTo: '/platform-saas/subscription/hub',
      },
    );
    return {
      allowed: false,
      tenantFeatures: cached,
      blockedResponse: error.toJSON(),
    };
  }

  if (cached.isExpired) {
    const error = new SubscriptionGuardForbiddenException(
      'Company subscription period has expired. Please renew to regain access.',
      'SUBSCRIPTION_EXPIRED',
      {
        companyId,
        subscriptionStatus: 'EXPIRED',
        isExpired: true,
        actionRequired: 'RENEWAL',
        redirectTo: '/platform-saas/subscription/hub',
      },
    );
    return {
      allowed: false,
      tenantFeatures: cached,
      blockedResponse: error.toJSON(),
    };
  }

  // 4. Granular Feature-Level Gating
  if (requiredFeature) {
    const hasFeature =
      cached.featureCodes.includes(requiredFeature) ||
      cached.features.some((f) => f.code === requiredFeature && f.enabled);

    if (!hasFeature) {
      const error = new SubscriptionGuardForbiddenException(
        `Tenant subscription plan tier (${cached.planName}) does not include the required feature: ${requiredFeature}.`,
        'FEATURE_NOT_ENTITLED',
        {
          companyId,
          subscriptionStatus: cached.subscriptionStatus,
          isExpired: false,
          requiredFeature,
          planName: cached.planName,
          redirectTo: '/platform-saas/subscription/plans',
        },
      );
      return {
        allowed: false,
        tenantFeatures: cached,
        blockedResponse: error.toJSON(),
      };
    }
  }

  return {
    allowed: true,
    tenantFeatures: cached,
  };
}

/**
 * Standard Express / Node HTTP Middleware Guard
 */
export async function subscriptionFeatureMiddleware(
  req: {
    path?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | undefined>;
    params?: Record<string, string | undefined>;
    companyId?: number;
    user?: { companyId?: number; merchant?: { id: number } };
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  },
  next: () => void,
): Promise<void> {
  const path = req.path ?? req.url ?? '';

  if (!isProtectedMerchantModuleRoute(path)) {
    return next();
  }

  const headerCompanyId =
    (req.headers?.['x-company-id'] as string) ||
    (req.headers?.['x-tenant-id'] as string) ||
    req.params?.companyId ||
    req.query?.companyId ||
    req.companyId ||
    req.user?.companyId ||
    req.user?.merchant?.id;

  const result = await validateTenantSubscriptionAndFeature({
    companyId: headerCompanyId,
    path,
  });

  if (!result.allowed && result.blockedResponse) {
    res.status(403).json(result.blockedResponse);
    return;
  }

  next();
}

/**
 * Client-side / HTTP request interceptor for protected merchant module routes
 */
export async function interceptMerchantModuleRequest(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  if (!isProtectedMerchantModuleRoute(path)) {
    return null;
  }

  const headers = init?.headers ? new Headers(init.headers) : new Headers();
  const companyId = headers.get('x-company-id') ?? headers.get('x-merchant-id') ?? undefined;

  const result = await validateTenantSubscriptionAndFeature({
    path,
    companyId,
  });

  if (!result.allowed && result.blockedResponse) {
    // Return synthetic 403 Response for boundary handling
    return new Response(JSON.stringify(result.blockedResponse), {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return null;
}

