//src/services/saasService.ts
import type {
  SubscriptionPlan,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  Application,
  PlatformFeature,
  PlanApplication,
  CreatePlanApplicationDto,
  UpdatePlanApplicationDto,
  PlanFeature,
  CreatePlanFeatureDto,
  UpdatePlanFeatureDto,
  CompanySubscription,
  CompanySubscriptionDetail,
  SubscriptionPayment,
  ProvisionedApplication,
  SubscriptionLifecycleStatus,
  UpdateCompanySubscriptionDto,
  MerchantSubscription,
  UpdateMerchantSubscriptionDto,
  SubscriptionAuditLog,
  CreateSubscriptionAuditLogDto,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import {
  recordSubscriptionAuditLog as logAuditEntryLocally,
  fetchSubscriptionAuditLogsFromStorage,
} from '@/modules/platform-saas/subscription-system/lib/subscription-audit-logger';
import { redisCacheService } from '@/modules/saas/services/redis-cache.service';
import type { CompanyRegistryItem, CompanyRegistryPayload, CompanyRegistryStatus } from '@/modules/platform-saas/companies/types/company-registry';
import type { PlatformUser } from '@/modules/platform-saas/users/types/user';
import { saasRequest } from '@/shared/api/http';

// Las rutas de este servicio van sin barra inicial ('subscription-plan', 'features/3'...).
function saasApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return saasRequest<T>(`/${path}`, { method: 'GET', ...options }, 'Request failed. Please try again.');
}

// Los listados del backend paginan (10 por defecto, 100 como máximo): sin recorrer todas las
// páginas, Applications mostraba 10 de 28 y Plan Features 100 de las 116 del plan Executive.
const PAGE_SIZE = 100;

async function saasFetchAll<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?';
  const items: T[] = [];
  for (let page = 1; ; page++) {
    // La mayoría de los módulos anidan la paginación en `pagination`; /users la pone en la raíz.
    const response = await saasApiFetch<{
      data: T[];
      pagination?: { totalPages: number };
      totalPages?: number;
    }>(`${path}${separator}page=${page}&limit=${PAGE_SIZE}`);
    items.push(...response.data);
    const totalPages = response.pagination?.totalPages ?? response.totalPages;
    if (totalPages === undefined || page >= totalPages) return items;
  }
}

const toPlan = (plan: SubscriptionPlan): SubscriptionPlan => ({
  ...plan,
  price: plan.price === null ? null : Number(plan.price),
});

export interface MerchantMetric {
  count: number;
  terminals: number;
}

export interface SaaSMetrics {
  totalMerchants: {
    value: number;
    growth: number;
    trend: number[]; // for the mini-chart
  };
  quickService: MerchantMetric;
  fullRestaurant: MerchantMetric;
  enterprise: MerchantMetric;
}

export interface RevenueData {
  amount: string;
  growthVsPrevYear: string;
  labels: string[];
  values: number[];
}

export interface RecentMerchant {
  id: string;
  name: string;
  joinedText: string;
  type: 'Quick Service' | 'Full Restaurant' | 'Enterprise';
  logoUrl?: string;
}

export interface ServiceHealth {
  status: 'operational' | 'degraded' | 'downtime';
  latency: number; // in more
  authUptime: string; // ej "99.998%"
  paymentBridge: 'Stable' | 'Degraded' | 'Down';
  cloudNodes: {
    active: number;
    total: number;
  };
  subServices: {
    apiLatency: 'operational' | 'degraded' | 'downtime';
    authUptime: 'operational' | 'degraded' | 'downtime';
    paymentBridge: 'operational' | 'degraded' | 'downtime';
    cloudNodes: 'operational' | 'degraded' | 'downtime';
  };
}

// Global flag to simulate test failures
let simulateApiFailure = false;

export const setSimulateApiFailure = (fail: boolean) => {
  simulateApiFailure = fail;
};

