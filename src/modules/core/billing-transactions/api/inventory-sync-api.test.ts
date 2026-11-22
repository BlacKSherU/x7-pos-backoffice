import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchInventorySyncMetrics,
  fetchInventorySyncRows,
  inventorySyncQueryString,
  validateStockAvailability,
} from './inventory-sync-api';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inventory-sync-api', () => {
  it('builds the query string without empty filters', () => {
    expect(inventorySyncQueryString({})).toBe('');
    expect(
      inventorySyncQueryString({ invoiceNumber: '  INV-1 ', status: '', dateFrom: '2026-11-01', page: 2, limit: 10 }),
    ).toBe('?invoiceNumber=INV-1&dateFrom=2026-11-01&page=2&limit=10');
  });

  it('normalizes the decimal columns the API sends as strings', async () => {
    const fetchMock = fakeBackend({
      '/billing/inventory-sync': {
        data: [
          {
            receiptItemId: 1,
            quantitySold: '2.000',
            movements: [{ id: 5, quantity: '4.0000' }],
            components: [{ key: 'supply:1', requiredQty: '4', deductedQty: '4', currentQty: null, minimumQty: '5', shortfall: '0' }],
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchInventorySyncRows({ page: 1, limit: 10 });

    expect(calledRoutes(fetchMock)).toEqual(['GET /billing/inventory-sync']);
    expect(result.total).toBe(1);
    expect(result.hasNext).toBe(false);
    const [line] = result.data;
    expect(line.quantitySold).toBe(2);
    expect(line.movements[0].quantity).toBe(4);
    expect(line.components[0]).toMatchObject({ requiredQty: 4, currentQty: null, minimumQty: 5, movementIds: [] });
  });

  it('loads the header metrics with zeroed missing status counts', async () => {
    const fetchMock = fakeBackend({
      '/billing/inventory-sync/metrics': {
        data: {
          dateFrom: '2026-11-01',
          dateTo: '2026-11-07',
          generatedAt: '2026-11-07T10:00:00.000Z',
          itemsDeducted: '4',
          unitsDeducted: '6.5',
          linesEvaluated: 9,
          statusCounts: { DEDUCTED: 4, FAILED: '1' },
          lowStock: {
            total: 1,
            outOfStock: 0,
            low: 1,
            activeAlerts: 0,
            warnings: [{ stockItemId: 5, currentQty: '2', minimumQty: '4', soldQty: '3' }],
          },
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await fetchInventorySyncMetrics({ dateFrom: '2026-11-01', dateTo: '2026-11-07' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/billing/inventory-sync/metrics?dateFrom=2026-11-01&dateTo=2026-11-07');
    expect(metrics.itemsDeducted).toBe(4);
    expect(metrics.unitsDeducted).toBe(6.5);
    expect(metrics.salesLocation).toBeNull();
    expect(metrics.statusCounts).toEqual({ DEDUCTED: 4, PENDING: 0, INSUFFICIENT_STOCK: 0, FAILED: 1, NOT_TRACKED: 0 });
    expect(metrics.lowStock.warnings[0]).toMatchObject({ currentQty: 2, minimumQty: 4, soldQty: 3 });
  });

  it('posts the stock validation request and surfaces API errors', async () => {
    let body: unknown;
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        'POST /billing/inventory-sync/validate-stock': (init: RequestInit | undefined) => {
          body = JSON.parse(String(init?.body));
          return jsonResponse({ message: 'Receipt 404 not found' }, 404);
        },
      }),
    );

    await expect(validateStockAvailability({ receiptId: 404 })).rejects.toThrow('Receipt 404 not found');
    expect(body).toEqual({ receiptId: 404 });
  });
});
