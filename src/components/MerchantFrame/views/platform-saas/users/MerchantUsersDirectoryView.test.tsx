import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantUsersDirectoryView } from '@/components/MerchantFrame/views/platform-saas/users/MerchantUsersDirectoryView';
import { getSaasMerchant, listSaasMerchantUsers } from '@/modules/platform-saas/merchants/api/saas-merchants';
import type { SaasMerchantUser } from '@/modules/platform-saas/merchants/types/saas-merchant';

vi.mock('@/modules/platform-saas/merchants/api/saas-merchants', () => ({
  getSaasMerchant: vi.fn(),
  listSaasMerchantUsers: vi.fn(),
}));

const USERS: SaasMerchantUser[] = [
  { id: 40, username: 'ana', email: 'ana@acme.com', role: 'merchant_admin', status: 'active', merchantId: 11, createdAt: '2026-01-05T10:00:00Z' },
  { id: 41, username: 'bob', email: 'bob@acme.com', role: 'merchant_user', status: 'inactive', merchantId: 11, createdAt: null },
  { id: 90, username: 'other', email: 'other@x.com', role: 'merchant_user', status: 'active', merchantId: 12, createdAt: null },
];

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderDirectory() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/merchants/11/users']}>
      <MerchantUsersDirectoryView merchantId={11} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('MerchantUsersDirectoryView', () => {
  beforeEach(() => {
    vi.mocked(listSaasMerchantUsers).mockImplementation(async (_merchantId, query = {}) => {
      const items = USERS.filter(
        (u) =>
          (!query.status || u.status === query.status) &&
          (!query.search || `${u.username} ${u.email}`.includes(query.search)),
      );
      return { items, meta: { total: 2, active: 1 } };
    });
    vi.mocked(getSaasMerchant).mockResolvedValue({
      id: 11, name: 'Airport', branchCode: 'MCH-0011', email: null, phone: null, address: null, city: 'Orlando',
      state: null, country: null, timezone: 'America/New_York', status: 'active', companyId: 4, companyName: 'Acme',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists the active users of the merchant branch with role, email and status', async () => {
    renderDirectory();
    const row = await screen.findByTestId('user-row-40');
    expect(row).toHaveTextContent('ana');
    expect(row).toHaveTextContent('ana@acme.com');
    expect(row).toHaveTextContent('Merchant Admin');
    expect(row).toHaveTextContent('Active');
    expect(screen.queryByTestId('user-row-41')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-row-90')).not.toBeInTheDocument();
    expect(listSaasMerchantUsers).toHaveBeenCalledWith(11, expect.objectContaining({ status: 'active' }));
    expect(screen.getByTestId('users-count')).toHaveTextContent('1 active · 2 total');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(crumbs).findByText('Airport')).toBeInTheDocument();
    expect(within(crumbs).getByText('Users')).toHaveAttribute('aria-current', 'page');
  });

  it('shows every user when the status filter is cleared', async () => {
    renderDirectory();
    await screen.findByTestId('user-row-40');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    expect(await screen.findByTestId('user-row-41')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search users'), 'bob');
    await waitFor(() => expect(screen.queryByTestId('user-row-40')).not.toBeInTheDocument());
  });

  it('opens the user dashboard when a record is clicked', async () => {
    renderDirectory();
    await userEvent.click(await screen.findByTestId('user-row-40'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/merchants/11/users/40');
  });

  it('goes back to the merchant hub', async () => {
    renderDirectory();
    await userEvent.click(await screen.findByRole('button', { name: /Back to Merchant Hub/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/hub');
  });

  it('shows empty and error states', async () => {
    vi.mocked(listSaasMerchantUsers).mockResolvedValueOnce({ items: [], meta: { total: 0, active: 0 } });
    renderDirectory();
    expect(await screen.findByText('No users match your filters')).toBeInTheDocument();
    cleanup();
    vi.mocked(listSaasMerchantUsers).mockRejectedValueOnce(new Error('Forbidden merchant'));
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden merchant');
  });
});
