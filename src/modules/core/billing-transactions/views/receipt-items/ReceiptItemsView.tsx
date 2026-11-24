import React, { useCallback, useEffect, useState } from 'react';
import { AppModal } from '@/shared/components/AppModal';
import { Toast, type ToastState } from '@/shared/components/Toast';
import {
  createReceiptItem,
  deleteReceiptItem,
  fetchReceiptItemOptions,
  fetchReceiptItems,
  fetchReceiptOptions,
  restoreReceiptItem,
  updateReceiptItem,
} from '@/modules/core/billing-transactions/api/receipt-items-api';
import {
  DEFAULT_RECEIPT_ITEM_FILTERS,
  filtersToQuery,
  hasActiveFilters,
  type ReceiptItemFilters,
} from '@/modules/core/billing-transactions/lib/receipt-item-filters';
import {
  formatMoney,
  formatQuantity,
} from '@/modules/core/billing-transactions/lib/receipt-item-math';
import type {
  ReceiptItem,
  ReceiptItemOption,
  ReceiptOption,
} from '@/modules/core/billing-transactions/types/receipt-items';
import { FiscalLockBadge } from '../receipts/ReceiptFiscalBadges';
import {
  ReceiptItemFormDrawer,
  type ReceiptItemFormSubmit,
} from './ReceiptItemFormDrawer';
import { ReceiptItemsHeader } from './ReceiptItemsHeader';

export const RECEIPT_ITEMS_PAGE_SIZE = 20;
/** Debounce of the description/SKU search before hitting the API. */
export const RECEIPT_ITEMS_SEARCH_DEBOUNCE_MS = 300;

type FormDrawerState = { mode: 'create' } | { mode: 'edit'; item: ReceiptItem } | null;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const thClass = 'px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins whitespace-nowrap';

