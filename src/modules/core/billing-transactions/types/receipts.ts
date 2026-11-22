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
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReceiptListQuery {
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

/** Cuerpo de PATCH /receipts/:id (solo los campos que cambian). */
export type UpdateReceiptPayload = Partial<CreateReceiptPayload>;
