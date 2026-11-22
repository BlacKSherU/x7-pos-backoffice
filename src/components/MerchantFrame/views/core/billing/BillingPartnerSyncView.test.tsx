import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { BillingPartnerSyncView } from './BillingPartnerSyncView';
import { renderMerchantView, type MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { NavHubBar } from '@/shared/components/NavHubBar';

vi.mock('@/modules/core/billing-transactions/api/partner-sync-api', () => ({
  buildQuery: vi.fn(),
  fetchPartnerSyncMetrics: vi.fn(() => new Promise(() => {})),
  fetchPartnerOptions: vi.fn(async () => []),
  fetchPartnerSyncReceipts: vi.fn(async () => ({ data: [], total: 0 })),
  linkReceiptToPartner: vi.fn(),
}));

afterEach(() => cleanup());

function context(): MerchantViewContext {
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
  };
}

describe('billing-partner-sync screen', () => {
  it('is registered in the merchant view registry', () => {
    const node = renderMerchantView('billing-partner-sync', context());
    expect(isValidElement(node) && node.type).toBe(BillingPartnerSyncView);
  });

  it('opens from its /app route inside the core category', () => {
    expect(getNavFromPath('/app/billing-transactions/billing-partner-sync')).toEqual({
      category: 'core',
      tab: 'billing-partner-sync',
    });
    expect(getNavFromPath('/billing/partner-sync')).toEqual({ category: 'core', tab: 'billing-partner-sync' });
  });

  it('belongs to the Billing & Transactions hub as a live option', () => {
    const hub = navHubForFeature('billing-partner-sync');
    expect(hub?.appId).toBe('billing-transactions');
    expect(hub?.items.find((item) => item.featureId === 'billing-partner-sync')).toMatchObject({
      label: 'Business Partners Billing Link',
      icon: 'partner_exchange',
      live: true,
    });
  });

  it('shows a short "Partner Link" tab in the NavHubBar', () => {
    render(
      <NavHubBar
        title="Billing & Transactions Command Hub"
        items={[{ id: 'billing-partner-sync', label: 'Business Partners Billing Link', active: true, onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByText('Partner Link')).toBeInTheDocument();
  });

  it('renders the BUSINESS PARTNERS BILLING LINK header', () => {
    render(<BillingPartnerSyncView />);
    expect(screen.getByRole('heading', { name: 'BUSINESS PARTNERS BILLING LINK' })).toBeInTheDocument();
  });
});
