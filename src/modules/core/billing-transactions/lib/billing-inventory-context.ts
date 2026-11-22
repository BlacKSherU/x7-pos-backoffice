/**
 * Contexto de facturación que viaja entre la vista "Inventory & Billing Stock Sync" y las vistas
 * de inventario a las que salta el Quick Launch.
 *
 * - Se guarda en sessionStorage (por pestaña del navegador) cada vez que cambian los filtros o la
 *   línea de recibo seleccionada, así que al volver (botón Atrás, menú lateral o NavHubBar) la
 *   vista restaura el mismo recibo, filtros y página.
 * - Además se copia en la query de la URL de destino (`from`, `invoice`, `receiptId`, `sku` e
 *   `itemId`). MovementsView ya filtra por `itemId`; el resto lo ignoran las vistas de inventario.
 *
 * Las vistas de inventario no se modifican: el contexto vive aquí y lo restaura la vista de
 * facturación.
 */

export const BILLING_INVENTORY_SYNC_TAB = 'billing-inventory-sync';
export const BILLING_INVENTORY_SYNC_PATH = '/billing/inventory-sync';
export const BILLING_INVENTORY_SYNC_PATHS: readonly string[] = [
  BILLING_INVENTORY_SYNC_PATH,
  '/app/billing-transactions/billing-inventory-sync',
];

const STORAGE_KEY = 'x7:billing-inventory-sync:context';

export type InventoryQuickLaunchTarget = 'stock-levels' | 'reconcile' | 'audit-movements';

export interface BillingInventoryFilters {
  invoiceNumber: string;
  /** Estado de deducción (`DEDUCTED`, `PENDING`…) o '' para todos. */
  status: string;
  /** YYYY-MM-DD o ''. */
  dateFrom: string;
  /** YYYY-MM-DD o ''. */
  dateTo: string;
  page: number;
  limit: number;
}

/** Línea de recibo elegida en el grid (lo que identifica qué se investiga en inventario). */
export interface BillingInventorySelection {
  receiptItemId: number;
  receiptId: number;
  invoiceNumber: string | null;
  sku: string | null;
  orderId: number | null;
  /** Stock item del primer componente deducido (filtra el kardex de MovementsView). */
  stockItemId: number | null;
}

export interface BillingInventoryContextInput {
  filters: BillingInventoryFilters;
  selection: BillingInventorySelection | null;
}

export interface BillingInventoryContext extends BillingInventoryContextInput {
  /** Vista de inventario a la que se saltó por última vez. */
  lastTarget?: InventoryQuickLaunchTarget;
  savedAt: string;
}

export const DEFAULT_BILLING_INVENTORY_FILTERS: BillingInventoryFilters = {
  invoiceNumber: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 10,
};

export interface InventoryTargetDefinition {
  label: string;
  icon: string;
  /** Pestaña de MerchantFrame (fallback cuando no hay navegación por URL). */
  tab: string;
  /** URL registrada en merchant-routes.ts. */
  path: string;
  /** Si la URL lleva `itemId` (MovementsView filtra por él). */
  carriesStockItem: boolean;
}

export const INVENTORY_QUICK_LAUNCH_TARGETS: Record<InventoryQuickLaunchTarget, InventoryTargetDefinition> = {
  'stock-levels': {
    label: 'VIEW STOCK LEVELS',
    icon: 'inventory',
    tab: 'stock-inventory',
    path: '/inventory/stock-inventory',
    carriesStockItem: false,
  },
  reconcile: {
    label: 'RECONCILE INVENTORY',
    icon: 'fact_check',
    tab: 'stock-movements',
    path: '/inventory/stock-movements',
    carriesStockItem: true,
  },
  'audit-movements': {
    label: 'AUDIT WAREHOUSE MOVEMENTS',
    icon: 'swap_vert',
    tab: 'movements',
    path: '/inventory/movements',
    carriesStockItem: true,
  },
};

export const INVENTORY_QUICK_LAUNCH_ORDER: InventoryQuickLaunchTarget[] = [
  'stock-levels',
  'reconcile',
  'audit-movements',
];

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asPositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const asNullableId = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

function normalizeFilters(raw: unknown): BillingInventoryFilters {
  if (!isRecord(raw)) return { ...DEFAULT_BILLING_INVENTORY_FILTERS };
  return {
    invoiceNumber: asString(raw.invoiceNumber),
    status: asString(raw.status),
    dateFrom: asString(raw.dateFrom),
    dateTo: asString(raw.dateTo),
    page: asPositiveInt(raw.page, DEFAULT_BILLING_INVENTORY_FILTERS.page),
    limit: asPositiveInt(raw.limit, DEFAULT_BILLING_INVENTORY_FILTERS.limit),
  };
}

