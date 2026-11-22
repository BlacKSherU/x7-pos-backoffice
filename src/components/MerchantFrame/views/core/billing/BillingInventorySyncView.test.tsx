import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingInventorySyncView } from './BillingInventorySyncView';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  clearBillingInventoryContext,
  loadBillingInventoryContext,
  saveBillingInventoryContext,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

afterEach(() => {
  cleanup();
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
  });

  it('takes the invoice filter from its own URL', () => {
    window.history.pushState({}, '', '/billing/inventory-sync?invoice=INV-000077');
    render(<BillingInventorySyncView />);
    expect(screen.getByText(/Invoice INV-000077/)).toBeInTheDocument();
    expect(loadBillingInventoryContext()?.filters.invoiceNumber).toBe('INV-000077');
  });
});
