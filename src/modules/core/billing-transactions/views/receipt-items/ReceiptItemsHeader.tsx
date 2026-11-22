import React from 'react';
import {
  hasActiveFilters,
  itemOptionLabel,
  itemOptionValue,
  type ReceiptItemFilters,
} from '@/modules/core/billing-transactions/lib/receipt-item-filters';
import { receiptOptionLabel } from '@/modules/core/billing-transactions/lib/receipt-item-math';
import type {
  ReceiptItemOption,
  ReceiptItemStatusFilter,
  ReceiptOption,
} from '@/modules/core/billing-transactions/types/receipt-items';

interface ReceiptItemsHeaderProps {
  filters: ReceiptItemFilters;
  onFiltersChange: (next: ReceiptItemFilters) => void;
  onReset: () => void;
  itemOptions: ReceiptItemOption[];
  receipts: ReceiptOption[];
  optionsLoading?: boolean;
}

// Same control shell as the canonical filter toolbar (OnlineOrderItemsView): 34px pill with
// a leading Material Symbol and a transparent native <select>.
const controlShell =
  'flex items-center h-[36px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all min-w-0';
const selectClass =
  'bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-poppins min-w-0 w-full truncate';

/**
 * Header of the Receipt Items workspace (Historia 16): title INVOICE LINE ITEMS, explanatory
 * subtitle and a single horizontal filter bar (description/SKU search, item selector,
 * invoice/receipt selector and logical status). The bar wraps instead of overlapping on
 * narrow widths.
 */
export const ReceiptItemsHeader: React.FC<ReceiptItemsHeaderProps> = ({
  filters,
  onFiltersChange,
  onReset,
  itemOptions,
  receipts,
  optionsLoading = false,
}) => {
  const set = <K extends keyof ReceiptItemFilters>(key: K, value: ReceiptItemFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const filtered = hasActiveFilters(filters);

  return (
    <header
      aria-labelledby="receipt-items-header-title"
      className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm font-poppins"
    >
      {/* Title block */}
      <div className="p-6 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
            list_alt
          </span>
          <h2
            id="receipt-items-header-title"
            className="text-[#ae001a] font-bold text-xl tracking-wider uppercase font-poppins"
          >
            INVOICE LINE ITEMS
          </h2>
        </div>
        <p data-testid="receipt-items-header-subtitle" className="text-[#5f5e5e] text-body-sm font-poppins max-w-3xl">
          Itemized breakdown of every billed line. Examine product costs, verify unit rates at full precision and
          audit each line against its invoice or receipt before totals are settled.
        </p>
        <p data-testid="receipt-items-header-help" className="text-[11px] text-[#76736a] font-poppins flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            info
          </span>
          Subtotal = quantity × unit price (rounded to 2 decimals) · Total = subtotal − discount. Receipt totals are
          recalculated on every change.
        </p>
      </div>

      {/* Horizontal filter bar */}
      <div
        role="search"
        aria-label="Filter receipt line items"
        data-testid="receipt-items-filter-bar"
        className="px-6 py-3 border-t border-[#f0ede6] flex flex-wrap items-center gap-2.5"
      >
        <div className="relative flex-1 basis-[260px] min-w-[220px]">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a] select-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search by description or SKU…"
            aria-label="Search by description or SKU"
            className="h-[36px] w-full pl-9 pr-3 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] transition-all font-poppins"
          />
        </div>

        <div className={`${controlShell} basis-[200px] max-w-[260px]`}>
          <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0" aria-hidden="true">
            inventory_2
          </span>
          <select
            value={filters.item}
            onChange={(e) => set('item', e.target.value)}
            aria-label="Filter by item"
            className={selectClass}
          >
            <option value="">{optionsLoading ? 'Loading items…' : `All items (${itemOptions.length})`}</option>
            {itemOptions.map((option) => (
              <option key={itemOptionValue(option)} value={itemOptionValue(option)}>
                {itemOptionLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className={`${controlShell} basis-[220px] max-w-[300px]`}>
          <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0" aria-hidden="true">
            receipt_long
          </span>
          <select
            value={filters.receiptId}
            onChange={(e) => set('receiptId', e.target.value)}
            aria-label="Filter by invoice or receipt"
            className={selectClass}
          >
            <option value="">{optionsLoading ? 'Loading receipts…' : 'All invoices / receipts'}</option>
            {receipts.map((receipt) => (
              <option key={receipt.id} value={String(receipt.id)}>
                {receiptOptionLabel(receipt)}
              </option>
            ))}
          </select>
        </div>

        <div className={`${controlShell} basis-[150px] max-w-[180px]`}>
          <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0" aria-hidden="true">
            toggle_on
          </span>
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value as ReceiptItemStatusFilter)}
            aria-label="Filter by status"
            className={selectClass}
          >
            <option value="true">Active lines</option>
            <option value="false">Deleted lines</option>
            <option value="all">All statuses</option>
          </select>
        </div>

        {filtered ? (
          <button
            type="button"
            onClick={onReset}
            className="h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[#ae001a] hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0 font-poppins"
            title="Reset all filters"
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              filter_alt_off
            </span>
            Reset
          </button>
        ) : null}
      </div>
    </header>
  );
};

export default ReceiptItemsHeader;
