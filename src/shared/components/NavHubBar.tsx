import React, { useEffect, useRef, useState } from 'react';

export interface NavHubItem {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  onClick: () => void;
}

export interface NavHubBarProps {
  title?: string;
  titleIcon?: string;
  subtitle?: string;
  activeModuleId?: string;
  items: NavHubItem[];
  className?: string;
  isSidebarCollapsed?: boolean;
  onBackToDashboard?: () => void;
  onBack?: () => void;
  backToDashboardLabel?: string;
}

const SPECIFIC_SHORTCUTS: Record<string, string> = {
  'PROCUREMENT & PURCHASE ORDERS': 'PURCHASE ORDERS',
  'STOCK LOCATIONS & BALANCE WORKSPACE': 'STOCK & BALANCE',
  'STOCK MOVEMENTS LOG': 'MOVEMENTS',
  'STORAGE LOCATIONS': 'LOCATIONS',
  'COMPANY MERCHANTS DIRECTORY': 'MERCHANTS',
  'COMPANY USERS DIRECTORY': 'USERS',
  'RM CATEGORIES': 'CATEGORIES',
  'RAW MATERIALS CATEGORIES': 'CATEGORIES',
  'RAW MATERIALS WORKSPACE': 'RAW MATERIALS',
  'QR CODE MENU SECTIONS': 'MENU SECTIONS',
  'QR CODE MENU ITEMS': 'MENU ITEMS',
  'QR ORDER ITEMS': 'ORDER ITEMS',
  'SUPPLIER INVOICE ITEMS': 'INVOICE ITEMS',
  'SUPPLIER PAYMENT ITEMS': 'PAYMENT ITEMS',
  'SUPPLIER PAYMENTS ALLOCATION': 'ALLOCATIONS',
  'AUTOMATION ACTION': 'ACTIONS',
  'AUTOMATION ACTIONS': 'ACTIONS',
  'CAMPAIGN AUDIENCE': 'AUDIENCES',
  'COUPON REDEMPTION': 'REDEMPTIONS',
  'REWARDS REDEMPTIONS': 'REDEMPTIONS',
  'POINT TRANSACTIONS': 'POINTS LOG',
  'SEGMENT RULE': 'RULES',
  'SEGMENT RULES': 'RULES',
  'CATEGORY MANAGEMENT': 'CATEGORIES',
  'PRODUCT MANAGMENT': 'PRODUCTS',
  'MODIFIERS MANAGEMENT': 'MODIFIERS',
  'VARIANTS MANAGEMENT': 'VARIANTS',
};

function formatNavHubLabel(rawLabel: string): string {
  if (!rawLabel) return '';
  const trimmed = rawLabel.trim();
  const uppercase = trimmed.toUpperCase();

  if (SPECIFIC_SHORTCUTS[uppercase]) {
    return SPECIFIC_SHORTCUTS[uppercase];
  }

  return (
    trimmed
      .replace(/^QR(\s*CODE|-CODE)?\s+/i, '')
      .replace(/^QR\s+/i, '')
      .replace(/^RAW\s+MATERIALS?\s+/i, '')
      .replace(/^ACCOUNTS?\s+PAYABLE\s+/i, '')
      .replace(/^SUPPLIER\s+/i, '')
      .replace(/^MERCHANT\s+/i, '')
      .replace(/^COMPANY\s+/i, '')
      .replace(/^KITCHEN\s+/i, '')
      .replace(/^ONLINE\s+(ORDERING\s+)?/i, '')
      .replace(/^LOYALTY\s+/i, '')
      .replace(/^MARKETING\s+/i, '')
      .replace(/\s+(MANAGEMENT|MANAGMENT)$/i, '')
      .trim() || trimmed
  );
}

