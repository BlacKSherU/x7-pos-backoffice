import { apiRequest } from '@/shared/api/http';
import type {
  SaasCompaniesListMeta,
  SaasCompaniesQuery,
  SaasCompaniesStats,
  SaasCompanyConfigurations,
  SaasCompanyHub,
  SaasCompanyListItem,
  SaasCompanyMerchant,
  SaasCompanyMerchantsMeta,
  SaasCompanyMerchantsQuery,
  SaasCompanyProfile,
  SaasCompanyProfilePatch,
  SaasEnvelope,
} from '@/modules/platform-saas/companies/types/saas-company';

const BASE = '/v1/saas/companies';

/** Query string sin los filtros vacíos (`?search=&status=` no filtra nada). */
export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) search.set(key, text);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getSaasCompaniesStats(): Promise<SaasCompaniesStats> {
  const json = await apiRequest<SaasEnvelope<SaasCompaniesStats>>(
    `${BASE}/stats`,
    { method: 'GET' },
    'Failed to load company statistics. Please try again.',
  );
  return json.data;
}

export async function listSaasCompanies(
  query: SaasCompaniesQuery = {},
): Promise<{ items: SaasCompanyListItem[]; meta: SaasCompaniesListMeta }> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyListItem[], SaasCompaniesListMeta>>(
    `${BASE}${toQueryString({ ...query })}`,
    { method: 'GET' },
    'Failed to load companies. Please try again.',
  );
  const items = json.data ?? [];
  return {
    items,
    meta: json.meta ?? {
      total: items.length,
      page: query.page ?? 1,
      limit: query.limit ?? items.length,
      totalPages: 1,
      tiers: [],
    },
  };
}

export async function getSaasCompanyHub(companyId: number): Promise<SaasCompanyHub> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyHub>>(
    `${BASE}/${companyId}/hub`,
    { method: 'GET' },
    'Failed to load the company hub. Please try again.',
  );
  return json.data;
}

export async function getSaasCompanyProfile(companyId: number): Promise<SaasCompanyProfile> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyProfile>>(
    `${BASE}/${companyId}/profile`,
    { method: 'GET' },
    'Failed to load company profile. Please try again.',
  );
  return json.data;
}

export async function updateSaasCompanyProfile(
  companyId: number,
  patch: SaasCompanyProfilePatch,
): Promise<SaasCompanyProfile> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyProfile>>(
    `${BASE}/${companyId}/profile`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    'Failed to update company profile. Please try again.',
  );
  return json.data;
}

export async function getSaasCompanyConfigurations(
  companyId: number,
): Promise<SaasCompanyConfigurations> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyConfigurations>>(
    `${BASE}/${companyId}/configurations`,
    { method: 'GET' },
    'Failed to load company configurations. Please try again.',
  );
  return json.data;
}

export async function listSaasCompanyMerchants(
  companyId: number,
  query: SaasCompanyMerchantsQuery = {},
): Promise<{ items: SaasCompanyMerchant[]; meta: SaasCompanyMerchantsMeta }> {
  const json = await apiRequest<SaasEnvelope<SaasCompanyMerchant[], SaasCompanyMerchantsMeta>>(
    `${BASE}/${companyId}/merchants${toQueryString({ ...query })}`,
    { method: 'GET' },
    'Failed to load company merchants. Please try again.',
  );
  const items = json.data ?? [];
  return { items, meta: json.meta ?? { total: items.length, cities: [] } };
}
