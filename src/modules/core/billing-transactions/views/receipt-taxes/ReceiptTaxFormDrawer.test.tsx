import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReceiptTaxFormDrawer } from './ReceiptTaxFormDrawer';
import type { ReceiptTax } from '../../types/receipt-taxes';

vi.mock('../../api/receipt-taxes-api', () => ({
  fetchReceiptOptions: vi.fn(),
  fetchReceiptItemOptions: vi.fn(),
}));

import { fetchReceiptItemOptions, fetchReceiptOptions } from '../../api/receipt-taxes-api';

const RECEIPTS = [
  { id: 10, invoice_number: 'INV-000010', type: 'invoice', subtotal: 125, grand_total: 140, currency: 'USD' },
  { id: 11, invoice_number: null, type: 'receipt', subtotal: 40, grand_total: 40, currency: 'EUR' },
];
const ITEMS = [
  { id: 5, receipt_id: 10, name: 'Burger Combo', sku: 'SKU-1', subtotal: 25, discount_amount: 5, total: 20 },
  { id: 6, receipt_id: 10, name: 'Soda', sku: null, subtotal: 3, discount_amount: 0, total: 3 },
];

const ITEM_TAX: ReceiptTax = {
  id: 1,
  receipt_id: 10,
  receipt_item_id: 5,
  name: 'IVA 19%',
  rate: 19,
  amount: 3.8,
  scope: 'ITEM',
  is_active: true,
  receipt_invoice_number: 'INV-000010',
  receipt_is_locked: false,
  currency: 'USD',
  receipt_item_name: 'Burger Combo',
  receipt_total_tax: 3.8,
  receipt_grand_total: 23.8,
  created_at: '2026-01-01T00:00:00Z',
};

function renderDrawer(props: Partial<React.ComponentProps<typeof ReceiptTaxFormDrawer>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReceiptTaxFormDrawer
      mode="create"
      submitting={false}
      submitError={null}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
}

describe('ReceiptTaxFormDrawer', () => {
  beforeEach(() => {
    vi.mocked(fetchReceiptOptions).mockResolvedValue(RECEIPTS);
    vi.mocked(fetchReceiptItemOptions).mockResolvedValue(ITEMS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('associates a tax to the global receipt: no item is sent and the amount is not part of the payload', async () => {
    const { onSubmit } = renderDrawer();
    expect(screen.getByRole('dialog', { name: 'New Receipt Tax' })).toBeInTheDocument();

    const receiptSelect = await screen.findByLabelText('Receipt');
    await screen.findByRole('option', { name: /INV-000010/ });
    fireEvent.change(receiptSelect, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Tax name'), { target: { value: 'IVA 19%' } });
    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '19' } });

    // Preview over the receipt subtotal (125.00 × 19%)
    expect(screen.getByTestId('rt-amount-preview')).toHaveTextContent('125.00 USD');
    expect(screen.getByTestId('rt-amount-preview')).toHaveTextContent('23.75 USD');

    fireEvent.click(screen.getByRole('button', { name: 'Create Tax' }));
    expect(onSubmit).toHaveBeenCalledWith({ receiptId: 10, name: 'IVA 19%', rate: 19, scope: 'RECEIPT' });
  });

  it('associates a tax to a specific item chosen from the receipt items', async () => {
    const { onSubmit } = renderDrawer();
    const receiptSelect = await screen.findByLabelText('Receipt');
    await screen.findByRole('option', { name: /INV-000010/ });
    fireEvent.change(receiptSelect, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('radio', { name: /Specific item/ }));

    await waitFor(() => expect(fetchReceiptItemOptions).toHaveBeenCalledWith(10));
    const itemSelect = screen.getByLabelText('Receipt item');
    await screen.findByRole('option', { name: /Burger Combo \(SKU-1\) — base 20.00 USD/ });
    fireEvent.change(itemSelect, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Tax name'), { target: { value: 'IVA 19%' } });
    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '19' } });

    // (25.00 − 5.00) × 19% = 3.80
    expect(screen.getByTestId('rt-amount-preview')).toHaveTextContent('3.80 USD');

    fireEvent.click(screen.getByRole('button', { name: 'Create Tax' }));
    expect(onSubmit).toHaveBeenCalledWith({
      receiptId: 10,
      name: 'IVA 19%',
      rate: 19,
      scope: 'ITEM',
      receiptItemId: 5,
    });
  });

  it('requires an item for item scope and a receipt, name and valid rate', async () => {
    const { onSubmit } = renderDrawer();
    await screen.findByRole('option', { name: /INV-000010/ });
    fireEvent.click(screen.getByRole('radio', { name: /Specific item/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Tax' }));

    expect(screen.getByText('Select the receipt this tax belongs to.')).toBeInTheDocument();
    expect(screen.getByText('Select the receipt item this tax applies to.')).toBeInTheDocument();
    expect(screen.getByText('Tax name is required.')).toBeInTheDocument();
    expect(screen.getByText('Rate is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enforces the decimal(5,2) precision of the rate', async () => {
    const { onSubmit } = renderDrawer();
    const receiptSelect = await screen.findByLabelText('Receipt');
    await screen.findByRole('option', { name: /INV-000010/ });
    fireEvent.change(receiptSelect, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Tax name'), { target: { value: 'VAT' } });

    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '19.555' } });
    expect(screen.getByText('Rate allows at most 2 decimal places (decimal(5,2)).')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '1000' } });
    expect(screen.getByText('Rate cannot exceed 999.99% (decimal(5,2)).')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Tax' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('edits an item tax: the receipt is fixed, fields are prefilled and receiptId is not sent', async () => {
    const { onSubmit } = renderDrawer({ mode: 'edit', initialTax: ITEM_TAX });
    expect(screen.getByRole('dialog', { name: 'Edit Receipt Tax' })).toBeInTheDocument();
    expect(screen.getByLabelText('Receipt')).toBeDisabled();
    expect(screen.getByLabelText('Receipt')).toHaveValue('INV-000010');
    expect(screen.getByLabelText('Tax name')).toHaveValue('IVA 19%');
    expect(screen.getByRole('radio', { name: /Specific item/ })).toBeChecked();
    await screen.findByRole('option', { name: /Burger Combo/ });

    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'IVA 19%', rate: 16, scope: 'ITEM', receiptItemId: 5 });
  });

  it('moves an item tax to the global receipt (scope switch drops the item)', async () => {
    const { onSubmit } = renderDrawer({ mode: 'edit', initialTax: ITEM_TAX });
    await screen.findByRole('option', { name: /Burger Combo/ });
    fireEvent.click(screen.getByRole('radio', { name: /Global receipt/ }));
    expect(screen.queryByLabelText('Receipt item')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'IVA 19%', rate: 19, scope: 'RECEIPT' });
  });

  it('shows the server error returned on submit', () => {
    renderDrawer({ submitError: 'rate cannot exceed 999.99 (column precision decimal(5,2))' });
    expect(screen.getByRole('alert')).toHaveTextContent('decimal(5,2)');
  });
});
