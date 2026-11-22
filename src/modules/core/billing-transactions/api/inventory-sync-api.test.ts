import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchInventorySyncRows, inventorySyncQueryString } from './inventory-sync-api';
import { calledRoutes, fakeBackend } from '@/test/fetch';

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
});
