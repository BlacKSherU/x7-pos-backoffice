import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import { ReceiptsView } from './ReceiptsView';
import type { Receipt } from '../../types/receipts';

const invoice: Receipt = {
  id: 1,
  order_id: 101,
  merchant_id: 1,
  invoice_number: 'INV-000001',
  type: 'INVOICE',
  fiscal_data: '{"tax_id":"20123456789","fiscal_number":"F001-1"}',
  subtotal: 100,
  total_tax: 19,
  total_discount: 5.5,
  grand_total: 113.5,
  currency: 'USD',
  is_active: true,
  is_locked: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

const receipt: Receipt = {
  ...invoice,
  id: 2,
  order_id: 102,
  invoice_number: 'INV-000002',
  type: 'RECEIPT',
  fiscal_data: null,
  subtotal: 1234.5,
  total_tax: 0,
  total_discount: 0,
  grand_total: 1234.5,
  currency: 'EUR',
  is_locked: true,
};

function page(data: Receipt[], extra: Partial<{ total: number; totalPages: number; page: number }> = {}) {
  return {
    statusCode: 200,
    message: 'Receipts retrieved successfully',
    data,
    page: extra.page ?? 1,
    limit: 10,
    total: extra.total ?? data.length,
    totalPages: extra.totalPages ?? 1,
    hasNext: false,
    hasPrev: false,
  };
}

const emptySummary = {
  status: 'active',
  total_receipts: 2,
  active_receipts: 2,
  inactive_receipts: 1,
  locked_receipts: 1,
  currency: 'USD',
  grand_total: 113.5,
  subtotal: 100,
  total_tax: 19,
  total_discount: 5.5,
  average_ticket: 56.75,
  by_type: [
    { type: 'INVOICE', receipts: 1, grand_total: 113.5 },
    { type: 'RECEIPT', receipts: 1, grand_total: 0 },
  ],
  by_currency: [{ currency: 'USD', receipts: 2, grand_total: 113.5, total_tax: 19 }],
};

const taxBreakdown = {
  status: 'active',
  date_from: null,
  date_to: null,
  currency: 'USD',
  total_tax: 38.3,
  by_tax: [
    { name: 'VAT', rate: 19, currency: 'USD', total_amount: 38.2, tax_lines: 3, receipts: 2 },
    { name: 'Consumption Tax', rate: 8, currency: 'USD', total_amount: 0.1, tax_lines: 1, receipts: 1 },
  ],
  by_currency: [{ currency: 'USD', total_amount: 38.3, tax_lines: 4 }],
};

const invoiceDetails = {
  receipt: invoice,
  items: [
    {
      id: 7,
      name: 'Burger Combo',
      sku: 'SKU-001',
      quantity: 2,
      unit_price: 12.5,
      subtotal: 25,
      discount_amount: 2.5,
      total: 22.5,
    },
    { id: 8, name: 'Soda', sku: null, quantity: 1, unit_price: 3, subtotal: 3, discount_amount: 0, total: 3 },
  ],
  taxes: [
    { id: 3, receipt_item_id: null, name: 'VAT', rate: 19, amount: 4.28, scope: 'RECEIPT' },
    { id: 4, receipt_item_id: 8, name: 'Consumption Tax', rate: 8, amount: 0.24, scope: 'ITEM' },
  ],
  items_total: 25.5,
  taxes_total: 4.52,
};

/** Backend falso con el resumen de KPIs y el desglose de impuestos ya registrados. */
const orderOptions = {
  default_currency: 'CLP',
  orders: [
    {
      id: 555,
      order_number: '0009',
      status: 'paid',
      order_type: 'take_out',
      total: '34510.00',
      is_paid: true,
      created_at: '2026-11-24T10:00:00.000Z',
      customer_name: 'Cliente Mesón',
      issued_types: [],
    },
    {
      id: 556,
      order_number: '0010',
      status: 'paid',
      order_type: 'dine_in',
      total: '27370.00',
      is_paid: true,
      created_at: '2026-11-24T10:20:00.000Z',
      customer_name: 'Viña Santa Rita Eventos SpA',
      issued_types: ['RECEIPT'],
    },
  ],
};

function backend(routes: Parameters<typeof fakeBackend>[0]) {
  return fakeBackend({
    '/receipts/summary': { data: emptySummary },
    '/receipts/tax-breakdown': { data: taxBreakdown },
    '/receipts/order-options': { data: orderOptions },
    ...routes,
  });
}

/** URLs GET de un endpoint concreto (p. ej. '/receipts/tax-breakdown'). */
function urlsOf(fetchMock: ReturnType<typeof fakeBackend>, path: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), 'http://localhost'))
    .filter((url) => url.pathname.replace(/^\/api/, '') === path);
}

