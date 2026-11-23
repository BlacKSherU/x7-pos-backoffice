// Contrato de /api/v1/saas/merchants/... (CONTRATO-API.md, endpoints 7-9).

export type SaasMerchantStatus = 'active' | 'inactive' | 'suspended';

export interface SaasMerchantProfile {
  id: number;
  name: string;
  branchCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  status: SaasMerchantStatus | string;
  companyId: number;
  companyName: string;
}

/** PATCH /v1/saas/merchants/:merchantId: parcial, solo los campos que cambian. */
export type SaasMerchantPatch = Partial<{
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  status: SaasMerchantStatus;
}>;

export interface SaasMerchantHub {
  merchant: {
    id: number;
    name: string;
    branchCode: string;
    status: SaasMerchantStatus | string;
    city: string | null;
    companyId: number;
    companyName: string;
  };
  stats: {
    activePosTerminals: number;
    totalPosTerminals: number;
    transactionsToday: number;
    transactionsTotal: number;
    activeUsers: number;
    totalUsers: number;
  };
}

export interface SaasMerchantUser {
  id: number;
  username: string | null;
  email: string;
  role: string;
  status: string;
  merchantId: number;
  createdAt: string | null;
}

export interface SaasMerchantUsersMeta {
  total: number;
  active: number;
}

export interface SaasMerchantUsersQuery {
  search?: string;
  status?: string;
}

/** GET /v1/saas/merchants/:merchantId/terminals: terminales de cobro (POS) de la sucursal. */
export interface SaasMerchantTerminal {
  id: number;
  name: string;
  model: string | null;
  /** HSN (CardPointe Bolt), Reader ID (Stripe) o número de serie (Clover). */
  deviceIdentifier: string;
  provider: string | null;
  paymentConfigName: string | null;
  cashDrawerId: number | null;
  status: 'active' | 'inactive' | string;
  merchantId: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaasMerchantTerminalsMeta {
  total: number;
  active: number;
}

export interface SaasMerchantTerminalsQuery {
  search?: string;
  status?: string;
}
