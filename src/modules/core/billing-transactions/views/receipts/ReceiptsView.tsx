import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Toast, type ToastState } from '@/shared/components/Toast';
import { ConfirmStatusToggleDialog } from '@/shared/components/StatusToggle';
import {
  createReceipt,
  listReceipts,
  setReceiptStatus,
  updateReceipt,
} from '../../api/receipts-api';
import type {
  CreateReceiptPayload,
  Receipt,
  ReceiptStatusFilter,
  ReceiptType,
  UpdateReceiptPayload,
} from '../../types/receipts';
import { receiptLabel } from '../../lib/receipts-format';
import { ReceiptsDataGrid } from './ReceiptsDataGrid';
import { ReceiptDetailsDrawer } from './ReceiptDetailsDrawer';
import { ReceiptFormDrawer, type ReceiptFormMode } from './ReceiptFormDrawer';

export interface ReceiptsViewProps {
  onNavigate?: (view: string) => void;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: Array<{ value: ReceiptStatusFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All statuses' },
];

/**
 * Receipts (Billing & Transactions): listado central de recibos del merchant con búsqueda
 * alfanumérica (invoice_number / fiscal_data), filtros por tipo y estado, paginación del
 * servidor, ficha de detalle, edición (PATCH) y baja lógica / reactivación.
 */
export const ReceiptsView: React.FC<ReceiptsViewProps> = () => {
  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReceiptType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ReceiptStatusFilter>('active');
  const [page, setPage] = useState(1);

  // Datos
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  // Paneles
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState<{ mode: ReceiptFormMode; receipt?: Receipt } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Receipt | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  // Búsqueda en tiempo real con debounce: vuelve a la primera página.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const handle = window.setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, search]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    listReceipts({ page, limit: PAGE_SIZE, search, type: typeFilter, status: statusFilter })
      .then((result) => {
        if (seq !== requestSeq.current) return;
        // Si una baja deja vacía la última página, se retrocede una.
        if (result.data.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.max(1, result.totalPages));
          return;
        }
        setReceipts(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((err: unknown) => {
        if (seq !== requestSeq.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load receipts.');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [page, search, typeFilter, statusFilter, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const hasActiveFilters = Boolean(search || typeFilter || statusFilter !== 'active');

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setTypeFilter('');
    setStatusFilter('active');
    setPage(1);
  };

  const handleSubmitForm = async (payload: CreateReceiptPayload | UpdateReceiptPayload) => {
    if (!form) return;
    if (form.mode === 'edit' && form.receipt) {
      const updated = await updateReceipt(form.receipt.id, payload);
      setReceipts((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      if (detailReceipt?.id === updated.id) setDetailReceipt(updated);
      showToast(`${receiptLabel(updated)} updated.`);
    } else {
      const created = await createReceipt(payload as CreateReceiptPayload);
      showToast(`${receiptLabel(created)} created.`);
      reload();
    }
    setForm(null);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const nextActive = !statusTarget.is_active;
    setStatusSubmitting(true);
    try {
      const updated = await setReceiptStatus(statusTarget.id, nextActive);
      showToast(
        nextActive ? `${receiptLabel(updated)} reactivated.` : `${receiptLabel(updated)} deactivated.`,
      );
      if (detailReceipt?.id === updated.id) setDetailReceipt(updated);
      setStatusTarget(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'The status could not be changed.', 'error');
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-8" data-testid="receipts-view">
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl" aria-hidden="true">
            receipt_long
          </span>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-poppins">Receipts</h2>
        </div>
        <p className="text-[#5f5e5e] text-body-sm font-poppins mt-1">
          Search issued receipts and invoices by invoice number or fiscal data, review their amounts and keep the
          financial history with logical deletion.
        </p>
      </div>

      {/* Búsqueda y filtros */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="relative w-full">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8c857b] text-[20px]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by invoice number or fiscal data (tax ID, fiscal number…)"
            aria-label="Search receipts"
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-sm text-[#1d1c17] placeholder:text-[#8c857b] outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/30 font-poppins"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as ReceiptType | '');
                setPage(1);
              }}
              aria-label="Filter by type"
              className="h-9 px-3 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-xs font-semibold text-[#1d1c17] outline-none focus:border-[#ae001a] cursor-pointer font-poppins"
            >
              <option value="">All types</option>
              <option value="INVOICE">Invoices</option>
              <option value="RECEIPT">Receipts</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ReceiptStatusFilter);
                setPage(1);
              }}
              aria-label="Filter by status"
              className="h-9 px-3 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-xs font-semibold text-[#1d1c17] outline-none focus:border-[#ae001a] cursor-pointer font-poppins"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 px-3 rounded-lg border border-red-200 text-xs font-semibold text-[#ae001a] hover:bg-red-50 transition-colors cursor-pointer font-poppins"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              aria-label="Reload receipts"
              title="Reload receipts"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#d5cfc4] bg-white text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                refresh
              </span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ mode: 'create' })}
              className="h-9 px-4 rounded-lg bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors cursor-pointer font-poppins"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                add
              </span>
              New Receipt
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="border border-red-300 bg-red-50 rounded-xl p-8 text-center" role="alert">
          <span className="material-symbols-outlined text-red-500 text-4xl" aria-hidden="true">
            error
          </span>
          <p className="mt-3 text-red-700 font-medium">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <ReceiptsDataGrid
          receipts={receipts}
          loading={loading}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onView={setDetailReceipt}
          onEdit={(receipt) => setForm({ mode: 'edit', receipt })}
          onToggleStatus={setStatusTarget}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {detailReceipt && (
        <ReceiptDetailsDrawer
          receipt={detailReceipt}
          onClose={() => setDetailReceipt(null)}
          onEdit={(receipt) => {
            setDetailReceipt(null);
            setForm({ mode: 'edit', receipt });
          }}
          onToggleStatus={setStatusTarget}
        />
      )}

      {form && (
        <ReceiptFormDrawer
          key={form.receipt?.id ?? 'new'}
          mode={form.mode}
          receipt={form.receipt}
          onSubmit={handleSubmitForm}
          onClose={() => setForm(null)}
        />
      )}

      {statusTarget && (
        <ConfirmStatusToggleDialog
          entityName={receiptLabel(statusTarget)}
          direction={statusTarget.is_active ? 'deactivate' : 'activate'}
          submitting={statusSubmitting}
          onConfirm={confirmStatusChange}
          onClose={() => setStatusTarget(null)}
          description={
            statusTarget.is_active
              ? `Deactivating "${receiptLabel(statusTarget)}" is a logical deletion: it leaves the active list, but its amounts, items and taxes stay in the financial history and it can be reactivated.`
              : `Reactivating "${receiptLabel(statusTarget)}" returns it to the active receipts list.`
          }
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ReceiptsView;
