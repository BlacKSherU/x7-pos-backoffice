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
  currency: string | null;
  receipt_item_name: string | null;
  /** Receipt totals as stored after the server recalculated them. */
  receipt_total_tax: number | null;
  receipt_grand_total: number | null;
  created_at: string;
}

export interface ReceiptTaxListQuery {
  page?: number;
  limit?: number;
  receiptId?: number;
  scope?: ReceiptTaxScope;
  name?: string;
  status?: ReceiptTaxStatusFilter;
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
