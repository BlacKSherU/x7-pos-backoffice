import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BillingFinancialSyncGrid } from './BillingFinancialSyncGrid';
import {
  fetchFinancialSyncGrid,
  fetchFinancialSyncLines,
} from '@/modules/core/billing-transactions/api/financial-sync-api';
import type {
  FinancialSyncLines,
  FinancialSyncPage,
  FinancialSyncRow,
} from '@/modules/core/billing-transactions/types/financial-sync';

vi.mock('@/modules/core/billing-transactions/api/financial-sync-api', () => ({
  fetchFinancialSyncGrid: vi.fn(),
  fetchFinancialSyncLines: vi.fn(),
}));

const gridMock = vi.mocked(fetchFinancialSyncGrid);
const linesMock = vi.mocked(fetchFinancialSyncLines);

const ALL_PASS = {
  receipt_totals_consistent: true,
  receipt_taxes_match_total: true,
  entries_balanced: true,
  grand_total_matches_assets: true,
  tax_matches_liabilities: true,
  is_balanced: true,
};

function row(overrides: Partial<FinancialSyncRow> = {}): FinancialSyncRow {
  return {
    receipt_id: 10,
    invoice_number: 'INV-000010',
    type: 'INVOICE',
    currency: 'USD',
    is_locked: true,
    created_at: '2026-11-20T10:00:00.000Z',
    subtotal: 25,
    total_tax: 4.28,
    total_discount: 2.5,
    grand_total: 26.78,
    posting_status: 'POSTED',
    receipt_taxes: [
      { id: 1, name: 'VAT 19%', rate: 19, amount: 4.28, scope: 'RECEIPT', receipt_item_id: null },
    ],
    journal_entries: [
      { id: 100, entry_number: 'RCPT-INV-000010', entry_date: '2026-11-20', status: 'POSTED', total_debit: 29.28, total_credit: 29.28, is_balanced: true, line_count: 4 },
    ],
    ledger_account_ids: [1, 4, 3, 2],
    ledger_accounts: [
      { account_id: 1, code: '1100', name: 'Cash', type: 'ASSET', debit: 26.78, credit: 0 },
      { account_id: 4, code: '2100', name: 'VAT payable', type: 'LIABILITY', debit: 0, credit: 4.28 },
      { account_id: 3, code: '4000', name: 'Sales', type: 'REVENUE', debit: 0, credit: 25 },
      { account_id: 2, code: '4900', name: 'Sales discounts', type: 'EXPENSE', debit: 2.5, credit: 0 },
    ],
    ledger_total_debit: 29.28,
    ledger_total_credit: 29.28,
    asset_net_debit: 26.78,
    liability_net_credit: 4.28,
    receipt_taxes_total: 4.28,
    verification: ALL_PASS,
    ...overrides,
  };
}

const UNBALANCED = row({
  receipt_id: 11,
  invoice_number: 'INV-000011',
  posting_status: 'PENDING',
  ledger_total_credit: 25,
  liability_net_credit: 0,
  verification: { ...ALL_PASS, entries_balanced: false, tax_matches_liabilities: false, is_balanced: false },
});

const UNPOSTED = row({
  receipt_id: 12,
  invoice_number: 'INV-000012',
  posting_status: 'UNPOSTED',
  journal_entries: [],
  ledger_account_ids: [],
  ledger_accounts: [],
  ledger_total_debit: 0,
  ledger_total_credit: 0,
  asset_net_debit: 0,
  liability_net_credit: 0,
  verification: { ...ALL_PASS, entries_balanced: null, grand_total_matches_assets: null, tax_matches_liabilities: null, is_balanced: null },
});

function page(data: FinancialSyncRow[], overrides: Partial<FinancialSyncPage> = {}): FinancialSyncPage {
  return { data, page: 1, limit: 10, total: data.length, totalPages: 1, hasNext: false, hasPrev: false, ...overrides };
}

