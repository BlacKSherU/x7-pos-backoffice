import { apiRequest } from '@/shared/api/http';
import { toQueryString } from '@/modules/platform-saas/companies/api/saas-companies';
import type { SaasEnvelope } from '@/modules/platform-saas/companies/types/saas-company';
import type {
  SaasMerchantHub,
  SaasMerchantPatch,
  SaasMerchantProfile,
  SaasMerchantTerminal,
  SaasMerchantTerminalsMeta,
  SaasMerchantTerminalsQuery,
  SaasMerchantUser,
  SaasMerchantUsersMeta,
  SaasMerchantUsersQuery,
} from '@/modules/platform-saas/merchants/types/saas-merchant';

const BASE = '/v1/saas/merchants';

export async function getSaasMerchant(merchantId: number): Promise<SaasMerchantProfile> {
  const json = await apiRequest<SaasEnvelope<SaasMerchantProfile>>(
    `${BASE}/${merchantId}`,
    { method: 'GET' },
    'Failed to load merchant profile. Please try again.',
  );
  return json.data;
}

export async function updateSaasMerchant(
  merchantId: number,
  patch: SaasMerchantPatch,
): Promise<SaasMerchantProfile> {
  const json = await apiRequest<SaasEnvelope<SaasMerchantProfile>>(
    `${BASE}/${merchantId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    'Failed to update merchant profile. Please try again.',
  );
  return json.data;
}

export async function getSaasMerchantHub(merchantId: number): Promise<SaasMerchantHub> {
  const json = await apiRequest<SaasEnvelope<SaasMerchantHub>>(
    `${BASE}/${merchantId}/hub`,
    { method: 'GET' },
    'Failed to load the merchant hub. Please try again.',
  );
  return json.data;
}

export async function listSaasMerchantUsers(
  merchantId: number,
  query: SaasMerchantUsersQuery = {},
): Promise<{ items: SaasMerchantUser[]; meta: SaasMerchantUsersMeta }> {
  const json = await apiRequest<SaasEnvelope<SaasMerchantUser[], SaasMerchantUsersMeta>>(
    `${BASE}/${merchantId}/users${toQueryString({ ...query })}`,
    { method: 'GET' },
    'Failed to load merchant users. Please try again.',
  );
  const items = json.data ?? [];
  return {
    items,
    meta: json.meta ?? {
      total: items.length,
      active: items.filter((user) => user.status === 'active').length,
    },
  };
}

export async function listSaasMerchantTerminals(
  merchantId: number,
  query: SaasMerchantTerminalsQuery = {},
): Promise<{ items: SaasMerchantTerminal[]; meta: SaasMerchantTerminalsMeta }> {
  const json = await apiRequest<SaasEnvelope<SaasMerchantTerminal[], SaasMerchantTerminalsMeta>>(
    `${BASE}/${merchantId}/terminals${toQueryString({ ...query })}`,
    { method: 'GET' },
    'Failed to load merchant terminals. Please try again.',
  );
  const items = json.data ?? [];
  return {
    items,
    meta: json.meta ?? {
      total: items.length,
      active: items.filter((terminal) => terminal.status === 'active').length,
    },
  };
}
