// Types of the Receipt Taxes workspace (Billing & Transactions).
// Mirror the back-end DTOs of /api/receipt-taxes (snake_case fields as the API returns them).

/** RECEIPT: tax over the receipt subtotal. ITEM: tax over the taxable base of one receipt line. */
export type ReceiptTaxScope = 'RECEIPT' | 'ITEM';

export type ReceiptTaxStatusFilter = 'active' | 'inactive' | 'all';

export interface ReceiptTax {
  id: number;
  receipt_id: number;
  receipt_item_id: number | null;
  name: string;
  rate: number;
  /** Calculated by the server, rounded to the cent. */
  amount: number;
  scope: ReceiptTaxScope;
  is_active: boolean;
  receipt_invoice_number: string | null;
  /** The parent receipt is fiscally locked: the tax cannot be edited or toggled (Historia 11). */
  receipt_is_locked: boolean;
  currency: string | null;
  receipt_item_name: string | null;
  /** Receipt totals as stored after the server recalculated them. */
  receipt_total_tax: number | null;
  receipt_grand_total: number | null;
  created_at: string;
}

/** Filters of the analytical header (tax type = exact tax name, applied rate). */
export interface ReceiptTaxHeaderFilters {
  taxName?: string;
  rate?: number;
}

export interface ReceiptTaxListQuery extends ReceiptTaxHeaderFilters {
  page?: number;
  limit?: number;
  receiptId?: number;
  scope?: ReceiptTaxScope;
  name?: string;
  status?: ReceiptTaxStatusFilter;
}

/** GET /receipt-taxes/summary — amounts only include active taxes. */
export interface ReceiptTaxesSummary {
  total_count: number;
  active_count: number;
  inactive_count: number;
  receipts_count: number;
  totals_by_currency: Array<{
    currency: string;
    total_amount: number;
    receipt_scope_amount: number;
    item_scope_amount: number;
  }>;
  by_scope: Array<{ scope: ReceiptTaxScope; currency: string; count: number; total_amount: number }>;
  by_type: Array<{ name: string; rate: number; currency: string; count: number; total_amount: number }>;
  filter_options: { names: string[]; rates: number[] };
}

export interface ReceiptTaxListResult {
  data: ReceiptTax[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Body of POST /receipt-taxes. The amount is never sent: the server calculates it. */
export interface CreateReceiptTaxPayload {
  receiptId: number;
  receiptItemId?: number;
  name: string;
  rate: number;
  scope: ReceiptTaxScope;
}

/** Body of PATCH /receipt-taxes/:id. */
export interface UpdateReceiptTaxPayload {
  name?: string;
  rate?: number;
  scope?: ReceiptTaxScope;
  receiptItemId?: number;
}

/** Receipt as listed by GET /receipts (only the fields the drawer needs). */
export interface ReceiptOption {
  id: number;
  invoice_number: string | null;
  type: string | null;
  subtotal: number;
  grand_total: number;
  currency: string;
  /** Fiscally locked receipts cannot receive new taxes (Historia 11). */
  is_locked?: boolean;
}

/** Receipt line as listed by GET /receipt-items (only the fields the drawer needs). */
export interface ReceiptItemOption {
  id: number;
  receipt_id: number;
  name: string;
  sku: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
}
