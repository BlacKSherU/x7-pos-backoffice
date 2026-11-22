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
function backend(routes: Parameters<typeof fakeBackend>[0]) {
  return fakeBackend({
    '/receipts/summary': { data: emptySummary },
    '/receipts/tax-breakdown': { data: taxBreakdown },
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
    const currencyInput = within(dialog).getByLabelText('Currency *');
    await userEvent.clear(currencyInput);
    await userEvent.type(currencyInput, 'pen');
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
        expect(JSON.parse(String(init?.body))).toEqual({ orderId: 555, type: 'INVOICE', currency: 'USD' });
        return jsonResponse({ data: { ...invoice, id: 9, order_id: 555, invoice_number: 'INV-000009' } }, 201);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);
    await screen.findByTestId('receipt-row-1');

    await userEvent.click(screen.getByRole('button', { name: 'New Receipt' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Order ID *'), '555');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type *'), 'INVOICE');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Receipt' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('POST /receipts'));
    expect(await screen.findByText('INV-000009 created.')).toBeInTheDocument();
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

  it('reactivates an inactive receipt with PATCH /status isActive=true', async () => {
    const inactive = { ...invoice, is_active: false };
    const fetchMock = backend({
      '/receipts': page([inactive]),
      'PATCH /receipts/1/status': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ isActive: true });
        return jsonResponse({ data: invoice });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceiptsView />);

    const row = await screen.findByTestId('receipt-row-1');
    expect(within(row).getByText('Inactive')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Edit INV-000001' })).toBeDisabled();
    await userEvent.click(within(row).getByRole('button', { name: 'Reactivate INV-000001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipts/1/status'));
    expect(await screen.findByText('INV-000001 reactivated.')).toBeInTheDocument();
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
