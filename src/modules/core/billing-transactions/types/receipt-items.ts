// Types for the Receipt Items workspace (Billing & Transactions).
// Mirrors the back-end contract of /api/receipt-items (ReceiptItemResponseDto).

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  /** Invoice number of the parent receipt (null when the receipt has none yet). */
  receipt_invoice_number: string | null;
  /** ISO 4217 currency code of the parent receipt. */
  currency: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  /** round2(quantity × unit_price), calculated by the server. */
  subtotal: number;
  discount_amount: number;
  /** subtotal − discount_amount, calculated by the server. */
  total: number;
  metadata: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  statusCode?: number;
  message?: string;
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ReceiptItemSortBy = 'createdAt' | 'name' | 'total';

export interface ReceiptItemsQuery {
  page?: number;
  limit?: number;
  receiptId?: number;
  sortBy?: ReceiptItemSortBy;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateReceiptItemPayload {
  receiptId: number;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  metadata?: string;
}

export interface UpdateReceiptItemPayload {
  name?: string;
  sku?: string | null;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  metadata?: string;
  /** false = logical deletion, true = restore a deleted line. */
  isActive?: boolean;
}

/** Minimal receipt shape needed by the receipt selector (GET /receipts). */
export interface ReceiptOption {
  id: number;
  order_id: number;
  type: string;
  grand_total: number;
  currency: string;
  /** Present once the Receipts module exposes it; optional for forward-compatibility. */
  invoice_number?: string | null;
  created_at?: string;
}
