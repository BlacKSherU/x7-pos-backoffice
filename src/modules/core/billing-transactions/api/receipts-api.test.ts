import { afterEach, describe, expect, it, vi } from 'vitest';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import {
  getReceiptActivityLog,
  getReceiptDetails,
  getReceiptTaxBreakdown,
  getReceiptsSummary,
  listReceipts,
  lockReceipt,
  setReceiptStatus,
  toQueryString,
  updateReceipt,
} from './receipts-api';

const rawReceipt = {
  id: 1,
  order_id: 10,
  merchant_id: 1,
  invoice_number: 'INV-000001',
  type: 'INVOICE',
  fiscal_data: null,
  subtotal: '100.00',
  total_tax: '19.00',
  total_discount: '0.00',
  grand_total: '119.00',
  currency: 'USD',
  is_active: true,
  is_locked: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('receipts-api', () => {
  it('drops empty query params', () => {
    expect(toQueryString({ a: 1, b: '', c: undefined, d: null, e: 'x y' })).toBe('?a=1&e=x+y');
    expect(toQueryString({})).toBe('');
  });

  it('lists receipts with search, type and status, normalizing amounts to numbers', async () => {
    const fetchMock = fakeBackend({
      '/receipts': { data: [rawReceipt], page: 2, limit: 10, total: 11, totalPages: 2, hasNext: false, hasPrev: true },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listReceipts({ page: 2, limit: 10, search: ' INV-0 ', type: 'INVOICE', status: 'inactive' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/receipts?');
    expect(url).toContain('search=INV-0');
    expect(url).toContain('type=INVOICE');
    expect(url).toContain('status=inactive');
    expect(url).toContain('page=2');
    expect(result.data[0].grand_total).toBe(119);
    expect(result.data[0].subtotal).toBe(100);
    expect(result.data[0].is_locked).toBe(false);
    expect(result.total).toBe(11);
  });

  it('edits with PATCH /receipts/:id', async () => {
    const fetchMock = fakeBackend({
      'PATCH /receipts/1': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ invoiceNumber: 'INV-000777' });
        return jsonResponse({ data: { ...rawReceipt, invoice_number: 'INV-000777' } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await updateReceipt(1, { invoiceNumber: 'INV-000777' });

    expect(calledRoutes(fetchMock)).toEqual(['PATCH /receipts/1']);
    expect(updated.invoice_number).toBe('INV-000777');
  });

  it('changes is_active with PATCH /receipts/:id/status', async () => {
    const fetchMock = fakeBackend({
      'PATCH /receipts/1/status': (init: RequestInit | undefined) => {
        expect(JSON.parse(String(init?.body))).toEqual({ isActive: false });
        return jsonResponse({ data: { ...rawReceipt, is_active: false } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await setReceiptStatus(1, false);

    expect(calledRoutes(fetchMock)).toEqual(['PATCH /receipts/1/status']);
    expect(updated.is_active).toBe(false);
  });

  it('surfaces the backend 409 message for duplicated invoice numbers', async () => {
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        'PATCH /receipts/1': () =>
          jsonResponse(
            {
              statusCode: 409,
              message: "Invoice number 'INV-000002' is already used by another receipt of this merchant",
            },
            409,
          ),
      }),
    );

    await expect(updateReceipt(1, { invoiceNumber: 'INV-000002' })).rejects.toMatchObject({
      status: 409,
      message: "Invoice number 'INV-000002' is already used by another receipt of this merchant",
    });
  });

  it('loads the KPI summary filtered by is_active status (Historia 19)', async () => {
    const fetchMock = fakeBackend({
      '/receipts/summary': {
        data: {
          status: 'active',
          total_receipts: 2,
          active_receipts: 2,
          inactive_receipts: 0,
          locked_receipts: 0,
          currency: 'USD',
          grand_total: '238.00',
          subtotal: '200',
          total_tax: '38',
          total_discount: '0',
          average_ticket: '119',
          by_type: [],
          by_currency: [],
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await getReceiptsSummary({ status: 'active' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/receipts/summary?status=active');
    expect(summary.grand_total).toBe(238);
    expect(summary.average_ticket).toBe(119);
  });

  it('sends the date range to the list and the summary (Historia 13)', async () => {
    const fetchMock = fakeBackend({
      '/receipts': { data: [], page: 1, limit: 10, total: 0, totalPages: 0 },
      '/receipts/summary': { data: { status: 'active', by_type: [], by_currency: [] } },
    });
    vi.stubGlobal('fetch', fetchMock);

    await listReceipts({ page: 1, dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    await getReceiptsSummary({ status: 'active', dateFrom: '2026-11-01', dateTo: '' });

    const urls = fetchMock.mock.calls.map(([u]) => new URL(String(u), 'http://localhost'));
    expect(urls[0].searchParams.get('dateFrom')).toBe('2026-11-01');
    expect(urls[0].searchParams.get('dateTo')).toBe('2026-11-30');
    expect(urls[1].searchParams.get('dateFrom')).toBe('2026-11-01');
    expect(urls[1].searchParams.has('dateTo')).toBe(false);
  });

  it('loads the items and tax lines of a receipt with GET /receipts/:id/details (Historia 13)', async () => {
    const fetchMock = fakeBackend({
      '/receipts/1/details': {
        data: {
          receipt: rawReceipt,
          items: [
            { id: 7, name: 'Burger', sku: undefined, quantity: '2.00', unit_price: '12.50', subtotal: '25.00', discount_amount: '0.00', total: '25.00' },
          ],
          taxes: [{ id: 3, receipt_item_id: undefined, name: 'VAT', rate: '19.00', amount: '4.75', scope: 'RECEIPT' }],
          items_total: '25.00',
          taxes_total: '4.75',
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const details = await getReceiptDetails(1);

    expect(calledRoutes(fetchMock)).toEqual(['GET /receipts/1/details']);
    expect(details.receipt.grand_total).toBe(119);
    expect(details.items[0]).toMatchObject({ name: 'Burger', sku: null, quantity: 2, unit_price: 12.5, total: 25 });
    expect(details.taxes[0]).toMatchObject({ name: 'VAT', rate: 19, amount: 4.75, receipt_item_id: null });
    expect(details.items_total).toBe(25);
    expect(details.taxes_total).toBe(4.75);
  });

  it('loads the tax breakdown with status and date range (Historia 13)', async () => {
    const fetchMock = fakeBackend({
      '/receipts/tax-breakdown': {
        data: {
          status: 'active',
          date_from: '2026-11-01',
          date_to: null,
          currency: 'USD',
          total_tax: '38.50',
          by_tax: [{ name: 'VAT', rate: '19.00', currency: 'USD', total_amount: '38.50', tax_lines: '3', receipts: '2' }],
          by_currency: [{ currency: 'USD', total_amount: '38.50', tax_lines: '3' }],
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const breakdown = await getReceiptTaxBreakdown({ status: 'active', dateFrom: '2026-11-01' });

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.pathname).toMatch(/\/receipts\/tax-breakdown$/);
    expect(url.searchParams.get('status')).toBe('active');
    expect(url.searchParams.get('dateFrom')).toBe('2026-11-01');
    expect(url.searchParams.has('dateTo')).toBe(false);
    expect(breakdown.total_tax).toBe(38.5);
    expect(breakdown.by_tax[0]).toEqual({
      name: 'VAT',
      rate: 19,
      currency: 'USD',
      total_amount: 38.5,
      tax_lines: 3,
      receipts: 2,
    });
    expect(breakdown.by_currency[0].total_amount).toBe(38.5);
  });

  it('locks a receipt with PATCH /receipts/:id/lock and keeps who processed it (Historia 11)', async () => {
    const fetchMock = fakeBackend({
      'PATCH /receipts/1/lock': () =>
        jsonResponse({
          data: { ...rawReceipt, is_locked: true, processed_by_user_id: 7, processed_by_role: 'merchant_admin' },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const locked = await lockReceipt(1);

    expect(calledRoutes(fetchMock)).toEqual(['PATCH /receipts/1/lock']);
    expect(locked).toMatchObject({ is_locked: true, processed_by_user_id: 7, processed_by_role: 'merchant_admin' });
  });
});

describe('getReceiptActivityLog (Historia 6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GET /receipts/:id/activity-log keeps the server order and normalizes the totals', async () => {
    const fetchMock = fakeBackend({
      '/receipts/5/activity-log': {
        data: {
          receipt_id: 5,
          invoice_number: 'INV-000005',
          currency: null,
          events: [
            {
              id: 3,
              action: 'CREATED',
              user_id: 7,
              user_name: 'ana',
              role: 'merchant_admin',
              previous_values: null,
              new_values: { subtotal: '0.00', total_tax: '0.00', total_discount: '0.00', grand_total: '0.00' },
              metadata: { source: 'manual' },
              created_at: '2026-11-22T10:00:00.123Z',
            },
            {
              id: 4,
              action: 'ITEM_MODIFIED',
              user_id: null,
              previous_values: { subtotal: '0', total_tax: '0', total_discount: '0', grand_total: '0' },
              new_values: { subtotal: '25.50', total_tax: '4.85', total_discount: '0', grand_total: '30.35' },
              created_at: '2026-11-22T10:00:00.123Z',
            },
          ],
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const log = await getReceiptActivityLog(5);

    expect(calledRoutes(fetchMock)).toEqual(['GET /receipts/5/activity-log']);
    expect(log.currency).toBe('USD');
    expect(log.events.map((e) => e.id)).toEqual([3, 4]);
    expect(log.events[0].new_values).toEqual({ subtotal: 0, total_tax: 0, total_discount: 0, grand_total: 0 });
    expect(log.events[1]).toMatchObject({
      user_id: null,
      user_name: null,
      role: null,
      metadata: null,
      new_values: { subtotal: 25.5, total_tax: 4.85, total_discount: 0, grand_total: 30.35 },
    });
  });

  it('surfaces the server error', async () => {
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        '/receipts/5/activity-log': () => jsonResponse({ statusCode: 404, message: 'Receipt not found' }, 404),
      }),
    );
    await expect(getReceiptActivityLog(5)).rejects.toThrow('Receipt not found');
  });
});
