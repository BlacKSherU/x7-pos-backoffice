import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend, jsonResponse } from '@/test/fetch';
import {
  fetchFinancialSyncGrid,
  fetchFinancialSyncLines,
  fetchFinancialSyncMetrics,
  fetchPostingAccounts,
  postBatchToLedger,
} from './financial-sync-api';

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

  it('loads the header metrics', async () => {
    const data = { currency: 'USD', total_receipts: 3, unposted_transactions: 1 };
    vi.stubGlobal('fetch', fakeBackend({ '/billing/financial-sync/metrics': { statusCode: 200, data } }));

    await expect(fetchFinancialSyncMetrics()).resolves.toEqual(data);
  });

  it('loads the posting accounts, empty when the payload has no list', async () => {
    const accounts = [{ id: 1, code: '1100', name: 'Cash', type: 'ASSET' }];
    vi.stubGlobal('fetch', fakeBackend({ '/billing/financial-sync/posting-accounts': { data: accounts } }));
    await expect(fetchPostingAccounts()).resolves.toEqual(accounts);

    vi.stubGlobal('fetch', fakeBackend({ '/billing/financial-sync/posting-accounts': { data: null } }));
    await expect(fetchPostingAccounts()).resolves.toEqual([]);
  });

  it('posts the batch with the selected accounts and returns the result', async () => {
    const result = { generated_entries: 2, posted_drafts: 0, entries: [], skipped: [], metrics: { currency: 'USD' } };
    const fetchMock = fakeBackend({
      'POST /billing/financial-sync/post-batch': () => jsonResponse({ statusCode: 201, data: result }, 201),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postBatchToLedger({ cashAccountId: 1, revenueAccountId: 3, taxAccountId: 4 })).resolves.toEqual(result);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      cashAccountId: 1,
      revenueAccountId: 3,
      taxAccountId: 4,
    });
  });

  it('surfaces the server message when the batch fails', async () => {
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        'POST /billing/financial-sync/post-batch': () =>
          jsonResponse({ statusCode: 400, message: 'Ledger account 9 must be of type REVENUE' }, 400),
      }),
    );

    await expect(postBatchToLedger({ cashAccountId: 1, revenueAccountId: 9 })).rejects.toThrow(
      'Ledger account 9 must be of type REVENUE',
    );
  });
});
