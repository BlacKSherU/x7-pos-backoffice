import React, { useEffect, useRef, useState } from 'react';
import {
  isFeatureAuthorized,
  subscribeAuthorizedFeatures,
} from '@/platform/navigation/module-nav-hubs';

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

const ITEM_ID_SHORTCUTS: Record<string, string> = {
  // POS
  'orders': 'ORDERS',
  'order-items': 'ITEMS',
  'order-item-modifiers': 'MODIFIERS',
  'order-discounts': 'DISCOUNTS',
  'order-payments': 'PAYMENTS',
  'order-taxes': 'TAXES',

  // Tips
  'tip-movements': 'CASH TIPS',
  'tip-pool-members': 'MEMBERS',
  'tip-settlements': 'SETTLEMENTS',
  'tips': 'LEDGER',
  'tips-allocations': 'ALLOCATIONS',
  'tips-pools': 'POOLS',

  // Online Ordering
  'online-stores': 'STORES',
  'online-menus': 'MENUS',
  'online-menu-categories': 'CATEGORIES',
  'online-menu-items': 'ITEMS',
  'online-orders': 'ORDERS',
  'online-payments': 'PAYMENTS',
  'online-order-items': 'ORDER ITEMS',
  'online-delivery-info': 'DELIVERY',

  // Marketing System
  'marketing-campaign': 'CAMPAIGNS',
  'marketing-automation': 'WORKFLOWS',
  'marketing-automation-action': 'ACTIONS',
  'marketing-campaign-audience': 'AUDIENCE',
  'marketing-coupon': 'COUPONS',
  'marketing-coupon-redemption': 'REDEMPTIONS',
  'marketing-message-log': 'LOGS',
  'marketing-segment': 'SEGMENTS',
  'marketing-segment-rule': 'RULES',

  // Loyalty System
  'loyalty-customers': 'CUSTOMERS',
  'loyalty-coupons': 'COUPONS',
  'loyalty-point-transactions': 'POINTS',
  'loyalty-programs': 'PROGRAMS',
  'loyalty-rewards': 'REWARDS',
  'loyalty-rewards-redemptions': 'REDEMPTIONS',
  'loyalty-tiers': 'TIERS',

  // Cash Drawers
  'cash-drawer-history': 'HISTORY',
  'cash-drawers': 'DRAWERS',
  'cash-movements': 'MOVEMENTS',
  'cash-shifts': 'SHIFTS',
  'cash-transactions': 'TRANSACTIONS',

  // Shifts
  'shift-assignment': 'ASSIGNMENTS',
  'shifts': 'TIMELINE',

  // Dining System
  'floor-plans': 'FLOOR PLANS',
  'table-assignments': 'ASSIGNMENTS',
  'table-zones': 'ZONES',
  'tables': 'TABLES',

  // Reservations
  'reservation-guests': 'GUESTS',
  'reservation-notes': 'NOTES',
  'reservation-status-history': 'HISTORY',
  'reservation-tables': 'TABLES',
  'reservations': 'BOOKINGS',

  // Accounts Payable
  'supplier-credit-notes': 'CREDIT NOTES',
  'supplier-invoice-items': 'INVOICE ITEMS',
  'supplier-invoices': 'INVOICES',
  'supplier-payment-items': 'PAYMENT ITEMS',
  'supplier-payments': 'PAYMENTS',
  'supplier-payments-allocation': 'ALLOCATIONS',

  // Payrolls
  'payroll-runs': 'RUNS',
  'payroll-entries': 'ENTRIES',
  'payroll-adjustments': 'ADJUSTMENTS',
  'payroll-tax-detail': 'TAX DETAIL',

  // Delivery Management
  'delivery-assignments': 'ASSIGNMENTS',
  'delivery-drivers': 'DRIVERS',
  'delivery-fees': 'FEES',
  'delivery-tracking': 'TRACKING',
  'delivery-zones': 'ZONES',

  // Configuration
  'merchant-overtime-rules': 'OVERTIME',
  'merchant-payroll-rules': 'PAYROLL',
  'merchant-tax-rules': 'TAX RULES',
  'merchant-tips-rules': 'TIP RULES',

  // Billing & Transactions
  'receipt-items': 'RECEIPT ITEMS',
  'receipt-orders': 'RECEIPTS',
  'receipt-taxes': 'RECEIPT TAXES',

  // Financial Engine
  'journal-entries': 'ENTRIES',
  'journal-entries-lines': 'ENTRY LINES',
  'ledger-accounts': 'ACCOUNTS',

  // Business Partners
  'customers': 'CUSTOMERS',
  'suppliers': 'SUPPLIERS',

  // Food Costing
  'actual-cost-variance': 'VARIANCE',
  'recipes': 'RECIPES',
  'recipe-ingredients': 'INGREDIENTS',
  'theoretical-cost': 'THEORETICAL',

  // Table Turnover
  'table-turnover-analytics': 'ANALYTICS',
  'course-timing-alerts': 'PACING ALERTS',
  'turnover-benchmarks': 'BENCHMARKS',

  // Subscription System
  'apps-config': 'APPLICATIONS',
  'features-control': 'FEATURES',
  'merchant-subs-link': 'MERCHANT SUBS',
  'plan-apps-rules': 'PLAN APPS',
  'plan-features-mapping': 'PLAN FEATURES',
  'sub-plans-core': 'PLANS',
  'sub-apps-mapping': 'ACTIVE APPS',
  'sub-payments-billing': 'PAYMENTS',

  // HR
  'collaborators': 'COLLABORATORS',
  'collaborators-contracts': 'CONTRACTS',
  'collaborators-time-entries': 'TIME ENTRIES',

  // KDS
  'kitchen-stations': 'STATIONS',
  'kitchen-display-devices': 'DEVICES',
  'kitchen-orders': 'ORDERS',
  'kitchen-order-items': 'ORDER ITEMS',
  'kitchen-event-log': 'EVENT LOG',
  'kitchen-performance': 'PERFORMANCE',

  // Products & Raw Materials
  'categories': 'CATEGORIES',
  'products': 'PRODUCTS',
  'variants': 'VARIANTS',
  'modifiers': 'MODIFIERS',
  'raw-material-categories': 'CATEGORIES',
  'raw-materials': 'RAW MATERIALS',
  'purchase-orders': 'PURCHASE ORDERS',
  'stock-inventory': 'STOCK & BALANCE',
  'stock-movements': 'MOVEMENTS',
  'locations': 'LOCATIONS',
};

