import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend } from '@/test/fetch';
import { fetchFinancialSyncGrid, fetchFinancialSyncLines } from './financial-sync-api';

// Node >= 25 exposes its own (unconfigured) Web Storage globals, which shadow jsdom's;
// apiRequest reads the session token from them, so each test gets an in-memory Storage.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: (index) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
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

describe('financial-sync-api', () => {
  it('requests the grid with page, limit, posting status, search and date range', async () => {
    const fetchMock = fakeBackend({
      '/billing/financial-sync': { statusCode: 200, data: [], page: 2, limit: 25, total: 40, totalPages: 2, hasNext: false, hasPrev: true },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFinancialSyncGrid({
      page: 2,
      limit: 25,
      postingStatus: 'PENDING',
      search: ' INV-01 ',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/billing/financial-sync?page=2&limit=25&postingStatus=PENDING&search=INV-01&dateFrom=2026-11-01&dateTo=2026-11-30',
    );
    expect(result).toEqual({ data: [], page: 2, limit: 25, total: 40, totalPages: 2, hasNext: false, hasPrev: true });
  });

  it('omits empty filters', async () => {
    const fetchMock = fakeBackend({ '/billing/financial-sync': { data: [] } });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFinancialSyncGrid({ postingStatus: '', search: '  ' });

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/billing/financial-sync');
    expect(result.total).toBe(0);
  });

  it('loads the journal entry lines of a receipt, optionally of one entry', async () => {
    const data = { receipt_id: 10, lines: [] };
    const fetchMock = fakeBackend({ '/billing/financial-sync/10/lines': { statusCode: 200, data } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFinancialSyncLines(10)).resolves.toEqual(data);
    await expect(fetchFinancialSyncLines(10, 7)).resolves.toEqual(data);
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/billing/financial-sync/10/lines?journalEntryId=7');
  });
});
