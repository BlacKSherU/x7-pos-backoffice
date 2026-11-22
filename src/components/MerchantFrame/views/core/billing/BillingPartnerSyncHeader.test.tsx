import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillingPartnerSyncHeader } from './BillingPartnerSyncHeader';
import * as api from '@/modules/core/billing-transactions/api/partner-sync-api';
import type {
  PartnerOption,
  PartnerSyncMetrics,
  PartnerSyncReceipt,
} from '@/modules/core/billing-transactions/types/partner-sync';
import { ApiError } from '@/shared/lib/api-error';

vi.mock('@/modules/core/billing-transactions/api/partner-sync-api', () => ({
  buildQuery: vi.fn(),
  fetchPartnerSyncMetrics: vi.fn(),
  fetchPartnerOptions: vi.fn(),
  fetchPartnerSyncReceipts: vi.fn(),
  linkReceiptToPartner: vi.fn(),
}));

const METRICS: PartnerSyncMetrics = {
  scope: 'merchant',
  currency: 'USD',
  total_b2b_invoices: 42,
  b2b_invoiced_amount: 15230.5,
  explicitly_linked_invoices: 9,
  linked_customers: 12,
  linked_suppliers: 2,
  active_corporate_accounts: 14,
  outstanding_balance: 3120.75,
  billed_amount: 18000,
  open_credit_orders: 5,
  corporate_credit_utilization: 17.34,
};

const receipt = (overrides: Partial<PartnerSyncReceipt> = {}): PartnerSyncReceipt => ({
  id: 120,
  invoice_number: 'INV-000120',
  type: 'INVOICE',
  merchant_id: 1,
  order_id: 88,
  grand_total: 250.5,
  currency: 'USD',
  is_locked: false,
  created_at: '2026-11-20T15:00:00Z',
  fiscal_tax_id: null,
  tax_id: '11.111.111-1',
  partner: { type: 'customer', id: 7, name: 'Walk-in Guest', tax_id: '11.111.111-1' },
  link_source: 'order',
  order_customer: { id: 7, name: 'Walk-in Guest' },
  order_balance_due: 0,
  ...overrides,
});

const CUSTOMERS: PartnerOption[] = [
  { id: 12, type: 'customer', name: 'Inversiones Pacifico SpA', tax_id: '77.890.123-4', email: 'billing@pacifico.cl', merchant_id: 1 },
];
const SUPPLIERS: PartnerOption[] = [
  { id: 3, type: 'supplier', name: 'Coca-Cola Andina', tax_id: '12345678-9', email: null, merchant_id: null },
];

const mocked = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.fetchPartnerSyncMetrics.mockResolvedValue(METRICS);
  mocked.fetchPartnerSyncReceipts.mockResolvedValue({
    data: [receipt(), receipt({ id: 121, invoice_number: 'INV-000121', is_locked: true })],
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  mocked.fetchPartnerOptions.mockImplementation(async (type) => (type === 'supplier' ? SUPPLIERS : CUSTOMERS));
});

afterEach(() => {
  cleanup();
});