function listUrls(fetchMock: ReturnType<typeof fakeBackend>): URL[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() }))
    .filter(({ url, method }) => method === 'GET' && /\/receipts(\?|$)/.test(url))
    .map(({ url }) => new URL(url, 'http://localhost'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReceiptsView — central table (Historia 18)', () => {
  it('shows every monetary column with 2 decimals and the currency code', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, receipt]) }));
    render(<ReceiptsView />);

    const row = await screen.findByTestId('receipt-row-1');
    expect(within(row).getByText('INV-000001')).toBeInTheDocument();
    expect(within(row).getByText('#101')).toBeInTheDocument();
    expect(within(row).getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-1-subtotal')).toHaveTextContent('100.00 USD');
    expect(screen.getByTestId('receipt-1-tax')).toHaveTextContent('19.00 USD');
    expect(screen.getByTestId('receipt-1-discount')).toHaveTextContent('5.50 USD');
    expect(screen.getByTestId('receipt-1-grand-total')).toHaveTextContent('113.50 USD');
    expect(screen.getByTestId('receipt-2-grand-total')).toHaveTextContent('1,234.50 EUR');
    expect(within(screen.getByTestId('receipt-row-2')).getByText('Locked')).toBeInTheDocument();
    expect(within(row).getByText(/tax_id: 20123456789/)).toBeInTheDocument();
  });

  it('highlights rows on hover with the corporate accent #ae001a', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice]) }));
    render(<ReceiptsView />);

    const row = await screen.findByTestId('receipt-row-1');
    expect(row.className).toContain('hover:border-l-[#ae001a]');
    expect(row.className).toContain('hover:bg-[#ae001a]/[0.04]');
  });

  it('searches by invoice number / fiscal data in real time (debounced, back to page 1)', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    const input = screen.getByLabelText('Search receipts');
    // Dos cambios dentro de la ventana de debounce: una sola petición con el texto final.
    fireEvent.change(input, { target: { value: 'F' } });
    fireEvent.change(input, { target: { value: 'F001' } });
    expect(listUrls(fetchMock).filter((u) => u.searchParams.has('search'))).toHaveLength(0);

    await waitFor(() => {
      const last = listUrls(fetchMock).at(-1);
      expect(last?.searchParams.get('search')).toBe('F001');
      expect(last?.searchParams.get('page')).toBe('1');
    });
    expect(listUrls(fetchMock).filter((u) => u.searchParams.has('search'))).toHaveLength(1);
  });

  it('filters by type and status (status=inactive lists logically deleted receipts)', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');
    expect(listUrls(fetchMock)[0].searchParams.get('status')).toBe('active');

    await userEvent.click(screen.getByRole('button', { name: /invoices/i }));
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'inactive');

    await waitFor(() => {
      const last = listUrls(fetchMock).at(-1);
      expect(last?.searchParams.get('type')).toBe('INVOICE');
      expect(last?.searchParams.get('status')).toBe('inactive');
    });
  });

  it('shows the receipt details drawer', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice]) }));
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000001' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('RECEIPT DETAILS')).toBeInTheDocument();
    expect(within(dialog).getByTestId('receipt-detail-grand-total')).toHaveTextContent('113.50 USD');
    expect(within(dialog).getByText('20123456789')).toBeInTheDocument();
  });

  it('edits a receipt with PATCH, sending only the changed fields', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice]),
      'PATCH /receipts/1': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ invoiceNumber: 'INV-000900', currency: 'PEN' });
        return jsonResponse({ data: { ...invoice, invoice_number: 'INV-000900', currency: 'PEN' } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    const invoiceInput = within(dialog).getByLabelText('Invoice number');
    await userEvent.clear(invoiceInput);
    await userEvent.type(invoiceInput, 'INV-000900');
    await userEvent.click(within(dialog).getByLabelText('Currency *'));
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Search currency' }), 'pen');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/1'));
    expect(await screen.findByTestId('receipt-1-grand-total')).toHaveTextContent('113.50 PEN');
    expect(screen.getByText('INV-000900')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the drawer open and shows the 409 when the invoice number is taken by the merchant', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([invoice]),
        'PATCH /receipts/1': () =>
          jsonResponse(
            {
              statusCode: 409,
              message: "Invoice number 'INV-000002' is already used by another receipt of this merchant",
            },
            409,
          ),
      }),
    );
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    const invoiceInput = within(dialog).getByLabelText('Invoice number');
    await userEvent.clear(invoiceInput);
    await userEvent.type(invoiceInput, 'INV-000002');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Invoice number 'INV-000002' is already used by another receipt of this merchant",
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('creates a receipt leaving the invoice number to the backend sequence', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice]),
      'POST /receipts': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ orderId: 555, type: 'INVOICE', currency: 'CLP' });
        return jsonResponse({ data: { ...invoice, id: 9, order_id: 555, invoice_number: 'INV-000009' } }, 201);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'New Receipt' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type *'), 'INVOICE');
    // la moneda arranca en la moneda base de la company
    await waitFor(() => expect(within(dialog).getByLabelText('Currency *')).toHaveTextContent('CLP'));
    await userEvent.click(within(dialog).getByLabelText('Order *'));
    await userEvent.click(await within(dialog).findByRole('option', { name: /Order #0009 · ID 555/ }));
    expect(within(dialog).getByLabelText('Order *')).toHaveTextContent('Order #0009 · ID 555');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Receipt' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('POST /receipts'));
    expect(await screen.findByText('INV-000009 created.')).toBeInTheDocument();
    const optionUrls = urlsOf(fetchMock, '/receipts/order-options');
    expect(optionUrls.at(-1)?.searchParams.get('type')).toBe('INVOICE');
  });

  it('requires an order and searches orders on the backend', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'New Receipt' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Receipt' }));
    expect(within(dialog).getByText('Select the order to bill.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Order *'));
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Search order' }), 'santa');
    await waitFor(() =>
      expect(urlsOf(fetchMock, '/receipts/order-options').some((url) => url.searchParams.get('search') === 'santa')).toBe(
        true,
      ),
    );
    // la orden 0010 ya tiene un RECEIPT: se describe en la opción
    expect(within(dialog).getByRole('option', { name: /Order #0010/ })).toHaveTextContent('already has Receipt');
  });

  it('picks the currency from a searchable ISO 4217 list', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice]) }));
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'New Receipt' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Currency *')).toHaveTextContent('CLP'));
    await userEvent.click(within(dialog).getByLabelText('Currency *'));
    const search = within(dialog).getByRole('combobox', { name: 'Search currency' });
    await userEvent.type(search, 'euro');
    expect(within(dialog).getByRole('option', { name: /^EUR/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /^USD/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(within(dialog).getByLabelText('Currency *')).toHaveTextContent('EUR');
  });

  it('logically deletes a receipt with PATCH /status isActive=false and reloads the list', async () => {
    let active = true;
    const fetchMock = backend({
      '/receipts': () => jsonResponse(page(active ? [invoice] : [])),
      'PATCH /receipts/1/status': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ isActive: false });
        active = false;
        return jsonResponse({ data: { ...invoice, is_active: false } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate INV-000001' }));
    expect(screen.getByText(/leaves the active list/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/1/status'));
    expect(await screen.findByText('INV-000001 deactivated.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('receipt-row-1')).not.toBeInTheDocument());
  });

  it('no longer offers reactivation: inactive receipts are immutable (Historia 11)', async () => {
    const inactive = { ...invoice, is_active: false };
    const fetchMock = backend({ '/receipts': page([inactive]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    const row = await screen.findByTestId('receipt-row-1');
    expect(within(row).getByText('Inactive')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit INV-000001' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Reactivate INV-000001' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Lock INV-000001' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'View INV-000001' })).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'View INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /reactivate/i })).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('receipt-detail-immutable')).toHaveTextContent(/cannot be modified/);
    expect(calledRoutes(fetchMock)).not.toContain('PATCH /receipts/1/status');
  });

  it('paginates on the server', async () => {
    const fetchMock = backend({ '/receipts': page([invoice], { total: 25, totalPages: 3 }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(listUrls(fetchMock).at(-1)?.searchParams.get('page')).toBe('2'));
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': () => jsonResponse({ message: 'boom' }, 500) }));
    render(<ReceiptsView />);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('ReceiptsView — Command Hub Header (Historia 19)', () => {
  it('renders the header at the top of the view, before the receipts table', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice]) }));
    render(<ReceiptsView />);

    const view = screen.getByTestId('receipts-view');
    const header = screen.getByTestId('receipts-command-header');
    expect(view.firstElementChild).toBe(header);
    const table = await screen.findByRole('table', { name: 'Receipts' });
    expect(header.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('loads the KPIs from GET /receipts/summary with the active status filter', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    expect(await screen.findByText('113.50 USD', { selector: '[data-testid="receipts-kpi-volume"] *' })).toBeInTheDocument();
    const summaryCall = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/receipts/summary'));
    expect(summaryCall).toContain('status=active');
  });

  it('applies the quick type filters to the table', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: /receipts\s*1$/i }));

    await waitFor(() => expect(listUrls(fetchMock).at(-1)?.searchParams.get('type')).toBe('RECEIPT'));
    expect(screen.getByRole('button', { name: /receipts\s*1$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns to the Billing & Transactions Command Hub without reloading the page', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice]) }));
    const onNavigate = vi.fn();
    render(<ReceiptsView onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('button', { name: /billing & transactions command hub/i }));

    expect(onNavigate).toHaveBeenCalledWith('billing-transactions-hub');
  });

  it('refreshes the KPIs after a logical deletion', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice]),
      'PATCH /receipts/1/status': () => jsonResponse({ data: { ...invoice, is_active: false } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    const summaryCalls = () => calledRoutes(fetchMock).filter((r) => r === 'GET /receipts/summary').length;
    await screen.findByTestId('receipt-row-1');
    await waitFor(() => expect(summaryCalls()).toBe(1));

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate INV-000001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(summaryCalls()).toBe(2));
  });
});

describe('ReceiptsView — master-detail rows (Historia 13)', () => {
  it('expands a row and loads its items (name, quantity, unit_price, total) and tax lines (name, rate, amount)', async () => {
    const fetchMock = backend({ '/receipts': page([invoice, receipt]), '/receipts/1/details': { data: invoiceDetails } });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    // Carga asíncrona: nada se pide hasta expandir.
    expect(calledRoutes(fetchMock)).not.toContain('GET /receipts/1/details');
    const toggle = screen.getByRole('button', { name: 'Expand INV-000001' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('receipt-1-details')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Collapse INV-000001' })).toHaveAttribute('aria-expanded', 'true');
    const details = screen.getByTestId('receipt-1-details');
    const items = await within(details).findByRole('table', { name: 'Items of INV-000001' });
    const burger = within(items).getByTestId('receipt-1-item-7');
    expect(burger).toHaveTextContent('Burger Combo');
    expect(burger).toHaveTextContent('2');
    expect(burger).toHaveTextContent('12.50 USD');
    expect(burger).toHaveTextContent('22.50 USD');
    expect(within(items).getByTestId('receipt-1-item-8')).toHaveTextContent('Soda');
    expect(within(items).getByTestId('receipt-1-items-total')).toHaveTextContent('25.50 USD');

    const taxes = within(details).getByRole('table', { name: 'Taxes of INV-000001' });
    const vat = within(taxes).getByTestId('receipt-1-tax-3');
    expect(vat).toHaveTextContent('VAT');
    expect(vat).toHaveTextContent('19%');
    expect(vat).toHaveTextContent('4.28 USD');
    expect(within(taxes).getByTestId('receipt-1-tax-4')).toHaveTextContent('Consumption Tax');
    expect(within(taxes).getByTestId('receipt-1-tax-4')).toHaveTextContent('Item #8');
    expect(within(taxes).getByTestId('receipt-1-taxes-total')).toHaveTextContent('4.52 USD');

    // Solo se expande la fila pulsada.
    expect(screen.getByRole('button', { name: 'Expand INV-000002' })).toHaveAttribute('aria-expanded', 'false');
    expect(calledRoutes(fetchMock).filter((r) => r === 'GET /receipts/1/details')).toHaveLength(1);
  });

  it('collapses the row and reuses the loaded details when expanding it again', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]), '/receipts/1/details': { data: invoiceDetails } });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));
    await within(screen.getByTestId('receipt-1-details')).findByText('Burger Combo');

    await userEvent.click(screen.getByRole('button', { name: 'Collapse INV-000001' }));
    expect(screen.queryByTestId('receipt-1-details')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));
    expect(within(screen.getByTestId('receipt-1-details')).getByText('Burger Combo')).toBeInTheDocument();
    expect(calledRoutes(fetchMock).filter((r) => r === 'GET /receipts/1/details')).toHaveLength(1);
  });

  it('does not reset the page or the search filter when expanding or collapsing rows', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice], { total: 25, totalPages: 3 }),
      '/receipts/1/details': { data: invoiceDetails },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    fireEvent.change(screen.getByLabelText('Search receipts'), { target: { value: 'INV' } });
    await waitFor(() => expect(listUrls(fetchMock).at(-1)?.searchParams.get('search')).toBe('INV'));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(listUrls(fetchMock).at(-1)?.searchParams.get('page')).toBe('2'));
    await screen.findByText(/Page 2 of 3/);
    const listCalls = listUrls(fetchMock).length;

    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));
    await within(screen.getByTestId('receipt-1-details')).findByText('Burger Combo');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse INV-000001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));

    expect(listUrls(fetchMock)).toHaveLength(listCalls);
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Search receipts')).toHaveValue('INV');
    const last = listUrls(fetchMock).at(-1);
    expect(last?.searchParams.get('page')).toBe('2');
    expect(last?.searchParams.get('search')).toBe('INV');
  });

  it('keeps a row expanded across a list reload and refreshes its details', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]), '/receipts/1/details': { data: invoiceDetails } });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');
    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));
    await within(screen.getByTestId('receipt-1-details')).findByText('Burger Combo');

    await userEvent.click(screen.getByRole('button', { name: 'Reload receipts' }));

    await waitFor(() =>
      expect(calledRoutes(fetchMock).filter((r) => r === 'GET /receipts/1/details')).toHaveLength(2),
    );
    expect(await within(screen.getByTestId('receipt-1-details')).findByText('Burger Combo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse INV-000001' })).toBeInTheDocument();
  });

  it('shows the error of a failed detail load with a retry', async () => {
    let attempts = 0;
    const fetchMock = backend({
      '/receipts': page([invoice]),
      '/receipts/1/details': () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ message: 'Details unavailable' }, 500)
          : jsonResponse({ data: invoiceDetails });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));
    const details = screen.getByTestId('receipt-1-details');
    expect(await within(details).findByRole('alert')).toHaveTextContent('Details unavailable');

    await userEvent.click(within(details).getByRole('button', { name: 'Retry' }));
    expect(await within(details).findByText('Burger Combo')).toBeInTheDocument();
  });

  it('shows an empty state for receipts without items or taxes', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([invoice]),
        '/receipts/1/details': { data: { ...invoiceDetails, items: [], taxes: [], items_total: 0, taxes_total: 0 } },
      }),
    );
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'Expand INV-000001' }));

    const details = screen.getByTestId('receipt-1-details');
    expect(await within(details).findByText('No line items on this receipt.')).toBeInTheDocument();
    expect(within(details).getByText('No tax lines on this receipt.')).toBeInTheDocument();
  });
});

