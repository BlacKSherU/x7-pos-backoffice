import React from 'react';
import type { ReceiptStatusFilter, ReceiptSummary, ReceiptType } from '../../types/receipts';
import { formatMoney } from '../../lib/receipts-format';

/** Etiqueta del botón de regreso: igual que el `hubLabel` del hub billing-transactions. */
export const BILLING_HUB_LABEL = 'BILLING & TRANSACTIONS COMMAND HUB';
export const BILLING_HUB_ID = 'billing-transactions-hub';

export interface ReceiptsCommandHeaderProps {
  summary: ReceiptSummary | null;
  loading: boolean;
  error?: string | null;
  statusFilter: ReceiptStatusFilter;
  typeFilter: ReceiptType | '';
  onTypeFilterChange: (type: ReceiptType | '') => void;
  onBackToHub: () => void;
  onRefresh?: () => void;
}

type KpiAccent = 'red' | 'emerald' | 'amber' | 'zinc';

const KPI_BORDER: Record<KpiAccent, string> = {
  red: 'border-[#ae001a]',
  emerald: 'border-emerald-500',
  amber: 'border-amber-500',
  zinc: 'border-zinc-500',
};

const STATUS_COUNT_LABEL: Record<ReceiptStatusFilter, string> = {
  active: 'Active receipts',
  inactive: 'Inactive receipts',
  all: 'All receipts',
};

const TYPE_CHIPS: Array<{ value: ReceiptType | ''; label: string; icon: string }> = [
  { value: '', label: 'All types', icon: 'select_all' },
  { value: 'INVOICE', label: 'Invoices', icon: 'request_quote' },
  { value: 'RECEIPT', label: 'Receipts', icon: 'receipt' },
];

const KpiCard: React.FC<{
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  accent: KpiAccent;
  loading: boolean;
}> = ({ id, title, value, subtitle, icon, accent, loading }) => (
  <div
    data-testid={`receipts-kpi-${id}`}
    className={`bg-[#222222] text-white rounded-lg border-t-4 ${KPI_BORDER[accent]} p-3.5 flex flex-col justify-between gap-2 min-w-0 min-h-[104px] font-poppins`}
  >
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-tight font-poppins">{title}</span>
      <span className="material-symbols-outlined text-[18px] text-zinc-400 shrink-0" aria-hidden="true">
        {icon}
      </span>
    </div>
    <div className="text-lg xl:text-xl font-extrabold leading-tight truncate tabular-nums font-poppins" title={value}>
      {loading ? '…' : value}
    </div>
    <div className="text-[10.5px] text-zinc-400 leading-snug font-poppins">{loading ? 'Loading…' : subtitle}</div>
  </div>
);

/**
 * Command Hub Header del módulo Receipts: título "Billing & Transactions", bloque descriptivo,
 * KPIs agregados del back-end (GET /receipts/summary, filtrado por merchant e is_active),
 * filtros rápidos por tipo y botón de regreso al BILLING & TRANSACTIONS COMMAND HUB.
 * Todo el texto usa Poppins (`font-poppins`).
 */
export const ReceiptsCommandHeader: React.FC<ReceiptsCommandHeaderProps> = ({
  summary,
  loading,
  error,
  statusFilter,
  typeFilter,
  onTypeFilterChange,
  onBackToHub,
  onRefresh,
}) => {
  const currency = summary?.currency ?? 'USD';
  const otherCurrencies = Math.max(0, (summary?.by_currency.length ?? 0) - 1);
  const countByType = (type: ReceiptType | '') =>
    type === ''
      ? (summary?.total_receipts ?? 0)
      : (summary?.by_type.find((entry) => entry.type === type)?.receipts ?? 0);

  return (
    <header
      data-testid="receipts-command-header"
      className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm overflow-hidden font-poppins w-full min-w-0"
    >
      <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 mb-3 rounded text-[10.5px] font-bold uppercase tracking-widest text-[#ae001a] hover:bg-[#ae001a] hover:text-white transition-colors duration-200 cursor-pointer font-poppins"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              arrow_back
            </span>
            {BILLING_HUB_LABEL}
          </button>
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#ae001a] tracking-wider uppercase font-poppins">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              receipt_long
            </span>
            <span>Core / Receipts</span>
          </div>
          <h1 className="mt-1 text-xl md:text-2xl font-black text-[#1d1c17] tracking-tight leading-tight font-poppins">
            Billing &amp; Transactions
          </h1>
          <p className="mt-1 text-sm text-[#5f5e5e] max-w-3xl leading-relaxed font-poppins">
            Receipts and invoices issued for paid orders. Every document carries an invoice number unique per
            merchant, its subtotal, taxes, discounts and grand total; deactivating a receipt is a logical deletion
            that keeps the financial history intact.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="self-start shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#d5cfc4] text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] transition-colors cursor-pointer font-poppins"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              refresh
            </span>
            Refresh metrics
          </button>
        )}
      </div>

      <section
        aria-label="Receipts KPIs"
        className="px-5 sm:px-6 pb-5 grid grid-cols-2 xl:grid-cols-4 gap-3 w-full min-w-0"
      >
        <KpiCard
          id="count"
          title={STATUS_COUNT_LABEL[statusFilter]}
          value={String(summary?.total_receipts ?? 0)}
          subtitle={`${summary?.locked_receipts ?? 0} fiscally locked`}
          icon="receipt_long"
          accent="red"
          loading={loading}
        />
        <KpiCard
          id="volume"
          title="Invoiced volume"
          value={formatMoney(summary?.grand_total ?? 0, currency)}
          subtitle={
            otherCurrencies > 0
              ? `Sum of grand total · +${otherCurrencies} other ${otherCurrencies === 1 ? 'currency' : 'currencies'}`
              : 'Sum of grand total'
          }
          icon="payments"
          accent="emerald"
          loading={loading}
        />
        <KpiCard
          id="tax"
          title="Taxes collected"
          value={formatMoney(summary?.total_tax ?? 0, currency)}
          subtitle={`Discounts ${formatMoney(summary?.total_discount ?? 0, currency)}`}
          icon="percent"
          accent="amber"
          loading={loading}
        />
        <KpiCard
          id="average"
          title="Average ticket"
          value={formatMoney(summary?.average_ticket ?? 0, currency)}
          subtitle={`${summary?.inactive_receipts ?? 0} logically deleted`}
          icon="query_stats"
          accent="zinc"
          loading={loading}
        />
      </section>

      <div className="px-5 sm:px-6 py-3 border-t border-[#f0ebe3] bg-[#faf8f5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick filters by receipt type">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] mr-1 font-poppins">
            Quick filters
          </span>
          {TYPE_CHIPS.map((chip) => {
            const active = typeFilter === chip.value;
            return (
              <button
                key={chip.value || 'all'}
                type="button"
                onClick={() => onTypeFilterChange(chip.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors duration-200 cursor-pointer font-poppins ${
                  active
                    ? 'bg-[#ae001a] border-[#ae001a] text-white shadow-xs'
                    : 'bg-white border-[#e8e2d8] text-[#1d1c17] hover:border-[#ae001a] hover:text-[#ae001a]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  {chip.icon}
                </span>
                {chip.label}
                <span
                  className={`px-1.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-[#f1ece4] text-[#5f5e5e]'}`}
                >
                  {loading ? '…' : countByType(chip.value)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#5f5e5e] font-poppins" aria-live="polite">
          {error
            ? error
            : `${summary?.active_receipts ?? 0} active · ${summary?.inactive_receipts ?? 0} inactive`}
        </p>
      </div>
    </header>
  );
};

export default ReceiptsCommandHeader;
