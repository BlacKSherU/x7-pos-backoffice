import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatRate,
  itemTaxableBase,
  previewTaxAmount,
  receiptLabel,
  validateAmountPreview,
  validateRateInput,
} from './receiptTaxesHelpers';

describe('receiptTaxesHelpers', () => {
  it('previews the amount like the server: half-up to the cent without float drift', () => {
    expect(previewTaxAmount(25, 19)).toBe(4.75);
    expect(previewTaxAmount(10.05, 7.5)).toBe(0.75);
    expect(previewTaxAmount(1.15, 10)).toBe(0.12);
    expect(previewTaxAmount(-10, 19)).toBe(0);
  });

  it('uses the line subtotal net of discount as the item taxable base', () => {
    expect(itemTaxableBase({ subtotal: 25, discount_amount: 5 })).toBe(20);
    expect(itemTaxableBase({ subtotal: 0.3, discount_amount: 0.1 })).toBe(0.2);
  });

  it('validates the rate against decimal(5,2) with clear messages', () => {
    expect(validateRateInput('19')).toBeNull();
    expect(validateRateInput('7.25')).toBeNull();
    expect(validateRateInput('')).toBe('Rate is required.');
    expect(validateRateInput('abc')).toMatch(/positive number/);
    expect(validateRateInput('-1')).toMatch(/positive number/);
    expect(validateRateInput('19.555')).toBe('Rate allows at most 2 decimal places (decimal(5,2)).');
    expect(validateRateInput('1000')).toBe('Rate cannot exceed 999.99% (decimal(5,2)).');
  });

  it('flags amounts that do not fit decimal(12,2)', () => {
    expect(validateAmountPreview(9_999_999_999.99)).toBeNull();
    expect(validateAmountPreview(10_000_000_000)).toMatch(/decimal\(12,2\)/);
  });

  it('formats money with 2 decimals and the currency code, and rates as percentages', () => {
    expect(formatMoney(1234.5, 'EUR')).toBe('1,234.50 EUR');
    expect(formatMoney(3, null)).toBe('3.00 USD');
    expect(formatRate(19)).toBe('19.00%');
  });

  it('labels receipts by invoice number or id', () => {
    expect(receiptLabel({ id: 4, invoice_number: 'INV-000004' })).toBe('INV-000004');
    expect(receiptLabel({ id: 4, invoice_number: null })).toBe('Receipt #4');
  });
});