describe('ReceiptsView — tax breakdown cards (Historia 13)', () => {
  it('shows the total tax collected per tax type at the top of the view', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    const section = screen.getByRole('region', { name: 'Tax breakdown' });
    const vat = await within(section).findByRole('listitem', { name: 'VAT 19%: 38.20 USD' });
    expect(vat).toHaveTextContent('2 receipts · 3 lines');
    expect(within(section).getByRole('listitem', { name: 'Consumption Tax 8%: 0.10 USD' })).toBeInTheDocument();
    expect(within(section).getByTestId('receipts-tax-total-card')).toHaveTextContent('38.30 USD');
    expect(within(section).getByTestId('receipts-tax-breakdown-range')).toHaveTextContent('All dates');

    // Arriba: antes de la tabla de recibos.
    const table = await screen.findByRole('table', { name: 'Receipts' });
    expect(section.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(urlsOf(fetchMock, '/receipts/tax-breakdown')[0].searchParams.get('status')).toBe('active');
  });

  it('recalculates the cards, the KPIs and the list when the date filter changes', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice]),
      '/receipts/tax-breakdown': (_init: RequestInit | undefined, url: string) =>
        jsonResponse({
          data: url.includes('dateFrom=2026-11-01')
            ? {
                ...taxBreakdown,
                total_tax: 10,
                by_tax: [{ name: 'VAT', rate: 19, currency: 'USD', total_amount: 10, tax_lines: 1, receipts: 1 }],
                by_currency: [{ currency: 'USD', total_amount: 10, tax_lines: 1 }],
              }
            : taxBreakdown,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    const section = screen.getByRole('region', { name: 'Tax breakdown' });
    await within(section).findByRole('listitem', { name: 'VAT 19%: 38.20 USD' });

    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-11-30' } });

    expect(await within(section).findByRole('listitem', { name: 'VAT 19%: 10.00 USD' })).toBeInTheDocument();
    expect(within(section).queryByRole('listitem', { name: /Consumption Tax/ })).not.toBeInTheDocument();
    expect(within(section).getByTestId('receipts-tax-breakdown-range')).toHaveTextContent(
      'Nov 1, 2026 – Nov 30, 2026',
    );

    await waitFor(() => {
      const breakdownUrl = urlsOf(fetchMock, '/receipts/tax-breakdown').at(-1);
      expect(breakdownUrl?.searchParams.get('dateFrom')).toBe('2026-11-01');
      expect(breakdownUrl?.searchParams.get('dateTo')).toBe('2026-11-30');
      const summaryUrl = urlsOf(fetchMock, '/receipts/summary').at(-1);
      expect(summaryUrl?.searchParams.get('dateFrom')).toBe('2026-11-01');
      expect(summaryUrl?.searchParams.get('dateTo')).toBe('2026-11-30');
      const listUrl = listUrls(fetchMock).at(-1);
      expect(listUrl?.searchParams.get('dateFrom')).toBe('2026-11-01');
      expect(listUrl?.searchParams.get('dateTo')).toBe('2026-11-30');
      expect(listUrl?.searchParams.get('page')).toBe('1');
    });
  });

  it('keeps the date range consistent and clears it with the other filters', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    const from = screen.getByLabelText('Created from');
    const to = screen.getByLabelText('Created to');
    fireEvent.change(to, { target: { value: '2026-11-10' } });
    fireEvent.change(from, { target: { value: '2026-11-20' } });
    expect(to).toHaveValue('2026-11-20');

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(from).toHaveValue('');
    expect(to).toHaveValue('');
    await waitFor(() => {
      const breakdownUrl = urlsOf(fetchMock, '/receipts/tax-breakdown').at(-1);
      expect(breakdownUrl?.searchParams.has('dateFrom')).toBe(false);
      expect(breakdownUrl?.searchParams.has('dateTo')).toBe(false);
    });
  });

  it('shows an empty message when no taxes were collected in the range', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([invoice]),
        '/receipts/tax-breakdown': { data: { ...taxBreakdown, total_tax: 0, by_tax: [], by_currency: [] } },
      }),
    );
    render(<ReceiptsView />);

    const section = screen.getByRole('region', { name: 'Tax breakdown' });
    expect(await within(section).findByText('No taxes were collected for these receipts.')).toBeInTheDocument();
    expect(within(section).getByTestId('receipts-tax-total-card')).toHaveTextContent('0.00 USD');
  });
});