function normalizeSelection(raw: unknown): BillingInventorySelection | null {
  if (!isRecord(raw)) return null;
  const receiptItemId = asNullableId(raw.receiptItemId);
  const receiptId = asNullableId(raw.receiptId);
  if (receiptItemId == null || receiptId == null) return null;
  return {
    receiptItemId,
    receiptId,
    invoiceNumber: asNullableString(raw.invoiceNumber),
    sku: asNullableString(raw.sku),
    orderId: asNullableId(raw.orderId),
    stockItemId: asNullableId(raw.stockItemId),
  };
}

export function saveBillingInventoryContext(
  context: BillingInventoryContextInput,
  lastTarget?: InventoryQuickLaunchTarget,
): void {
  const store = storage();
  if (!store) return;
  const payload: BillingInventoryContext = {
    filters: context.filters,
    selection: context.selection,
    ...(lastTarget ? { lastTarget } : {}),
    savedAt: new Date().toISOString(),
  };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Almacenamiento lleno o bloqueado: la navegación sigue funcionando sin restaurar.
  }
}

export function loadBillingInventoryContext(): BillingInventoryContext | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const lastTarget = asString(parsed.lastTarget);
    return {
      filters: normalizeFilters(parsed.filters),
      selection: normalizeSelection(parsed.selection),
      ...(lastTarget in INVENTORY_QUICK_LAUNCH_TARGETS
        ? { lastTarget: lastTarget as InventoryQuickLaunchTarget }
        : {}),
      savedAt: asString(parsed.savedAt),
    };
  } catch {
    return null;
  }
}

export function clearBillingInventoryContext(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

/**
 * Filtros que fija la URL de la vista (`/billing/inventory-sync?invoice=…&status=…&from=…&to=…`).
 * Solo se leen cuando la URL actual es la de la vista, para no heredar query ajena.
 */
export function filtersFromLocation(
  pathname: string,
  search: string,
): Partial<BillingInventoryFilters> | null {
  if (!BILLING_INVENTORY_SYNC_PATHS.includes(pathname)) return null;
  const params = new URLSearchParams(search);
  const partial: Partial<BillingInventoryFilters> = {};
  const invoice = params.get('invoice');
  if (invoice) partial.invoiceNumber = invoice;
  const status = params.get('status');
  if (status) partial.status = status;
  const from = params.get('dateFrom');
  if (from) partial.dateFrom = from;
  const to = params.get('dateTo');
  if (to) partial.dateTo = to;
  return Object.keys(partial).length > 0 ? partial : null;
}

/** Contexto con el que arranca la vista: query de la URL > contexto guardado > valores por defecto. */
export function initialBillingInventoryContext(
  pathname = typeof window === 'undefined' ? '' : window.location.pathname,
  search = typeof window === 'undefined' ? '' : window.location.search,
): BillingInventoryContextInput {
  const stored = loadBillingInventoryContext();
  const fromUrl = filtersFromLocation(pathname, search);
  if (fromUrl) {
    return {
      filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS, ...fromUrl },
      selection: null,
    };
  }
  if (stored) {
    return { filters: stored.filters, selection: stored.selection };
  }
  return { filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS }, selection: null };
}

/** URL de la vista de inventario con el contexto de facturación en la query. */
export function buildInventoryTargetPath(
  target: InventoryQuickLaunchTarget,
  context: BillingInventoryContextInput,
): string {
  const definition = INVENTORY_QUICK_LAUNCH_TARGETS[target];
  const params = new URLSearchParams();
  params.set('from', BILLING_INVENTORY_SYNC_TAB);
  const invoice = context.selection?.invoiceNumber ?? (context.filters.invoiceNumber.trim() || null);
  if (invoice) params.set('invoice', invoice);
  if (context.selection) {
    params.set('receiptId', String(context.selection.receiptId));
    if (context.selection.sku) params.set('sku', context.selection.sku);
    if (definition.carriesStockItem && context.selection.stockItemId != null) {
      params.set('itemId', String(context.selection.stockItemId));
    }
  }
  return `${definition.path}?${params.toString()}`;
}

/** Texto corto del contexto activo ("Invoice INV-0001 · SKU BURGER-01"). */
export function describeBillingContext(context: BillingInventoryContextInput): string {
  const parts: string[] = [];
  const invoice = context.selection?.invoiceNumber ?? (context.filters.invoiceNumber.trim() || null);
  if (invoice) parts.push(`Invoice ${invoice}`);
  if (context.selection?.sku) parts.push(`SKU ${context.selection.sku}`);
  if (!context.selection && context.filters.status) parts.push(`Status ${context.filters.status}`);
  if (!context.selection && (context.filters.dateFrom || context.filters.dateTo)) {
    parts.push(`${context.filters.dateFrom || '…'} → ${context.filters.dateTo || '…'}`);
  }
  return parts.join(' · ');
}
