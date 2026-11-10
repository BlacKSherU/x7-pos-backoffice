import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompaniesHubView } from '@/components/MerchantFrame/views/platform-saas/companies/CompaniesHubView';
import { getSaasCompaniesStats, listSaasCompanies } from '@/modules/platform-saas/companies/api/saas-companies';
import { getCompanyProfile } from '@/modules/platform-saas/companies/api/companies';
import { getRememberedCompanyContext, rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { ApiError } from '@/shared/lib/api-error';
import type { CompanyProfile } from '@/modules/platform-saas/companies/types/company';
import type { SaasCompanyListItem } from '@/modules/platform-saas/companies/types/saas-company';
import { getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  getSaasCompaniesStats: vi.fn(),
  listSaasCompanies: vi.fn(),
}));
vi.mock('@/modules/platform-saas/companies/api/companies', () => ({
  getCompanyProfile: vi.fn(),
}));
vi.mock('@/platform/auth/lib/auth-storage', () => ({
  getEffectiveUserRole: vi.fn(),
}));

const navBar = () => within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' }));

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/hub']}>
      <CompaniesHubView />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const company = (id: number, name: string, status = 'active'): SaasCompanyListItem => ({
  id,
  name,
  legalName: null,
  taxId: null,
  email: null,
  phone: null,
  city: null,
  country: null,
  status,
  baseCurrency: 'USD',
  subscriptionTier: null,
  merchantCount: 0,
});

// Orden del backend: por nombre
const COMPANIES = [company(9, 'Alpha Foods', 'suspended'), company(3, 'Bravo Bistro'), company(5, 'Charlie Cafe'), company(14, 'Delta Diner')];

const STATS = {
  totalCompanies: 12,
  activeCompanies: 9,
  suspendedCompanies: 2,
  tenantConfigurations: 40,
  activeConfigurations: 31,
  systemProfiles: 87,
  activeMerchants: 25,
};

