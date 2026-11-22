// Tipos de los reportes de facturación (Historia 8):
// GET /api/billing/reports/tax-liability y GET /api/billing/reports/discount-audit.

export type ReceiptTaxScope = 'RECEIPT' | 'ITEM';
export type ReceiptKind = 'INVOICE' | 'RECEIPT';
export type DiscountAuditEventType = 'all' | 'discount' | 'void';
export type DiscountAuditEvent = 'DISCOUNT' | 'VOID';
export type BillingReportKind = 'tax-liability' | 'discount-audit';

/** Filtros comunes: rango de fechas del recibo (YYYY-MM-DD) y moneda. */
export interface BillingReportDateFilters {
  from?: string;
  to?: string;
  currency?: string;
}

export interface TaxLiabilityFilters extends BillingReportDateFilters {
  rate?: number | null;
  scope?: ReceiptTaxScope | '';
  name?: string;
}

export interface DiscountAuditFilters extends BillingReportDateFilters {
  eventType?: DiscountAuditEventType;
  userId?: number | null;
  receiptType?: ReceiptKind | '';
  page?: number;
  limit?: number;
}

export interface TaxLiabilityGroup {
  name: string;
  scope: ReceiptTaxScope;
  rate: number;
  currency: string;
  /** Base gravable: subtotal del recibo (RECEIPT) o de la línea (ITEM), una vez por recibo/línea. */
  taxable_subtotal: number;
  tax_collected: number;
  tax_lines: number;
  receipts: number;
  lines_without_base: number;
}

export interface TaxLiabilityScopeTotals {
  scope: ReceiptTaxScope;
  taxable_subtotal: number;
  tax_collected: number;
  tax_lines: number;
}

export interface TaxLiabilityTotals {
  taxable_subtotal: number;
  tax_collected: number;
  tax_lines: number;
  receipts: number;
  groups: number;
}

export interface TaxLiabilityCurrencyTotals extends TaxLiabilityTotals {
  currency: string;
  by_scope: TaxLiabilityScopeTotals[];
}

export interface TaxLiabilityReport {
  filters: {
    from: string | null;
    to: string | null;
    rate: number | null;
    scope: ReceiptTaxScope | null;
    name: string | null;
    currency: string | null;
  };
  generated_at: string;
  currencies: string[];
  groups: TaxLiabilityGroup[];
  totals: TaxLiabilityTotals;
  totals_by_currency: TaxLiabilityCurrencyTotals[];
}

export interface OrderSnapshotSummary {
  order_id: number | null;
  order_number: string | null;
  item_count: number;
  items_summary: string;
  payment_methods: string;
  subtotal: number | null;
  discount_total: number | null;
  total: number | null;
}

export interface DiscountAuditRow {
  receipt_id: number;
  invoice_number: string | null;
  receipt_type: ReceiptKind;
  order_id: number;
  currency: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_locked: boolean;
  events: DiscountAuditEvent[];
  processed_by_user_id: number | null;
  processed_by_role: string | null;
  processed_by_name: string | null;
  original_subtotal: number;
  discount_applied: number;
  discount_pct: number | null;
  total_tax: number;
  final_total: number;
  snapshot: OrderSnapshotSummary | null;
  order_snapshot: Record<string, unknown> | null;
}

export interface DiscountAuditCurrencySummary {
  currency: string;
  receipts: number;
  original_subtotal: number;
  discount_applied: number;
  total_tax: number;
  final_total: number;
}

export interface DiscountAuditSummary {
  receipts: number;
  discounted_receipts: number;
  voided_receipts: number;
  by_currency: DiscountAuditCurrencySummary[];
}

export interface DiscountAuditReport {
  data: DiscountAuditRow[];
  summary: DiscountAuditSummary;
  filters: {
    from: string | null;
    to: string | null;
    event_type: DiscountAuditEventType;
    user_id: number | null;
    receipt_type: ReceiptKind | null;
    currency: string | null;
  };
  generated_at: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
