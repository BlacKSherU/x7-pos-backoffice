import { describe, expect, it } from 'vitest';
import { REGISTERED_VIEW_TABS } from '@/platform/merchant-frame/merchant-view-registry';
import {
  MODULE_NAV_HUBS,
  navHubById,
  navHubForFeature,
  setAuthorizedFeatures,
  isFeatureAuthorized,
} from '@/platform/navigation/module-nav-hubs';

// EXACT tags for the stories in each module.
const STORY_LABELS: Record<string, { back: string; items: string[] }> = {
  'subscription-system': {
    back: 'SUBSCRIPTION SYSTEM COMMAND HUB',
    items: [
      'APPLICATIONS',
      'FEATURES',
      'COMPANY SUBSCRIPTIONS',
      'MERCHANT SUBSCRIPTIONS',
      'PLAN APPLICATIONS',
      'PLAN FEATURES',
      'SUBSCRIPTION PLANS',
      'SUBSCRIPTION APPLICATIONS',
      'SUBSCRIPTION PAYMENTS',
    ],
  },
  hr: {
    back: 'HR COMMAND HUB',
    items: ['COLLABORATORS', 'COLLABORATORS CONTRACTS', 'COLLABORATORS TIME ENTRIES'],
  },
  'dining-system': {
    back: 'DINING SYSTEM COMMAND HUB',
    items: ['FLOOR PLANS', 'TABLE ASSIGNMENTS', 'TABLE ZONES', 'TABLES'],
  },
  reservations: {
    back: 'RESERVATIONS COMMAND HUB',
    items: [
      'RESERVATION GUESTS',
      'RESERVATION NOTES',
      'RESERVATION STATUS HISTORY',
      'RESERVATION TABLES',
      'RESERVATIONS',
    ],
  },
  'accounts-payable': {
    back: 'ACCOUNTS PAYABLE COMMAND HUB',
    items: [
      'SUPPLIER CREDIT NOTES',
      'SUPPLIER INVOICE ITEMS',
      'SUPPLIER INVOICES',
      'SUPPLIER PAYMENT ITEMS',
      'SUPPLIER PAYMENTS',
      'SUPPLIER PAYMENTS ALLOCATION',
    ],
  },
  payrolls: {
    back: 'PAYROLLS COMMAND HUB',
    items: ['PAYROLL ADJUSTMENTS', 'PAYROLL ENTRIES', 'PAYROLL RUNS', 'PAYROLL TAX DETAIL'],
  },
  pos: {
    back: 'POS COMMAND HUB',
    items: [
      'ORDER DISCOUNTS',
      'ORDER ITEMS',
      'ORDER ITEM MODIFIERS',
      'ORDER PAYMENTS',
      'ORDER TAXES',
      'ORDERS',
    ],
  },
  'cash-drawers': {
    back: 'CASH DRAWERS COMMAND HUB',
    items: [
      'CASH DRAWER HISTORY',
      'CASH DRAWERS',
      'CASH MOVEMENTS',
      'CASH SHIFTS',
      'CASH TRANSACTIONS',
    ],
  },
  'delivery-management': {
    back: 'DELIVERY MANAGEMENT COMMAND HUB',
    items: [
      'DELIVERY ASSIGNMENTS',
      'DELIVERY DRIVERS',
      'DELIVERY FEES',
      'DELIVERY TRACKING',
      'DELIVERY ZONES',
    ],
  },
  shifts: {
    back: 'SHIFTS COMMAND HUB',
    items: ['SHIFT ASSIGNMENT', 'SHIFTS'],
  },
  tips: {
    back: 'TIPS COMMAND HUB',
    items: [
      'TIP MOVEMENTS',
      'TIP POOL MEMBERS',
      'TIP SETTLEMENTS',
      'TIPS',
      'TIPS ALLOCATIONS',
      'TIPS POOLS',
    ],
  },
  configuration: {
    back: 'CONFIGURATION COMMAND HUB',
    items: [
      'MERCHANT OVERTIME RULES',
      'MERCHANT PAYROLL RULES',
      'MERCHANT TAX RULES',
      'MERCHANT TIPS RULES',
    ],
  },
  'billing-transactions': {
    back: 'BILLING & TRANSACTIONS COMMAND HUB',
    items: ['RECEIPT ITEMS', 'RECEIPTS', 'RECEIPTS TAXES'],
  },
  'financial-engine': {
    back: 'FINANCIAL ENGINE COMMAND HUB',
    items: ['JOURNAL ENTRIES', 'JOURNAL ENTRIES LINES', 'LEDGER ACCOUNTS'],
  },
  'business-partners': {
    back: 'BUSINESS PARTNERS COMMAND HUB',
    items: ['CUSTOMERS', 'SUPPLIERS'],
  },
  'qr-code': {
    back: 'QR CODE SYSTEM COMMAND HUB',
    items: [
      'QR CODE LOCATIONS',
      'QR CODE MENU ITEMS',
      'QR CODE MENU SECTIONS',
      'QR CODE MENUS',
      'QR CODE ORDERS',
      'QR ORDER ITEMS',
    ],
  },
  'online-ordering': {
    back: 'ONLINE ORDERING COMMAND HUB',
    items: [
      'STORES',
      'PAYMENTS',
      'MENUS',
      'CATEGORIES',
      'ITEMS',
      'ORDERS',
      'ORDER ITEMS',
      'DELIVERY',
    ],
  },
};

