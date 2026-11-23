import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SubscriptionApplicationsInquiryView } from './SubscriptionApplicationsInquiryView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import * as authStorage from '@/platform/auth/lib/auth-storage';
import type {
  CompanySubscriptionDetail,
  ProvisionedApplication,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    listCompanies: vi.fn(),
    listCompanySubscriptions: vi.fn(),
    getCompanySubscription: vi.fn(),
    getCompanySubscriptionApplications: vi.fn(),
  },
}));

const mockCompanies: CompanyRegistryItem[] = [
  {
    id: 10,
    name: 'Bella Vista Gourmet',
    status: 'active',
    country: 'DOM',
    merchantsCount: 3,
  },
  {
    id: 20,
    name: 'Sabor Criollo Corp',
    status: 'active',
    country: 'DOM',
    merchantsCount: 1,
  },
];

const mockSubscription: CompanySubscriptionDetail = {
  id: 101,
  company: {
    id: 10,
    name: 'Bella Vista Gourmet',
  },
  plan: {
    id: 2,
    name: 'PROFESIONAL 2',
    price: 199,
    billingCycle: 'monthly',
  },
  status: 'ACTIVE',
  startDate: '2026-01-10T00:00:00.000Z',
  endDate: null,
  renewalDate: '2026-02-10T00:00:00.000Z',
  paymentMethod: 'card',
  isExpired: false,
  billingCycle: 'Monthly',
};

const mockApplications: ProvisionedApplication[] = [
  {
    id: 1,
    name: 'Point of Sale Register',
    code: 'pos-register',
    category: 'Restaurant Operations',
    description: 'Cloud POS terminal for table orders and checkouts',
    icon: 'point_of_sale',
    isProvisioned: true,
    provisionedAt: '2026-01-10T12:00:00.000Z',
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'Kitchen Display System',
    code: 'kds-screen',
    category: 'Restaurant Operations',
    description: 'Real-time kitchen order management display',
    icon: 'kitchen',
    isProvisioned: true,
    provisionedAt: '2026-01-10T12:00:00.000Z',
    status: 'ACTIVE',
  },
  {
    id: 3,
    name: 'Enterprise Inventory Hub',
    code: 'inventory-hub',
    category: 'Supply Chain',
    description: 'Raw materials, purchase orders and food costing',
    icon: 'inventory_2',
    isProvisioned: false,
    status: 'INACTIVE',
  },
  {
    id: 4,
    name: 'Advanced Business Analytics',
    code: 'bi-analytics',
    category: 'Analytics',
    description: 'Comprehensive financial reporting and labor cost variance',
    icon: 'insights',
    isProvisioned: false,
    status: 'INACTIVE',
  },
];

