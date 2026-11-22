import React, { useEffect, useState } from 'react';
import {
  fetchFinancialSyncGrid,
  fetchFinancialSyncLines,
} from '@/modules/core/billing-transactions/api/financial-sync-api';
import type {
  FinancialSyncLines,
  FinancialSyncPage,
  FinancialSyncRow,
  FinancialSyncVerification,
  ReceiptPostingStatus,
} from '@/modules/core/billing-transactions/types/financial-sync';
import {
  ACCOUNT_TYPE_CLASS,
  ENTRY_STATUS_CLASS,
  FLAG_STATE_META,
  POSTING_STATUS_META,
  VERIFICATION_FLAGS,
  flagState,
  formatAmount,
  formatDate,
  formatMoney,
  type VerificationFlagKey,
} from '@/modules/core/billing-transactions/lib/financial-sync-format';
import { TableEmptyState, TablePaginationFooter } from '@/shared/components/TableOptionsMenu';

export interface BillingFinancialSyncGridProps {
  /** Bump it to reload the current page (e.g. after POST BATCH TO LEDGER). */
  refreshKey?: number;
}

type StatusFilter = '' | ReceiptPostingStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNPOSTED', label: 'Unposted' },
];

const PAGE_SIZES = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 300;
const COLUMN_COUNT = 8;

function invoiceLabel(row: { invoice_number: string | null; receipt_id: number }): string {
  return row.invoice_number || `Receipt #${row.receipt_id}`;
}

// ─── Badges ────────────────────────────────────────────────────────────────

const PostingStatusBadge: React.FC<{ status: ReceiptPostingStatus }> = ({ status }) => {
  const meta = POSTING_STATUS_META[status];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-poppins ${meta.className}`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
};

const FlagBadge: React.FC<{ flag: VerificationFlagKey; verification: FinancialSyncVerification }> = ({
  flag,
  verification,
}) => {
  const config = VERIFICATION_FLAGS.find((f) => f.key === flag)!;
  const state = flagState(verification[flag]);
  const meta = FLAG_STATE_META[state];
  return (
    <span
      role="img"
      aria-label={`${config.label}: ${meta.word}`}
      title={`${config.label}: ${meta.word}`}
      data-flag={flag}
      data-state={state}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide whitespace-nowrap font-poppins ${meta.className}`}
    >
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
        {meta.icon}
      </span>
      {config.short}
    </span>
  );
};

