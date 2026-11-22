import { apiRequest } from '@/shared/api/http';
import type {
  PaginatedResult,
  PartnerOption,
  PartnerSyncMetrics,
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
  const json = await apiRequest<PaginatedResult<PartnerSyncReceipt>>(
    `${BASE}/receipts${buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search?.trim(),
      linkState: params.linkState && params.linkState !== 'all' ? params.linkState : undefined,
      type: params.type,
      scope: params.scope,
      merchantId: params.merchantId,
    })}`,
    { method: 'GET' },
    'Failed to load receipts.',
  );
  return {
    data: json.data ?? [],
    page: json.page ?? 1,
    limit: json.limit ?? params.limit ?? 10,
    total: json.total ?? 0,
    totalPages: json.totalPages ?? 0,
    hasNext: Boolean(json.hasNext),
    hasPrev: Boolean(json.hasPrev),
  };
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
