import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchAllDiscountAuditRows,
  fetchDiscountAuditReport,
  type AllDiscountAuditRows,
} from '../../api/billing-reports-api';
import {
  describeDateRange,
  formatDateTime,
  formatMoney,
  periodRange,
} from '../../lib/billing-reports';
import type {
  DiscountAuditEvent,
  DiscountAuditEventType,
  DiscountAuditFilters,
  DiscountAuditReport as DiscountAuditReportData,
  DiscountAuditRow,
  DiscountAuditSummary,
  ReceiptKind,
} from '../../types/billing-reports';
import {
  REPORT_FIELD_CLASS,
  ReportErrorBanner,
  ReportExportActions,
  ReportFieldLabel,
  ReportFilterButtons,
  ReportKpiCard,
  ReportPeriodFields,
} from './ReportControls';
import { ReportPrintPreview } from './ReportPrintPreview';
import { exportBillingReport, type ReportExportFormat } from './report-export';

interface AuditFilterDraft {
  from: string;
  to: string;
  eventType: DiscountAuditEventType;
  userId: string;
  receiptType: ReceiptKind | '';
  currency: string;
}

const PAGE_SIZES = [25, 50, 100];

function defaultDraft(): AuditFilterDraft {
  return { ...periodRange('this-month'), eventType: 'all', userId: '', receiptType: '', currency: '' };
}

function toFilters(draft: AuditFilterDraft): DiscountAuditFilters {
  const userId = draft.userId.trim() === '' ? null : Number(draft.userId);
  return {
    from: draft.from || undefined,
    to: draft.to || undefined,
    eventType: draft.eventType,
    userId: userId !== null && Number.isInteger(userId) && userId > 0 ? userId : null,
    receiptType: draft.receiptType,
    currency: draft.currency.trim().toUpperCase() || undefined,
  };
}

const EVENT_OPTIONS: Array<{ value: DiscountAuditEventType; label: string; icon: string }> = [
  { value: 'all', label: 'All events', icon: 'rule' },
  { value: 'discount', label: 'Discounts', icon: 'sell' },
  { value: 'void', label: 'Voids', icon: 'block' },
];

const EventBadge: React.FC<{ event: DiscountAuditEvent }> = ({ event }) =>
  event === 'VOID' ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border bg-red-50 text-[#ae001a] border-red-200">
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">block</span>
      Void
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border bg-amber-50 text-amber-800 border-amber-200">
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">sell</span>
      Discount
    </span>
  );

function receiptLabel(row: DiscountAuditRow): string {
  return row.invoice_number || `#${row.receipt_id}`;
}

function userLabel(row: DiscountAuditRow): string {
  if (row.processed_by_user_id === null) return 'Not recorded';
  return row.processed_by_name
    ? `${row.processed_by_name} (User #${row.processed_by_user_id})`
    : `User #${row.processed_by_user_id}`;
}

