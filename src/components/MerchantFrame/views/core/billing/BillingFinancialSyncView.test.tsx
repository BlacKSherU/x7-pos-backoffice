import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BillingFinancialSyncView } from './BillingFinancialSyncView';
import { renderMerchantView, type MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import {
  fetchFinancialSyncGrid,
  fetchFinancialSyncMetrics,
  fetchPostingAccounts,
  postBatchToLedger,
} from '@/modules/core/billing-transactions/api/financial-sync-api';
import type { FinancialSyncMetrics } from '@/modules/core/billing-transactions/types/financial-sync';

vi.mock('@/modules/core/billing-transactions/api/financial-sync-api', () => ({
  fetchFinancialSyncGrid: vi.fn(),
  fetchFinancialSyncLines: vi.fn(),
  fetchFinancialSyncMetrics: vi.fn(),
  fetchPostingAccounts: vi.fn(),
  postBatchToLedger: vi.fn(),
}));

const EMPTY_PAGE = { data: [], page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

function metrics(overrides: Partial<FinancialSyncMetrics> = {}): FinancialSyncMetrics {
  return {
    currency: 'USD',
    total_receipts: 1,
    posted_receipts: 0,
    pending_receipts: 0,
    unposted_receipts: 1,
    unposted_transactions: 1,
    pending_ledger_entries: 0,
    posted_ledger_entries: 0,
    posted_revenue: 0,
    posted_grand_total: 0,
    tax_accounts: [],
    tax_liability_balance: 0,
    balance: { status: 'NO_ENTRIES', checked_receipts: 0, balanced_receipts: 0, unbalanced_receipts: 0 },
    ...overrides,
  };
}

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

  it('renders the ledger sync header above the sync grid', async () => {
    vi.mocked(fetchFinancialSyncGrid).mockResolvedValue(EMPTY_PAGE);
    vi.mocked(fetchFinancialSyncMetrics).mockResolvedValue(metrics());
    render(<BillingFinancialSyncView />);
    expect(screen.getByRole('heading', { level: 2, name: 'FINANCIAL ENGINE LEDGER SYNC' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Billing to ledger sync grid' })).toBeInTheDocument();
    expect(await screen.findByText('No receipts yet')).toBeInTheDocument();
  });

  it('reloads the grid after a batch is posted', async () => {
    vi.mocked(fetchFinancialSyncGrid).mockReset().mockResolvedValue(EMPTY_PAGE);
    vi.mocked(fetchFinancialSyncMetrics).mockResolvedValue(metrics());
    vi.mocked(fetchPostingAccounts).mockResolvedValue([
      { id: 1, code: '1100', name: 'Cash', type: 'ASSET' },
      { id: 3, code: '4000', name: 'Sales', type: 'REVENUE' },
    ]);
    vi.mocked(postBatchToLedger).mockResolvedValue({
      generated_entries: 1,
      posted_drafts: 0,
      entries: [{ id: 9, entry_number: 'RCPT-1', receipt_id: 1, status: 'POSTED', total_debit: 10, total_credit: 10, generated: true }],
      skipped: [],
      metrics: metrics({ posted_receipts: 1, unposted_receipts: 0, unposted_transactions: 0 }),
    });
    render(<BillingFinancialSyncView />);
    await screen.findByText('No receipts yet');
    expect(fetchFinancialSyncGrid).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole('button', { name: /POST BATCH TO LEDGER/ }));
    const confirm = await screen.findByRole('button', { name: /Confirm & post/ });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchFinancialSyncGrid).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: /POST BATCH TO LEDGER/ })).toBeDisabled();
  });
});
