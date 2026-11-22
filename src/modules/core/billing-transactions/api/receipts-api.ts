import { apiRequest } from '@/shared/api/http';
import type {
  CreateReceiptPayload,
  PaginatedReceipts,
  Receipt,
  ReceiptListQuery,
  ReceiptSummary,
  ReceiptSummaryQuery,
  UpdateReceiptPayload,
} from '../types/receipts';

const BASE = '/receipts';

type Envelope<T> = { data: T };

/** Los decimal(12,2) pueden llegar como string desde Postgres: siempre a number. */
export function normalizeReceipt(raw: Receipt): Receipt {
  return {
    ...raw,
    invoice_number: raw.invoice_number ?? null,
    fiscal_data: raw.fiscal_data ?? null,
    subtotal: Number(raw.subtotal ?? 0),
    total_tax: Number(raw.total_tax ?? 0),
    total_discount: Number(raw.total_discount ?? 0),
    grand_total: Number(raw.grand_total ?? 0),
    currency: raw.currency || 'USD',
    is_active: raw.is_active ?? true,
    is_locked: Boolean(raw.is_locked),
  };
}

/** Query string sin parámetros vacíos (el back-end rechaza propiedades vacías en enums). */
export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** GET /receipts — listado paginado con búsqueda (invoice_number / fiscal_data) y filtros. */
export async function listReceipts(query: ReceiptListQuery = {}): Promise<PaginatedReceipts> {
  const json = await apiRequest<PaginatedReceipts>(
    `${BASE}${toQueryString({
      page: query.page,
      limit: query.limit,
      search: query.search?.trim(),
      type: query.type,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortBy ? query.sortOrder : undefined,
    })}`,
    { method: 'GET' },
    'Failed to load receipts.',
  );
  return {
    data: (json?.data ?? []).map(normalizeReceipt),
    page: json?.page ?? query.page ?? 1,
    limit: json?.limit ?? query.limit ?? 10,
    total: json?.total ?? 0,
    totalPages: json?.totalPages ?? 0,
    hasNext: Boolean(json?.hasNext),
    hasPrev: Boolean(json?.hasPrev),
  };
}

/** POST /receipts */
export async function createReceipt(payload: CreateReceiptPayload): Promise<Receipt> {
  const json = await apiRequest<Envelope<Receipt>>(
    BASE,
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create the receipt.',
  );
  return normalizeReceipt(json.data);
}

/** PATCH /receipts/:id — edición parcial. */
export async function updateReceipt(id: number, payload: UpdateReceiptPayload): Promise<Receipt> {
  const json = await apiRequest<Envelope<Receipt>>(
    `${BASE}/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update the receipt.',
  );
  return normalizeReceipt(json.data);
}

/** PATCH /receipts/:id/status — baja lógica (false) o reactivación (true). */
export async function setReceiptStatus(id: number, isActive: boolean): Promise<Receipt> {
  const json = await apiRequest<Envelope<Receipt>>(
    `${BASE}/${id}/status`,
    { method: 'PATCH', body: JSON.stringify({ isActive }) },
    isActive ? 'Failed to reactivate the receipt.' : 'Failed to deactivate the receipt.',
  );
  return normalizeReceipt(json.data);
}

/** GET /receipts/summary — conteos y sumas de grand_total del merchant filtrados por is_active. */
export async function getReceiptsSummary(query: ReceiptSummaryQuery = {}): Promise<ReceiptSummary> {
  const json = await apiRequest<Envelope<ReceiptSummary>>(
    `${BASE}/summary${toQueryString({ status: query.status })}`,
    { method: 'GET' },
    'Failed to load the receipts summary.',
  );
  const data = json.data;
  return {
    ...data,
    currency: data.currency || 'USD',
    grand_total: Number(data.grand_total ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    total_tax: Number(data.total_tax ?? 0),
    total_discount: Number(data.total_discount ?? 0),
    average_ticket: Number(data.average_ticket ?? 0),
    by_type: data.by_type ?? [],
    by_currency: data.by_currency ?? [],
  };
}
