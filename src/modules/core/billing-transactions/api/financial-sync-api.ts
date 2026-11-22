import { apiRequest } from '@/shared/api/http';
import type {
  FinancialSyncLines,
  FinancialSyncMetrics,
  FinancialSyncPage,
  FinancialSyncQuery,
  PostBatchPayload,
  PostBatchResult,
  PostingAccount,
} from '../types/financial-sync';

const BASE = '/billing/financial-sync';

function toQueryString(query: FinancialSyncQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.postingStatus) params.set('postingStatus', query.postingStatus);
  const search = query.search?.trim();
  if (search) params.set('search', search);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Grid Billing ↔ Ledger: recibos, impuestos, asientos enlazados y banderas de balance. */
export async function fetchFinancialSyncGrid(
  query: FinancialSyncQuery = {},
): Promise<FinancialSyncPage> {
  const json = await apiRequest<Partial<FinancialSyncPage> | undefined>(
    `${BASE}${toQueryString(query)}`,
    { method: 'GET' },
    'Failed to load the ledger sync grid.',
  );
  const data = Array.isArray(json?.data) ? json.data : [];
  const limit = json?.limit ?? query.limit ?? 10;
  const total = json?.total ?? data.length;
  return {
    data,
    page: json?.page ?? query.page ?? 1,
    limit,
    total,
    totalPages: json?.totalPages ?? Math.ceil(total / limit),
    hasNext: json?.hasNext ?? false,
    hasPrev: json?.hasPrev ?? false,
  };
}

/** Drill-down: líneas de los asientos de un recibo (o de uno de sus asientos). */
export async function fetchFinancialSyncLines(
  receiptId: number,
  journalEntryId?: number,
): Promise<FinancialSyncLines> {
  const qs = journalEntryId ? `?journalEntryId=${journalEntryId}` : '';
  const json = await apiRequest<{ data: FinancialSyncLines }>(
    `${BASE}/${receiptId}/lines${qs}`,
    { method: 'GET' },
    'Failed to load the journal entry lines.',
  );
  return json.data;
}

/** KPIs del header: recibos/ingresos posteados, pendientes, impuestos y balance global. */
export async function fetchFinancialSyncMetrics(): Promise<FinancialSyncMetrics> {
  const json = await apiRequest<{ data: FinancialSyncMetrics }>(
    `${BASE}/metrics`,
    { method: 'GET' },
    'Failed to load the ledger posting metrics.',
  );
  return json.data;
}

/** Cuentas activas (ASSET, REVENUE, LIABILITY, EXPENSE) para el modal del lote. */
export async function fetchPostingAccounts(): Promise<PostingAccount[]> {
  const json = await apiRequest<{ data?: PostingAccount[] }>(
    `${BASE}/posting-accounts`,
    { method: 'GET' },
    'Failed to load the ledger accounts.',
  );
  return Array.isArray(json?.data) ? json.data : [];
}

/** POST BATCH TO LEDGER: la respuesta trae las métricas ya recalculadas. */
export async function postBatchToLedger(payload: PostBatchPayload): Promise<PostBatchResult> {
  const json = await apiRequest<{ data: PostBatchResult }>(
    `${BASE}/post-batch`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to post the batch to the ledger.',
  );
  return json.data;
}
