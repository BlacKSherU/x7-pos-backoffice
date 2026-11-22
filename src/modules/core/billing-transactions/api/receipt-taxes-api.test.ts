import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReceiptTax,
  fetchReceiptItemOptions,
  fetchReceiptTaxes,
  normalizeReceiptTax,
  setReceiptTaxStatus,
  updateReceiptTax,
} from './receipt-taxes-api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const RAW_TAX = {
  id: 1,
  receipt_id: 10,
  receipt_item_id: null,
  name: 'IVA 19%',
  rate: '19.00',
  amount: '23.75',
  scope: 'RECEIPT',
  is_active: true,
  receipt_invoice_number: 'INV-000010',
  currency: 'USD',
  receipt_item_name: null,
  receipt_total_tax: '23.75',
  receipt_grand_total: '148.75',
  created_at: '2026-01-01T00:00:00Z',
};

/** In-memory Web Storage: some Node versions shadow jsdom's localStorage with an undefined global. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

describe('receipt-taxes-api', () => {
  const fetchMock = vi.fn();

  beforeAll(() => {
    if (typeof globalThis.localStorage?.getItem !== 'function') vi.stubGlobal('localStorage', memoryStorage());
    if (typeof globalThis.sessionStorage?.getItem !== 'function') vi.stubGlobal('sessionStorage', memoryStorage());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchMock.mockReset();
  });

  it('normalizes decimals returned as strings', () => {
    expect(normalizeReceiptTax(RAW_TAX)).toMatchObject({
      rate: 19,
      amount: 23.75,
      scope: 'RECEIPT',
      is_active: true,
      receipt_total_tax: 23.75,
      receipt_grand_total: 148.75,
    });
  });

  it('lists taxes of every status by default and forwards the filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [RAW_TAX], page: 1, limit: 25, total: 1, totalPages: 1 }));
    const result = await fetchReceiptTaxes({ page: 2, limit: 25, scope: 'ITEM', name: ' IVA ' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/receipt-taxes?');
    expect(url).toContain('page=2');
    expect(url).toContain('scope=ITEM');
    expect(url).toContain('name=IVA');
    expect(url).toContain('status=all');
    expect(result.data[0].amount).toBe(23.75);
  });

  it('creates without sending an amount', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: RAW_TAX }, 201));
    await createReceiptTax({ receiptId: 10, name: 'IVA 19%', rate: 19, scope: 'RECEIPT' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/receipt-taxes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ receiptId: 10, name: 'IVA 19%', rate: 19, scope: 'RECEIPT' });
  });

  it('updates and toggles the status with PATCH', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: RAW_TAX })));
    await updateReceiptTax(1, { rate: 16 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/receipt-taxes/1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');

    await setReceiptTaxStatus(1, false);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/receipt-taxes/1/status');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({ isActive: false });
  });

  it('loads the items of one receipt for the item selector', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: 5, receipt_id: 10, name: 'Burger', sku: null, subtotal: '25.00', discount_amount: '5.00', total: '20.00' }] }),
    );
    const items = await fetchReceiptItemOptions(10);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/receipt-items?receiptId=10&limit=100');
    expect(items[0]).toMatchObject({ id: 5, subtotal: 25, discount_amount: 5 });
  });

  it('surfaces the back-end validation message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 400, message: 'rate cannot exceed 999.99 (column precision decimal(5,2))' }, 400),
    );
    await expect(createReceiptTax({ receiptId: 10, name: 'X', rate: 1000, scope: 'RECEIPT' })).rejects.toThrow(
      'rate cannot exceed 999.99 (column precision decimal(5,2))',
    );
  });
});