const LINES: FinancialSyncLines = {
  receipt_id: 10,
  invoice_number: 'INV-000010',
  currency: 'USD',
  journal_entry_id: null,
  lines: [
    { id: 1, journal_entry_id: 100, entry_number: 'RCPT-INV-000010', entry_status: 'POSTED', account: { id: 1, code: '1100', name: 'Cash', type: 'ASSET' }, debit: 26.78, credit: 0, description: 'Amount collected' },
    { id: 2, journal_entry_id: 100, entry_number: 'RCPT-INV-000010', entry_status: 'POSTED', account: { id: 2, code: '4900', name: 'Sales discounts', type: 'EXPENSE' }, debit: 2.5, credit: 0, description: 'Discounts granted' },
    { id: 3, journal_entry_id: 100, entry_number: 'RCPT-INV-000010', entry_status: 'POSTED', account: { id: 3, code: '4000', name: 'Sales', type: 'REVENUE' }, debit: 0, credit: 25, description: 'Sales revenue' },
    { id: 4, journal_entry_id: 100, entry_number: 'RCPT-INV-000010', entry_status: 'POSTED', account: { id: 4, code: '2100', name: 'VAT payable', type: 'LIABILITY' }, debit: 0, credit: 4.28, description: 'Tax liability' },
  ],
  total_debit: 29.28,
  total_credit: 29.28,
  is_balanced: true,
};