describe('CompaniesHubView', () => {
  beforeEach(() => {
    vi.mocked(getSaasCompaniesStats).mockResolvedValue(STATS);
    vi.mocked(getCompanyProfile).mockRejectedValue(new ApiError('Forbidden', 403));
    vi.mocked(getEffectiveUserRole).mockReturnValue('merchant_admin');
    vi.mocked(listSaasCompanies).mockResolvedValue({
      items: COMPANIES,
      meta: { total: COMPANIES.length, page: 1, limit: 100, totalPages: 1, tiers: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders the secondary header with the exact title, subtitle and breadcrumbs', async () => {
    renderHub();
    expect(screen.getByRole('heading', { level: 1, name: 'COMPANIES COMMAND HUB' })).toBeInTheDocument();
    expect(screen.getByText(/Company profile management and tenant setup/)).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Platform SaaS')).toBeInTheDocument();
    expect(within(crumbs).getByText('Companies Hub')).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(getSaasCompaniesStats).toHaveBeenCalled());
  });

  it('shows the company profile and configuration counters from the backend', async () => {
    renderHub();
    await waitFor(() => expect(screen.getByTestId('stat-active-companies')).toHaveTextContent('9'));
    expect(screen.getByTestId('stat-active-companies')).toHaveTextContent('12 company profiles · 2 suspended');
    expect(screen.getByTestId('stat-tenant-configurations')).toHaveTextContent('40');
    expect(screen.getByTestId('stat-tenant-configurations')).toHaveTextContent('31 active configurations');
    expect(screen.getByTestId('stat-system-profiles')).toHaveTextContent('87');
    expect(screen.getByTestId('stat-active-merchants')).toHaveTextContent('25');
  });

  it('shows an error with retry when the statistics fail', async () => {
    vi.mocked(getSaasCompaniesStats).mockRejectedValueOnce(new Error('Stats unavailable'));
    renderHub();
    expect(await screen.findByRole('alert')).toHaveTextContent('Stats unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('stat-active-companies')).toHaveTextContent('9'));
  });

  it('uses Material Symbols business and settings icons on the feature cards', () => {
    renderHub();
    expect(within(screen.getByTestId('feature-card-company-profile')).getByText('business')).toHaveClass(
      'material-symbols-outlined',
    );
    expect(within(screen.getByTestId('feature-card-company-configuration')).getByText('settings')).toHaveClass(
      'material-symbols-outlined',
    );
    expect(within(screen.getByTestId('feature-card-company-profile')).getByRole('heading', { name: 'Company Profile' })).toHaveClass(
      'hover:text-primary',
      'transition-colors',
      'duration-200',
    );
  });

  it('shows an accessible Company context selector fed by GET /saas/companies', async () => {
    renderHub();
    const select = screen.getByLabelText('Company context');
    await waitFor(() => expect(select).toBeEnabled());
    expect(listSaasCompanies).toHaveBeenCalledWith({ limit: 100 });
    expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      'Alpha Foods (Suspended)',
      'Bravo Bistro',
      'Charlie Cafe',
      'Delta Diner',
    ]);
    expect(select).toHaveClass('hover:text-primary', 'transition-colors', 'duration-200');
  });

  it('defaults to the remembered company and opens its profile', async () => {
    rememberCompanyContext(14);
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('14'));
    expect(screen.getByTestId('feature-card-company-profile')).toHaveTextContent('Opens Delta Diner.');
    await userEvent.click(screen.getByTestId('feature-card-company-profile'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/14/profile');
  });

  it('defaults to the user own company (Company Administrator) for the configuration card', async () => {
    vi.mocked(getCompanyProfile).mockResolvedValue({ id: 5 } as CompanyProfile);
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('5'));
    await userEvent.click(screen.getByTestId('feature-card-company-configuration'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/5/configuration');
  });

  it('defaults platform staff to the first active company, without asking for an own company', async () => {
    vi.mocked(getEffectiveUserRole).mockReturnValue('portal_admin');
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('3'));
    await userEvent.click(screen.getByTestId('feature-card-company-configuration'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/3/configuration');
    expect(getCompanyProfile).not.toHaveBeenCalled();
  });

  it('ignores a remembered company that is not among the options', async () => {
    rememberCompanyContext(77);
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('3'));
  });

  it('a card clicked before the context is resolved still lands on the default company', async () => {
    let release: (value: Awaited<ReturnType<typeof listSaasCompanies>>) => void = () => undefined;
    vi.mocked(listSaasCompanies).mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderHub();
    await userEvent.click(screen.getByTestId('feature-card-company-profile'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/hub');
    release({ items: COMPANIES, meta: { total: 4, page: 1, limit: 100, totalPages: 1, tiers: [] } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/3/profile'));
  });

  it('changing the selector updates the remembered context, every card and the bottom bar', async () => {
    renderHub();
    const select = screen.getByLabelText('Company context');
    await waitFor(() => expect(select).toHaveValue('3'));
    await userEvent.selectOptions(select, '5');
    expect(getRememberedCompanyContext()).toBe(5);
    expect(screen.getByTestId('feature-card-company-configuration')).toHaveTextContent('Opens Charlie Cafe.');
    await userEvent.click(navBar().getByRole('button', { name: 'Company Profile' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/5/profile');
  });

  it('keeps working with the remembered company when the company list fails', async () => {
    vi.mocked(listSaasCompanies).mockRejectedValue(new Error('Companies unavailable'));
    rememberCompanyContext(14);
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('14'));
    expect(screen.getByText(/Could not load the company list \(Companies unavailable\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('feature-card-company-profile'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/14/profile');
  });

  it('sends the user to the directory only when no company exists at all', async () => {
    vi.mocked(listSaasCompanies).mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0, tiers: [] },
    });
    renderHub();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveTextContent('No companies available'));
    await userEvent.click(screen.getByTestId('feature-card-company-profile'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/directory'));
  });

  it('links the Companies Directory card to the directory', async () => {
    renderHub();
    await userEvent.click(screen.getByTestId('feature-card-companies-directory'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/directory');
  });

  it('has no Quick Launch panel: the bottom NavHubBar links every company feature', async () => {
    rememberCompanyContext(3);
    renderHub();
    expect(screen.queryByRole('heading', { name: 'Quick Launch' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Company context')).toHaveValue('3'));
    const bar = navBar();
    expect(bar.getAllByRole('button')).toHaveLength(6);
    for (const name of ['Back to Platform SaaS Dashboard', 'Companies Hub', 'Companies Directory', 'Company Profile', 'Company Configuration', 'Company Merchants']) {
      expect(bar.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(bar.getByRole('button', { name: 'Companies Hub' })).toHaveAttribute('aria-current', 'page');
    for (const [label, path] of [
      ['Companies Directory', '/platform-saas/companies/directory'],
      ['Company Configuration', '/platform-saas/companies/3/configuration'],
      ['Company Merchants', '/platform-saas/companies/3/merchants'],
    ] as const) {
      await userEvent.click(navBar().getByRole('button', { name: label }));
      expect(screen.getByTestId('location')).toHaveTextContent(path);
    }
    await userEvent.click(navBar().getByRole('button', { name: 'Back to Platform SaaS Dashboard' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});
