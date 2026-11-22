import { apiRequest } from '@/shared/api/http';
import type {
  CreateReceiptTaxPayload,
  ReceiptItemOption,
  ReceiptOption,
  ReceiptTax,
  ReceiptTaxHeaderFilters,
  ReceiptTaxListQuery,
  ReceiptTaxListResult,
  ReceiptTaxesSummary,
  UpdateReceiptTaxPayload,
} from '../types/receipt-taxes';

// Client of /api/receipt-taxes (Billing & Transactions → Receipt Taxes).
// Also reads /api/receipts and /api/receipt-items to pick the receipt and line a tax applies to.

type Raw = Record<string, unknown>;

const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const strOrNull = (value: unknown): string | null =>
  value === null || value === undefined || value === '' ? null : String(value);

export function normalizeReceiptTax(raw: Raw): ReceiptTax {
  return {
    id: num(raw.id),
    receipt_id: num(raw.receipt_id),
    receipt_item_id: raw.receipt_item_id == null ? null : num(raw.receipt_item_id),
    name: String(raw.name ?? ''),
    rate: num(raw.rate),
    amount: num(raw.amount),
    scope: raw.scope === 'ITEM' ? 'ITEM' : 'RECEIPT',
    is_active: raw.is_active !== false,
    receipt_invoice_number: strOrNull(raw.receipt_invoice_number),
    receipt_is_locked: raw.receipt_is_locked === true,
    currency: strOrNull(raw.currency),
    receipt_item_name: strOrNull(raw.receipt_item_name),
    receipt_total_tax: raw.receipt_total_tax == null ? null : num(raw.receipt_total_tax),
    receipt_grand_total: raw.receipt_grand_total == null ? null : num(raw.receipt_grand_total),
    created_at: String(raw.created_at ?? ''),
  };
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchReceiptTaxes(
  query: ReceiptTaxListQuery = {},
): Promise<ReceiptTaxListResult> {
  const json = await apiRequest<{
    data?: Raw[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  }>(
    `/receipt-taxes${toQueryString({
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      receiptId: query.receiptId,
      scope: query.scope,
      name: query.name?.trim() || undefined,
      taxName: query.taxName || undefined,
      rate: query.rate,
      status: query.status ?? 'all',
    })}`,
    { method: 'GET' },
    'Failed to load receipt taxes.',
  );
  const data = (json?.data ?? []).map(normalizeReceiptTax);
  return {
    data,
    page: json?.page ?? 1,
    limit: json?.limit ?? data.length,
    total: json?.total ?? data.length,
    totalPages: json?.totalPages ?? 1,
  };
}

/** Consolidated metrics of the analytical header, filtered by tax type and rate. */
export async function fetchReceiptTaxesSummary(
  filters: ReceiptTaxHeaderFilters = {},
): Promise<ReceiptTaxesSummary> {
  const json = await apiRequest<{ data?: Partial<ReceiptTaxesSummary> }>(
    `/receipt-taxes/summary${toQueryString({ taxName: filters.taxName || undefined, rate: filters.rate })}`,
    { method: 'GET' },
    'Failed to load receipt tax metrics.',
  );
  const d = json?.data ?? {};
  return {
    total_count: num(d.total_count),
    active_count: num(d.active_count),
    inactive_count: num(d.inactive_count),
    receipts_count: num(d.receipts_count),
    totals_by_currency: (d.totals_by_currency ?? []).map((t) => ({
      currency: String(t.currency ?? 'USD'),
      total_amount: num(t.total_amount),
      receipt_scope_amount: num(t.receipt_scope_amount),
      item_scope_amount: num(t.item_scope_amount),
    })),
    by_scope: (d.by_scope ?? []).map((r) => ({
      scope: r.scope === 'ITEM' ? 'ITEM' : 'RECEIPT',
      currency: String(r.currency ?? 'USD'),
      count: num(r.count),
      total_amount: num(r.total_amount),
    })),
    by_type: (d.by_type ?? []).map((r) => ({
      name: String(r.name ?? ''),
      rate: num(r.rate),
      currency: String(r.currency ?? 'USD'),
      count: num(r.count),
      total_amount: num(r.total_amount),
    })),
    filter_options: {
      names: (d.filter_options?.names ?? []).map(String),
      rates: (d.filter_options?.rates ?? []).map(num),
    },
  };
}

export async function createReceiptTax(payload: CreateReceiptTaxPayload): Promise<ReceiptTax> {
  const json = await apiRequest<{ data: Raw }>(
    '/receipt-taxes',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create receipt tax.',
  );
  return normalizeReceiptTax(json.data);
}

export async function updateReceiptTax(
  id: number,
  payload: UpdateReceiptTaxPayload,
): Promise<ReceiptTax> {
  const json = await apiRequest<{ data: Raw }>(
    `/receipt-taxes/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update receipt tax.',
  );
  return normalizeReceiptTax(json.data);
}

/** Activates or deactivates a tax (never deletes it). */
export async function setReceiptTaxStatus(id: number, isActive: boolean): Promise<ReceiptTax> {
  const json = await apiRequest<{ data: Raw }>(
    `/receipt-taxes/${id}/status`,
    { method: 'PATCH', body: JSON.stringify({ isActive }) },
    'Failed to change receipt tax status.',
  );
  return normalizeReceiptTax(json.data);
}

/** Receipts of the merchant to attach a tax to (GET /receipts, max 100 per page). */
export async function fetchReceiptOptions(): Promise<ReceiptOption[]> {
  const json = await apiRequest<{ data?: Raw[] }>(
    '/receipts?limit=100',
    { method: 'GET' },
    'Failed to load receipts.',
  );
  return (json?.data ?? []).map((raw) => ({
    id: num(raw.id),
    invoice_number: strOrNull(raw.invoice_number),
    type: strOrNull(raw.type),
    subtotal: num(raw.subtotal),
    grand_total: num(raw.grand_total),
    currency: String(raw.currency ?? 'USD'),
    is_locked: raw.is_locked === true,
  }));
}

/** Active lines of one receipt (GET /receipt-items?receiptId=). */
export async function fetchReceiptItemOptions(receiptId: number): Promise<ReceiptItemOption[]> {
  const json = await apiRequest<{ data?: Raw[] }>(
    `/receipt-items?receiptId=${receiptId}&limit=100`,
    { method: 'GET' },
    'Failed to load receipt items.',
  );
  return (json?.data ?? []).map((raw) => ({
    id: num(raw.id),
    receipt_id: num(raw.receipt_id),
    name: String(raw.name ?? ''),
    sku: strOrNull(raw.sku),
    subtotal: num(raw.subtotal),
    discount_amount: num(raw.discount_amount),
    total: num(raw.total),
  }));
}
