import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BillingFinancialSyncView } from './BillingFinancialSyncView';
import { renderMerchantView, type MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { fetchFinancialSyncGrid } from '@/modules/core/billing-transactions/api/financial-sync-api';

vi.mock('@/modules/core/billing-transactions/api/financial-sync-api', () => ({
  fetchFinancialSyncGrid: vi.fn(),
  fetchFinancialSyncLines: vi.fn(),
}));

afterEach(() => cleanup());

describe('BillingFinancialSyncView screen registration', () => {
  it('is the view of the billing-financial-sync tab', () => {
    const node = renderMerchantView('billing-financial-sync', { activeCategory: 'core' } as MerchantViewContext);
    expect(isValidElement(node) && node.type).toBe(BillingFinancialSyncView);
  });

  it('opens from its nav_item route', () => {
    expect(getNavFromPath('/app/billing-transactions/billing-financial-sync')).toEqual({
      category: 'core',
      tab: 'billing-financial-sync',
    });
  });

  it('belongs to the Billing & Transactions hub, so MerchantFrame mounts its NavHubBar', () => {
    const hub = navHubForFeature('billing-financial-sync');
    expect(hub?.hubId).toBe('billing-transactions-hub');
    expect(hub?.items.find((item) => item.featureId === 'billing-financial-sync')).toMatchObject({
      live: true,
      icon: 'account_balance',
    });
  });

  it('renders the sync grid', async () => {
    vi.mocked(fetchFinancialSyncGrid).mockResolvedValue({
      data: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    render(<BillingFinancialSyncView />);
    expect(await screen.findByRole('table', { name: 'Billing to ledger sync grid' })).toBeInTheDocument();
    expect(await screen.findByText('No receipts yet')).toBeInTheDocument();
  });
});
