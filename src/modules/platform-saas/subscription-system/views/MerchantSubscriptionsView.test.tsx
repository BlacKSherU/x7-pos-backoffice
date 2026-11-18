import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantSubscriptionsView } from '@/modules/platform-saas/subscription-system/views/MerchantSubscriptionsView';
import { toUpdateMerchantDto } from '../lib/merchant-subscriptions';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  MerchantSubscription,
  SubscriptionPlan,
} from '@/modules/platform-saas/subscription-system/types/subscription';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    listMerchantSubscriptions: vi.fn(),
    getSubscriptionPlans: vi.fn(),
    updateMerchantSubscription: vi.fn(),
  },
}));

const MOCK_SUB: MerchantSubscription = {
  id: 1,
  merchant: { id: 1, name: 'Main Street Bistro' },
  plan: { id: 2, name: 'Professional' },
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  renewalDate: '2027-01-01',
  status: 'active',
  paymentMethod: 'credit_card',
  isExpired: false,
};

const MOCK_EXPIRED_SUB: MerchantSubscription = {
  id: 2,
  merchant: { id: 2, name: 'Downtown Cafe' },
  plan: { id: 1, name: 'Essential' },
  startDate: '2025-01-01',
  endDate: '2026-01-01',
  renewalDate: '2026-01-01',
  status: 'active',
  paymentMethod: 'invoice',
  isExpired: true,
};

const PLANS: SubscriptionPlan[] = [
  { id: 1, name: 'Essential' } as SubscriptionPlan,
  { id: 2, name: 'Professional' } as SubscriptionPlan,
];

describe('MerchantSubscriptionsView', () => {
  beforeEach(() => {
    vi.mocked(saasService.listMerchantSubscriptions).mockResolvedValue([MOCK_SUB, MOCK_EXPIRED_SUB]);
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(PLANS);
    vi.mocked(saasService.updateMerchantSubscription).mockResolvedValue(MOCK_SUB);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the secondary header and title', async () => {
    render(<MerchantSubscriptionsView />);
    expect(
      await screen.findByRole('heading', { name: 'MERCHANT SUBSCRIPTIONS', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Platform SaaS')).toBeInTheDocument();
  });

  it('lists each merchant subscription with plan and status badge', async () => {
    render(<MerchantSubscriptionsView />);
    const table = within(await screen.findByRole('table'));
    expect(table.getByText('Main Street Bistro')).toBeInTheDocument();
    expect(table.getByText('Downtown Cafe')).toBeInTheDocument();
    expect(table.getByText('Professional')).toBeInTheDocument();
    expect(table.getByText('Expired')).toBeInTheDocument();
  });

  it('navigates to Subscription Hub when breadcrumb or header button is clicked', async () => {
    const onNavigate = vi.fn();
    render(<MerchantSubscriptionsView onNavigate={onNavigate} />);
    expect(
      await screen.findByRole('heading', { name: 'MERCHANT SUBSCRIPTIONS', level: 1 }),
    ).toBeInTheDocument();

    const hubBreadcrumb = screen.getByRole('button', { name: 'Subscription System Hub' });
    await userEvent.click(hubBreadcrumb);
    expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');

    const hubButtons = screen.getAllByRole('button', { name: /subscription hub/i });
    await userEvent.click(hubButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');
  });

  it('updates a merchant subscription via modal', async () => {
    render(<MerchantSubscriptionsView />);
    await screen.findByRole('table');

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit subscription of Main Street Bistro' }),
    );

    const paymentInput = screen.getByLabelText('Payment Method');
    await userEvent.clear(paymentInput);
    await userEvent.type(paymentInput, 'stripe');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(saasService.updateMerchantSubscription).toHaveBeenCalledWith(1, {
        paymentMethod: 'stripe',
      });
    });
  });
});

describe('toUpdateMerchantDto', () => {
  it('turns cleared optional dates into null', () => {
    expect(
      toUpdateMerchantDto(MOCK_SUB, {
        planId: '2',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '',
        renewalDate: '',
        paymentMethod: 'credit_card',
      }),
    ).toEqual({ endDate: null, renewalDate: null });
  });
});

