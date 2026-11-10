import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantProfileView } from '@/components/MerchantFrame/views/platform-saas/merchants/MerchantProfileView';
import { getSaasMerchant, updateSaasMerchant } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { ApiError } from '@/shared/lib/api-error';
import type { SaasMerchantProfile } from '@/modules/platform-saas/merchants/types/saas-merchant';

vi.mock('@/modules/platform-saas/merchants/api/saas-merchants', () => ({
  getSaasMerchant: vi.fn(),
  updateSaasMerchant: vi.fn(),
}));
vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>()),
  getEffectiveUserRole: vi.fn(() => 'merchant_admin'),
}));

const MERCHANT: SaasMerchantProfile = {
  id: 11,
  name: 'Airport',
  branchCode: 'MCH-0011',
  email: 'airport@acme.com',
  phone: '+1 407 555 0100',
  address: '1 Airport Blvd',
  city: 'Orlando',
  state: 'FL',
  country: 'United States',
  timezone: 'America/New_York',
  status: 'active',
  companyId: 4,
  companyName: 'Acme',
};

function renderProfile() {
  return render(
    <MemoryRouter>
      <MerchantProfileView companyId={4} merchantId={11} />
    </MemoryRouter>,
  );
}

describe('MerchantProfileView', () => {
  beforeEach(() => {
    vi.mocked(getSaasMerchant).mockResolvedValue(MERCHANT);
    vi.mocked(updateSaasMerchant).mockImplementation(async (_id, patch) => ({ ...MERCHANT, ...patch }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('loads the branch metadata into the form fields', async () => {
    renderProfile();
    expect(await screen.findByLabelText(/Branch Name/)).toHaveValue('Airport');
    expect(getSaasMerchant).toHaveBeenCalledWith(11);
    expect(screen.getByLabelText(/Phone/)).toHaveValue('+1 407 555 0100');
    expect(screen.getByLabelText(/^Address/)).toHaveValue('1 Airport Blvd');
    expect(screen.getByLabelText(/Timezone/)).toHaveValue('America/New_York');
    expect(screen.getByLabelText(/Operational Status/)).toHaveValue('active');
    expect(screen.getByText('MCH-0011')).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Acme')).toBeInTheDocument();
    expect(within(crumbs).getByText('Merchant Profile')).toHaveAttribute('aria-current', 'page');
  });

  it('validates the inputs before saving', async () => {
    renderProfile();
    const name = await screen.findByLabelText(/Branch Name/);
    await userEvent.clear(name);
    expect(screen.getByText('Branch name is required.')).toBeInTheDocument();
    const phone = screen.getByLabelText(/Phone/);
    await userEvent.clear(phone);
    await userEvent.type(phone, 'abc');
    expect(screen.getByText(/valid contact number/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(updateSaasMerchant).not.toHaveBeenCalled();
  });

  it('rejects an invalid timezone loaded from the backend', async () => {
    vi.mocked(getSaasMerchant).mockResolvedValue({ ...MERCHANT, timezone: 'Mars/Olympus' });
    renderProfile();
    await screen.findByLabelText(/Branch Name/);
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText(/valid IANA timezone/)).toBeInTheDocument();
    expect(updateSaasMerchant).not.toHaveBeenCalled();
  });

  it('saves the modifications with a PATCH and confirms', async () => {
    renderProfile();
    const phone = await screen.findByLabelText(/Phone/);
    await userEvent.clear(phone);
    await userEvent.type(phone, '+1 407 555 0199');
    await userEvent.selectOptions(screen.getByLabelText(/Timezone/), 'America/Chicago');
    await userEvent.selectOptions(screen.getByLabelText(/Operational Status/), 'suspended');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(updateSaasMerchant).toHaveBeenCalledWith(11, {
        phone: '+1 407 555 0199',
        timezone: 'America/Chicago',
        status: 'suspended',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Merchant profile updated successfully.');
  });

  it('marks the name field when the branch name already exists in the company', async () => {
    vi.mocked(updateSaasMerchant).mockRejectedValueOnce(new ApiError('A merchant named Downtown already exists', 409));
    renderProfile();
    const name = await screen.findByLabelText(/Branch Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Downtown');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByLabelText(/Branch Name/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses a merchant of another company', async () => {
    vi.mocked(getSaasMerchant).mockResolvedValue({ ...MERCHANT, companyId: 5 });
    renderProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent('does not belong to company #4');
  });
});
