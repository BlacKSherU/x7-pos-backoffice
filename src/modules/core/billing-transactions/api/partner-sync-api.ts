import { apiRequest } from '@/shared/api/http';
import type {
  CompanyMerchant,
  PaginatedPartnerGroups,
  PaginatedResult,
  PartnerGroupsParams,
  PartnerOption,
  PartnerSyncMetrics,
  PartnerSyncPartnerFilterParams,
  PartnerSyncReceipt,
  PartnerSyncReceiptsParams,
  PartnerSyncScopeParams,
  PartnerType,
} from '../types/partner-sync';

const BASE = '/billing/partner-sync';

type QueryValue = string | number | boolean | null | undefined;

/** Query string sin los parámetros vacíos (`?a=1&b=x`, o '' si no queda ninguno). */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Parámetros de filtro por socio (linkState=all se omite: es el valor por defecto). */
function partnerFilterQuery(params: PartnerSyncPartnerFilterParams): Record<string, QueryValue> {
  return {
    page: params.page,
    limit: params.limit,
    partnerType: params.partnerType,
    customerId: params.customerId,
    supplierId: params.supplierId,
    association: params.association,
    linkState: params.linkState && params.linkState !== 'all' ? params.linkState : undefined,
    type: params.type,
    scope: params.scope,
    merchantId: params.merchantId,
  };
}

function toPage<T>(json: Partial<PaginatedResult<T>>, fallbackLimit: number): PaginatedResult<T> {
  return {
    data: json.data ?? [],
    page: json.page ?? 1,
    limit: json.limit ?? fallbackLimit,
    total: json.total ?? 0,
    totalPages: json.totalPages ?? 0,
    hasNext: Boolean(json.hasNext),
    hasPrev: Boolean(json.hasPrev),
  };
}

interface Envelope<T> {
  statusCode?: number;
  message?: string | string[];
  data: T;
}

/** KPIs del header BUSINESS PARTNERS BILLING LINK. */
export async function fetchPartnerSyncMetrics(
  params: PartnerSyncScopeParams = {},
): Promise<PartnerSyncMetrics> {
  const json = await apiRequest<Envelope<PartnerSyncMetrics>>(
    `${BASE}/metrics${buildQuery({ scope: params.scope, merchantId: params.merchantId })}`,
    { method: 'GET' },
    'Failed to load partner billing metrics.',
  );
  return json.data;
}

/** Clientes o proveedores de la compañía que se pueden enlazar con un recibo. */
export async function fetchPartnerOptions(
  type: PartnerType,
  search?: string,
  limit = 50,
): Promise<PartnerOption[]> {
  const json = await apiRequest<Envelope<PartnerOption[]>>(
    `${BASE}/partner-options${buildQuery({ type, search: search?.trim(), limit })}`,
    { method: 'GET' },
    'Failed to load business partners.',
  );
  return json.data ?? [];
}

/** Recibos activos con su socio efectivo (enlace explícito o cliente de la orden). */
export async function fetchPartnerSyncReceipts(
  params: PartnerSyncReceiptsParams = {},
): Promise<PaginatedResult<PartnerSyncReceipt>> {
  const { page, limit, ...filters } = partnerFilterQuery(params);
  const json = await apiRequest<PaginatedResult<PartnerSyncReceipt>>(
    `${BASE}/receipts${buildQuery({ page, limit, search: params.search?.trim(), ...filters })}`,
    { method: 'GET' },
    'Failed to load receipts.',
  );
  return toPage(json, params.limit ?? 10);
}

/** Grid BillingPartnerSyncGrid: recibos agrupados por cliente / proveedor (Historia 22). */
export async function fetchPartnerGroups(params: PartnerGroupsParams = {}): Promise<PaginatedPartnerGroups> {
  const { page, limit, ...filters } = partnerFilterQuery(params);
  const json = await apiRequest<PaginatedPartnerGroups>(
    `${BASE}/partners${buildQuery({
      page,
      limit,
      search: params.search?.trim(),
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      ...filters,
    })}`,
    { method: 'GET' },
    'Failed to load business partner billing.',
  );
  return {
    ...toPage(json, params.limit ?? 10),
    summary: {
      partners: json.summary?.partners ?? json.total ?? 0,
      invoices: json.summary?.invoices ?? 0,
      total_volume: json.summary?.total_volume ?? 0,
    },
  };
}

/** Sucursales de la compañía (filtro de asociaciones de compañía del grid). */
export async function fetchCompanyMerchants(): Promise<CompanyMerchant[]> {
  const json = await apiRequest<Envelope<CompanyMerchant[]>>(
    `${BASE}/company-merchants`,
    { method: 'GET' },
    'Failed to load company merchants.',
  );
  return json.data ?? [];
}

/** LINK CUSTOMER PROFILE: asigna (o reasigna) el recibo a un cliente o proveedor. */
export async function linkReceiptToPartner(
  receiptId: number,
  partnerType: PartnerType,
  partnerId: number,
): Promise<PartnerSyncReceipt> {
  const json = await apiRequest<Envelope<PartnerSyncReceipt>>(
    `${BASE}/receipts/${receiptId}/partner`,
    { method: 'PATCH', body: JSON.stringify({ partnerType, partnerId }) },
    'Failed to link the receipt to the business partner.',
  );
  return json.data;
}

/** Reasignación rápida: quita el enlace explícito; el recibo vuelve al cliente de su orden. */
export async function unlinkReceiptPartner(receiptId: number): Promise<PartnerSyncReceipt> {
  const json = await apiRequest<Envelope<PartnerSyncReceipt>>(
    `${BASE}/receipts/${receiptId}/partner`,
    { method: 'DELETE' },
    'Failed to remove the business partner link.',
  );
  return json.data;
}