describe('ReceiptsView — fiscal data and tax exemption (Historia 10)', () => {
  const exempt: Receipt = {
    ...invoice,
    id: 3,
    invoice_number: 'INV-000003',
    fiscal_data: '{"tax_id":"J-12345678-9","exemption_code":"EX-2026-001","fiscal_number":"F001-9"}',
    subtotal: 100,
    total_tax: 0,
    total_discount: 10,
    grand_total: 90,
  };

  it('shows the TAX EXEMPT badge in the table only for exempt receipts', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, exempt]) }));
    render(<ReceiptsView />);

    const exemptRow = await screen.findByTestId('receipt-row-3');
    expect(within(exemptRow).getByText('TAX EXEMPT')).toBeInTheDocument();
    expect(within(exemptRow).getByTestId('receipt-3-tax-exempt')).toHaveAttribute(
      'title',
      'Tax exemption EX-2026-001',
    );
    expect(within(screen.getByTestId('receipt-row-1')).queryByText('TAX EXEMPT')).not.toBeInTheDocument();
  });

  it('marks grand_total = subtotal + total_tax − total_discount as balanced to the cent', async () => {
    const unbalanced: Receipt = { ...invoice, id: 4, invoice_number: 'INV-000004', grand_total: 113.51 };
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, unbalanced]) }));
    render(<ReceiptsView />);

    const ok = await screen.findByTestId('receipt-1-balance');
    expect(ok).toHaveAttribute('data-balanced', 'true');
    expect(ok).toHaveAccessibleName(/balanced to the cent/i);
    const off = screen.getByTestId('receipt-4-balance');
    expect(off).toHaveAttribute('data-balanced', 'false');
    expect(off).toHaveAccessibleName(/out of balance by 0\.01 USD/i);
  });

  it('shows the badge, the structured fiscal data and the balance check in the details drawer', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([exempt]) }));
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000003' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('TAX EXEMPT')).toBeInTheDocument();
    expect(within(dialog).getByText('J-12345678-9')).toBeInTheDocument();
    expect(within(dialog).getByText('EX-2026-001')).toBeInTheDocument();
    expect(within(dialog).getByTestId('receipt-detail-tax-exempt')).toHaveTextContent('Yes');
    expect(within(dialog).getByText('F001-9')).toBeInTheDocument();
    const balance = within(dialog).getByTestId('receipt-detail-balance');
    expect(balance).toHaveAttribute('data-balanced', 'true');
    expect(balance).toHaveTextContent('100.00 + 0.00 − 10.00 = 90.00 USD');
    expect(balance).toHaveTextContent(/matches the grand total to the cent/);
    expect(within(dialog).getByTestId('receipt-detail-exemption-note')).toHaveTextContent('EX-2026-001');
  });

  it('edits tax_id, exemption_code and tax_exempt, keeping the other fiscal keys', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice]),
      'PATCH /receipts/1': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          fiscalData: JSON.stringify({
            tax_id: '20123456789',
            exemption_code: 'EX-77',
            fiscal_number: 'F001-1',
          }),
        });
        return jsonResponse({ data: { ...invoice, fiscal_data: '{"tax_id":"20123456789","exemption_code":"EX-77"}', total_tax: 0, grand_total: 94.5 } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Tax ID')).toHaveValue('20123456789');
    expect(within(dialog).getByLabelText('Additional fiscal data (JSON)')).toHaveValue(
      JSON.stringify({ fiscal_number: 'F001-1' }, null, 2),
    );
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /tax exempt customer/i }));
    expect(within(dialog).getByTestId('receipt-form-exempt-badge')).toHaveTextContent('TAX EXEMPT');
    await userEvent.type(within(dialog).getByLabelText('Exemption code *'), 'EX-77');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/1'));
    expect(await screen.findByText('TAX EXEMPT')).toBeInTheDocument();
  });

  it('applies the back-end validation before sending (exemption needs a code, 64-char limit)', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /tax exempt customer/i }));
    const taxId = within(dialog).getByLabelText('Tax ID');
    await userEvent.clear(taxId);
    fireEvent.change(taxId, { target: { value: 'X'.repeat(65) } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await within(dialog).findByText('An exemption code is required for tax-exempt receipts.')).toBeInTheDocument();
    expect(within(dialog).getByText('Tax ID is limited to 64 characters.')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).not.toContain('PATCH /receipts/1');
  });

  it('suspends an exemption with tax_exempt=false while keeping the certificate', async () => {
    const fetchMock = backend({
      '/receipts': page([exempt]),
      'PATCH /receipts/3': (init: RequestInit | undefined) => {
        const body = JSON.parse(String(init?.body)) as { fiscalData: string };
        expect(JSON.parse(body.fiscalData)).toEqual({
          tax_id: 'J-12345678-9',
          exemption_code: 'EX-2026-001',
          tax_exempt: false,
          fiscal_number: 'F001-9',
        });
        return jsonResponse({ data: { ...exempt, fiscal_data: body.fiscalData } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INV-000003' }));
    const dialog = await screen.findByRole('dialog');
    const checkbox = within(dialog).getByRole('checkbox', { name: /tax exempt customer/i });
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/3'));
    await waitFor(() =>
      expect(within(screen.getByTestId('receipt-row-3')).queryByText('TAX EXEMPT')).not.toBeInTheDocument(),
    );
  });
});

describe('ReceiptsView — fiscal lock (Historia 11)', () => {
  it('hides edit and delete on locked receipts and shows the lock badge', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, receipt]) }));
    render(<ReceiptsView />);

    const locked = await screen.findByTestId('receipt-row-2');
    expect(within(locked).getByTestId('receipt-2-locked')).toHaveTextContent('Locked');
    expect(within(locked).queryByRole('button', { name: 'Edit INV-000002' })).not.toBeInTheDocument();
    expect(within(locked).queryByRole('button', { name: 'Deactivate INV-000002' })).not.toBeInTheDocument();
    expect(within(locked).queryByRole('button', { name: 'Lock INV-000002' })).not.toBeInTheDocument();

    const open = screen.getByTestId('receipt-row-1');
    expect(within(open).queryByTestId('receipt-1-locked')).not.toBeInTheDocument();
    expect(within(open).getByRole('button', { name: 'Edit INV-000001' })).toBeInTheDocument();
    expect(within(open).getByRole('button', { name: 'Deactivate INV-000001' })).toBeInTheDocument();
    expect(within(open).getByRole('button', { name: 'Lock INV-000001' })).toHaveAttribute(
      'title',
      expect.stringContaining('LOCK RECEIPT'),
    );
  });

  it('locks an active receipt with PATCH /receipts/:id/lock after confirming', async () => {
    let locked = false;
    const lockedInvoice = {
      ...invoice,
      is_locked: true,
      processed_by_user_id: 7,
      processed_by_role: 'merchant_admin',
    };
    const fetchMock = backend({
      '/receipts': () => jsonResponse(page([locked ? lockedInvoice : invoice])),
      'PATCH /receipts/1/lock': () => {
        locked = true;
        return jsonResponse({ data: lockedInvoice });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Lock INV-000001' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/is immutable/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'LOCK RECEIPT' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/1/lock'));
    expect(await screen.findByText('INV-000001 locked.')).toBeInTheDocument();
    const row = screen.getByTestId('receipt-row-1');
    await waitFor(() => expect(within(row).getByTestId('receipt-1-locked')).toBeInTheDocument());
    expect(within(row).queryByRole('button', { name: 'Edit INV-000001' })).not.toBeInTheDocument();
  });

  it('offers LOCK RECEIPT in the details drawer and shows who locked a receipt', async () => {
    const lockedByAdmin = { ...receipt, processed_by_user_id: 7, processed_by_role: 'merchant_admin' };
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, lockedByAdmin]) }));
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000001' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /LOCK RECEIPT/ }));
    // La confirmación se abre encima del detalle.
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close drawer' }));

    await userEvent.click(screen.getByRole('button', { name: 'View INV-000002' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('receipt-detail-locked')).toBeInTheDocument();
    expect(within(dialog).getByTestId('receipt-detail-locked-by')).toHaveTextContent('User #7 · merchant_admin');
    expect(within(dialog).queryByRole('button', { name: 'Edit Receipt' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('receipt-detail-immutable')).toHaveTextContent(/credit \/ debit notes/);
  });

  it('shows the exact 403 of the fiscal lock when the server rejects the change', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([invoice]),
        'PATCH /receipts/1/lock': () =>
          jsonResponse({ statusCode: 403, message: 'Receipt is fiscally locked and cannot be modified.' }, 403),
      }),
    );
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Lock INV-000001' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'LOCK RECEIPT' }));

    expect(await screen.findByText('Receipt is fiscally locked and cannot be modified.')).toBeInTheDocument();
  });
});

