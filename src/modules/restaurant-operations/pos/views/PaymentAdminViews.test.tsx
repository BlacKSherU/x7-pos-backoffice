import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { fakeBackend, jsonResponse } from '@/test/fetch';
import { PaymentGatewayConfigsView } from '@/modules/restaurant-operations/pos/views/PaymentGatewayConfigsView';
import { PaymentTerminalsView } from '@/modules/restaurant-operations/pos/views/PaymentTerminalsView';
import { resetCompanyIdCache } from '@/modules/restaurant-operations/pos/api/payments';
import { CardField, type CardFieldHandle } from '@/modules/restaurant-operations/pos/lib/card-fields';

vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>();
  return {
    ...actual,
    getAccessToken: () => 'mock-token',
    clearAuthSession: vi.fn(),
    getStoredUser: () => ({ id: 1, role: 'merchant_admin', merchant: { id: 5 } }),
  };
});

const STRIPE = {
  id: 7,
  companyId: 2,
  merchantId: null,
  provider: 'stripe',
  environment: 'sandbox',
  displayName: 'Stripe main',
  credentials: { secretKey: 'sk_test_****1234', publishableKey: 'pk_test_abc' },
  isActive: true,
  isDefault: true,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};
const CARDPOINTE = {
  ...STRIPE,
  id: 8,
  provider: 'cardpointe',
  displayName: 'CardPointe UAT',
  credentials: { merchantId: '496160873888', username: '****', password: '****', site: 'fts-uat' },
  isDefault: false,
};
const TERMINAL = {
  id: 3,
  companyId: 2,
  merchantId: 5,
  paymentConfigId: 8,
  provider: 'cardpointe',
  cashDrawerId: null,
  name: 'Counter Bolt',
  model: 'Lane/3000',
  deviceIdentifier: 'C032UQ03960231',
  isActive: true,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

const bodyOf = (mock: ReturnType<typeof fakeBackend>, route: string) => {
  const call = mock.mock.calls.find(([input, init]) => {
    const path = String(input).replace(/^\/api/, '').split('?')[0];
    return `${(init?.method ?? 'GET').toUpperCase()} ${path}` === route;
  });
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
};

beforeEach(() => resetCompanyIdCache());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('PaymentGatewayConfigsView', () => {
  const backend = (overrides: Record<string, unknown> = {}) => {
    const mock = fakeBackend({
      '/companies/company/profile': { data: { id: 2 } },
      '/v1/merchants/2/payment-configs': { data: [STRIPE, CARDPOINTE] },
      ...overrides,
    });
    vi.stubGlobal('fetch', mock);
    return mock;
  };

  it('lists the gateways with masked secrets and the default badge', async () => {
    backend();
    render(<PaymentGatewayConfigsView />);
    const row = await screen.findByTestId('gateway-row-7');
    expect(within(row).getByText('Default')).toBeInTheDocument();
    expect(within(row).getByText('sk_test_****1234')).toBeInTheDocument();
    expect(within(row).getByText('All branches')).toBeInTheDocument();
    expect(within(screen.getByTestId('gateway-row-8')).getByRole('button', { name: /make cardpointe uat the default/i })).toBeInTheDocument();
  });

  it('creates a CardPointe gateway with its credential fields', async () => {
    const user = userEvent.setup();
    const mock = backend({ 'POST /v1/merchants/2/payment-configs': () => jsonResponse({ data: CARDPOINTE }, 201) });
    render(<PaymentGatewayConfigsView />);
    await user.click(await screen.findByRole('button', { name: /new gateway/i }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Provider'), 'cardpointe');
    await user.type(within(dialog).getByLabelText('Display name'), 'CardPointe UAT');
    const create = within(dialog).getByRole('button', { name: 'Create gateway' });
    expect(create).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/merchant id/i), '496160873888');
    await user.type(within(dialog).getByLabelText(/api username/i), 'testing');
    await user.type(within(dialog).getByLabelText(/api password/i), 'testing123');
    await user.type(within(dialog).getByLabelText(/gateway site/i), 'fts-uat');
    await user.click(within(dialog).getByLabelText(/only for this branch/i));
    await user.click(create);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodyOf(mock, 'POST /v1/merchants/2/payment-configs')).toEqual({
      provider: 'cardpointe',
      environment: 'sandbox',
      displayName: 'CardPointe UAT',
      merchantId: 5,
      credentials: { merchantId: '496160873888', username: 'testing', password: 'testing123', site: 'fts-uat' },
      isDefault: false,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Payment gateway created');
  });

  it('edits without resending secrets left empty', async () => {
    const user = userEvent.setup();
    const mock = backend({ 'PATCH /v1/merchants/2/payment-configs/7': () => jsonResponse({ data: STRIPE }) });
    render(<PaymentGatewayConfigsView />);
    await user.click(await screen.findByRole('button', { name: 'Edit Stripe main' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Provider')).toBeDisabled();
    const name = within(dialog).getByLabelText('Display name');
    await user.clear(name);
    await user.type(name, 'Stripe EU');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(bodyOf(mock, 'PATCH /v1/merchants/2/payment-configs/7')).toEqual({
        environment: 'sandbox',
        displayName: 'Stripe EU',
        merchantId: null,
        credentials: { publishableKey: 'pk_test_abc' },
      }),
    );
  });

  it('makes a gateway the default, deactivates it and shows the delete conflict', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'PATCH /v1/merchants/2/payment-configs/8': () => jsonResponse({ data: CARDPOINTE }),
      'DELETE /v1/merchants/2/payment-configs/8': () =>
        jsonResponse({ message: '1 terminal(s) are bound to this payment config; delete or rebind them first' }, 409),
    });
    render(<PaymentGatewayConfigsView />);
    await user.click(await screen.findByRole('button', { name: /make cardpointe uat the default/i }));
    await waitFor(() => expect(bodyOf(mock, 'PATCH /v1/merchants/2/payment-configs/8')).toEqual({ isDefault: true }));

    await user.click(screen.getByRole('button', { name: 'Deactivate CardPointe UAT' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(
        mock.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(String(init?.body))),
      ).toContainEqual({ isActive: false }),
    );

    await user.click(screen.getByRole('button', { name: 'Delete CardPointe UAT' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/terminal\(s\) are bound/);
  });

  it('shows the empty state', async () => {
    backend({ '/v1/merchants/2/payment-configs': { data: [] } });
    render(<PaymentGatewayConfigsView />);
    expect(await screen.findByTestId('gateways-empty-state')).toBeInTheDocument();
  });
});

describe('PaymentTerminalsView', () => {
  const backend = (overrides: Record<string, unknown> = {}) => {
    const mock = fakeBackend({
      '/companies/company/profile': { data: { id: 2 } },
      '/v1/merchants/2/payment-configs': { data: [STRIPE, CARDPOINTE] },
      '/v1/merchants/2/payment-terminals': { data: [TERMINAL] },
      ...overrides,
    });
    vi.stubGlobal('fetch', mock);
    return mock;
  };

  it('lists the terminals with their gateway', async () => {
    backend();
    render(<PaymentTerminalsView />);
    const row = await screen.findByTestId('terminal-row-3');
    expect(within(row).getByText('CardPointe UAT')).toBeInTheDocument();
    expect(within(row).getByText('C032UQ03960231')).toBeInTheDocument();
  });

  it('registers a Stripe reader and validates its ID', async () => {
    const user = userEvent.setup();
    const mock = backend({ 'POST /v1/merchants/2/payment-terminals': () => jsonResponse({ data: TERMINAL }, 201) });
    render(<PaymentTerminalsView />);
    await user.click(await screen.findByRole('button', { name: /register terminal/i }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Payment gateway'), '7');
    await user.type(within(dialog).getByLabelText('Name'), 'WisePOS E');
    const device = within(dialog).getByLabelText(/stripe reader id/i);
    await user.type(device, 'C032UQ');
    expect(device).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByRole('button', { name: 'Register terminal' })).toBeDisabled();
    await user.clear(device);
    await user.type(device, 'tmr_FakeReader1');
    await user.click(within(dialog).getByRole('button', { name: 'Register terminal' }));
    await waitFor(() =>
      expect(bodyOf(mock, 'POST /v1/merchants/2/payment-terminals')).toEqual({
        paymentConfigId: 7,
        name: 'WisePOS E',
        deviceIdentifier: 'tmr_FakeReader1',
        merchantId: 5,
      }),
    );
  });

  it('edits, deactivates and deletes a terminal', async () => {
    const user = userEvent.setup();
    const mock = backend({
      'PATCH /v1/merchants/2/payment-terminals/3': () => jsonResponse({ data: TERMINAL }),
      'DELETE /v1/merchants/2/payment-terminals/3': () => jsonResponse({ data: TERMINAL }),
    });
    render(<PaymentTerminalsView />);
    await user.click(await screen.findByRole('button', { name: 'Edit Counter Bolt' }));
    let dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Bar Bolt');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(bodyOf(mock, 'PATCH /v1/merchants/2/payment-terminals/3')).toMatchObject({ name: 'Bar Bolt' }),
    );

    await user.click(await screen.findByRole('button', { name: 'Deactivate Counter Bolt' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await user.click(await screen.findByRole('button', { name: 'Delete Counter Bolt' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Payment terminal deleted'));
  });

  it('shows the empty state', async () => {
    backend({ '/v1/merchants/2/payment-terminals': { data: [] } });
    render(<PaymentTerminalsView />);
    expect(await screen.findByTestId('terminals-empty-state')).toBeInTheDocument();
  });
});

describe('CardField (CardSecure)', () => {
  const tokenization = {
    method: 'cardsecure_iframe' as const,
    iframeUrl: 'https://fts-uat.cardconnect.com/itoke/ajax-tokenizer.html',
  };
  const post = (data: unknown, origin = 'https://fts-uat.cardconnect.com') =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin }));
    });

  it('embeds the tokenizer and only trusts messages from its origin', async () => {
    const onComplete = vi.fn();
    const ref = createRef<CardFieldHandle>();
    render(<CardField ref={ref} tokenization={tokenization} onCompleteChange={onComplete} />);
    const iframe = screen.getByTitle('Secure card entry');
    expect(iframe.getAttribute('src')).toMatch(/^https:\/\/fts-uat\.cardconnect\.com\/itoke\/ajax-tokenizer\.html\?useexpiry=true&usecvv=true/);

    await post({ message: '9411111111114242', expiry: '1230' }, 'https://evil.example.com');
    await expect(ref.current!.tokenize()).rejects.toThrow('Enter the card number');

    await post({ message: '', validationError: 'Invalid Account Number' });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid Account Number');

    await post({ message: '9411111111114242', expiry: '1230', validationError: '' });
    expect(onComplete).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/ending in 4242/)).toBeInTheDocument();
    await expect(ref.current!.tokenize()).resolves.toEqual({ token: '9411111111114242', expiry: '1230' });
  });

  it('explains when the gateway cannot tokenize cards', () => {
    render(
      <CardField
        tokenization={{ method: 'unavailable', reason: 'Add the publishable key' }}
        onCompleteChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Add the publishable key');
  });
});
