import { describe, expect, it } from 'vitest';
import {
  describeDateRange,
  formatAmount,
  formatMoney,
  formatQuantity,
  formatRate,
  parseFiscalData,
  receiptLabel,
  summarizeFiscalData,
  taxLabel,
  validateFiscalDataInput,
} from './receipts-format';

describe('receipts-format', () => {
  it('formats every amount with exactly 2 decimals', () => {
    expect(formatAmount(119)).toBe('119.00');
    expect(formatAmount('1234.5')).toBe('1,234.50');
    expect(formatAmount(0.1 + 0.2)).toBe('0.30');
    expect(formatAmount(null)).toBe('0.00');
    expect(formatAmount('not-a-number')).toBe('0.00');
  });

  it('appends the ISO currency code', () => {
    expect(formatMoney(119, 'USD')).toBe('119.00 USD');
    expect(formatMoney(5, 'eur')).toBe('5.00 EUR');
    expect(formatMoney(5, undefined)).toBe('5.00 USD');
  });

  it('parses fiscal_data JSON objects into key/value pairs', () => {
    expect(parseFiscalData('{"tax_id":"123","fiscal_number":"ABC"}')).toEqual([
      ['tax_id', '123'],
      ['fiscal_number', 'ABC'],
    ]);
    expect(parseFiscalData('{"address":{"city":"Lima"}}')).toEqual([['address', '{"city":"Lima"}']]);
    expect(parseFiscalData('plain text')).toEqual([['raw', 'plain text']]);
    expect(parseFiscalData(null)).toEqual([]);
  });

  it('summarizes fiscal_data for the grid', () => {
    expect(summarizeFiscalData('{"tax_id":"123","fiscal_number":"ABC"}')).toBe('tax_id: 123 · fiscal_number: ABC');
    expect(summarizeFiscalData('{"tax_id":"1234567890"}', 10)).toBe('tax_id: 1…');
    expect(summarizeFiscalData('')).toBe('');
  });

  it('labels receipts by invoice number or id', () => {
    expect(receiptLabel({ id: 3, invoice_number: 'INV-000003' })).toBe('INV-000003');
    expect(receiptLabel({ id: 3, invoice_number: null })).toBe('Receipt #3');
  });

  it('validates the fiscal data input as an optional JSON object', () => {
    expect(validateFiscalDataInput('')).toBeNull();
    expect(validateFiscalDataInput('{"tax_id":"1"}')).toBeNull();
    expect(validateFiscalDataInput('[1,2]')).toMatch(/JSON object/);
    expect(validateFiscalDataInput('{bad')).toMatch(/valid JSON/);
  });

  it('formats tax rates and quantities without trailing zeros (Historia 13)', () => {
    expect(formatRate(19)).toBe('19%');
    expect(formatRate('8.50')).toBe('8.5%');
    expect(formatRate(null)).toBe('0%');
    expect(formatQuantity('2.00')).toBe('2');
    expect(formatQuantity(1.5)).toBe('1.5');
  });

  it('labels a tax type by name and rate without repeating the rate (Historia 13)', () => {
    expect(taxLabel('VAT', 19)).toBe('VAT 19%');
    expect(taxLabel('Consumption Tax', 8)).toBe('Consumption Tax 8%');
    expect(taxLabel('IVA 19%', 19)).toBe('IVA 19%');
    expect(taxLabel('IVA 19 %', 19)).toBe('IVA 19 %');
  });

  it('describes the active date range (Historia 13)', () => {
    expect(describeDateRange('', '')).toBe('All dates');
    expect(describeDateRange('2026-11-01', '2026-11-30')).toBe('Nov 1, 2026 – Nov 30, 2026');
    expect(describeDateRange('2026-11-05', '2026-11-05')).toBe('Nov 5, 2026');
    expect(describeDateRange('2026-11-01', undefined)).toBe('Since Nov 1, 2026');
    expect(describeDateRange(null, '2026-11-30')).toBe('Until Nov 30, 2026');
  });
});
