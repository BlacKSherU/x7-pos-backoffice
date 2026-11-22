import React from 'react';
import type { ReceiptTaxesSummary } from '../../types/receipt-taxes';
import { formatMoney, formatRate } from './receiptTaxesHelpers';

interface ReceiptTaxesHeaderProps {
  summary: ReceiptTaxesSummary | null;
  loading: boolean;
  error: string | null;
  /** Tax type filter: exact tax name, '' = all. */
  taxName: string;
  /** Applied rate filter, '' = all. */
  rate: string;
  onTaxNameChange: (value: string) => void;
  onRateChange: (value: string) => void;
  onRetry?: () => void;
}

const LABEL_CLASS = 'text-[10px] font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins';
const SELECT_CLASS =
  'h-[36px] w-full px-3 bg-white border border-[#d5cfc4] rounded-lg text-xs font-medium text-[#1d1c17] focus:border-[#ae001a] outline-none cursor-pointer font-poppins';
const BREAKDOWN_LIMIT = 6;

interface KpiCardProps {
  icon: string;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone: string;
  testId: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, hint, tone, testId }) => (
  <div
    data-testid={testId}
    className="bg-white border border-[#e8e2d8] p-3 rounded-xl shadow-xs flex items-start gap-2.5 min-w-0 font-poppins"
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${tone}`}>
      <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
        {icon}
      </span>
    </div>
    <div className="min-w-0">
      <div className={`${LABEL_CLASS} truncate`}>{label}</div>
      <div className="text-lg font-extrabold text-[#1d1c17] leading-tight break-words">{value}</div>
      {hint ? <div className="text-[11px] text-[#76736a] leading-snug mt-0.5">{hint}</div> : null}
    </div>
  </div>
);

/**
 * Analytical header of the Receipt Taxes workspace: purpose of the section, how the two
 * scopes are taxed, consolidated metrics (active amounts per scope, per tax type and rate)
 * and the tax type / applied rate filters.
 */
export const ReceiptTaxesHeader: React.FC<ReceiptTaxesHeaderProps> = ({
  summary,
  loading,
  error,
  taxName,
  rate,
  onTaxNameChange,
  onRateChange,
  onRetry,
}) => {
  const [primary, ...otherCurrencies] = summary?.totals_by_currency ?? [];
  const currency = primary?.currency ?? 'USD';
  const placeholder = loading ? '…' : '—';
  const names = summary?.filter_options.names ?? [];
  const rates = summary?.filter_options.rates ?? [];
  const breakdown = summary?.by_type ?? [];
  const hasFilter = Boolean(taxName || rate);

  return (
    <section aria-labelledby="receipt-taxes-title" className="flex flex-col gap-4 font-poppins">
      {/* Purpose + scope semantics */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl" aria-hidden="true">
              percent
            </span>
            <h2 id="receipt-taxes-title" className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-poppins">
              Receipt Taxes
            </h2>
          </div>
          <p className="text-[#5f5e5e] text-body-sm mt-1 max-w-4xl leading-relaxed">
            Fiscal record of every tax charged on customer receipts. Each line keeps the tax name, the rate applied
            and the amount calculated by the system, so VAT, local surcharges and other levies can be audited against
            what each receipt actually charged.
          </p>
        </div>

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          <div className="rounded-lg border border-[#ae001a]/25 bg-[#ae001a]/[0.04] p-4" data-testid="receipt-scope-explainer">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#ae001a]" aria-hidden="true">receipt_long</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ae001a]">Receipt scope · whole sale</h3>
            </div>
            <p className="text-[12px] text-[#3d3b36] mt-1.5 leading-relaxed">
              Calculated once over the receipt subtotal. Use it for general taxes such as VAT or sales tax that apply to
              the entire sale.
            </p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4" data-testid="item-scope-explainer">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-sky-800" aria-hidden="true">list_alt</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800">Item scope · single line</h3>
            </div>
            <p className="text-[12px] text-[#3d3b36] mt-1.5 leading-relaxed">
              Calculated over the taxable base of one receipt line (its subtotal minus the line discount). Use it for
              taxes that only apply to specific products, such as excise or beverage taxes.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-[#76736a] leading-snug flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-[#8c857b]" aria-hidden="true">info</span>
          <span>
            Amounts are rounded to the cent. Only active tax lines are added to the receipt totals; deactivated lines stay
            on record with their original amount for audit purposes.
          </span>
        </p>
      </div>

      {/* Consolidated metrics */}
      {error ? (
        <div className="bg-white border border-red-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <span className="text-sm text-red-700">{error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="text-[#ae001a] text-xs font-bold uppercase tracking-widest hover:underline">
              Retry metrics
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]" aria-label="Receipt tax metrics">
          <KpiCard
            testId="kpi-active-lines"
            icon="fact_check"
            tone="bg-green-50 text-green-700 border-green-200"
            label="Active tax lines"
            value={summary ? summary.active_count : placeholder}
            hint={summary ? `${summary.inactive_count} inactive · ${summary.total_count} total` : undefined}
          />
          <KpiCard
            testId="kpi-total-tax"
            icon="account_balance"
            tone="bg-[#ae001a]/10 text-[#ae001a] border-[#ae001a]/25"
            label="Tax charged"
            value={summary ? formatMoney(primary?.total_amount ?? 0, currency) : placeholder}
            hint={
              otherCurrencies.length > 0
                ? `+ ${otherCurrencies.map((c) => formatMoney(c.total_amount, c.currency)).join(' · ')}`
                : 'Active lines only'
            }
          />
          <KpiCard
            testId="kpi-receipt-scope"
            icon="receipt_long"
            tone="bg-[#f4efe6] text-[#5f5e5e] border-[#e8e2d8]"
            label="Receipt scope"
            value={summary ? formatMoney(primary?.receipt_scope_amount ?? 0, currency) : placeholder}
            hint={summary ? `${summary.by_scope.filter((s) => s.scope === 'RECEIPT').reduce((n, s) => n + s.count, 0)} lines` : undefined}
          />
          <KpiCard
            testId="kpi-item-scope"
            icon="list_alt"
            tone="bg-sky-50 text-sky-800 border-sky-200"
            label="Item scope"
            value={summary ? formatMoney(primary?.item_scope_amount ?? 0, currency) : placeholder}
            hint={summary ? `${summary.by_scope.filter((s) => s.scope === 'ITEM').reduce((n, s) => n + s.count, 0)} lines` : undefined}
          />
          <KpiCard
            testId="kpi-receipts"
            icon="receipt"
            tone="bg-amber-50 text-amber-800 border-amber-200"
            label="Taxed receipts"
            value={summary ? summary.receipts_count : placeholder}
            hint="With at least one active tax"
          />
        </div>
      )}

      {/* Filters + breakdown by type and rate */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[180px] flex-1 sm:flex-none sm:w-56">
            <label htmlFor="rt-filter-type" className={LABEL_CLASS}>
              Tax type
            </label>
            <select id="rt-filter-type" value={taxName} onChange={(e) => onTaxNameChange(e.target.value)} className={SELECT_CLASS}>
              <option value="">All tax types</option>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:w-40">
            <label htmlFor="rt-filter-rate" className={LABEL_CLASS}>
              Applied rate
            </label>
            <select id="rt-filter-rate" value={rate} onChange={(e) => onRateChange(e.target.value)} className={SELECT_CLASS}>
              <option value="">All rates</option>
              {rates.map((r) => (
                <option key={r} value={String(r)}>
                  {formatRate(r)}
                </option>
              ))}
            </select>
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                onTaxNameChange('');
                onRateChange('');
              }}
              className="h-[36px] px-3 rounded-lg text-xs font-semibold text-[#ae001a] hover:bg-red-50 border border-red-200 transition-colors"
            >
              Reset tax filters
            </button>
          )}
        </div>

        <div>
          <div className={`${LABEL_CLASS} mb-1.5`}>Active tax by type and rate</div>
          {breakdown.length === 0 ? (
            <p className="text-xs text-[#76736a]">{loading ? 'Loading breakdown…' : 'No active tax lines for these filters.'}</p>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Tax breakdown by type and rate">
              {breakdown.slice(0, BREAKDOWN_LIMIT).map((t) => (
                <li
                  key={`${t.name}-${t.rate}-${t.currency}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#e8e2d8] bg-[#fcfaf6] text-xs min-w-0"
                >
                  <span className="font-semibold text-[#1d1c17] truncate max-w-[160px]">{t.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#222222] text-white text-[10px] font-bold">{formatRate(t.rate)}</span>
                  <span className="text-[#76736a]">
                    {t.count} {t.count === 1 ? 'line' : 'lines'}
                  </span>
                  <span className="font-mono font-semibold text-[#ae001a]">{formatMoney(t.total_amount, t.currency)}</span>
                </li>
              ))}
              {breakdown.length > BREAKDOWN_LIMIT && (
                <li className="self-center text-[11px] text-[#76736a]">+{breakdown.length - BREAKDOWN_LIMIT} more</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReceiptTaxesHeader;
