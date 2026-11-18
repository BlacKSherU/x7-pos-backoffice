import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import { OrderPaymentsView } from '@/modules/restaurant-operations/pos/views/OrderPaymentsView';
import type { PaymentTransaction } from '@/modules/restaurant-operations/pos/types/payments';

const role = vi.hoisted(() => ({ value: 'merchant_admin', shiftRole: null as string | null }));

vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>();
  return {
    ...actual,
    getAccessToken: () => 'mock-token',
    clearAuthSession: vi.fn(),
    getEffectiveUserRole: () => role.value,
    getStoredUser: () => ({ id: 1, role: role.value, shiftRole: role.shiftRole, merchant: { id: 1 } }),
  };
});

// Stripe.js no se carga en jsdom: el campo de tarjeta se sustituye por uno que tokeniza
vi.mock('@/modules/restaurant-operations/pos/lib/card-fields', async () => {
  const React = await import('react');
  return {
    CardField: React.forwardRef(function FakeCardField(
      props: { onCompleteChange: (c: boolean) => void },
      ref: React.Ref<{ tokenize: () => Promise<{ token: string }> }>,
    ) {
      React.useImperativeHandle(ref, () => ({ tokenize: async () => ({ token: 'pm_test_token' }) }));
      return React.createElement('input', {
        'aria-label': 'Fake card',
        onChange: () => props.onCompleteChange(true),
      });
    }),
  };
});

const OPTIONS = {
  configs: [
    {
      id: 7,
      displayName: 'Stripe main',
      provider: 'stripe',
      environment: 'sandbox',
      isDefault: true,
      tokenization: { method: 'stripe_js', scriptUrl: 'https://js.stripe.com/v3/', publishableKey: 'pk_test_1' },
    },
    {
      id: 8,
      displayName: 'CardPointe',
      provider: 'cardpointe',
      environment: 'sandbox',
      isDefault: false,
      tokenization: { method: 'cardsecure_iframe', iframeUrl: 'https://fts-uat.cardconnect.com/itoke/ajax-tokenizer.html' },
    },
  ],
  terminals: [{ id: 3, name: 'Counter Bolt', model: 'Lane/3000', provider: 'cardpointe', paymentConfigId: 8, cashDrawerId: null }],
  defaultCurrency: 'USD',
};

const ORDER = {
  id: 42,
  orderNumber: '0042',
  businessStatus: 'completed',
  type: 'take_out',
  total: 25,
  paidTotal: 0,
  balanceDue: 25,
  isPaid: false,
  createdAt: '2026-11-08T12:00:00Z',
};

function tx(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: 11,
    type: 'sale',
    channel: 'token',
    status: 'paid',
    provider: 'stripe',
    amount: 25,
    tipAmount: 0,
    refundedAmount: 0,
    refundableAmount: 25,
    currency: 'USD',
    orderId: 42,
    orderPaymentId: 5,
    parentTransactionId: null,
    paymentConfigId: 7,
    terminalId: null,
    providerTransactionId: 'pi_1',
    authorizationCode: '046221',
    providerCode: 'succeeded',
    message: 'Approved',
    cardBrand: 'visa',
    cardLast4: '4242',
    reason: null,
    createdAt: '2026-11-08T12:00:00Z',
    updatedAt: '2026-11-08T12:00:00Z',
    completedAt: '2026-11-08T12:00:01Z',
    ...overrides,
  };
}

const page = (rows: PaymentTransaction[]) => ({
  data: rows,
  paginationMeta: { page: 1, limit: 10, total: rows.length, totalPages: 1 },
});

