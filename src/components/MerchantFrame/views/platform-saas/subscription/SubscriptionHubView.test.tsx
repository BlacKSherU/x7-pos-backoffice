import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionHubView } from './SubscriptionHubView';
import { SUBSCRIPTION_SUB_MODULES } from './subscription-hub-data';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type { SubscriptionPlan, Application, CompanySubscription } from '@/modules/platform-saas/subscription-system/types/subscription';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { renderMerchantView } from '@/platform/merchant-frame/merchant-view-registry';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    getSubscriptionPlans: vi.fn(),
    getApplications: vi.fn(),
    listCompanySubscriptions: vi.fn(),
  },
}));

const MOCK_PLANS: SubscriptionPlan[] = [
  { id: 1, name: 'Essential', description: 'Basic tier', price: 29, billingCycle: 'monthly', status: 'active' },
  { id: 2, name: 'Professional', description: 'Pro tier', price: 79, billingCycle: 'monthly', status: 'active' },
  { id: 3, name: 'Legacy Plan', description: 'Old tier', price: 49, billingCycle: 'monthly', status: 'inactive' },
];

const MOCK_APPLICATIONS: Application[] = [
  { id: 1, name: 'Point of Sale', description: 'POS system', category: 'Core', status: 'active' },
  { id: 2, name: 'Kitchen Display', description: 'KDS', category: 'Operations', status: 'active' },
  { id: 3, name: 'Archived App', description: 'Archived', category: 'Testing', status: 'inactive' },
];

const MOCK_COMPANY_SUBSCRIPTIONS: CompanySubscription[] = [
  {
    id: 1,
    company: { id: 10, name: 'Acme Dining' },
    plan: { id: 2, name: 'Professional' },
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    renewalDate: '2026-12-31',
    status: 'active',
    paymentMethod: 'credit_card',
    isExpired: false,
  },
  {
    id: 2,
    company: { id: 20, name: 'Global Eatery' },
    plan: { id: 1, name: 'Essential' },
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    renewalDate: null,
    status: 'active',
    paymentMethod: 'invoice',
    isExpired: true,
  },
];

describe('SubscriptionHubView', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPLICATIONS);
    vi.mocked(saasService.listCompanySubscriptions).mockResolvedValue(MOCK_COMPANY_SUBSCRIPTIONS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Secondary Header Rendered', () => {
    it('displays the exact title SUBSCRIPTION SYSTEM COMMAND HUB', async () => {
      render(<SubscriptionHubView />);

      const heading = await screen.findByRole('heading', {
        name: 'SUBSCRIPTION SYSTEM COMMAND HUB',
        level: 1,
      });
      expect(heading).toBeInTheDocument();
    });

    it('displays proper subtitle summarizing subscription plans, applications, and payments', async () => {
      render(<SubscriptionHubView />);

      const subtitle = await screen.findByText(/Centralized command center and real-time oversight of subscription plans/i);
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveTextContent(/subscription plans/i);
      expect(subtitle).toHaveTextContent(/applications/i);
      expect(subtitle).toHaveTextContent(/billing transactions/i);
    });

    it('displays proper breadcrumb context', async () => {
      render(<SubscriptionHubView />);

      const breadcrumb = await screen.findByLabelText('Breadcrumb');
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb).toHaveTextContent('Platform SaaS');
      expect(breadcrumb).toHaveTextContent('Subscription System Command Hub');
    });
  });

  describe('Statistic Cards', () => {
    it('displays accurate count metrics for subscription plans, applications, and payments', async () => {
      render(<SubscriptionHubView />);

      // Active plans: 2 out of 3
      const plansCount = await screen.findByTestId('stat-plans-count');
      expect(plansCount).toHaveTextContent('2');

      // Active applications: 2 out of 3
      const appsCount = await screen.findByTestId('stat-apps-count');
      expect(appsCount).toHaveTextContent('2');

      // Active/settled company subscriptions/payments: 1 (active & non-expired)
      const paymentsCount = await screen.findByTestId('stat-payments-count');
      expect(paymentsCount).toHaveTextContent('1');
    });

    it('navigates to sub-plans-core when clicking the plans stat card', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<SubscriptionHubView onNavigate={onNavigate} />);

      const statCard = await screen.findByTestId('stat-card-plans');
      await user.click(statCard);

      expect(onNavigate).toHaveBeenCalledWith('sub-plans-core');
    });

    it('navigates to apps-config when clicking the applications stat card', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<SubscriptionHubView onNavigate={onNavigate} />);

      const statCard = await screen.findByTestId('stat-card-applications');
      await user.click(statCard);

      expect(onNavigate).toHaveBeenCalledWith('apps-config');
    });

    it('navigates to sub-payments-billing when clicking the payments stat card', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<SubscriptionHubView onNavigate={onNavigate} />);

      const statCard = await screen.findByTestId('stat-card-payments');
      await user.click(statCard);

      expect(onNavigate).toHaveBeenCalledWith('sub-payments-billing');
    });
  });

  describe('Feature Cards Navigation', () => {
    it('renders all 9 subscription sub-modules with correct titles and descriptions', async () => {
      render(<SubscriptionHubView />);

      const expectedTitles = [
        'Subscription Plans Configuration',
        'Applications Configuration',
        'Features Configuration',
        'Applications to Plans Association',
        'Features to Plans Association',
        'Company Subscriptions Inquiry',
        'Merchant Subscriptions Inquiry',
        'Subscription Payments Inquiry (with Status Change)',
        'Subscription Applications Inquiry',
      ];

      for (const title of expectedTitles) {
        expect(await screen.findByText(title)).toBeInTheDocument();
      }
      expect(SUBSCRIPTION_SUB_MODULES).toHaveLength(9);
    });

    it.each(SUBSCRIPTION_SUB_MODULES)(
      'redirects user to $id when clicking the feature card for $title',
      async (subModule) => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();
        render(<SubscriptionHubView onNavigate={onNavigate} />);

        const card = await screen.findByTestId(`feature-card-${subModule.id}`);
        await user.click(card);

        expect(onNavigate).toHaveBeenCalledWith(subModule.id);
      },
    );
  });

  describe('Quick Launch Removal', () => {
    it('does not render the Quick Launch bar', () => {
      render(<SubscriptionHubView />);
      expect(screen.queryByTestId('quick-launch-bar')).not.toBeInTheDocument();
      expect(screen.queryByText('Quick Launch')).not.toBeInTheDocument();
    });
  });

  describe('Routing & Registry Integration', () => {
    it('resolves /platform-saas/subscription/hub to the subscription command hub tab', () => {
      const nav = getNavFromPath('/platform-saas/subscription/hub');
      expect(nav).toEqual({
        category: 'platformsaas',
        tab: 'subscription-system-hub',
      });
    });

    it('renders SubscriptionHubView from the merchant view registry', () => {
      const fakeCtx = {
        activeCategory: 'platformsaas',
        profile: null,
        selectedPlan: null,
        refreshTrigger: 0,
        onNavigate: vi.fn(),
        onStaffNavigate: vi.fn(),
        onSaasNavigate: vi.fn(),
        navigateToFeature: vi.fn(),
        setActiveTab: vi.fn(),
        goToDashboard: vi.fn(),
        openLiveMonitor: vi.fn(),
        linesEntryFilter: null,
        setLinesEntryFilter: vi.fn(),
        itemsPaymentFilter: null,
        setItemsPaymentFilter: vi.fn(),
        allocationsContext: null,
        setAllocationsContext: vi.fn(),
      };

      const viewNode = renderMerchantView('subscription-system-hub', fakeCtx);
      expect(viewNode).toBeDefined();
    });
  });
});

