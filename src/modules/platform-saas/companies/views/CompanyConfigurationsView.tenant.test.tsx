import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyConfigurationsView } from '@/modules/platform-saas/companies/views/CompanyConfigurationsView';
import {
  getSaasCompanyConfigurations,
  getSaasCompanyHub,
} from '@/modules/platform-saas/companies/api/saas-companies';
import { getCompanyConfigurations } from '@/modules/platform-saas/companies/api/companies';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  getSaasCompanyConfigurations: vi.fn(),
  getSaasCompanyHub: vi.fn(),
}));
vi.mock('@/modules/platform-saas/companies/api/companies', () => ({
  getCompanyConfigurations: vi.fn(),
}));

describe('CompanyConfigurationsView for a selected company', () => {
  beforeEach(() => {
    vi.mocked(getSaasCompanyConfigurations).mockResolvedValue({
      summary: { totalConfigurations: 2, activeConfigurations: 1, configurationTypes: 2 },
      items: [
        {
          id: 1,
          configurationType: 'merchant_tax_rule',
          configurationLabel: 'Tax Rules',
          status: 'active',
          merchantId: 3,
          merchantName: 'Harbor Grill',
          updatedAt: '2026-01-01',
        },
      ],
    });
    vi.mocked(getSaasCompanyHub).mockResolvedValue({
      company: { id: 9, name: 'Acme', legalName: null, taxId: null, status: 'active', baseCurrency: 'USD', city: null, country: null },
      stats: { totalMerchants: 1, activeMerchants: 1, activeUsers: 1, configurations: 2 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('loads the configurations of the company in the URL, with breadcrumbs', async () => {
    render(
      <MemoryRouter>
        <CompanyConfigurationsView companyId={9} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Harbor Grill')).toBeInTheDocument();
    expect(getSaasCompanyConfigurations).toHaveBeenCalledWith(9);
    expect(getCompanyConfigurations).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'COMPANY CONFIGURATION' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(crumbs).findByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('Payroll Rules')).not.toBeInTheDocument();
  });
});
