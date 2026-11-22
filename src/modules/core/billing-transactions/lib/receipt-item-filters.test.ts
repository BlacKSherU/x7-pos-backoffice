import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECEIPT_ITEM_FILTERS,
  filtersToQuery,
  hasActiveFilters,
  itemOptionLabel,
  itemOptionValue,
} from './receipt-item-filters';

describe('receipt item filters', () => {
  it('defaults to active lines only and no other filter', () => {
    expect(filtersToQuery(DEFAULT_RECEIPT_ITEM_FILTERS)).toEqual({ isActive: 'true' });
    expect(hasActiveFilters(DEFAULT_RECEIPT_ITEM_FILTERS)).toBe(false);
  });

  it('maps search, receipt, status and an item with SKU', () => {
    const item = itemOptionValue({ name: 'Burger Combo', sku: 'SKU-001' });
    expect(
      filtersToQuery({ search: '  burger ', item, receiptId: '10', status: 'all' }),
    ).toEqual({ search: 'burger', sku: 'SKU-001', receiptId: 10, isActive: 'all' });
  });

  it('maps an item without SKU to an exact item name', () => {
    const item = itemOptionValue({ name: 'Fries', sku: null });
    expect(filtersToQuery({ ...DEFAULT_RECEIPT_ITEM_FILTERS, item })).toEqual({
      isActive: 'true',
      itemName: 'Fries',
    });
  });

  it('ignores a blank search and flags any non-default filter as active', () => {
    expect(filtersToQuery({ ...DEFAULT_RECEIPT_ITEM_FILTERS, search: '   ' })).toEqual({ isActive: 'true' });
    expect(hasActiveFilters({ ...DEFAULT_RECEIPT_ITEM_FILTERS, status: 'false' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_RECEIPT_ITEM_FILTERS, receiptId: '3' })).toBe(true);
  });

  it('labels item options with SKU and line count', () => {
    expect(itemOptionLabel({ name: 'Burger Combo', sku: 'SKU-001', line_count: 3 })).toBe(
      'Burger Combo · SKU-001 (3)',
    );
    expect(itemOptionLabel({ name: 'Fries', sku: null, line_count: 1 })).toBe('Fries (1)');
  });
});