describe('BillingPartnerSyncHeader', () => {
  it('displays the title BUSINESS PARTNERS BILLING LINK with the badge, partner_exchange and groups icons', async () => {
    render(<BillingPartnerSyncHeader />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'BUSINESS PARTNERS BILLING LINK' }),
    ).toBeInTheDocument();
    await screen.findByText('42');

    const icons = Array.from(document.querySelectorAll('.material-symbols-outlined')).map((el) => el.textContent?.trim());
    expect(icons).toEqual(expect.arrayContaining(['badge', 'partner_exchange', 'groups']));
    expect(screen.getByRole('button', { name: /LINK CUSTOMER PROFILE/ })).toBeInTheDocument();
  });

  it('renders the B2B KPIs and partner metadata in the billing context', async () => {
    render(<BillingPartnerSyncHeader />);

    const invoices = await screen.findByTestId('kpi-b2b-invoices');
    await waitFor(() => expect(within(invoices).getByText('42')).toBeInTheDocument());
    expect(within(invoices).getByText('Total B2B Invoices')).toBeInTheDocument();
    expect(within(invoices).getByText('15,230.50 USD')).toBeInTheDocument();
    expect(invoices).toHaveTextContent('9 linked to a profile');

    const customers = screen.getByTestId('kpi-linked-customers');
    expect(within(customers).getByText('Linked Customers')).toBeInTheDocument();
    expect(within(customers).getByText('12')).toBeInTheDocument();
    expect(customers).toHaveTextContent('2 suppliers');
    expect(customers).toHaveTextContent('14 active corporate accounts');

    const credit = screen.getByTestId('kpi-credit-utilization');
    expect(within(credit).getByText('Corporate Credit Utilization')).toBeInTheDocument();
    expect(within(credit).getByText('17.34%')).toBeInTheDocument();
    expect(within(credit).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17.34');
    expect(credit).toHaveTextContent('3,120.75 USD on credit of 18,000.00 USD billed');

    const outstanding = screen.getByTestId('kpi-outstanding');
    expect(within(outstanding).getByText('Outstanding Balances')).toBeInTheDocument();
    expect(within(outstanding).getByText('3,120.75 USD')).toBeInTheDocument();
    expect(outstanding).toHaveTextContent('5 open credit orders');
  });

  it('requests metrics for the scope and reloads them when refreshKey changes', async () => {
    const { rerender } = render(<BillingPartnerSyncHeader scope="company" merchantId={4} refreshKey={0} />);
    await waitFor(() =>
      expect(mocked.fetchPartnerSyncMetrics).toHaveBeenCalledWith({ scope: 'company', merchantId: 4 }),
    );
    expect(screen.getByTestId('partner-sync-scope')).toHaveTextContent('Company-wide');

    rerender(<BillingPartnerSyncHeader scope="company" merchantId={4} refreshKey={1} />);
    await waitFor(() => expect(mocked.fetchPartnerSyncMetrics).toHaveBeenCalledTimes(2));
  });

  it('shows the API error and retries', async () => {
    mocked.fetchPartnerSyncMetrics.mockRejectedValueOnce(new ApiError('Backend down', 500));
    render(<BillingPartnerSyncHeader />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(screen.getByTestId('kpi-b2b-invoices')).getByText('42')).toBeInTheDocument());
    expect(screen.queryByText('Backend down')).not.toBeInTheDocument();
  });

  it('LINK CUSTOMER PROFILE assigns the chosen receipt to the chosen customer and refreshes the KPIs', async () => {
    const onLinked = vi.fn();
    const linked = receipt({
      partner: { type: 'customer', id: 12, name: 'Inversiones Pacifico SpA', tax_id: '77.890.123-4' },
      link_source: 'receipt',
    });
    mocked.linkReceiptToPartner.mockResolvedValue(linked);
    const user = userEvent.setup();
    render(<BillingPartnerSyncHeader onLinked={onLinked} />);
    await screen.findByText('42');

    await user.click(screen.getByRole('button', { name: /LINK CUSTOMER PROFILE/ }));
    const drawer = await screen.findByRole('dialog', { name: 'LINK CUSTOMER PROFILE' });

    // Por defecto lista los recibos que aún usan el cliente de la orden.
    await waitFor(() =>
      expect(mocked.fetchPartnerSyncReceipts).toHaveBeenCalledWith(
        expect.objectContaining({ linkState: 'unlinked' }),
      ),
    );
    // Un recibo con bloqueo fiscal no se puede elegir.
    expect(await within(drawer).findByRole('radio', { name: 'Receipt INV-000121' })).toBeDisabled();

    const submit = within(drawer).getByRole('button', { name: /LINK CUSTOMER PROFILE/ });
    expect(submit).toBeDisabled();

    await user.click(within(drawer).getByRole('radio', { name: 'Receipt INV-000120' }));
    expect(within(drawer).getByTestId('selected-receipt')).toHaveTextContent('Walk-in Guest');
    await user.click(await within(drawer).findByRole('radio', { name: 'Customer Inversiones Pacifico SpA' }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(mocked.linkReceiptToPartner).toHaveBeenCalledWith(120, 'customer', 12));
    expect(onLinked).toHaveBeenCalledWith(linked);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Receipt INV-000120 linked to Inversiones Pacifico SpA.',
    );
    await waitFor(() => expect(mocked.fetchPartnerSyncMetrics).toHaveBeenCalledTimes(2));
  });

  it('can link a supplier profile instead of a customer', async () => {
    mocked.linkReceiptToPartner.mockResolvedValue(
      receipt({ partner: { type: 'supplier', id: 3, name: 'Coca-Cola Andina', tax_id: null }, link_source: 'receipt' }),
    );
    const user = userEvent.setup();
    render(<BillingPartnerSyncHeader />);
    await user.click(screen.getByRole('button', { name: /LINK CUSTOMER PROFILE/ }));
    const drawer = await screen.findByRole('dialog');

    await user.click(await within(drawer).findByRole('radio', { name: 'Receipt INV-000120' }));
    await user.click(within(drawer).getByRole('button', { name: /Supplier/ }));
    await waitFor(() => expect(mocked.fetchPartnerOptions).toHaveBeenCalledWith('supplier', ''));
    await user.click(await within(drawer).findByRole('radio', { name: 'Supplier Coca-Cola Andina' }));
    await user.click(within(drawer).getByRole('button', { name: /LINK SUPPLIER PROFILE/ }));

    await waitFor(() => expect(mocked.linkReceiptToPartner).toHaveBeenCalledWith(120, 'supplier', 3));
  });

  it('keeps the drawer open and shows the error when the link is rejected', async () => {
    mocked.linkReceiptToPartner.mockRejectedValue(
      new ApiError('Customer does not belong to the same company as the receipt', 403),
    );
    const user = userEvent.setup();
    render(<BillingPartnerSyncHeader />);
    await user.click(screen.getByRole('button', { name: /LINK CUSTOMER PROFILE/ }));
    const drawer = await screen.findByRole('dialog');

    await user.click(await within(drawer).findByRole('radio', { name: 'Receipt INV-000120' }));
    await user.click(await within(drawer).findByRole('radio', { name: 'Customer Inversiones Pacifico SpA' }));
    await user.click(within(drawer).getByRole('button', { name: /LINK CUSTOMER PROFILE/ }));

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Customer does not belong to the same company as the receipt',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
