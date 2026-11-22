import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingInventoryQuickLaunch } from './BillingInventoryQuickLaunch';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  clearBillingInventoryContext,
  loadBillingInventoryContext,
  type BillingInventoryContextInput,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

const context: BillingInventoryContextInput = {
  filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS, status: 'INSUFFICIENT_STOCK', page: 2 },
  selection: {
    receiptItemId: 5,
    receiptId: 3,
    invoiceNumber: 'INV-000003',
    sku: 'COLA-355',
    orderId: 8,
    stockItemId: 14,
  },
};

afterEach(() => {
  cleanup();
  clearBillingInventoryContext();
});

describe('BillingInventoryQuickLaunch', () => {
  it('renders the three inventory actions inside the quick launch bar', () => {
    render(<BillingInventoryQuickLaunch context={context} />);
    const nav = screen.getByRole('navigation', { name: /billing inventory quick launch/i });
    for (const label of ['VIEW STOCK LEVELS', 'RECONCILE INVENTORY', 'AUDIT WAREHOUSE MOVEMENTS']) {
      expect(within(nav).getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
    expect(within(nav).getByText(/Invoice INV-000003 · SKU COLA-355/)).toBeInTheDocument();
  });

  it.each([
    ['VIEW STOCK LEVELS', '/inventory/stock-inventory', null, 'stock-levels'],
    ['RECONCILE INVENTORY', '/inventory/stock-movements', '14', 'reconcile'],
    ['AUDIT WAREHOUSE MOVEMENTS', '/inventory/movements', '14', 'audit-movements'],
  ])('%s opens %s carrying the billing context', async (label, pathname, itemId, target) => {
    const user = userEvent.setup();
    const navigateToPath = vi.fn();
    const onNavigate = vi.fn();
    render(
      <BillingInventoryQuickLaunch context={context} navigateToPath={navigateToPath} onNavigate={onNavigate} />,
    );

    await user.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(navigateToPath).toHaveBeenCalledTimes(1);
    const url = new URL(navigateToPath.mock.calls[0][0] as string, 'http://x');
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get('from')).toBe('billing-inventory-sync');
    expect(url.searchParams.get('invoice')).toBe('INV-000003');
    expect(url.searchParams.get('receiptId')).toBe('3');
    expect(url.searchParams.get('itemId')).toBe(itemId);

    // El contexto queda guardado para restaurar la vista de facturación al volver.
    const stored = loadBillingInventoryContext();
    expect(stored?.filters).toEqual(context.filters);
    expect(stored?.selection).toEqual(context.selection);
    expect(stored?.lastTarget).toBe(target);
  });

  it('falls back to switching the MerchantFrame tab when URL navigation is not available', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BillingInventoryQuickLaunch context={context} onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: /view stock levels/i }));
    await user.click(screen.getByRole('button', { name: /reconcile inventory/i }));
    await user.click(screen.getByRole('button', { name: /audit warehouse movements/i }));

    expect(onNavigate.mock.calls.map(([tab]) => tab)).toEqual(['stock-inventory', 'stock-movements', 'movements']);
    expect(loadBillingInventoryContext()?.selection?.receiptItemId).toBe(5);
  });

  it('explains the shortcuts when no billing context is active', () => {
    render(<BillingInventoryQuickLaunch context={{ filters: DEFAULT_BILLING_INVENTORY_FILTERS, selection: null }} />);
    expect(screen.getByText(/billing filters are kept for the way back/i)).toBeInTheDocument();
  });
});
