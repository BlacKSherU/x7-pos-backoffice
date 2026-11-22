import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BillingFinancialSyncHeader } from './BillingFinancialSyncHeader';
import {
  fetchFinancialSyncMetrics,
  fetchPostingAccounts,
  postBatchToLedger,
} from '@/modules/core/billing-transactions/api/financial-sync-api';
import type {
  FinancialSyncMetrics,
  PostBatchResult,
  PostingAccount,
} from '@/modules/core/billing-transactions/types/financial-sync';

vi.mock('@/modules/core/billing-transactions/api/financial-sync-api', () => ({
  fetchFinancialSyncGrid: vi.fn(),
  fetchFinancialSyncLines: vi.fn(),
  fetchFinancialSyncMetrics: vi.fn(),
  fetchPostingAccounts: vi.fn(),
  postBatchToLedger: vi.fn(),
}));

const metricsMock = vi.mocked(fetchFinancialSyncMetrics);
const accountsMock = vi.mocked(fetchPostingAccounts);
const postBatchMock = vi.mocked(postBatchToLedger);

function metrics(overrides: Partial<FinancialSyncMetrics> = {}): FinancialSyncMetrics {
  return {
    currency: 'USD',
    total_receipts: 5,
    posted_receipts: 2,
    pending_receipts: 1,
    unposted_receipts: 2,
    unposted_transactions: 3,
    pending_ledger_entries: 1,
    posted_ledger_entries: 2,
    posted_revenue: 50,
    posted_grand_total: 53.56,
    tax_accounts: [{ account_id: 4, code: '2100', name: 'VAT payable', balance: 8.56 }],
    tax_liability_balance: 8.56,
    balance: { status: 'BALANCED', checked_receipts: 3, balanced_receipts: 3, unbalanced_receipts: 0 },
    ...overrides,
  };
}

const ACCOUNTS: PostingAccount[] = [
  { id: 1, code: '1100', name: 'Cash', type: 'ASSET' },
  { id: 3, code: '4000', name: 'Sales', type: 'REVENUE' },
  { id: 4, code: '2100', name: 'VAT payable', type: 'LIABILITY' },
  { id: 5, code: '2200', name: 'Accounts payable', type: 'LIABILITY' },
  { id: 2, code: '4900', name: 'Sales discounts', type: 'EXPENSE' },
];

const AFTER_BATCH = metrics({
  posted_receipts: 4,
  pending_receipts: 0,
  unposted_receipts: 1,
  unposted_transactions: 1,
  pending_ledger_entries: 0,
  posted_ledger_entries: 4,
  posted_revenue: 120,
  posted_grand_total: 135.4,
  tax_accounts: [{ account_id: 4, code: '2100', name: 'VAT payable', balance: 19.4 }],
  tax_liability_balance: 19.4,
  balance: { status: 'BALANCED', checked_receipts: 4, balanced_receipts: 4, unbalanced_receipts: 0 },
});

const BATCH_RESULT: PostBatchResult = {
  generated_entries: 1,
  posted_drafts: 1,
  entries: [
    { id: 201, entry_number: 'RCPT-INV-000012', receipt_id: 12, status: 'POSTED', total_debit: 40, total_credit: 40, generated: true },
    { id: 150, entry_number: 'RCPT-INV-000011', receipt_id: 11, status: 'POSTED', total_debit: 30, total_credit: 30, generated: false },
  ],
  skipped: [{ receipt_id: 13, invoice_number: 'INV-000013', reason: 'MISSING_DISCOUNT_ACCOUNT', detail: 'Receipt carries a 2.50 discount' }],
  metrics: AFTER_BATCH,
};

function kpi(testId: string): string {
  return screen.getByTestId(`${testId}-value`).textContent ?? '';
}

async function openModal() {
  fireEvent.click(await screen.findByRole('button', { name: /POST BATCH TO LEDGER/ }));
  return screen.findByRole('dialog', { name: 'Post batch to ledger' });
}

beforeEach(() => {
  metricsMock.mockReset().mockResolvedValue(metrics());
  accountsMock.mockReset().mockResolvedValue(ACCOUNTS);
  postBatchMock.mockReset();
});

afterEach(() => cleanup());

