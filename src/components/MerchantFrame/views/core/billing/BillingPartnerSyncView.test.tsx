import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillingPartnerSyncView } from './BillingPartnerSyncView';
import { renderMerchantView, type MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { NavHubBar } from '@/shared/components/NavHubBar';
import * as api from '@/modules/core/billing-transactions/api/partner-sync-api';

vi.mock('@/modules/core/billing-transactions/api/partner-sync-api', () => ({
  buildQuery: vi.fn(),
  fetchPartnerSyncMetrics: vi.fn(() => new Promise(() => {})),
  fetchPartnerOptions: vi.fn(async () => []),
  fetchPartnerSyncReceipts: vi.fn(async () => ({ data: [], total: 0 })),
  linkReceiptToPartner: vi.fn(),
  fetchPartnerGroups: vi.fn(async () => ({
    data: [],
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
    summary: { partners: 0, invoices: 0, total_volume: 0 },
  })),
  fetchCompanyMerchants: vi.fn(async () => [{ id: 1, name: 'Providencia', is_current: true }]),
  unlinkReceiptPartner: vi.fn(),
}));

const mocked = vi.mocked(api);

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

  it('renders the partner grid below the header and shares the company scope with it', async () => {
    const user = userEvent.setup();
    render(<BillingPartnerSyncView />);
    expect(screen.getByRole('region', { name: 'Receipts by business partner' })).toBeInTheDocument();
    expect(await screen.findByText('No receipts match these filters.')).toBeInTheDocument();
    expect(screen.getByTestId('partner-sync-scope')).toHaveTextContent('Branch');

    await user.click(within(screen.getByRole('group', { name: 'Scope' })).getByRole('button', { name: 'Company-wide' }));

    expect(screen.getByTestId('partner-sync-scope')).toHaveTextContent('Company-wide');
    await waitFor(() =>
      expect(mocked.fetchPartnerSyncMetrics).toHaveBeenLastCalledWith({ scope: 'company', merchantId: undefined }),
    );
    await waitFor(() => expect(mocked.fetchPartnerGroups).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'company' })));
  });
});
