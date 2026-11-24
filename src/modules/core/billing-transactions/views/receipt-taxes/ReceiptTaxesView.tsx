import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmStatusToggleDialog } from '@/shared/components/StatusToggle';
import { Toast, type ToastState } from '@/shared/components/Toast';
import {
  createReceiptTax,
  fetchReceiptTaxes,
  fetchReceiptTaxesSummary,
  setReceiptTaxStatus,
  updateReceiptTax,
} from '../../api/receipt-taxes-api';
import type {
  CreateReceiptTaxPayload,
  ReceiptTax,
  ReceiptTaxScope,
  ReceiptTaxStatusFilter,
  ReceiptTaxesSummary,
  UpdateReceiptTaxPayload,
} from '../../types/receipt-taxes';
import { FiscalLockBadge } from '../receipts/ReceiptFiscalBadges';
import { ReceiptTaxFormDrawer, type ReceiptTaxFormPayload } from './ReceiptTaxFormDrawer';
import { ReceiptTaxesHeader } from './ReceiptTaxesHeader';
import {
  SCOPE_BADGE_CLASSES,
  SCOPE_ICONS,
  SCOPE_LABELS,
  formatMoney,
  formatRate,
  formatTaxDate,
  receiptLabel,
} from './receiptTaxesHelpers';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const SELECT_CLASS =
  'h-[36px] px-3 bg-[#fcfcfb] border border-[#d5cfc4] rounded-lg text-xs font-medium text-[#1d1c17] focus:border-[#ae001a] outline-none cursor-pointer font-poppins';
const TH_CLASS = 'px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] font-poppins';

type DrawerState = { mode: 'create' } | { mode: 'edit'; tax: ReceiptTax } | null;

/** "INV-000010 totals updated: tax 23.75 USD · grand total 148.75 USD" */
function totalsSummary(tax: ReceiptTax): string {
  const label = receiptLabel({ id: tax.receipt_id, invoice_number: tax.receipt_invoice_number });
  if (tax.receipt_total_tax === null || tax.receipt_grand_total === null) return `${label} totals updated.`;
  return `${label} totals updated: tax ${formatMoney(tax.receipt_total_tax, tax.currency)} · grand total ${formatMoney(tax.receipt_grand_total, tax.currency)}.`;
}

/**
 * Receipt Taxes workspace (Billing & Transactions). The bottom NavHubBar of the module is
 * mounted by MerchantFrame (ModuleNavHubBar) for every feature of the billing hub, with
 * RECEIPTS TAXES active; this view adds the in-flow Quick Launch to the sibling screens.
 */
