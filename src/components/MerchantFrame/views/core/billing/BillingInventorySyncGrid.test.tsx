import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingInventorySyncGrid } from './BillingInventorySyncGrid';
import { fakeBackend, jsonResponse } from '@/test/fetch';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  type BillingInventoryFilters,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';
import type {
  InventoryDeductionStatus,
  InventorySyncRow,
} from '@/modules/core/billing-transactions/types/inventory-sync';

const row = (
  receiptItemId: number,
  status: InventoryDeductionStatus,
  overrides: Partial<InventorySyncRow> = {},
): InventorySyncRow => ({
  receiptItemId,
  receiptId: 10,
  invoiceNumber: 'INV-000010',
  receiptType: 'INVOICE',
  receiptCreatedAt: '2026-11-20T15:00:00.000Z',
  orderId: 4,
  orderNumber: 'ORD-4',
  orderPaid: status !== 'PENDING',
  inventoryConsumedAt: status === 'DEDUCTED' || status === 'INSUFFICIENT_STOCK' ? '2026-11-20T15:01:00.000Z' : null,
  sku: `SKU-${receiptItemId}`,
  itemName: `Item ${receiptItemId}`,
  quantitySold: 2,
  mappingSource: 'PRODUCT',
  productId: 7,
  productName: 'Burger',
  variantId: null,
  variantName: null,
  location: { id: 3, name: 'Main Kitchen', code: 'MK' },
  movements: [],
  components: [],
  deductionStatus: status,
  deducted: status === 'DEDUCTED' || status === 'INSUFFICIENT_STOCK',
  insufficientStock: status === 'INSUFFICIENT_STOCK',
  commitFailed: status === 'FAILED',
  statusReason: `reason ${status}`,
  ...overrides,
});

const ROWS: InventorySyncRow[] = [
  row(1, 'DEDUCTED', {
    movements: [
      {
        id: 501,
        stockItemId: 6,
        quantity: 4,
        type: 'out_for_sale',
        reference: 'order:4',
        createdAt: '2026-11-20T15:01:00.000Z',
        locationId: 3,
        locationName: 'Main Kitchen',
      },
    ],
    components: [
      {
        key: 'supply:9',
        kind: 'RAW_MATERIAL',
        name: 'Beef patty',
        sku: 'BEEF-01',
        requiredQty: 4,
        deductedQty: 4,
        movementIds: [501],
        stockItemId: 6,
        currentQty: 12,
        minimumQty: 5,
        locationId: 3,
        locationName: 'Main Kitchen',
        shortfall: 0,
        insufficient: false,
      },
    ],
  }),
  row(2, 'PENDING'),
  row(3, 'INSUFFICIENT_STOCK'),
  row(4, 'FAILED'),
  row(5, 'NOT_TRACKED', { sku: null, mappingSource: null, productName: null, location: null }),
];

const page = (data: InventorySyncRow[], total = data.length) => ({
  statusCode: 200,
  message: 'ok',
  data,
  page: 1,
  limit: 10,
  total,
  totalPages: Math.ceil(total / 10),
  hasNext: total > 10,
  hasPrev: false,
});

function Harness({
  initial = DEFAULT_BILLING_INVENTORY_FILTERS,
  onSelectRow = vi.fn(),
  selectedReceiptItemId = null,
}: {
  initial?: BillingInventoryFilters;
  onSelectRow?: (row: InventorySyncRow) => void;
  selectedReceiptItemId?: number | null;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <BillingInventorySyncGrid
      filters={filters}
      onFiltersChange={setFilters}
      onSelectRow={onSelectRow}
      selectedReceiptItemId={selectedReceiptItemId}
    />
  );
}

