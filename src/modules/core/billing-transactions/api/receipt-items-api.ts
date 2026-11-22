import { apiRequest } from '@/shared/api/http';
import type {
  CreateReceiptItemPayload,
  PaginatedResponse,
  ReceiptItem,
  ReceiptItemOption,
  ReceiptItemsQuery,
  ReceiptOption,
  UpdateReceiptItemPayload,
} from '../types/receipt-items';

interface OneResponse<T> {
  statusCode?: number;
  message?: string;
  data: T;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** TypeORM can serialise decimal columns as strings: normalise to numbers once, here. */
export function normalizeReceiptItem(raw: Record<string, unknown>): ReceiptItem {
  return {
    ...(raw as unknown as ReceiptItem),
    receipt_invoice_number: (raw.receipt_invoice_number as string | null | undefined) ?? null,
    receipt_is_locked: raw.receipt_is_locked === true,
    currency: (raw.currency as string | undefined) || 'USD',
    sku: (raw.sku as string | null | undefined) ?? null,
    metadata: (raw.metadata as string | null | undefined) ?? null,
    quantity: toNumber(raw.quantity),
    unit_price: toNumber(raw.unit_price),
    subtotal: toNumber(raw.subtotal),
    discount_amount: toNumber(raw.discount_amount),
    total: toNumber(raw.total),
    is_active: raw.is_active !== false,
  };
}

export function buildReceiptItemsQueryString(query: ReceiptItemsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchReceiptItems(
  query: ReceiptItemsQuery = {},
): Promise<PaginatedResponse<ReceiptItem>> {
  const json = await apiRequest<PaginatedResponse<Record<string, unknown>>>(
    `/receipt-items${buildReceiptItemsQueryString(query)}`,
    { method: 'GET' },
    'Failed to load receipt items.',
  );
  return {
    ...json,
    data: (json?.data ?? []).map(normalizeReceiptItem),
    page: json?.page ?? 1,
    limit: json?.limit ?? query.limit ?? 10,
    total: json?.total ?? 0,
    totalPages: json?.totalPages ?? 0,
    hasNext: Boolean(json?.hasNext),
    hasPrev: Boolean(json?.hasPrev),
  };
}

export async function createReceiptItem(payload: CreateReceiptItemPayload): Promise<ReceiptItem> {
  const json = await apiRequest<OneResponse<Record<string, unknown>>>(
    '/receipt-items',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create the receipt item.',
  );
  return normalizeReceiptItem(json.data);
}

export async function updateReceiptItem(
  id: number,
  payload: UpdateReceiptItemPayload,
): Promise<ReceiptItem> {
  const json = await apiRequest<OneResponse<Record<string, unknown>>>(
    `/receipt-items/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update the receipt item.',
  );
  return normalizeReceiptItem(json.data);
}

/** Logical deletion (is_active = false); the server recalculates the receipt totals. */
export async function deleteReceiptItem(id: number): Promise<ReceiptItem> {
  const json = await apiRequest<OneResponse<Record<string, unknown>>>(
    `/receipt-items/${id}`,
    { method: 'DELETE' },
    'Failed to delete the receipt item.',
  );
  return normalizeReceiptItem(json.data);
}

/** Restores a logically deleted line (PATCH isActive=true). */
export function restoreReceiptItem(id: number): Promise<ReceiptItem> {
  return updateReceiptItem(id, { isActive: true });
}

/** Distinct items (name + SKU) for the item selector of the header. */
export async function fetchReceiptItemOptions(): Promise<ReceiptItemOption[]> {
  const json = await apiRequest<OneResponse<Array<Record<string, unknown>>>>(
    '/receipt-items/item-options',
    { method: 'GET' },
    'Failed to load item options.',
  );
  return (json?.data ?? []).map((raw) => ({
    name: String(raw.name ?? ''),
    sku: (raw.sku as string | null | undefined) ?? null,
    line_count: toNumber(raw.line_count),
  }));
}

/**
 * Active receipts of the merchant for the receipt selector. Uses the existing
 * GET /receipts endpoint (max page size 100, newest first).
 */
export async function fetchReceiptOptions(): Promise<ReceiptOption[]> {
  const json = await apiRequest<PaginatedResponse<Record<string, unknown>>>(
    '/receipts?limit=100&page=1',
    { method: 'GET' },
    'Failed to load receipts.',
  );
  return (json?.data ?? []).map((raw) => ({
    id: toNumber(raw.id),
    order_id: toNumber(raw.order_id),
    type: String(raw.type ?? ''),
    grand_total: toNumber(raw.grand_total),
    currency: (raw.currency as string | undefined) || 'USD',
    invoice_number: (raw.invoice_number as string | null | undefined) ?? null,
    created_at: raw.created_at as string | undefined,
    is_locked: raw.is_locked === true,
  }));
}
