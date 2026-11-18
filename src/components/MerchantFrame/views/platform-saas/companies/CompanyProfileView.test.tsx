import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyProfileView } from '@/components/MerchantFrame/views/platform-saas/companies/CompanyProfileView';
import {
  getSaasCompanyProfile,
  updateSaasCompanyProfile,
} from '@/modules/platform-saas/companies/api/saas-companies';
import { getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';
import { ApiError } from '@/shared/lib/api-error';
import type { SaasCompanyProfile } from '@/modules/platform-saas/companies/types/saas-company';

vi.mock('@/modules/platform-saas/companies/api/saas-companies', () => ({
  getSaasCompanyProfile: vi.fn(),
  updateSaasCompanyProfile: vi.fn(),
}));
vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>()),
  getEffectiveUserRole: vi.fn(() => 'super_admin'),
}));

const PROFILE: SaasCompanyProfile = {
  id: 7,
  legalName: 'Acme Holdings LLC',
  commercialName: 'Acme',
  taxId: '12-3456789',
  email: 'hq@acme.com',
  phone: '+1 (555) 000-1000',
  address: '100 Corporate Plaza',
  city: 'Miami',
  state: 'FL',
  country: 'United States',
  baseCurrency: 'USD',
  status: 'active',
  metrics: { activeMerchantBranches: 5, globalCorporateCustomers: 48, authorizedMasterSuppliers: 9 },
};

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/7/profile']}>
      <CompanyProfileView companyId={7} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CompanyProfileView for a selected company', () => {
  beforeEach(() => {
    vi.mocked(getSaasCompanyProfile).mockResolvedValue(PROFILE);
    vi.mocked(updateSaasCompanyProfile).mockImplementation(async (_id, patch) => ({ ...PROFILE, ...patch }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('hydrates the form controls with the company attributes', async () => {
    renderProfile();
    expect(await screen.findByLabelText(/Legal Name/)).toHaveValue('Acme Holdings LLC');
    expect(getSaasCompanyProfile).toHaveBeenCalledWith(7);
    expect(screen.getByLabelText(/Commercial Name/)).toHaveValue('Acme');
    expect(screen.getByLabelText(/Tax ID/)).toHaveValue('12-3456789');
    expect(screen.getByLabelText(/Base Currency/)).toHaveValue('USD');
    expect(screen.getByLabelText(/Account Status/)).toHaveValue('active');
    expect(screen.getByLabelText(/^Address/)).toHaveValue('100 Corporate Plaza');
    expect(screen.getByLabelText(/City/)).toHaveValue('Miami');
    expect(screen.getByLabelText(/Country/)).toHaveValue('United States');
    expect(screen.getByTestId('stat-merchant-branches')).toHaveTextContent('5');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Acme')).toBeInTheDocument();
    expect(within(crumbs).getByText('Company Profile')).toHaveAttribute('aria-current', 'page');
  });

  it('validates mandatory fields and the tax ID format in real time', async () => {
    renderProfile();
    const legalName = await screen.findByLabelText(/Legal Name/);
    await userEvent.clear(legalName);
    expect(screen.getByText('Legal name is required.')).toBeInTheDocument();

    const taxId = screen.getByLabelText(/Tax ID/);
    await userEvent.clear(taxId);
    await userEvent.type(taxId, 'ABC#');
    expect(screen.getByText(/Enter a valid tax ID/)).toBeInTheDocument();
    expect(taxId).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields before saving.');
    expect(updateSaasCompanyProfile).not.toHaveBeenCalled();
  });

  it('rejects an unsupported base currency before submitting', async () => {
    vi.mocked(getSaasCompanyProfile).mockResolvedValue({ ...PROFILE, baseCurrency: 'XYZ' });
    renderProfile();
    await screen.findByLabelText(/Legal Name/);
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText(/supported ISO 4217 currency/)).toBeInTheDocument();
    expect(updateSaasCompanyProfile).not.toHaveBeenCalled();
  });

  it('offers the full ISO 4217 list, sorted and named, with the current currency preselected', async () => {
    vi.mocked(getSaasCompanyProfile).mockResolvedValue({ ...PROFILE, baseCurrency: 'CLP' });
    renderProfile();
    const select = (await screen.findByLabelText(/Base Currency/)) as HTMLSelectElement;
    expect(select).toHaveValue('CLP');
    const codes = [...select.options].map((option) => option.value);
    expect(codes.length).toBeGreaterThanOrEqual(170);
    expect(codes).toEqual([...codes].sort());
    expect(within(select).getByRole('option', { name: 'JPY — Japanese Yen' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'CHF — Swiss Franc' })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'JPY');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(updateSaasCompanyProfile).toHaveBeenCalledWith(7, { baseCurrency: 'JPY' }));
  });

  it('dispatches a PATCH with only the modified fields and confirms the update', async () => {
    renderProfile();
    const legalName = await screen.findByLabelText(/Legal Name/);
    await userEvent.clear(legalName);
    await userEvent.type(legalName, 'Acme Global Inc.');
    await userEvent.selectOptions(screen.getByLabelText(/Base Currency/), 'EUR');
    await userEvent.selectOptions(screen.getByLabelText(/Account Status/), 'suspended');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(updateSaasCompanyProfile).toHaveBeenCalledWith(7, {
        legalName: 'Acme Global Inc.',
        baseCurrency: 'EUR',
        status: 'suspended',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Company profile updated successfully.');
    expect(screen.getByLabelText(/Legal Name/)).toHaveValue('Acme Global Inc.');
  });

  it('shows the backend error when the PATCH is rejected', async () => {
    vi.mocked(updateSaasCompanyProfile).mockRejectedValueOnce(new ApiError('taxId must be a valid tax ID', 400));
    renderProfile();
    const city = await screen.findByLabelText(/City/);
    await userEvent.clear(city);
    await userEvent.type(city, 'Orlando');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('taxId must be a valid tax ID');
  });

  it('does not call the backend when nothing changed', async () => {
    renderProfile();
    await screen.findByLabelText(/Legal Name/);
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.');
    expect(updateSaasCompanyProfile).not.toHaveBeenCalled();
  });

  it('is read-only for portal users', async () => {
    vi.mocked(getEffectiveUserRole).mockReturnValue('portal_user');
    renderProfile();
    expect(await screen.findByLabelText(/Legal Name/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    vi.mocked(getEffectiveUserRole).mockReturnValue('super_admin');
  });

  it('shows a load error with retry', async () => {
    vi.mocked(getSaasCompanyProfile).mockRejectedValueOnce(new ApiError('Company not found', 404));
    renderProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent('Company not found');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText(/Legal Name/)).toHaveValue('Acme Holdings LLC');
  });

  it('goes back to the company hub', async () => {
    renderProfile();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' })).getByRole('button', { name: 'Back to Company Hub' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/7/hub');
  });
});
