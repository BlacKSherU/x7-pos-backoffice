import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Toast, type ToastState } from '@/shared/components/Toast';
import { ConfirmStatusToggleDialog } from '@/shared/components/StatusToggle';
import {
  createReceipt,
  getReceiptActivityLog,
  getReceiptDetails,
  getReceiptTaxBreakdown,
  getReceiptsSummary,
  listReceipts,
  lockReceipt,
  setReceiptStatus,
  updateReceipt,
} from '../../api/receipts-api';
import type {
  CreateReceiptPayload,
  Receipt,
  ReceiptStatusFilter,
  ReceiptSummary,
  ReceiptTaxBreakdown,
  ReceiptType,
  UpdateReceiptPayload,
} from '../../types/receipts';
import { receiptLabel } from '../../lib/receipts-format';
import { ReceiptsDataGrid } from './ReceiptsDataGrid';
import { ReceiptDetailsDrawer } from './ReceiptDetailsDrawer';
import { ReceiptFormDrawer, type ReceiptFormMode } from './ReceiptFormDrawer';
import { BILLING_HUB_ID, ReceiptsCommandHeader } from './ReceiptsCommandHeader';
import { ReceiptTaxBreakdownCards } from './ReceiptTaxBreakdownCards';
import { ConfirmLockReceiptDialog } from './ConfirmLockReceiptDialog';
import { ReceiptActivityLogDrawer } from './ReceiptActivityLogDrawer';
import { ReceiptAdjustmentNoteDrawer } from './ReceiptAdjustmentNoteDrawer';
import { issueAdjustmentNote, listReceiptAdjustments } from '../../api/receipt-adjustments-api';
import type { IssueAdjustmentNotePayload } from '../../types/receipt-adjustments';
import { ADJUSTMENT_NOTE_TYPE_LABELS } from '../../lib/receipt-adjustments';

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
 * alfanumérica (invoice_number / fiscal_data), filtros por tipo, estado y fecha de creación,
 * paginación del servidor, filas maestro-detalle (items e impuestos), tarjetas de desglose de
 * impuestos, ficha de detalle, edición (PATCH), baja lógica, bloqueo fiscal (LOCK RECEIPT) y
 * audit trail de cada recibo (VIEW ACTIVITY LOG, Historia 6) y notas de crédito / débito sobre
 * recibos bloqueados (ISSUE ADJUSTMENT NOTE, Historia 7).
 * Historia 11: los recibos bloqueados o dados de baja son inmutables (sin edición ni reactivación).
 */
