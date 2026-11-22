import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillingPartnerSyncGrid } from './BillingPartnerSyncGrid';
import * as api from '@/modules/core/billing-transactions/api/partner-sync-api';
import type {
  PaginatedPartnerGroups,
  PartnerGroup,
  PartnerOption,
  PartnerSyncReceipt,
} from '@/modules/core/billing-transactions/types/partner-sync';
import { ApiError } from '@/shared/lib/api-error';

vi.mock('@/modules/core/billing-transactions/api/partner-sync-api', () => ({
  buildQuery: vi.fn(),
  fetchPartnerSyncMetrics: vi.fn(),
  fetchPartnerOptions: vi.fn(),
  fetchPartnerSyncReceipts: vi.fn(),
  linkReceiptToPartner: vi.fn(),
  fetchPartnerGroups: vi.fn(),
  fetchCompanyMerchants: vi.fn(),
  unlinkReceiptPartner: vi.fn(),
}));

const group = (overrides: Partial<PartnerGroup> = {}): PartnerGroup => ({
  partner_type: 'customer',
  partner_id: 12,
  name: 'Inversiones Pacifico SpA',
  tax_id: '76.111.222-3',
  fiscal_tax_id: '76.111.222-3',
  partner_tax_id: '77.890.123-4',
  association: 'company',
  partner_company_id: 9,
  partner_merchant_id: 1,
  invoice_count: 5,
  linked_invoice_count: 3,
  total_volume: 1250.5,
  outstanding_balance: 200.1,
  currency: 'USD',
  merchant_count: 2,
  last_invoice_at: '2026-11-20T15:00:00Z',
  ...overrides,
});

const GROUPS: PartnerGroup[] = [
  group(),
  group({
    partner_type: 'supplier',
    partner_id: 3,
    name: 'Distribuidora Andes',
    tax_id: '96.555.444-1',
    fiscal_tax_id: null,
    partner_tax_id: '96.555.444-1',
    partner_merchant_id: null,
    invoice_count: 2,
    linked_invoice_count: 2,
    total_volume: 400,
    outstanding_balance: 0,
    merchant_count: 1,
  }),
  group({
    partner_id: 7,
    name: 'Walk-in Guest',
    tax_id: null,
    fiscal_tax_id: null,
    partner_tax_id: null,
    association: 'merchant',
    partner_company_id: null,
    invoice_count: 1,
    linked_invoice_count: 0,
    total_volume: 9.99,
    outstanding_balance: 0,
    merchant_count: 1,
  }),
];

const page = (data: PartnerGroup[], overrides: Partial<PaginatedPartnerGroups> = {}): PaginatedPartnerGroups => ({
  data,
  page: 1,
  limit: 10,
  total: data.length,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
  summary: { partners: data.length, invoices: 8, total_volume: 1660.49 },
  ...overrides,
});

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
  fiscal_tax_id: '76.111.222-3',
  tax_id: '76.111.222-3',
  partner: { type: 'customer', id: 12, name: 'Inversiones Pacifico SpA', tax_id: '77.890.123-4' },
  link_source: 'receipt',
  order_customer: { id: 7, name: 'Walk-in Guest' },
  order_balance_due: 0,
  ...overrides,
});

const CUSTOMERS: PartnerOption[] = [
  { id: 12, type: 'customer', name: 'Inversiones Pacifico SpA', tax_id: '77.890.123-4', email: null, merchant_id: 1 },
  { id: 15, type: 'customer', name: 'Constructora Sur Ltda', tax_id: '78.000.111-2', email: null, merchant_id: 4 },
];

const mocked = vi.mocked(api);

/** Últimos parámetros con los que se pidió el grid. */
const lastGroupsParams = () => mocked.fetchPartnerGroups.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.fetchPartnerGroups.mockResolvedValue(page(GROUPS));
  mocked.fetchCompanyMerchants.mockResolvedValue([
    { id: 4, name: 'Centro', is_current: false },
    { id: 1, name: 'Providencia', is_current: true },
  ]);
  mocked.fetchPartnerSyncReceipts.mockResolvedValue({
    data: [
      receipt(),
      receipt({ id: 121, invoice_number: 'INV-000121', link_source: 'order', partner: { type: 'customer', id: 12, name: 'Inversiones Pacifico SpA', tax_id: null } }),
      receipt({ id: 122, invoice_number: 'INV-000122', is_locked: true }),
    ],
    page: 1,
    limit: 10,
    total: 3,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  mocked.fetchPartnerOptions.mockResolvedValue(CUSTOMERS);
});

afterEach(() => {
  cleanup();
});

