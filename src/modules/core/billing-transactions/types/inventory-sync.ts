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
