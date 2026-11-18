// Filtros de los directorios Platform SaaS. El backend ya filtra por query (search/status/tier/
// city); se aplican también en cliente para que la tabla responda al instante mientras llega la
// respuesta y para no mostrar filas que no casen si el backend ignora algún parámetro.

import type {
  SaasCompanyListItem,
  SaasCompanyMerchant,
} from '@/modules/platform-saas/companies/types/saas-company';
import type {
  SaasMerchantTerminal,
  SaasMerchantUser,
} from '@/modules/platform-saas/merchants/types/saas-merchant';

export const ALL = 'all';

function matchesTokens(haystack: Array<string | null | undefined>, search: string): boolean {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack.map((part) => part ?? '').join(' ').toLowerCase();
  return tokens.every((token) => text.includes(token));
}

function matchesStatus(status: string | null | undefined, filter: string): boolean {
  return filter === ALL || (status ?? '').toLowerCase() === filter.toLowerCase();
}

export interface CompanyDirectoryFilters {
  search: string;
  status: string;
  tier: string;
}

export function filterCompanyRows(
  rows: SaasCompanyListItem[],
  filters: CompanyDirectoryFilters,
): SaasCompanyListItem[] {
  return rows.filter(
    (row) =>
      matchesTokens([row.name, row.legalName, row.taxId, row.email], filters.search) &&
      matchesStatus(row.status, filters.status) &&
      (filters.tier === ALL || String(row.subscriptionTier?.planId ?? '') === filters.tier),
  );
}

export interface MerchantDirectoryFilters {
  search: string;
  city: string;
  status: string;
}

export function filterMerchantRows(
  rows: SaasCompanyMerchant[],
  filters: MerchantDirectoryFilters,
): SaasCompanyMerchant[] {
  return rows.filter(
    (row) =>
      matchesTokens([row.name, row.branchCode, row.email], filters.search) &&
      (filters.city === ALL || (row.city ?? '').trim().toLowerCase() === filters.city.trim().toLowerCase()) &&
      matchesStatus(row.status, filters.status),
  );
}

export interface UserDirectoryFilters {
  search: string;
  status: string;
}

export function filterUserRows(rows: SaasMerchantUser[], filters: UserDirectoryFilters): SaasMerchantUser[] {
  return rows.filter(
    (row) =>
      matchesTokens([row.username, row.email, row.role], filters.search) &&
      matchesStatus(row.status, filters.status),
  );
}

export interface TerminalDirectoryFilters {
  search: string;
  status: string;
}

export function filterTerminalRows(
  rows: SaasMerchantTerminal[],
  filters: TerminalDirectoryFilters,
): SaasMerchantTerminal[] {
  return rows.filter(
    (row) =>
      matchesTokens([row.name, row.model, row.deviceIdentifier], filters.search) &&
      matchesStatus(row.status, filters.status),
  );
}

/** Ciudades distintas (para el filtro), ordenadas; usa las del backend si las manda. */
export function cityOptions(rows: SaasCompanyMerchant[], fromMeta: string[] = []): string[] {
  const byKey = new Map<string, string>();
  for (const city of [...fromMeta, ...rows.map((row) => row.city ?? '')]) {
    const trimmed = city.trim();
    if (trimmed && !byKey.has(trimmed.toLowerCase())) byKey.set(trimmed.toLowerCase(), trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** Valor de un filtro para la query del backend (`all` → sin filtro). */
export function queryValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed && trimmed !== ALL ? trimmed : undefined;
}
