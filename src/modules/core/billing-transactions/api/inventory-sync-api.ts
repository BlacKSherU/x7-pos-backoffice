import { apiRequest } from '@/shared/api/http';
import type {
  InventorySyncPage,
  InventorySyncQuery,
  InventorySyncRow,
} from '../types/inventory-sync';

/** Base del módulo billing-inventory-sync del back-end (prefijo global /api, sin versión). */
export const INVENTORY_SYNC_PATH = '/billing/inventory-sync';

const toNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : toNumber(value);

/** Query string sin parámetros vacíos. */
export function inventorySyncQueryString(query: InventorySyncQuery): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  };
  set('invoiceNumber', query.invoiceNumber?.trim());
  set('receiptId', query.receiptId);
  set('sku', query.sku?.trim());
  set('status', query.status);
  set('dateFrom', query.dateFrom);
  set('dateTo', query.dateTo);
  set('page', query.page);
  set('limit', query.limit);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function normalizeRow(raw: InventorySyncRow): InventorySyncRow {
  return {
    ...raw,
    quantitySold: toNumber(raw.quantitySold),
    movements: (raw.movements ?? []).map((m) => ({ ...m, quantity: toNumber(m.quantity) })),
    components: (raw.components ?? []).map((c) => ({
      ...c,
      requiredQty: toNumber(c.requiredQty),
      deductedQty: toNumber(c.deductedQty),
      currentQty: toNullableNumber(c.currentQty),
      minimumQty: toNullableNumber(c.minimumQty),
      shortfall: toNumber(c.shortfall),
      movementIds: c.movementIds ?? [],
    })),
  };
}

/** Grid ReceiptItem → deducciones de stock (`GET /billing/inventory-sync`). */
export async function fetchInventorySyncRows(query: InventorySyncQuery): Promise<InventorySyncPage> {
  const json = await apiRequest<Partial<InventorySyncPage> | undefined>(
    `${INVENTORY_SYNC_PATH}${inventorySyncQueryString(query)}`,
    { method: 'GET' },
    'Failed to load the receipt lines stock deductions.',
  );
  const data = Array.isArray(json?.data) ? json.data.map(normalizeRow) : [];
  const limit = toNumber(json?.limit, query.limit ?? 10);
  const total = toNumber(json?.total, data.length);
  const page = toNumber(json?.page, query.page ?? 1);
  const totalPages = toNumber(json?.totalPages, Math.ceil(total / Math.max(limit, 1)));
  return {
    data,
    page,
    limit,
    total,
    totalPages,
    hasNext: json?.hasNext ?? page < totalPages,
    hasPrev: json?.hasPrev ?? page > 1,
  };
}
