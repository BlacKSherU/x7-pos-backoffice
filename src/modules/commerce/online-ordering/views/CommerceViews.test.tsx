// Carga básica de las vistas de comercio online contra un backend falso: qué endpoints se piden,
// que los datos llegan a la pantalla y cómo se comporta cada vista cuando una petición falla.
import { cleanup, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineStoresView } from '@/modules/commerce/online-ordering/views/online-stores/OnlineStoresView';
import { OnlineMenusView } from '@/modules/commerce/online-ordering/views/online-menus/OnlineMenusView';
import { OnlineOrderingHubView } from '@/modules/commerce/online-ordering/views/OnlineOrderingHubView';
import { OnlineOrderItemsView } from '@/modules/commerce/online-ordering/views/online-order-items/OnlineOrderItemsView';
import { OnlinePaymentsView } from '@/modules/commerce/online-ordering/views/online-payments/OnlinePaymentsView';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';

// Some shared components (quick links, nav hubs) navigate with react-router.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>()),
  getAccessToken: vi.fn(() => 'mock-token'),
  clearAuthSession: vi.fn(),
}));

const STORES = [
  { id: 1, subdomain: 'pizza-roma', theme: 'default', currency: 'USD', timezone: 'UTC', is_active: true, status: 'active' },
  { id: 2, subdomain: 'sushi-go', theme: 'default', currency: 'EUR', timezone: 'UTC', is_active: false, status: 'active' },
];
const MENUS = [
  { id: 7, name: 'Dinner Menu', storeId: 1, isActive: true, store: { id: 1, subdomain: 'pizza-roma' } },
];

const stub = (routes: Parameters<typeof fakeBackend>[0]) => {
  const fetchMock = fakeBackend(routes);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OnlineStoresView', () => {
  it('loads active and archived stores from /online-stores', async () => {
    const fetchMock = stub({
      '/online-stores': (_init: RequestInit | undefined, url: string) =>
        jsonResponse({ data: url.includes('status=deleted') ? [] : STORES }),
    });
    render(<OnlineStoresView />);

    expect(await screen.findByText('pizza-roma')).toBeInTheDocument();
    expect(calledRoutes(fetchMock).filter((r) => r === 'GET /online-stores')).toHaveLength(2);
  });

  it('still renders active stores when the archived list fails', async () => {
    stub({
      '/online-stores': (_init: RequestInit | undefined, url: string) =>
        url.includes('status=deleted')
          ? jsonResponse({ message: 'boom' }, 500)
          : jsonResponse({ data: STORES }),
    });
    render(<OnlineStoresView />);

    expect(await screen.findByText('pizza-roma')).toBeInTheDocument();
  });

  it('shows the error state when the active list fails', async () => {
    stub({ '/online-stores': () => jsonResponse({ message: 'Stores service down' }, 500) });
    render(<OnlineStoresView />);

    expect((await screen.findAllByText('Stores service down')).length).toBeGreaterThan(0);
  });

  it('sends the publish toggle to PUT /online-stores/:id with the auth header', async () => {
    const fetchMock = stub({
      '/online-stores': (_init: RequestInit | undefined, url: string) =>
        jsonResponse({ data: url.includes('status=deleted') ? [] : STORES }),
      'PUT /online-stores/1': () => jsonResponse({ data: { ...STORES[0], is_active: false } }),
    });
    render(<OnlineStoresView />);
    await screen.findByText('pizza-roma');

    await userEvent.click(screen.getAllByTitle('Published & live. Click to set Maintenance mode')[0]);

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PUT /online-stores/1'));
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({ isActive: false });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer mock-token');
  });

  it('redirects to login on a 401', async () => {
    const originalLocation = window.location;
    // @ts-expect-error overriding for test
    delete window.location;
    // @ts-expect-error partial mock
    window.location = { href: '' };
    stub({ '/online-stores': () => jsonResponse({}, 401) });
    render(<OnlineStoresView />);

    await waitFor(() => expect(window.location.href).toBe('/login'));
    // @ts-expect-error restoring original Location object
    window.location = originalLocation;
  });
});

describe('OnlineMenusView', () => {
  it('loads menus and the stores used to bind them', async () => {
    const fetchMock = stub({ '/online-menus': { data: MENUS }, '/online-stores': { data: STORES } });
    render(<OnlineMenusView />);

    expect(await screen.findByText('Dinner Menu')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).toEqual(
      expect.arrayContaining(['GET /online-menus', 'GET /online-stores']),
    );
  });

  it('shows the error state when the menus request fails', async () => {
    stub({
      '/online-menus': () => jsonResponse({ message: 'Menus service down' }, 500),
      '/online-stores': { data: STORES },
    });
    render(<OnlineMenusView />);

    expect((await screen.findAllByText('Menus service down')).length).toBeGreaterThan(0);
  });
});

describe('OnlineOrderingHubView', () => {
  it('counts stores and published stores from the backend', async () => {
    const fetchMock = stub({ '/online-stores': { data: STORES }, '/online-menus': { data: MENUS } });
    render(<OnlineOrderingHubView />);

    expect(await screen.findByText('1 in maintenance')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).toEqual(
      expect.arrayContaining(['GET /online-stores', 'GET /online-menus']),
    );
  });

  it('keeps the store KPIs when the menus request fails', async () => {
    stub({
      '/online-stores': { data: STORES },
      '/online-menus': () => jsonResponse({ message: 'down' }, 500),
    });
    render(<OnlineOrderingHubView />);

    expect(await screen.findByText('1 in maintenance')).toBeInTheDocument();
  });
});