const lastQuery = (fetchMock: ReturnType<typeof fakeBackend>): URLSearchParams => {
  const url = String(fetchMock.mock.calls.at(-1)?.[0] ?? '');
  return new URLSearchParams(url.split('?')[1] ?? '');
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BillingInventorySyncGrid', () => {
  it('renders each receipt line SKU mapping with its stock movement and a status badge', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync': page(ROWS) }));

    render(<Harness />);

    const deducted = await screen.findByTestId('inventory-sync-row-1');
    expect(within(deducted).getByText('SKU-1')).toBeInTheDocument();
    expect(within(deducted).getByText('Product SKU')).toBeInTheDocument();
    expect(within(deducted).getByText(/Burger/)).toBeInTheDocument();
    expect(within(deducted).getByText('Main Kitchen')).toBeInTheDocument();
    expect(within(deducted).getByText(/#501 · out_for_sale · −4/)).toBeInTheDocument();
    expect(within(deducted).getByTestId('deduction-status-DEDUCTED')).toHaveTextContent('Deducted');

    expect(screen.getByTestId('deduction-status-PENDING')).toHaveTextContent('Pending');
    expect(screen.getByTestId('deduction-status-INSUFFICIENT_STOCK')).toHaveTextContent('Insufficient Stock');
    expect(screen.getByTestId('deduction-status-FAILED')).toHaveTextContent('Commit Failed');
    expect(screen.getByTestId('deduction-status-NOT_TRACKED')).toHaveTextContent('Not Tracked');

    const unmapped = screen.getByTestId('inventory-sync-row-5');
    expect(within(unmapped).getByText('No SKU')).toBeInTheDocument();
    expect(within(unmapped).getByText('Unmapped')).toBeInTheDocument();
  });

  it('highlights insufficient stock and failed inventory commits', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync': page(ROWS) }));

    render(<Harness />);

    const insufficient = await screen.findByTestId('inventory-sync-row-3');
    expect(insufficient).toHaveAttribute('data-highlight', 'insufficient');
    expect(insufficient.className).toContain('border-l-[#ae001a]');
    expect(within(insufficient).getByText('Insufficient stock')).toBeInTheDocument();

    const failed = screen.getByTestId('inventory-sync-row-4');
    expect(failed).toHaveAttribute('data-highlight', 'failed');
    expect(failed.className).toContain('border-l-amber-500');
    expect(within(failed).getByText('Inventory commit failed')).toBeInTheDocument();

    expect(screen.getByTestId('inventory-sync-row-1')).toHaveAttribute('data-highlight', 'none');
  });

  it('expands a line to show its recipe components and status reason', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync': page(ROWS) }));
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: 'Show stock components of line 1' }));
    const details = screen.getByTestId('inventory-sync-details-1');
    expect(within(details).getByText('reason DEDUCTED')).toBeInTheDocument();
    expect(within(details).getByText('Beef patty')).toBeInTheDocument();
    expect(within(details).getByText('(BEEF-01)')).toBeInTheDocument();
    expect(within(details).getByText('#501')).toBeInTheDocument();
  });

  it('sends the status and date filters to the API and resets to page 1', async () => {
    const fetchMock = fakeBackend({ '/billing/inventory-sync': page(ROWS) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<Harness initial={{ ...DEFAULT_BILLING_INVENTORY_FILTERS, page: 3 }} />);
    await screen.findByTestId('inventory-sync-row-1');
    expect(lastQuery(fetchMock).get('page')).toBe('3');

    await user.selectOptions(screen.getByLabelText('Filter by deduction status'), 'FAILED');
    await vi.waitFor(() => expect(lastQuery(fetchMock).get('status')).toBe('FAILED'));
    expect(lastQuery(fetchMock).get('page')).toBe('1');

    await user.type(screen.getByLabelText('Receipts from date'), '2026-11-01');
    await vi.waitFor(() => expect(lastQuery(fetchMock).get('dateFrom')).toBe('2026-11-01'));
  });

  it('debounces the invoice number search', async () => {
    const fetchMock = fakeBackend({ '/billing/inventory-sync': page(ROWS) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<Harness />);
    await screen.findByTestId('inventory-sync-row-1');
    const callsBefore = fetchMock.mock.calls.length;

    await user.type(screen.getByLabelText('Filter by invoice number'), 'INV-9');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    await vi.waitFor(() => expect(lastQuery(fetchMock).get('invoiceNumber')).toBe('INV-9'), { timeout: 2000 });
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it('selects a line on click', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync': page(ROWS) }));
    const onSelectRow = vi.fn();
    const user = userEvent.setup();

    render(<Harness onSelectRow={onSelectRow} selectedReceiptItemId={2} />);

    await user.click(await screen.findByTestId('inventory-sync-row-3'));
    expect(onSelectRow).toHaveBeenCalledWith(expect.objectContaining({ receiptItemId: 3 }));
    expect(screen.getByTestId('inventory-sync-row-2')).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the empty state and the API error with retry', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        '/billing/inventory-sync': () =>
          fail ? jsonResponse({ message: 'Database unavailable' }, 500) : jsonResponse(page([])),
      }),
    );
    const user = userEvent.setup();

    render(<Harness />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No receipt lines have been billed yet.')).toBeInTheDocument();
  });
});