describe('BillingPartnerSyncGrid', () => {
  it('groups receipts by customer and supplier with name, tax ID, total volume and invoice count', async () => {
    render(<BillingPartnerSyncGrid />);

    const customerRow = await screen.findByTestId('partner-row-customer:12');
    expect(customerRow).toHaveTextContent('Inversiones Pacifico SpA');
    expect(customerRow).toHaveTextContent('Customer #12 · 2 branches');
    expect(within(customerRow).getByText('76.111.222-3')).toBeInTheDocument();
    expect(within(customerRow).getByText('Fiscal')).toBeInTheDocument();
    expect(within(customerRow).getByText('Company account')).toBeInTheDocument();
    expect(within(customerRow).getByText('5')).toBeInTheDocument();
    expect(customerRow).toHaveTextContent('3 linked');
    expect(within(customerRow).getByText('1,250.50 USD')).toBeInTheDocument();
    expect(within(customerRow).getByText('200.10 USD')).toBeInTheDocument();

    const supplierRow = screen.getByTestId('partner-row-supplier:3');
    expect(supplierRow).toHaveTextContent('Supplier #3');
    expect(within(supplierRow).getByText('96.555.444-1')).toBeInTheDocument();
    expect(within(supplierRow).getByText('400.00 USD')).toBeInTheDocument();

    const branchRow = screen.getByTestId('partner-row-customer:7');
    expect(within(branchRow).getByText('Branch only')).toBeInTheDocument();
    expect(within(branchRow).getByText('—')).toBeInTheDocument();

    expect(screen.getByTestId('partner-grid-summary')).toHaveTextContent('3 partners · 8 invoices · 1,660.49 USD');
    expect(mocked.fetchPartnerGroups).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'merchant', page: 1, limit: 10, sortBy: 'volume', sortOrder: 'DESC' }),
    );
  });

  it('filters by customer ID and rejects invalid IDs', async () => {
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid />);
    await screen.findByTestId('partner-row-customer:12');

    const input = screen.getByLabelText('Customer ID');
    await user.type(input, 'abc');
    expect(screen.getByText('Enter a valid customer ID.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // Un ID inválido no dispara otra consulta (tras el debounce).
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mocked.fetchPartnerGroups).toHaveBeenCalledTimes(1);

    await user.clear(input);
    await user.type(input, '12');
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ customerId: 12, page: 1 }));
    expect(screen.queryByText('Enter a valid customer ID.')).not.toBeInTheDocument();
  });

  it('filters by company associations: company-wide scope, branch and association type', async () => {
    const onScopeChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<BillingPartnerSyncGrid scope="merchant" onScopeChange={onScopeChange} />);
    await screen.findByTestId('partner-row-customer:12');

    // La sucursal solo se elige con alcance de compañía.
    expect(screen.getByLabelText('Company branch')).toBeDisabled();
    await user.click(within(screen.getByRole('group', { name: 'Scope' })).getByRole('button', { name: 'Company-wide' }));
    expect(onScopeChange).toHaveBeenCalledWith('company', undefined);

    rerender(<BillingPartnerSyncGrid scope="company" onScopeChange={onScopeChange} />);
    await waitFor(() => expect(mocked.fetchCompanyMerchants).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ scope: 'company', merchantId: undefined }));
    const branch = screen.getByLabelText('Company branch');
    expect(branch).toBeEnabled();
    expect(await within(branch).findByRole('option', { name: 'Providencia (current)' })).toBeInTheDocument();

    await user.selectOptions(branch, '4');
    expect(onScopeChange).toHaveBeenLastCalledWith('company', 4);
    rerender(<BillingPartnerSyncGrid scope="company" merchantId={4} onScopeChange={onScopeChange} />);
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ scope: 'company', merchantId: 4 }));

    await user.selectOptions(screen.getByLabelText('Company association'), 'company');
    await waitFor(() =>
      expect(lastGroupsParams()).toMatchObject({ scope: 'company', merchantId: 4, association: 'company' }),
    );
    await user.selectOptions(screen.getByLabelText('Company association'), 'merchant');
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ association: 'merchant' }));
  });

  it('filters by partner type, link state, partner search and sort', async () => {
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid />);
    await screen.findByTestId('partner-row-customer:12');

    await user.click(within(screen.getByRole('group', { name: 'Partner type' })).getByRole('button', { name: 'Suppliers' }));
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ partnerType: 'supplier' }));

    await user.selectOptions(screen.getByLabelText('Profile link'), 'unlinked');
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ linkState: 'unlinked' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search partners' }), 'Andes');
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ search: 'Andes' }));

    await user.selectOptions(screen.getByLabelText('Sort by'), 'name');
    await user.click(screen.getByRole('button', { name: 'Sort ascending' }));
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ sortBy: 'name', sortOrder: 'ASC' }));

    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    await waitFor(() =>
      expect(lastGroupsParams()).toMatchObject({ partnerType: undefined, linkState: 'all', search: '' }),
    );
  });

  it('opens the receipts of a customer or supplier using its partner ID', async () => {
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid />);
    await screen.findByTestId('partner-row-customer:12');

    await user.click(screen.getByRole('button', { name: 'Show receipts of Inversiones Pacifico SpA' }));
    await waitFor(() =>
      expect(mocked.fetchPartnerSyncReceipts).toHaveBeenLastCalledWith(
        expect.objectContaining({ partnerType: 'customer', customerId: 12, supplierId: undefined, page: 1 }),
      ),
    );
    const receipts = await screen.findByTestId('partner-receipts');
    expect(await within(receipts).findByTestId('partner-receipt-120')).toHaveTextContent('Linked profile');
    expect(within(receipts).getByTestId('partner-receipt-121')).toHaveTextContent('From order');
    expect(within(receipts).getByRole('button', { name: 'Reassign receipt INV-000120' })).toBeEnabled();
    expect(within(receipts).getByRole('button', { name: 'Assign receipt INV-000121' })).toBeEnabled();
    // Los recibos con bloqueo fiscal no se pueden reasignar.
    expect(within(receipts).getByRole('button', { name: 'Reassign receipt INV-000122' })).toBeDisabled();
    expect(within(receipts).getByRole('button', { name: 'Unlink receipt INV-000122' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Show receipts of Distribuidora Andes' }));
    await waitFor(() =>
      expect(mocked.fetchPartnerSyncReceipts).toHaveBeenLastCalledWith(
        expect.objectContaining({ partnerType: 'supplier', supplierId: 3, customerId: undefined }),
      ),
    );
  });

  it('quick-reassigns a receipt to another customer and refreshes grid and header', async () => {
    const onChanged = vi.fn();
    const reassigned = receipt({
      partner: { type: 'customer', id: 15, name: 'Constructora Sur Ltda', tax_id: '78.000.111-2' },
    });
    mocked.linkReceiptToPartner.mockResolvedValue(reassigned);
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid onChanged={onChanged} />);
    await screen.findByTestId('partner-row-customer:12');
    await user.click(screen.getByRole('button', { name: 'Show receipts of Inversiones Pacifico SpA' }));

    await user.click(await screen.findByRole('button', { name: 'Reassign receipt INV-000120' }));
    const drawer = await screen.findByRole('dialog', { name: 'LINK CUSTOMER PROFILE' });
    // El recibo ya viene elegido: no hay que buscarlo.
    expect(within(drawer).getByTestId('selected-receipt')).toHaveTextContent('INV-000120');
    await user.click(await within(drawer).findByRole('radio', { name: 'Customer Constructora Sur Ltda' }));
    await user.click(within(drawer).getByRole('button', { name: /LINK CUSTOMER PROFILE/ }));

    await waitFor(() => expect(mocked.linkReceiptToPartner).toHaveBeenCalledWith(120, 'customer', 15));
    expect(onChanged).toHaveBeenCalledWith(reassigned);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('Receipt INV-000120 assigned to Constructora Sur Ltda.');
    await waitFor(() => expect(mocked.fetchPartnerGroups).toHaveBeenCalledTimes(2));
  });

  it('unlinks a receipt so it goes back to its order customer', async () => {
    const onChanged = vi.fn();
    const unlinked = receipt({
      link_source: 'order',
      partner: { type: 'customer', id: 7, name: 'Walk-in Guest', tax_id: null },
    });
    mocked.unlinkReceiptPartner.mockResolvedValue(unlinked);
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid onChanged={onChanged} />);
    await screen.findByTestId('partner-row-customer:12');
    await user.click(screen.getByRole('button', { name: 'Show receipts of Inversiones Pacifico SpA' }));

    await user.click(await screen.findByRole('button', { name: 'Unlink receipt INV-000120' }));

    await waitFor(() => expect(mocked.unlinkReceiptPartner).toHaveBeenCalledWith(120));
    expect(onChanged).toHaveBeenCalledWith(unlinked);
    expect(await screen.findByRole('status')).toHaveTextContent('Receipt INV-000120 now uses its order customer.');
  });

  it('only lets the session branch reassign receipts in company scope', async () => {
    mocked.fetchPartnerSyncReceipts.mockResolvedValue({
      data: [receipt({ id: 130, invoice_number: 'INV-000130', merchant_id: 4 }), receipt()],
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid scope="company" />);
    await screen.findByTestId('partner-row-customer:12');
    await waitFor(() => expect(mocked.fetchCompanyMerchants).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Show receipts of Inversiones Pacifico SpA' }));

    expect(await screen.findByRole('button', { name: 'Reassign receipt INV-000130' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reassign receipt INV-000120' })).toBeEnabled();
  });

  it('shows the empty state, API errors with retry, and paginates', async () => {
    mocked.fetchPartnerGroups.mockRejectedValueOnce(new ApiError('Backend down', 500));
    const user = userEvent.setup();
    render(<BillingPartnerSyncGrid />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend down');
    mocked.fetchPartnerGroups.mockResolvedValueOnce(page([]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No receipts match these filters.')).toBeInTheDocument();

    mocked.fetchPartnerGroups.mockResolvedValue(page(GROUPS, { total: 23, totalPages: 3, hasNext: true }));
    await user.click(within(screen.getByRole('group', { name: 'Partner type' })).getByRole('button', { name: 'Customers' }));
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastGroupsParams()).toMatchObject({ page: 2, partnerType: 'customer' }));
  });
});
