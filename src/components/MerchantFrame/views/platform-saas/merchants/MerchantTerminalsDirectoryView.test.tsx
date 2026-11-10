import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MERCHANT_TERMINALS_TITLE,
  MerchantTerminalsDirectoryView,
} from '@/components/MerchantFrame/views/platform-saas/merchants/MerchantTerminalsDirectoryView';
import { getSaasMerchant, listSaasMerchantTerminals } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { ApiError } from '@/shared/lib/api-error';
import type { SaasMerchantProfile, SaasMerchantTerminal } from '@/modules/platform-saas/merchants/types/saas-merchant';

vi.mock('@/modules/platform-saas/merchants/api/saas-merchants', () => ({
  getSaasMerchant: vi.fn(),
  listSaasMerchantTerminals: vi.fn(),
}));

const MERCHANT: SaasMerchantProfile = {
  id: 11,
  name: 'Airport',
  branchCode: 'MCH-0011',
  email: null,
  phone: null,
  address: null,
  city: 'Orlando',
  state: null,
  country: null,
  timezone: 'America/New_York',
  status: 'active',
  companyId: 4,
  companyName: 'Acme',
};

const base = { paymentConfigName: 'Stripe Orlando', cashDrawerId: null, merchantId: 11 };
const TERMINALS: SaasMerchantTerminal[] = [
  {
    ...base,
    id: 1,
    name: 'Front Counter',
    model: 'WisePOS E',
    deviceIdentifier: 'tmr_front',
    provider: 'stripe',
    status: 'active',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
  },
  {
    ...base,
    id: 2,
    name: 'Patio',
    model: null,
    deviceIdentifier: 'HSN-77',
    provider: 'cardpointe',
    status: 'inactive',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-05T10:00:00.000Z',
  },
];

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderDirectory() {
  return render(
    <MemoryRouter initialEntries={['/platform-saas/companies/4/merchants/11/terminals']}>
      <MerchantTerminalsDirectoryView companyId={4} merchantId={11} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('MerchantTerminalsDirectoryView', () => {
  beforeEach(() => {
    vi.mocked(getSaasMerchant).mockResolvedValue(MERCHANT);
    vi.mocked(listSaasMerchantTerminals).mockImplementation(async (_id, query = {}) => {
      const items = TERMINALS.filter(
        (t) =>
          (!query.status || t.status === query.status) &&
          (!query.search || `${t.name} ${t.model} ${t.deviceIdentifier}`.toLowerCase().includes(query.search.toLowerCase())),
      );
      return { items, meta: { total: 2, active: 1 } };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the terminals grid with title, breadcrumbs and counts', async () => {
    renderDirectory();
    expect(screen.getByRole('heading', { level: 1, name: MERCHANT_TERMINALS_TITLE })).toBeInTheDocument();
    const row = await screen.findByTestId('terminal-row-1');
    expect(row).toHaveTextContent('Front Counter');
    expect(row).toHaveTextContent('tmr_front');
    expect(row).toHaveTextContent('Stripe');
    expect(row).toHaveTextContent('WisePOS E');
    expect(row).toHaveTextContent('Active');
    expect(screen.getByTestId('terminal-row-2')).toHaveTextContent('CardPointe');
    expect(screen.getByTestId('terminal-row-2')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('terminals-count')).toHaveTextContent('1 active · 2 total');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() => expect(within(crumbs).getByText('Airport')).toBeInTheDocument());
    expect(within(crumbs).getByText('POS Terminals')).toHaveAttribute('aria-current', 'page');
    expect(listSaasMerchantTerminals).toHaveBeenCalledWith(11, { search: undefined, status: undefined });
  });

  it('filters by status and search, and clears the filters from the empty state', async () => {
    renderDirectory();
    await screen.findByTestId('terminal-row-1');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive');
    await waitFor(() => expect(screen.queryByTestId('terminal-row-1')).not.toBeInTheDocument());
    expect(screen.getByTestId('terminal-row-2')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    await userEvent.type(screen.getByLabelText('Search terminals'), 'zzz');
    expect(await screen.findByText('No terminals match your filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByTestId('terminal-row-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Search terminals')).toHaveValue('');
  });

  it('shows an empty state for a branch without terminals', async () => {
    vi.mocked(listSaasMerchantTerminals).mockResolvedValue({ items: [], meta: { total: 0, active: 0 } });
    renderDirectory();
    expect(await screen.findByText('No terminals registered for this branch')).toBeInTheDocument();
  });

  it('shows the API error with a retry, and goes back to the merchant hub', async () => {
    vi.mocked(listSaasMerchantTerminals).mockRejectedValueOnce(
      new ApiError('You do not have access to companies outside your organization.', 403),
    );
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to companies outside your organization.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('terminal-row-1')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Platform SaaS navigation' })).getByRole('button', { name: 'Back to Merchant Hub' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/platform-saas/companies/4/merchants/11/hub');
  });

  it('refuses a merchant of another company', async () => {
    vi.mocked(getSaasMerchant).mockResolvedValue({ ...MERCHANT, companyId: 5 });
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Merchant #11 does not belong to company #4.');
  });
});