const ORDER_ITEMS = [
  {
    id: 1,
    onlineOrderId: 10,
    productId: 5,
    variantId: 2,
    orderItemId: 99,
    quantity: 2,
    unitPrice: 12.5,
    modifiers: { extraCheese: true },
    notes: 'No onions',
    kitchenLineStatus: 'PENDING',
    status: 'active',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
    product: { id: 5, name: 'Classic Burger', sku: 'BRG-01' },
    variant: { id: 2, name: 'Double' },
  },
  {
    id: 2,
    onlineOrderId: 10,
    productId: 6,
    variantId: null,
    orderItemId: null,
    quantity: 1,
    unitPrice: 4.5,
    modifiers: null,
    notes: null,
    kitchenLineStatus: 'READY',
    status: 'deleted',
    createdAt: '2026-11-18T10:05:00Z',
    updatedAt: '2026-11-18T10:05:00Z',
    product: { id: 6, name: 'Cola Soda', sku: 'DRK-01' },
    variant: null,
  },
];

const ONLINE_PAYMENTS = [
  {
    id: 1,
    onlineOrderId: 10,
    paymentProvider: 'stripe',
    transactionId: 'txn_stripe_001',
    amount: 45.5,
    status: 'paid',
    processedAt: '2026-11-18T10:00:00Z',
    logicalStatus: 'active',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
  },
  {
    id: 2,
    onlineOrderId: 11,
    paymentProvider: 'paypal',
    transactionId: 'txn_pp_002',
    amount: 15.0,
    status: 'pending',
    processedAt: null,
    logicalStatus: 'active',
    createdAt: '2026-11-18T10:05:00Z',
    updatedAt: '2026-11-18T10:05:00Z',
  },
  {
    id: 3,
    onlineOrderId: 12,
    paymentProvider: 'square',
    transactionId: 'txn_sq_003',
    amount: 10.0,
    status: 'failed',
    processedAt: null,
    logicalStatus: 'active',
    createdAt: '2026-11-18T10:10:00Z',
    updatedAt: '2026-11-18T10:10:00Z',
  },
  {
    id: 4,
    onlineOrderId: 13,
    paymentProvider: 'clover_pay',
    transactionId: 'txn_cl_004',
    amount: 5.0,
    status: 'refunded',
    processedAt: '2026-11-18T10:15:00Z',
    logicalStatus: 'active',
    createdAt: '2026-11-18T10:15:00Z',
    updatedAt: '2026-11-18T10:15:00Z',
  },
];

describe('OnlineOrderItemsView', () => {
  it('loads line items and renders active lines with product, variant, and POS binding', async () => {
    const fetchMock = stub({
      '/online-order-items': { data: ORDER_ITEMS },
      '/online-orders': { data: [{ id: 10, customer: { name: 'Alice' } }] },
      '/products': { data: [{ id: 5, name: 'Classic Burger', basePrice: 12.5 }, { id: 6, name: 'Cola Soda', basePrice: 4.5 }] },
      '/variants': { data: [{ id: 2, productId: 5, name: 'Double', price: 12.5 }] },
    });
    render(<OnlineOrderItemsView />);

    expect(await screen.findByText('#ORI-1')).toBeInTheDocument();
    expect(screen.getByText('Classic Burger')).toBeInTheDocument();
    expect(screen.queryByText('#ORI-2')).not.toBeInTheDocument();
    expect(calledRoutes(fetchMock)).toEqual(
      expect.arrayContaining(['GET /online-order-items']),
    );
  });

  it('reveals deleted line items when the DELETED logical status checkbox is checked', async () => {
    stub({
      '/online-order-items': { data: ORDER_ITEMS },
      '/online-orders': { data: [{ id: 10, customer: { name: 'Alice' } }] },
      '/products': { data: [{ id: 5, name: 'Classic Burger', basePrice: 12.5 }, { id: 6, name: 'Cola Soda', basePrice: 4.5 }] },
      '/variants': { data: [] },
    });
    render(<OnlineOrderItemsView />);

    expect(await screen.findByText('#ORI-1')).toBeInTheDocument();
    const deletedCheckbox = screen.getByLabelText('DELETED');
    await userEvent.click(deletedCheckbox);

    expect(await screen.findByText('#ORI-2')).toBeInTheDocument();
    expect(screen.getByText('Cola Soda')).toBeInTheDocument();
  });

  it('shows the error banner when /online-order-items fails', async () => {
    stub({
      '/online-order-items': () => jsonResponse({ message: 'Server returned HTTP 500' }, 500),
      '/online-orders': { data: [] },
      '/products': { data: [] },
      '/variants': { data: [] },
    });
    render(<OnlineOrderItemsView />);

    expect(await screen.findByText('Server returned HTTP 500')).toBeInTheDocument();
  });
});

describe('OnlinePaymentsView', () => {
  it('loads payments, displays KPI financial totals, and renders transaction rows', async () => {
    const fetchMock = stub({
      '/online-payments': { data: ONLINE_PAYMENTS },
      '/online-orders': { data: [{ id: 10, customer: { name: 'Alice' }, totalAmount: 45.5 }] },
    });
    render(<OnlinePaymentsView />);

    expect(await screen.findByText('#PAY-1')).toBeInTheDocument();
    expect(screen.getByText('txn_stripe_001')).toBeInTheDocument();
    expect(screen.getByText('$45.50', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('$15.00', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('$10.00', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('$5.00', { selector: 'div' })).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).toEqual(
      expect.arrayContaining(['GET /online-payments', 'GET /online-orders']),
    );
  });

  it('shows the error banner when /online-payments fails', async () => {
    stub({
      '/online-payments': () => jsonResponse({ message: 'Server returned HTTP 503' }, 503),
      '/online-orders': { data: [] },
    });
    render(<OnlinePaymentsView />);

    expect(await screen.findByText('Server returned HTTP 503')).toBeInTheDocument();
  });
});
