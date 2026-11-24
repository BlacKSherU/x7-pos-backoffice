import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  clearBillingInventoryContext,
  filtersFromLocation,
  initialBillingInventoryContext,
  loadBillingInventoryContext,
  saveBillingInventoryContext,
  type BillingInventoryContextInput,
} from './billing-inventory-context';

const selected: BillingInventoryContextInput = {
  filters: { ...DEFAULT_BILLING_INVENTORY_FILTERS, status: 'FAILED', page: 3 },
  selection: {
    receiptItemId: 41,
    receiptId: 7,
    invoiceNumber: 'INV-000007',
    sku: 'BURGER-01',
    orderId: 12,
    stockItemId: 99,
  },
};

afterEach(() => {
  clearBillingInventoryContext();
});

describe('billing inventory context', () => {
  it('round-trips filters and selection through sessionStorage', () => {
    saveBillingInventoryContext(selected);
    const loaded = loadBillingInventoryContext();
    expect(loaded?.filters).toEqual(selected.filters);
    expect(loaded?.selection).toEqual(selected.selection);
    expect(loaded?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('ignores corrupted or foreign storage content', () => {
    sessionStorage.setItem('x7:billing-inventory-sync:context', '{not json');
    expect(loadBillingInventoryContext()).toBeNull();
    sessionStorage.setItem(
      'x7:billing-inventory-sync:context',
      JSON.stringify({ filters: { page: -2, limit: 'x' }, selection: { receiptId: 'abc' } }),
    );
    const loaded = loadBillingInventoryContext();
    expect(loaded?.filters.page).toBe(1);
    expect(loaded?.filters.limit).toBe(10);
    expect(loaded?.selection).toBeNull();
  });

  it('reads filters from the URL only on the billing inventory sync routes', () => {
    expect(filtersFromLocation('/billing/inventory-sync', '?invoice=INV-1&status=PENDING')).toEqual({
      invoiceNumber: 'INV-1',
      status: 'PENDING',
    });
    expect(filtersFromLocation('/inventory/movements', '?invoice=INV-1')).toBeNull();
    expect(filtersFromLocation('/billing/inventory-sync', '')).toBeNull();
  });

  it('starts from the URL, then the stored context, then the defaults', () => {
    expect(initialBillingInventoryContext('/dashboard', '')).toEqual({
      filters: DEFAULT_BILLING_INVENTORY_FILTERS,
      selection: null,
    });
    saveBillingInventoryContext(selected);
    expect(initialBillingInventoryContext('/dashboard', '')).toEqual(selected);
    expect(initialBillingInventoryContext('/billing/inventory-sync', '?invoice=INV-2').filters.invoiceNumber).toBe(
      'INV-2',
    );
  });
});
