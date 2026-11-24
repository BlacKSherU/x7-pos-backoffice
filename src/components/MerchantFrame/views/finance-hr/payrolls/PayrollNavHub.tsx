import React from 'react';
import type { PayrollNavHubItem, PayrollNavHubProps, PayrollSubModuleId } from './types';
import {
  DEFAULT_PAYROLL_NAV_ITEMS,
  resolveActivePayrollTab,
} from './payroll-entries-helpers';

export type * from './types';

export const PayrollNavHub: React.FC<PayrollNavHubProps> = ({
  activeTab,
  currentRoute = '/finance-hr/payrolls/entries',
  onNavigate,
  onTabChange,
  onBack,
  backLabel = 'Return to Payrolls Hub',
  title = 'PAYROLLS HUB',
  showBadge = true,
  isPersistent = true,
  className = '',
  items = DEFAULT_PAYROLL_NAV_ITEMS,
}) => {
  // Determine active tab either from explicit prop or derived from current route
  const activeSubModule: PayrollSubModuleId = resolveActivePayrollTab(activeTab, currentRoute);

  const handleTabClick = (item: PayrollNavHubItem, e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate?.(item.id, item.path);
    onTabChange?.(item.id);
  };

  return (
    <nav
      aria-label="Payroll Navigation Hub"
      data-testid="payroll-nav-hub"
      data-current-route={currentRoute}
      data-active-tab={activeSubModule}
      className={`w-full z-40 bg-[#222222] border-t-2 border-[#ae001a] text-white shadow-2xl font-['Poppins',sans-serif] select-none transition-all duration-200 ${
        isPersistent ? 'fixed bottom-0 left-0 right-0' : 'relative'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 min-h-[50px] overflow-x-auto no-scrollbar">
        {/* Left Section: Back Action or Hub Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              title={backLabel}
              data-testid="payroll-nav-back-btn"
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 hover:bg-[#ae001a] text-zinc-300 hover:text-white border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_back
              </span>
            </button>
          )}

          {showBadge && (
            <div className="hidden md:flex items-center gap-2 pr-3 border-r border-zinc-800 shrink-0">
              <span
                className="material-symbols-outlined text-[#ae001a] text-xl"
                aria-hidden="true"
              >
                account_balance_wallet
              </span>
              <div className="leading-tight">
                <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase font-['Poppins',sans-serif] block">
                  Finance & HR
                </span>
                <span className="text-xs font-bold text-white tracking-wide font-['Poppins',sans-serif] block">
                  {title}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center Section: 4 Primary Payroll Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Payroll sub-modules"
          className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 flex-1 overflow-x-auto no-scrollbar py-0.5"
        >
          {items.map((item) => {
            const isActive = activeSubModule === item.id;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`nav-tab-${item.id}`}
                data-path={item.path}
                data-active={isActive ? 'true' : 'false'}
                onClick={(e) => handleTabClick(item, e)}
                title={`Navigate to ${item.label} (${item.path})`}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-['Poppins',sans-serif] tracking-wider uppercase transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 group rounded-md ${
                  isActive
                    ? 'text-white font-bold bg-zinc-800/50'
                    : 'text-zinc-400 font-medium hover:text-white hover:bg-zinc-800/30'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-base sm:text-lg transition-colors duration-200 ${
                    isActive
                      ? 'text-[#ae001a]'
                      : 'text-zinc-400 group-hover:text-[#ae001a]'
                  }`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span className="tracking-wide">{item.label}</span>

                {/* Underline indicator with corporate red accent */}
                {isActive && (
                  <span
                    data-testid="active-tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-[#ae001a] rounded-t-sm shadow-[0_-1px_6px_rgba(174,0,26,0.7)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Section: Active Route Status or Hub Indicator */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 pl-3 border-l border-zinc-800 text-[11px] font-['Poppins',sans-serif] text-zinc-400">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            aria-hidden="true"
          />
          <span className="font-mono text-zinc-300 text-[10px]" data-testid="payroll-nav-route-indicator">
            {currentRoute}
          </span>
        </div>
      </div>
    </nav>
  );
};
