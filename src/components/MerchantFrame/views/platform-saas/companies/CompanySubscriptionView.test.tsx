import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanySubscriptionView } from './CompanySubscriptionView';
import {
  normalizeLifecycleStatus,
  statusBadge,
  paymentStatusBadge,
} from './company-subscription-helpers';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  CompanySubscriptionDetail,
  SubscriptionPayment,
  ProvisionedApplication,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    listCompanies: vi.fn(),
    listCompanySubscriptions: vi.fn(),
    getCompanySubscription: vi.fn(),
    updateCompanySubscriptionStatus: vi.fn(),
    getCompanyPayments: vi.fn(),
    getCompanySubscriptionApplications: vi.fn(),
  },
}));

const MOCK_COMPANIES: CompanyRegistryItem[] = [
  {
    id: 101,
    name: 'Acme Dining Group',
    status: 'active',
    country: 'DOM',
    merchantsCount: 5,
  },
  {
    id: 102,
    name: 'Bistro Capital Inc',
    status: 'active',
    country: 'DOM',
    merchantsCount: 2,
  },
];

const MOCK_ACTIVE_SUBSCRIPTION: CompanySubscriptionDetail = {
  id: 1,
  company: { id: 101, name: 'Acme Dining Group' },
  plan: {
    id: 3,
    name: 'Enterprise Tier',
    description: 'Full multi-unit enterprise suite',
    price: 499.0,
    billingCycle: 'MONTHLY',
  },
  price: 499.0,
  billingCycle: 'MONTHLY',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  renewalDate: '2026-12-31',
  status: 'ACTIVE',
  paymentMethod: 'Credit Card (Visa ending in 4242)',
  isExpired: false,
};

const MOCK_PAYMENTS: SubscriptionPayment[] = [
  {
    id: 1001,
    companyId: 101,
    externalTransactionId: 'TXN-994812',
    invoiceNumber: 'INV-2026-001',
    amount: 499.0,
    currency: 'USD',
    status: 'paid',
    paymentDate: '2026-01-01',
    paymentMethod: 'Credit Card',
  },
  {
    id: 1002,
    companyId: 101,
    externalTransactionId: 'TXN-998822',
    invoiceNumber: 'INV-2026-002',
    amount: 499.0,
    currency: 'USD',
    status: 'pending',
    paymentDate: '2026-02-01',
    paymentMethod: 'Credit Card',
  },
  {
    id: 1003,
    companyId: 101,
    externalTransactionId: 'TXN-999333',
    invoiceNumber: 'INV-2026-003',
    amount: 499.0,
    currency: 'USD',
    status: 'failed',
    paymentDate: '2026-03-01',
    paymentMethod: 'Credit Card',
  },
];

const MOCK_APPLICATIONS: ProvisionedApplication[] = [
  {
    id: 1,
    name: 'Point of Sale (POS)',
    code: 'POS',
    description: 'Cloud cash registers and order processing terminal',
    category: 'Store Operations',
    isProvisioned: true,
  },
  {
    id: 2,
    name: 'Kitchen Display System (KDS)',
    code: 'KDS',
    description: 'Real-time kitchen order preparation stations',
    category: 'Kitchen Production',
    isProvisioned: true,
  },
  {
    id: 3,
    name: 'Enterprise Analytics',
    code: 'ANALYTICS',
    description: 'Cross-brand aggregate reporting and predictive sales',
    category: 'Reporting & BI',
    isProvisioned: true,
  },
];

