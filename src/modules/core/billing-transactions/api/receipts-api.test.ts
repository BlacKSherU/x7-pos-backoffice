import { afterEach, describe, expect, it, vi } from 'vitest';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import { getReceiptsSummary, listReceipts, setReceiptStatus, toQueryString, updateReceipt } from './receipts-api';

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
});