export const getSimulateApiFailure = () => simulateApiFailure;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const saasService = {
  async getMetrics(): Promise<SaaSMetrics> {
    await delay(600); // simulate network delay
    if (simulateApiFailure) {
      throw new Error('Failed to fetch SaaS metrics');
    }
    return {
      totalMerchants: {
        value: 2842,
        growth: 12.5,
        trend: [2100, 2250, 2400, 2350, 2600, 2750, 2842],
      },
      quickService: {
        count: 1120,
        terminals: 4480,
      },
      fullRestaurant: {
        count: 942,
        terminals: 7536,
      },
      enterprise: {
        count: 780,
        terminals: 15600,
      },
    };
  },

  async getRevenue(period: '1M' | '6M' | '1Y'): Promise<RevenueData> {
    await delay(500);
    if (simulateApiFailure) {
      throw new Error('Failed to fetch revenue data');
    }

    // Return dynamic data according to period
    switch (period) {
      case '1M':
        return {
          amount: '$410K',
          growthVsPrevYear: '+14.2% vs prev. month',
          labels: ['W1', 'W2', 'W3', 'W4'],
          values: [95000, 102000, 105000, 108000],
        };
      case '1Y':
        return {
          amount: '$8.4M',
          growthVsPrevYear: '+22.5% vs prev. year',
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          values: [550000, 580000, 620000, 680000, 710000, 750000, 780000, 810000, 830000, 850000, 880000, 920000],
        };
      case '6M':
      default:
        return {
          amount: '$4.2M',
          growthVsPrevYear: '+18.2% vs prev. year',
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          values: [580000, 620000, 680000, 710000, 750000, 860000],
        };
    }
  },

  async getRecentMerchants(): Promise<RecentMerchant[]> {
    await delay(400);
    if (simulateApiFailure) {
      throw new Error('Failed to fetch recent merchants');
    }
    return [
      {
        id: '1',
        name: 'The Copper Whisk',
        joinedText: 'Joined: 2 hours ago',
        type: 'Quick Service',
      },
      {
        id: '2',
        name: 'Lumière Bistro',
        joinedText: 'Joined: 5 hours ago',
        type: 'Full Restaurant',
      },
      {
        id: '3',
        name: 'Global Dining Group',
        joinedText: 'Joined: Yesterday',
        type: 'Enterprise',
        // Real restaurant image to replace googleusercontent placeholders
        logoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80&h=80&fit=crop&crop=faces&q=80',
      },
      {
        id: '4',
        name: 'Roast & Steam',
        joinedText: 'Joined: Yesterday',
        type: 'Quick Service',
      },
      {
        id: '5',
        name: 'Urban Bites HQ',
        joinedText: 'Joined: 2 days ago',
        type: 'Full Restaurant',
      },
    ];
  },

  async getHealthStatus(): Promise<ServiceHealth> {
    await delay(300);
    if (simulateApiFailure) {
      return {
        status: 'downtime',
        latency: 0,
        authUptime: '0.00%',
        paymentBridge: 'Down',
        cloudNodes: { active: 0, total: 142 },
        subServices: {
          apiLatency: 'downtime',
          authUptime: 'downtime',
          paymentBridge: 'downtime',
          cloudNodes: 'downtime',
        },
      };
    }

    // Simulate very sporadic or controlled random degradation to display the yellow/red dot
    // For practical demo purposes, let it be operational unless forced to fail.
    return {
      status: 'operational',
      latency: 24,
      authUptime: '99.998%',
      paymentBridge: 'Stable',
      cloudNodes: { active: 142, total: 142 },
      subServices: {
        apiLatency: 'operational',
        authUptime: 'operational',
        paymentBridge: 'operational',
        cloudNodes: 'operational',
      },
    };
  },

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const plans = await saasFetchAll<SubscriptionPlan>('subscription-plan');
    return plans.map(toPlan);
  },

  async createSubscriptionPlan(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const response = await saasApiFetch<{ data: SubscriptionPlan }>('subscription-plan', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return toPlan(response.data);
  },

  async updateSubscriptionPlan(id: number, dto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const response = await saasApiFetch<{ data: SubscriptionPlan }>(
      `subscription-plan/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      },
    );
    const plan = toPlan(response.data);
    // Invalidate Redis feature flag cache for all tenants on this plan
    redisCacheService.invalidateByPlanId(id).catch(() => {});
    return plan;
  },

  async deleteSubscriptionPlan(id: number): Promise<SubscriptionPlan> {
    const response = await saasApiFetch<{ data: SubscriptionPlan }>(
      `subscription-plan/${id}`,
      { method: 'DELETE' },
    );
    return toPlan(response.data);
  },

  async getApplications(): Promise<Application[]> {
    return saasFetchAll<Application>('applications');
  },

  async updateApplication(
    app: Application,
    updates: Partial<{ name: string; description: string; category: string; status: 'active' | 'inactive' }>,
  ): Promise<Application> {
    const response = await saasApiFetch<{ data: Application }>(
      `applications/${app.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    );
    return response.data;
  },

  async deleteApplication(id: number): Promise<Application> {
    const response = await saasApiFetch<{ data: Application }>(
      `applications/${id}`,
      { method: 'DELETE' },
    );
    return response.data;
  },

  async createApplication(dto: {
    name: string;
    description: string;
    category: string;
    status: 'active' | 'inactive';
  }): Promise<Application> {
    const response = await saasApiFetch<{ data: Application }>(
      'applications',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );
    return response.data;
  },

  async getFeatures(): Promise<PlatformFeature[]> {
    return saasFetchAll<PlatformFeature>('features');
  },

  async createFeature(dto: {
    name: string;
    description: string;
    Unit: string;
    status: string;
  }): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      'features',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );
    return response.data;
  },

  async updateFeature(
    id: number,
    dto: Partial<{ name: string; description: string; Unit: string; status: string }>,
  ): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      `features/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async deleteFeature(id: number): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      `features/${id}`,
      { method: 'DELETE' },
    );
    return response.data;
  },

  async getPlanApplications(planId: number): Promise<PlanApplication[]> {
    return saasFetchAll<PlanApplication>(`plan-applications?subscriptionPlanId=${planId}`);
  },

  async createPlanApplication(dto: CreatePlanApplicationDto): Promise<PlanApplication> {
    const response = await saasApiFetch<{ data: PlanApplication }>(
      'plan-applications',
      { method: 'POST', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async updatePlanApplication(id: number, dto: UpdatePlanApplicationDto): Promise<PlanApplication> {
    const response = await saasApiFetch<{ data: PlanApplication }>(
      `plan-applications/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async deletePlanApplication(id: number): Promise<void> {
    await saasApiFetch(`plan-applications/${id}`, { method: 'DELETE' });
  },

  // ── Plan-to-Applications Association Endpoints ─────────────────────────
  async getSubscriptionPlanApplications(planId: number | string): Promise<Application[]> {
    try {
      const response = await saasApiFetch<{ data: Application[] | PlanApplication[] }>(
        `v1/saas/subscription-plans/${planId}/applications`,
      );
      const list = response.data;
      if (Array.isArray(list)) {
        return list.map((item) => {
          if ('application' in item && typeof item.application === 'object' && item.application !== null) {
            return (item as PlanApplication).application as unknown as Application;
          }
          return item as Application;
        });
      }
      return [];
    } catch {
      // Fallback: use getPlanApplications
      try {
        const planApps = await this.getPlanApplications(Number(planId));
        return planApps.map((pa) => ({
          id: pa.application.id,
          name: pa.application.name,
          category: pa.application.category,
          description: pa.limits || 'Bundled Module',
          status: (pa.status as 'active' | 'inactive') || 'active',
        }));
      } catch {
        return [];
      }
    }
  },

  async associatePlanApplication(
    planId: number | string,
    applicationId: number | string,
  ): Promise<unknown> {
    let result: unknown;
    try {
      const response = await saasApiFetch<{ data: unknown }>(
        `v1/saas/subscription-plans/${planId}/applications`,
        {
          method: 'POST',
          body: JSON.stringify({ applicationId: Number(applicationId) }),
        },
      );
      result = response.data;
    } catch {
      // Fallback: create plan_application association
      result = await this.createPlanApplication({
        subscriptionPlan: Number(planId),
        application: Number(applicationId),
        limits: 'Included in plan tier',
        status: 'active',
      });
    }

    // Immutable Audit Trail recording
    this.recordSubscriptionAuditLog({
      action_type: 'PLAN_MAPPING_UPDATED',
      target_type: 'PLAN_APPLICATION',
      target_id: applicationId,
      target_name: `Plan #${planId} - App #${applicationId}`,
      previous_value: { linked: false, planId: Number(planId), applicationId: Number(applicationId) },
      new_value: { linked: true, planId: Number(planId), applicationId: Number(applicationId) },
      reason_notes: 'Administrative plan-to-application association update',
      metadata: { planId: Number(planId), applicationId: Number(applicationId) },
    }).catch(() => {});

    // Invalidate Redis feature flag cache for all tenants on this plan
    redisCacheService.invalidateByPlanId(planId).catch(() => {});

    return result;
  },

  async disassociatePlanApplication(
    planId: number | string,
    applicationId: number | string,
  ): Promise<void> {
    try {
      await saasApiFetch(
        `v1/saas/subscription-plans/${planId}/applications/${applicationId}`,
        {
          method: 'DELETE',
        },
      );
    } catch {
      // Fallback: find existing PlanApplication and delete it
      const planApps = await this.getPlanApplications(Number(planId));
      const found = planApps.find((pa) => pa.application.id === Number(applicationId));
      if (found) {
        await this.deletePlanApplication(found.id);
      }
    }

    // Invalidate Redis feature flag cache for all tenants on this plan
    redisCacheService.invalidateByPlanId(planId).catch(() => {});

    // Immutable Audit Trail recording
    this.recordSubscriptionAuditLog({
      action_type: 'PLAN_MAPPING_UPDATED',
      target_type: 'PLAN_APPLICATION',
      target_id: applicationId,
      target_name: `Plan #${planId} - App #${applicationId}`,
      previous_value: { linked: true, planId: Number(planId), applicationId: Number(applicationId) },
      new_value: { linked: false, planId: Number(planId), applicationId: Number(applicationId) },
      reason_notes: 'Administrative plan-to-application disassociation update',
      metadata: { planId: Number(planId), applicationId: Number(applicationId) },
    }).catch(() => {});
  },

  async getPlanFeatures(planId: number): Promise<PlanFeature[]> {
    return saasFetchAll<PlanFeature>(`plan-features?subscriptionPlanId=${planId}`);
  },

  async createPlanFeature(dto: CreatePlanFeatureDto): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      'plan-features',
      { method: 'POST', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async updatePlanFeature(id: number, dto: UpdatePlanFeatureDto): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      `plan-features/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  async deletePlanFeature(id: number): Promise<PlanFeature> {
    const response = await saasApiFetch<{ data: PlanFeature }>(
      `plan-features/${id}`,
      { method: 'DELETE' },
    );
    return response.data;
  },

  // ── Plan-to-Features Association Endpoints ────────────────────────────
  async getSubscriptionPlanFeatures(planId: number | string): Promise<PlatformFeature[]> {
    try {
      const response = await saasApiFetch<{ data: PlatformFeature[] | PlanFeature[] }>(
        `v1/saas/subscription-plans/${planId}/features`,
      );
      const list = response.data;
      if (Array.isArray(list)) {
        return list.map((item) => {
          if ('feature' in item && typeof item.feature === 'object' && item.feature !== null) {
            const pf = item as PlanFeature;
            return {
              id: pf.feature.id,
              name: pf.feature.name,
              Unit: pf.feature.unit,
              description: pf.feature.description,
              status: pf.status || 'active',
            } as PlatformFeature;
          }
          return item as PlatformFeature;
        });
      }
      return [];
    } catch {
      // Fallback: use getPlanFeatures
      try {
        const planFeatures = await this.getPlanFeatures(Number(planId));
        return planFeatures.map((pf) => ({
          id: pf.feature.id,
          name: pf.feature.name,
          Unit: pf.feature.unit,
          description: pf.feature.description || `Limit: ${pf.limit_value}`,
          status: pf.status || 'active',
        }));
      } catch {
        return [];
      }
    }
  },

  async associatePlanFeature(
    planId: number | string,
    featureId: number | string,
    limitValue = 100,
  ): Promise<unknown> {
    let result: unknown;
    try {
      const response = await saasApiFetch<{ data: unknown }>(
        `v1/saas/subscription-plans/${planId}/features`,
        {
          method: 'POST',
          body: JSON.stringify({
            featureId: Number(featureId),
            limit_value: limitValue,
          }),
        },
      );
      result = response.data;
    } catch {
      // Fallback: create plan_feature association
      result = await this.createPlanFeature({
        subscriptionPlan: Number(planId),
        feature: Number(featureId),
        limit_value: limitValue,
        status: 'active',
      });
    }

    // Immutable Audit Trail recording
    this.recordSubscriptionAuditLog({
      action_type: 'PLAN_MAPPING_UPDATED',
      target_type: 'PLAN_FEATURE',
      target_id: featureId,
      target_name: `Plan #${planId} - Feature #${featureId}`,
      previous_value: { linked: false, planId: Number(planId), featureId: Number(featureId), limitValue },
      new_value: { linked: true, planId: Number(planId), featureId: Number(featureId), limitValue },
      reason_notes: 'Administrative plan-to-feature entitlement association update',
      metadata: { planId: Number(planId), featureId: Number(featureId), limitValue },
    }).catch(() => {});

    // Invalidate Redis feature flag cache for all tenants on this plan
    redisCacheService.invalidateByPlanId(planId).catch(() => {});

    return result;
  },

  async disassociatePlanFeature(
    planId: number | string,
    featureId: number | string,
  ): Promise<void> {
    try {
      await saasApiFetch(
        `v1/saas/subscription-plans/${planId}/features/${featureId}`,
        {
          method: 'DELETE',
        },
      );
    } catch {
      // Fallback: find existing PlanFeature and delete it
      const planFeatures = await this.getPlanFeatures(Number(planId));
      const found = planFeatures.find((pf) => pf.feature.id === Number(featureId));
      if (found) {
        await this.deletePlanFeature(found.id);
      }
    }

    // Invalidate Redis feature flag cache for all tenants on this plan
    redisCacheService.invalidateByPlanId(planId).catch(() => {});

    // Immutable Audit Trail recording
    this.recordSubscriptionAuditLog({
      action_type: 'PLAN_MAPPING_UPDATED',
      target_type: 'PLAN_FEATURE',
      target_id: featureId,
      target_name: `Plan #${planId} - Feature #${featureId}`,
      previous_value: { linked: true, planId: Number(planId), featureId: Number(featureId) },
      new_value: { linked: false, planId: Number(planId), featureId: Number(featureId) },
      reason_notes: 'Administrative plan-to-feature entitlement disassociation update',
      metadata: { planId: Number(planId), featureId: Number(featureId) },
    }).catch(() => {});
  },

  // ── Global Company Registry (SaaS Owner) ──────────────────────────────
  async listCompanies(): Promise<CompanyRegistryItem[]> {
    const response = await saasApiFetch<{ data: CompanyRegistryItem[] }>(
      'companies',
    );
    return response.data ?? [];
  },

  async createCompany(
    payload: CompanyRegistryPayload,
  ): Promise<CompanyRegistryItem> {
    const response = await saasApiFetch<{ data: CompanyRegistryItem }>(
      'companies',
      { method: 'POST', body: JSON.stringify(payload) },
    );
    return response.data;
  },

  async updateCompany(
    id: number,
    payload: CompanyRegistryPayload,
  ): Promise<CompanyRegistryItem> {
    const response = await saasApiFetch<{ data: CompanyRegistryItem }>(
      `companies/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    return response.data;
  },

  async setCompanyStatus(
    id: number,
    status: CompanyRegistryStatus,
  ): Promise<CompanyRegistryItem> {
    const response = await saasApiFetch<{ data: CompanyRegistryItem }>(
      `companies/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
    return response.data;
  },

  // ── Global Users Directory (SaaS Owner) ───────────────────────────────
  // GET /users es solo para portal_admin: todos los usuarios de la plataforma.
  async listPlatformUsers(): Promise<PlatformUser[]> {
    return saasFetchAll<PlatformUser>('users');
  },

  async setPlatformUserActive(id: number, isActive: boolean): Promise<void> {
    await saasApiFetch<unknown>(`users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  // ── Company subscriptions (SaaS Owner) ────────────────────────────────
  // La suscripción de la compañía es la que da el plan; merchant_subscription no decide el acceso.
  async listCompanySubscriptions(): Promise<CompanySubscription[]> {
    return saasFetchAll<CompanySubscription>('company-subscriptions');
  },

  async updateCompanySubscription(
    id: number,
    dto: UpdateCompanySubscriptionDto,
  ): Promise<CompanySubscription> {
    // Only send fields explicitly accepted by the backend UpdateCompanySubscriptionDto
    // (planId, status, startDate, endDate, renewalDate, paymentMethod)
    // to strictly prevent NestJS ValidationPipe (forbidNonWhitelisted: true) 400 Bad Request
    const payload: Record<string, unknown> = {};
    if (dto.planId !== undefined) payload.planId = Number(dto.planId);
    if (dto.status !== undefined) {
      payload.status = String(dto.status).toLowerCase() === 'active' ? 'active' : 'inactive';
    }
    if (dto.startDate !== undefined) payload.startDate = dto.startDate;
    if (dto.endDate !== undefined) payload.endDate = dto.endDate;
    if (dto.renewalDate !== undefined) payload.renewalDate = dto.renewalDate;
    if (dto.paymentMethod !== undefined) payload.paymentMethod = dto.paymentMethod;

    const response = await saasApiFetch<{ data: CompanySubscription }>(
      `company-subscriptions/${id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    return response.data;
  },

  // ── Company-level Subscription Operations ────────────────────────────
  async getCompanySubscription(companyId: number): Promise<CompanySubscriptionDetail> {
    const cachedTenant = await redisCacheService.getTenantFeatures(companyId).catch(() => null);

    try {
      const list = await saasFetchAll<CompanySubscription>(`company-subscriptions?companyId=${companyId}`);
      const found = list.find((s) => s.company?.id === companyId) ?? list[0];
      if (found) {
        const effectiveStatus =
          cachedTenant?.subscriptionStatus && cachedTenant.subscriptionStatus !== 'ACTIVE'
            ? (cachedTenant.subscriptionStatus as SubscriptionLifecycleStatus)
            : found.status;

        return {
          ...found,
          status: effectiveStatus,
          billingCycle: found.billingCycle ?? 'MONTHLY',
          price: found.price ?? (found.plan?.price ?? '0.00'),
        };
      }
    } catch {
      // Fallback: search company-subscriptions without query
    }

    const all = await saasFetchAll<CompanySubscription>('company-subscriptions');
    const found = all.find((s) => s.company?.id === companyId);
    if (!found) {
      throw new Error(`Subscription not found for company ${companyId}`);
    }

    const effectiveStatus =
      cachedTenant?.subscriptionStatus && cachedTenant.subscriptionStatus !== 'ACTIVE'
        ? (cachedTenant.subscriptionStatus as SubscriptionLifecycleStatus)
        : found.status;

    return {
      ...found,
      status: effectiveStatus,
      billingCycle: found.billingCycle ?? 'MONTHLY',
      price: found.price ?? (found.plan?.price ?? '0.00'),
    };
  },

  async updateCompanySubscriptionStatus(
    companyId: number,
    status: SubscriptionLifecycleStatus,
    options?: { immediate?: boolean; reason?: string },
  ): Promise<CompanySubscriptionDetail> {
    // 1. Locate the subscription record for this company
    let targetSubscription: CompanySubscription | null = null;
    try {
      const list = await saasFetchAll<CompanySubscription>(`company-subscriptions?companyId=${companyId}`);
      targetSubscription = list.find((s) => s.company?.id === companyId) ?? list[0] ?? null;
    } catch {
      // Fallback
    }

    if (!targetSubscription) {
      const all = await saasFetchAll<CompanySubscription>('company-subscriptions');
      targetSubscription = all.find((s) => s.company?.id === companyId) ?? null;
    }

    if (!targetSubscription) {
      throw new Error(`Failed to update subscription status: subscription not found for company ${companyId}`);
    }

    // 2. Prepare payload conforming to backend UpdateCompanySubscriptionDto
    const isActivating = String(status).toLowerCase() === 'active';
    const isCancellingAtPeriodEnd = String(status).toUpperCase() === 'CANCELLED' && options?.immediate === false;

    const payload: UpdateCompanySubscriptionDto = {
      status: isActivating || isCancellingAtPeriodEnd ? 'active' : 'inactive',
    };

    if (isCancellingAtPeriodEnd) {
      // Preserves active status until billing period ends, disable renewal
      payload.renewalDate = null;
    }

    // 3. Persist via PATCH company-subscriptions/:id with whitelisted fields
    const updated = await this.updateCompanySubscription(targetSubscription.id, payload);
    const result: CompanySubscriptionDetail = {
      ...updated,
      status,
      billingCycle: targetSubscription.billingCycle ?? 'MONTHLY',
      price: targetSubscription.price ?? (targetSubscription.plan?.price ?? '0.00'),
    };

    // 4. Immutable Audit Trail recording
    this.recordSubscriptionAuditLog({
      action_type: 'SUBSCRIPTION_STATUS_CHANGED',
      target_type: 'COMPANY_SUBSCRIPTION',
      target_id: companyId,
      target_name: result.company?.name ? `${result.company.name} Subscription` : `Company #${companyId} Subscription`,
      company_id: companyId,
      company_name: result.company?.name,
      previous_value: { status: targetSubscription.status },
      new_value: {
        status,
        immediate: options?.immediate ?? true,
        cancellationEffective: options?.immediate ? 'immediate' : 'period_end',
      },
      reason_notes:
        options?.reason ??
        (String(status).toUpperCase() === 'SUSPENDED'
          ? 'Mandatory suspension notice recorded by administrative operator'
          : String(status).toUpperCase() === 'CANCELLED'
          ? 'Mandatory cancellation notice recorded by administrative operator'
          : null),
      metadata: { companyId, immediate: options?.immediate ?? true },
    }).catch(() => {});

    // 5. Invalidate and instantly refresh Redis cache for this tenant
    redisCacheService
      .refreshTenantFeatures(companyId, async () => ({
        companyId: Number(companyId),
        companyName: result.company?.name,
        planId: result.plan?.id ?? 1,
        planName: result.plan?.name ?? 'Professional',
        subscriptionStatus: status,
        isExpired: result.isExpired ?? false,
        features: [],
        featureCodes: [],
        featureIds: [],
        modulePermissions: [],
        cachedAt: new Date().toISOString(),
        ttlSeconds: 3600,
      }))
      .catch(() => {});

    return result;
  },

  async getCompanyPayments(companyId: number): Promise<SubscriptionPayment[]> {
    return this.listSubscriptionPayments(companyId);
  },

  async listSubscriptionPayments(companyId?: number): Promise<SubscriptionPayment[]> {
    try {
      // Backend GET /subscription-payments accepts { status, search, page, limit, sortBy, sortOrder }.
      // companyId is filtered client-side to prevent NestJS ValidationPipe (forbidNonWhitelisted: true) 400 Bad Request.
      const response = await saasApiFetch<{ data: SubscriptionPayment[] } | SubscriptionPayment[]>(
        'subscription-payments?limit=100',
      );
      const items = Array.isArray(response) ? response : response.data ?? [];
      if (companyId) {
        return items.filter(
          (p: SubscriptionPayment & { company_id?: number; companySubscription?: { company_id?: number; company?: { id?: number } } }) =>
            p.companyId === companyId ||
            p.company_id === companyId ||
            p.companySubscription?.company_id === companyId ||
            p.companySubscription?.company?.id === companyId,
        );
      }
      return items;
    } catch {
      return [];
    }
  },

  async updateSubscriptionPaymentStatus(
    paymentId: number,
    newStatus: SubscriptionPayment['status'],
    notes?: string,
  ): Promise<SubscriptionPayment> {
    const response = await saasApiFetch<{ data: SubscriptionPayment }>(
      `v1/saas/subscription-payments/${paymentId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, notes }),
      },
    );
    const updatedPayment = response.data;

    // Log audit entry
    try {
      await this.recordSubscriptionAuditLog({
        action_type: 'SUBSCRIPTION_STATUS_CHANGED',
        target_type: 'COMPANY_SUBSCRIPTION',
        target_id: paymentId,
        target_name: updatedPayment?.invoiceNumber || `Payment #${paymentId}`,
        company_id: updatedPayment?.companyId ?? null,
        company_name: updatedPayment?.companyName,
        previous_value: null,
        new_value: { status: newStatus, notes },
        reason_notes: notes || `Subscription payment status updated to ${newStatus.toUpperCase()}`,
        metadata: { paymentId, newStatus },
      });
    } catch {
      // Safe fail
    }

    return updatedPayment;
  },

  async getCompanySubscriptionApplications(
    companyId: number,
    planId?: number,
  ): Promise<ProvisionedApplication[]> {
    try {
      let targetPlanId = planId;
      if (!targetPlanId) {
        const sub = await this.getCompanySubscription(companyId);
        targetPlanId = sub.plan?.id;
      }
      const [allApps, planApps] = await Promise.all([
        this.getApplications(),
        targetPlanId ? this.getPlanApplications(targetPlanId) : Promise.resolve([]),
      ]);
      const unlockedAppIds = new Set(planApps.map((pa) => pa.application.id));
      return allApps.map((app) => ({
        id: app.id,
        name: app.name,
        code: app.code ?? app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: app.description ?? undefined,
        category: app.category,
        isProvisioned: unlockedAppIds.has(app.id),
      }));
    } catch {
      return [];
    }
  },

  // ── Merchant subscriptions ──────────────────────────────────────────
  async listMerchantSubscriptions(): Promise<MerchantSubscription[]> {
    return saasFetchAll<MerchantSubscription>('merchant-subscription');
  },

  async updateMerchantSubscription(
    id: number,
    dto: UpdateMerchantSubscriptionDto,
  ): Promise<MerchantSubscription> {
    const response = await saasApiFetch<{ data: MerchantSubscription }>(
      `merchant-subscription/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },

  // ── Subscription Audit Trail Ledger ──────────────────────────────────
  async getSubscriptionAuditLogs(companyId?: number): Promise<SubscriptionAuditLog[]> {
    return fetchSubscriptionAuditLogsFromStorage(companyId);
  },

  async recordSubscriptionAuditLog(
    dto: CreateSubscriptionAuditLogDto,
  ): Promise<SubscriptionAuditLog> {
    return logAuditEntryLocally(dto);
  },
};