export const ReceiptTaxesView: React.FC = () => {
  const [rows, setRows] = useState<ReceiptTax[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'' | ReceiptTaxScope>('');
  const [statusFilter, setStatusFilter] = useState<ReceiptTaxStatusFilter>('all');
  // Header filters (tax type / applied rate): apply to the metrics and to the grid.
  const [taxNameFilter, setTaxNameFilter] = useState('');
  const [rateFilter, setRateFilter] = useState('');

  const [summary, setSummary] = useState<ReceiptTaxesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<ReceiptTax | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  // Debounced search: the name filter runs on the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadTaxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReceiptTaxes({
        page,
        limit: PAGE_SIZE,
        name: search || undefined,
        scope: scopeFilter || undefined,
        status: statusFilter,
        taxName: taxNameFilter || undefined,
        rate: rateFilter === '' ? undefined : Number(rateFilter),
      });
      setRows(result.data);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt taxes.');
    } finally {
      setLoading(false);
    }
  }, [page, search, scopeFilter, statusFilter, taxNameFilter, rateFilter]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(
        await fetchReceiptTaxesSummary({
          taxName: taxNameFilter || undefined,
          rate: rateFilter === '' ? undefined : Number(rateFilter),
        }),
      );
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load receipt tax metrics.');
    } finally {
      setSummaryLoading(false);
    }
  }, [taxNameFilter, rateFilter]);

  useEffect(() => {
    void Promise.resolve().then(loadTaxes);
  }, [loadTaxes]);

  useEffect(() => {
    void Promise.resolve().then(loadSummary);
  }, [loadSummary]);

  const hasActiveFilter = Boolean(
    search || scopeFilter || statusFilter !== 'all' || taxNameFilter || rateFilter,
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setScopeFilter('');
    setStatusFilter('all');
    setTaxNameFilter('');
    setRateFilter('');
    setPage(1);
  };

  const openDrawer = (state: Exclude<DrawerState, null>) => {
    setFormError(null);
    setDrawer(state);
  };

  const handleFormSubmit = async (payload: ReceiptTaxFormPayload) => {
    if (!drawer) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      const saved =
        drawer.mode === 'create'
          ? await createReceiptTax(payload as CreateReceiptTaxPayload)
          : await updateReceiptTax(drawer.tax.id, payload as UpdateReceiptTaxPayload);
      setToast({
        message: `Receipt tax ${drawer.mode === 'create' ? 'created' : 'updated'}. ${totalsSummary(saved)}`,
        type: 'success',
      });
      setDrawer(null);
      await Promise.all([loadTaxes(), loadSummary()]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save receipt tax.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmStatus = async () => {
    if (!statusTarget) return;
    const nextActive = !statusTarget.is_active;
    setStatusSubmitting(true);
    try {
      const updated = await setReceiptTaxStatus(statusTarget.id, nextActive);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setToast({
        message: `${
          nextActive
            ? 'Receipt tax activated. It counts again in the receipt totals.'
            : 'Receipt tax deactivated. Excluded from the receipt totals; the record is kept.'
        } ${totalsSummary(updated)}`,
        type: 'success',
      });
      setStatusTarget(null);
      await Promise.all([statusFilter !== 'all' ? loadTaxes() : Promise.resolve(), loadSummary()]);
    } catch (err: unknown) {
      setStatusTarget(null);
      setToast({ message: err instanceof Error ? err.message : 'Failed to change status.', type: 'error' });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-4">
      <ReceiptTaxesHeader
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        taxName={taxNameFilter}
        rate={rateFilter}
        onTaxNameChange={(value) => {
          setTaxNameFilter(value);
          setPage(1);
        }}
        onRateChange={(value) => {
          setRateFilter(value);
          setPage(1);
        }}
        onRetry={() => void loadSummary()}
      />

      {/* Toolbar */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a]" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by tax name..."
              aria-label="Search receipt taxes"
              className="h-[36px] w-full pl-9 pr-3 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17] font-poppins"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTaxes()}
              className="h-[36px] w-[36px] bg-white border border-[#e8e2d8] rounded-lg hover:bg-[#fef9f1] hover:text-[#ae001a] transition-colors flex items-center justify-center"
              title="Reload table data"
              aria-label="Reload table data"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            </button>
            <button
              type="button"
              onClick={() => openDrawer({ mode: 'create' })}
              className="h-[36px] px-4 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
              New Receipt Tax
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scopeFilter}
            onChange={(e) => {
              setScopeFilter(e.target.value as '' | ReceiptTaxScope);
              setPage(1);
            }}
            aria-label="Filter by scope"
            className={SELECT_CLASS}
          >
            <option value="">All scopes</option>
            <option value="RECEIPT">Receipt scope</option>
            <option value="ITEM">Item scope</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReceiptTaxStatusFilter);
              setPage(1);
            }}
            aria-label="Filter by status"
            className={SELECT_CLASS}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-[34px] px-3 rounded-lg text-xs font-semibold text-[#ae001a] hover:bg-red-50 border border-red-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#222222] flex justify-between items-center">
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">Receipt Tax Lines</span>
          <span className="text-white/60 text-xs">{loading ? 'Loading...' : `${total} tax lines`}</span>
        </div>
        {error ? (
          <div className="p-8 text-center" role="alert">
            <span className="material-symbols-outlined text-red-500 text-4xl" aria-hidden="true">error</span>
            <p className="mt-2 text-red-700 font-medium text-sm">{error}</p>
            <button
              type="button"
              onClick={() => void loadTaxes()}
              className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className={`${TH_CLASS} text-left`}>Tax</th>
                  <th className={`${TH_CLASS} text-left`}>Scope</th>
                  <th className={`${TH_CLASS} text-left`}>Receipt</th>
                  <th className={`${TH_CLASS} text-right`}>Rate</th>
                  <th className={`${TH_CLASS} text-right`}>Amount</th>
                  <th className={`${TH_CLASS} text-center`}>Status</th>
                  <th className={`${TH_CLASS} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8] text-sm">
                {loading && rows.length === 0 ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <td key={c} className="px-4 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3" data-testid="receipt-taxes-empty">
                        <span className="material-symbols-outlined text-[#d51f2c] text-5xl" aria-hidden="true">
                          {hasActiveFilter ? 'search_off' : 'percent'}
                        </span>
                        <p className="text-sm text-[#5f5e5e] max-w-md">
                          {hasActiveFilter
                            ? 'No receipt taxes match the active filters.'
                            : 'No taxes recorded on receipts yet. Add one to apply a rate over a receipt or one of its items.'}
                        </p>
                        {hasActiveFilter ? (
                          <button type="button" onClick={clearFilters} className="text-[#ae001a] text-sm font-semibold hover:underline">
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((tax) => (
                    <tr
                      key={tax.id}
                      data-testid={`receipt-tax-row-${tax.id}`}
                      className={`hover:bg-[#f8f3eb] transition-colors ${tax.is_active ? '' : 'opacity-60'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1d1c17]">{tax.name}</div>
                        <div className="text-[11px] text-[#8c857b]">
                          #{tax.id} · {formatTaxDate(tax.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          data-testid={`receipt-tax-scope-${tax.id}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${SCOPE_BADGE_CLASSES[tax.scope]}`}
                        >
                          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                            {SCOPE_ICONS[tax.scope]}
                          </span>
                          {SCOPE_LABELS[tax.scope]}
                        </span>
                        <div className="text-[11px] text-[#5f5e5e] mt-1 truncate max-w-[220px]">
                          {tax.scope === 'ITEM'
                            ? `Item: ${tax.receipt_item_name ?? `#${tax.receipt_item_id}`}`
                            : 'Whole receipt subtotal'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#1d1c17]">
                        <div className="flex items-center gap-1">
                          {tax.receipt_is_locked && (
                            <span
                              className="material-symbols-outlined text-[14px] text-amber-700"
                              aria-label="Locked receipt"
                              role="img"
                            >
                              lock
                            </span>
                          )}
                          {receiptLabel({ id: tax.receipt_id, invoice_number: tax.receipt_invoice_number })}
                        </div>
                        {tax.receipt_grand_total !== null && (
                          <div className="text-[11px] text-[#8c857b]">
                            Total {formatMoney(tax.receipt_grand_total, tax.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[13px]">{formatRate(tax.rate)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-[#1d1c17]">
                        {formatMoney(tax.amount, tax.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            tax.is_active ? 'bg-green-500/10 text-green-700' : 'bg-zinc-500/10 text-zinc-600'
                          }`}
                        >
                          {tax.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {tax.receipt_is_locked ? (
                            // Historia 11: los impuestos de un recibo bloqueado no se editan ni se desactivan.
                            <FiscalLockBadge
                              testId={`receipt-tax-locked-${tax.id}`}
                              title="The receipt is fiscally locked: issue a credit / debit note to correct it"
                            />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openDrawer({ mode: 'edit', tax })}
                                disabled={!tax.is_active}
                                aria-label={`Edit ${tax.name}`}
                                title={tax.is_active ? 'Edit tax' : 'Activate the tax before editing it'}
                                className="w-8 h-8 rounded flex items-center justify-center text-[#8c857b] hover:text-[#ae001a] hover:bg-[#f2ede5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatusTarget(tax)}
                                aria-label={`${tax.is_active ? 'Deactivate' : 'Activate'} ${tax.name}`}
                                title={tax.is_active ? 'Deactivate (kept for history)' : 'Activate'}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                  tax.is_active
                                    ? 'text-[#8c857b] hover:text-red-600 hover:bg-red-50'
                                    : 'text-[#8c857b] hover:text-green-600 hover:bg-green-50'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  {tax.is_active ? 'block' : 'check_circle'}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!error && total > 0 && (
          <div className="px-4 py-3 border-t border-[#e8e2d8] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5f5e5e]">
            <span>
              Showing {firstRow}–{lastRow} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 border border-[#e8e2d8] rounded hover:bg-[#f2ede5] disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 border border-[#e8e2d8] rounded hover:bg-[#f2ede5] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <ReceiptTaxFormDrawer
          mode={drawer.mode}
          initialTax={drawer.mode === 'edit' ? drawer.tax : null}
          submitting={formSubmitting}
          submitError={formError}
          onCancel={() => setDrawer(null)}
          onSubmit={(payload) => void handleFormSubmit(payload)}
        />
      )}

      {statusTarget && (
        <ConfirmStatusToggleDialog
          entityName={statusTarget.name}
          direction={statusTarget.is_active ? 'deactivate' : 'activate'}
          submitting={statusSubmitting}
          onConfirm={() => void handleConfirmStatus()}
          onClose={() => setStatusTarget(null)}
          description={
            statusTarget.is_active
              ? `Deactivating "${statusTarget.name}" removes ${formatMoney(statusTarget.amount, statusTarget.currency)} from the totals of ${receiptLabel({ id: statusTarget.receipt_id, invoice_number: statusTarget.receipt_invoice_number })}. The tax record and its amount are kept for audit and it can be activated again.`
              : `Activating "${statusTarget.name}" adds its recorded amount of ${formatMoney(statusTarget.amount, statusTarget.currency)} back to the totals of ${receiptLabel({ id: statusTarget.receipt_id, invoice_number: statusTarget.receipt_invoice_number })}.`
          }
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ReceiptTaxesView;