describe('CompanySubscriptionView', () => {
  beforeEach(() => {
    vi.mocked(saasService.listCompanies).mockResolvedValue(MOCK_COMPANIES);
    vi.mocked(saasService.getCompanySubscription).mockResolvedValue(MOCK_ACTIVE_SUBSCRIPTION);
    vi.mocked(saasService.getCompanyPayments).mockResolvedValue(MOCK_PAYMENTS);
    vi.mocked(saasService.getCompanySubscriptionApplications).mockResolvedValue(MOCK_APPLICATIONS);
    vi.mocked(saasService.updateCompanySubscriptionStatus).mockResolvedValue({
      ...MOCK_ACTIVE_SUBSCRIPTION,
      status: 'SUSPENDED',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Utility functions', () => {
    it('normalizes lifecycle status correctly', () => {
      expect(normalizeLifecycleStatus('active')).toBe('ACTIVE');
      expect(normalizeLifecycleStatus('ACTIVE')).toBe('ACTIVE');
      expect(normalizeLifecycleStatus('suspended')).toBe('SUSPENDED');
      expect(normalizeLifecycleStatus('cancelled')).toBe('CANCELLED');
      expect(normalizeLifecycleStatus('canceled')).toBe('CANCELLED');
      expect(normalizeLifecycleStatus('inactive')).toBe('INACTIVE');
      expect(normalizeLifecycleStatus(undefined)).toBe('INACTIVE');
    });

    it('returns appropriate badge metadata for lifecycle statuses', () => {
      expect(statusBadge('ACTIVE').label).toBe('Active');
      expect(statusBadge('SUSPENDED').label).toBe('Suspended');
      expect(statusBadge('CANCELLED').label).toBe('Cancelled');
      expect(statusBadge('INACTIVE').label).toBe('Inactive');
    });

    it('returns payment badge metadata for payment statuses', () => {
      expect(paymentStatusBadge('paid').label).toBe('Paid');
      expect(paymentStatusBadge('completed').label).toBe('Paid');
      expect(paymentStatusBadge('pending').label).toBe('Pending');
      expect(paymentStatusBadge('failed').label).toBe('Failed');
      expect(paymentStatusBadge('refunded').label).toBe('Refunded');
    });
  });

  describe('Acceptance Criteria 1: Subscription Details & Status Control', () => {
    it('renders active subscription parameters and badge', async () => {
      render(<CompanySubscriptionView companyId={101} />);

      await screen.findByRole('heading', { name: /company subscription management/i });

      const matchingCompanyNames = await screen.findAllByText('Acme Dining Group');
      expect(matchingCompanyNames.length).toBeGreaterThanOrEqual(1);

      expect(screen.getAllByText('Enterprise Tier').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('/ MONTHLY')).toBeInTheDocument();
      expect(screen.getAllByText('2026-01-01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2026-12-31').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Credit Card (Visa ending in 4242)')).toBeInTheDocument();

      const statusBadge = screen.getByTestId('subscription-status-badge');
      expect(statusBadge).toHaveTextContent('Active');
    });

    it('allows suspending subscription with warning confirmation modal', async () => {
      const user = userEvent.setup();
      render(<CompanySubscriptionView companyId={101} />);

      await screen.findByRole('heading', { name: /company subscription management/i });

      // Click "Suspend Access"
      const suspendBtn = screen.getByRole('button', { name: /suspend access/i });
      await user.click(suspendBtn);

      // Verify confirmation modal with warning text
      expect(screen.getByText(/Tenant Access Will Be Immediately Terminated/i)).toBeInTheDocument();
      expect(screen.getByText(/Tenant users belonging to/i)).toBeInTheDocument();

      // Enter optional reason
      const reasonInput = screen.getByPlaceholderText(/delinquent account/i);
      await user.type(reasonInput, 'Delinquent billing cycle');

      // Confirm suspension
      const confirmBtn = screen.getByRole('button', { name: /confirm suspended/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(saasService.updateCompanySubscriptionStatus).toHaveBeenCalledWith(101, 'SUSPENDED', {
          immediate: false,
          reason: 'Delinquent billing cycle',
        });
      });
    });

    it('allows cancelling subscription with termination scope options', async () => {
      const user = userEvent.setup();
      vi.mocked(saasService.updateCompanySubscriptionStatus).mockResolvedValue({
        ...MOCK_ACTIVE_SUBSCRIPTION,
        status: 'CANCELLED',
      });

      render(<CompanySubscriptionView companyId={101} />);
      await screen.findByRole('heading', { name: /company subscription management/i });

      // Click "Cancel Subscription"
      const cancelBtn = screen.getByRole('button', { name: /cancel subscription/i });
      await user.click(cancelBtn);

      // Verify cancellation modal options
      expect(screen.getByText(/Subscription Cancellation & Access Termination/i)).toBeInTheDocument();
      expect(screen.getByText(/Terminate at end of billing cycle/i)).toBeInTheDocument();
      expect(screen.getByText(/Immediate Termination/i)).toBeInTheDocument();

      // Select Immediate Termination
      const immediateRadio = screen.getByLabelText(/Immediate Termination/i);
      await user.click(immediateRadio);

      // Confirm
      const confirmBtn = screen.getByRole('button', { name: /confirm cancelled/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(saasService.updateCompanySubscriptionStatus).toHaveBeenCalledWith(101, 'CANCELLED', {
          immediate: true,
          reason: undefined,
        });
      });
    });

    it('displays warning alert banner when subscription is suspended', async () => {
      vi.mocked(saasService.getCompanySubscription).mockResolvedValue({
        ...MOCK_ACTIVE_SUBSCRIPTION,
        status: 'SUSPENDED',
      });

      render(<CompanySubscriptionView companyId={101} />);
      expect(await screen.findByText('Tenant Access Blocked')).toBeInTheDocument();
      expect(
        screen.getByText(/Tenant users belonging to.*are immediately denied access/i),
      ).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 2: Payment History Ledger', () => {
    it('renders historical payment records with invoice numbers, amounts, and statuses', async () => {
      render(<CompanySubscriptionView companyId={101} />);

      const table = await screen.findByTestId('payment-ledger-table');

      expect(within(table).getByText('INV-2026-001')).toBeInTheDocument();
      expect(within(table).getByText('INV-2026-002')).toBeInTheDocument();
      expect(within(table).getByText('INV-2026-003')).toBeInTheDocument();

      expect(within(table).getByText('Paid')).toBeInTheDocument();
      expect(within(table).getByText('Pending')).toBeInTheDocument();
      expect(within(table).getByText('Failed')).toBeInTheDocument();
    });

    it('filters payments by search query', async () => {
      const user = userEvent.setup();
      render(<CompanySubscriptionView companyId={101} />);

      await screen.findByTestId('payment-ledger-table');

      const searchInput = screen.getByPlaceholderText(/search invoice or transaction id/i);
      await user.type(searchInput, 'INV-2026-003');

      expect(screen.getByText('INV-2026-003')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
      expect(screen.queryByText('INV-2026-002')).not.toBeInTheDocument();
    });

    it('filters payments by status dropdown', async () => {
      const user = userEvent.setup();
      render(<CompanySubscriptionView companyId={101} />);

      await screen.findByTestId('payment-ledger-table');

      const filterSelect = screen.getByLabelText(/payment status filter/i);
      await user.selectOptions(filterSelect, 'failed');

      expect(screen.getByText('INV-2026-003')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
      expect(screen.queryByText('INV-2026-002')).not.toBeInTheDocument();
    });

    it('displays empty state when no payments are found', async () => {
      vi.mocked(saasService.getCompanyPayments).mockResolvedValue([]);
      render(<CompanySubscriptionView companyId={101} />);

      expect(
        await screen.findByText(/No payment transactions recorded for this company subscription/i),
      ).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 3: Subscription Applications View (Inspector)', () => {
    it('displays modular applications provisioned under the subscription plan tier', async () => {
      render(<CompanySubscriptionView companyId={101} />);

      const appsGrid = await screen.findByTestId('applications-grid');
      expect(appsGrid).toBeInTheDocument();

      expect(within(appsGrid).getByText('Point of Sale (POS)')).toBeInTheDocument();
      expect(within(appsGrid).getByText('POS')).toBeInTheDocument();
      expect(within(appsGrid).getByText('Kitchen Display System (KDS)')).toBeInTheDocument();
      expect(within(appsGrid).getByText('KDS')).toBeInTheDocument();
      expect(within(appsGrid).getByText('Enterprise Analytics')).toBeInTheDocument();

      const provisionedBadges = within(appsGrid).getAllByText('Provisioned');
      expect(provisionedBadges).toHaveLength(3);
    });
  });

  describe('Acceptance Criteria 4: Restricted Entry & Navigation Enforcement', () => {
    it('renders secondary header with breadcrumbs and back buttons', async () => {
      const onNavigate = vi.fn();
      const user = userEvent.setup();

      render(<CompanySubscriptionView companyId={101} onNavigate={onNavigate} />);

      await screen.findByRole('heading', { name: /company subscription management/i });

      // Click "Back to List"
      const backToListBtn = screen.getByRole('button', { name: /back to list/i });
      await user.click(backToListBtn);
      expect(onNavigate).toHaveBeenCalledWith('company-subscriptions');

      // Click "Hub"
      const hubBtn = screen.getByTitle('Return to Subscription Hub');
      await user.click(hubBtn);
      expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');
    });

    it('allows switching companies using the company selector dropdown', async () => {
      const user = userEvent.setup();
      render(<CompanySubscriptionView companyId={101} />);

      await screen.findByRole('heading', { name: /company subscription management/i });

      const companySelect = screen.getByLabelText(/select company/i);
      await user.selectOptions(companySelect, '102');

      await waitFor(() => {
        expect(saasService.getCompanySubscription).toHaveBeenCalledWith(102);
        expect(saasService.getCompanyPayments).toHaveBeenCalledWith(102);
      });
    });

    it('renders bottom NavHubBar with immediate return to Subscription Hub', async () => {
      const onNavigate = vi.fn();
      const user = userEvent.setup();

      render(<CompanySubscriptionView companyId={101} onNavigate={onNavigate} />);

      await screen.findByRole('heading', { name: /company subscription management/i });

      // Bottom back button
      const navHubBackBtn = screen.getByRole('button', { name: /back to subscription hub/i });
      await user.click(navHubBackBtn);
      expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');
    });
  });
});
