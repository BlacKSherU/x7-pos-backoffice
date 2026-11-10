// Contrato de /api/v1/saas/companies/... (CONTRATO-API.md, endpoints 1-6).

import type { CompanyConfigurationsData } from '@/modules/platform-saas/companies/types/company';

export type SaasCompanyStatus = 'active' | 'inactive' | 'suspended';

export interface SaasEnvelope<T, M = undefined> {
  statusCode: number;
  message: string;
  data: T;
  meta?: M;
}

export interface SaasCompaniesStats {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  tenantConfigurations: number;
  activeConfigurations: number;
  systemProfiles: number;
  activeMerchants: number;
}

export interface SaasSubscriptionTier {
  planId: number;
  planName: string;
}

export interface SaasCompanyListItem {
  id: number;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: SaasCompanyStatus | string;
  baseCurrency: string | null;
  subscriptionTier: SaasSubscriptionTier | null;
  merchantCount: number;
}

export interface SaasCompaniesListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  tiers: SaasSubscriptionTier[];
}

export interface SaasCompaniesQuery {
  search?: string;
  status?: string;
  tier?: number | string;
  page?: number;
  limit?: number;
}

export interface SaasCompanyHub {
  company: {
    id: number;
    name: string;
    legalName: string | null;
    taxId: string | null;
    status: SaasCompanyStatus | string;
    baseCurrency: string | null;
    city: string | null;
    country: string | null;
  };
  stats: {
    totalMerchants: number;
    activeMerchants: number;
    activeUsers: number;
    configurations: number;
  };
}

export interface SaasCompanyProfile {
  id: number;
  legalName: string | null;
  commercialName: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  baseCurrency: string;
  status: SaasCompanyStatus | string;
  metrics: {
    activeMerchantBranches: number;
    globalCorporateCustomers: number;
    authorizedMasterSuppliers: number;
  };
}

/** PATCH /v1/saas/companies/:id/profile: parcial, solo los campos que cambian. */
export type SaasCompanyProfilePatch = Partial<{
  legalName: string;
  commercialName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  baseCurrency: string;
  status: SaasCompanyStatus;
}>;

export type SaasCompanyConfigurations = CompanyConfigurationsData;

export type SaasMerchantStatus = 'active' | 'inactive' | 'suspended';

export interface SaasCompanyMerchant {
  id: number;
  name: string;
  branchCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  status: SaasMerchantStatus | string;
  companyId: number;
}

export interface SaasCompanyMerchantsMeta {
  total: number;
  cities: string[];
}

export interface SaasCompanyMerchantsQuery {
  search?: string;
  city?: string;
  status?: string;
}