const SPECIFIC_SHORTCUTS: Record<string, string> = {
  // POS
  'ORDER DISCOUNTS & PROMOTIONS': 'DISCOUNTS',
  'ORDER DISCOUNTS': 'DISCOUNTS',
  'ORDER ITEMS & COURSE ROUTING': 'ITEMS',
  'ORDER ITEMS': 'ITEMS',
  'ORDER MODIFIERS & UPCHARGES': 'MODIFIERS',
  'ORDER ITEM MODIFIERS': 'MODIFIERS',
  'ORDER PAYMENT TENDERS': 'PAYMENTS',
  'ORDER PAYMENTS': 'PAYMENTS',
  'ORDER TAXES & SURCHARGES': 'TAXES',
  'ORDER TAXES': 'TAXES',
  'POINT OF SALE ORDERS & BILLS': 'ORDERS',
  'POINT OF SALE ORDERS': 'ORDERS',
  'POS ORDERS': 'ORDERS',

  // Tips
  'CASH TIP MOVEMENTS & SHIFTS': 'CASH TIPS',
  'CASH TIP MOVEMENTS': 'CASH TIPS',
  'TIP MOVEMENTS': 'CASH TIPS',
  'TIP POOL MEMBER ELIGIBILITY': 'MEMBERS',
  'TIP POOL MEMBERS': 'MEMBERS',
  'TIP PAYOUT SETTLEMENTS': 'SETTLEMENTS',
  'GRATUITY & TIPS LEDGER': 'LEDGER',
  'TIPS LEDGER': 'LEDGER',
  'STAFF TIP ALLOCATIONS MATRIX': 'ALLOCATIONS',
  'STAFF TIP ALLOCATIONS': 'ALLOCATIONS',
  'TIP ALLOCATIONS': 'ALLOCATIONS',
  'TIP POOLING CONFIGURATIONS': 'POOLS',
  'TIP POOLS': 'POOLS',

  // Online Ordering
  'ONLINE STORES DIRECTORY': 'STORES',
  'ONLINE STORES WORKSPACE': 'STORES',
  'ONLINE STORES': 'STORES',
  'STORES DIRECTORY': 'STORES',
  'DIGITAL STORE MENUS': 'MENUS',
  'ONLINE MENUS MANAGEMENT': 'MENUS',
  'ONLINE MENUS': 'MENUS',
  'STORE MENU CATEGORIES': 'CATEGORIES',
  'MENU CATEGORIES TAXONOMY': 'CATEGORIES',
  'MENU CATEGORIES': 'CATEGORIES',
  'ONLINE STORE CATALOG ITEMS': 'ITEMS',
  'ONLINE MENU ITEMS CATALOG': 'ITEMS',
  'STORE CATALOG ITEMS': 'ITEMS',
  'ONLINE MENU ITEMS': 'ITEMS',
  'ONLINE ORDERS DISPATCH QUEUE': 'ORDERS',
  'ONLINE ORDERS DISPATCH': 'ORDERS',
  'ORDERS DISPATCH QUEUE': 'ORDERS',
  'ONLINE ORDERS': 'ORDERS',
  'DIGITAL PAYMENTS GATEWAY': 'PAYMENTS',
  'ONLINE PAYMENTS': 'PAYMENTS',
  'ITEMIZED ORDER DETAILS': 'ORDER ITEMS',
  'ONLINE ORDER ITEMS': 'ORDER ITEMS',
  'DELIVERY LOGISTICS & COVERAGE': 'DELIVERY',
  'ONLINE DELIVERY INFO': 'DELIVERY',
  'ONLINE DELIVERY': 'DELIVERY',

  // Marketing System
  'OMNICHANNEL MARKETING CAMPAIGNS': 'CAMPAIGNS',
  'MARKETING CAMPAIGNS': 'CAMPAIGNS',
  'AUTOMATED MARKETING WORKFLOWS': 'WORKFLOWS',
  'MARKETING AUTOMATION': 'WORKFLOWS',
  'MARKETING AUTOMATION ACTIONS': 'ACTIONS',
  'MARKETING AUTOMATION ACTION': 'ACTIONS',
  'TARGET CAMPAIGN AUDIENCES': 'AUDIENCE',
  'MARKETING CAMPAIGN AUDIENCE': 'AUDIENCE',
  'PROMOTIONAL MARKETING COUPONS': 'COUPONS',
  'MARKETING COUPONS': 'COUPONS',
  'MARKETING COUPON REDEMPTIONS': 'REDEMPTIONS',
  'COUPON REDEMPTIONS': 'REDEMPTIONS',
  'MARKETING MESSAGE DISPATCH LOG': 'LOGS',
  'MESSAGE DISPATCH LOG': 'LOGS',
  'MARKETING MESSAGE LOG': 'LOGS',
  'CUSTOMER SEGMENTATION DIRECTORY': 'SEGMENTS',
  'MARKETING SEGMENTS': 'SEGMENTS',
  'SEGMENTATION LOGIC & CRITERIA': 'RULES',
  'MARKETING SEGMENT RULES': 'RULES',
  'MARKETING SEGMENT RULE': 'RULES',

  // Loyalty System
  'LOYALTY CUSTOMER ACCOUNTS': 'CUSTOMERS',
  'LOYALTY CUSTOMERS': 'CUSTOMERS',
  'LOYALTY PROMOTIONAL COUPONS': 'COUPONS',
  'LOYALTY COUPONS': 'COUPONS',
  'LOYALTY POINTS LEDGER': 'POINTS',
  'LOYALTY POINT TRANSACTIONS': 'POINTS',
  'LOYALTY PROGRAM RULES': 'PROGRAM RULES',
  'LOYALTY PROGRAMS': 'PROGRAM RULES',
  'REDEEMABLE LOYALTY REWARDS': 'REWARDS',
  'LOYALTY REWARDS': 'REWARDS',
  'REWARD REDEMPTIONS HISTORY': 'REDEMPTIONS',
  'LOYALTY REWARDS REDEMPTIONS': 'REDEMPTIONS',
  'CUSTOMER VIP MEMBERSHIP TIERS': 'TIERS',
  'LOYALTY TIERS': 'TIERS',

  // Cash Drawers
  'CASH DRAWER HISTORY': 'HISTORY',
  'CASH DRAWERS DIRECTORY': 'DRAWERS',
  'CASH DRAWERS': 'DRAWERS',
  'CASH DRAWER MOVEMENTS': 'MOVEMENTS',
  'CASH MOVEMENTS': 'MOVEMENTS',
  'CASHIER SHIFT SESSIONS': 'SHIFTS',
  'CASH SHIFTS': 'SHIFTS',
  'CASH TRANSACTION LEDGER': 'TRANSACTIONS',
  'CASH TRANSACTIONS': 'TRANSACTIONS',

  // Shifts
  'WEEKLY SHIFT ASSIGNMENT MATRIX': 'ASSIGNMENTS',
  'SHIFT ASSIGNMENTS': 'ASSIGNMENTS',
  'SHIFT ASSIGNMENT': 'ASSIGNMENTS',
  'DAILY STAFF SHIFTS TIMELINE': 'TIMELINE',
  'DAILY STAFF SHIFTS': 'TIMELINE',
  'STAFF SHIFTS': 'TIMELINE',

  // Dining System
  'DINING ROOM FLOOR PLANS': 'FLOOR PLANS',
  'FLOOR PLANS': 'FLOOR PLANS',
  'STAFF TABLE ASSIGNMENTS': 'ASSIGNMENTS',
  'TABLE ASSIGNMENTS': 'ASSIGNMENTS',
  'DINING ROOM TABLE ZONES': 'ZONES',
  'TABLE ZONES': 'ZONES',
  'GUEST TABLE INVENTORY': 'TABLES',

  // Reservations
  'RESERVATION GUEST BOOK': 'GUESTS',
  'RESERVATION GUESTS': 'GUESTS',
  'RESERVATION DIETARY & SEATING NOTES': 'NOTES',
  'RESERVATION NOTES': 'NOTES',
  'RESERVATION STATUS AUDIT HISTORY': 'HISTORY',
  'RESERVATION STATUS HISTORY': 'HISTORY',
  'TABLE ALLOCATION & SEATING': 'TABLES',
  'RESERVATION TABLES': 'TABLES',
  'MASTER RESERVATION BOOK': 'BOOKINGS',
  'RESERVATIONS': 'BOOKINGS',

  // Accounts Payable
  'SUPPLIER CREDIT NOTES': 'CREDIT NOTES',
  'SUPPLIER INVOICE LINE ITEMS': 'INVOICE ITEMS',
  'SUPPLIER INVOICE ITEMS': 'INVOICE ITEMS',
  'SUPPLIER INVOICES DIRECTORY': 'INVOICES',
  'SUPPLIER INVOICES': 'INVOICES',
  'PAYMENT BREAKDOWN DETAILS': 'PAYMENT ITEMS',
  'SUPPLIER PAYMENT ITEMS': 'PAYMENT ITEMS',
  'SUPPLIER PAYMENT VOUCHERS': 'PAYMENTS',
  'SUPPLIER PAYMENTS': 'PAYMENTS',
  'INVOICE PAYMENT ALLOCATIONS': 'ALLOCATIONS',
  'SUPPLIER PAYMENTS ALLOCATION': 'ALLOCATIONS',

  // Payrolls
  'PAYROLL CALCULATION RUNS': 'RUNS',
  'PAYROLL RUNS': 'RUNS',
  'EMPLOYEE PAYROLL ENTRIES': 'ENTRIES',
  'PAYROLL ENTRIES': 'ENTRIES',
  'PAYROLL ADJUSTMENTS & BONUSES': 'ADJUSTMENTS',
  'PAYROLL ADJUSTMENTS': 'ADJUSTMENTS',
  'PAYROLL TAX DETAIL & WITHHOLDINGS': 'TAX DETAIL',
  'PAYROLL TAX DETAIL': 'TAX DETAIL',

  // Delivery Management
  'DRIVER DELIVERY ASSIGNMENTS': 'ASSIGNMENTS',
  'DELIVERY ASSIGNMENTS': 'ASSIGNMENTS',
  'DELIVERY COURIER FLEET DIRECTORY': 'DRIVERS',
  'DELIVERY DRIVERS': 'DRIVERS',
  'DELIVERY FEE STRUCTURE & RATES': 'FEES',
  'DELIVERY FEES': 'FEES',
  'LIVE DELIVERY GPS TRACKING': 'TRACKING',
  'DELIVERY TRACKING': 'TRACKING',
  'DELIVERY ZONES & GEOFENCING': 'ZONES',
  'DELIVERY ZONES': 'ZONES',

  // Configuration
  'OVERTIME CALCULATION RULES': 'OVERTIME',
  'MERCHANT OVERTIME RULES': 'OVERTIME',
  'PAYROLL PROCESSING RULES': 'PAYROLL',
  'MERCHANT PAYROLL RULES': 'PAYROLL',
  'MERCHANT TAX RULES MATRIX': 'TAX RULES',
  'MERCHANT TAX RULES': 'TAX RULES',
  'GRATUITY & TIP CALCULATION RULES': 'TIP RULES',
  'MERCHANT TIPS RULES': 'TIP RULES',

  // Billing & Transactions
  'ITEMIZED RECEIPT LINE ITEMS': 'RECEIPT ITEMS',
  'RECEIPT ITEMS': 'RECEIPT ITEMS',
  'CUSTOMER SALES RECEIPTS': 'RECEIPTS',
  'RECEIPT ORDERS': 'RECEIPTS',
  'RECEIPT TAX LINE BREAKDOWN': 'RECEIPT TAXES',
  'RECEIPTS TAXES': 'RECEIPT TAXES',

  // Financial Engine
  'GENERAL JOURNAL ENTRIES': 'ENTRIES',
  'JOURNAL ENTRIES': 'ENTRIES',
  'JOURNAL ENTRY LINE DETAILS': 'ENTRY LINES',
  'JOURNAL ENTRIES LINES': 'ENTRY LINES',
  'CHART OF ACCOUNTS & LEDGER': 'ACCOUNTS',
  'LEDGER ACCOUNTS': 'ACCOUNTS',

  // Business Partners
  'CUSTOMER BILLING DIRECTORY': 'CUSTOMERS',
  'MASTER SUPPLIER DIRECTORY': 'SUPPLIERS',

  // Food Costing
  'ACTUAL COST VARIANCE ANALYSIS': 'VARIANCE',
  'ACTUAL COST VARIANCE': 'VARIANCE',
  'PRODUCTION FORMULAS & RECIPES': 'RECIPES',
  'RECIPES & FOOD COSTING': 'RECIPES',
  'RECIPE INGREDIENTS & PORTIONS': 'INGREDIENTS',
  'RECIPE INGREDIENTS': 'INGREDIENTS',
  'THEORETICAL COST BENCHMARKS': 'THEORETICAL',
  'THEORETICAL COST': 'THEORETICAL',

  // Table Turnover
  'TABLE TURNOVER ANALYTICS': 'ANALYTICS',
  'COURSE TIMING & ALERT PACING': 'PACING ALERTS',
  'SERVICE TURNOVER BENCHMARKS': 'BENCHMARKS',
  'TABLE TURNOVER OPTIMIZATION WORKSPACE': 'TURNOVER',

  // Subscription System
  'PLATFORM APPLICATIONS CATALOG': 'APPLICATIONS',
  'FEATURE FLAGS & ENTITLEMENTS': 'FEATURES',
  'MERCHANT SUBSCRIPTIONS DIRECTORY': 'MERCHANT SUBS',
  'PLAN APPLICATION INCLUSIONS': 'PLAN APPS',
  'PLAN FEATURE CAPABILITIES MAPPING': 'PLAN FEATURES',
  'SOFTWARE SUBSCRIPTION PLANS': 'PLANS',
  'ACTIVE MERCHANT APPLICATIONS': 'ACTIVE APPS',
  'SUBSCRIPTION BILLING INVOICES': 'PAYMENTS',

  // HR
  'STAFF COLLABORATOR DIRECTORY': 'COLLABORATORS',
  'EMPLOYMENT CONTRACTS': 'CONTRACTS',
  'COLLABORATOR TIME & ATTENDANCE': 'TIME ENTRIES',

  // Inventory / Supplies
  'PROCUREMENT & PURCHASE ORDERS': 'PURCHASE ORDERS',
  'PURCHASE ORDERS MANAGEMENT': 'PURCHASE ORDERS',
  'STOCK LOCATIONS & BALANCE WORKSPACE': 'STOCK & BALANCE',
  'STOCK LEVELS & BALANCES': 'STOCK & BALANCE',
  'STOCK MOVEMENTS LOG': 'MOVEMENTS',
  'STOCK MOVEMENTS & AUDIT': 'MOVEMENTS',
  'STORAGE LOCATIONS': 'LOCATIONS',
  'INVENTORY STORAGE LOCATIONS': 'LOCATIONS',
  'RAW MATERIAL CATEGORIES': 'CATEGORIES',
  'RAW MATERIALS WORKSPACE': 'RAW MATERIALS',
};

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => {
      const lower = w.toLowerCase();
      if (['pos', 'kds', 'qr', 'vat', 'sla', 'id', 'emv', 'sms', 'gps', 'eta', 'vip'].includes(lower)) {
        return lower.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function formatNavHubLabel(rawLabel: string, itemId?: string): string {
  if (itemId && ITEM_ID_SHORTCUTS[itemId]) {
    return toTitleCase(ITEM_ID_SHORTCUTS[itemId]);
  }
  if (!rawLabel) return '';
  const trimmed = rawLabel.trim();
  const uppercase = trimmed.toUpperCase();

  if (SPECIFIC_SHORTCUTS[uppercase]) {
    return toTitleCase(SPECIFIC_SHORTCUTS[uppercase]);
  }

  const cleaned = trimmed
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
    .trim() || trimmed;

  return toTitleCase(cleaned);
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
  const [, setAuthTick] = useState(0);
  useEffect(() => subscribeAuthorizedFeatures(() => setAuthTick((t) => t + 1)), []);

  const authorizedItems = items.filter((item) => isFeatureAuthorized(item.id));
  const visibleItems = authorizedItems.length > 0 ? authorizedItems : items;

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
      className={`fixed bottom-0 ${leftOffsetClass} right-0 z-40 bg-[#222222] border-t-2 border-[#ae001a] text-white py-1.5 px-2 sm:px-3 shadow-2xl font-sans transition-all duration-300 ease-in-out ${className}`}
    >
      <div className="w-full flex items-center justify-between relative min-h-[34px] gap-1 sm:gap-2">
        {/* Left Slot: Back Button (or Module Title) with Distinct Separation */}
        <div className="flex items-center gap-1.5 shrink-0 z-10">
          {handleBack ? (
            <>
              <button
                type="button"
                onClick={() => {
                  scrollToPageTop();
                  handleBack();
                }}
                className="flex items-center justify-center w-7 h-7 bg-[#ae001a] hover:bg-[#900015] text-white rounded transition-all shadow-xs cursor-pointer select-none shrink-0"
                title={backToDashboardLabel || 'Return to Main Dashboard'}
                aria-label={backToDashboardLabel || 'Return to Main Dashboard'}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
              </button>
              <div className="h-4 w-px bg-zinc-700/80 ml-0.5 mr-1 hidden sm:block" aria-hidden="true" />
            </>
          ) : title ? (
            <div className="hidden xl:flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-wider text-[#e8e2d8] uppercase mr-2 shrink-0">
              {titleIcon && (
                <span className="material-symbols-outlined text-[#ae001a] text-[18px]" aria-hidden="true">
                  {titleIcon}
                </span>
              )}
              <span>{title}</span>
              <div className="h-4 w-px bg-zinc-700/80 ml-2" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {/* Center Slot: Navigation Buttons Array (Spaced & Centered in 1 Single Line) */}
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0 py-0.5">
          {visibleItems.map((item) => {
            const isActive = item.active || (activeModuleId ? item.id === activeModuleId : false);
            const displayLabel = formatNavHubLabel(item.label, item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  scrollToPageTop();
                  item.onClick();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold sm:font-bold transition-colors duration-200 flex items-center gap-1 cursor-pointer font-sans select-none whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#ae001a] text-white shadow-xs'
                    : 'text-zinc-300 hover:text-[#ae001a] hover:bg-zinc-800'
                }`}
              >
                {item.icon && (
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0" aria-hidden="true">{item.icon}</span>
                )}
                <span>{displayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
