import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionPaymentsView } from './SubscriptionPaymentsView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type { SubscriptionPayment } from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    listSubscriptionPayments: vi.fn(),
    updateSubscriptionPaymentStatus: vi.fn(),
    listCompanies: vi.fn(),
  },
}));

const MOCK_PAYMENTS: SubscriptionPayment[] = [
  {
    id: 1,
    companyId: 101,
    companyName: 'Gourmet Burger Kitchen',
    planName: 'Enterprise SaaS Tier',
    externalTransactionId: 'TXN-GBK-111',
    invoiceNumber: 'INV-2026-001',
    amount: 899.0,
    currency: 'USD',
    status: 'paid',
    paymentDate: '2026-11-01',
    paymentMethod: 'Credit Card',
    billingPeriod: 'Nov 2026 - Dec 2026',
    notes: 'Auto settled',
  },
  {
    id: 2,
    companyId: 102,
    companyName: 'Taco Fiesta Del Sol',
    planName: 'Professional Growth Tier',
    externalTransactionId: 'TXN-TFS-222',
    invoiceNumber: 'INV-2026-002',
    amount: 499.0,
    currency: 'USD',
    status: 'pending',
    paymentDate: '2026-11-15',
    paymentMethod: 'Bank Wire Transfer',
    billingPeriod: 'Nov 2026 - Dec 2026',
    notes: 'Awaiting wire reconciliation',
  },
  {
    id: 3,
    companyId: 103,
    companyName: 'Pastas & Co',
    planName: 'Starter POS Plan',
    externalTransactionId: 'TXN-PST-333',
    invoiceNumber: 'INV-2026-003',
    amount: 199.0,
    currency: 'USD',
    status: 'failed',
    paymentDate: '2026-11-18',
    paymentMethod: 'Credit Card',
    billingPeriod: 'Nov 2026 - Dec 2026',
    notes: 'Card declined',
  },
];

const MOCK_COMPANIES: CompanyRegistryItem[] = [
  {
    id: 101,
    name: 'Gourmet Burger Kitchen',
    rut: 'US-884910',
    country: 'USA',
    status: 'active',
  },
  {
    id: 102,
    name: 'Taco Fiesta Del Sol',
    rut: 'US-772911',
    country: 'USA',
    status: 'active',
  },
];

describe('SubscriptionPaymentsView', () => {
  const onNavigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saasService.listSubscriptionPayments).mockResolvedValue(MOCK_PAYMENTS);
    vi.mocked(saasService.listCompanies).mockResolvedValue(MOCK_COMPANIES);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders header, title, and KPI metric cards properly', async () => {
    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    expect(await screen.findByText(/Subscription Payments Inquiry/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Revenue Settled/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Reconciliation/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed \/ Refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Invoices Recorded/i)).toBeInTheDocument();

    // Verify row items in table
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-003')).toBeInTheDocument();
  });

  it('filters payments table by search query', async () => {
    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    await screen.findByText('INV-2026-001');

    const searchInput = screen.getByPlaceholderText(/Search by invoice number/i);
    fireEvent.change(searchInput, { target: { value: 'Taco Fiesta' } });

    expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
    expect(screen.queryByText('INV-2026-003')).not.toBeInTheDocument();
  });

  it('filters payments by status dropdown', async () => {
    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    await screen.findByText('INV-2026-001');

    const statusDropdown = screen.getByLabelText(/Filter by payment status/i);
    fireEvent.change(statusDropdown, { target: { value: 'failed' } });

    expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
    expect(screen.queryByText('INV-2026-002')).not.toBeInTheDocument();
    expect(screen.getByText('INV-2026-003')).toBeInTheDocument();
  });

  it('opens and updates status via Status Change Modal', async () => {
    const updatedPayment: SubscriptionPayment = {
      ...MOCK_PAYMENTS[1],
      status: 'paid',
      notes: 'Wire verified by accounting',
    };
    vi.mocked(saasService.updateSubscriptionPaymentStatus).mockResolvedValue(updatedPayment);

    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    await screen.findByText('INV-2026-002');

    // Find row for INV-2026-002 and click Status button
    const row = screen.getByTestId('payment-row-2');
    const statusBtn = row.querySelector('button[title="Update payment status"]');
    expect(statusBtn).toBeInTheDocument();
    fireEvent.click(statusBtn!);

    // Modal should appear
    expect(screen.getByTestId('status-change-modal')).toBeInTheDocument();
    expect(screen.getByText(/Update Payment Status/i)).toBeInTheDocument();

    // Select status 'paid'
    const select = screen.getByTestId('status-select');
    fireEvent.change(select, { target: { value: 'paid' } });

    // Enter notes
    const notesInput = screen.getByTestId('status-notes-input');
    fireEvent.change(notesInput, { target: { value: 'Wire verified by accounting' } });

    // Confirm
    const confirmBtn = screen.getByTestId('confirm-status-button');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(saasService.updateSubscriptionPaymentStatus).toHaveBeenCalledWith(
        2,
        'paid',
        'Wire verified by accounting',
      );
    });

    // Toast notification
    expect(await screen.findByTestId('toast-notification')).toBeInTheDocument();
  });

  it('opens and displays Invoice / Receipt details modal', async () => {
    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    await screen.findByText('INV-2026-001');

    const row = screen.getByTestId('payment-row-1');
    const receiptBtn = row.querySelector('button[title="View itemized receipt"]');
    expect(receiptBtn).toBeInTheDocument();
    fireEvent.click(receiptBtn!);

    expect(screen.getByTestId('receipt-modal')).toBeInTheDocument();
    expect(screen.getByText(/OFFICIAL TAX INVOICE/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Amount Paid/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByTestId('close-receipt-modal-button');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('receipt-modal')).not.toBeInTheDocument();
  });

  it('navigates to Command Hub when clicking Command Hub button', async () => {
    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    const hubBtn = await screen.findByRole('button', { name: /Command Hub/i });
    fireEvent.click(hubBtn);

    expect(onNavigateMock).toHaveBeenCalledWith('subscription-system-hub');
  });

  it('displays empty state when no payments match', async () => {
    vi.mocked(saasService.listSubscriptionPayments).mockResolvedValue([]);

    render(<SubscriptionPaymentsView onNavigate={onNavigateMock} />);

    expect(await screen.findByText(/No payment records found/i)).toBeInTheDocument();
  });
});
