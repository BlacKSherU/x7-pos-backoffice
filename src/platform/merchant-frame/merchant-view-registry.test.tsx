import { isValidElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderMerchantView, REGISTERED_VIEW_TABS } from '@/platform/merchant-frame/merchant-view-registry';
import type { MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { TimeEntriesView as RestaurantTimeEntriesView } from '@/modules/restaurant-operations/shifts/views/TimeEntriesView';
import { TimeEntriesView as HrTimeEntriesView } from '@/modules/finance-hr/hr/views/TimeEntriesView';
import { ShiftAssignmentView } from '@/modules/restaurant-operations/shifts/views/ShiftAssignmentView';
import { PlanFeaturesView } from '@/modules/platform-saas/subscription-system/views/PlanFeaturesView';
import { PlanFeaturesPickPlanView } from '@/shared/components/PlaceholderViews';
import { resolveStaffTarget } from '@/platform/merchant-frame/merchant-routes';
import { OrderPaymentsView } from '@/modules/restaurant-operations/pos/views/OrderPaymentsView';
import { PaymentGatewayConfigsView } from '@/modules/restaurant-operations/pos/views/PaymentGatewayConfigsView';
import { PaymentTerminalsView } from '@/modules/restaurant-operations/pos/views/PaymentTerminalsView';
import { CompaniesHubView } from '@/components/MerchantFrame/views/platform-saas/companies/CompaniesHubView';
import { CompanyHubView } from '@/components/MerchantFrame/views/platform-saas/companies/CompanyHubView';
import { CompanyProfileView } from '@/components/MerchantFrame/views/platform-saas/companies/CompanyProfileView';
import { MerchantTerminalsDirectoryView } from '@/components/MerchantFrame/views/platform-saas/merchants/MerchantTerminalsDirectoryView';
import { MerchantHubView } from '@/components/MerchantFrame/views/platform-saas/merchants/MerchantHubView';
import { MerchantUserDashboardView } from '@/components/MerchantFrame/views/platform-saas/users/MerchantUserDashboardView';
import { SaasMissingContext } from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';

function context(overrides: Partial<MerchantViewContext> = {}): MerchantViewContext {
  return {
    activeCategory: 'core',
    profile: null,
    selectedPlan: null,
    refreshTrigger: 0,
    onNavigate: vi.fn(),
    onStaffNavigate: vi.fn(),
    onSaasNavigate: vi.fn(),
    navigateToFeature: vi.fn(),
    setActiveTab: vi.fn(),
    goToDashboard: vi.fn(),
    openLiveMonitor: vi.fn(),
    linesEntryFilter: null,
    setLinesEntryFilter: vi.fn(),
    itemsPaymentFilter: null,
    setItemsPaymentFilter: vi.fn(),
    allocationsContext: null,
    setAllocationsContext: vi.fn(),
    ...overrides,
  };
}

function viewFor(tab: string, ctx = context()): ReactElement<{ initialViewMode?: string }> {
  const node = renderMerchantView(tab, ctx);
  if (!isValidElement<{ initialViewMode?: string }>(node)) throw new Error(`No view for ${tab}`);
  return node;
}

describe('merchant view registry', () => {
  it('renders an element for every registered tab', () => {
    for (const tab of REGISTERED_VIEW_TABS) {
      expect(isValidElement(renderMerchantView(tab, context())), tab).toBe(true);
    }
  });

  it('returns undefined for tabs without a view (hubs and features in development)', () => {
    expect(renderMerchantView('dashboard', context())).toBeUndefined();
    expect(renderMerchantView('some-future-feature', context())).toBeUndefined();
  });

  it('opens the operations attendance ledger or the HR time entries depending on the category', () => {
    expect(viewFor('collaborators-time-entries', context({ activeCategory: 'restaurant-operations' })).type).toBe(
      RestaurantTimeEntriesView,
    );
    expect(viewFor('collaborators-time-entries', context({ activeCategory: 'hr' })).type).toBe(HrTimeEntriesView);
    expect(viewFor('ledger').type).toBe(RestaurantTimeEntriesView);
  });

  it('asks for a plan before mapping plan features', () => {
    expect(viewFor('plan-features-mapping').type).toBe(PlanFeaturesPickPlanView);
    const plan = { id: 1, name: 'Pro' } as SubscriptionPlan;
    expect(viewFor('plan-features-mapping', context({ selectedPlan: plan })).type).toBe(PlanFeaturesView);
  });

  it('keeps the shift scheduler modes per tab', () => {
    expect(viewFor('daily-timeline').props.initialViewMode).toBe('daily');
    expect(viewFor('scheduler').props.initialViewMode).toBe('weekly');
    expect(viewFor('roster').props.initialViewMode).toBe('monthly');
    expect(viewFor('swaps').type).toBe(ShiftAssignmentView);
    expect(viewFor('order-payments').type).toBe(OrderPaymentsView);
    expect(viewFor('payment-gateway-configs').type).toBe(PaymentGatewayConfigsView);
    expect(viewFor('payment-terminals').type).toBe(PaymentTerminalsView);
  });
});

describe('resolveStaffTarget', () => {
  it('maps tab ids, short aliases and URLs to the same destination', () => {
    const expected = { tab: 'staff-roster', path: '/staff-management/schedule/roster' };
    expect(resolveStaffTarget('roster')).toEqual(expected);
    expect(resolveStaffTarget('staff-roster')).toEqual(expected);
    expect(resolveStaffTarget('/staff-management/schedule/roster')).toEqual(expected);
  });

  it('sets the operations category only for tips destinations', () => {
    expect(resolveStaffTarget('tip-settlements')).toEqual({
      tab: 'tips-settlements',
      path: '/tips/settlements',
      category: 'restaurant-operations',
    });
    expect(resolveStaffTarget('kiosk')?.category).toBeUndefined();
  });

  it('returns null for targets outside staff and tips', () => {
    expect(resolveStaffTarget('products')).toBeNull();
  });
});

describe('platform saas context views', () => {
  it('passes the URL ids to the views and asks for a company when they are missing', () => {
    expect(viewFor('saas-companies-hub').type).toBe(CompaniesHubView);
    const hub = renderMerchantView('saas-company-hub', context({ routeParams: { companyId: 3 } }));
    expect(isValidElement<{ companyId: number }>(hub) && hub.type === CompanyHubView && hub.props.companyId).toBe(3);
    const profile = renderMerchantView('saas-company-profile', context({ routeParams: { companyId: 3 } }));
    expect(isValidElement<{ companyId: number }>(profile) && profile.type === CompanyProfileView && profile.props.companyId).toBe(3);
    const merchantHub = renderMerchantView('saas-merchant-hub', context({ routeParams: { companyId: 3, merchantId: 8 } }));
    expect(isValidElement<{ merchantId: number }>(merchantHub) && merchantHub.type === MerchantHubView && merchantHub.props.merchantId).toBe(8);
    const terminals = renderMerchantView('saas-merchant-terminals', context({ routeParams: { companyId: 3, merchantId: 8 } }));
    expect(
      isValidElement<{ companyId: number; merchantId: number }>(terminals) &&
        terminals.type === MerchantTerminalsDirectoryView &&
        [terminals.props.companyId, terminals.props.merchantId],
    ).toEqual([3, 8]);
    expect(viewFor('saas-merchant-terminals', context({ routeParams: { companyId: 3 } })).type).toBe(SaasMissingContext);
    const user = renderMerchantView('saas-merchant-user-detail', context({ routeParams: { merchantId: 8, userId: 21 } }));
    expect(isValidElement<{ userId: number }>(user) && user.type === MerchantUserDashboardView && user.props.userId).toBe(21);
    expect(viewFor('saas-company-hub').type).toBe(SaasMissingContext);
    expect(viewFor('saas-merchant-hub', context({ routeParams: { companyId: 3 } })).type).toBe(SaasMissingContext);
  });
});

