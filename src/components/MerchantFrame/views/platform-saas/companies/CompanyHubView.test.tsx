import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyHubView } from '@/components/MerchantFrame/views/platform-saas/companies/CompanyHubView';
import { getSaasCompanyHub } from '@/modules/platform-saas/companies/api/saas-companies';
import { getRememberedCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  getSaasCompanyHub: vi.fn(),
}));

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/4/hub']}>
      <CompanyHubView companyId={4} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CompanyHubView', () => {
  beforeEach(() => {
    vi.mocked(getSaasCompanyHub).mockResolvedValue({
      company: {
        id: 4,
        name: 'Acme',
        legalName: 'Acme Holdings LLC',
        taxId: '12-3456789',
        status: 'active',
        baseCurrency: 'USD',
        city: 'Miami',
        country: 'US',
      },
      stats: { totalMerchants: 6, activeMerchants: 5, activeUsers: 20, configurations: 8 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders the company context, breadcrumbs and statistics', async () => {
    renderHub();
    expect(await screen.findByRole('heading', { level: 1, name: 'ACME · COMPANY HUB' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Companies Directory')).toBeInTheDocument();
    expect(within(crumbs).getByText('Acme')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-merchants')).toHaveTextContent('6');
    expect(screen.getByTestId('stat-active-users')).toHaveTextContent('20');
    expect(getRememberedCompanyContext()).toBe(4);
  });

  it.each([
    ['feature-card-company-profile', '/platform-saas/companies/4/profile'],
    ['feature-card-company-configuration', '/platform-saas/companies/4/configuration'],
    ['feature-card-company-merchants', '/platform-saas/companies/4/merchants'],
  ])('%s navigates to %s', async (testId, path) => {
    renderHub();
    await userEvent.click(await screen.findByTestId(testId));
    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it('shows an error when the company cannot be loaded', async () => {
    vi.mocked(getSaasCompanyHub).mockRejectedValueOnce(new Error('Company not found'));
    renderHub();
    expect(await screen.findByRole('alert')).toHaveTextContent('Company not found');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('stat-total-merchants')).toHaveTextContent('6'));
  });
});