export const ReceiptsView: React.FC<ReceiptsViewProps> = ({ onNavigate }) => {
  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReceiptType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ReceiptStatusFilter>('active');
  // Rango de fechas de creación (YYYY-MM-DD, inclusive); '' = sin límite.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Datos
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  // KPIs del header (GET /receipts/summary)
  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summarySeq = useRef(0);

  // Tarjetas de desglose de impuestos (GET /receipts/tax-breakdown)
  const [breakdown, setBreakdown] = useState<ReceiptTaxBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const breakdownSeq = useRef(0);

  // Paneles
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState<{ mode: ReceiptFormMode; receipt?: Receipt } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Receipt | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [lockTarget, setLockTarget] = useState<Receipt | null>(null);
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [activityReceipt, setActivityReceipt] = useState<Receipt | null>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<Receipt | null>(null);
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
    listReceipts({ page, limit: PAGE_SIZE, search, type: typeFilter, status: statusFilter, dateFrom, dateTo })
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
  }, [page, search, typeFilter, statusFilter, dateFrom, dateTo, reloadKey]);

  // Los KPIs siguen los filtros de estado y fecha del listado y se recalculan tras cada alta/baja.
  useEffect(() => {
    const seq = ++summarySeq.current;
    setSummaryLoading(true);
    setSummaryError(null);
    getReceiptsSummary({ status: statusFilter, dateFrom, dateTo })
      .then((data) => {
        if (seq === summarySeq.current) setSummary(data);
      })
      .catch((err: unknown) => {
        if (seq !== summarySeq.current) return;
        setSummaryError(err instanceof Error ? err.message : 'Failed to load the receipts summary.');
      })
      .finally(() => {
        if (seq === summarySeq.current) setSummaryLoading(false);
      });
  }, [statusFilter, dateFrom, dateTo, reloadKey]);

  // El desglose de impuestos sigue el rango de fechas (y el estado) activos.
  useEffect(() => {
    const seq = ++breakdownSeq.current;
    setBreakdownLoading(true);
    setBreakdownError(null);
    getReceiptTaxBreakdown({ status: statusFilter, dateFrom, dateTo })
      .then((data) => {
        if (seq === breakdownSeq.current) setBreakdown(data);
      })
      .catch((err: unknown) => {
        if (seq !== breakdownSeq.current) return;
        setBreakdownError(err instanceof Error ? err.message : 'Failed to load the tax breakdown.');
      })
      .finally(() => {
        if (seq === breakdownSeq.current) setBreakdownLoading(false);
      });
  }, [statusFilter, dateFrom, dateTo, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  // El rango se mantiene coherente: mover un extremo más allá del otro arrastra a ese otro.
  const changeDateFrom = (value: string) => {
    setDateFrom(value);
    if (value && dateTo && value > dateTo) setDateTo(value);
    setPage(1);
  };

  const changeDateTo = (value: string) => {
    setDateTo(value);
    if (value && dateFrom && value < dateFrom) setDateFrom(value);
    setPage(1);
  };

  const changeTypeFilter = (type: ReceiptType | '') => {
    setTypeFilter(type);
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || typeFilter || statusFilter !== 'active' || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setTypeFilter('');
    setStatusFilter('active');
    setDateFrom('');
    setDateTo('');
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

  // Baja lógica. Historia 11: un recibo dado de baja es inmutable, así que ya no se reactiva.
  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSubmitting(true);
    try {
      const updated = await setReceiptStatus(statusTarget.id, false);
      showToast(`${receiptLabel(updated)} deactivated.`);
      if (detailReceipt?.id === updated.id) setDetailReceipt(updated);
      setStatusTarget(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'The status could not be changed.', 'error');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // LOCK RECEIPT (Historia 11): el back-end registra usuario y rol; después no hay más cambios.
  const confirmLock = async () => {
    if (!lockTarget) return;
    setLockSubmitting(true);
    try {
      const locked = await lockReceipt(lockTarget.id);
      setReceipts((rows) => rows.map((r) => (r.id === locked.id ? locked : r)));
      if (detailReceipt?.id === locked.id) setDetailReceipt(locked);
      showToast(`${receiptLabel(locked)} locked.`);
      setLockTarget(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'The receipt could not be locked.', 'error');
    } finally {
      setLockSubmitting(false);
    }
  };

  // Historia 7: nota de crédito / débito sobre un recibo bloqueado (el recibo no cambia).
  const handleIssueAdjustment = async (payload: IssueAdjustmentNotePayload) => {
    if (!adjustmentTarget) return;
    const { note } = await issueAdjustmentNote(adjustmentTarget.id, payload);
    showToast(
      `${ADJUSTMENT_NOTE_TYPE_LABELS[note.note_type]} ${note.note_number} issued for ${receiptLabel(adjustmentTarget)}.`,
    );
    setAdjustmentTarget(null);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-8" data-testid="receipts-view">
      <ReceiptsCommandHeader
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={changeTypeFilter}
        onBackToHub={() => onNavigate?.(BILLING_HUB_ID)}
        onRefresh={reload}
      />

      <ReceiptTaxBreakdownCards
        breakdown={breakdown}
        loading={breakdownLoading}
        error={breakdownError}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRetry={reload}
      />

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
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter by creation date">
              <span className="material-symbols-outlined text-[18px] text-[#8c857b]" aria-hidden="true">
                date_range
              </span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => changeDateFrom(e.target.value)}
                aria-label="Created from"
                title="Created from"
                className="h-9 px-2 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-xs font-semibold text-[#1d1c17] outline-none focus:border-[#ae001a] cursor-pointer font-poppins"
              />
              <span className="text-[11px] text-[#8c857b] font-poppins" aria-hidden="true">
                to
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => changeDateTo(e.target.value)}
                aria-label="Created to"
                title="Created to"
                className="h-9 px-2 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-xs font-semibold text-[#1d1c17] outline-none focus:border-[#ae001a] cursor-pointer font-poppins"
              />
            </div>
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
          onLock={setLockTarget}
          onViewActivity={setActivityReceipt}
          onIssueAdjustment={setAdjustmentTarget}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          loadDetails={getReceiptDetails}
          detailsVersion={reloadKey}
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
          onLock={setLockTarget}
          onViewActivity={(receipt) => {
            setDetailReceipt(null);
            setActivityReceipt(receipt);
          }}
          onIssueAdjustment={(receipt) => {
            setDetailReceipt(null);
            setAdjustmentTarget(receipt);
          }}
          loadAdjustments={listReceiptAdjustments}
        />
      )}

      {adjustmentTarget && (
        <ReceiptAdjustmentNoteDrawer
          key={adjustmentTarget.id}
          receipt={adjustmentTarget}
          loadAdjustments={listReceiptAdjustments}
          onSubmit={handleIssueAdjustment}
          onClose={() => setAdjustmentTarget(null)}
        />
      )}

      {activityReceipt && (
        <ReceiptActivityLogDrawer
          key={activityReceipt.id}
          receipt={activityReceipt}
          loadActivityLog={getReceiptActivityLog}
          onClose={() => setActivityReceipt(null)}
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
          direction="deactivate"
          submitting={statusSubmitting}
          onConfirm={confirmStatusChange}
          onClose={() => setStatusTarget(null)}
          description={`Deactivating "${receiptLabel(statusTarget)}" is a logical deletion: it leaves the active list, but its amounts, items and taxes stay in the financial history. Deactivated receipts are immutable and cannot be reactivated.`}
        />
      )}

      {lockTarget && (
        <ConfirmLockReceiptDialog
          receipt={lockTarget}
          submitting={lockSubmitting}
          onConfirm={confirmLock}
          onClose={() => setLockTarget(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ReceiptsView;
