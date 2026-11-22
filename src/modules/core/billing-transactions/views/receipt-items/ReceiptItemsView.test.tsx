import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptItemsView } from './ReceiptItemsView';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';

vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>()),
  getAccessToken: vi.fn(() => 'mock-token'),
  redirectToLogin: vi.fn(),
}));

const burger = {
  id: 1,
  receipt_id: 10,
  receipt_invoice_number: 'INV-000010',
  currency: 'USD',
  name: 'Burger Combo',
  sku: 'SKU-001',
  quantity: '2.00', // decimal columns may arrive as strings
  unit_price: '12.50',
  subtotal: '25.00',
  discount_amount: '2.50',
  total: '22.50',
  metadata: null,
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

const fries = {
  ...burger,
  id: 2,
  name: 'Fries',
  sku: null,
  quantity: 1.25,
  unit_price: 3.33,
  subtotal: 4.16,
  discount_amount: 0,
  total: 4.16,
};

const receipts = [
  { id: 10, order_id: 200, type: 'invoice', grand_total: 26.66, currency: 'USD', invoice_number: 'INV-000010' },
  { id: 11, order_id: 201, type: 'receipt', grand_total: 0, currency: 'USD' },
];

const page = (data: unknown[]) => ({
  statusCode: 200,
  message: 'ok',
  data,
  page: 1,
  limit: 20,
  total: data.length,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

let fetchMock: ReturnType<typeof fakeBackend>;

const itemOptions = [
  { name: 'Burger Combo', sku: 'SKU-001', line_count: 3 },
  { name: 'Fries', sku: null, line_count: 1 },
];

function setup(routes: Record<string, unknown> = {}) {
  fetchMock = fakeBackend({
    '/receipt-items': page([burger, fries]),
    '/receipt-items/item-options': { statusCode: 200, data: itemOptions },
    '/receipts': page(receipts),
    ...routes,
  });
  vi.stubGlobal('fetch', fetchMock);
  return userEvent.setup();
}

/** Query params of the last GET /receipt-items (grid) request. */
function lastItemsQuery(): URLSearchParams {
  const calls = fetchMock.mock.calls
    .map(([input, init]) => ({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() }))
    .filter((c) => c.method === 'GET' && c.url.replace(/^\/api/, '').split('?')[0] === '/receipt-items');
  const last = calls[calls.length - 1];
  return new URLSearchParams(last?.url.split('?')[1] ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReceiptItemsView — grid (Historia 20)', () => {
  it('shows quantity and unit price with proper precision and monetary amounts with 2 decimals + currency', async () => {
    setup();
    render(<ReceiptItemsView />);

    const row = await screen.findByTestId('receipt-item-row-1');
    expect(within(row).getByText('Burger Combo')).toBeInTheDocument();
    expect(within(row).getByText('SKU-001')).toBeInTheDocument();
    expect(within(row).getByText('INV-000010')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-item-qty-1')).toHaveTextContent('2.00');
    expect(screen.getByTestId('receipt-item-unit-price-1')).toHaveTextContent('12.50 USD');
    expect(within(row).getByText('25.00 USD')).toBeInTheDocument();
    expect(within(row).getByText('− 2.50 USD')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-item-total-1')).toHaveTextContent('22.50 USD');

    expect(screen.getByTestId('receipt-item-qty-2')).toHaveTextContent('1.25');
    expect(screen.getByTestId('receipt-item-unit-price-2')).toHaveTextContent('3.33 USD');
    expect(screen.getByTestId('receipt-item-total-2')).toHaveTextContent('4.16 USD');
  });

  it('shows an empty state when there are no lines', async () => {
    setup({ '/receipt-items': page([]) });
    render(<ReceiptItemsView />);
    expect(await screen.findByTestId('receipt-items-empty')).toBeInTheDocument();
  });

  it('shows the API error with a retry button', async () => {
    setup({ '/receipt-items': () => jsonResponse({ message: 'Boom' }, 500) });
    render(<ReceiptItemsView />);
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('ReceiptItemsView — drawer (Historia 20)', () => {
  it('calculates subtotal and total live when quantity or unit price change', async () => {
    const user = setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.click(screen.getByRole('button', { name: /add line item/i }));
    const dialog = await screen.findByRole('dialog');

    const quantity = within(dialog).getByLabelText('Quantity');
    const unitPrice = within(dialog).getByLabelText(/unit price/i);
    const discount = within(dialog).getByLabelText(/discount/i);

    await user.clear(quantity);
    await user.type(quantity, '3');
    await user.type(unitPrice, '0.1');
    expect(within(dialog).getByTestId('receipt-item-live-subtotal')).toHaveTextContent('0.30 USD');
    expect(within(dialog).getByTestId('receipt-item-live-total')).toHaveTextContent('0.30 USD');

    await user.clear(quantity);
    await user.type(quantity, '1.25');
    await user.clear(unitPrice);
    await user.type(unitPrice, '3.33');
    expect(within(dialog).getByTestId('receipt-item-live-subtotal')).toHaveTextContent('4.16 USD');

    await user.clear(discount);
    await user.type(discount, '0.16');
    expect(within(dialog).getByTestId('receipt-item-live-total')).toHaveTextContent('4.00 USD');

    await user.clear(discount);
    await user.type(discount, '9');
    expect(within(dialog).getByTestId('receipt-item-live-total')).toHaveTextContent('—');
    expect(within(dialog).getByText(/cannot be greater than the subtotal/i)).toBeInTheDocument();
  });

  it('creates a line via POST /receipt-items and reloads the grid', async () => {
    const user = setup({
      'POST /receipt-items': () => jsonResponse({ statusCode: 201, data: { ...burger, id: 3, name: 'Soda' } }, 201),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.click(screen.getByRole('button', { name: /add line item/i }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Receipt / Invoice')).not.toBeDisabled(),
    );
    await user.selectOptions(within(dialog).getByLabelText('Receipt / Invoice'), '11');
    await user.type(within(dialog).getByLabelText('Description'), 'Soda');
    await user.type(within(dialog).getByLabelText('SKU'), 'SKU-SODA');
    await user.clear(within(dialog).getByLabelText('Quantity'));
    await user.type(within(dialog).getByLabelText('Quantity'), '2');
    await user.type(within(dialog).getByLabelText(/unit price/i), '1.75');
    await user.click(within(dialog).getByRole('button', { name: /add line item/i }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('POST /receipt-items'));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      receiptId: 11,
      name: 'Soda',
      sku: 'SKU-SODA',
      quantity: 2,
      unitPrice: 1.75,
      discountAmount: 0,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // initial load + reload after the mutation
    expect(calledRoutes(fetchMock).filter((r) => r === 'GET /receipt-items').length).toBeGreaterThanOrEqual(2);
  });

  it('does not submit an invalid form', async () => {
    const user = setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.click(screen.getByRole('button', { name: /add line item/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add line item/i }));

    expect(within(dialog).getByText('Description is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Select the receipt this line belongs to.')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).not.toContain('POST /receipt-items');
  });

  it('edits a line via PATCH with the recalculated amounts', async () => {
    const user = setup({
      'PATCH /receipt-items/1': () => jsonResponse({ statusCode: 200, data: { ...burger, quantity: 3 } }),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.click(screen.getByRole('button', { name: 'Edit Burger Combo' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Receipt / Invoice')).toBeDisabled();
    expect(within(dialog).getByTestId('receipt-item-live-total')).toHaveTextContent('22.50 USD');

    await user.clear(within(dialog).getByLabelText('Quantity'));
    await user.type(within(dialog).getByLabelText('Quantity'), '3');
    expect(within(dialog).getByTestId('receipt-item-live-subtotal')).toHaveTextContent('37.50 USD');
    expect(within(dialog).getByTestId('receipt-item-live-total')).toHaveTextContent('35.00 USD');

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipt-items/1'));
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      name: 'Burger Combo',
      sku: 'SKU-001',
      quantity: 3,
      unitPrice: 12.5,
      discountAmount: 2.5,
    });
  });

  it('logical deletion sends DELETE after confirmation and reloads the grid', async () => {
    const user = setup({
      'DELETE /receipt-items/1': () => jsonResponse({ statusCode: 200, data: { ...burger, is_active: false } }),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');
    const initialLoads = calledRoutes(fetchMock).filter((r) => r === 'GET /receipt-items').length;

    await user.click(screen.getByRole('button', { name: 'Delete Burger Combo' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/receipt totals are recalculated/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete line' }));

    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('DELETE /receipt-items/1'));
    await waitFor(() =>
      expect(calledRoutes(fetchMock).filter((r) => r === 'GET /receipt-items').length).toBeGreaterThan(initialLoads),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/deleted\. receipt totals recalculated/i);
  });
});

describe('ReceiptItemsView — header INVOICE LINE ITEMS + filters (Historia 16)', () => {
  it('renders the title, the explanatory subtitle and help text with the system typography', async () => {
    setup();
    render(<ReceiptItemsView />);

    const heading = await screen.findByRole('heading', { level: 2, name: 'INVOICE LINE ITEMS' });
    expect(heading).toHaveClass('font-poppins', 'uppercase', 'text-[#ae001a]');
    const subtitle = screen.getByTestId('receipt-items-header-subtitle');
    expect(subtitle).toHaveTextContent(/examine product costs, verify unit rates/i);
    expect(subtitle).toHaveClass('font-poppins', 'text-body-sm');
    expect(screen.getByTestId('receipt-items-header-help')).toHaveTextContent(
      'Subtotal = quantity × unit price (rounded to 2 decimals) · Total = subtotal − discount.',
    );
    expect(screen.getByTestId('receipt-items-header-help')).toHaveClass('font-poppins');
  });

  it('lays the controls out in one horizontal, wrapping bar above the grid (no overlap)', async () => {
    setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    const bar = screen.getByRole('search', { name: 'Filter receipt line items' });
    expect(bar).toHaveClass('flex', 'flex-wrap', 'items-center');
    expect(bar).not.toHaveClass('absolute');
    expect(within(bar).getByLabelText('Search by description or SKU')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Filter by item')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Filter by invoice or receipt')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Filter by status')).toBeInTheDocument();

    // Header comes before the grid in the normal document flow.
    const grid = screen.getByRole('region', { name: 'Receipt line items' });
    expect(bar.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('populates the item and receipt selectors from the API', async () => {
    setup();
    render(<ReceiptItemsView />);

    const itemSelect = screen.getByLabelText('Filter by item');
    await waitFor(() => expect(within(itemSelect).getByText('Burger Combo · SKU-001 (3)')).toBeInTheDocument());
    expect(within(itemSelect).getByText('Fries (1)')).toBeInTheDocument();
    const receiptSelect = screen.getByLabelText('Filter by invoice or receipt');
    await waitFor(() =>
      expect(within(receiptSelect).getByText('INV-000010 · invoice · 26.66 USD')).toBeInTheDocument(),
    );
    expect(within(receiptSelect).getByText('Receipt #11 · receipt · 0.00 USD')).toBeInTheDocument();
  });

  it('searches by description/SKU (debounced) through the API', async () => {
    const user = setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.type(screen.getByLabelText('Search by description or SKU'), 'sku-00');
    await waitFor(() => expect(lastItemsQuery().get('search')).toBe('sku-00'));
    expect(lastItemsQuery().get('page')).toBe('1');
  });

  it('filters by item (SKU or exact name), by receipt and by status', async () => {
    const user = setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');
    await waitFor(() =>
      expect(within(screen.getByLabelText('Filter by item')).getByText('Fries (1)')).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText('Filter by item'), 'sku:SKU-001');
    await waitFor(() => expect(lastItemsQuery().get('sku')).toBe('SKU-001'));

    await user.selectOptions(screen.getByLabelText('Filter by item'), 'name:Fries');
    await waitFor(() => expect(lastItemsQuery().get('itemName')).toBe('Fries'));
    expect(lastItemsQuery().get('sku')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Filter by invoice or receipt'), '10');
    await waitFor(() => expect(lastItemsQuery().get('receiptId')).toBe('10'));

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all');
    await waitFor(() => expect(lastItemsQuery().get('isActive')).toBe('all'));

    await user.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => {
      const q = lastItemsQuery();
      expect(q.get('isActive')).toBe('true');
      expect(q.get('receiptId')).toBeNull();
      expect(q.get('itemName')).toBeNull();
    });
  });

  it('pre-selects the filtered receipt when adding a line', async () => {
    const user = setup();
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Filter by invoice or receipt')).getByText(/INV-000010/),
      ).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText('Filter by invoice or receipt'), '10');
    await user.click(screen.getByRole('button', { name: /add line item/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Receipt / Invoice')).toHaveValue('10');
  });

  it('lists deleted lines with the status filter and restores them (PATCH isActive=true)', async () => {
    const user = setup({
      '/receipt-items': (_init: RequestInit | undefined, url: string) =>
        jsonResponse(page(url.includes('isActive=false') ? [{ ...burger, is_active: false }] : [fries])),
      'PATCH /receipt-items/1': () => jsonResponse({ statusCode: 200, data: { ...burger, is_active: true } }),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-2');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'false');
    const row = await screen.findByTestId('receipt-item-row-1');
    expect(within(row).getByText('Deleted')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit Burger Combo' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Restore Burger Combo' }));
    await waitFor(() => expect(calledRoutes(fetchMock)).toContain('PATCH /receipt-items/1'));
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ isActive: true });
    expect(await screen.findByRole('status')).toHaveTextContent(/restored\. receipt totals recalculated/i);
  });

  it('shows a filtered empty state with a clear-filters action', async () => {
    const user = setup({
      '/receipt-items': (_init: RequestInit | undefined, url: string) =>
        jsonResponse(page(url.includes('search=') ? [] : [burger])),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.type(screen.getByLabelText('Search by description or SKU'), 'zzz');
    expect(await screen.findByTestId('receipt-items-filtered-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByTestId('receipt-item-row-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Search by description or SKU')).toHaveValue('');
  });
});

describe('ReceiptItemsView — fiscal lock (Historia 11)', () => {
  const lockedLine = { ...burger, id: 3, name: 'Locked Combo', receipt_id: 12, receipt_invoice_number: 'INV-000012', receipt_is_locked: true };

  it('hides edit and delete on lines of a locked receipt and shows the lock badge', async () => {
    setup({ '/receipt-items': page([burger, lockedLine]) });
    render(<ReceiptItemsView />);

    const lockedRow = await screen.findByTestId('receipt-item-row-3');
    expect(within(lockedRow).getByTestId('receipt-item-locked-3')).toHaveTextContent('Locked');
    expect(within(lockedRow).getByRole('img', { name: 'Locked receipt' })).toBeInTheDocument();
    expect(within(lockedRow).queryByRole('button', { name: 'Edit Locked Combo' })).not.toBeInTheDocument();
    expect(within(lockedRow).queryByRole('button', { name: 'Delete Locked Combo' })).not.toBeInTheDocument();

    const openRow = screen.getByTestId('receipt-item-row-1');
    expect(within(openRow).getByRole('button', { name: 'Edit Burger Combo' })).toBeInTheDocument();
    expect(within(openRow).getByRole('button', { name: 'Delete Burger Combo' })).toBeInTheDocument();
  });

  it('does not let new lines target a locked receipt', async () => {
    const user = setup({
      '/receipts': page([
        ...receipts,
        { id: 12, order_id: 202, type: 'invoice', grand_total: 10, currency: 'USD', invoice_number: 'INV-000012', is_locked: true },
      ]),
    });
    render(<ReceiptItemsView />);
    await screen.findByTestId('receipt-item-row-1');

    await user.click(screen.getByRole('button', { name: /add line item/i }));
    const dialog = await screen.findByRole('dialog');
    const lockedOption = await within(dialog).findByRole('option', { name: /INV-000012.*locked/ });
    expect(lockedOption).toBeDisabled();
    expect(within(dialog).getByRole('option', { name: /INV-000010/ })).toBeEnabled();
  });
});

