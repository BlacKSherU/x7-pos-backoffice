// Billing ↔ Business Partners (GET/PATCH /api/billing/partner-sync/...).

export type PartnerType = 'customer' | 'supplier';

/** merchant = recibos de la sucursal en sesión; company = todas las sucursales de la compañía. */
export type PartnerSyncScope = 'merchant' | 'company';

/** receipt = enlace explícito (LINK CUSTOMER PROFILE); order = cliente de la orden del recibo. */
export type PartnerLinkSource = 'receipt' | 'order';

export type PartnerLinkState = 'all' | 'linked' | 'unlinked';

export type ReceiptDocumentType = 'INVOICE' | 'RECEIPT';

export interface PartnerSyncMetrics {
  scope: PartnerSyncScope;
  currency: string;
  total_b2b_invoices: number;
  b2b_invoiced_amount: number;
  explicitly_linked_invoices: number;
  linked_customers: number;
  linked_suppliers: number;
  active_corporate_accounts: number;
  outstanding_balance: number;
  billed_amount: number;
  open_credit_orders: number;
  /** Porcentaje (0-100): saldo pendiente / total facturado de las órdenes B2B. */
  corporate_credit_utilization: number;
}

export interface PartnerOption {
  id: number;
  type: PartnerType;
  name: string;
  tax_id: string | null;
  email: string | null;
  /** Sucursal que registró al cliente (null en proveedores). */
  merchant_id: number | null;
}

export interface PartnerRef {
  type: PartnerType;
  id: number;
  name: string;
  tax_id: string | null;
}

export interface PartnerSyncReceipt {
  id: number;
  invoice_number: string | null;
  type: ReceiptDocumentType;
  merchant_id: number;
  order_id: number;
  grand_total: number;
  currency: string;
  is_locked: boolean;
  created_at: string;
  /** tax_id del JSON fiscal_data del recibo. */
  fiscal_tax_id: string | null;
  /** fiscal_data.tax_id o, si no hay, el del socio. */
  tax_id: string | null;
  partner: PartnerRef | null;
  link_source: PartnerLinkSource;
  order_customer: { id: number; name: string | null } | null;
  order_balance_due: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PartnerSyncScopeParams {
  scope?: PartnerSyncScope;
  /** Solo con scope=company: una sucursal de la compañía. */
  merchantId?: number;
}

export interface PartnerSyncReceiptsParams extends PartnerSyncScopeParams {
  page?: number;
  limit?: number;
  search?: string;
  linkState?: PartnerLinkState;
  type?: ReceiptDocumentType;
}
