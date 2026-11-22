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

/** Backend falso con el resumen de KPIs ya registrado. */
function backend(routes: Parameters<typeof fakeBackend>[0]) {
  return fakeBackend({ '/receipts/summary': { data: emptySummary }, ...routes });
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
