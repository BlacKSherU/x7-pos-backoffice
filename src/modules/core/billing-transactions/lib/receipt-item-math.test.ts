import { describe, expect, it } from 'vitest';
import {
  computeLineAmounts,
  formatMoney,
  formatQuantity,
  subtotalCents,
} from './receipt-item-math';

describe('computeLineAmounts', () => {
  it('subtotal = quantity × unit price, total = subtotal − discount', () => {
    const r = computeLineAmounts({ quantity: '2', unitPrice: '12.50', discountAmount: '2.50' });
    expect(r.subtotal).toBe(25);
    expect(r.total).toBe(22.5);
    expect(r.isValid).toBe(true);
  });

  it('rounds the subtotal to 2 decimals, half up', () => {
    expect(computeLineAmounts({ quantity: '1.25', unitPrice: '3.33', discountAmount: '' }).subtotal).toBe(4.16);
    expect(computeLineAmounts({ quantity: '0.5', unitPrice: '0.05', discountAmount: '' }).subtotal).toBe(0.03);
  });

  it('has no floating point drift (0.1 × 3 = 0.30)', () => {
    expect(subtotalCents(3, 0.1)).toBe(30);
    expect(computeLineAmounts({ quantity: '3', unitPrice: '0.1', discountAmount: '0.1' }).total).toBe(0.2);
  });

  it('treats an empty discount as 0', () => {
    const r = computeLineAmounts({ quantity: '4', unitPrice: '2.25', discountAmount: '' });
    expect(r.discountAmount).toBe(0);
    expect(r.total).toBe(9);
  });

  it('rejects a discount greater than the subtotal', () => {
    const r = computeLineAmounts({ quantity: '1', unitPrice: '5', discountAmount: '5.01' });
    expect(r.subtotal).toBe(5);
    expect(r.total).toBeNull();
    expect(r.isValid).toBe(false);
    expect(r.errors.discountAmount).toMatch(/greater than the subtotal/i);
  });

  it.each([
    ['quantity', { quantity: '0', unitPrice: '1', discountAmount: '' }, /greater than 0/i],
    ['quantity', { quantity: '', unitPrice: '1', discountAmount: '' }, /required/i],
    ['quantity', { quantity: '1.255', unitPrice: '1', discountAmount: '' }, /2 decimal/i],
    ['quantity', { quantity: 'abc', unitPrice: '1', discountAmount: '' }, /number/i],
    ['unitPrice', { quantity: '1', unitPrice: '-1', discountAmount: '' }, /negative/i],
    ['unitPrice', { quantity: '1', unitPrice: '9.999', discountAmount: '' }, /2 decimal/i],
    ['discountAmount', { quantity: '1', unitPrice: '9', discountAmount: '-2' }, /negative/i],
  ] as const)('flags invalid %s', (field, input, message) => {
    const r = computeLineAmounts(input);
    expect(r.isValid).toBe(false);
    expect(r.errors[field]).toMatch(message);
  });
});

describe('formatters', () => {
  it('formats money with 2 decimals and the currency code', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('1,234.50 USD');
    expect(formatMoney(0, 'EUR')).toBe('0.00 EUR');
  });

  it('formats quantities at the column scale (2 decimals)', () => {
    expect(formatQuantity(2)).toBe('2.00');
    expect(formatQuantity(1.25)).toBe('1.25');
  });
});