/** Tabla de la auditoría; `printable` quita controles y compacta tipografía. */
const DiscountAuditTable: React.FC<{
  rows: DiscountAuditRow[];
  summary: DiscountAuditSummary;
  printable?: boolean;
  expandedId?: number | null;
  onToggle?: (receiptId: number) => void;
}> = ({ rows, summary, printable = false, expandedId = null, onToggle }) => {
  const cell = printable ? 'px-2 py-1.5 text-[10px] align-top' : 'px-3 py-2.5 text-xs align-top';
  const head = printable
    ? 'px-2 py-1.5 text-[9px] bg-[#f2ede5] text-[#1d1c17]'
    : 'px-3 py-2.5 text-[10px] bg-[#f7f4ef] text-[#5f5e5e]';
  const columns = printable ? 9 : 10;

  return (
    <table className="w-full border-collapse font-sans font-poppins" aria-label="Discount and void audit trail">
      <thead>
        <tr className="text-left uppercase tracking-wider font-bold">
          {!printable && <th scope="col" className={head} aria-label="Details" />}
          <th scope="col" className={head}>Date</th>
          <th scope="col" className={head}>Receipt</th>
          <th scope="col" className={head}>Event</th>
          <th scope="col" className={head}>Processed by</th>
          <th scope="col" className={head}>Order snapshot</th>
          <th scope="col" className={`${head} text-right`}>Original subtotal</th>
          <th scope="col" className={`${head} text-right`}>Discount applied</th>
          <th scope="col" className={`${head} text-right`}>Final total</th>
          <th scope="col" className={head}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isExpanded = !printable && expandedId === row.receipt_id;
          return (
            <React.Fragment key={row.receipt_id}>
              <tr className="border-t border-[#f0ede6] text-[#1d1c17]" data-testid={`audit-row-${row.receipt_id}`}>
                {!printable && (
                  <td className={cell}>
                    <button
                      type="button"
                      onClick={() => onToggle?.(row.receipt_id)}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} order snapshot of ${receiptLabel(row)}`}
                      className="w-6 h-6 rounded hover:bg-[#f2ede5] text-[#5f5e5e] hover:text-[#ae001a] flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </td>
                )}
                <td className={`${cell} whitespace-nowrap`}>{formatDateTime(row.created_at)}</td>
                <td className={cell}>
                  <div className="font-bold">{receiptLabel(row)}</div>
                  <div className="text-[10px] text-[#76736a]">
                    {row.receipt_type} · Order #{row.order_id}
                  </div>
                </td>
                <td className={cell}>
                  <div className="flex flex-wrap gap-1">
                    {row.events.map((event) =>
                      printable ? <span key={event}>{event}</span> : <EventBadge key={event} event={event} />,
                    )}
                  </div>
                </td>
                <td className={cell}>
                  <div className="font-semibold">{userLabel(row)}</div>
                  {row.processed_by_role && (
                    <div className="text-[10px] text-[#76736a] uppercase">{row.processed_by_role}</div>
                  )}
                </td>
                <td className={`${cell} max-w-[260px]`}>
                  {row.snapshot ? (
                    <>
                      <div className="font-semibold">
                        {row.snapshot.order_number ? `Order ${row.snapshot.order_number}` : `Order #${row.order_id}`}
                      </div>
                      <div className="text-[10px] text-[#5f5e5e] truncate" title={row.snapshot.items_summary}>
                        {row.snapshot.items_summary || `${row.snapshot.item_count} items`}
                      </div>
                      {row.snapshot.payment_methods && (
                        <div className="text-[10px] text-[#76736a]">Paid: {row.snapshot.payment_methods}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-[#76736a]">No snapshot</span>
                  )}
                </td>
                <td className={`${cell} text-right tabular-nums`}>{formatMoney(row.original_subtotal, row.currency)}</td>
                <td className={`${cell} text-right tabular-nums font-bold text-[#ae001a]`}>
                  {formatMoney(row.discount_applied, row.currency)}
                  {row.discount_pct !== null && row.discount_applied > 0 && (
                    <div className="text-[10px] font-semibold text-[#76736a]">{row.discount_pct.toFixed(2)}%</div>
                  )}
                </td>
                <td className={`${cell} text-right tabular-nums font-bold`}>{formatMoney(row.final_total, row.currency)}</td>
                <td className={cell}>
                  <div className={`text-[10px] font-bold uppercase ${row.is_active ? 'text-emerald-700' : 'text-[#ae001a]'}`}>
                    {row.is_active ? 'Active' : 'Voided'}
                  </div>
                  {row.is_locked && <div className="text-[10px] text-[#76736a]">Locked</div>}
                </td>
              </tr>
              {isExpanded && (
                <tr className="bg-[#fcfcfb]" data-testid={`audit-details-${row.receipt_id}`}>
                  <td colSpan={columns} className="px-6 py-3">
                    <SnapshotDetails row={row} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
      {summary.by_currency.length > 0 && (
        <tfoot className="border-t-2 border-[#1d1c17]">
          {summary.by_currency.map((total) => (
            <tr key={total.currency} className="bg-[#1d1c17] text-white font-bold" data-testid={`audit-total-${total.currency}`}>
              <th scope="row" colSpan={printable ? 5 : 6} className={`${cell} text-left uppercase tracking-wider`}>
                Total {total.currency} · {total.receipts} receipts (all pages)
              </th>
              <td className={`${cell} text-right tabular-nums`}>{formatMoney(total.original_subtotal, total.currency)}</td>
              <td className={`${cell} text-right tabular-nums`}>{formatMoney(total.discount_applied, total.currency)}</td>
              <td className={`${cell} text-right tabular-nums`}>{formatMoney(total.final_total, total.currency)}</td>
              <td className={cell} />
            </tr>
          ))}
        </tfoot>
      )}
    </table>
  );
};

const SnapshotDetails: React.FC<{ row: DiscountAuditRow }> = ({ row }) => {
  const snapshot = row.snapshot;
  const items = Array.isArray(row.order_snapshot?.items) ? (row.order_snapshot?.items as unknown[]) : [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#1d1c17]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Order</dt>
        <dd>{snapshot?.order_number ?? `#${snapshot?.order_id ?? row.order_id}`}</dd>
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Snapshot subtotal</dt>
        <dd>{snapshot?.subtotal !== null && snapshot?.subtotal !== undefined ? formatMoney(snapshot.subtotal, row.currency) : '—'}</dd>
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Snapshot discount</dt>
        <dd>
          {snapshot?.discount_total !== null && snapshot?.discount_total !== undefined
            ? formatMoney(snapshot.discount_total, row.currency)
            : '—'}
        </dd>
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Snapshot total</dt>
        <dd>{snapshot?.total !== null && snapshot?.total !== undefined ? formatMoney(snapshot.total, row.currency) : '—'}</dd>
      </dl>
      <div>
        <div className="text-[10px] font-bold uppercase text-[#5f5e5e] mb-1">Items ({snapshot?.item_count ?? 0})</div>
        {items.length > 0 ? (
          <ul className="list-disc pl-4 space-y-0.5">
            {items.slice(0, 20).map((item, index) => {
              const record = (item ?? {}) as Record<string, unknown>;
              const name = String(record.productName ?? record.product_name ?? record.name ?? `Product #${String(record.product_id ?? '?')}`);
              return (
                <li key={index}>
                  {String(record.quantity ?? record.qty ?? 1)} x {name}
                  {record.notes ? <span className="text-[#76736a]"> — {String(record.notes)}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[#76736a]">{snapshot?.items_summary || 'No items recorded'}</p>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Payments</dt>
        <dd>{snapshot?.payment_methods || '—'}</dd>
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Total tax</dt>
        <dd>{formatMoney(row.total_tax, row.currency)}</dd>
        <dt className="text-[10px] font-bold uppercase text-[#5f5e5e]">Last update</dt>
        <dd>{formatDateTime(row.updated_at)}</dd>
      </dl>
    </div>
  );
};

export const DiscountAuditReport: React.FC = () => {
  const [draft, setDraft] = useState<AuditFilterDraft>(defaultDraft);
  const [applied, setApplied] = useState<DiscountAuditFilters>(() => toFilters(defaultDraft()));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [report, setReport] = useState<DiscountAuditReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<AllDiscountAuditRows | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const load = useCallback(async (filters: DiscountAuditFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await fetchDiscountAuditReport(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the discount audit report.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ ...applied, page, limit });
  }, [applied, page, limit, load]);

  const applyFilters = (next: DiscountAuditFilters) => {
    setPage(1);
    setExpandedId(null);
    setApplied(next);
  };

  const handleExport = async (format: ReportExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const fileName = await exportBillingReport('discount-audit', applied, format);
      setNotice(`Downloaded ${fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the report.');
    } finally {
      setExporting(null);
    }
  };

  const openPrint = async () => {
    setIsPrintOpen(true);
    setPrintData(null);
    try {
      setPrintData(await fetchAllDiscountAuditRows(applied));
    } catch (err) {
      setIsPrintOpen(false);
      setError(err instanceof Error ? err.message : 'Failed to prepare the printable report.');
    }
  };

  const summary = report?.summary;
  const single = summary && summary.by_currency.length === 1 ? summary.by_currency[0] : null;
  const mixed = (summary?.by_currency.length ?? 0) > 1;
  const money = (pick: (t: NonNullable<typeof single>) => number) =>
    isLoading ? '...' : single ? formatMoney(pick(single), single.currency) : mixed ? 'Mixed' : '0.00';

  return (
    <section aria-label="Discount and void audit report" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5 w-full min-w-0">
        <ReportKpiCard icon="fact_check" label="Flagged receipts" tone="zinc" badge="AUDIT" value={isLoading ? '...' : (summary?.receipts ?? 0)} />
        <ReportKpiCard icon="sell" label="Discounted" tone="amber" badge="DISCOUNT" value={isLoading ? '...' : (summary?.discounted_receipts ?? 0)} />
        <ReportKpiCard icon="block" label="Voided" tone="red" badge="VOID" value={isLoading ? '...' : (summary?.voided_receipts ?? 0)} />
        <ReportKpiCard icon="price_change" label="Discount applied" tone="purple" badge="TOTAL" value={money((t) => t.discount_applied)} />
        <ReportKpiCard icon="payments" label="Final total" tone="emerald" badge="BILLED" value={money((t) => t.final_total)} />
      </div>

      <form
        className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3"
        aria-label="Discount audit filters"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(toFilters(draft));
        }}
      >
        <div className="flex items-center h-[36px] bg-[#f2ede5] p-0.5 rounded-lg border border-[#e8e2d8] self-start" role="radiogroup" aria-label="Event type">
          {EVENT_OPTIONS.map((option) => {
            const active = draft.eventType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  const next = { ...draft, eventType: option.value };
                  setDraft(next);
                  applyFilters(toFilters(next));
                }}
                className={`h-full px-3.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  active ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]' : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${active ? 'text-[#ae001a]' : ''}`} aria-hidden="true">
                  {option.icon}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-[#f0ede6]">
          <ReportPeriodFields
            idPrefix="audit"
            from={draft.from}
            to={draft.to}
            onChange={(range) => setDraft((d) => ({ ...d, ...range }))}
          />
          <div className="flex flex-col gap-1">
            <ReportFieldLabel htmlFor="audit-user">User ID</ReportFieldLabel>
            <input
              id="audit-user"
              type="number"
              min={1}
              step={1}
              placeholder="Any"
              value={draft.userId}
              onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))}
              className={`${REPORT_FIELD_CLASS} w-24`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <ReportFieldLabel htmlFor="audit-receipt-type">Receipt type</ReportFieldLabel>
            <select
              id="audit-receipt-type"
              value={draft.receiptType}
              onChange={(e) => setDraft((d) => ({ ...d, receiptType: e.target.value as ReceiptKind | '' }))}
              className={`${REPORT_FIELD_CLASS} cursor-pointer`}
            >
              <option value="">All types</option>
              <option value="INVOICE">Invoice</option>
              <option value="RECEIPT">Receipt</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <ReportFieldLabel htmlFor="audit-currency">Currency</ReportFieldLabel>
            <input
              id="audit-currency"
              type="text"
              placeholder="All"
              maxLength={10}
              value={draft.currency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
              className={`${REPORT_FIELD_CLASS} w-20 uppercase`}
            />
          </div>
          <ReportFilterButtons
            isLoading={isLoading}
            onReset={() => {
              const next = defaultDraft();
              setDraft(next);
              applyFilters(toFilters(next));
            }}
          />
        </div>
      </form>

      {error && <ReportErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && !error && (
        <p role="status" className="text-[11px] font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
        <div className="bg-[#222222] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#333333]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-[#ae001a] text-xl select-none" aria-hidden="true">
              fact_check
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Discount & void audit trail</span>
            <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
              {describeDateRange(applied)}
            </span>
          </div>
          <ReportExportActions
            busy={exporting}
            disabled={isLoading || !report}
            onExport={(format) => void handleExport(format)}
            onPrint={() => void openPrint()}
          />
        </div>

        {isLoading ? (
          <div className="py-14 text-center text-xs text-[#5f5e5e]" role="status">
            Loading audit trail…
          </div>
        ) : report && report.data.length > 0 ? (
          <div className="overflow-x-auto">
            <DiscountAuditTable
              rows={report.data}
              summary={report.summary}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
            />
          </div>
        ) : (
          <div className="py-14 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[36px] text-[#d5cfc4]" aria-hidden="true">
              verified
            </span>
            <p className="text-sm font-bold text-[#1d1c17]">No discounted or voided receipts for these filters</p>
          </div>
        )}

        {report && report.total > 0 && (
          <div className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0ede6] bg-[#fcfcfb] text-xs text-[#5f5e5e]">
            <span>
              Page {report.page} of {Math.max(report.totalPages, 1)} · {report.total} receipts
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="audit-page-size" className="text-[10px] font-bold uppercase">
                Rows
              </label>
              <select
                id="audit-page-size"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-1.5 rounded border border-[#d5cfc4] bg-white text-xs cursor-pointer"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!report.hasPrev || isLoading}
                className="h-7 px-2.5 rounded border border-[#d5cfc4] bg-white font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!report.hasNext || isLoading}
                className="h-7 px-2.5 rounded border border-[#d5cfc4] bg-white font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isPrintOpen && (
        <ReportPrintPreview
          title="Discount & Void Audit Trail"
          subtitle="Receipts with discounts applied or voided (is_active = false), with the user who processed them."
          meta={[
            { label: 'Period', value: describeDateRange(applied) },
            { label: 'Events', value: EVENT_OPTIONS.find((o) => o.value === (applied.eventType ?? 'all'))?.label ?? 'All events' },
            { label: 'User', value: applied.userId ? `#${applied.userId}` : 'All' },
            { label: 'Receipt type', value: applied.receiptType || 'All' },
            { label: 'Receipts', value: printData ? String(printData.total) : '…' },
            { label: 'Generated', value: formatDateTime(new Date().toISOString()) },
          ]}
          isLoading={!printData}
          notice={
            printData?.truncated
              ? `Showing the first ${printData.rows.length} of ${printData.total} receipts. Export CSV for the complete list.`
              : null
          }
          onClose={() => setIsPrintOpen(false)}
        >
          {printData && printData.rows.length > 0 ? (
            <DiscountAuditTable rows={printData.rows} summary={printData.summary} printable />
          ) : (
            <p className="text-sm text-[#5f5e5e]">No discounted or voided receipts for these filters.</p>
          )}
        </ReportPrintPreview>
      )}
    </section>
  );
};

export default DiscountAuditReport;