function backend(overrides: Record<string, unknown> = {}) {
  const mock = fakeBackend({
    '/v1/payment-processing/checkout-options': { data: OPTIONS },
    '/orders': { data: [ORDER, { ...ORDER, id: 43, isPaid: true, balanceDue: 0 }] },
    '/v1/payment-processing': page([tx()]),
    ...overrides,
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const bodyOf = (mock: ReturnType<typeof fakeBackend>, route: string) => {
  const call = mock.mock.calls.find(([input, init]) => {
    const path = String(input).replace(/^\/api/, '').split('?')[0];
    return `${(init?.method ?? 'GET').toUpperCase()} ${path}` === route;
  });
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
};

describe('OrderPaymentsView', () => {
  beforeEach(() => {
    role.value = 'merchant_admin';
    role.shiftRole = null;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('lists only orders with a balance due and the card transactions', async () => {
    backend();
    render(<OrderPaymentsView />);
    expect(await screen.findByTestId('payable-order-42')).toBeInTheDocument();
    expect(screen.queryByTestId('payable-order-43')).not.toBeInTheDocument();
    const row = await screen.findByTestId('payment-row-11');
    expect(within(row).getByText('Visa •••• 4242')).toBeInTheDocument();
    expect(within(row).getByText('Paid')).toBeInTheDocument();
  });

  it('charges a tokenized card with the default gateway (no provider sent)', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'POST /v1/payment-processing/charge': () => jsonResponse({ statusCode: 201, message: 'Payment approved', data: tx({ id: 12 }) }, 201),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: /charge card for order #0042/i }));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /charge \$25\.00/i });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Fake card'), '4');
    await user.type(within(dialog).getByLabelText(/tip/i), '3');
    await user.click(within(dialog).getByRole('button', { name: /charge \$28\.00/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodyOf(mock, 'POST /v1/payment-processing/charge')).toEqual({
      orderId: 42,
      amount: 25,
      tipAmount: 3,
      currency: 'USD',
      paymentMethodToken: 'pm_test_token',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/payment approved/i);
  });

  it('sends the provider when a non-default gateway is chosen', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'POST /v1/payment-processing/charge': () => jsonResponse({ data: tx({ provider: 'cardpointe' }) }, 201),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: /charge card for order/i }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/payment gateway/i), '8');
    await user.type(within(dialog).getByLabelText('Fake card'), '4');
    await user.click(within(dialog).getByRole('button', { name: /^charge \$/i }));
    await waitFor(() =>
      expect(bodyOf(mock, 'POST /v1/payment-processing/charge')).toMatchObject({ paymentProvider: 'cardpointe' }),
    );
  });

  it('keeps the dialog open with the reason when the card is declined', async () => {
    const user = userEvent.setup();
    backend({
      'POST /v1/payment-processing/charge': () =>
        jsonResponse({ data: tx({ status: 'failed', message: 'Your card was declined.' }) }, 201),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: /charge card for order/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Fake card'), '4');
    await user.click(within(dialog).getByRole('button', { name: /^charge \$/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Payment declined: Your card was declined.');
  });

  it('rejects an amount above the balance due', async () => {
    const user = userEvent.setup();
    backend();
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: /charge card for order/i }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/^amount/i);
    await user.clear(amount);
    await user.type(amount, '30');
    await user.type(within(dialog).getByLabelText('Fake card'), '4');
    expect(within(dialog).getByText('Between 0.01 and 25.00')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^charge \$/i })).toBeDisabled();
  });

  it('sends a terminal sale and follows it from pending to paid', async () => {
    const user = userEvent.setup();
    let polls = 0;
    const mock = backend({
      'POST /v1/payment-processing/terminal-sale': () =>
        jsonResponse({ data: tx({ id: 20, status: 'pending', channel: 'terminal', terminalId: 3, cardLast4: null }) }, 202),
      '/v1/payment-processing/20': () => {
        polls += 1;
        return jsonResponse({
          data: polls < 2 ? tx({ id: 20, status: 'pending', channel: 'terminal' }) : tx({ id: 20, channel: 'terminal' }),
        });
      },
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: /send order #0042 to a terminal/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /send \$25\.00 to terminal/i }));
    expect(await within(dialog).findByText('Waiting for the customer card')).toBeInTheDocument();
    expect(bodyOf(mock, 'POST /v1/payment-processing/terminal-sale')).toEqual({
      orderId: 42,
      terminalId: 3,
      amount: 25,
      currency: 'USD',
    });
    expect(await within(dialog).findByText('Payment approved', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(polls).toBe(2);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10_000);

  it('refunds part of a payment', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'POST /v1/payment-processing/11/refund': () =>
        jsonResponse({
          message: 'Refunded 10 USD',
          data: tx({ id: 30, type: 'refund', status: 'succeeded', amount: 10 }),
          sale: tx({ status: 'partially_refunded', refundedAmount: 10, refundableAmount: 15 }),
        }),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: 'Refund payment 11' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/refund amount/i);
    await user.clear(amount);
    await user.type(amount, '10');
    await user.type(within(dialog).getByLabelText(/reason/i), 'Cold fries');
    await user.click(within(dialog).getByRole('button', { name: 'Refund $10.00' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodyOf(mock, 'POST /v1/payment-processing/11/refund')).toEqual({ amount: 10, reason: 'Cold fries' });
    expect(screen.getByRole('status')).toHaveTextContent('Refunded $10.00 · Visa •••• 4242');
  });

  it('sends a full refund without an amount', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'POST /v1/payment-processing/11/refund': () =>
        jsonResponse({ data: tx({ type: 'refund', status: 'succeeded' }), sale: tx({ status: 'refunded' }) }),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: 'Refund payment 11' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Refund $25.00' }));
    await waitFor(() => expect(bodyOf(mock, 'POST /v1/payment-processing/11/refund')).toEqual({}));
  });

  it('shows why a void was refused (batch already settled)', async () => {
    const user = userEvent.setup();
    backend({
      'POST /v1/payment-processing/11/void': () =>
        jsonResponse({
          message: 'The gateway did not void the transaction: Txn not voidable',
          data: tx({ id: 31, type: 'void', status: 'failed', message: 'Txn not voidable' }),
          sale: tx(),
        }),
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: 'Void payment 11' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Void payment' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Txn not voidable.*refund it instead/);
  });

  it('opens the detail with its refunds and the reverse actions', async () => {
    const user = userEvent.setup();
    const sale = tx({ status: 'partially_refunded', refundedAmount: 5, refundableAmount: 20 });
    backend({
      '/v1/payment-processing': page([sale, tx({ id: 40, type: 'refund', status: 'succeeded', amount: 5, parentTransactionId: 11 })]),
      '/v1/payment-processing/11': { data: sale },
    });
    render(<OrderPaymentsView />);
    await user.click(await screen.findByRole('button', { name: 'View payment 11' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('#PT-40')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    // Con devoluciones ya no se anula
    expect(within(dialog).queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
  });

  it('hides refund and void for a cashier without the manager role', async () => {
    role.value = 'merchant_user';
    role.shiftRole = 'cashier';
    backend();
    render(<OrderPaymentsView />);
    await screen.findByTestId('payment-row-11');
    expect(screen.queryByRole('button', { name: 'Refund payment 11' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void payment 11' })).not.toBeInTheDocument();
  });

  it('filters the history by type, status and order', async () => {
    const user = userEvent.setup();
    const mock = backend();
    render(<OrderPaymentsView />);
    await screen.findByTestId('payment-row-11');
    await user.selectOptions(screen.getByLabelText('Filter by type'), 'refund');
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'succeeded');
    await user.type(screen.getByLabelText('Filter by order ID'), '42');
    await waitFor(() => {
      const urls = mock.mock.calls.map(([input]) => String(input));
      expect(urls.some((u) => u.includes('type=refund') && u.includes('status=succeeded') && u.includes('orderId=42'))).toBe(true);
    });
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByLabelText('Filter by type')).toHaveValue('');
  });

  it('warns and disables charging when the branch has no gateway', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    backend({
      '/v1/payment-processing/checkout-options': { data: { configs: [], terminals: [], defaultCurrency: 'USD' } },
    });
    render(<OrderPaymentsView onNavigate={onNavigate} />);
    expect(await screen.findByText(/no active payment gateway yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /charge card for order/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /to a terminal/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /configure gateway/i }));
    expect(onNavigate).toHaveBeenCalledWith('payment-gateway-configs');
  });

  it('shows a retry card when the API is down', async () => {
    const mock = fakeBackend({});
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'boom' }, 500)));
    render(<OrderPaymentsView />);
    expect(await screen.findByRole('button', { name: /retry connection/i })).toBeInTheDocument();
    expect(calledRoutes(mock)).toEqual([]);
  });
});
