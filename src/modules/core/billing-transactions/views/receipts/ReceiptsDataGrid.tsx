import React, { useCallback, useEffect, useState } from 'react';
import { TablePaginationFooter } from '@/shared/components/TableOptionsMenu';
import type { Receipt, ReceiptDetails } from '../../types/receipts';
import {
  RECEIPT_TYPE_BADGE,
  RECEIPT_TYPE_LABELS,
  formatAmount,
  formatReceiptDate,
  receiptLabel,
  summarizeFiscalData,
} from '../../lib/receipts-format';
import { ReceiptLineDetails, type ReceiptDetailsState } from './ReceiptLineDetails';
import { FiscalLockBadge, GrandTotalBalanceIndicator, TaxExemptBadge } from './ReceiptFiscalBadges';
import { isReceiptMutable, isTaxExempt } from '../../lib/receipt-fiscal';
import { canIssueAdjustment } from '../../lib/receipt-adjustments';

export interface ReceiptsDataGridProps {
  receipts: Receipt[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
  /** Baja lógica (solo recibos activos sin bloquear; Historia 11: ya no hay reactivación). */
  onToggleStatus: (receipt: Receipt) => void;
  /** LOCK RECEIPT (Historia 11): bloqueo fiscal de un recibo activo sin bloquear. */
  onLock?: (receipt: Receipt) => void;
  /** VIEW ACTIVITY LOG (Historia 6): audit trail del recibo, en cualquier estado. */
  onViewActivity?: (receipt: Receipt) => void;
  /** ISSUE ADJUSTMENT NOTE (Historia 7): solo en recibos bloqueados. */
  onIssueAdjustment?: (receipt: Receipt) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Carga las líneas e impuestos de un recibo al expandir su fila (GET /receipts/:id/details). */
  loadDetails: (receiptId: number) => Promise<ReceiptDetails>;
  /** Al cambiar (p. ej. tras "Reload") se descarta la caché de detalles y se recargan las filas abiertas. */
  detailsVersion?: number;
}

const COLUMN_COUNT = 10;

type DetailsCache = { version: number; entries: Record<number, ReceiptDetailsState> };
const NO_ENTRIES: Record<number, ReceiptDetailsState> = {};

const headerCell =
  'px-3 py-3 text-[10.5px] font-bold uppercase tracking-widest text-[#5f5e5e] font-poppins whitespace-nowrap';

/** Monto con 2 decimales + código de moneda (p. ej. "1,234.50 USD"). */
const Money: React.FC<{ value: number; currency: string; strong?: boolean; testId?: string }> = ({
  value,
  currency,
  strong = false,
  testId,
}) => (
  <span data-testid={testId} className="whitespace-nowrap tabular-nums font-poppins">
    <span className={strong ? 'font-bold text-[#1d1c17]' : 'text-[#1d1c17]'}>{formatAmount(value)}</span>{' '}
    <span className="text-[10px] font-semibold text-[#8c857b] uppercase">{currency}</span>
  </span>
);

/**
 * Tabla central de Receipts: número de factura, orden, tipo, subtotal, impuestos, descuentos y
 * total (2 decimales + moneda), estado y acciones (ver; y, en recibos activos sin bloquear,
 * editar, LOCK RECEIPT y baja lógica). Historia 11: los recibos bloqueados o dados de baja son
 * inmutables, así que no muestran acciones de mutación (tampoco reactivación).
 * La paginación es del servidor: el contenedor pasa la página actual y el total.
 *
 * Maestro-detalle: el chevron de cada fila la expande y muestra sus líneas e impuestos, que se
 * piden al expandir (una vez por recibo; quedan en caché). Las filas abiertas y la caché viven
 * aquí, así que expandir o colapsar no toca la página ni los filtros del contenedor.
 */
export const ReceiptsDataGrid: React.FC<ReceiptsDataGridProps> = ({
  receipts,
  loading,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onView,
  onEdit,
  onToggleStatus,
  onLock,
  onViewActivity,
  onIssueAdjustment,
  hasActiveFilters = false,
  onClearFilters,
  loadDetails,
  detailsVersion = 0,
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [cache, setCache] = useState<DetailsCache>({ version: detailsVersion, entries: {} });
  // Una caché de otra versión (antes de un "Reload") equivale a vacía.
  const details = cache.version === detailsVersion ? cache.entries : NO_ENTRIES;

  const fetchDetails = useCallback(
    (receiptId: number) => {
      const version = detailsVersion;
      const put = (state: ReceiptDetailsState) =>
        setCache((prev) => {
          const base = prev.version === version ? prev.entries : {};
          return { version, entries: { ...base, [receiptId]: state } };
        });
      const settle = (state: ReceiptDetailsState) =>
        setCache((prev) =>
          prev.version === version ? { version, entries: { ...prev.entries, [receiptId]: state } } : prev,
        );
      put({ status: 'loading' });
      loadDetails(receiptId)
        .then((data) => settle({ status: 'loaded', data }))
        .catch((err: unknown) =>
          settle({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load the receipt details.',
          }),
        );
    },
    [detailsVersion, loadDetails],
  );

  // Carga asíncrona de las filas abiertas que aún no tienen detalle (al expandir o tras recargar).
  useEffect(() => {
    for (const receipt of receipts) {
      if (expanded[receipt.id] && !details[receipt.id]) fetchDetails(receipt.id);
    }
  }, [receipts, expanded, details, fetchDetails]);

  const toggleExpanded = (receiptId: number) => {
    const willExpand = !expanded[receiptId];
    setExpanded((prev) => ({ ...prev, [receiptId]: willExpand }));
    // Reabrir una fila cuyo detalle falló lo vuelve a pedir.
    if (willExpand && details[receiptId]?.status === 'error') fetchDetails(receiptId);
  };

  return (
    <div className="bg-white border border-[#e8e2d8] rounded-xl overflow-hidden shadow-sm font-poppins">
      <div className="px-4 py-3 bg-[#222222] flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold text-white uppercase tracking-widest font-poppins">
          Receipts Ledger
        </span>
        <span className="text-white/60 text-xs font-poppins" aria-live="polite">
          {loading ? 'Loading…' : `${total} ${total === 1 ? 'receipt' : 'receipts'}`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" aria-label="Receipts">
          <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
            <tr>
              <th className={`${headerCell} w-10`}>
                <span className="sr-only">Expand</span>
              </th>
              <th className={`${headerCell} text-left`}>Invoice #</th>
              <th className={`${headerCell} text-left`}>Order ID</th>
              <th className={`${headerCell} text-left`}>Type</th>
              <th className={`${headerCell} text-right`}>Subtotal</th>
              <th className={`${headerCell} text-right`}>Taxes</th>
              <th className={`${headerCell} text-right`}>Discounts</th>
              <th className={`${headerCell} text-right`}>Grand Total</th>
              <th className={`${headerCell} text-center`}>Status</th>
              <th className={`${headerCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {loading && receipts.length === 0 ? (
              [1, 2, 3].map((i) => (
                <tr key={`skeleton-${i}`} data-testid="receipts-skeleton-row">
                  {Array.from({ length: COLUMN_COUNT }).map((_, c) => (
                    <td key={c} className="px-3 py-4">
                      <div className="h-3.5 bg-[#ece8e0] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3" data-testid="receipts-empty-state">
                    <span className="material-symbols-outlined text-[#ae001a] text-5xl" aria-hidden="true">
                      {hasActiveFilters ? 'search_off' : 'receipt_long'}
                    </span>
                    <p className="text-sm text-[#5f5e5e] font-poppins">
                      {hasActiveFilters
                        ? 'No receipts match the current search or filters.'
                        : 'No receipts have been issued for this merchant yet.'}
                    </p>
                    {hasActiveFilters && onClearFilters && (
                      <button
                        type="button"
                        onClick={onClearFilters}
                        className="text-[#ae001a] text-sm font-semibold hover:underline cursor-pointer font-poppins"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => {
                const label = receiptLabel(receipt);
                const fiscalSummary = summarizeFiscalData(receipt.fiscal_data);
                const isExpanded = Boolean(expanded[receipt.id]);
                const detailsId = `receipt-${receipt.id}-details`;
                return (
                  <React.Fragment key={receipt.id}>
                    <tr
                      data-testid={`receipt-row-${receipt.id}`}
                      className={`group border-l-2 hover:border-l-[#ae001a] hover:bg-[#ae001a]/[0.04] transition-colors duration-150 ${
                        isExpanded ? 'border-l-[#ae001a] bg-[#ae001a]/[0.03]' : 'border-l-transparent'
                      } ${receipt.is_active ? '' : 'opacity-70'}`}
                    >
                      <td className="pl-3 pr-0 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(receipt.id)}
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded ? detailsId : undefined}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
                          title={isExpanded ? 'Hide items and taxes' : 'Show items and taxes'}
                          className={`h-7 w-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
                            isExpanded
                              ? 'text-[#ae001a] bg-[#ae001a]/10'
                              : 'text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#ae001a]/10'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                            aria-hidden="true"
                          >
                            chevron_right
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => onView(receipt)}
                          className="font-bold text-[#1d1c17] group-hover:text-[#ae001a] hover:underline transition-colors cursor-pointer text-left font-poppins"
                        >
                          {receipt.invoice_number ?? <span className="italic text-[#8c857b]">Not assigned</span>}
                        </button>
                        <div className="text-[11px] text-[#8c857b] font-poppins">
                          {formatReceiptDate(receipt.created_at)}
                        </div>
                        {fiscalSummary && (
                          <div className="text-[11px] text-[#5f5e5e] font-poppins truncate max-w-[200px]" title={receipt.fiscal_data ?? ''}>
                            {fiscalSummary}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-xs text-[#1d1c17]">#{receipt.order_id}</td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-poppins ${RECEIPT_TYPE_BADGE[receipt.type]}`}
                        >
                          {RECEIPT_TYPE_LABELS[receipt.type] ?? receipt.type}
                        </span>
                        {isTaxExempt(receipt) && (
                          <div className="mt-1">
                            <TaxExemptBadge receipt={receipt} compact />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Money value={receipt.subtotal} currency={receipt.currency} testId={`receipt-${receipt.id}-subtotal`} />
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Money value={receipt.total_tax} currency={receipt.currency} testId={`receipt-${receipt.id}-tax`} />
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Money
                          value={receipt.total_discount}
                          currency={receipt.currency}
                          testId={`receipt-${receipt.id}-discount`}
                        />
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Money
                          value={receipt.grand_total}
                          currency={receipt.currency}
                          strong
                          testId={`receipt-${receipt.id}-grand-total`}
                        />
                        <GrandTotalBalanceIndicator receipt={receipt} />
                      </td>
                      <td className="px-3 py-3 align-top text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-poppins ${
                              receipt.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {receipt.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {receipt.is_locked && <FiscalLockBadge testId={`receipt-${receipt.id}-locked`} />}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => onView(receipt)}
                            aria-label={`View ${label}`}
                            title="View details"
                            className="p-1 rounded text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#ae001a]/10 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              visibility
                            </span>
                          </button>
                          {onViewActivity && (
                            <button
                              type="button"
                              onClick={() => onViewActivity(receipt)}
                              aria-label={`View activity log for ${label}`}
                              title="VIEW ACTIVITY LOG"
                              className="p-1 rounded text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#ae001a]/10 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                history
                              </span>
                            </button>
                          )}
                          {onIssueAdjustment && canIssueAdjustment(receipt) && (
                            <button
                              type="button"
                              onClick={() => onIssueAdjustment(receipt)}
                              aria-label={`Issue adjustment note for ${label}`}
                              title="ISSUE ADJUSTMENT NOTE (credit / debit note)"
                              className="p-1 rounded text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#ae001a]/10 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                receipt_long
                              </span>
                            </button>
                          )}
                          {/* Historia 11: un recibo bloqueado o dado de baja es inmutable: sin editar,
                              bloquear ni dar de baja (y ya no se reactiva). */}
                          {isReceiptMutable(receipt) && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEdit(receipt)}
                                aria-label={`Edit ${label}`}
                                title="Edit receipt"
                                className="p-1 rounded text-[#5f5e5e] hover:text-[#ae001a] hover:bg-[#ae001a]/10 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  edit
                                </span>
                              </button>
                              {onLock && (
                                <button
                                  type="button"
                                  onClick={() => onLock(receipt)}
                                  aria-label={`Lock ${label}`}
                                  title="LOCK RECEIPT (fiscal lock: no further edits)"
                                  className="p-1 rounded text-[#5f5e5e] hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                    lock_open
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onToggleStatus(receipt)}
                                aria-label={`Deactivate ${label}`}
                                title="Logical delete (keeps the financial history)"
                                className="p-1 rounded text-[#5f5e5e] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  block
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr id={detailsId} data-testid={detailsId} className="bg-[#faf8f5]">
                        <td colSpan={COLUMN_COUNT} className="px-4 sm:px-6 py-4 border-l-2 border-l-[#ae001a]">
                          <div className="animate-fade-in">
                            <ReceiptLineDetails
                              receiptId={receipt.id}
                              label={label}
                              currency={receipt.currency}
                              state={details[receipt.id]}
                              onRetry={() => fetchDetails(receipt.id)}
                            />
                          </div>
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
        pageSize={pageSize}
        totalPages={Math.max(1, totalPages)}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export default ReceiptsDataGrid;
