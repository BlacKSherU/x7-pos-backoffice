/**
 * Redis Feature Flag Cache Engine
 * Path: src/modules/saas/services/redis-cache.service.ts
 *
 * Provides high-performance in-memory Redis caching for active tenant feature flags,
 * module permissions, and subscription lifecycle states. Prevents repetitive database
 * lookups on high-frequency HTTP requests.
 */

export interface CachedFeature {
  id: number;
  code: string;
  name: string;
  limitValue?: number;
  enabled: boolean;
}

export interface TenantCachedFeatures {
  companyId: number;
  companyName?: string;
  planId: number;
  planName: string;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'INACTIVE' | 'GRACE_PERIOD' | string;
  isExpired: boolean;
  features: CachedFeature[];
  featureCodes: string[];
  featureIds: number[];
  modulePermissions: string[];
  cachedAt: string;
  ttlSeconds: number;
}

export interface RedisStats {
  hits: number;
  misses: number;
  totalKeys: number;
  hitRatio: number;
  lastInvalidationTimestamp: string | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch ms
  createdAt: number;
}

export class RedisCacheService {
  private static instance: RedisCacheService;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private hits = 0;
  private misses = 0;
  private lastInvalidationTimestamp: string | null = null;
  private defaultTtlSeconds = 3600; // 1 hour default TTL

  constructor(defaultTtlSeconds = 3600) {
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Constructs the standardized Redis cache key for tenant features
   * Pattern: tenant:{companyId}:features
   */
  public formatTenantFeaturesKey(companyId: number | string): string {
    return `tenant:${companyId}:features`;
  }

  /**
   * Low-level Redis GET command emulation
   */
  public async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    // Return deep cloned object to avoid accidental mutation
    return JSON.parse(JSON.stringify(entry.value)) as T;
  }

  /**
   * Low-level Redis SET command emulation with EX (TTL in seconds)
   */
  public async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const now = Date.now();
    this.cache.set(key, {
      value: JSON.parse(JSON.stringify(value)),
      expiresAt: now + ttl * 1000,
      createdAt: now,
    });
  }

  /**
   * Low-level Redis DEL command emulation
   */
  public async del(...keys: string[]): Promise<number> {
    let deletedCount = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.lastInvalidationTimestamp = new Date().toISOString();
    }
    return deletedCount;
  }

  /**
   * Low-level Redis KEYS command emulation (supports * wildcard)
   */
  public async keys(pattern: string): Promise<string[]> {
    const regexPattern = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    const matchedKeys: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        continue;
      }
      if (regexPattern.test(key)) {
        matchedKeys.push(key);
      }
    }
    return matchedKeys;
  }

  /**
   * Low-level Redis TTL command emulation in seconds
   */
  public async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2; // Redis: key does not exist
    const remainingMs = entry.expiresAt - Date.now();
    if (remainingMs <= 0) {
      this.cache.delete(key);
      return -2;
    }
    return Math.ceil(remainingMs / 1000);
  }

  /**
   * Low-level Redis FLUSHDB command emulation
   */
  public async flushdb(): Promise<void> {
    this.cache.clear();
    this.lastInvalidationTimestamp = new Date().toISOString();
  }

  // ── High-Level Tenant Feature Cache Operations ────────────────────────────

  /**
   * Retrieves active tenant features and permissions from Redis
   */
  public async getTenantFeatures(companyId: number | string): Promise<TenantCachedFeatures | null> {
    const key = this.formatTenantFeaturesKey(companyId);
    return this.get<TenantCachedFeatures>(key);
  }

  /**
   * Caches active tenant features and permissions in Redis
   */
  public async setTenantFeatures(
    companyId: number | string,
    data: TenantCachedFeatures,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = this.formatTenantFeaturesKey(companyId);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const enrichedData: TenantCachedFeatures = {
      ...data,
      companyId: Number(companyId),
      cachedAt: new Date().toISOString(),
      ttlSeconds: ttl,
    };
    await this.set(key, enrichedData, ttl);
  }

  /**
   * Purges the tenant features cache key immediately
   */
  public async invalidateTenantFeatures(companyId: number | string): Promise<void> {
    const key = this.formatTenantFeaturesKey(companyId);
    await this.del(key);
  }

  /**
   * Purges all tenant feature cache keys matching a specific planId
   * Used when a superadmin updates a plan-feature mapping matrix
   */
  public async invalidateByPlanId(planId: number | string): Promise<number> {
    const allTenantKeys = await this.keys('tenant:*:features');
    let purgedCount = 0;

    for (const key of allTenantKeys) {
      const entry = await this.get<TenantCachedFeatures>(key);
      if (entry && Number(entry.planId) === Number(planId)) {
        await this.del(key);
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      this.lastInvalidationTimestamp = new Date().toISOString();
    }
    return purgedCount;
  }

  /**
   * Invalidates and immediately refreshes tenant features using a fetcher
   */
  public async refreshTenantFeatures(
    companyId: number | string,
    fetcher: () => Promise<TenantCachedFeatures>,
    ttlSeconds?: number,
  ): Promise<TenantCachedFeatures> {
    await this.invalidateTenantFeatures(companyId);
    const freshData = await fetcher();
    await this.setTenantFeatures(companyId, freshData, ttlSeconds);
    return freshData;
  }

  /**
   * Returns cache metrics and hit/miss statistics
   */
  public getStats(): RedisStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      totalKeys: this.cache.size,
      hitRatio,
      lastInvalidationTimestamp: this.lastInvalidationTimestamp,
    };
  }

  /**
   * Resets hit/miss stats
   */
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

export const redisCacheService = RedisCacheService.getInstance();

