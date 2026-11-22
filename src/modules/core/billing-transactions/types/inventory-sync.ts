// Tipos de `GET /api/billing/inventory-sync` (x7-pos-back-end, módulo billing-inventory-sync).

export type InventoryDeductionStatus =
  | 'DEDUCTED'
  | 'PENDING'
  | 'INSUFFICIENT_STOCK'
  | 'FAILED'
  | 'NOT_TRACKED';

export const INVENTORY_DEDUCTION_STATUSES: InventoryDeductionStatus[] = [
  'DEDUCTED',
  'PENDING',
  'INSUFFICIENT_STOCK',
  'FAILED',
  'NOT_TRACKED',
];

export type InventorySkuMappingSource = 'VARIANT' | 'PRODUCT' | 'SUPPLY';

export type InventoryComponentKind = 'RAW_MATERIAL' | 'PRODUCT';

export interface InventorySyncLocation {
  id: number;
  name: string;
  code: string | null;
}

export interface InventorySyncMovement {
  id: number;
  stockItemId: number;
  /** La deducción agrega toda la orden por stock item. */
  quantity: number;
  type: string;
  reference: string | null;
  createdAt: string;
  locationId: number | null;
  locationName: string | null;
}

export interface InventorySyncComponent {
  key: string;
  kind: InventoryComponentKind;
  name: string;
  sku: string | null;
  requiredQty: number;
  deductedQty: number;
  movementIds: number[];
  stockItemId: number | null;
  currentQty: number | null;
  minimumQty: number | null;
  locationId: number | null;
  locationName: string | null;
  shortfall: number;
  insufficient: boolean;
}

export interface InventorySyncRow {
  receiptItemId: number;
  receiptId: number;
  invoiceNumber: string | null;
  receiptType: 'INVOICE' | 'RECEIPT';
  receiptCreatedAt: string;
  orderId: number;
  orderNumber: string | null;
  orderPaid: boolean;
  inventoryConsumedAt: string | null;
  sku: string | null;
  itemName: string;
  quantitySold: number;
  mappingSource: InventorySkuMappingSource | null;
  productId: number | null;
  productName: string | null;
  variantId: number | null;
  variantName: string | null;
  location: InventorySyncLocation | null;
  movements: InventorySyncMovement[];
  components: InventorySyncComponent[];
  deductionStatus: InventoryDeductionStatus;
  deducted: boolean;
  insufficientStock: boolean;
  commitFailed: boolean;
  statusReason: string;
}

export interface InventorySyncPage {
  data: InventorySyncRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface InventorySyncQuery {
  invoiceNumber?: string;
  receiptId?: number;
  sku?: string;
  status?: InventoryDeductionStatus | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ---- Header: métricas (`GET /billing/inventory-sync/metrics`) ----

export type StockLevel = 'OK' | 'LOW' | 'OUT_OF_STOCK';

export interface LowStockWarning {
  stockItemId: number;
  name: string;
  sku: string | null;
  kind: InventoryComponentKind;
  locationId: number;
  locationName: string | null;
  currentQty: number;
  minimumQty: number | null;
  level: StockLevel;
  /** Unidades deducidas por ventas (OUT_FOR_SALE) en la ventana. */
  soldQty: number;
  lastSaleAt: string;
  alertId: number | null;
}

export interface LowStockSummary {
  total: number;
  outOfStock: number;
  low: number;
  activeAlerts: number;
  warnings: LowStockWarning[];
}

export interface InventorySyncMetrics {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  salesLocation: InventorySyncLocation | null;
  linesEvaluated: number;
  scanLimitReached: boolean;
  itemsDeducted: number;
  unitsDeducted: number;
  statusCounts: Record<InventoryDeductionStatus, number>;
  lowStock: LowStockSummary;
}

export interface InventorySyncMetricsQuery {
  dateFrom?: string;
  dateTo?: string;
}

// ---- Header: validación de stock (`POST /billing/inventory-sync/validate-stock`) ----

export type StockAvailabilityStatus =
  | 'AVAILABLE'
  | 'LOW_STOCK_AFTER_SALE'
  | 'INSUFFICIENT_STOCK'
  | 'NOT_TRACKED'
  | 'ALREADY_DEDUCTED'
  | 'LOCATION_NOT_CONFIGURED';

export interface ValidateStockItem {
  sku: string;
  quantity: number;
}

/** Exactamente uno de `receiptId`, `invoiceNumber` o `items`. */
export interface ValidateStockRequest {
  receiptId?: number;
  invoiceNumber?: string;
  items?: ValidateStockItem[];
  locationId?: number;
}

export interface StockAvailabilityComponent {
  key: string;
  kind: InventoryComponentKind;
  name: string;
  sku: string | null;
  stockItemId: number | null;
  requiredQty: number;
  totalDemand: number;
  availableQty: number;
  remainingAfterSale: number;
  minimumQty: number | null;
  shortfall: number;
  status: StockAvailabilityStatus;
}

export interface StockAvailabilityLine {
  receiptItemId: number | null;
  sku: string | null;
  itemName: string;
  quantity: number;
  mappingSource: InventorySkuMappingSource | null;
  productName: string | null;
  variantName: string | null;
  status: StockAvailabilityStatus;
  reason: string;
  components: StockAvailabilityComponent[];
}

export interface StockAvailabilitySummary {
  lines: number;
  available: number;
  lowStockAfterSale: number;
  insufficientStock: number;
  notTracked: number;
  alreadyDeducted: number;
  locationNotConfigured: number;
}

export interface StockAvailabilityResult {
  source: 'RECEIPT' | 'ITEMS';
  receiptId: number | null;
  invoiceNumber: string | null;
  orderId: number | null;
  location: InventorySyncLocation | null;
  allAvailable: boolean;
  summary: StockAvailabilitySummary;
  items: StockAvailabilityLine[];
  checkedAt: string;
}