describe('ReceiptsView — activity log (Historia 6)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const activityLog = {
    receipt_id: 1,
    invoice_number: 'INV-000001',
    currency: 'USD',
    events: [
      {
        id: 11,
        action: 'CREATED',
        user_id: 7,
        user_name: 'ana',
        role: 'merchant_admin',
        previous_values: null,
        new_values: { subtotal: 0, total_tax: 0, total_discount: 0, grand_total: 0 },
        metadata: { source: 'manual' },
        created_at: '2026-11-01T10:00:00.120Z',
      },
      {
        id: 12,
        action: 'ITEM_MODIFIED',
        user_id: 7,
        user_name: 'ana',
        role: 'merchant_admin',
        previous_values: { subtotal: 0, total_tax: 0, total_discount: 0, grand_total: 0 },
        new_values: { subtotal: 100, total_tax: 0, total_discount: 5.5, grand_total: 94.5 },
        metadata: { operation: 'CREATED', name: 'Burger Combo' },
        created_at: '2026-11-01T10:05:00.000Z',
      },
      {
        id: 13,
        action: 'TAX_MODIFIED',
        user_id: 8,
        user_name: null,
        role: 'merchant_user',
        previous_values: { subtotal: 100, total_tax: 0, total_discount: 5.5, grand_total: 94.5 },
        new_values: { subtotal: 100, total_tax: 19, total_discount: 5.5, grand_total: 113.5 },
        metadata: { operation: 'CREATED', name: 'VAT', rate: 19 },
        created_at: '2026-11-01T10:06:00.000Z',
      },
      {
        id: 14,
        action: 'MODIFICATION_BLOCKED',
        user_id: 8,
        user_name: null,
        role: 'merchant_user',
        previous_values: { subtotal: 100, total_tax: 19, total_discount: 5.5, grand_total: 113.5 },
        new_values: { subtotal: 100, total_tax: 19, total_discount: 5.5, grand_total: 113.5 },
        metadata: { method: 'DELETE', path: '/api/receipts/1', reason: 'LOCKED' },
        created_at: '2026-11-01T10:06:00.000Z',
      },
    ],
  };

  it('VIEW ACTIVITY LOG opens a timeline with user, role, exact timestamp and totals before / after', async () => {
    const fetchMock = backend({
      '/receipts': page([invoice, receipt]),
      '/receipts/1/activity-log': { data: activityLog },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    const row = await screen.findByTestId('receipt-row-1');
    const action = within(row).getByRole('button', { name: 'View activity log for INV-000001' });
    expect(action).toHaveAttribute('title', 'VIEW ACTIVITY LOG');
    // También en recibos bloqueados: el audit trail es de solo lectura.
    expect(
      within(screen.getByTestId('receipt-row-2')).getByRole('button', { name: 'View activity log for INV-000002' }),
    ).toBeInTheDocument();

    await userEvent.click(action);
    const drawer = await screen.findByRole('dialog', { name: 'INV-000001' });
    expect(within(drawer).getByText('ACTIVITY LOG')).toBeInTheDocument();
    const timeline = await within(drawer).findByRole('list', { name: 'Activity timeline' });
    expect(calledRoutes(fetchMock)).toContain('GET /receipts/1/activity-log');

    // Orden cronológico exacto del servidor (created_at, id).
    const events = within(timeline).getAllByRole('listitem');
    expect(events.map((el) => el.getAttribute('data-testid'))).toEqual([
      'activity-event-11',
      'activity-event-12',
      'activity-event-13',
      'activity-event-14',
    ]);
    expect(within(drawer).getByTestId('activity-log-count')).toHaveTextContent('4 events');
    expect(within(drawer).getByTestId('activity-event-11-action')).toHaveTextContent('Created');
    expect(within(drawer).getByTestId('activity-event-11-user')).toHaveTextContent('ana (#7) · merchant_admin');
    expect(within(drawer).getByTestId('activity-event-13-user')).toHaveTextContent(/User #8 · merchant_user$/);
    expect(within(drawer).getByTestId('activity-event-13-user')).not.toHaveTextContent('(#8)');
    expect(within(drawer).getByTestId('activity-event-11-time')).toHaveAttribute(
      'dateTime',
      '2026-11-01T10:00:00.120Z',
    );
    expect(within(drawer).getByTestId('activity-event-11-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}\.120$/);

    // Totales antes / después del recálculo.
    const tax = within(drawer).getByTestId('activity-event-13-totals');
    expect(within(tax).getByTestId('activity-event-13-total_tax')).toHaveAttribute('data-changed', 'true');
    expect(within(tax).getByTestId('activity-event-13-total_tax')).toHaveTextContent('0.0019.00+19.00');
    expect(within(tax).getByTestId('activity-event-13-grand_total')).toHaveTextContent('94.50113.50+19.00');
    expect(within(tax).getByTestId('activity-event-13-subtotal')).toHaveAttribute('data-changed', 'false');
    expect(within(tax).queryByTestId('activity-event-13-total_discount')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('activity-event-12-total_discount')).toHaveTextContent('0.005.50+5.50');
    expect(within(drawer).getByText('Tax "VAT" (19%) added.')).toBeInTheDocument();
    expect(within(drawer).getByText('Blocked DELETE /api/receipts/1: the receipt is locked.')).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('button', { name: 'Close drawer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the activity log from the receipt details drawer', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([receipt]),
        '/receipts/2/activity-log': { data: { ...activityLog, receipt_id: 2, events: [] } },
      }),
    );
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000002' }));
    const details = await screen.findByRole('dialog');
    await userEvent.click(within(details).getByRole('button', { name: /VIEW ACTIVITY LOG/ }));

    const drawer = await screen.findByRole('dialog', { name: 'INV-000002' });
    expect(within(drawer).getByText('ACTIVITY LOG')).toBeInTheDocument();
    expect(await within(drawer).findByTestId('activity-log-empty')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('shows the load error and retries', async () => {
    let fail = true;
    const fetchMock = backend({
      '/receipts': page([invoice]),
      '/receipts/1/activity-log': () =>
        fail
          ? jsonResponse({ statusCode: 500, message: 'Activity log unavailable' }, 500)
          : jsonResponse({ data: activityLog }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View activity log for INV-000001' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Activity log unavailable');

    fail = false;
    await userEvent.click(within(drawer).getByRole('button', { name: 'Retry' }));
    expect(await within(drawer).findByRole('list', { name: 'Activity timeline' })).toBeInTheDocument();
  });
});

describe('ReceiptsView — adjustment notes (Historia 7)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // `receipt` (INV-000002) está bloqueado: grand_total 1,234.50 EUR.
  const summary = {
    receipt_id: 2,
    invoice_number: 'INV-000002',
    currency: 'EUR',
    is_locked: true,
    grand_total: 1234.5,
    credited_total: 234.5,
    debited_total: 0,
    net_total: 1000,
    available_credit: 1000,
    notes_count: 1,
  };
  const creditNote = {
    id: 5,
    receipt_id: 2,
    merchant_id: 1,
    note_type: 'CREDIT_NOTE',
    note_number: 'CN-000001',
    original_invoice_number: 'INV-000002',
    adjustment_amount: 234.5,
    signed_amount: -234.5,
    resulting_net_amount: 1000,
    currency: 'EUR',
    reason_code: 'PARTIAL_RETURN',
    processed_by_user_id: 7,
    processed_by_role: 'merchant_admin',
    created_at: '2026-11-02T10:00:00Z',
  };

  it('offers ISSUE ADJUSTMENT NOTE only on locked receipts', async () => {
    vi.stubGlobal('fetch', backend({ '/receipts': page([invoice, receipt]) }));
    render(<ReceiptsView />);

    const locked = await screen.findByTestId('receipt-row-2');
    expect(within(locked).getByRole('button', { name: 'Issue adjustment note for INV-000002' })).toHaveAttribute(
      'title',
      expect.stringContaining('ISSUE ADJUSTMENT NOTE'),
    );
    expect(
      within(screen.getByTestId('receipt-row-1')).queryByRole('button', { name: /Issue adjustment note/ }),
    ).not.toBeInTheDocument();
  });

  it('issues a credit note auto-linked to the receipt with type, amount and reason', async () => {
    let posted: unknown;
    const fetchMock = backend({
      '/receipts': page([receipt]),
      '/billing/receipts/2/adjustments': { data: { summary, notes: [creditNote] } },
      'POST /billing/receipts/2/adjustments': (init: RequestInit | undefined) => {
        posted = JSON.parse(String(init?.body));
        return jsonResponse(
          {
            data: {
              note: { ...creditNote, id: 6, note_number: 'CN-000002', adjustment_amount: 100, signed_amount: -100 },
              summary: { ...summary, credited_total: 334.5, net_total: 900, available_credit: 900 },
            },
          },
          201,
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Issue adjustment note for INV-000002' }));
    const drawer = await screen.findByRole('dialog', { name: 'Adjust INV-000002' });
    // Subtítulo del drawer + botón de envío.
    expect(within(drawer).getAllByText('ISSUE ADJUSTMENT NOTE')).toHaveLength(2);
    expect(within(drawer).getByTestId('adjustment-linked-receipt')).toHaveTextContent(/INV-000002\s*· Receipt #2/);
    // Resumen actual: crédito ya emitido y neto vigente.
    expect(await within(drawer).findByTestId('adjustment-current-net')).toHaveTextContent('1,000.00 EUR');
    expect(within(drawer).getByTestId('adjustment-available-credit')).toHaveTextContent('1,000.00 EUR');
    expect(within(drawer).getByRole('radio', { name: /Credit Note/ })).toBeChecked();

    // Validación local: el crédito acumulado no puede superar el grand_total.
    await userEvent.type(within(drawer).getByLabelText('Adjustment amount (EUR) *'), '1000.01');
    await userEvent.click(within(drawer).getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }));
    expect(within(drawer).getByText(/1,000.00 EUR still available/)).toBeInTheDocument();
    expect(within(drawer).getByText('Select a reason.')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).not.toContain('POST /billing/receipts/2/adjustments');

    // Al pasar a nota de débito el tope de crédito ya no aplica: el error desaparece
    await userEvent.click(within(drawer).getByRole('radio', { name: /Debit Note/ }));
    expect(within(drawer).queryByText(/still available/)).not.toBeInTheDocument();
    expect(within(drawer).getByLabelText('Adjustment amount (EUR) *')).not.toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(within(drawer).getByRole('radio', { name: /Credit Note/ }));

    const amount = within(drawer).getByLabelText('Adjustment amount (EUR) *');
    await userEvent.clear(amount);
    await userEvent.type(amount, '100');
    await userEvent.selectOptions(within(drawer).getByLabelText('Reason *'), 'REFUND');
    expect(within(drawer).queryByText('Select a reason.')).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('adjustment-projected-net')).toHaveTextContent('900.00 EUR');
    await userEvent.click(within(drawer).getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('POST /billing/receipts/2/adjustments'));
    expect(posted).toEqual({ noteType: 'CREDIT_NOTE', adjustmentAmount: 100, reasonCode: 'REFUND' });
    expect(await screen.findByText('Credit Note CN-000002 issued for INV-000002.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Adjust INV-000002' })).not.toBeInTheDocument();
  });

  it('issues a debit note and keeps the server error in the drawer', async () => {
    let posted: unknown;
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([receipt]),
        '/billing/receipts/2/adjustments': { data: { summary, notes: [creditNote] } },
        'POST /billing/receipts/2/adjustments': (init: RequestInit | undefined) => {
          posted = JSON.parse(String(init?.body));
          return jsonResponse({ statusCode: 400, message: 'adjustmentAmount cannot exceed the receipt grand_total' }, 400);
        },
      }),
    );
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Issue adjustment note for INV-000002' }));
    const drawer = await screen.findByRole('dialog', { name: 'Adjust INV-000002' });
    await within(drawer).findByTestId('adjustment-current-net');
    await userEvent.click(within(drawer).getByRole('radio', { name: /Debit Note/ }));
    expect(within(drawer).queryByTestId('adjustment-available-credit')).not.toBeInTheDocument();
    await userEvent.type(within(drawer).getByLabelText('Adjustment amount (EUR) *'), '12.25');
    await userEvent.selectOptions(within(drawer).getByLabelText('Reason *'), 'MISSED_CHARGE');
    expect(within(drawer).getByTestId('adjustment-projected-net')).toHaveTextContent('1,012.25 EUR');
    await userEvent.click(within(drawer).getByRole('button', { name: 'ISSUE ADJUSTMENT NOTE' }));

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'adjustmentAmount cannot exceed the receipt grand_total',
    );
    expect(posted).toEqual({ noteType: 'DEBIT_NOTE', adjustmentAmount: 12.25, reasonCode: 'MISSED_CHARGE' });
  });

  it('lists the notes with the adjusted net in the receipt details and issues from there', async () => {
    vi.stubGlobal(
      'fetch',
      backend({
        '/receipts': page([receipt]),
        '/billing/receipts/2/adjustments': { data: { summary, notes: [creditNote] } },
      }),
    );
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000002' }));
    const details = await screen.findByRole('dialog');
    const section = await within(details).findByTestId('receipt-detail-adjustments');
    expect(await within(section).findByTestId('receipt-adjustment-5')).toHaveTextContent('CN-000001');
    expect(within(section).getByTestId('receipt-adjustment-5')).toHaveTextContent('Partial return');
    expect(within(section).getByTestId('receipt-adjustment-5-amount')).toHaveTextContent('−234.50');
    expect(within(section).getByTestId('receipt-detail-adjusted-net')).toHaveTextContent('1,000.00 EUR');
    // El grand_total original del recibo no cambia.
    expect(within(section).getByText('1,234.50 EUR')).toBeInTheDocument();

    await userEvent.click(within(details).getByRole('button', { name: /ISSUE ADJUSTMENT NOTE/ }));
    expect(await screen.findByRole('dialog', { name: 'Adjust INV-000002' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('does not load adjustment notes for unlocked receipts', async () => {
    const fetchMock = backend({ '/receipts': page([invoice]) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    await userEvent.click(await screen.findByRole('button', { name: 'View INV-000001' }));
    const details = await screen.findByRole('dialog');
    expect(within(details).queryByTestId('receipt-detail-adjustments')).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: /ISSUE ADJUSTMENT NOTE/ })).not.toBeInTheDocument();
    expect(calledRoutes(fetchMock).some((route) => route.includes('/adjustments'))).toBe(false);
  });
});
