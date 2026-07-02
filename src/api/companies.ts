import { getAccessToken, clearAuthSession } from '../lib/auth-storage';
import { ApiError, getApiErrorMessage } from '../lib/api-error';
import type {
  CompanyConfigurationsData,
  CompanyConfigurationsResponse,
  CompanyProfile,
  CompanyProfilePayload,
  CompanyProfileResponse,
} from '../types/company';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function authHeaders(includeJson = false): Record<string, string> {
  const token = getAccessToken();
  return {
    Accept: 'application/json',
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function companyRequest<T>(
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

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const json = await companyRequest<CompanyProfileResponse>(
    '/companies/company/profile',
    { method: 'GET' },
    'Failed to load company profile. Please try again.',
  );

  return json.data;
}

export async function updateCompanyProfile(
  payload: CompanyProfilePayload,
): Promise<CompanyProfile> {
  const json = await companyRequest<CompanyProfileResponse>(
    '/companies/company/profile',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    'Failed to update company profile. Please try again.',
  );

  return json.data;
}

export async function getCompanyConfigurations(): Promise<CompanyConfigurationsData> {
  const json = await companyRequest<CompanyConfigurationsResponse>(
    '/companies/company/configurations',
    { method: 'GET' },
    'Failed to load company configurations. Please try again.',
  );

  return json.data;
}