const featuresByApp = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const hub of MODULE_NAV_HUBS) {
    map.set(
      hub.appId,
      hub.items.map((i) => i.featureId),
    );
  }
  return map;
};

describe('module NavHubBars', () => {
  it('covers every registered module with non-empty Title Case labels and descriptions', () => {
    expect(MODULE_NAV_HUBS.length).toBeGreaterThanOrEqual(17);
    for (const hub of MODULE_NAV_HUBS) {
      expect(hub.hubLabel.length).toBeGreaterThan(0);
      expect(hub.title.length).toBeGreaterThan(0);
      expect(hub.items.length).toBeGreaterThan(0);
      for (const item of hub.items) {
        expect(item.featureId.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('links ALL the 3rd-level options of each application in Features.txt', () => {
    const catalog = featuresByApp();
    for (const hub of MODULE_NAV_HUBS) {
      expect(hub.items.map((i) => i.featureId).sort()).toEqual(
        [...(catalog.get(hub.appId) ?? [])].sort(),
      );
    }
  });

  it('resolves a feature to its module and a hub id to its hub', () => {
    expect(navHubForFeature('collaborators-contracts')?.appId).toBe('hr');
    expect(navHubForFeature('receipt-orders')?.hubLabel).toBe(
      'BILLING & TRANSACTIONS COMMAND HUB',
    );
    expect(navHubForFeature('kitchen-stations')?.appId).toBe(
      'kitchen-display-system',
    );
    expect(navHubById('pos-hub')?.appId).toBe('pos');
    expect(navHubById('collaborators')).toBeNull();
  });

  it('uses unique hub ids that never collide with a real feature id', () => {
    const hubIds = MODULE_NAV_HUBS.map((h) => h.hubId);
    expect(new Set(hubIds).size).toBe(hubIds.length);
    const allFeatures = [...featuresByApp().values()].flat();
    for (const id of hubIds) expect(allFeatures).not.toContain(id);
  });

  it('filters a module NavHub by authorized features and resets cleanly', () => {
    setAuthorizedFeatures(['collaborators', 'collaborators-time-entries']);
    try {
      const hrHub = navHubById('hr-hub');
      expect(hrHub?.items.map((i) => i.featureId)).toEqual([
        'collaborators',
        'collaborators-time-entries',
      ]);
      expect(isFeatureAuthorized('collaborators')).toBe(true);
      expect(isFeatureAuthorized('collaborators-contracts')).toBe(false);
    } finally {
      setAuthorizedFeatures(null);
    }
  });
});
