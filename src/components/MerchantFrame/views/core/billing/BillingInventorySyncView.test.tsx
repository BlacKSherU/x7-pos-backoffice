import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingInventorySyncView } from './BillingInventorySyncView';
import { fakeBackend } from '@/test/fetch';
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
  it('restores the billing context saved before jumping to inventory', async () => {
    saveBillingInventoryContext(
      {
        filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS, invoiceNumber: 'INV-000010', page: 2 },
        selection: {
          receiptItemId: 31,
          receiptId: 10,
          invoiceNumber: 'INV-000010',
          sku: 'FRIES-L',
          orderId: 4,
          stockItemId: 6,
        },
      },
      'audit-movements',
    );
    const user = userEvent.setup();
    const navigateToPath = vi.fn();

    render(<BillingInventorySyncView navigateToPath={navigateToPath} />);

    expect(screen.getByText(/Invoice INV-000010 · SKU FRIES-L/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /audit warehouse movements/i }));
    expect(navigateToPath).toHaveBeenCalledWith(expect.stringContaining('/inventory/movements?'));
    expect(navigateToPath.mock.calls[0][0]).toContain('itemId=6');
    expect(loadBillingInventoryContext()?.filters.page).toBe(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('invoiceNumber=INV-000010');
  });

  it('selecting a grid line becomes the context the Quick Launch carries to inventory', async () => {
    const user = userEvent.setup();
    const navigateToPath = vi.fn();

    render(<BillingInventorySyncView navigateToPath={navigateToPath} />);

    await user.click(await screen.findByTestId('inventory-sync-row-31'));
    expect(screen.getByText(/Invoice INV-000010 · SKU FRIES-L/)).toBeInTheDocument();
    expect(loadBillingInventoryContext()?.selection).toMatchObject({ receiptItemId: 31, stockItemId: 6 });

    await user.click(screen.getByRole('button', { name: /reconcile inventory/i }));
    expect(navigateToPath.mock.calls[0][0]).toContain('/inventory/stock-movements?');
    expect(navigateToPath.mock.calls[0][0]).toContain('itemId=6');
  });

  it('takes the invoice filter from its own URL', async () => {
    window.history.pushState({}, '', '/billing/inventory-sync?invoice=INV-000077');
    render(<BillingInventorySyncView />);
    expect(screen.getByText(/Invoice INV-000077/)).toBeInTheDocument();
    expect(loadBillingInventoryContext()?.filters.invoiceNumber).toBe('INV-000077');
    expect(screen.getByLabelText('Filter by invoice number')).toHaveValue('INV-000077');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
