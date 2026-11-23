import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanFeaturesAssociationView } from './PlanFeaturesAssociationView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  SubscriptionPlan,
  PlatformFeature,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import * as authStorage from '@/platform/auth/lib/auth-storage';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    getSubscriptionPlans: vi.fn(),
    getFeatures: vi.fn(),
    getPlanFeatures: vi.fn(),
    getSubscriptionPlanFeatures: vi.fn(),
    associatePlanFeature: vi.fn(),
    disassociatePlanFeature: vi.fn(),
  },
}));

const MOCK_PLANS: SubscriptionPlan[] = [
  {
    id: 1,
    name: 'Essential',
    description: 'Basic Starter Tier',
    price: 29.99,
    billingCycle: 'monthly',
    status: 'active',
  },
  {
    id: 2,
    name: 'Professional',
    description: 'Advanced Commercial Tier',
    price: 79.99,
    billingCycle: 'monthly',
    status: 'active',
  },
];

const MOCK_FEATURES: PlatformFeature[] = [
  {
    id: 201,
    name: 'Multi-Terminal Sync',
    description: 'Real-time multi-terminal state replication.',
    Unit: 'terminals',
    status: 'active',
  },
  {
    id: 202,
    name: 'Advanced Analytics Export',
    description: 'Export sales metrics to BigQuery and CSV.',
    Unit: 'reports',
    status: 'active',
  },
  {
    id: 203,
    name: 'Custom Tip Sharing Rules',
    description: 'Configurable percentage-based tip pooling.',
    Unit: 'rules',
    status: 'active',
  },
];

describe('PlanFeaturesAssociationView', () => {
  const onNavigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('super_admin');
    vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
      id: 1,
      email: 'superadmin@x7pos.com',
      role: 'super_admin',
      scope: 'global',
      merchant: { id: 1 },
      authorizedFeatureIds: [1, 2, 3],
    });

    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
    // Essential plan initially has Multi-Terminal Sync (201) linked
    vi.mocked(saasService.getSubscriptionPlanFeatures).mockResolvedValue([MOCK_FEATURES[0]]);
    vi.mocked(saasService.associatePlanFeature).mockResolvedValue({ success: true });
    vi.mocked(saasService.disassociatePlanFeature).mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
  });

  describe('RBAC & Role Validation', () => {
    it('restricts access and shows permission boundary when user role is not superadmin', async () => {
      vi.spyOn(authStorage, 'getEffectiveUserRole').mockReturnValue('merchant_admin');
      vi.spyOn(authStorage, 'getStoredUser').mockReturnValue({
        id: 2,
        email: 'merchant@store.com',
        role: 'merchant_admin',
        scope: 'merchant',
        merchant: { id: 1 },
        authorizedFeatureIds: [],
      });

      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      const boundaryCard = screen.getByTestId('permission-boundary-card');
      expect(boundaryCard).toBeInTheDocument();
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/SUPERADMIN PRIVILEGE REQUIRED/i)).toBeInTheDocument();

      // Does not fetch plans for unauthorized users
      expect(saasService.getSubscriptionPlans).not.toHaveBeenCalled();

      // Clicking return button navigates to hub
      const returnBtn = screen.getByRole('button', { name: /Return to Subscription Hub/i });
      await userEvent.click(returnBtn);
      expect(onNavigateMock).toHaveBeenCalledWith('subscription-system-hub');
    });

    it('grants full access when user role is superadmin', async () => {
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText(/PLAN-TO-FEATURES ASSOCIATION/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Superadmin Mode/i)).toBeInTheDocument();
      expect(saasService.getSubscriptionPlans).toHaveBeenCalled();
    });
  });

  describe('Plan Selection & Rendering', () => {
    it('renders plan options and highlights the selected plan', async () => {
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Essential')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
      });

      expect(screen.getByText('ACTIVE TIER')).toBeInTheDocument();
    });

    it('switches plan context when clicking another tier card', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Professional')).toBeInTheDocument();
      });

      const proCard = screen.getByRole('button', { name: /Professional/i });
      await user.click(proCard);

      expect(saasService.getSubscriptionPlanFeatures).toHaveBeenCalledWith(2);
    });
  });

  describe('Feature Grid Interaction & Actions', () => {
    it('displays features with their correct linked/unlinked states', async () => {
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Multi-Terminal Sync')).toBeInTheDocument();
      });

      // Feature 201 is linked
      const card201 = screen.getByTestId('feature-card-201');
      expect(card201).toHaveTextContent(/Feature Gated/i);
      expect(card201).toHaveTextContent(/Unbind Feature/i);

      // Feature 202 is not linked
      const card202 = screen.getByTestId('feature-card-202');
      expect(card202).toHaveTextContent(/Not Gated/i);
      expect(card202).toHaveTextContent(/Bind Feature/i);
    });

    it('binds an unlinked feature when clicking Bind Feature', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics Export')).toBeInTheDocument();
      });

      const card202 = screen.getByTestId('feature-card-202');
      const bindBtn = within(card202).getByRole('button', { name: /Bind Feature/i });

      await user.click(bindBtn);

      expect(saasService.associatePlanFeature).toHaveBeenCalledWith(1, 202);

      await waitFor(() => {
        expect(within(card202).getByText(/Feature Gated/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('association-toast')).toHaveTextContent(/Successfully bound/i);
    });

    it('unbinds an already linked feature when clicking Unbind Feature', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Multi-Terminal Sync')).toBeInTheDocument();
      });

      const card201 = screen.getByTestId('feature-card-201');
      const unbindBtn = within(card201).getByRole('button', { name: /Unbind Feature/i });

      await user.click(unbindBtn);

      expect(saasService.disassociatePlanFeature).toHaveBeenCalledWith(1, 201);

      await waitFor(() => {
        expect(within(card201).getByText(/Not Gated/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('association-toast')).toHaveTextContent(/Unbound/i);
    });
  });

  describe('Filtering and Search', () => {
    it('filters features by keyword in search input', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Multi-Terminal Sync')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Filter features/i);
      await user.type(searchInput, 'Analytics');

      expect(screen.getByText('Advanced Analytics Export')).toBeInTheDocument();
      expect(screen.queryByText('Multi-Terminal Sync')).not.toBeInTheDocument();
    });

    it('filters features by status pills', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Multi-Terminal Sync')).toBeInTheDocument();
      });

      // Filter by "Linked"
      const linkedBtn = screen.getByRole('button', { name: /^Linked \(/i });
      await user.click(linkedBtn);

      expect(screen.getByText('Multi-Terminal Sync')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Analytics Export')).not.toBeInTheDocument();
    });
  });

  describe('Display Mode & Master Matrix', () => {
    it('toggles to Full Matrix view mode and displays relational table', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Full Matrix')).toBeInTheDocument();
      });

      const matrixToggle = screen.getByRole('button', { name: /Full Matrix/i });
      await user.click(matrixToggle);

      expect(screen.getByText(/MASTER MATRIX VIEW/i)).toBeInTheDocument();
      expect(screen.getByText(/Relational Plan vs Feature Gate Matrix/i)).toBeInTheDocument();
    });
  });

  describe('Persistent Navigation & NavHubBar', () => {
    it('renders NavHubBar and returns to Subscription Hub on click', async () => {
      const user = userEvent.setup();
      render(<PlanFeaturesAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Back to Subscription Hub/i)).toBeInTheDocument();
      });

      const backBtn = screen.getByLabelText(/Back to Subscription Hub/i);
      await user.click(backBtn);

      expect(onNavigateMock).toHaveBeenCalledWith('subscription-system-hub');
    });
  });
});

