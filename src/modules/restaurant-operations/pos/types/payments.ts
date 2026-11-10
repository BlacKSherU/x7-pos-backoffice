// Tipos de cobros con tarjeta (/v1/payment-processing), pasarelas
// (/v1/merchants/:companyId/payment-configs) y terminales (/payment-terminals).

export type PaymentProvider = 'stripe' | 'cardpointe' | 'clover';
export type PaymentEnvironment = 'sandbox' | 'production';

export type PaymentTransactionType = 'sale' | 'refund' | 'void';
export type PaymentTransactionChannel = 'token' | 'terminal';
export type PaymentTransactionStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'voided'
  | 'partially_refunded'
  | 'refunded'
  | 'succeeded';

export interface PaymentTransaction {
  id: number;
  type: PaymentTransactionType;
  channel: PaymentTransactionChannel;
  status: PaymentTransactionStatus;
  provider: PaymentProvider;
  amount: number;
  tipAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  currency: string;
  orderId: number | null;
  orderPaymentId: number | null;
  parentTransactionId: number | null;
  paymentConfigId: number;
  terminalId: number | null;
  providerTransactionId: string | null;
  authorizationCode: string | null;
  providerCode: string | null;
  message: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CheckoutTokenization {
  method: 'stripe_js' | 'cardsecure_iframe' | 'unavailable';
  scriptUrl?: string;
  publishableKey?: string;
  iframeUrl?: string;
  reason?: string;
}

export interface CheckoutConfig {
  id: number;
  displayName: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  isDefault: boolean;
  tokenization: CheckoutTokenization;
}

export interface CheckoutTerminal {
  id: number;
  name: string;
  model: string | null;
  provider: PaymentProvider;
  paymentConfigId: number;
  cashDrawerId: number | null;
}

export interface CheckoutOptions {
  configs: CheckoutConfig[];
  terminals: CheckoutTerminal[];
  defaultCurrency: string;
}

/** Pedido tal como lo devuelve GET /orders (solo los campos que usa la caja). */
export interface PayableOrder {
  id: number;
  orderNumber: string | null;
  displayId?: string | null;
  businessStatus: string;
  type: string;
  total: number;
  paidTotal: number;
  balanceDue: number;
  isPaid: boolean;
  createdAt: string;
}

export interface ChargePayload {
  orderId: number;
  amount: number;
  tipAmount?: number;
  currency?: string;
  paymentMethodToken: string;
  cardExpiry?: string;
  paymentProvider?: PaymentProvider;
}

export interface TerminalSalePayload {
  orderId: number;
  amount: number;
  tipAmount?: number;
  currency?: string;
  terminalId: number;
}

export interface RefundVoidResult {
  data: PaymentTransaction;
  sale: PaymentTransaction;
  message: string;
}

export interface PaymentGatewayConfig {
  id: number;
  companyId: number;
  merchantId: number | null;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  displayName: string;
  /** Con los secretos enmascarados (sk_test_****1234) */
  credentials: Record<string, string>;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayConfigPayload {
  provider?: PaymentProvider;
  environment?: PaymentEnvironment;
  displayName?: string;
  merchantId?: number | null;
  credentials?: Record<string, string | null>;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface PaymentTerminal {
  id: number;
  companyId: number;
  merchantId: number;
  paymentConfigId: number;
  provider: PaymentProvider;
  cashDrawerId: number | null;
  name: string;
  model: string | null;
  deviceIdentifier: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTerminalPayload {
  merchantId?: number;
  paymentConfigId?: number;
  cashDrawerId?: number | null;
  name?: string;
  model?: string | null;
  deviceIdentifier?: string;
  isActive?: boolean;
}

/** Campos de credenciales por proveedor (igual que provider-credentials.ts del backend). */
export interface CredentialField {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
  placeholder: string;
  hint?: string;
}

export const PROVIDER_CREDENTIAL_FIELDS: Record<'stripe' | 'cardpointe', CredentialField[]> = {
  stripe: [
    { key: 'secretKey', label: 'Secret key', required: true, secret: true, placeholder: 'sk_test_...' },
    {
      key: 'publishableKey',
      label: 'Publishable key',
      required: false,
      secret: false,
      placeholder: 'pk_test_...',
      hint: 'Needed to take card payments in the browser (Stripe.js).',
    },
    { key: 'webhookSecret', label: 'Webhook secret', required: false, secret: true, placeholder: 'whsec_...' },
  ],
  cardpointe: [
    { key: 'merchantId', label: 'Merchant ID (MID)', required: true, secret: false, placeholder: '496160873888' },
    { key: 'username', label: 'API username', required: true, secret: true, placeholder: 'testing' },
    { key: 'password', label: 'API password', required: true, secret: true, placeholder: '••••••••' },
    {
      key: 'site',
      label: 'Gateway site',
      required: true,
      secret: false,
      placeholder: 'fts-uat',
      hint: 'Subdomain of cardconnect.com: fts-uat for testing, fts for production.',
    },
    {
      key: 'boltSite',
      label: 'Bolt site',
      required: false,
      secret: false,
      placeholder: 'bolt-uat',
      hint: 'Only for Bolt terminals; goes together with the Bolt API key.',
    },
    { key: 'boltApiKey', label: 'Bolt API key', required: false, secret: true, placeholder: '••••••••' },
  ],
};

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: 'Stripe',
  cardpointe: 'CardPointe',
  clover: 'Clover',
};
