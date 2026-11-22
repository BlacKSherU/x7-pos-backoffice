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

function setup(routes: Record<string, unknown> = {}) {
  fetchMock = fakeBackend({
    '/receipt-items': page([burger, fries]),
    '/receipts': page(receipts),
    ...routes,
  });
  vi.stubGlobal('fetch', fetchMock);
  return userEvent.setup();
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
