import { apiRequest, unwrapList, type MaybeEnvelopedList } from '@/shared/api/http';
import { getCompanyProfile } from '@/modules/platform-saas/companies/api/companies';
import type {
  ChargePayload,
  CheckoutOptions,
  PayableOrder,
  PaymentGatewayConfig,
  PaymentGatewayConfigPayload,
  PaymentTerminal,
  PaymentTerminalPayload,
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentTransactionType,
  RefundVoidResult,
  TerminalSalePayload,
} from '@/modules/restaurant-operations/pos/types/payments';

const BASE = '/v1/payment-processing';

interface One<T> {
  data: T;
  message?: string | string[];
}

const firstMessage = (message?: string | string[]) =>
  (Array.isArray(message) ? message[0] : message) ?? '';

// ------------------------------------------------------------------- caja

export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const json = await apiRequest<One<CheckoutOptions>>(
    `${BASE}/checkout-options`,
    { method: 'GET' },
    'Failed to load the payment options of the branch',
  );
  return json.data;
}

/** Pedidos activos con saldo pendiente, lo más reciente primero. */
export async function getPayableOrders(): Promise<PayableOrder[]> {
  const params = new URLSearchParams({
    limit: '100',
    status: 'active',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });
  const json = await apiRequest<MaybeEnvelopedList<PayableOrder>>(
    `/orders?${params.toString()}`,
    { method: 'GET' },
    'Failed to load orders',
  );
  return unwrapList(json)
    .map((o) => ({
      ...o,
      total: Number(o.total),
      paidTotal: Number(o.paidTotal),
      balanceDue: Number(o.balanceDue),
    }))
    .filter((o) => !o.isPaid && o.balanceDue > 0);
}

export interface TransactionsQuery {
  orderId?: number;
  type?: PaymentTransactionType | '';
  status?: PaymentTransactionStatus | '';
  page?: number;
  limit?: number;
}

export interface TransactionsPage {
  data: PaymentTransaction[];
  paginationMeta: { page: number; limit: number; total: number; totalPages: number };
}

export function listTransactions(query: TransactionsQuery = {}): Promise<TransactionsPage> {
  const params = new URLSearchParams();
  if (query.orderId) params.set('orderId', String(query.orderId));
  if (query.type) params.set('type', query.type);
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 20));
  return apiRequest<TransactionsPage>(
    `${BASE}?${params.toString()}`,
    { method: 'GET' },
    'Failed to load payment transactions',
  );
}

export async function getTransaction(id: number): Promise<PaymentTransaction> {
  const json = await apiRequest<One<PaymentTransaction>>(
    `${BASE}/${id}`,
    { method: 'GET' },
    'Failed to load the payment transaction',
  );
  return json.data;
}

export async function chargeCard(
  payload: ChargePayload,
): Promise<{ data: PaymentTransaction; message: string }> {
  const json = await apiRequest<One<PaymentTransaction>>(
    `${BASE}/charge`,
    { method: 'POST', body: JSON.stringify(payload) },
    'The card could not be charged',
  );
  return { data: json.data, message: firstMessage(json.message) };
}

export async function startTerminalSale(payload: TerminalSalePayload): Promise<PaymentTransaction> {
  const json = await apiRequest<One<PaymentTransaction>>(
    `${BASE}/terminal-sale`,
    { method: 'POST', body: JSON.stringify(payload) },
    'The sale could not be sent to the terminal',
  );
  return json.data;
}

export async function refundTransaction(
  id: number,
  body: { amount?: number; reason?: string },
): Promise<RefundVoidResult> {
  const json = await apiRequest<One<PaymentTransaction> & { sale: PaymentTransaction }>(
    `${BASE}/${id}/refund`,
    { method: 'POST', body: JSON.stringify(body) },
    'The refund could not be processed',
  );
  return { data: json.data, sale: json.sale, message: firstMessage(json.message) };
}

export async function voidTransaction(id: number, body: { reason?: string }): Promise<RefundVoidResult> {
  const json = await apiRequest<One<PaymentTransaction> & { sale: PaymentTransaction }>(
    `${BASE}/${id}/void`,
    { method: 'POST', body: JSON.stringify(body) },
    'The void could not be processed',
  );
  return { data: json.data, sale: json.sale, message: firstMessage(json.message) };
}

// ------------------------------------------------- pasarelas y terminales

let companyIdCache: number | null = null;

/** El id de empresa no viaja en la sesión: se lee del perfil de la empresa. */
export async function getCompanyId(): Promise<number> {
  if (companyIdCache !== null) return companyIdCache;
  const profile = await getCompanyProfile();
  companyIdCache = Number((profile as { id: number }).id);
  return companyIdCache;
}

/** Solo para tests */
export function resetCompanyIdCache(): void {
  companyIdCache = null;
}

export async function listGatewayConfigs(companyId: number): Promise<PaymentGatewayConfig[]> {
  const json = await apiRequest<MaybeEnvelopedList<PaymentGatewayConfig>>(
    `/v1/merchants/${companyId}/payment-configs`,
    { method: 'GET' },
    'Failed to load payment gateway configs',
  );
  return unwrapList(json);
}

export async function createGatewayConfig(
  companyId: number,
  payload: PaymentGatewayConfigPayload,
): Promise<PaymentGatewayConfig> {
  const json = await apiRequest<One<PaymentGatewayConfig>>(
    `/v1/merchants/${companyId}/payment-configs`,
    { method: 'POST', body: JSON.stringify(payload) },
    'The payment gateway config could not be created',
  );
  return json.data;
}

export async function updateGatewayConfig(
  companyId: number,
  id: number,
  payload: PaymentGatewayConfigPayload,
): Promise<PaymentGatewayConfig> {
  const json = await apiRequest<One<PaymentGatewayConfig>>(
    `/v1/merchants/${companyId}/payment-configs/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'The payment gateway config could not be updated',
  );
  return json.data;
}

export function deleteGatewayConfig(companyId: number, id: number): Promise<void> {
  return apiRequest<void>(
    `/v1/merchants/${companyId}/payment-configs/${id}`,
    { method: 'DELETE' },
    'The payment gateway config could not be deleted',
  );
}

export async function listTerminals(companyId: number): Promise<PaymentTerminal[]> {
  const json = await apiRequest<MaybeEnvelopedList<PaymentTerminal>>(
    `/v1/merchants/${companyId}/payment-terminals`,
    { method: 'GET' },
    'Failed to load payment terminals',
  );
  return unwrapList(json);
}

export async function createTerminal(
  companyId: number,
  payload: PaymentTerminalPayload,
): Promise<PaymentTerminal> {
  const json = await apiRequest<One<PaymentTerminal>>(
    `/v1/merchants/${companyId}/payment-terminals`,
    { method: 'POST', body: JSON.stringify(payload) },
    'The payment terminal could not be registered',
  );
  return json.data;
}

export async function updateTerminal(
  companyId: number,
  id: number,
  payload: PaymentTerminalPayload,
): Promise<PaymentTerminal> {
  const json = await apiRequest<One<PaymentTerminal>>(
    `/v1/merchants/${companyId}/payment-terminals/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'The payment terminal could not be updated',
  );
  return json.data;
}

export function deleteTerminal(companyId: number, id: number): Promise<void> {
  return apiRequest<void>(
    `/v1/merchants/${companyId}/payment-terminals/${id}`,
    { method: 'DELETE' },
    'The payment terminal could not be deleted',
  );
}