describe('BillingFinancialSyncHeader', () => {
  it('shows the FINANCIAL ENGINE LEDGER SYNC title with the ledger icons', async () => {
    const { container } = render(<BillingFinancialSyncHeader />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('FINANCIAL ENGINE LEDGER SYNC');
    await screen.findByText('2 / 5');
    const icons = [...container.querySelectorAll('.material-symbols-outlined')].map((el) => el.textContent);
    expect(icons).toEqual(expect.arrayContaining(['account_balance', 'book', 'receipt_long']));
    expect(within(screen.getByRole('button', { name: /POST BATCH TO LEDGER/ })).getByText('book')).toBeInTheDocument();
  });

  it('renders the six posting KPIs from the metrics endpoint', async () => {
    render(<BillingFinancialSyncHeader />);

    await screen.findByText('2 / 5');
    for (const label of [
      'Posted Revenue',
      'Pending Ledger Entries',
      'Tax Account Balances',
      'Total Posted Receipts',
      'Unposted Transactions',
      'Balanced Ledger Status',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(kpi('kpi-posted-receipts')).toBe('2 / 5');
    expect(kpi('kpi-posted-revenue')).toBe('50.00 USD');
    expect(kpi('kpi-unposted-transactions')).toBe('3');
    expect(screen.getByText('2 unposted · 1 pending')).toBeInTheDocument();
    expect(kpi('kpi-pending-entries')).toBe('1');
    expect(kpi('kpi-tax-balances')).toBe('8.56 USD');
    expect(screen.getByText('2100 8.56 USD')).toBeInTheDocument();
    expect(kpi('kpi-balance-status')).toBe('Balanced');
    expect(screen.getByText('3 of 3 receipts balanced')).toBeInTheDocument();
    expect(metricsMock).toHaveBeenCalledTimes(1);
  });

  it('flags an unbalanced ledger and an empty one', async () => {
    metricsMock.mockResolvedValueOnce(
      metrics({ balance: { status: 'UNBALANCED', checked_receipts: 3, balanced_receipts: 2, unbalanced_receipts: 1 } }),
    );
    const { rerender } = render(<BillingFinancialSyncHeader refreshKey={0} />);
    await waitFor(() => expect(kpi('kpi-balance-status')).toBe('Unbalanced'));
    expect(screen.getByText('2 of 3 receipts balanced')).toBeInTheDocument();

    metricsMock.mockResolvedValueOnce(
      metrics({ tax_accounts: [], balance: { status: 'NO_ENTRIES', checked_receipts: 0, balanced_receipts: 0, unbalanced_receipts: 0 } }),
    );
    rerender(<BillingFinancialSyncHeader refreshKey={1} />);
    await waitFor(() => expect(kpi('kpi-balance-status')).toBe('No entries'));
    expect(screen.getByText('No tax postings yet')).toBeInTheDocument();
    expect(metricsMock).toHaveBeenCalledTimes(2);
  });

  it('posts the batch with the chosen accounts and updates the counters at once from the response', async () => {
    postBatchMock.mockResolvedValue(BATCH_RESULT);
    const onBatchPosted = vi.fn();
    render(<BillingFinancialSyncHeader onBatchPosted={onBatchPosted} />);

    const dialog = await openModal();
    await within(dialog).findByRole('option', { name: '1100 · Cash (ASSET)' });
    // A role with a single candidate is preselected; the tax role has two LIABILITY accounts.
    expect(within(dialog).getByLabelText(/Cash \/ receivable account/)).toHaveValue('1');
    expect(within(dialog).getByLabelText(/Sales revenue account/)).toHaveValue('3');
    fireEvent.change(within(dialog).getByLabelText(/Tax liability account/), { target: { value: '4' } });
    expect(within(dialog).getByText(/Receipts that carry discounts are skipped/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm & post/ }));

    await waitFor(() => expect(kpi('kpi-posted-receipts')).toBe('4 / 5'));
    expect(postBatchMock).toHaveBeenCalledWith({ cashAccountId: 1, revenueAccountId: 3, taxAccountId: 4 });
    expect(kpi('kpi-posted-revenue')).toBe('120.00 USD');
    expect(kpi('kpi-unposted-transactions')).toBe('1');
    expect(kpi('kpi-pending-entries')).toBe('0');
    expect(kpi('kpi-tax-balances')).toBe('19.40 USD');
    expect(screen.getByText('4 of 4 receipts balanced')).toBeInTheDocument();
    // Counters come from the POST response: no second metrics request.
    expect(metricsMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onBatchPosted).toHaveBeenCalledWith(BATCH_RESULT);

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Posted 2 journal entries to the ledger (1 generated, 1 draft posted).');
    expect(status.textContent).toContain('1 skipped.');
    expect(within(screen.getByRole('list', { name: 'Skipped receipts' })).getByText('INV-000013')).toBeInTheDocument();
    expect(screen.getByText(/Needs a discount account/)).toBeInTheDocument();
  });

  it('keeps the modal open with the server error when the batch fails', async () => {
    postBatchMock.mockRejectedValue(new Error('Ledger account 3 must be of type REVENUE'));
    const onBatchPosted = vi.fn();
    render(<BillingFinancialSyncHeader onBatchPosted={onBatchPosted} />);

    const dialog = await openModal();
    await within(dialog).findByRole('option', { name: '1100 · Cash (ASSET)' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm & post/ }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ledger account 3 must be of type REVENUE');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(kpi('kpi-posted-receipts')).toBe('2 / 5');
    expect(onBatchPosted).not.toHaveBeenCalled();
  });

  it('requires the cash and revenue accounts before posting', async () => {
    accountsMock.mockResolvedValue([...ACCOUNTS, { id: 6, code: '1200', name: 'Bank', type: 'ASSET' }]);
    render(<BillingFinancialSyncHeader />);

    const dialog = await openModal();
    await within(dialog).findByRole('option', { name: '1200 · Bank (ASSET)' });
    const confirm = within(dialog).getByRole('button', { name: /Confirm & post/ });
    expect(within(dialog).getByLabelText(/Cash \/ receivable account/)).toHaveValue('');
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Cash \/ receivable account/), { target: { value: '6' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postBatchMock).not.toHaveBeenCalled();
  });

  it('disables the batch button when there is nothing left to post', async () => {
    metricsMock.mockResolvedValue(metrics({ unposted_receipts: 0, pending_receipts: 0, unposted_transactions: 0 }));
    render(<BillingFinancialSyncHeader />);

    await waitFor(() => expect(kpi('kpi-unposted-transactions')).toBe('0'));
    expect(screen.getByRole('button', { name: /POST BATCH TO LEDGER/ })).toBeDisabled();
  });

  it('shows the error when the metrics cannot be loaded', async () => {
    metricsMock.mockRejectedValue(new Error('Failed to load the ledger posting metrics.'));
    render(<BillingFinancialSyncHeader />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the ledger posting metrics.');
    expect(kpi('kpi-posted-revenue')).toBe('—');
  });
});
