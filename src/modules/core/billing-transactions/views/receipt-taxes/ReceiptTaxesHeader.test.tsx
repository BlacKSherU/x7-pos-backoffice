import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReceiptTaxesHeader } from './ReceiptTaxesHeader';
import type { ReceiptTaxesSummary } from '../../types/receipt-taxes';

const SUMMARY: ReceiptTaxesSummary = {
  total_count: 6,
  active_count: 5,
  inactive_count: 1,
  receipts_count: 3,
  totals_by_currency: [
    { currency: 'USD', total_amount: 130.3, receipt_scope_amount: 120.1, item_scope_amount: 10.2 },
    { currency: 'EUR', total_amount: 5, receipt_scope_amount: 0, item_scope_amount: 5 },
  ],
  by_scope: [
    { scope: 'RECEIPT', currency: 'USD', count: 3, total_amount: 120.1 },
    { scope: 'ITEM', currency: 'USD', count: 1, total_amount: 10.2 },
    { scope: 'ITEM', currency: 'EUR', count: 1, total_amount: 5 },
  ],
  by_type: [
    { name: 'IVA 19%', rate: 19, currency: 'USD', count: 3, total_amount: 120.1 },
    { name: 'Sugar tax', rate: 5, currency: 'USD', count: 1, total_amount: 10.2 },
  ],
  filter_options: { names: ['IVA 19%', 'Sugar tax'], rates: [5, 19] },
};

function renderHeader(props: Partial<React.ComponentProps<typeof ReceiptTaxesHeader>> = {}) {
  const onTaxNameChange = vi.fn();
  const onRateChange = vi.fn();
  render(
    <ReceiptTaxesHeader
      summary={SUMMARY}
      loading={false}
      error={null}
      taxName=""
      rate=""
      onTaxNameChange={onTaxNameChange}
      onRateChange={onRateChange}
      {...props}
    />,
  );
  return { onTaxNameChange, onRateChange };
}

describe('ReceiptTaxesHeader', () => {
  afterEach(() => cleanup());

  it('explains the purpose of the section and the fiscal meaning of each scope', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 2, name: 'Receipt Taxes' })).toBeInTheDocument();
    expect(screen.getByText(/Fiscal record of every tax charged on customer receipts/)).toBeInTheDocument();

    const receiptScope = screen.getByTestId('receipt-scope-explainer');
    expect(within(receiptScope).getByText(/Receipt scope/)).toBeInTheDocument();
    expect(within(receiptScope).getByText(/once over the receipt subtotal/)).toBeInTheDocument();

    const itemScope = screen.getByTestId('item-scope-explainer');
    expect(within(itemScope).getByText(/Item scope/)).toBeInTheDocument();
    expect(within(itemScope).getByText(/taxable base of one receipt line/)).toBeInTheDocument();

    expect(screen.getByText(/Only active tax lines are added to the receipt totals/)).toBeInTheDocument();
  });

  it('shows the consolidated metrics with 2 decimals and the currency code', () => {
    renderHeader();
    expect(screen.getByTestId('kpi-active-lines')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-active-lines')).toHaveTextContent('1 inactive · 6 total');
    expect(screen.getByTestId('kpi-total-tax')).toHaveTextContent('130.30 USD');
    expect(screen.getByTestId('kpi-total-tax')).toHaveTextContent('+ 5.00 EUR');
    expect(screen.getByTestId('kpi-receipt-scope')).toHaveTextContent('120.10 USD');
    expect(screen.getByTestId('kpi-receipt-scope')).toHaveTextContent('3 lines');
    expect(screen.getByTestId('kpi-item-scope')).toHaveTextContent('10.20 USD');
    expect(screen.getByTestId('kpi-item-scope')).toHaveTextContent('2 lines');
    expect(screen.getByTestId('kpi-receipts')).toHaveTextContent('3');
  });

  it('breaks the active tax down by type and rate', () => {
    renderHeader();
    const list = screen.getByRole('list', { name: 'Tax breakdown by type and rate' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('IVA 19%');
    expect(items[0]).toHaveTextContent('19.00%');
    expect(items[0]).toHaveTextContent('3 lines');
    expect(items[0]).toHaveTextContent('120.10 USD');
    expect(items[1]).toHaveTextContent('1 line');
  });

  it('offers tax type and applied rate filters built from the merchant taxes', () => {
    const { onTaxNameChange, onRateChange } = renderHeader();
    const typeSelect = screen.getByLabelText('Tax type');
    expect(within(typeSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All tax types',
      'IVA 19%',
      'Sugar tax',
    ]);
    fireEvent.change(typeSelect, { target: { value: 'Sugar tax' } });
    expect(onTaxNameChange).toHaveBeenCalledWith('Sugar tax');

    const rateSelect = screen.getByLabelText('Applied rate');
    expect(within(rateSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All rates',
      '5.00%',
      '19.00%',
    ]);
    fireEvent.change(rateSelect, { target: { value: '19' } });
    expect(onRateChange).toHaveBeenCalledWith('19');
  });

  it('resets both tax filters', () => {
    const { onTaxNameChange, onRateChange } = renderHeader({ taxName: 'IVA 19%', rate: '19' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset tax filters' }));
    expect(onTaxNameChange).toHaveBeenCalledWith('');
    expect(onRateChange).toHaveBeenCalledWith('');
  });

  it('uses Poppins and fluid grids so it adapts to the screen width', () => {
    renderHeader();
    const section = screen.getByRole('region', { name: 'Receipt Taxes' });
    expect(section).toHaveClass('font-poppins');
    expect(screen.getByLabelText('Receipt tax metrics').className).toContain('grid-cols-[repeat(auto-fit,minmax(190px,1fr))]');
    expect(screen.getByTestId('receipt-scope-explainer').parentElement?.className).toContain('auto-fit');
  });

  it('shows placeholders while loading and a retry on error', () => {
    renderHeader({ summary: null, loading: true });
    expect(screen.getByTestId('kpi-total-tax')).toHaveTextContent('…');
    cleanup();
    const onRetry = vi.fn();
    renderHeader({ summary: null, error: 'Failed to load receipt tax metrics.', onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load receipt tax metrics.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry metrics' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