describe('BillingFinancialSyncGrid', () => {
  beforeEach(() => {
    gridMock.mockReset();
    linesMock.mockReset();
    gridMock.mockResolvedValue(page([row(), UNBALANCED, UNPOSTED]));
    linesMock.mockResolvedValue(LINES);
  });

  afterEach(() => cleanup());

  it('loads the first page and shows invoice number, receipt totals, ledger account IDs, debit/credit and posting status', async () => {
    render(<BillingFinancialSyncGrid />);

    await waitFor(() => expect(gridMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 })));
    const posted = await screen.findByTestId('sync-row-10');

    expect(within(posted).getByText('INV-000010')).toBeInTheDocument();
    expect(within(posted).getByTestId('grand-total')).toHaveTextContent('26.78 USD');
    expect(within(posted).getByText('Tax 4.28 · Disc 2.50')).toBeInTheDocument();

    const accounts = within(posted).getByRole('list', { name: 'Ledger accounts of INV-000010' });
    expect(within(accounts).getByText('#1')).toBeInTheDocument();
    expect(within(accounts).getByText('#4')).toBeInTheDocument();
    expect(within(accounts).getByText('Dr 26.78')).toBeInTheDocument();
    expect(within(accounts).getByText('Cr 4.28')).toBeInTheDocument();

    expect(within(posted).getByTestId('ledger-debit')).toHaveTextContent('29.28');
    expect(within(posted).getByTestId('ledger-credit')).toHaveTextContent('29.28');
    expect(within(posted).getByText('Posted')).toBeInTheDocument();
    expect(within(screen.getByTestId('sync-row-11')).getByText('Pending')).toBeInTheDocument();
    expect(within(screen.getByTestId('sync-row-12')).getByText('Unposted')).toBeInTheDocument();
  });

  it('displays balance verification flags for balanced, unbalanced and unverified receipts', async () => {
    render(<BillingFinancialSyncGrid />);

    const posted = await screen.findByTestId('sync-row-10');
    expect(within(posted).getByText('Balanced')).toBeInTheDocument();
    expect(within(posted).getByRole('img', { name: 'Grand total equals the net debit on ASSET accounts: passes' })).toBeInTheDocument();
    expect(within(posted).getByRole('img', { name: 'Total tax equals the net credit on LIABILITY accounts: passes' })).toBeInTheDocument();

    const unbalanced = screen.getByTestId('sync-row-11');
    expect(within(unbalanced).getByText('Unbalanced')).toBeInTheDocument();
    expect(within(unbalanced).getByRole('img', { name: 'Total debits equal total credits: fails' })).toBeInTheDocument();
    expect(within(unbalanced).getByRole('img', { name: 'Total tax equals the net credit on LIABILITY accounts: fails' })).toBeInTheDocument();

    const unposted = screen.getByTestId('sync-row-12');
    expect(within(unposted).getByText('Not verified')).toBeInTheDocument();
    expect(within(unposted).getByText('No ledger accounts')).toBeInTheDocument();
    expect(within(unposted).getByRole('img', { name: 'Total debits equal total credits: not verified' })).toBeInTheDocument();
    expect(within(unposted).getByRole('img', { name: 'Active ReceiptTax records add up to the total tax: passes' })).toBeInTheDocument();
  });

  it('drills down into the journal entry lines of a receipt and of a single entry', async () => {
    render(<BillingFinancialSyncGrid />);

    fireEvent.click(await screen.findByRole('button', { name: 'Show journal entry lines of INV-000010' }));

    await waitFor(() => expect(linesMock).toHaveBeenCalledWith(10, undefined));
    const table = await screen.findByRole('table', { name: 'Journal entry lines of INV-000010' });
    expect(within(table).getByText('1100 · Cash')).toBeInTheDocument();
    expect(within(table).getByText('2100 · VAT payable')).toBeInTheDocument();
    expect(within(table).getByText('LIABILITY')).toBeInTheDocument();
    expect(within(table).getByText('Tax liability')).toBeInTheDocument();
    expect(within(table).getByTestId('lines-total-debit')).toHaveTextContent('29.28');
    expect(within(table).getByTestId('lines-total-credit')).toHaveTextContent('29.28');

    const detail = screen.getByRole('region', { name: 'Ledger detail for INV-000010' });
    expect(within(detail).getByText('Grand total 26.78 · ASSET net debit 26.78')).toBeInTheDocument();
    expect(within(detail).getByText('VAT 19%')).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole('button', { name: /RCPT-INV-000010/ }));
    await waitFor(() => expect(linesMock).toHaveBeenCalledWith(10, 100));
  });

  it('does not request lines for a receipt that has no journal entries', async () => {
    render(<BillingFinancialSyncGrid />);

    fireEvent.click(await screen.findByRole('button', { name: 'Show journal entry lines of INV-000012' }));

    expect(await screen.findByText(/has not been posted to the ledger yet/)).toBeInTheDocument();
    expect(linesMock).not.toHaveBeenCalled();
  });

  it('filters by posting status, invoice number and date range', async () => {
    render(<BillingFinancialSyncGrid />);
    await screen.findByTestId('sync-row-10');

    fireEvent.click(screen.getByRole('button', { name: 'Unposted' }));
    await waitFor(() => expect(gridMock).toHaveBeenLastCalledWith(expect.objectContaining({ postingStatus: 'UNPOSTED', page: 1 })));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by invoice number' }), { target: { value: ' INV-0001 ' } });
    await waitFor(() => expect(gridMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'INV-0001' })));

    fireEvent.change(screen.getByLabelText('Receipts from date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Receipts to date'), { target: { value: '2026-11-30' } });
    await waitFor(() =>
      expect(gridMock).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: '2026-11-01', dateTo: '2026-11-30', postingStatus: 'UNPOSTED', search: 'INV-0001' })),
    );

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    await waitFor(() => expect(gridMock).toHaveBeenLastCalledWith(expect.objectContaining({ postingStatus: '', search: '', dateFrom: '', dateTo: '' })));
  });

  it('does not query an inverted date range', async () => {
    render(<BillingFinancialSyncGrid />);
    await screen.findByTestId('sync-row-10');
    const callsBefore = gridMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Receipts from date'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Receipts to date'), { target: { value: '2026-11-01' } });

    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    // Only the valid "from" change reached the API.
    expect(gridMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it('paginates through the server-side pages', async () => {
    gridMock.mockResolvedValue(page([row()], { total: 25, totalPages: 3, hasNext: true }));
    render(<BillingFinancialSyncGrid />);
    await screen.findByTestId('sync-row-10');

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(gridMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('reloads when refreshKey changes and shows API errors', async () => {
    const { rerender } = render(<BillingFinancialSyncGrid refreshKey={0} />);
    await screen.findByTestId('sync-row-10');
    expect(gridMock).toHaveBeenCalledTimes(1);

    gridMock.mockRejectedValueOnce(new Error('Ledger unavailable'));
    rerender(<BillingFinancialSyncGrid refreshKey={1} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ledger unavailable');
    expect(gridMock).toHaveBeenCalledTimes(2);
  });
});
