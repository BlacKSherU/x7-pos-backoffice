import React, { useId, useMemo, useState, useEffect } from 'react';
import type { PayrollEntriesHeaderProps } from './types';
import {
  calculatePayrollMetrics,
  filterPayrollEntries,
  formatCurrency,
} from './payroll-entries-helpers';

export type * from './types';

export const PayrollEntriesHeader: React.FC<PayrollEntriesHeaderProps> = ({
  entries,
  dataset,
  metrics: manualMetrics,
  searchQuery: controlledSearchQuery,
  onSearchChange,
  onFilteredEntriesChange,
  onManualEntryClick,
  onOpenCreateModal,
  onAddEntry,
  onNavigate,
  title = 'PAYROLL ENTRIES COMMAND CONTROL',
  description = 'Inspect consolidated compensation metrics, monitor overtime accruals, and audit individual collaborator payroll entries in real-time.',
  isLoading = false,
  currency = 'USD',
  scopeMetricsToSearch = false,
  children,
}) => {
  const searchInputId = useId();
  // Support both `entries` and `dataset` props interchangeably
  const activeEntries = useMemo(() => entries ?? dataset ?? [], [entries, dataset]);

  // Handle controlled vs uncontrolled search state
  const [internalSearch, setInternalSearch] = useState('');
  const currentSearch = controlledSearchQuery !== undefined ? controlledSearchQuery : internalSearch;

  // Live filter entries based on current search across collaborator names and entry IDs
  const filteredEntries = useMemo(() => {
    return filterPayrollEntries(activeEntries, currentSearch);
  }, [activeEntries, currentSearch]);

  // Notify parent of live filtered entries whenever filtered result changes
  useEffect(() => {
    onFilteredEntriesChange?.(filteredEntries);
  }, [filteredEntries, onFilteredEntriesChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (controlledSearchQuery === undefined) {
      setInternalSearch(val);
    }
    onSearchChange?.(val);
  };

  const handleClearSearch = () => {
    if (controlledSearchQuery === undefined) {
      setInternalSearch('');
    }
    onSearchChange?.('');
  };

  const handleManualAction = () => {
    const handler = onManualEntryClick || onOpenCreateModal || onAddEntry;
    handler?.();
  };

  // Compute metrics from active dataset (or search-scoped subset if specified)
  const computedMetrics = useMemo(() => {
    if (
      manualMetrics?.totalBasePay !== undefined &&
      manualMetrics?.totalOvertimePay !== undefined &&
      manualMetrics?.totalNetPay !== undefined
    ) {
      return {
        totalBasePay: manualMetrics.totalBasePay,
        totalOvertimePay: manualMetrics.totalOvertimePay,
        totalNetPay: manualMetrics.totalNetPay,
        entryCount: manualMetrics.entryCount ?? activeEntries.length,
      };
    }

    const targetSet = scopeMetricsToSearch ? filteredEntries : activeEntries;
    const calculated = calculatePayrollMetrics(targetSet);

    return {
      totalBasePay: manualMetrics?.totalBasePay ?? calculated.totalBasePay,
      totalOvertimePay: manualMetrics?.totalOvertimePay ?? calculated.totalOvertimePay,
      totalNetPay: manualMetrics?.totalNetPay ?? calculated.totalNetPay,
      entryCount: manualMetrics?.entryCount ?? calculated.entryCount,
    };
  }, [activeEntries, filteredEntries, manualMetrics, scopeMetricsToSearch]);

  const hasSearchFilter = currentSearch.trim().length > 0;

  return (
    <header
      className="w-full flex flex-col gap-6 font-['Poppins',sans-serif] text-[#1d1c17] select-none"
      data-testid="payroll-entries-header"
    >
      {/* ── Main Command Bar & Breadcrumbs ───────────────────────────────── */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-xs transition-all duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            {/* Breadcrumb Navigation */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs font-bold text-[#5f5e5e] uppercase tracking-wider flex-wrap"
            >
              <button
                type="button"
                onClick={() => onNavigate?.('finance-hr')}
                className="hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                title="Navigate to Finance & HR"
              >
                Finance & HR
              </button>
              <span className="text-[#8a8880]" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onNavigate?.('payrolls')}
                className="hover:text-[#ae001a] transition-colors duration-200 cursor-pointer"
                title="Navigate to Payroll"
              >
                Payroll
              </button>
              <span className="text-[#8a8880]" aria-hidden="true">
                /
              </span>
              <span
                className="text-[#ae001a] font-black tracking-widest"
                aria-current="page"
              >
                Payroll Entries
              </span>
            </nav>

            {/* Header Title & Subtitle */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 text-[#ae001a] border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-2xl font-bold" aria-hidden="true">
                  payments
                </span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#1d1c17] tracking-tight uppercase leading-tight">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-[#5f5e5e] font-normal mt-0.5 max-w-3xl">
                  {description}
                </p>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={handleManualAction}
              data-testid="manual-payroll-entry-btn"
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#ae001a] hover:bg-[#8e0015] active:bg-[#720011] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md"
              title="Add a manual payroll entry"
            >
              <span
                className="material-symbols-outlined text-base font-bold transition-transform duration-200 group-hover:rotate-90"
                aria-hidden="true"
              >
                add
              </span>
              <span>+ MANUAL PAYROLL ENTRY</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Monetary Metric Cards Strip ──────────────────────────────────── */}
      <section
        aria-label="Payroll Compensation Metrics"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
        data-testid="payroll-metric-cards-strip"
      >
        {/* Card 1: Total Base Pay */}
        <div
          data-testid="kpi-base-pay"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Total Base Pay
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 group-hover:bg-red-50 text-zinc-700 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                payments
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div
              className="text-2xl sm:text-3xl font-black text-[#1d1c17] tracking-tight leading-none"
              data-testid="metric-value-base-pay"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.totalBasePay, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1">
              <span>Standard contracted compensation</span>
              <span className="text-[#ae001a] font-bold">SUM(base_pay)</span>
            </p>
          </div>
        </div>

        {/* Card 2: Overtime Pay */}
        <div
          data-testid="kpi-overtime-pay"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Overtime Pay
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 group-hover:bg-red-50 text-amber-800 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                payments
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div
              className="text-2xl sm:text-3xl font-black text-[#1d1c17] tracking-tight leading-none"
              data-testid="metric-value-overtime"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.totalOvertimePay, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1">
              <span>1.5x & 2.0x overtime additions</span>
              <span className="text-[#ae001a] font-bold">SUM(ot + double_ot)</span>
            </p>
          </div>
        </div>

        {/* Card 3: Net Total */}
        <div
          data-testid="kpi-net-total"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Net Payroll Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-red-50 text-emerald-800 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                account_balance_wallet
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div
              className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-none"
              data-testid="metric-value-net-total"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.totalNetPay, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1">
              <span>Final aggregated compensation</span>
              <span className="text-emerald-700 font-bold">SUM(net_total)</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Search & Filter Control Bar ──────────────────────────────────── */}
      <div
        className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-all duration-200"
        data-testid="payroll-search-filter-bar"
      >
        <div className="relative flex-1 min-w-[260px]">
          <label htmlFor={searchInputId} className="sr-only">
            Search payroll entries by collaborator name or entry ID
          </label>
          <span
            className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a8880] text-lg pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            id={searchInputId}
            type="text"
            value={currentSearch}
            onChange={handleSearchChange}
            placeholder="Search by collaborator name or entry ID..."
            aria-label="Search payroll entries"
            data-testid="payroll-search-input"
            className="w-full pl-10 pr-9 py-2 bg-[#fcfaf7] border border-[#e8e2d8] hover:border-[#ae001a] focus:border-[#ae001a] focus:bg-white focus:ring-1 focus:ring-[#ae001a] rounded-lg text-xs font-medium text-[#1d1c17] placeholder:text-[#8a8880] outline-none transition-all duration-200"
          />
          {hasSearchFilter && (
            <button
              type="button"
              onClick={handleClearSearch}
              data-testid="clear-search-btn"
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8880] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer p-0.5"
            >
              <span className="material-symbols-outlined text-sm font-bold" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>

        {/* Live Filter Counter Status */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#5f5e5e] shrink-0">
          <span
            data-testid="filter-results-counter"
            className="px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded-md text-[11px] font-bold text-zinc-700"
          >
            {hasSearchFilter
              ? `${filteredEntries.length} of ${activeEntries.length} entries`
              : `${activeEntries.length} total entries`}
          </span>

          {hasSearchFilter && (
            <button
              type="button"
              onClick={handleClearSearch}
              data-testid="reset-search-btn"
              className="text-[11px] font-bold text-[#ae001a] hover:underline uppercase tracking-wider cursor-pointer"
            >
              Reset Search
            </button>
          )}
        </div>

        {/* Custom filter controls slot */}
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
};

