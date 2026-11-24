import { apiRequest } from '@/shared/api/http';
import type {
  CreateReceiptPayload,
  PaginatedReceipts,
  Receipt,
  ReceiptActivityLog,
  ReceiptDetails,
  ReceiptListQuery,
  ReceiptOrderOptions,
  ReceiptOrderOptionsQuery,
  ReceiptSummary,
  ReceiptSummaryQuery,
  ReceiptTaxBreakdown,
  ReceiptTotalsSnapshot,
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
    processed_by_user_id: raw.processed_by_user_id ?? null,
    processed_by_role: raw.processed_by_role ?? null,
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

/** GET /receipts/order-options — órdenes facturables del merchant para el selector de NEW RECEIPT. */
export async function listReceiptOrderOptions(
  query: ReceiptOrderOptionsQuery = {},
): Promise<ReceiptOrderOptions> {
  const json = await apiRequest<Envelope<ReceiptOrderOptions>>(
    `${BASE}/order-options${toQueryString({
      search: query.search?.trim(),
      type: query.type,
      includeOrderId: query.includeOrderId,
      limit: query.limit,
    })}`,
    { method: 'GET' },
    'Failed to load orders.',
  );
  return {
    default_currency: json.data?.default_currency || null,
    orders: (json.data?.orders ?? []).map((order) => ({
      ...order,
      total: Number(order.total ?? 0),
      customer_name: order.customer_name ?? null,
      issued_types: order.issued_types ?? [],
    })),
  };
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
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
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

/**
 * PATCH /receipts/:id/lock — bloqueo fiscal (Historia 11). El back-end registra el usuario y
 * el rol que bloquean; desde entonces el recibo, sus líneas e impuestos son inmutables (403).
 */
export async function lockReceipt(id: number): Promise<Receipt> {
  const json = await apiRequest<Envelope<Receipt>>(
    `${BASE}/${id}/lock`,
    { method: 'PATCH' },
    'Failed to lock the receipt.',
  );
  return normalizeReceipt(json.data);
}

/** GET /receipts/summary — conteos y sumas de grand_total del merchant filtrados por is_active. */
export async function getReceiptsSummary(query: ReceiptSummaryQuery = {}): Promise<ReceiptSummary> {
  const json = await apiRequest<Envelope<ReceiptSummary>>(
    `${BASE}/summary${toQueryString({ status: query.status, dateFrom: query.dateFrom, dateTo: query.dateTo })}`,
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

/** GET /receipts/:id/details — líneas e impuestos del recibo (se carga al expandir la fila). */
export async function getReceiptDetails(id: number): Promise<ReceiptDetails> {
  const json = await apiRequest<Envelope<ReceiptDetails>>(
    `${BASE}/${id}/details`,
    { method: 'GET' },
    'Failed to load the receipt details.',
  );
  const data = json.data;
  return {
    receipt: normalizeReceipt(data.receipt),
    items: (data.items ?? []).map((item) => ({
      ...item,
      sku: item.sku ?? null,
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
      discount_amount: Number(item.discount_amount ?? 0),
      total: Number(item.total ?? 0),
    })),
    taxes: (data.taxes ?? []).map((tax) => ({
      ...tax,
      receipt_item_id: tax.receipt_item_id ?? null,
      rate: Number(tax.rate ?? 0),
      amount: Number(tax.amount ?? 0),
    })),
    items_total: Number(data.items_total ?? 0),
    taxes_total: Number(data.taxes_total ?? 0),
  };
}

/** GET /receipts/tax-breakdown — total de impuesto cobrado por tipo, con los filtros activos. */
export async function getReceiptTaxBreakdown(query: ReceiptSummaryQuery = {}): Promise<ReceiptTaxBreakdown> {
  const json = await apiRequest<Envelope<ReceiptTaxBreakdown>>(
    `${BASE}/tax-breakdown${toQueryString({ status: query.status, dateFrom: query.dateFrom, dateTo: query.dateTo })}`,
    { method: 'GET' },
    'Failed to load the tax breakdown.',
  );
  const data = json.data;
  return {
    status: data.status,
    date_from: data.date_from ?? null,
    date_to: data.date_to ?? null,
    currency: data.currency || 'USD',
    total_tax: Number(data.total_tax ?? 0),
    by_tax: (data.by_tax ?? []).map((entry) => ({
      ...entry,
      currency: entry.currency || 'USD',
      rate: Number(entry.rate ?? 0),
      total_amount: Number(entry.total_amount ?? 0),
      tax_lines: Number(entry.tax_lines ?? 0),
      receipts: Number(entry.receipts ?? 0),
    })),
    by_currency: (data.by_currency ?? []).map((entry) => ({
      currency: entry.currency || 'USD',
      total_amount: Number(entry.total_amount ?? 0),
      tax_lines: Number(entry.tax_lines ?? 0),
    })),
  };
}

function normalizeTotals(raw: ReceiptTotalsSnapshot | null | undefined): ReceiptTotalsSnapshot | null {
  if (!raw) return null;
  return {
    subtotal: Number(raw.subtotal ?? 0),
    total_tax: Number(raw.total_tax ?? 0),
    total_discount: Number(raw.total_discount ?? 0),
    grand_total: Number(raw.grand_total ?? 0),
  };
}

/**
 * GET /receipts/:id/activity-log — audit trail del recibo (Historia 6): eventos en orden
 * cronológico exacto con usuario, rol y totales antes / después de cada uno.
 */
export async function getReceiptActivityLog(id: number): Promise<ReceiptActivityLog> {
  const json = await apiRequest<Envelope<ReceiptActivityLog>>(
    `${BASE}/${id}/activity-log`,
    { method: 'GET' },
    'Failed to load the activity log.',
  );
  const data = json.data;
  return {
    receipt_id: data.receipt_id,
    invoice_number: data.invoice_number ?? null,
    currency: data.currency || 'USD',
    events: (data.events ?? []).map((event) => ({
      ...event,
      user_id: event.user_id ?? null,
      user_name: event.user_name ?? null,
      role: event.role ?? null,
      previous_values: normalizeTotals(event.previous_values),
      new_values: normalizeTotals(event.new_values),
      metadata: event.metadata ?? null,
    })),
  };
}
