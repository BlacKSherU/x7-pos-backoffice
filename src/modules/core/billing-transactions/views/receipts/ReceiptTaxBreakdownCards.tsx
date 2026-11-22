import React from 'react';
import type { ReceiptTaxBreakdown } from '../../types/receipts';
import { describeDateRange, formatMoney, taxLabel } from '../../lib/receipts-format';

interface ReceiptTaxBreakdownCardsProps {
  breakdown: ReceiptTaxBreakdown | null;
  loading: boolean;
  error?: string | null;
  dateFrom?: string;
  dateTo?: string;
  onRetry?: () => void;
}

/** Tarjetas por tipo de impuesto que se muestran antes de "+N more". */
const MAX_TAX_CARDS = 7;

/**
 * Tax Breakdown: total de impuesto cobrado por tipo (nombre + tasa, p. ej. "VAT 19%") según el
 * rango de fechas y el estado activos (GET /receipts/tax-breakdown). Se recalcula al cambiar
 * esos filtros y tras cada recarga del listado.
 */
export const ReceiptTaxBreakdownCards: React.FC<ReceiptTaxBreakdownCardsProps> = ({
  breakdown,
  loading,
  error,
  dateFrom,
  dateTo,
  onRetry,
}) => {
  const rangeText = describeDateRange(dateFrom, dateTo);
  const taxes = breakdown?.by_tax ?? [];
  const visible = taxes.slice(0, MAX_TAX_CARDS);
  const hidden = taxes.length - visible.length;
  const otherCurrencies = (breakdown?.by_currency ?? []).slice(1);

  return (
    <section
      aria-label="Tax breakdown"
      data-testid="receipts-tax-breakdown"
      className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm p-4 sm:p-5 font-poppins w-full min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[18px] text-[#ae001a]" aria-hidden="true">
            percent
          </span>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#1d1c17] font-poppins">
            Tax Breakdown
          </h2>
        </div>
        <span
          data-testid="receipts-tax-breakdown-range"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f1ece4] text-[10.5px] font-semibold text-[#5f5e5e] font-poppins"
        >
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
            date_range
          </span>
          {rangeText}
        </span>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-red-700 font-poppins">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 rounded border border-red-200 font-semibold text-[#ae001a] hover:bg-red-50 cursor-pointer font-poppins"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full min-w-0" aria-busy={loading}>
          <li
            data-testid="receipts-tax-total-card"
            className="rounded-lg bg-[#222222] text-white border-t-4 border-[#ae001a] p-3 flex flex-col gap-1 min-w-0"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              Total tax collected
            </span>
            <span className="text-base xl:text-lg font-extrabold tabular-nums truncate">
              {loading ? '…' : formatMoney(breakdown?.total_tax ?? 0, breakdown?.currency)}
            </span>
            <span className="text-[10.5px] text-zinc-400 truncate">
              {loading
                ? 'Loading…'
                : otherCurrencies.length > 0
                  ? `+ ${otherCurrencies.map((c) => formatMoney(c.total_amount, c.currency)).join(' · ')}`
                  : `${taxes.length} ${taxes.length === 1 ? 'tax type' : 'tax types'}`}
            </span>
          </li>

          {!loading && taxes.length === 0 && (
            <li className="col-span-1 md:col-span-3 rounded-lg border border-dashed border-[#d5cfc4] p-3 flex items-center text-xs text-[#8c857b]">
              No taxes were collected for {rangeText === 'All dates' ? 'these receipts' : 'this date range'}.
            </li>
          )}

          {!loading &&
            visible.map((entry) => {
              const name = taxLabel(entry.name, entry.rate);
              return (
                <li
                  key={`${entry.name}|${entry.rate}|${entry.currency}`}
                  data-testid="receipts-tax-card"
                  aria-label={`${name}: ${formatMoney(entry.total_amount, entry.currency)}`}
                  className="rounded-lg bg-white border border-[#e8e2d8] border-t-4 border-t-amber-500 p-3 flex flex-col gap-1 min-w-0 hover:border-[#ae001a] transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] truncate" title={name}>
                    {name}
                  </span>
                  <span className="text-base font-extrabold tabular-nums text-[#1d1c17] truncate">
                    {formatMoney(entry.total_amount, entry.currency)}
                  </span>
                  <span className="text-[10.5px] text-[#8c857b] truncate">
                    {entry.receipts} {entry.receipts === 1 ? 'receipt' : 'receipts'} · {entry.tax_lines}{' '}
                    {entry.tax_lines === 1 ? 'line' : 'lines'}
                  </span>
                </li>
              );
            })}

          {!loading && hidden > 0 && (
            <li className="rounded-lg border border-dashed border-[#d5cfc4] p-3 flex items-center justify-center text-xs font-semibold text-[#5f5e5e]">
              +{hidden} more tax {hidden === 1 ? 'type' : 'types'}
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default ReceiptTaxBreakdownCards;
