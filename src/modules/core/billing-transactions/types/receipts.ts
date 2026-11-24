// Tipos del recurso Receipt (back-end: src/core/billing-transactions/receipts).

export type ReceiptType = 'INVOICE' | 'RECEIPT';

/** Filtro por `is_active`: activos, dados de baja (baja lógica) o todos. */
export type ReceiptStatusFilter = 'active' | 'inactive' | 'all';

export type ReceiptSortBy = 'createdAt' | 'type' | 'invoiceNumber' | 'grandTotal';

export interface Receipt {
  id: number;
  order_id: number;
  merchant_id: number;
  invoice_number: string | null;
  type: ReceiptType;
  fiscal_data: string | null;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  currency: string;
  is_active: boolean;
  /** Bloqueo fiscal (Historia 11): el recibo, sus líneas e impuestos ya no se modifican. */
  is_locked: boolean;
  /** Usuario y rol que bloquearon (procesaron) el recibo. */
  processed_by_user_id?: number | null;
  processed_by_role?: string | null;
  created_at: string;
  updated_at: string;
}

/** Rango de fechas de creación (YYYY-MM-DD, ambos extremos inclusive). */
export interface ReceiptDateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReceiptListQuery extends ReceiptDateRange {
  page?: number;
  limit?: number;
  search?: string;
  type?: ReceiptType | '';
  status?: ReceiptStatusFilter;
  sortBy?: ReceiptSortBy;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedReceipts {
  data: Receipt[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Cuerpo de POST /receipts. `invoiceNumber` vacío = el back-end asigna el siguiente INV-######. */
export interface CreateReceiptPayload {
  orderId: number;
  type: ReceiptType;
  currency: string;
  fiscalData?: string;
  invoiceNumber?: string;
}

/** Orden facturable del merchant (GET /receipts/order-options). */
export interface ReceiptOrderOption {
  id: number;
  order_number: string;
  /** Estado de negocio de la orden (paid, in_progress…). */
  status: string;
  order_type: string;
  total: number;
  is_paid: boolean;
  created_at: string;
  customer_name: string | null;
  /** Tipos de los recibos activos ya emitidos para la orden. */
  issued_types: ReceiptType[];
}

export interface ReceiptOrderOptions {
  /** Moneda base de la company del merchant (moneda por defecto del recibo nuevo). */
  default_currency: string | null;
  orders: ReceiptOrderOption[];
}

export interface ReceiptOrderOptionsQuery {
  search?: string;
  /** Tipo a emitir: deja fuera las órdenes que ya tienen un recibo activo de ese tipo. */
  type?: ReceiptType;
  /** Orden que siempre se incluye (la del recibo en edición). */
  includeOrderId?: number;
  limit?: number;
}

/** Cuerpo de PATCH /receipts/:id (solo los campos que cambian). */
export type UpdateReceiptPayload = Partial<CreateReceiptPayload>;

/** GET /receipts/summary — KPIs del Command Hub Header. */
export interface ReceiptSummary {
  status: ReceiptStatusFilter;
  date_from?: string | null;
  date_to?: string | null;
  total_receipts: number;
  active_receipts: number;
  inactive_receipts: number;
  locked_receipts: number;
  /** Moneda de los importes: la que tiene más recibos. */
  currency: string;
  grand_total: number;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  average_ticket: number;
  by_type: Array<{ type: ReceiptType; receipts: number; grand_total: number }>;
  by_currency: Array<{ currency: string; receipts: number; grand_total: number; total_tax: number }>;
}

export interface ReceiptSummaryQuery extends ReceiptDateRange {
  status?: ReceiptStatusFilter;
}

export type ReceiptTaxScope = 'RECEIPT' | 'ITEM';

export interface ReceiptDetailItem {
  id: number;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_amount: number;
  total: number;
}

export interface ReceiptDetailTax {
  id: number;
  /** Ítem al que aplica (null = impuesto a nivel de recibo). */
  receipt_item_id: number | null;
  name: string;
  /** Tasa en porcentaje (19 = 19 %). */
  rate: number;
  amount: number;
  scope: ReceiptTaxScope;
}

/** GET /receipts/:id/details — fila maestro-detalle de la tabla. */
export interface ReceiptDetails {
  receipt: Receipt;
  items: ReceiptDetailItem[];
  taxes: ReceiptDetailTax[];
  items_total: number;
  taxes_total: number;
}

export interface ReceiptTaxBreakdownEntry {
  name: string;
  rate: number;
  currency: string;
  total_amount: number;
  tax_lines: number;
  receipts: number;
}

/** GET /receipts/tax-breakdown — impuesto cobrado por tipo (nombre + tasa), según status y fechas. */
export interface ReceiptTaxBreakdown {
  status: ReceiptStatusFilter;
  date_from: string | null;
  date_to: string | null;
  /** Moneda de total_tax: la que tiene más líneas de impuesto. */
  currency: string;
  total_tax: number;
  by_tax: ReceiptTaxBreakdownEntry[];
  by_currency: Array<{ currency: string; total_amount: number; tax_lines: number }>;
}

/** Eventos del audit trail de un recibo (Historia 6, GET /receipts/:id/activity-log). */
export type ReceiptAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'LOCKED'
  | 'TAX_MODIFIED'
  | 'ITEM_MODIFIED'
  | 'DEACTIVATED'
  | 'MODIFICATION_BLOCKED'
  | 'ADJUSTMENT_ISSUED';

/** Totales críticos del recibo antes / después de un evento. */
export interface ReceiptTotalsSnapshot {
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
}

export interface ReceiptActivityEvent {
  id: number;
  action: ReceiptAuditAction;
  user_id: number | null;
  /** Username (o email) del usuario que ejecutó la acción. */
  user_name: string | null;
  role: string | null;
  previous_values: ReceiptTotalsSnapshot | null;
  new_values: ReceiptTotalsSnapshot | null;
  metadata: Record<string, unknown> | null;
  /** Timestamp exacto del evento (ISO). */
  created_at: string;
}

/** GET /receipts/:id/activity-log — eventos en orden cronológico exacto (created_at, id). */
export interface ReceiptActivityLog {
  receipt_id: number;
  invoice_number: string | null;
  currency: string;
  events: ReceiptActivityEvent[];
}