export const NavHubBar: React.FC<NavHubBarProps> = ({
  title,
  titleIcon,
  activeModuleId,
  items = [],
  className = '',
  isSidebarCollapsed: propIsSidebarCollapsed,
  onBackToDashboard,
  onBack,
  backToDashboardLabel,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const handleBack = onBackToDashboard || onBack;
  // Deferred scroll resets from scrollToPageTop. Cancelled on unmount: a pending
  // timer that fires after the page (or a test's jsdom) is gone throws
  // "document is not defined".
  const pendingFrame = useRef<number | null>(null);
  const pendingTimeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
      if (pendingTimeout.current !== null) window.clearTimeout(pendingTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (propIsSidebarCollapsed !== undefined) {
      void Promise.resolve().then(() => {
        setCollapsed(propIsSidebarCollapsed);
      });
      return;
    }

    const checkSidebar = () => {
      const aside = document.querySelector('aside');
      if (aside) {
        setCollapsed(aside.classList.contains('-translate-x-full'));
      }
    };

    void Promise.resolve().then(() => {
      checkSidebar();
    });
    const aside = document.querySelector('aside');
    if (!aside) return;

    const observer = new MutationObserver(checkSidebar);
    observer.observe(aside, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [propIsSidebarCollapsed]);

  // Same offset as MerchantFrame's <main> (`left-64` without prefix): responsive
  // variants (`md:`) do not generate CSS in this app, so `md:left-64` kept the
  // bar always at left-0, underneath the sidebar.
  const leftOffsetClass = collapsed ? 'left-0' : 'left-64';

  const scrollToPageTop = () => {
    const scrollTargets = [
      document.querySelector('main'),
      document.documentElement,
      document.body,
    ];
    for (const el of scrollTargets) {
      if (el) {
        el.scrollTop = 0;
        try {
          el.scrollTo({ top: 0, behavior: 'instant' });
        } catch {
          // fallback
        }
      }
    }
    window.scrollTo(0, 0);

    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    if (pendingTimeout.current !== null) window.clearTimeout(pendingTimeout.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    pendingTimeout.current = window.setTimeout(() => {
      pendingTimeout.current = null;
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
      window.scrollTo(0, 0);
    }, 30);
  };

  return (
    <div
      className={`fixed bottom-0 ${leftOffsetClass} right-0 z-40 bg-[#222222] border-t-2 border-[#ae001a] text-white py-2 px-4 shadow-2xl font-sans transition-all duration-300 ease-in-out ${className}`}
    >
      <div className="w-full flex items-center justify-between relative min-h-[36px] gap-2 sm:gap-4">
        {/* Left Slot: Back Button (or Module Title) with Distinct Separation */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
          {handleBack ? (
            <>
              <button
                type="button"
                onClick={() => {
                  scrollToPageTop();
                  handleBack();
                }}
                className="flex items-center justify-center w-8 h-8 bg-[#ae001a] hover:bg-[#900015] text-white rounded transition-all shadow-xs cursor-pointer select-none shrink-0"
                title={backToDashboardLabel || 'Return to Main Dashboard'}
                aria-label={backToDashboardLabel || 'Return to Main Dashboard'}
              >
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
              </button>
              <div className="h-5 w-px bg-zinc-700/80 ml-1 mr-2 hidden sm:block" aria-hidden="true" />
            </>
          ) : title ? (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#e8e2d8] uppercase mr-2 shrink-0">
              {titleIcon && (
                <span className="material-symbols-outlined text-[#ae001a] text-[20px]" aria-hidden="true">
                  {titleIcon}
                </span>
              )}
              <span>{title}</span>
              <div className="h-5 w-px bg-zinc-700/80 ml-2" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {/* Center Slot: Navigation Buttons Array (Spaced & Centered in 1 Single Line) */}
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
          {items.map((item) => {
            const isActive = item.active || (activeModuleId ? item.id === activeModuleId : false);
            const displayLabel = formatNavHubLabel(item.label);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  scrollToPageTop();
                  item.onClick();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold sm:font-bold transition-colors duration-200 flex items-center gap-1 sm:gap-1.5 cursor-pointer font-sans select-none whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#ae001a] text-white shadow-xs'
                    : 'text-zinc-300 hover:text-[#ae001a] hover:bg-zinc-800'
                }`}
              >
                {item.icon && (
                  <span className="material-symbols-outlined text-[17px] sm:text-[18px] shrink-0" aria-hidden="true">{item.icon}</span>
                )}
                <span>{displayLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Right Slot: Optical Balance Spacer */}
        {handleBack ? (
          <div className="hidden lg:flex items-center shrink-0 w-8 mr-1" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
};
