import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantHubView } from '@/components/MerchantFrame/views/platform-saas/merchants/MerchantHubView';
import { getSaasMerchantHub } from '@/modules/platform-saas/merchants/api/saas-merchants';
import type { SaasMerchantHub } from '@/modules/platform-saas/merchants/types/saas-merchant';

vi.mock('@/modules/platform-saas/merchants/api/saas-merchants', () => ({
  getSaasMerchantHub: vi.fn(),
}));

const HUB: SaasMerchantHub = {
  merchant: { id: 11, name: 'Airport', branchCode: 'MCH-0011', status: 'active', city: 'Orlando', companyId: 4, companyName: 'Acme' },
  stats: { activePosTerminals: 3, totalPosTerminals: 4, transactionsToday: 17, transactionsTotal: 950, activeUsers: 6, totalUsers: 8 },
};

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/4/merchants/11/hub']}>
      <MerchantHubView companyId={4} merchantId={11} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('MerchantHubView', () => {
  beforeEach(() => {
    vi.mocked(getSaasMerchantHub).mockResolvedValue(HUB);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders the merchant-specific title and context breadcrumbs', async () => {
    renderHub();
    expect(await screen.findByRole('heading', { level: 1, name: 'AIRPORT · MERCHANT HUB' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Acme')).toBeInTheDocument();
    expect(within(crumbs).getByText('Airport')).toBeInTheDocument();
    expect(within(crumbs).getByText('Merchant Hub')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the operational KPIs', async () => {
    renderHub();
    await screen.findByRole('heading', { level: 1, name: 'AIRPORT · MERCHANT HUB' });
    expect(screen.getByTestId('stat-active-pos-terminals')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-active-pos-terminals')).toHaveTextContent('4 terminals registered');
    expect(screen.getByTestId('stat-local-transactions')).toHaveTextContent('17');
    expect(screen.getByTestId('stat-local-transactions')).toHaveTextContent('950 in total');
    expect(screen.getByTestId('stat-active-users')).toHaveTextContent('6');
  });

  it('links the cards to the merchant profile and user directory with storefront and group icons', async () => {
    renderHub();
    const profileCard = await screen.findByTestId('feature-card-merchant-profile');
    expect(within(profileCard).getByText('storefront')).toHaveClass('material-symbols-outlined');
    expect(within(screen.getByTestId('feature-card-merchant-users')).getByText('group')).toHaveClass('material-symbols-outlined');
    await userEvent.click(profileCard);
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/profile');
    await userEvent.click(screen.getByTestId('feature-card-merchant-users'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/merchants/11/users');
  });

  it('opens the POS terminals directory from its card and from the bottom bar', async () => {
    renderHub();
    const terminalsCard = await screen.findByTestId('feature-card-merchant-terminals');
    expect(within(terminalsCard).getByRole('heading', { name: 'POS Terminals' })).toBeInTheDocument();
    expect(within(terminalsCard).getByText('point_of_sale')).toHaveClass('material-symbols-outlined');
    await userEvent.click(terminalsCard);
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/terminals');
    cleanup();
    renderHub();
    await screen.findByTestId('feature-card-merchant-terminals');
    const bar = within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' }));
    expect(bar.getByRole('button', { name: 'Merchant Hub' })).toHaveAttribute('aria-current', 'page');
    expect(bar.getByRole('button', { name: 'Merchant Profile' })).toBeInTheDocument();
    expect(bar.getByRole('button', { name: 'Users' })).toBeInTheDocument();
    await userEvent.click(bar.getByRole('button', { name: 'POS Terminals' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/terminals');
  });

  it('has no Quick Launch panel and its back arrow goes to the company merchants', async () => {
    renderHub();
    await screen.findByTestId('feature-card-merchant-terminals');
    expect(screen.queryByRole('heading', { name: 'Quick Launch' })).not.toBeInTheDocument();
    const bar = within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' }));
    await userEvent.click(bar.getByRole('button', { name: 'Back to Company Merchants' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants');
  });

  it('refuses a merchant of another company', async () => {
    vi.mocked(getSaasMerchantHub).mockResolvedValue({ ...HUB, merchant: { ...HUB.merchant, companyId: 5 } });
    renderHub();
    expect(await screen.findByRole('alert')).toHaveTextContent('Merchant #11 does not belong to company #4.');
  });
});
