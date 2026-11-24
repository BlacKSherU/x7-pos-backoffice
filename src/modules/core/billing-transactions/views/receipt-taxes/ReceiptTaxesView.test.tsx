import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReceiptTaxesView } from './ReceiptTaxesView';
import type { ReceiptTax } from '../../types/receipt-taxes';

vi.mock('../../api/receipt-taxes-api', () => ({
  fetchReceiptTaxes: vi.fn(),
  fetchReceiptTaxesSummary: vi.fn(),
  createReceiptTax: vi.fn(),
  updateReceiptTax: vi.fn(),
  setReceiptTaxStatus: vi.fn(),
  fetchReceiptOptions: vi.fn(),
  fetchReceiptItemOptions: vi.fn(),
}));

import {
  createReceiptTax,
  fetchReceiptItemOptions,
  fetchReceiptOptions,
  fetchReceiptTaxes,
  fetchReceiptTaxesSummary,
  setReceiptTaxStatus,
  updateReceiptTax,
} from '../../api/receipt-taxes-api';

const RECEIPT_TAX: ReceiptTax = {
  id: 1,
  receipt_id: 10,
  receipt_item_id: null,
  name: 'IVA 19%',
  rate: 19,
  amount: 23.75,
  scope: 'RECEIPT',
  is_active: true,
  receipt_invoice_number: 'INV-000010',
  receipt_is_locked: false,
  currency: 'USD',
  receipt_item_name: null,
  receipt_total_tax: 24.75,
  receipt_grand_total: 149.75,
  created_at: '2026-01-01T00:00:00Z',
};

const ITEM_TAX: ReceiptTax = {
  ...RECEIPT_TAX,
  id: 2,
  receipt_item_id: 5,
  name: 'Sugar tax',
  rate: 5,
  amount: 1,
  scope: 'ITEM',
  receipt_item_name: 'Burger Combo',
  currency: 'EUR',
};

const INACTIVE_TAX: ReceiptTax = { ...RECEIPT_TAX, id: 3, name: 'Old municipal tax', is_active: false };

const SUMMARY = {
  total_count: 3,
  active_count: 2,
  inactive_count: 1,
  receipts_count: 1,
  totals_by_currency: [{ currency: 'USD', total_amount: 23.75, receipt_scope_amount: 23.75, item_scope_amount: 0 }],
  by_scope: [{ scope: 'RECEIPT' as const, currency: 'USD', count: 1, total_amount: 23.75 }],
  by_type: [{ name: 'IVA 19%', rate: 19, currency: 'USD', count: 1, total_amount: 23.75 }],
  filter_options: { names: ['IVA 19%', 'Old municipal tax', 'Sugar tax'], rates: [5, 19] },
};

const listResult = (data: ReceiptTax[]) => ({ data, page: 1, limit: 25, total: data.length, totalPages: 1 });

