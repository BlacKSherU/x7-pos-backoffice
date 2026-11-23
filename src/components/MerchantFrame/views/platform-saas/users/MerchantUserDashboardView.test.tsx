import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantUserDashboardView } from '@/components/MerchantFrame/views/platform-saas/users/MerchantUserDashboardView';
import { getUserById, getUserHrSummary } from '@/modules/platform-saas/users/api/users';
import { getSaasMerchant } from '@/modules/platform-saas/merchants/api/saas-merchants';

vi.mock('@/modules/platform-saas/users/api/users', () => ({
  getUserById: vi.fn(),
  getUserHrSummary: vi.fn(),
}));
vi.mock('@/modules/platform-saas/merchants/api/saas-merchants', () => ({
  getSaasMerchant: vi.fn(),
}));

const USER = { id: 40, username: 'ana', email: 'ana@acme.com', role: 'merchant_admin', scope: 'merchant_web', isActive: true, merchantId: 11 };

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/merchants/11/users/40']}>
      <MerchantUserDashboardView merchantId={11} userId={40} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('MerchantUserDashboardView', () => {
  beforeEach(() => {
    vi.mocked(getUserById).mockResolvedValue(USER);
    vi.mocked(getUserHrSummary).mockResolvedValue({ user: USER, collaborators: [] });
    vi.mocked(getSaasMerchant).mockResolvedValue({
      id: 11, name: 'Airport', branchCode: 'MCH-0011', email: null, phone: null, address: null, city: null,
      state: null, country: null, timezone: null, status: 'active', companyId: 4, companyName: 'Acme',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the user profile with breadcrumbs back to the directory', async () => {
    renderDashboard();
    expect(await screen.findByText('ana@acme.com')).toBeInTheDocument();
    expect(getUserById).toHaveBeenCalledWith(40);
    expect(screen.getByTestId('stat-role')).toHaveTextContent('Merchant Admin');
    expect(screen.getByTestId('stat-status')).toHaveTextContent('Active');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(crumbs).findByText('Airport')).toBeInTheDocument();
    await userEvent.click(within(crumbs).getByText('Users'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/merchants/11/users');
  });

  it('refuses a user of another merchant', async () => {
    vi.mocked(getUserById).mockResolvedValue({ ...USER, merchantId: 99 });
    renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('does not belong to merchant #11');
  });
});