describe('SubscriptionApplicationsInquiryView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('saasadmin');
    vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
      id: 1,
      email: 'saasadmin@x7pos.com',
      role: 'saasadmin',
      scope: 'global',
      merchant: { id: 10 },
      authorizedFeatureIds: [1, 2],
    });

    vi.mocked(saasService.listCompanies).mockResolvedValue(mockCompanies);
    vi.mocked(saasService.getCompanySubscription).mockResolvedValue(mockSubscription);
    vi.mocked(saasService.getCompanySubscriptionApplications).mockResolvedValue(mockApplications);
  });

  afterEach(() => {
    cleanup();
  });

  it('restricts access and shows permission boundary when user role is unauthorized', async () => {
    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('portal_user');
    vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
      id: 99,
      email: 'waiter@test.com',
      role: 'portal_user',
      scope: 'merchant',
      merchant: { id: 10 },
      authorizedFeatureIds: [],
    });

    const onNavigate = vi.fn();
    render(<SubscriptionApplicationsInquiryView onNavigate={onNavigate} />);

    expect(screen.getByTestId('permission-boundary-card')).toBeInTheDocument();
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/SAASADMIN OR COMPANY OWNER PRIVILEGE REQUIRED/i)).toBeInTheDocument();
  });

  it('allows access for saasadmin role and renders provisioned applications grid', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION APPLICATIONS INQUIRY')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Bella Vista Gourmet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROFESIONAL 2').length).toBeGreaterThan(0);

    expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    expect(screen.getByText('pos-register')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Display System')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Inventory Hub')).toBeInTheDocument();
  });

  it('allows access for company_owner role', async () => {
    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('company_owner');
    render(<SubscriptionApplicationsInquiryView companyId={10} userRole="company_owner" />);

    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION APPLICATIONS INQUIRY')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('permission-boundary-card')).not.toBeInTheDocument();
  });

  it('allows access for superadmin role', async () => {
    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('super_admin');
    render(<SubscriptionApplicationsInquiryView companyId={10} userRole="super_admin" />);

    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION APPLICATIONS INQUIRY')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('permission-boundary-card')).not.toBeInTheDocument();
  });

  it('displays accurate ACTIVE and INACTIVE entitlement status badges', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    });

    const activeBadges = screen.getAllByTestId('status-badge-active');
    expect(activeBadges.length).toBe(2);

    const inactiveBadges = screen.getAllByTestId('status-badge-inactive');
    expect(inactiveBadges.length).toBe(2);
  });

  it('filters applications by search keyword', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /Search by application name, module code, or category/i,
    );
    fireEvent.change(searchInput, { target: { value: 'kds-screen' } });

    expect(screen.getByText('Kitchen Display System')).toBeInTheDocument();
    expect(screen.queryByText('Point of Sale Register')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise Inventory Hub')).not.toBeInTheDocument();
  });

  it('filters applications by status pills (Active vs Inactive)', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    });

    const activeFilterBtn = screen.getByRole('button', { name: /^Active \(/i });
    fireEvent.click(activeFilterBtn);

    expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Display System')).toBeInTheDocument();
    expect(screen.queryByText('Enterprise Inventory Hub')).not.toBeInTheDocument();

    const inactiveFilterBtn = screen.getByRole('button', { name: /^Inactive \(/i });
    fireEvent.click(inactiveFilterBtn);

    expect(screen.queryByText('Point of Sale Register')).not.toBeInTheDocument();
    expect(screen.getByText('Enterprise Inventory Hub')).toBeInTheDocument();
  });

  it('filters applications by category dropdown', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText(/Category:/i);
    fireEvent.change(categorySelect, { target: { value: 'Supply Chain' } });

    expect(screen.getByText('Enterprise Inventory Hub')).toBeInTheDocument();
    expect(screen.queryByText('Point of Sale Register')).not.toBeInTheDocument();
  });

  it('shows empty filter state and resets filters properly', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /Search by application name, module code, or category/i,
    );
    fireEvent.change(searchInput, { target: { value: 'non-existing-module-xyz' } });

    expect(screen.getByText(/No Applications Match Your Criteria/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Point of Sale Register')).toBeInTheDocument();
  });

  it('switches target tenant company when changing select dropdown', async () => {
    render(<SubscriptionApplicationsInquiryView companyId={10} />);

    await waitFor(() => {
      expect(screen.getAllByText('Bella Vista Gourmet').length).toBeGreaterThan(0);
    });

    const tenantSelect = screen.getByLabelText(/Tenant:/i);
    fireEvent.change(tenantSelect, { target: { value: '20' } });

    await waitFor(() => {
      expect(saasService.getCompanySubscriptionApplications).toHaveBeenCalledWith(20, 2);
    });
  });

  it('renders bottom NavHubBar and navigation shortcuts', async () => {
    const onNavigate = vi.fn();
    render(<SubscriptionApplicationsInquiryView companyId={10} onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION APPLICATIONS INQUIRY')).toBeInTheDocument();
    });

    const companySubsBtn = screen.getAllByRole('button', { name: /Company Subscriptions/i })[0];
    fireEvent.click(companySubsBtn);
    expect(onNavigate).toHaveBeenCalledWith('company-subscriptions');

    const companySubsHubBtn = screen.getByRole('button', { name: /^Company Subs$/i });
    expect(companySubsHubBtn).toBeInTheDocument();
    fireEvent.click(companySubsHubBtn);
    expect(onNavigate).toHaveBeenCalledWith('company-subscriptions');
  });
});
