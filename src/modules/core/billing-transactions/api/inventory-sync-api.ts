import { apiRequest } from '@/shared/api/http';
import {
  INVENTORY_DEDUCTION_STATUSES,
  type InventoryDeductionStatus,
  type InventorySyncMetrics,
  type InventorySyncMetricsQuery,
  type InventorySyncPage,
  type InventorySyncQuery,
  type InventorySyncRow,
  type LowStockWarning,
  type StockAvailabilityResult,
  type ValidateStockRequest,
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

function normalizeWarning(raw: LowStockWarning): LowStockWarning {
  return {
    ...raw,
    currentQty: toNumber(raw.currentQty),
    minimumQty: toNullableNumber(raw.minimumQty),
    soldQty: toNumber(raw.soldQty),
  };
}

/** KPIs del header (`GET /billing/inventory-sync/metrics`); sin fechas, los últimos 7 días. */
export async function fetchInventorySyncMetrics(
  query: InventorySyncMetricsQuery = {},
): Promise<InventorySyncMetrics> {
  const params = new URLSearchParams();
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  const qs = params.toString();
  const json = await apiRequest<{ data?: InventorySyncMetrics } | undefined>(
    `${INVENTORY_SYNC_PATH}/metrics${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
    'Failed to load the inventory sync metrics.',
  );
  const data = json?.data;
  if (!data) throw new Error('Failed to load the inventory sync metrics.');
  const statusCounts = Object.fromEntries(
    INVENTORY_DEDUCTION_STATUSES.map((status) => [status, toNumber(data.statusCounts?.[status])]),
  ) as Record<InventoryDeductionStatus, number>;
  const lowStock = data.lowStock ?? { total: 0, outOfStock: 0, low: 0, activeAlerts: 0, warnings: [] };
  return {
    ...data,
    salesLocation: data.salesLocation ?? null,
    linesEvaluated: toNumber(data.linesEvaluated),
    itemsDeducted: toNumber(data.itemsDeducted),
    unitsDeducted: toNumber(data.unitsDeducted),
    scanLimitReached: !!data.scanLimitReached,
    statusCounts,
    lowStock: {
      total: toNumber(lowStock.total),
      outOfStock: toNumber(lowStock.outOfStock),
      low: toNumber(lowStock.low),
      activeAlerts: toNumber(lowStock.activeAlerts),
      warnings: (lowStock.warnings ?? []).map(normalizeWarning),
    },
  };
}

/** Validación de stock previa a facturar (`POST /billing/inventory-sync/validate-stock`). */
export async function validateStockAvailability(
  request: ValidateStockRequest,
): Promise<StockAvailabilityResult> {
  const json = await apiRequest<{ data?: StockAvailabilityResult } | undefined>(
    `${INVENTORY_SYNC_PATH}/validate-stock`,
    { method: 'POST', body: JSON.stringify(request) },
    'Failed to validate the stock availability.',
  );
  const data = json?.data;
  if (!data) throw new Error('Failed to validate the stock availability.');
  return {
    ...data,
    items: (data.items ?? []).map((line) => ({
      ...line,
      quantity: toNumber(line.quantity),
      components: (line.components ?? []).map((c) => ({
        ...c,
        requiredQty: toNumber(c.requiredQty),
        totalDemand: toNumber(c.totalDemand),
        availableQty: toNumber(c.availableQty),
        remainingAfterSale: toNumber(c.remainingAfterSale),
        minimumQty: toNullableNumber(c.minimumQty),
        shortfall: toNumber(c.shortfall),
      })),
    })),
  };
}
