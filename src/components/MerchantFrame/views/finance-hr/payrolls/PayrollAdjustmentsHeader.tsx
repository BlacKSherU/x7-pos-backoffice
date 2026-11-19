import React, { useId, useMemo, useState, useEffect } from 'react';
import type {
  PayrollAdjustment,
  PayrollAdjustmentType,
  PayrollAdjustmentsHeaderProps,
} from './types';
import {
  calculatePayrollAdjustmentsMetrics,
  filterPayrollAdjustments,
  formatCurrency,
} from './payroll-entries-helpers';

export type * from './types';

export const PayrollAdjustmentsHeader: React.FC<PayrollAdjustmentsHeaderProps> = ({
  adjustments,
  dataset,
  metrics: manualMetrics,
  selectedType: controlledType,
  selectedFilter,
  onTypeFilterChange,
  onFilterChange,
  searchQuery: controlledSearchQuery,
  onSearchChange,
  onFilteredAdjustmentsChange,
  onNewAdjustmentClick,
  onAddAdjustment,
  onOpenCreateModal,
  onNavigate,
  title = 'PAYROLL ADJUSTMENTS CONTROL',
  description = 'Audit and segment discretionary bonuses, staff advances, performance commissions, and manual deductions across active payroll runs.',
  isLoading = false,
  currency = 'USD',
  scopeMetricsToFilter = false,
  children,
}) => {
  const searchInputId = useId();

  // Support both adjustments and dataset props interchangeably
  const activeAdjustments: PayrollAdjustment[] = useMemo(
    () => adjustments ?? dataset ?? [],
    [adjustments, dataset],
  );

  // Search state (controlled or internal)
  const [internalSearch, setInternalSearch] = useState('');
  const currentSearch = controlledSearchQuery !== undefined ? controlledSearchQuery : internalSearch;

  // Type filter state (controlled or internal: 'ALL' | 'BONUS' | 'DEDUCTION')
  const effectiveControlledType = controlledType !== undefined ? controlledType : selectedFilter;
  const effectiveOnTypeFilterChange = onTypeFilterChange ?? onFilterChange;
  const [internalType, setInternalType] = useState<'ALL' | PayrollAdjustmentType>('ALL');
  const currentType = (effectiveControlledType !== undefined ? effectiveControlledType : internalType) as
    | 'ALL'
    | PayrollAdjustmentType;

  // Filtered adjustments based on type and search query
  const filteredAdjustments = useMemo(() => {
    return filterPayrollAdjustments(activeAdjustments, currentSearch, currentType);
  }, [activeAdjustments, currentSearch, currentType]);

  // Notify parent component whenever the filtered results change
  useEffect(() => {
    onFilteredAdjustmentsChange?.(filteredAdjustments);
  }, [filteredAdjustments, onFilteredAdjustmentsChange]);

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

  const handleTypeSelect = (type: 'ALL' | PayrollAdjustmentType) => {
    if (effectiveControlledType === undefined) {
      setInternalType(type);
    }
    effectiveOnTypeFilterChange?.(type);
  };

  const handleNewAction = () => {
    if (onNewAdjustmentClick) onNewAdjustmentClick();
    else if (onAddAdjustment) onAddAdjustment();
    else if (onOpenCreateModal) onOpenCreateModal();
  };

  // Compute metrics: Total Bonuses, Total Deductions, Net Adjustments
  const computedMetrics = useMemo(() => {
    const targetSet = scopeMetricsToFilter ? filteredAdjustments : activeAdjustments;
    const calculated = calculatePayrollAdjustmentsMetrics(targetSet);

    return {
      totalBonuses: manualMetrics?.totalBonuses ?? calculated.totalBonuses,
      totalDeductions: manualMetrics?.totalDeductions ?? calculated.totalDeductions,
      netAdjustmentTotal: manualMetrics?.netAdjustmentTotal ?? calculated.netAdjustmentTotal,
      bonusCount: manualMetrics?.bonusCount ?? calculated.bonusCount,
      deductionCount: manualMetrics?.deductionCount ?? calculated.deductionCount,
      totalCount: manualMetrics?.totalCount ?? calculated.totalCount,
    };
  }, [activeAdjustments, filteredAdjustments, manualMetrics, scopeMetricsToFilter]);

  const hasSearchFilter = currentSearch.trim().length > 0;

  return (
    <header
      className="w-full flex flex-col gap-6 font-['Poppins',sans-serif] text-[#1d1c17] select-none"
      data-testid="payroll-adjustments-header"
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
                Payroll Adjustments
              </span>
            </nav>

            {/* Header Title & Subtitle */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 text-[#ae001a] border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-2xl font-bold" aria-hidden="true">
                  tune
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

          {/* Primary Action Button: + NEW ADJUSTMENT */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={handleNewAction}
              data-testid="new-adjustment-btn"
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#ae001a] hover:bg-[#8e0015] active:bg-[#720011] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md"
              title="Add a new payroll adjustment"
            >
              <span
                className="material-symbols-outlined text-base font-bold transition-transform duration-200 group-hover:rotate-90"
                aria-hidden="true"
              >
                add_circle
              </span>
              <span>+ NEW ADJUSTMENT</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Monetary Metric Cards Strip: Bonuses vs. Deductions ──────────── */}
      <section
        aria-label="Payroll Adjustments Metrics"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
        data-testid="payroll-adjustments-metric-cards-strip"
      >
        {/* Card 1: Total Bonuses */}
        <div
          data-testid="kpi-total-bonuses"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/40 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Total Bonuses
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-red-50 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                trending_up
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div
              className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-none"
              data-testid="metric-value-total-bonuses"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.totalBonuses, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-700 font-bold">
                {computedMetrics.bonusCount} {computedMetrics.bonusCount === 1 ? 'bonus' : 'bonuses'}
              </span>
              <span>•</span>
              <span className="text-[#5f5e5e]">SUM(BONUS)</span>
            </p>
          </div>
        </div>

        {/* Card 2: Total Deductions */}
        <div
          data-testid="kpi-total-deductions"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500/40 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Total Deductions
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 group-hover:bg-red-50 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                trending_down
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div
              className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight leading-none"
              data-testid="metric-value-total-deductions"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.totalDeductions, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-rose-700 font-bold">
                {computedMetrics.deductionCount}{' '}
                {computedMetrics.deductionCount === 1 ? 'deduction' : 'deductions'}
              </span>
              <span>•</span>
              <span className="text-[#5f5e5e]">SUM(DEDUCTION)</span>
            </p>
          </div>
        </div>

        {/* Card 3: Net Adjustment Impact */}
        <div
          data-testid="kpi-net-adjustments"
          className="group relative bg-white border border-[#e8e2d8] hover:border-[#ae001a] p-5 rounded-xl shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 group-hover:bg-[#ae001a] transition-colors duration-200" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
              Net Adjustment Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 group-hover:bg-red-50 text-zinc-700 group-hover:text-[#ae001a] flex items-center justify-center transition-colors duration-200 shrink-0">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                tune
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${
                computedMetrics.netAdjustmentTotal >= 0 ? 'text-[#1d1c17]' : 'text-rose-700'
              }`}
              data-testid="metric-value-net-adjustments"
            >
              {isLoading ? (
                <span className="text-zinc-400 animate-pulse text-xl">Loading…</span>
              ) : (
                formatCurrency(computedMetrics.netAdjustmentTotal, currency)
              )}
            </div>
            <p className="text-[11px] text-[#8a8880] font-medium mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[#ae001a] font-bold">Bonuses − Deductions</span>
              <span>•</span>
              <span className="text-[#5f5e5e]">{computedMetrics.totalCount} Total</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Filter Controls (Bonus vs. Deduction) & Search Bar ───────────── */}
      <div
        className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 transition-all duration-200"
        data-testid="payroll-adjustments-filter-bar"
      >
        {/* Left: Adjustment Type Segmented Controls */}
        <div
          role="group"
          aria-label="Filter adjustments by type"
          className="inline-flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 shrink-0 self-start sm:self-auto overflow-x-auto no-scrollbar"
        >
          {/* Option: ALL */}
          <button
            type="button"
            onClick={() => handleTypeSelect('ALL')}
            data-testid="filter-type-all"
            aria-pressed={currentType === 'ALL'}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              currentType === 'ALL'
                ? 'bg-white text-[#ae001a] shadow-xs'
                : 'text-zinc-600 hover:text-[#ae001a] hover:bg-white/50'
            }`}
          >
            <span>ALL</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                currentType === 'ALL'
                  ? 'bg-red-50 text-[#ae001a]'
                  : 'bg-zinc-200 text-zinc-600'
              }`}
            >
              {activeAdjustments.length}
            </span>
          </button>

          {/* Option: BONUS */}
          <button
            type="button"
            onClick={() => handleTypeSelect('BONUS')}
            data-testid="filter-type-bonus"
            aria-pressed={currentType === 'BONUS'}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              currentType === 'BONUS'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-zinc-600 hover:text-emerald-700 hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm text-emerald-600" aria-hidden="true">
              trending_up
            </span>
            <span>BONUSES</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                currentType === 'BONUS'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-zinc-200 text-zinc-600'
              }`}
            >
              {computedMetrics.bonusCount}
            </span>
          </button>

          {/* Option: DEDUCTION */}
          <button
            type="button"
            onClick={() => handleTypeSelect('DEDUCTION')}
            data-testid="filter-type-deduction"
            aria-pressed={currentType === 'DEDUCTION'}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              currentType === 'DEDUCTION'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-zinc-600 hover:text-rose-700 hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm text-rose-600" aria-hidden="true">
              trending_down
            </span>
            <span>DEDUCTIONS</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                currentType === 'DEDUCTION'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-zinc-200 text-zinc-600'
              }`}
            >
              {computedMetrics.deductionCount}
            </span>
          </button>
        </div>

        {/* Right: Search Box & Children Slot */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
          <div className="relative flex-1 min-w-[220px]">
            <label htmlFor={searchInputId} className="sr-only">
              Search adjustments by collaborator, reason or description
            </label>
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8880] text-lg pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id={searchInputId}
              type="text"
              value={currentSearch}
              onChange={handleSearchChange}
              placeholder="Search adjustments..."
              data-testid="adjustments-search-input"
              className="w-full pl-9 pr-9 py-2 text-xs bg-zinc-50 border border-[#e8e2d8] rounded-lg text-[#1d1c17] placeholder-[#8a8880] focus:outline-none focus:border-[#ae001a] focus:bg-white transition-all duration-200 font-['Poppins',sans-serif]"
            />
            {hasSearchFilter && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search input"
                data-testid="clear-adjustments-search-btn"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8880] hover:text-[#ae001a] transition-colors p-0.5 rounded cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {children}
        </div>
      </div>
    </header>
  );
};
