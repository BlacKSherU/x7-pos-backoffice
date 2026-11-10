import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompaniesDirectoryView } from '@/components/MerchantFrame/views/platform-saas/companies/CompaniesDirectoryView';
import { listSaasCompanies } from '@/modules/platform-saas/companies/api/saas-companies';
import { getRememberedCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import type { SaasCompanyListItem } from '@/modules/platform-saas/companies/types/saas-company';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  listSaasCompanies: vi.fn(),
}));

const TIERS = [
  { planId: 1, planName: 'Basic' },
  { planId: 2, planName: 'Pro' },
];

const ROWS: SaasCompanyListItem[] = [
  {
    id: 1,
    name: 'Acme',
    legalName: 'Acme Holdings LLC',
    taxId: '12-3456789',
    email: 'hq@acme.com',
    phone: null,
    city: 'Miami',
    country: 'US',
    status: 'active',
    baseCurrency: 'USD',
    subscriptionTier: TIERS[1],
    merchantCount: 3,
  },
  {
    id: 2,
    name: 'Beta Foods',
    legalName: null,
    taxId: '98-7654321',
    email: 'info@beta.com',
    phone: null,
    city: 'Austin',
    country: 'US',
    status: 'active',
    baseCurrency: 'USD',
    subscriptionTier: TIERS[0],
    merchantCount: 1,
  },
];

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderDirectory() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/directory']}>
      <CompaniesDirectoryView />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CompaniesDirectoryView', () => {
  beforeEach(() => {
    vi.mocked(listSaasCompanies).mockImplementation(async (query = {}) => {
      const items = ROWS.filter(
        (row) =>
          (!query.status || row.status === query.status) &&
          (!query.tier || String(row.subscriptionTier?.planId) === String(query.tier)) &&
          (!query.search || row.name.toLowerCase().includes(String(query.search).toLowerCase())),
      );
      return { items, meta: { total: items.length, page: 1, limit: 50, totalPages: 1, tiers: TIERS } };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('loads the active companies into the data grid', async () => {
    renderDirectory();
    expect(await screen.findByTestId('company-row-1')).toHaveTextContent('Acme');
    expect(screen.getByTestId('company-row-2')).toHaveTextContent('Beta Foods');
    expect(screen.getByTestId('company-row-1')).toHaveTextContent('Acme Holdings LLC');
    expect(screen.getByTestId('company-row-1')).toHaveTextContent('Pro');
    expect(listSaasCompanies).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', page: 1, limit: 50 }));
    expect(screen.getByRole('heading', { level: 1, name: 'COMPANIES DIRECTORY' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Companies Hub')).toBeInTheDocument();
    expect(within(crumbs).getByText('Companies Directory')).toHaveAttribute('aria-current', 'page');
  });

  it('filters in real time by search text, status and subscription tier', async () => {
    renderDirectory();
    await screen.findByTestId('company-row-1');

    await userEvent.type(screen.getByLabelText('Search companies'), 'beta');
    expect(screen.queryByTestId('company-row-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('company-row-2')).toBeInTheDocument();
    await waitFor(() => expect(listSaasCompanies).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'beta' })));

    await userEvent.clear(screen.getByLabelText('Search companies'));
    await userEvent.selectOptions(await screen.findByLabelText('Subscription tier'), '2');
    await waitFor(() =>
      expect(listSaasCompanies).toHaveBeenLastCalledWith(expect.objectContaining({ tier: '2', search: undefined })),
    );
    expect(await screen.findByTestId('company-row-1')).toBeInTheDocument();
    expect(screen.queryByTestId('company-row-2')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'suspended');
    await waitFor(() =>
      expect(listSaasCompanies).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'suspended' })),
    );
    expect(await screen.findByText('No companies match your filters')).toBeInTheDocument();
  });

  it('opens the company hub when a row is clicked and remembers the company', async () => {
    renderDirectory();
    await userEvent.click(await screen.findByTestId('company-row-2'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/2/hub');
    expect(getRememberedCompanyContext()).toBe(2);
  });

  it('shows an error with retry', async () => {
    vi.mocked(listSaasCompanies).mockRejectedValueOnce(new Error('Directory down'));
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Directory down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('company-row-1')).toBeInTheDocument();
  });

  it('shows an empty state when there are no companies', async () => {
    vi.mocked(listSaasCompanies).mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 1, tiers: [] },
    });
    renderDirectory();
    expect(await screen.findByText('No companies match your filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No companies registered yet')).toBeInTheDocument();
  });

  it('goes back to the Companies Hub', async () => {
    renderDirectory();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' })).getByRole('button', { name: 'Back to Companies Hub' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/hub');
  });
});
