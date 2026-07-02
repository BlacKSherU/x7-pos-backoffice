import { getAccessToken, clearAuthSession } from '../lib/auth-storage';
import { ApiError, getApiErrorMessage } from '../lib/api-error';
import type {
  CompanyMerchant,
  CompanyMerchantsMeta,
  CompanyMerchantsResponse,
  MerchantAdminSummary,
  MerchantAdminSummaryResponse,
  MerchantFormPayload,
  MerchantMutationResponse,
} from '../types/merchant';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function authHeaders(includeJson = false): Record<string, string> {
  const token = getAccessToken();
  return {
    Accept: 'application/json',
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function merchantRequest<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(Boolean(init.body)),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    clearAuthSession();
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallbackMessage);
    throw new ApiError(message, response.status);
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function getCompanyMerchants(): Promise<{
  merchants: CompanyMerchant[];
  meta: CompanyMerchantsMeta;
}> {
  const json = await merchantRequest<CompanyMerchantsResponse>(
    '/merchants/company/branches',
    { method: 'GET' },
    'Failed to load merchants. Please try again.',
  );

  return {
    merchants: json.data ?? [],
    meta: json.meta,
  };
}

export async function createCompanyMerchant(
  payload: MerchantFormPayload,
): Promise<CompanyMerchant> {
  const json = await merchantRequest<MerchantMutationResponse>(
    '/merchants/company/branches',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Failed to create merchant. Please try again.',
  );

  return json.data;
}

export async function updateCompanyMerchant(
  id: number,
  payload: MerchantFormPayload,
): Promise<CompanyMerchant> {
  const json = await merchantRequest<MerchantMutationResponse>(
    `/merchants/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    'Failed to update merchant. Please try again.',
  );

  return json.data;
}

export async function deactivateCompanyMerchant(
  id: number,
): Promise<CompanyMerchant> {
  const json = await merchantRequest<MerchantMutationResponse>(
    `/merchants/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status: 'inactive' }),
    },
    'Failed to deactivate merchant. Please try again.',
  );

  return json.data;
}

export async function getMerchantAdminSummary(
  id: number,
): Promise<MerchantAdminSummary> {
  const json = await merchantRequest<MerchantAdminSummaryResponse>(
    `/merchants/${id}/admin-summary`,
    { method: 'GET' },
    'Failed to load merchant summary. Please try again.',
  );

  return json.data;
}
