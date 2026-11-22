import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampPercent,
  formatMoney,
  formatPercent,
  formatShortDate,
  parsePositiveId,
  receiptLabel,
} from './partner-sync';
import {
  buildQuery,
  fetchCompanyMerchants,
  fetchPartnerGroups,
  fetchPartnerOptions,
  fetchPartnerSyncMetrics,
  fetchPartnerSyncReceipts,
  linkReceiptToPartner,
  unlinkReceiptPartner,
} from '../api/partner-sync-api';
import { jsonResponse } from '@/test/fetch';

/** Storage en memoria: el cliente HTTP lee el token de localStorage/sessionStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('partner-sync formatters', () => {
  it('formats money with 2 decimals and the currency code', () => {
    expect(formatMoney(15230.5, 'USD')).toBe('15,230.50 USD');
    expect(formatMoney(0.1 + 0.2, 'CLP')).toBe('0.30 CLP');
    expect(formatMoney(null)).toBe('0.00 USD');
  });

  it('formats and clamps percentages', () => {
    expect(formatPercent(17.3375)).toBe('17.34%');
    expect(formatPercent(undefined)).toBe('0%');
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it('labels receipts by invoice number or id and formats dates', () => {
    expect(receiptLabel({ id: 9, invoice_number: 'INV-9' })).toBe('INV-9');
    expect(receiptLabel({ id: 9, invoice_number: null })).toBe('#9');
    expect(formatShortDate('2026-11-20T15:00:00Z')).toMatch(/Nov 2\d, 2026/);
    expect(formatShortDate('nope')).toBe('—');
  });

  it('parses customer IDs typed in the grid filter', () => {
    expect(parsePositiveId(' 12 ')).toBe(12);
    expect(parsePositiveId('')).toBeNull();
    expect(parsePositiveId('0')).toBe('invalid');
    expect(parsePositiveId('-3')).toBe('invalid');
    expect(parsePositiveId('1.5')).toBe('invalid');
    expect(parsePositiveId('abc')).toBe('invalid');
  });
});

describe('partner-sync api', () => {
  it('builds query strings without empty params', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: null, e: 'x y' })).toBe('?a=1&e=x+y');
    expect(buildQuery({})).toBe('');
  });

  it('requests metrics, partner options, receipts and the link endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.includes('/metrics')) return jsonResponse({ statusCode: 200, data: { total_b2b_invoices: 3 } });
      if (url.includes('/partner-options')) return jsonResponse({ statusCode: 200, data: [{ id: 1 }] });
      if (url.endsWith('/receipts/120/partner')) return jsonResponse({ statusCode: 200, data: { id: 120 } });
      return jsonResponse({ data: [{ id: 120 }], page: 1, limit: 20, total: 1, totalPages: 1 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPartnerSyncMetrics({ scope: 'company', merchantId: 4 })).resolves.toEqual({
      total_b2b_invoices: 3,
    });
    await expect(fetchPartnerOptions('supplier', ' coca ')).resolves.toEqual([{ id: 1 }]);
    const receipts = await fetchPartnerSyncReceipts({ search: 'INV', linkState: 'unlinked', limit: 20 });
    expect(receipts.total).toBe(1);
    await expect(linkReceiptToPartner(120, 'customer', 12)).resolves.toEqual({ id: 120 });

    const calls = fetchMock.mock.calls.map(([input, init]) => [String(input), (init as RequestInit | undefined)?.method]);
    expect(calls).toEqual([
      ['/api/billing/partner-sync/metrics?scope=company&merchantId=4', 'GET'],
      ['/api/billing/partner-sync/partner-options?type=supplier&search=coca&limit=50', 'GET'],
      ['/api/billing/partner-sync/receipts?limit=20&search=INV&linkState=unlinked', 'GET'],
      ['/api/billing/partner-sync/receipts/120/partner', 'PATCH'],
    ]);
    const linkInit = fetchMock.mock.calls[3][1] ?? {};
    expect(JSON.parse(String(linkInit.body))).toEqual({ partnerType: 'customer', partnerId: 12 });
  });

  it('omits linkState=all from the receipts query', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchPartnerSyncReceipts({ linkState: 'all' });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/billing/partner-sync/receipts');
  });

  it('requests the partner grid with customer ID and company association filters', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.includes('/company-merchants')) {
        return jsonResponse({ statusCode: 200, data: [{ id: 4, name: 'Centro', is_current: false }] });
      }
      if (url.endsWith('/receipts/120/partner')) return jsonResponse({ statusCode: 200, data: { id: 120 } });
      if (url.includes('/partners')) {
        return jsonResponse({
          data: [{ partner_id: 12 }],
          page: 2,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
          summary: { partners: 11, invoices: 40, total_volume: 1520.5 },
        });
      }
      return jsonResponse({ data: [], total: 0 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const groups = await fetchPartnerGroups({
      scope: 'company',
      merchantId: 4,
      customerId: 12,
      association: 'company',
      linkState: 'all',
      search: ' Pacifico ',
      sortBy: 'name',
      sortOrder: 'ASC',
      page: 2,
      limit: 10,
    });
    expect(groups).toMatchObject({ total: 11, hasPrev: true, summary: { partners: 11, total_volume: 1520.5 } });
    await expect(fetchCompanyMerchants()).resolves.toEqual([{ id: 4, name: 'Centro', is_current: false }]);
    await fetchPartnerSyncReceipts({ partnerType: 'supplier', supplierId: 3, association: 'merchant', limit: 10 });
    await expect(unlinkReceiptPartner(120)).resolves.toEqual({ id: 120 });

    const calls = fetchMock.mock.calls.map(([input, init]) => [String(input), (init as RequestInit | undefined)?.method]);
    expect(calls).toEqual([
      [
        '/api/billing/partner-sync/partners?page=2&limit=10&search=Pacifico&sortBy=name&sortOrder=ASC&customerId=12&association=company&scope=company&merchantId=4',
        'GET',
      ],
      ['/api/billing/partner-sync/company-merchants', 'GET'],
      ['/api/billing/partner-sync/receipts?limit=10&partnerType=supplier&supplierId=3&association=merchant', 'GET'],
      ['/api/billing/partner-sync/receipts/120/partner', 'DELETE'],
    ]);
  });

  it('falls back to an empty summary when the grid response omits it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: [], total: 0 })));
    await expect(fetchPartnerGroups()).resolves.toMatchObject({
      data: [],
      totalPages: 0,
      summary: { partners: 0, invoices: 0, total_volume: 0 },
    });
  });
});
