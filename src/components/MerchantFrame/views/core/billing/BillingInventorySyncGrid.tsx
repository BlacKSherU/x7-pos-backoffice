import React, { useEffect, useRef, useState } from 'react';
import { TablePaginationFooter } from '@/shared/components/TableOptionsMenu';
import { fetchInventorySyncRows } from '@/modules/core/billing-transactions/api/inventory-sync-api';
import {
  INVENTORY_DEDUCTION_STATUSES,
  type InventoryDeductionStatus,
  type InventorySyncRow,
} from '@/modules/core/billing-transactions/types/inventory-sync';
import {
  DEDUCTION_STATUS_META,
  rowHighlightClass,
} from '@/modules/core/billing-transactions/lib/inventory-sync-status';
import {
  DEFAULT_BILLING_INVENTORY_FILTERS,
  type BillingInventoryFilters,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

interface BillingInventorySyncGridProps {
  filters: BillingInventoryFilters;
  onFiltersChange: (next: BillingInventoryFilters) => void;
  selectedReceiptItemId?: number | null;
  onSelectRow?: (row: InventorySyncRow) => void;
  /** Cambiarlo vuelve a pedir la página actual (p. ej. tras validar stock). */
  refreshKey?: number;
}

const INVOICE_DEBOUNCE_MS = 400;
const COLUMN_COUNT = 8;

const MAPPING_LABEL: Record<string, string> = {
  VARIANT: 'Variant SKU',
  PRODUCT: 'Product SKU',
  SUPPLY: 'Raw material SKU',
};

const formatQty = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const highlightOf = (row: InventorySyncRow): 'failed' | 'insufficient' | 'none' => {
  if (row.commitFailed) return 'failed';
  if (row.insufficientStock) return 'insufficient';
  return 'none';
};

export const DeductionStatusBadge: React.FC<{ status: InventoryDeductionStatus; title?: string }> = ({
  status,
  title,
}) => {
  const meta = DEDUCTION_STATUS_META[status];
  return (
    <span
      data-testid={`deduction-status-${status}`}
      title={title ?? meta.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap font-poppins ${meta.badgeClass}`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
};

/**
 * Grid central "ReceiptItem → deducciones de stock": SKU, producto, cantidad vendida, almacén,
 * movimiento de stock y estado de deducción por línea de recibo, resaltando stock insuficiente y
 * commits de inventario fallidos.
 */
export const BillingInventorySyncGrid: React.FC<BillingInventorySyncGridProps> = ({
  filters,
  onFiltersChange,
  selectedReceiptItemId = null,
  onSelectRow,
  refreshKey = 0,
}) => {
  const [rows, setRows] = useState<InventorySyncRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [invoiceDraft, setInvoiceDraft] = useState(filters.invoiceNumber);
  const requestId = useRef(0);

  // El borrador del buscador sigue a los filtros cuando cambian desde fuera (p. ej. "Clear filters").
  const [syncedInvoice, setSyncedInvoice] = useState(filters.invoiceNumber);
  if (syncedInvoice !== filters.invoiceNumber) {
    setSyncedInvoice(filters.invoiceNumber);
    setInvoiceDraft(filters.invoiceNumber);
  }

  useEffect(() => {
    if (invoiceDraft === filters.invoiceNumber) return undefined;
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, invoiceNumber: invoiceDraft, page: 1 });
    }, INVOICE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [invoiceDraft, filters, onFiltersChange]);

  const { invoiceNumber, status, dateFrom, dateTo, page, limit } = filters;
  useEffect(() => {
    const current = ++requestId.current;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchInventorySyncRows({
          invoiceNumber,
          status: status as InventoryDeductionStatus | '',
          dateFrom,
          dateTo,
          page,
          limit,
        });
        if (cancelled || current !== requestId.current) return;
        setRows(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        if (cancelled || current !== requestId.current) return;
        setRows([]);
        setTotal(0);
        setTotalPages(0);
        setError(err instanceof Error ? err.message : 'Failed to load the receipt lines stock deductions.');
      } finally {
        if (!cancelled && current === requestId.current) setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceNumber, status, dateFrom, dateTo, page, limit, refreshKey, reloadTick]);

  const hasActiveFilter = !!(invoiceNumber || status || dateFrom || dateTo);

  const toggleExpanded = (receiptItemId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(receiptItemId)) next.delete(receiptItemId);
      else next.add(receiptItemId);
      return next;
    });
  };

  const inputClass =
    'h-[36px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 font-poppins';

  return (
    <section
      aria-label="Receipt line stock deductions"
      className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm overflow-hidden font-poppins text-left"
    >
      <div className="p-5 border-b border-[#e8e2d8] flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ae001a] text-xl" aria-hidden="true">
              fact_check
            </span>
            <h3 className="text-[#1d1c17] font-bold text-sm tracking-wider uppercase font-poppins">
              Receipt Line Stock Deductions
            </h3>
          </div>
          <p className="text-[#5f5e5e] text-xs mt-1 font-poppins">
            Each receipt line mapped to its SKU, the warehouse it was deducted from, its stock movement and the
            deduction status. Rows with insufficient stock or a failed inventory commit are highlighted.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <span
              className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c857b] text-[18px]"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={invoiceDraft}
              onChange={(e) => setInvoiceDraft(e.target.value)}
              placeholder="Search by invoice number..."
              aria-label="Filter by invoice number"
              className={`${inputClass} w-full pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value, page: 1 })}
            aria-label="Filter by deduction status"
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">All Statuses</option>
            {INVENTORY_DEDUCTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DEDUCTION_STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 h-[36px] px-2.5 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-xs">
            <span className="font-bold text-[#5f5e5e] uppercase text-[10px] tracking-wider">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value, page: 1 })}
              aria-label="Receipts from date"
              className="bg-transparent text-xs outline-none w-[118px] cursor-pointer font-poppins"
            />
            <span className="text-[#d5cfc4]">|</span>
            <span className="font-bold text-[#5f5e5e] uppercase text-[10px] tracking-wider">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value, page: 1 })}
              aria-label="Receipts to date"
              className="bg-transparent text-xs outline-none w-[118px] cursor-pointer font-poppins"
            />
          </div>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            aria-label="Reload receipt lines"
            title="Reload receipt lines"
            className="h-[36px] w-[36px] flex items-center justify-center rounded-lg border border-[#d5cfc4] bg-white text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
              refresh
            </span>
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() =>
                onFiltersChange({ ...DEFAULT_BILLING_INVENTORY_FILTERS, limit: filters.limit })
              }
              className="h-[36px] px-3 rounded-lg border border-[#e8e2d8] text-[#5f5e5e] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-5 mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
            {error}
          </span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="px-3 py-1 rounded border border-red-300 bg-white font-bold uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-poppins" aria-busy={isLoading}>
          <thead>
            <tr className="bg-[#f8f3eb] text-[#5f5e5e] text-[10px] uppercase tracking-wider">
              <th scope="col" className="px-4 py-3 text-left font-bold">Invoice</th>
              <th scope="col" className="px-4 py-3 text-left font-bold">SKU</th>
              <th scope="col" className="px-4 py-3 text-left font-bold">Product</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">Qty Sold</th>
              <th scope="col" className="px-4 py-3 text-left font-bold">Warehouse</th>
              <th scope="col" className="px-4 py-3 text-left font-bold">Stock Movement</th>
              <th scope="col" className="px-4 py-3 text-left font-bold">Deduction Status</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-[#5f5e5e]">
                  Loading receipt lines...
                </td>
              </tr>
            ) : rows.length === 0 && !error ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-12 text-center text-[#5f5e5e]">
                  <span className="material-symbols-outlined text-[#ae001a] text-4xl block mb-2" aria-hidden="true">
                    inventory_2
                  </span>
                  {hasActiveFilter
                    ? 'No receipt lines match these filters.'
                    : 'No receipt lines have been billed yet.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = row.receiptItemId === selectedReceiptItemId;
                const isExpanded = expanded.has(row.receiptItemId);
                return (
                  <React.Fragment key={row.receiptItemId}>
                    <tr
                      data-testid={`inventory-sync-row-${row.receiptItemId}`}
                      data-status={row.deductionStatus}
                      data-highlight={highlightOf(row)}
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => onSelectRow?.(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectRow?.(row);
                        }
                      }}
                      className={`border-t border-[#efe9df] cursor-pointer transition-colors hover:bg-[#fef9f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ae001a]/40 ${rowHighlightClass(row)} ${
                        isSelected ? 'outline outline-2 -outline-offset-2 outline-[#ae001a]/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-[#1d1c17]">{row.invoiceNumber ?? `Receipt #${row.receiptId}`}</div>
                        <div className="text-[10px] text-[#76736a] mt-0.5">
                          {row.receiptType} · {formatDate(row.receiptCreatedAt)}
                        </div>
                        <div className="text-[10px] text-[#76736a]">Order #{row.orderNumber ?? row.orderId}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.sku ? (
                          <span className="font-mono font-bold text-[#1d1c17]">{row.sku}</span>
                        ) : (
                          <span className="italic text-[#8c857b]">No SKU</span>
                        )}
                        <div className="text-[10px] text-[#76736a] mt-0.5">
                          {row.mappingSource ? MAPPING_LABEL[row.mappingSource] : 'Unmapped'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-[#1d1c17] font-semibold">{row.itemName}</div>
                        {row.productName && (
                          <div className="text-[10px] text-[#5f5e5e] mt-0.5">
                            → {row.productName}
                            {row.variantName ? ` · ${row.variantName}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono font-bold text-[#1d1c17]">
                        {formatQty(row.quantitySold)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.location ? (
                          <span className="inline-flex items-center gap-1 text-[#1d1c17]">
                            <span className="material-symbols-outlined text-[15px] text-[#5f5e5e]" aria-hidden="true">
                              warehouse
                            </span>
                            {row.location.name}
                            {row.location.code && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-[#f2ede5] text-[9px] font-bold text-[#5f5e5e]">
                                {row.location.code}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[#8c857b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.movements.length > 0 ? (
                          <ul className="flex flex-col gap-0.5">
                            {row.movements.slice(0, 2).map((m) => (
                              <li key={m.id} className="font-mono text-[11px] text-[#1d1c17]">
                                #{m.id} · {m.type} · −{formatQty(m.quantity)}
                              </li>
                            ))}
                            {row.movements.length > 2 && (
                              <li className="text-[10px] text-[#76736a]">+{row.movements.length - 2} more</li>
                            )}
                          </ul>
                        ) : (
                          <span className="text-[#8c857b]">
                            {row.components.length > 0 ? 'No movement' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <DeductionStatusBadge status={row.deductionStatus} title={row.statusReason} />
                          {row.insufficientStock && (
                            <span className="text-[10px] font-bold text-[#ae001a] flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">trending_down</span>
                              Insufficient stock
                            </span>
                          )}
                          {row.commitFailed && (
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">sync_problem</span>
                              Inventory commit failed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(row.receiptItemId);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} stock components of line ${row.receiptItemId}`}
                          className="w-7 h-7 inline-flex items-center justify-center rounded border border-[#e8e2d8] bg-white text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#fcfaf6]" data-testid={`inventory-sync-details-${row.receiptItemId}`}>
                        <td colSpan={COLUMN_COUNT} className="px-6 py-4">
                          <p className="text-xs text-[#1d1c17] mb-3">
                            <span className="font-bold">Status: </span>
                            {row.statusReason}
                          </p>
                          {row.components.length > 0 ? (
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-[9.5px] uppercase tracking-wider text-[#76736a]">
                                  <th scope="col" className="py-1 pr-3 text-left">Component</th>
                                  <th scope="col" className="py-1 pr-3 text-right">Required</th>
                                  <th scope="col" className="py-1 pr-3 text-right">Order movement</th>
                                  <th scope="col" className="py-1 pr-3 text-right">On hand</th>
                                  <th scope="col" className="py-1 pr-3 text-right">Minimum</th>
                                  <th scope="col" className="py-1 pr-3 text-left">Location</th>
                                  <th scope="col" className="py-1 text-left">Movements</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.components.map((c) => (
                                  <tr key={c.key} className={c.insufficient ? 'text-[#ae001a] font-semibold' : 'text-[#1d1c17]'}>
                                    <td className="py-1 pr-3">
                                      {c.name}
                                      {c.sku && <span className="ml-1 font-mono text-[#76736a]">({c.sku})</span>}
                                    </td>
                                    <td className="py-1 pr-3 text-right font-mono">{formatQty(c.requiredQty)}</td>
                                    <td className="py-1 pr-3 text-right font-mono">{formatQty(c.deductedQty)}</td>
                                    <td className="py-1 pr-3 text-right font-mono">{formatQty(c.currentQty)}</td>
                                    <td className="py-1 pr-3 text-right font-mono">{formatQty(c.minimumQty)}</td>
                                    <td className="py-1 pr-3">{c.locationName ?? '—'}</td>
                                    <td className="py-1 font-mono">
                                      {c.movementIds.length > 0 ? c.movementIds.map((id) => `#${id}`).join(', ') : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-[11px] text-[#76736a]">This line does not consume stock components.</p>
                          )}
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

      <TablePaginationFooter
        currentPage={page}
        totalItems={total}
        pageSize={limit}
        totalPages={Math.max(totalPages, 1)}
        onPageChange={(next) => onFiltersChange({ ...filters, page: next })}
      />
    </section>
  );
};

export default BillingInventorySyncGrid;