describe('ReceiptTaxesView', () => {
  beforeEach(() => {
    vi.mocked(fetchReceiptTaxes).mockResolvedValue(listResult([RECEIPT_TAX, ITEM_TAX, INACTIVE_TAX]));
    vi.mocked(fetchReceiptOptions).mockResolvedValue([
      { id: 10, invoice_number: 'INV-000010', type: 'invoice', subtotal: 125, grand_total: 148.75, currency: 'USD' },
    ]);
    vi.mocked(fetchReceiptItemOptions).mockResolvedValue([]);
    vi.mocked(fetchReceiptTaxesSummary).mockResolvedValue(SUMMARY);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads every tax (active and inactive) and shows the scope of each one clearly', async () => {
    render(<ReceiptTaxesView />);
    const receiptRow = await screen.findByTestId('receipt-tax-row-1');
    expect(fetchReceiptTaxes).toHaveBeenCalledWith(expect.objectContaining({ status: 'all', page: 1 }));

    expect(within(receiptRow).getByTestId('receipt-tax-scope-1')).toHaveTextContent('Receipt');
    expect(within(receiptRow).getByText('Whole receipt subtotal')).toBeInTheDocument();
    expect(within(receiptRow).getByText('INV-000010')).toBeInTheDocument();
    expect(within(receiptRow).getByText('19.00%')).toBeInTheDocument();
    expect(within(receiptRow).getByText('23.75 USD')).toBeInTheDocument();
    expect(within(receiptRow).getByText('Total 149.75 USD')).toBeInTheDocument();

    const itemRow = screen.getByTestId('receipt-tax-row-2');
    expect(within(itemRow).getByTestId('receipt-tax-scope-2')).toHaveTextContent('Item');
    expect(within(itemRow).getByText('Item: Burger Combo')).toBeInTheDocument();
    expect(within(itemRow).getByText('1.00 EUR')).toBeInTheDocument();

    const inactiveRow = screen.getByTestId('receipt-tax-row-3');
    expect(within(inactiveRow).getByText('Inactive')).toBeInTheDocument();
    expect(within(inactiveRow).getByRole('button', { name: 'Edit Old municipal tax' })).toBeDisabled();
  });

  it('creates a tax from the drawer and reloads the list so the new totals are reflected', async () => {
    vi.mocked(createReceiptTax).mockResolvedValue(RECEIPT_TAX);
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');

    fireEvent.click(screen.getByRole('button', { name: /New Receipt Tax/ }));
    const dialog = screen.getByRole('dialog', { name: 'New Receipt Tax' });
    await within(dialog).findByRole('option', { name: /INV-000010/ });
    fireEvent.change(within(dialog).getByLabelText('Receipt'), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Tax name'), { target: { value: 'IVA 19%' } });
    fireEvent.change(within(dialog).getByLabelText('Rate (%)'), { target: { value: '19' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Tax' }));

    await waitFor(() =>
      expect(createReceiptTax).toHaveBeenCalledWith({ receiptId: 10, name: 'IVA 19%', rate: 19, scope: 'RECEIPT' }),
    );
    expect(
      await screen.findByText(
        'Receipt tax created. INV-000010 totals updated: tax 24.75 USD · grand total 149.75 USD.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'New Receipt Tax' })).not.toBeInTheDocument();
    expect(fetchReceiptTaxes).toHaveBeenCalledTimes(2);
  });

  it('edits a tax and keeps the drawer open with the server message when it fails', async () => {
    vi.mocked(updateReceiptTax).mockRejectedValueOnce(new Error('rate cannot exceed 999.99 (column precision decimal(5,2))'));
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');

    fireEvent.click(screen.getByRole('button', { name: 'Edit IVA 19%' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Receipt Tax' });
    fireEvent.change(within(dialog).getByLabelText('Rate (%)'), { target: { value: '16' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(updateReceiptTax).toHaveBeenCalledWith(1, { name: 'IVA 19%', rate: 16, scope: 'RECEIPT' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('decimal(5,2)');
  });

  it('deactivates a tax without deleting it (status change, row kept as inactive)', async () => {
    vi.mocked(setReceiptTaxStatus).mockResolvedValue({ ...RECEIPT_TAX, is_active: false });
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate IVA 19%' }));
    expect(screen.getByText(/The tax record and its amount are kept for audit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(setReceiptTaxStatus).toHaveBeenCalledWith(1, false));
    const row = screen.getByTestId('receipt-tax-row-1');
    await waitFor(() => expect(within(row).getByText('Inactive')).toBeInTheDocument());
    expect(screen.getByText(/Excluded from the receipt totals; the record is kept/)).toBeInTheDocument();
  });

  it('reactivates an inactive tax', async () => {
    vi.mocked(setReceiptTaxStatus).mockResolvedValue({ ...INACTIVE_TAX, is_active: true });
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-3');
    fireEvent.click(screen.getByRole('button', { name: 'Activate Old municipal tax' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(setReceiptTaxStatus).toHaveBeenCalledWith(3, true));
  });

  it('filters by scope and status on the server', async () => {
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');

    fireEvent.change(screen.getByLabelText('Filter by scope'), { target: { value: 'ITEM' } });
    await waitFor(() =>
      expect(fetchReceiptTaxes).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'ITEM' })),
    );
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'inactive' } });
    await waitFor(() =>
      expect(fetchReceiptTaxes).toHaveBeenLastCalledWith(
        expect.objectContaining({ scope: 'ITEM', status: 'inactive' }),
      ),
    );
  });

  it('renders the analytical header with the consolidated metrics', async () => {
    render(<ReceiptTaxesView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Receipt Taxes' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('kpi-total-tax')).toHaveTextContent('23.75 USD'));
    expect(fetchReceiptTaxesSummary).toHaveBeenCalledWith({ taxName: undefined, rate: undefined });
  });

  it('filters the metrics and the grid by tax type and applied rate', async () => {
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');
    await screen.findByRole('option', { name: 'Sugar tax' });

    fireEvent.change(screen.getByLabelText('Tax type'), { target: { value: 'IVA 19%' } });
    await waitFor(() =>
      expect(fetchReceiptTaxes).toHaveBeenLastCalledWith(expect.objectContaining({ taxName: 'IVA 19%', page: 1 })),
    );
    await waitFor(() => expect(fetchReceiptTaxesSummary).toHaveBeenLastCalledWith({ taxName: 'IVA 19%', rate: undefined }));

    fireEvent.change(screen.getByLabelText('Applied rate'), { target: { value: '19' } });
    await waitFor(() =>
      expect(fetchReceiptTaxes).toHaveBeenLastCalledWith(expect.objectContaining({ taxName: 'IVA 19%', rate: 19 })),
    );
    await waitFor(() => expect(fetchReceiptTaxesSummary).toHaveBeenLastCalledWith({ taxName: 'IVA 19%', rate: 19 }));
  });

  it('refreshes the metrics after a status change', async () => {
    vi.mocked(setReceiptTaxStatus).mockResolvedValue({ ...RECEIPT_TAX, is_active: false });
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');
    await waitFor(() => expect(fetchReceiptTaxesSummary).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate IVA 19%' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(fetchReceiptTaxesSummary).toHaveBeenCalledTimes(2));
  });

  it('shows the API error with a retry action', async () => {
    vi.mocked(fetchReceiptTaxes).mockRejectedValueOnce(new Error('Failed to load receipt taxes.'));
    render(<ReceiptTaxesView />);
    expect(await screen.findByText('Failed to load receipt taxes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('receipt-tax-row-1')).toBeInTheDocument();
  });

  it('renders no Quick Launch panel: the NavHubBar mounted by MerchantFrame is the only shortcut bar', async () => {
    render(<ReceiptTaxesView />);
    await screen.findByTestId('receipt-tax-row-1');

    expect(screen.queryByRole('navigation', { name: 'Billing and transactions shortcuts' })).toBeNull();
    expect(screen.queryByText(/quick launch/i)).toBeNull();
    // The fixed bottom NavHubBar is mounted once by MerchantFrame, never inside the view.
    expect(screen.queryByRole('navigation', { name: /module navigation/i })).toBeNull();
  });

  describe('fiscal lock (Historia 11)', () => {
    const LOCKED_TAX: ReceiptTax = {
      ...RECEIPT_TAX,
      id: 4,
      name: 'Locked VAT',
      receipt_id: 12,
      receipt_invoice_number: 'INV-000012',
      receipt_is_locked: true,
    };

    it('hides edit and activate / deactivate on taxes of a locked receipt', async () => {
      vi.mocked(fetchReceiptTaxes).mockResolvedValue(listResult([RECEIPT_TAX, LOCKED_TAX]));
      render(<ReceiptTaxesView />);

      const lockedRow = await screen.findByTestId('receipt-tax-row-4');
      expect(within(lockedRow).getByTestId('receipt-tax-locked-4')).toHaveTextContent('Locked');
      expect(within(lockedRow).getByRole('img', { name: 'Locked receipt' })).toBeInTheDocument();
      expect(within(lockedRow).queryByRole('button', { name: 'Edit Locked VAT' })).not.toBeInTheDocument();
      expect(within(lockedRow).queryByRole('button', { name: 'Deactivate Locked VAT' })).not.toBeInTheDocument();

      const openRow = screen.getByTestId('receipt-tax-row-1');
      expect(within(openRow).getByRole('button', { name: 'Edit IVA 19%' })).toBeEnabled();
      expect(within(openRow).queryByTestId('receipt-tax-locked-1')).not.toBeInTheDocument();
    });

    it('does not let new taxes target a locked receipt', async () => {
      vi.mocked(fetchReceiptOptions).mockResolvedValue([
        { id: 10, invoice_number: 'INV-000010', type: 'invoice', subtotal: 125, grand_total: 148.75, currency: 'USD' },
        {
          id: 12,
          invoice_number: 'INV-000012',
          type: 'invoice',
          subtotal: 50,
          grand_total: 59.5,
          currency: 'USD',
          is_locked: true,
        },
      ]);
      render(<ReceiptTaxesView />);
      await screen.findByTestId('receipt-tax-row-1');

      fireEvent.click(screen.getByRole('button', { name: /New Receipt Tax/ }));
      const dialog = screen.getByRole('dialog', { name: 'New Receipt Tax' });
      const lockedOption = await within(dialog).findByRole('option', { name: /INV-000012.*locked/ });
      expect(lockedOption).toBeDisabled();
      expect(within(dialog).getByRole('option', { name: /INV-000010/ })).toBeEnabled();
    });
  });
});

