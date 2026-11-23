import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyMerchantsDirectoryView } from '@/components/MerchantFrame/views/platform-saas/merchants/CompanyMerchantsDirectoryView';
import {
  getSaasCompanyHub,
  listSaasCompanyMerchants,
} from '@/modules/platform-saas/companies/api/saas-companies';
import type { SaasCompanyMerchant } from '@/modules/platform-saas/companies/types/saas-company';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  getSaasCompanyHub: vi.fn(),
  listSaasCompanyMerchants: vi.fn(),
}));

const base = {
  phone: null,
  address: '1 Main St',
  state: 'FL',
  country: 'US',
  timezone: 'America/New_York',
  companyId: 4,
};

const MERCHANTS: SaasCompanyMerchant[] = [
  { ...base, id: 10, name: 'Downtown', branchCode: 'MCH-0010', email: 'downtown@acme.com', city: 'Miami', status: 'active' },
  { ...base, id: 11, name: 'Airport', branchCode: 'MCH-0011', email: 'airport@acme.com', city: 'Orlando', status: 'inactive' },
  // Otra company: no debe aparecer aunque el backend la devolviera.
  { ...base, id: 99, name: 'Foreign', branchCode: 'MCH-0099', email: null, city: 'Miami', status: 'active', companyId: 5 },
];

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderDirectory() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/4/merchants']}>
      <CompanyMerchantsDirectoryView companyId={4} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CompanyMerchantsDirectoryView', () => {
  beforeEach(() => {
    vi.mocked(listSaasCompanyMerchants).mockImplementation(async (_companyId, query = {}) => {
      const items = MERCHANTS.filter(
        (m) =>
          (!query.city || m.city?.toLowerCase() === query.city.toLowerCase()) &&
          (!query.status || m.status === query.status) &&
          (!query.search || m.name.toLowerCase().includes(query.search.toLowerCase())),
      );
      return { items, meta: { total: items.length, cities: ['Miami', 'Orlando'] } };
    });
    vi.mocked(getSaasCompanyHub).mockResolvedValue({
      company: { id: 4, name: 'Acme', legalName: null, taxId: null, status: 'active', baseCurrency: 'USD', city: null, country: null },
      stats: { totalMerchants: 2, activeMerchants: 1, activeUsers: 3, configurations: 0 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders only the merchant branches of the parent company', async () => {
    renderDirectory();
    expect(await screen.findByTestId('merchant-row-10')).toHaveTextContent('Downtown');
    expect(screen.getByTestId('merchant-row-10')).toHaveTextContent('MCH-0010');
    expect(screen.getByTestId('merchant-row-10')).toHaveTextContent('Miami, FL, US');
    expect(screen.getByTestId('merchant-row-11')).toHaveTextContent('Inactive');
    expect(screen.queryByTestId('merchant-row-99')).not.toBeInTheDocument();
    expect(listSaasCompanyMerchants).toHaveBeenCalledWith(4, expect.any(Object));
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(crumbs).findByText('Acme')).toBeInTheDocument();
    expect(within(crumbs).getByText('Merchants')).toHaveAttribute('aria-current', 'page');
  });

  it('filters by city, status and branch name', async () => {
    renderDirectory();
    await screen.findByTestId('merchant-row-10');

    await userEvent.selectOptions(screen.getByLabelText('City'), 'Orlando');
    expect(screen.queryByTestId('merchant-row-10')).not.toBeInTheDocument();
    await waitFor(() => expect(listSaasCompanyMerchants).toHaveBeenLastCalledWith(4, expect.objectContaining({ city: 'Orlando' })));
    expect(await screen.findByTestId('merchant-row-11')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('City'), 'all');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'active');
    await waitFor(() =>
      expect(listSaasCompanyMerchants).toHaveBeenLastCalledWith(4, expect.objectContaining({ status: 'active', city: undefined })),
    );
    expect(await screen.findByTestId('merchant-row-10')).toBeInTheDocument();
    expect(screen.queryByTestId('merchant-row-11')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    await userEvent.type(screen.getByLabelText('Search merchants'), 'airport');
    expect(screen.queryByTestId('merchant-row-10')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listSaasCompanyMerchants).toHaveBeenLastCalledWith(4, expect.objectContaining({ search: 'airport' })),
    );
    expect(await screen.findByTestId('merchant-row-11')).toBeInTheDocument();
  });

  it('redirects to the merchant hub when a branch is clicked', async () => {
    renderDirectory();
    await userEvent.click(await screen.findByTestId('merchant-row-11'));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/hub');
  });

  it('shows an empty state and an error state', async () => {
    vi.mocked(listSaasCompanyMerchants).mockResolvedValueOnce({ items: [], meta: { total: 0, cities: [] } });
    renderDirectory();
    expect(await screen.findByText('This company has no merchant branches yet')).toBeInTheDocument();
    cleanup();

    vi.mocked(listSaasCompanyMerchants).mockRejectedValueOnce(new Error('Forbidden company'));
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden company');
  });
});