const BalanceBadge: React.FC<{ isBalanced: boolean | null }> = ({ isBalanced }) => {
  const state = flagState(isBalanced);
  const label = state === 'pass' ? 'Balanced' : state === 'fail' ? 'Unbalanced' : 'Not verified';
  const icon = state === 'pass' ? 'verified' : state === 'fail' ? 'report' : 'help';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-extrabold uppercase tracking-wider font-poppins ${FLAG_STATE_META[state].className}`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
};

// ─── Drill-down: journal entry lines ───────────────────────────────────────

const ReceiptLedgerDetail: React.FC<{ row: FinancialSyncRow }> = ({ row }) => {
  const [entryFilter, setEntryFilter] = useState<number | null>(null);
  const [lines, setLines] = useState<FinancialSyncLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasEntries = row.journal_entries.length > 0;

  useEffect(() => {
    if (!hasEntries) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFinancialSyncLines(row.receipt_id, entryFilter ?? undefined)
      .then((result) => {
        if (!cancelled) setLines(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the journal entry lines.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.receipt_id, entryFilter, hasEntries]);

  const currency = row.currency;
  const v = row.verification;
  const checks: Array<{ key: VerificationFlagKey; detail: string }> = [
    {
      key: 'entries_balanced',
      detail: `Debits ${formatAmount(row.ledger_total_debit)} · Credits ${formatAmount(row.ledger_total_credit)}`,
    },
    {
      key: 'grand_total_matches_assets',
      detail: `Grand total ${formatAmount(row.grand_total)} · ASSET net debit ${formatAmount(row.asset_net_debit)}`,
    },
    {
      key: 'tax_matches_liabilities',
      detail: `Total tax ${formatAmount(row.total_tax)} · LIABILITY net credit ${formatAmount(row.liability_net_credit)}`,
    },
    {
      key: 'receipt_totals_consistent',
      detail: `${formatAmount(row.subtotal)} + ${formatAmount(row.total_tax)} − ${formatAmount(row.total_discount)} = ${formatAmount(row.grand_total)}`,
    },
    {
      key: 'receipt_taxes_match_total',
      detail: `ReceiptTax Σ ${formatAmount(row.receipt_taxes_total)} · total tax ${formatAmount(row.total_tax)}`,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-4 bg-[#fbf8f3] border-t border-[#e8e2d8] font-sans"
      aria-label={`Ledger detail for ${invoiceLabel(row)}`}
      role="region"
    >
      {/* Balance verification */}
      <section className="bg-white border border-[#e8e2d8] rounded-lg p-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins mb-2">
          Balance verification
        </h4>
        <ul className="flex flex-col gap-2">
          {checks.map((check) => {
            const config = VERIFICATION_FLAGS.find((f) => f.key === check.key)!;
            const state = flagState(v[check.key]);
            return (
              <li key={check.key} className="flex items-start gap-2">
                <FlagBadge flag={check.key} verification={v} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#1d1c17]">{config.label}</p>
                  <p className="text-[10.5px] text-[#76736a] font-mono">
                    {state === 'na' ? 'No live journal entries to verify' : check.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins mt-4 mb-2">
          Receipt taxes (ReceiptTax)
        </h4>
        {row.receipt_taxes.length === 0 ? (
          <p className="text-[11px] text-[#76736a] italic">No active tax records.</p>
        ) : (
          <table className="w-full text-[11px]">
            <tbody>
              {row.receipt_taxes.map((tax) => (
                <tr key={tax.id} className="border-b border-[#f1ece4] last:border-0">
                  <td className="py-1 pr-2 font-semibold text-[#1d1c17]">{tax.name}</td>
                  <td className="py-1 pr-2 text-[#76736a]">
                    {tax.rate}% · {tax.scope === 'ITEM' ? `Item #${tax.receipt_item_id ?? '—'}` : 'Receipt'}
                  </td>
                  <td className="py-1 text-right font-mono">{formatMoney(tax.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Journal entries + lines */}
      <section className="xl:col-span-2 bg-white border border-[#e8e2d8] rounded-lg p-3 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Journal entries &amp; lines
          </h4>
          {hasEntries && (
            <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filter lines by journal entry">
              <button
                type="button"
                onClick={() => setEntryFilter(null)}
                aria-pressed={entryFilter === null}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase cursor-pointer ${
                  entryFilter === null ? 'bg-[#222222] text-white border-[#222222]' : 'bg-white text-[#1d1c17] border-[#e8e2d8] hover:bg-[#fef9f1]'
                }`}
              >
                All entries
              </button>
              {row.journal_entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setEntryFilter(entry.id)}
                  aria-pressed={entryFilter === entry.id}
                  title={`${entry.status} · ${formatDate(entry.entry_date)} · Dr ${formatAmount(entry.total_debit)} / Cr ${formatAmount(entry.total_credit)}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                    entryFilter === entry.id ? 'bg-[#ae001a] text-white border-[#ae001a]' : 'bg-white text-[#1d1c17] border-[#e8e2d8] hover:bg-[#fef9f1]'
                  }`}
                >
                  {entry.entry_number}
                  <span className={`px-1 rounded border text-[8.5px] uppercase ${ENTRY_STATUS_CLASS[entry.status]}`}>
                    {entry.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!hasEntries ? (
          <p className="text-[11px] text-[#76736a] italic py-6 text-center">
            This receipt has not been posted to the ledger yet — no journal entry lines to drill into.
          </p>
        ) : loading ? (
          <p className="text-[11px] text-[#76736a] py-6 text-center">Loading journal entry lines...</p>
        ) : error ? (
          <p role="alert" className="text-[11px] text-red-700 py-6 text-center">
            {error}
          </p>
        ) : lines && lines.lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" aria-label={`Journal entry lines of ${invoiceLabel(row)}`}>
              <thead>
                <tr className="text-left text-[9.5px] uppercase tracking-wider text-[#5f5e5e] border-b border-[#e8e2d8]">
                  <th className="py-1.5 pr-2">Entry</th>
                  <th className="py-1.5 pr-2">Ledger account</th>
                  <th className="py-1.5 pr-2">Description</th>
                  <th className="py-1.5 pr-2 text-right">Debit</th>
                  <th className="py-1.5 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.lines.map((line) => (
                  <tr
                    key={line.id}
                    className={`border-b border-[#f1ece4] ${line.entry_status === 'VOIDED' ? 'opacity-50' : ''}`}
                  >
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      <span className="font-semibold">{line.entry_number}</span>{' '}
                      <span className={`px-1 rounded border text-[8.5px] uppercase ${ENTRY_STATUS_CLASS[line.entry_status]}`}>
                        {line.entry_status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {line.account ? (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <span className="font-mono text-[10px] text-[#76736a]">#{line.account.id}</span>
                          <span className="font-semibold text-[#1d1c17]">
                            {line.account.code} · {line.account.name}
                          </span>
                          <span className={`px-1 rounded border text-[8.5px] font-bold ${ACCOUNT_TYPE_CLASS[line.account.type]}`}>
                            {line.account.type}
                          </span>
                        </span>
                      ) : (
                        <span className="italic text-[#76736a]">Unknown account</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-[#5f5e5e]">{line.description || '—'}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{line.debit ? formatAmount(line.debit) : '—'}</td>
                    <td className="py-1.5 text-right font-mono">{line.credit ? formatAmount(line.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-[#1d1c17]">
                  <td className="pt-2 pr-2" colSpan={3}>
                    <span className="inline-flex items-center gap-2">
                      Totals ({currency})
                      <BalanceBadge isBalanced={lines.is_balanced} />
                    </span>
                  </td>
                  <td className="pt-2 pr-2 text-right font-mono" data-testid="lines-total-debit">
                    {formatAmount(lines.total_debit)}
                  </td>
                  <td className="pt-2 text-right font-mono" data-testid="lines-total-credit">
                    {formatAmount(lines.total_credit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[#76736a] italic py-6 text-center">The selected entry has no active lines.</p>
        )}
      </section>
    </div>
  );
};

// ─── Grid ──────────────────────────────────────────────────────────────────

export const BillingFinancialSyncGrid: React.FC<BillingFinancialSyncGridProps> = ({ refreshKey = 0 }) => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [postingStatus, setPostingStatus] = useState<StatusFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [result, setResult] = useState<FinancialSyncPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  // The invoice search waits for the user to stop typing.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    if (invalidRange) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFinancialSyncGrid({ page, limit: pageSize, postingStatus, search, dateFrom, dateTo })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the ledger sync grid.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, postingStatus, search, dateFrom, dateTo, invalidRange, refreshKey]);

  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const hasFilters = Boolean(searchInput || postingStatus || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setPostingStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-left">
      {/* Filters */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a] select-none" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              aria-label="Search by invoice number"
              placeholder="Search by invoice number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#e8e2d8] rounded-lg bg-[#fbf8f3] focus:outline-none focus:border-[#ae001a] font-poppins"
            />
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Filter by posting status">
            {STATUS_FILTERS.map((option) => {
              const active = postingStatus === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPostingStatus(option.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide font-poppins cursor-pointer transition-colors ${
                    active ? 'bg-[#ae001a] text-white border-[#ae001a]' : 'bg-white text-[#1d1c17] border-[#e8e2d8] hover:bg-[#fef9f1]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#5f5e5e]">
            <label className="flex items-center gap-1">
              From
              <input
                type="date"
                aria-label="Receipts from date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 border border-[#e8e2d8] rounded-lg bg-white text-xs"
              />
            </label>
            <label className="flex items-center gap-1">
              To
              <input
                type="date"
                aria-label="Receipts to date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 border border-[#e8e2d8] rounded-lg bg-white text-xs"
              />
            </label>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e8e2d8] text-[11px] font-bold uppercase text-[#5f5e5e] hover:bg-[#fef9f1] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                filter_alt_off
              </span>
              Clear filters
            </button>
          )}
        </div>
        {invalidRange && (
          <p role="alert" className="text-[11px] text-red-700 font-semibold">
            The start date must be on or before the end date.
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm overflow-hidden">
        {error && (
          <div role="alert" className="px-4 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              error
            </span>
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Billing to ledger sync grid">
            <thead className="bg-[#f8f3eb] text-[9.5px] uppercase tracking-wider text-[#5f5e5e] font-poppins">
              <tr className="text-left">
                <th className="py-2.5 px-2.5 w-8" aria-label="Expand" />
                <th className="py-2.5 px-2.5">Invoice</th>
                <th className="py-2.5 px-2.5 text-right">Receipt totals</th>
                <th className="py-2.5 px-2.5">Ledger accounts</th>
                <th className="py-2.5 px-2.5 text-right">Debit</th>
                <th className="py-2.5 px-2.5 text-right">Credit</th>
                <th className="py-2.5 px-2.5">Posting status</th>
                <th className="py-2.5 px-2.5">Balance verification</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-12 text-center text-[#76736a] text-xs">
                    Loading ledger sync grid...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <TableEmptyState
                  colSpan={COLUMN_COUNT}
                  icon="receipt_long"
                  title={hasFilters ? 'No receipts match the filters' : 'No receipts yet'}
                  description="Receipts issued by this merchant appear here with their journal entries."
                />
              ) : (
                rows.map((row) => {
                  const expanded = expandedId === row.receipt_id;
                  return (
                    <React.Fragment key={row.receipt_id}>
                      <tr
                        className={`border-t border-[#f1ece4] align-top hover:bg-[#fef9f1] transition-colors ${expanded ? 'bg-[#fef9f1]' : ''} ${loading ? 'opacity-60' : ''}`}
                        data-testid={`sync-row-${row.receipt_id}`}
                      >
                        <td className="py-2.5 px-2.5">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Hide' : 'Show'} journal entry lines of ${invoiceLabel(row)}`}
                            onClick={() => setExpandedId(expanded ? null : row.receipt_id)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f1ece4] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px] text-[#5f5e5e]" aria-hidden="true">
                              {expanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-poppins font-bold text-xs bg-[#222222] text-white px-2 py-0.5 rounded">
                              {invoiceLabel(row)}
                            </span>
                            {row.is_locked && (
                              <span className="material-symbols-outlined text-[14px] text-[#76736a]" title="Fiscally locked" aria-label="Fiscally locked">
                                lock
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#76736a] mt-1">
                            #{row.receipt_id} · {row.type} · {formatDate(row.created_at)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="font-bold text-[#1d1c17] font-mono" data-testid="grand-total">
                            {formatMoney(row.grand_total, row.currency)}
                          </div>
                          <div className="text-[10px] text-[#76736a] font-mono">
                            Tax {formatAmount(row.total_tax)} · Disc {formatAmount(row.total_discount)}
                          </div>
                          <div className="text-[10px] text-[#76736a]">
                            {row.receipt_taxes.length} tax record{row.receipt_taxes.length === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          {row.ledger_accounts.length === 0 ? (
                            <span className="text-[10.5px] italic text-[#76736a]">No ledger accounts</span>
                          ) : (
                            <ul className="flex flex-col gap-0.5" aria-label={`Ledger accounts of ${invoiceLabel(row)}`}>
                              {row.ledger_accounts.map((acc) => (
                                <li key={acc.account_id} className="flex items-center gap-1 text-[10.5px] whitespace-nowrap">
                                  <span className="font-mono text-[#76736a]">#{acc.account_id}</span>
                                  <span className="font-semibold text-[#1d1c17]">{acc.code ?? '—'}</span>
                                  {acc.type && (
                                    <span className={`px-1 rounded border text-[8.5px] font-bold ${ACCOUNT_TYPE_CLASS[acc.type]}`}>
                                      {acc.type}
                                    </span>
                                  )}
                                  <span className="font-mono text-[#5f5e5e]">
                                    {acc.debit ? `Dr ${formatAmount(acc.debit)}` : ''}
                                    {acc.debit && acc.credit ? ' / ' : ''}
                                    {acc.credit ? `Cr ${formatAmount(acc.credit)}` : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono whitespace-nowrap" data-testid="ledger-debit">
                          {row.journal_entries.length ? formatAmount(row.ledger_total_debit) : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono whitespace-nowrap" data-testid="ledger-credit">
                          {row.journal_entries.length ? formatAmount(row.ledger_total_credit) : '—'}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <PostingStatusBadge status={row.posting_status} />
                          {row.journal_entries.length > 0 && (
                            <div className="text-[10px] text-[#76736a] mt-1">
                              {row.journal_entries.length} entr{row.journal_entries.length === 1 ? 'y' : 'ies'}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex flex-col gap-1 items-start">
                            <BalanceBadge isBalanced={row.verification.is_balanced} />
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {VERIFICATION_FLAGS.map((flag) => (
                                <FlagBadge key={flag.key} flag={flag.key} verification={row.verification} />
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={COLUMN_COUNT} className="p-0">
                            <ReceiptLedgerDetail row={row} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-[#e8e2d8]">
          <div className="flex-1">
            <TablePaginationFooter
              currentPage={page}
              totalItems={total}
              pageSize={pageSize}
              totalPages={result?.totalPages}
              onPageChange={setPage}
            />
          </div>
          <label className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-[#5f5e5e]">
            Rows
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-[#e8e2d8] rounded px-1.5 py-1 bg-white text-xs"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default BillingFinancialSyncGrid;
