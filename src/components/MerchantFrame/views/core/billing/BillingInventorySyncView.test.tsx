import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingInventorySyncView } from './BillingInventorySyncView';
import { calledRoutes, fakeBackend } from '@/test/fetch';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  clearBillingInventoryContext,
  loadBillingInventoryContext,
  saveBillingInventoryContext,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

const GRID_ROW = {
  receiptItemId: 31,
  receiptId: 10,
  invoiceNumber: 'INV-000010',
  receiptType: 'INVOICE',
  receiptCreatedAt: '2026-11-20T15:00:00.000Z',
  orderId: 4,
  orderNumber: 'ORD-4',
  orderPaid: true,
  inventoryConsumedAt: '2026-11-20T15:01:00.000Z',
  sku: 'FRIES-L',
  itemName: 'Large fries',
  quantitySold: 1,
  mappingSource: 'VARIANT',
  productId: 7,
  productName: 'Fries',
  variantId: 2,
  variantName: 'Large',
  location: { id: 3, name: 'Main Kitchen', code: null },
  movements: [
    {
      id: 900,
      stockItemId: 6,
      quantity: 1,
      type: 'out_for_sale',
      reference: 'order:4',
      createdAt: '2026-11-20T15:01:00.000Z',
      locationId: 3,
      locationName: 'Main Kitchen',
    },
  ],
  components: [],
  deductionStatus: 'DEDUCTED',
  deducted: true,
  insufficientStock: false,
  commitFailed: false,
  statusReason: 'ok',
};

let fetchMock: ReturnType<typeof fakeBackend>;

beforeEach(() => {
  fetchMock = fakeBackend({
    '/billing/inventory-sync': { data: [GRID_ROW], page: 1, limit: 10, total: 1, totalPages: 1 },
    '/billing/inventory-sync/metrics': {
      data: {
        dateFrom: '2026-11-16',
        dateTo: '2026-11-22',
        generatedAt: '2026-11-22T14:00:00.000Z',
        salesLocation: { id: 3, name: 'Main Kitchen', code: null },
        linesEvaluated: 1,
        scanLimitReached: false,
        itemsDeducted: 1,
        unitsDeducted: 1,
        statusCounts: { DEDUCTED: 1, PENDING: 0, INSUFFICIENT_STOCK: 0, FAILED: 0, NOT_TRACKED: 0 },
        lowStock: { total: 0, outOfStock: 0, low: 0, activeAlerts: 0, warnings: [] },
      },
    },
    'POST /billing/inventory-sync/validate-stock': {
      data: {
        source: 'RECEIPT',
        receiptId: 10,
        invoiceNumber: 'INV-000010',
        orderId: 4,
        location: { id: 3, name: 'Main Kitchen', code: null },
        allAvailable: true,
        summary: {
          lines: 0,
          available: 0,
          lowStockAfterSale: 0,
          insufficientStock: 0,
          notTracked: 0,
          alreadyDeducted: 0,
          locationNotConfigured: 0,
        },
        items: [],
        checkedAt: '2026-11-22T14:01:00.000Z',
      },
    },
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearBillingInventoryContext();
  window.history.pushState({}, '', '/');
});

describe('BillingInventorySyncView', () => {
  it('restores the billing context saved on a previous visit', async () => {
    saveBillingInventoryContext({
      filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS, invoiceNumber: 'INV-000010', page: 2 },
      selection: {
        receiptItemId: 31,
        receiptId: 10,
        invoiceNumber: 'INV-000010',
        sku: 'FRIES-L',
        orderId: 4,
        stockItemId: 6,
      },
    });

    render(<BillingInventorySyncView />);

    expect(screen.getByLabelText('Filter by invoice number')).toHaveValue('INV-000010');
    expect(await screen.findByTestId('inventory-sync-row-31')).toHaveAttribute('aria-selected', 'true');
    expect(loadBillingInventoryContext()?.filters.page).toBe(2);
    const gridCall = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('/billing/inventory-sync?'));
    expect(gridCall).toContain('invoiceNumber=INV-000010');
  });

  it('saves the selected grid line as the billing context', async () => {
    const user = userEvent.setup();
    render(<BillingInventorySyncView />);

    await user.click(await screen.findByTestId('inventory-sync-row-31'));
    expect(loadBillingInventoryContext()?.selection).toMatchObject({ receiptItemId: 31, stockItemId: 6 });
  });

  it('has no Quick Launch panel: the NavHubBar is the only shortcut bar', async () => {
    render(<BillingInventorySyncView />);
    await screen.findByTestId('inventory-sync-row-31');
    expect(screen.queryByTestId('billing-inventory-quick-launch')).toBeNull();
    expect(screen.queryByText(/quick launch/i)).toBeNull();
  });

  it('takes the invoice filter from its own URL', async () => {
    window.history.pushState({}, '', '/billing/inventory-sync?invoice=INV-000077');
    render(<BillingInventorySyncView />);
    expect(loadBillingInventoryContext()?.filters.invoiceNumber).toBe('INV-000077');
    expect(screen.getByLabelText('Filter by invoice number')).toHaveValue('INV-000077');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('shows the live header and reloads the grid after validating stock', async () => {
    const user = userEvent.setup();
    render(<BillingInventorySyncView />);

    expect(screen.getByRole('heading', { name: 'INVENTORY & BILLING STOCK SYNC' })).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-items-deducted-value')).toHaveTextContent('1');
    await user.click(await screen.findByTestId('inventory-sync-row-31'));
    const gridCalls = () => calledRoutes(fetchMock).filter((route) => route === 'GET /billing/inventory-sync').length;
    const before = gridCalls();

    await user.click(screen.getByRole('button', { name: /VALIDATE STOCK AVAILABILITY/ }));
    await user.click(screen.getByRole('button', { name: 'Run Validation' }));

    expect(await screen.findByTestId('stock-validation-summary')).toHaveTextContent('Stock available for every line');
    await vi.waitFor(() => expect(gridCalls()).toBe(before + 1));
  });
});
