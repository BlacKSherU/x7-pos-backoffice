import { describe, expect, it } from 'vitest';
import {
  csvToExcelHtml,
  describeDateRange,
  formatMoney,
  formatRate,
  parseCsv,
  periodRange,
  reportFileName,
  toDateInput,
} from './billing-reports';

describe('billing reports formatting', () => {
  it('formats amounts with 2 decimals and the currency code', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('1,234.50 USD');
    expect(formatMoney(0.3)).toBe('0.30');
    expect(formatMoney(null, 'EUR')).toBe('0.00 EUR');
    expect(formatRate(19)).toBe('19.00%');
  });

  it('describes the date range of the filters', () => {
    expect(describeDateRange({ from: '2026-01-01', to: '2026-01-31' })).toBe('2026-01-01 → 2026-01-31');
    expect(describeDateRange({ from: '2026-01-01' })).toBe('From 2026-01-01');
    expect(describeDateRange({})).toBe('All dates');
  });

  it('builds file names from the report and the date range', () => {
    expect(reportFileName('tax-liability', { from: '2026-01-01', to: '2026-01-31' }, 'csv')).toBe(
      'tax-liability_2026-01-01_2026-01-31.csv',
    );
    expect(reportFileName('discount-audit', {}, 'xls')).toBe('discount-audit.xls');
  });
});

describe('periodRange', () => {
  const today = new Date(2026, 4, 17); // 17 May 2026

  it('computes the preset date ranges', () => {
    expect(toDateInput(today)).toBe('2026-05-17');
    expect(periodRange('this-month', today)).toEqual({ from: '2026-05-01', to: '2026-05-17' });
    expect(periodRange('last-month', today)).toEqual({ from: '2026-04-01', to: '2026-04-30' });
    expect(periodRange('quarter-to-date', today)).toEqual({ from: '2026-04-01', to: '2026-05-17' });
    expect(periodRange('year-to-date', today)).toEqual({ from: '2026-01-01', to: '2026-05-17' });
  });

  it('handles January for last month', () => {
    expect(periodRange('last-month', new Date(2026, 0, 10))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
});

describe('parseCsv', () => {
  it('parses quoted fields, escaped quotes, embedded line breaks, CRLF and the BOM', () => {
    const csv = '\uFEFFName,Note,Amount\r\n"VAT, standard","say ""hi""",19.00\r\nCity,"two\nlines",0.30\r\n';
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Note', 'Amount'],
      ['VAT, standard', 'say "hi"', '19.00'],
      ['City', 'two\nlines', '0.30'],
    ]);
  });

  it('keeps empty trailing fields', () => {
    expect(parseCsv('a,,\r\n')).toEqual([['a', '', '']]);
  });
});

describe('csvToExcelHtml', () => {
  it('builds an Excel workbook table with numeric amounts and bold totals', () => {
    const html = csvToExcelHtml(
      'Currency,Tax Name,Taxable Subtotal,Tax Lines\r\nUSD,<VAT>,100.00,3\r\nUSD,TOTAL,100.00,3\r\n',
      'Tax Liability',
    );
    expect(html).toContain('xmlns:x="urn:schemas-microsoft-com:office:excel"');
    expect(html).toContain('<x:Name>Tax Liability</x:Name>');
    expect(html).toContain('<th style="font-weight:bold;mso-number-format:\'\\@\'">Currency</th>');
    expect(html).toContain('&lt;VAT&gt;');
    expect(html).toContain(`<td style="mso-number-format:'0.00'">100.00</td>`);
    expect(html).toContain(`<td style="mso-number-format:'0'">3</td>`);
    expect(html).toContain(`<td style="font-weight:bold;mso-number-format:'\\@'">TOTAL</td>`);
  });
});