export const ReceiptItemsView: React.FC = () => {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [filters, setFilters] = useState<ReceiptItemFilters>(DEFAULT_RECEIPT_ITEM_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [itemOptions, setItemOptions] = useState<ReceiptItemOption[]>([]);
  const [optionsTick, setOptionsTick] = useState(0);

  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ReceiptItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);
  /** After a mutation: reload the grid and the item selector (line counts change). */
  const reloadAll = useCallback(() => {
    setReloadTick((t) => t + 1);
    setOptionsTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), RECEIPT_ITEMS_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.search]);

  const { status: statusFilter, item: itemFilter, receiptId: receiptFilter } = filters;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchReceiptItems({
          ...filtersToQuery({
            search: debouncedSearch,
            item: itemFilter,
            receiptId: receiptFilter,
            status: statusFilter,
          }),
          page,
          limit: RECEIPT_ITEMS_PAGE_SIZE,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        });
        if (cancelled) return;
        // Deleting the last line of the last page leaves the page out of range: step back.
        if (res.totalPages > 0 && page > res.totalPages) {
          setPage(res.totalPages);
          return;
        }
        setItems(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(errorMessage(err, 'Failed to load receipt items.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick, debouncedSearch, itemFilter, receiptFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const options = await fetchReceiptOptions();
        if (!cancelled) setReceipts(options);
      } catch {
        if (!cancelled) setReceipts([]);
      } finally {
        if (!cancelled) setReceiptsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const options = await fetchReceiptItemOptions();
        if (!cancelled) setItemOptions(options);
      } catch {
        if (!cancelled) setItemOptions([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [optionsTick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const changeFilters = (next: ReceiptItemFilters) => {
    setFilters(next);
    setPage(1);
  };

  const resetFilters = () => changeFilters(DEFAULT_RECEIPT_ITEM_FILTERS);

  const filtered = hasActiveFilters(filters);

  const openCreate = () => {
    setFormError(null);
    setFormDrawer({ mode: 'create' });
  };

  const openEdit = (item: ReceiptItem) => {
    setFormError(null);
    setFormDrawer({ mode: 'edit', item });
  };

  const handleFormSubmit = async (submit: ReceiptItemFormSubmit) => {
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (submit.mode === 'create') {
        const created = await createReceiptItem(submit.payload);
        setToast({ type: 'success', message: `Line "${created.name}" added. Receipt totals recalculated.` });
        setPage(1);
      } else {
        const updated = await updateReceiptItem(submit.id, submit.payload);
        setToast({ type: 'success', message: `Line "${updated.name}" updated. Receipt totals recalculated.` });
      }
      setFormDrawer(null);
      reloadAll();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save the receipt item.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReceiptItem(deleteTarget.id);
      setToast({ type: 'success', message: `Line "${deleteTarget.name}" deleted. Receipt totals recalculated.` });
      setDeleteTarget(null);
      reloadAll();
    } catch (err) {
      setToast({ type: 'error', message: errorMessage(err, 'Failed to delete the receipt item.') });
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item: ReceiptItem) => {
    setRestoringId(item.id);
    try {
      await restoreReceiptItem(item.id);
      setToast({ type: 'success', message: `Line "${item.name}" restored. Receipt totals recalculated.` });
      reloadAll();
    } catch (err) {
      setToast({ type: 'error', message: errorMessage(err, 'Failed to restore the receipt item.') });
    } finally {
      setRestoringId(null);
    }
  };

  const receiptLabel = (item: ReceiptItem) => item.receipt_invoice_number ?? `Receipt #${item.receipt_id}`;

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-6">
      <ReceiptItemsHeader
        filters={filters}
        onFiltersChange={changeFilters}
        onReset={resetFilters}
        itemOptions={itemOptions}
        receipts={receipts}
        optionsLoading={receiptsLoading}
      />

      {/* Grid */}
      <section
        aria-label="Receipt line items"
        className="bg-white border border-[#e8e2d8] rounded-xl overflow-hidden shadow-sm"
      >
        <div className="px-4 py-3 bg-[#222222] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">Receipt line items</span>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-xs" data-testid="receipt-items-count">
              {loading ? 'Loading…' : `${total} ${total === 1 ? 'line' : 'lines'}`}
            </span>
            <button
              type="button"
              onClick={reload}
              className="text-white/70 hover:text-white transition-colors flex items-center"
              aria-label="Reload receipt items"
              title="Reload"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                refresh
              </span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 rounded"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              Add line item
            </button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="p-10 flex flex-col items-center text-center gap-3">
            <span className="material-symbols-outlined text-red-500 text-4xl" aria-hidden="true">
              error
            </span>
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="px-4 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors rounded"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th scope="col" className={`${thClass} text-left`}>Item / SKU</th>
                  <th scope="col" className={`${thClass} text-left`}>Receipt</th>
                  <th scope="col" className={`${thClass} text-right`}>Qty</th>
                  <th scope="col" className={`${thClass} text-right`}>Unit price</th>
                  <th scope="col" className={`${thClass} text-right`}>Subtotal</th>
                  <th scope="col" className={`${thClass} text-right`}>Discount</th>
                  <th scope="col" className={`${thClass} text-right`}>Total</th>
                  <th scope="col" className={`${thClass} text-center`}>Status</th>
                  <th scope="col" className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede6]">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, c) => (
                        <td key={c} className="px-4 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-14 text-center">
                      {filtered ? (
                        <div className="flex flex-col items-center gap-3" data-testid="receipt-items-filtered-empty">
                          <span className="material-symbols-outlined text-[#5f5e5e] text-4xl" aria-hidden="true">
                            search_off
                          </span>
                          <p className="text-sm text-[#5f5e5e]">No receipt line items match the active filters.</p>
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="text-[#ae001a] text-sm font-semibold hover:underline"
                          >
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3" data-testid="receipt-items-empty">
                          <span className="material-symbols-outlined text-[#d51f2c] text-5xl" aria-hidden="true">
                            receipt_long
                          </span>
                          <p className="text-sm text-[#5f5e5e] max-w-md">
                            No receipt line items yet. Add the first line to break down a receipt.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`receipt-item-row-${item.id}`}
                      className={`transition-colors hover:bg-[#fdf6f6] ${item.is_active ? '' : 'opacity-60'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1d1c17]">{item.name}</div>
                        <div className="text-[11px] text-[#76736a] font-mono">{item.sku ?? 'No SKU'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase px-2 py-0.5 rounded bg-[#5f5e5e]/10 text-[#5f5e5e]">
                          {item.receipt_is_locked && (
                            <span
                              className="material-symbols-outlined text-[12px] text-amber-700"
                              aria-label="Locked receipt"
                              role="img"
                            >
                              lock
                            </span>
                          )}
                          {receiptLabel(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" data-testid={`receipt-item-qty-${item.id}`}>
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap" data-testid={`receipt-item-unit-price-${item.id}`}>
                        {formatMoney(item.unit_price, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {formatMoney(item.subtotal, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[#5f5e5e]">
                        {item.discount_amount > 0 ? `− ${formatMoney(item.discount_amount, item.currency)}` : formatMoney(0, item.currency)}
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-bold text-[#1d1c17]"
                        data-testid={`receipt-item-total-${item.id}`}
                      >
                        {formatMoney(item.total, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {item.is_active ? 'Active' : 'Deleted'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {item.receipt_is_locked ? (
                            // Historia 11: las líneas de un recibo bloqueado no se editan ni se borran.
                            <FiscalLockBadge
                              testId={`receipt-item-locked-${item.id}`}
                              title="The receipt is fiscally locked: issue a credit / debit note to correct it"
                            />
                          ) : item.is_active ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                aria-label={`Edit ${item.name}`}
                                title="Edit line"
                                className="p-1.5 rounded text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#fef9f1] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                aria-label={`Delete ${item.name}`}
                                title="Delete line (logical)"
                                className="p-1.5 rounded text-[#5f5e5e] hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  delete
                                </span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleRestore(item)}
                              disabled={restoringId === item.id}
                              aria-label={`Restore ${item.name}`}
                              title="Restore line"
                              className="p-1.5 rounded text-[#5f5e5e] hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                restore_from_trash
                              </span>
                            </button>
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

        {!error && totalPages > 1 ? (
          <div className="px-4 py-3 border-t border-[#e8e2d8] flex items-center justify-between text-xs text-[#5f5e5e]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 border border-[#e8e2d8] rounded hover:bg-[#f2ede5] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 border border-[#e8e2d8] rounded hover:bg-[#f2ede5] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {formDrawer ? (
        <ReceiptItemFormDrawer
          key={formDrawer.mode === 'edit' ? `edit-${formDrawer.item.id}` : 'create'}
          mode={formDrawer.mode}
          item={formDrawer.mode === 'edit' ? formDrawer.item : null}
          receipts={receipts}
          receiptsLoading={receiptsLoading}
          defaultReceiptId={filters.receiptId ? Number(filters.receiptId) : null}
          submitting={formSubmitting}
          submitError={formError}
          onCancel={() => {
            if (!formSubmitting) setFormDrawer(null);
          }}
          onSubmit={(submit) => void handleFormSubmit(submit)}
        />
      ) : null}

      {deleteTarget ? (
        <AppModal
          title="Delete receipt line"
          subtitle="LOGICAL DELETION"
          size="md"
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          closeDisabled={deleting}
        >
          <div className="p-6 flex flex-col gap-5 font-poppins">
            <p className="text-sm text-[#1d1c17] leading-relaxed">
              "{deleteTarget.name}" ({formatMoney(deleteTarget.total, deleteTarget.currency)}) will be marked as
              deleted. The row is kept for audit and the receipt totals are recalculated without it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 rounded"
              >
                {deleting ? 'Deleting…' : 'Delete line'}
              </button>
            </div>
          </div>
        </AppModal>
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ReceiptItemsView;
