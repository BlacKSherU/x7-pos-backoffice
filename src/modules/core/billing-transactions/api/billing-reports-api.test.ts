import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDiscountAuditParams,
  buildTaxLiabilityParams,
  fetchAllDiscountAuditRows,
  fetchBillingReportCsv,
  fetchDiscountAuditReport,
  fetchTaxLiabilityReport,
} from './billing-reports-api';
import type { DiscountAuditReport } from '../types/billing-reports';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function auditPage(page: number, hasNext: boolean, total: number): DiscountAuditReport {
  return {
    data: [{ receipt_id: page } as DiscountAuditReport['data'][number]],
    summary: { receipts: total, discounted_receipts: total, voided_receipts: 0, by_currency: [] },
    filters: { from: null, to: null, event_type: 'all', user_id: null, receipt_type: null, currency: null },
    generated_at: '2026-02-01T00:00:00.000Z',
    page,
    limit: 500,
    total,
    totalPages: 3,
    hasNext,
    hasPrev: page > 1,
  };
}

/** Storage en memoria: no depende del localStorage de jsdom (Node 26 trae uno propio, vacío). */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  };
}

describe('billing reports API', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', memoryStorage({ x7_access_token: 'token-123' }));
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serialises only the filters that have a value', () => {
    expect(
      buildTaxLiabilityParams({ from: '2026-01-01', to: '', rate: 19, scope: '', name: ' VAT ', currency: 'USD' }).toString(),
    ).toBe('from=2026-01-01&rate=19&name=VAT&currency=USD');
    expect(
      buildDiscountAuditParams({ eventType: 'all', userId: null, receiptType: 'INVOICE', page: 2, limit: 50 }).toString(),
    ).toBe('receiptType=INVOICE&page=2&limit=50');
    expect(buildDiscountAuditParams({ eventType: 'void', userId: 7 }).toString()).toBe('eventType=void&userId=7');
  });

  it('loads the tax liability report from /billing/reports/tax-liability', async () => {
    const data = { groups: [], totals: {}, totals_by_currency: [], currencies: [] };
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 200, message: 'ok', data }));

    const report = await fetchTaxLiabilityReport({ from: '2026-01-01', to: '2026-01-31', scope: 'ITEM' });

    expect(report).toEqual(data);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/billing/reports/tax-liability?from=2026-01-01&to=2026-01-31&scope=ITEM');
    expect(init.method).toBe('GET');
  });

  it('loads a page of the discount audit report', async () => {
    fetchMock.mockResolvedValue(jsonResponse(auditPage(1, false, 1)));

    const report = await fetchDiscountAuditReport({ eventType: 'discount', page: 1, limit: 25 });

    expect(report.total).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/billing/reports/discount-audit?eventType=discount&page=1&limit=25');
  });

  it('collects every page of the audit for printing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(auditPage(1, true, 3)))
      .mockResolvedValueOnce(jsonResponse(auditPage(2, true, 3)))
      .mockResolvedValueOnce(jsonResponse(auditPage(3, false, 3)));

    const all = await fetchAllDiscountAuditRows({ eventType: 'all' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('page=3&limit=500');
    expect(all.rows.map((r) => r.receipt_id)).toEqual([1, 2, 3]);
    expect(all.truncated).toBe(false);
  });

  it('flags the printable audit as truncated when the page cap is reached', async () => {
    fetchMock.mockResolvedValue(jsonResponse(auditPage(1, true, 3)));

    const all = await fetchAllDiscountAuditRows({}, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(all.truncated).toBe(true);
  });

  it('downloads the CSV export with the bearer token and without pagination', async () => {
    fetchMock.mockResolvedValue(new Response('Receipt ID\r\n10\r\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }));

    const csv = await fetchBillingReportCsv('discount-audit', { from: '2026-01-01', eventType: 'void', page: 4, limit: 25 });

    expect(csv).toBe('Receipt ID\r\n10\r\n');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/billing/reports/discount-audit?from=2026-01-01&eventType=void&format=csv');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
    expect((init.headers as Record<string, string>).Accept).toBe('text/csv');
  });

  it('surfaces the backend error message when the export fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: '`from` must be on or before `to`' }, 400));

    await expect(fetchBillingReportCsv('tax-liability', { from: '2026-02-01', to: '2026-01-01' })).rejects.toThrow(
      '`from` must be on or before `to`',
    );
  });
});
