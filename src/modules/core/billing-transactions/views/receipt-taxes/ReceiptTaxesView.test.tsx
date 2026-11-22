import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReceiptTaxesView } from './ReceiptTaxesView';
import type { ReceiptTax } from '../../types/receipt-taxes';

vi.mock('../../api/receipt-taxes-api', () => ({
  fetchReceiptTaxes: vi.fn(),
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

const listResult = (data: ReceiptTax[]) => ({ data, page: 1, limit: 25, total: data.length, totalPages: 1 });

describe('ReceiptTaxesView', () => {
  beforeEach(() => {
    vi.mocked(fetchReceiptTaxes).mockResolvedValue(listResult([RECEIPT_TAX, ITEM_TAX, INACTIVE_TAX]));
    vi.mocked(fetchReceiptOptions).mockResolvedValue([
      { id: 10, invoice_number: 'INV-000010', type: 'invoice', subtotal: 125, grand_total: 148.75, currency: 'USD' },
    ]);
    vi.mocked(fetchReceiptItemOptions).mockResolvedValue([]);
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

  it('shows the API error with a retry action', async () => {
    vi.mocked(fetchReceiptTaxes).mockRejectedValueOnce(new Error('Failed to load receipt taxes.'));
    render(<ReceiptTaxesView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load receipt taxes.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('receipt-tax-row-1')).toBeInTheDocument();
  });
});
