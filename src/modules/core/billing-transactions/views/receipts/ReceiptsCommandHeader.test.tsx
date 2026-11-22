import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsCommandHeader, type ReceiptsCommandHeaderProps } from './ReceiptsCommandHeader';
import type { ReceiptSummary } from '../../types/receipts';

const summary: ReceiptSummary = {
  status: 'active',
  total_receipts: 12,
  active_receipts: 12,
  inactive_receipts: 3,
  locked_receipts: 5,
  currency: 'USD',
  grand_total: 15230.5,
  subtotal: 13000,
  total_tax: 2470,
  total_discount: 239.5,
  average_ticket: 1269.21,
  by_type: [
    { type: 'INVOICE', receipts: 7, grand_total: 10000 },
    { type: 'RECEIPT', receipts: 5, grand_total: 5230.5 },
  ],
  by_currency: [
    { currency: 'USD', receipts: 11, grand_total: 15230.5, total_tax: 2470 },
    { currency: 'EUR', receipts: 1, grand_total: 80, total_tax: 0 },
  ],
};

function renderHeader(overrides: Partial<ReceiptsCommandHeaderProps> = {}) {
  const props: ReceiptsCommandHeaderProps = {
    summary,
    loading: false,
    statusFilter: 'active',
    typeFilter: '',
    onTypeFilterChange: vi.fn(),
    onBackToHub: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
  render(<ReceiptsCommandHeader {...props} />);
  return props;
}

afterEach(cleanup);

describe('ReceiptsCommandHeader (Historia 19)', () => {
  it('renders the "Billing & Transactions" title and the descriptive block', () => {
    renderHeader();

    expect(screen.getByRole('heading', { level: 1, name: 'Billing & Transactions' })).toBeInTheDocument();
    expect(screen.getByText(/invoice number unique per merchant/i)).toBeInTheDocument();
  });

  it('shows the KPIs from the summary: active count and sum of grand_total with currency', () => {
    renderHeader();

    const kpis = screen.getByRole('region', { name: 'Receipts KPIs' });
    expect(within(screen.getByTestId('receipts-kpi-count')).getByText('Active receipts')).toBeInTheDocument();
    expect(within(screen.getByTestId('receipts-kpi-count')).getByText('12')).toBeInTheDocument();
    expect(within(screen.getByTestId('receipts-kpi-count')).getByText('5 fiscally locked')).toBeInTheDocument();
    expect(within(kpis).getByTestId('receipts-kpi-volume')).toHaveTextContent('15,230.50 USD');
    expect(within(kpis).getByTestId('receipts-kpi-volume')).toHaveTextContent('+1 other currency');
    expect(within(kpis).getByTestId('receipts-kpi-tax')).toHaveTextContent('2,470.00 USD');
    expect(within(kpis).getByTestId('receipts-kpi-average')).toHaveTextContent('1,269.21 USD');
    expect(within(kpis).getByTestId('receipts-kpi-average')).toHaveTextContent('3 logically deleted');
  });

  it('labels the count KPI after the active status filter', () => {
    renderHeader({ statusFilter: 'inactive' });
    expect(screen.getByText('Inactive receipts')).toBeInTheDocument();
  });

  it('offers quick filters by receipt type with their counts', async () => {
    const props = renderHeader({ typeFilter: 'INVOICE' });

    const group = screen.getByRole('group', { name: 'Quick filters by receipt type' });
    const invoices = within(group).getByRole('button', { name: /invoices/i });
    expect(invoices).toHaveAttribute('aria-pressed', 'true');
    expect(invoices).toHaveTextContent('7');
    expect(within(group).getByRole('button', { name: /^receipts\s*5$/i })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /all types/i })).toHaveTextContent('12');

    await userEvent.click(within(group).getByRole('button', { name: /all types/i }));
    expect(props.onTypeFilterChange).toHaveBeenCalledWith('');
  });

  it('returns to the BILLING & TRANSACTIONS COMMAND HUB', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /billing & transactions command hub/i }));

    expect(props.onBackToHub).toHaveBeenCalledTimes(1);
  });

  it('uses the Poppins font family on every text block', () => {
    renderHeader();

    const header = screen.getByTestId('receipts-command-header');
    expect(header.className).toContain('font-poppins');
    for (const el of [
      screen.getByRole('heading', { level: 1 }),
      screen.getByText(/invoice number unique per merchant/i),
      screen.getByRole('button', { name: /billing & transactions command hub/i }),
      screen.getByText('Invoiced volume'),
      screen.getByText('Quick filters'),
    ]) {
      expect(el.className).toContain('font-poppins');
    }
  });

  it('shows placeholders while loading and zeros without data', () => {
    renderHeader({ loading: true, summary: null });
    expect(within(screen.getByTestId('receipts-kpi-volume')).getByText('…')).toBeInTheDocument();
    cleanup();

    renderHeader({ summary: null });
    expect(screen.getByTestId('receipts-kpi-volume')).toHaveTextContent('0.00 USD');
  });
});
