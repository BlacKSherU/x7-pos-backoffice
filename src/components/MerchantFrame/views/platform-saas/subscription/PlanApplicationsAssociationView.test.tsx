import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanApplicationsAssociationView } from './PlanApplicationsAssociationView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  SubscriptionPlan,
  Application,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import * as authStorage from '@/platform/auth/lib/auth-storage';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    getSubscriptionPlans: vi.fn(),
    getApplications: vi.fn(),
    getPlanApplications: vi.fn(),
    getSubscriptionPlanApplications: vi.fn(),
    associatePlanApplication: vi.fn(),
    disassociatePlanApplication: vi.fn(),
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

const MOCK_APPLICATIONS: Application[] = [
  {
    id: 101,
    name: 'Point of Sale (POS)',
    code: 'pos-core',
    description: 'Core counter sales terminal software.',
    category: 'Core',
    status: 'active',
  },
  {
    id: 102,
    name: 'Kitchen Display System (KDS)',
    code: 'kds-ops',
    description: 'Kitchen order management and pacing display.',
    category: 'Operations',
    status: 'active',
  },
  {
    id: 103,
    name: 'Delivery Fleet Tracking',
    code: 'delivery-fleet',
    description: 'Real-time driver dispatch and GPS delivery tracking.',
    category: 'Commerce',
    status: 'active',
  },
];

describe('PlanApplicationsAssociationView', () => {
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
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPLICATIONS);
    // Essential plan initially has POS (101) linked
    vi.mocked(saasService.getSubscriptionPlanApplications).mockResolvedValue([MOCK_APPLICATIONS[0]]);
    vi.mocked(saasService.associatePlanApplication).mockResolvedValue({ success: true });
    vi.mocked(saasService.disassociatePlanApplication).mockResolvedValue();
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

      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

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
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText(/PLAN-TO-APPLICATIONS ASSOCIATION/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Superadmin Mode/i)).toBeInTheDocument();
      expect(saasService.getSubscriptionPlans).toHaveBeenCalled();
    });
  });

  describe('Plan Selection & Rendering', () => {
    it('renders plan options and highlights the selected plan', async () => {
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Essential')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
      });

      expect(screen.getByText('ACTIVE TIER')).toBeInTheDocument();
    });

    it('switches plan context when clicking another tier card', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Professional')).toBeInTheDocument();
      });

      const proCard = screen.getByRole('button', { name: /Professional/i });
      await user.click(proCard);

      expect(saasService.getSubscriptionPlanApplications).toHaveBeenCalledWith(2);
    });
  });

  describe('Association Interface & Grid Actions', () => {
    it('displays applications with their correct linked/unlinked states', async () => {
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Point of Sale (POS)')).toBeInTheDocument();
      });

      // App 101 is linked
      const card101 = screen.getByTestId('app-card-101');
      expect(card101).toHaveTextContent(/Linked to Tier/i);
      expect(card101).toHaveTextContent(/Unlink App/i);

      // App 102 is not linked
      const card102 = screen.getByTestId('app-card-102');
      expect(card102).toHaveTextContent(/Not Linked/i);
      expect(card102).toHaveTextContent(/Link Application/i);
    });

    it('links an unlinked application when clicking Link Application', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Kitchen Display System (KDS)')).toBeInTheDocument();
      });

      const card102 = screen.getByTestId('app-card-102');
      const linkBtn = within(card102).getByRole('button', { name: /Link Application/i });

      await user.click(linkBtn);

      expect(saasService.associatePlanApplication).toHaveBeenCalledWith(1, 102);

      await waitFor(() => {
        expect(within(card102).getByText(/Linked to Tier/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('association-toast')).toHaveTextContent(/Successfully associated/i);
    });

    it('unlinks an already linked application when clicking Unlink App', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Point of Sale (POS)')).toBeInTheDocument();
      });

      const card101 = screen.getByTestId('app-card-101');
      const unlinkBtn = within(card101).getByRole('button', { name: /Unlink App/i });

      await user.click(unlinkBtn);

      expect(saasService.disassociatePlanApplication).toHaveBeenCalledWith(1, 101);

      await waitFor(() => {
        expect(within(card101).getByText(/Not Linked/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('association-toast')).toHaveTextContent(/Disassociated/i);
    });
  });

  describe('Filtering and Search', () => {
    it('filters applications by keyword in search input', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Point of Sale (POS)')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Filter applications/i);
      await user.type(searchInput, 'Kitchen');

      expect(screen.getByText('Kitchen Display System (KDS)')).toBeInTheDocument();
      expect(screen.queryByText('Point of Sale (POS)')).not.toBeInTheDocument();
    });

    it('filters applications by status pills', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Point of Sale (POS)')).toBeInTheDocument();
      });

      // Filter by "Linked"
      const linkedBtn = screen.getByRole('button', { name: /^Linked \(/i });
      await user.click(linkedBtn);

      expect(screen.getByText('Point of Sale (POS)')).toBeInTheDocument();
      expect(screen.queryByText('Kitchen Display System (KDS)')).not.toBeInTheDocument();
    });
  });

  describe('Display Mode & Master Matrix', () => {
    it('toggles to Full Matrix view mode and displays relational table', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByText('Full Matrix')).toBeInTheDocument();
      });

      const matrixToggle = screen.getByRole('button', { name: /Full Matrix/i });
      await user.click(matrixToggle);

      expect(screen.getByText(/MASTER MATRIX VIEW/i)).toBeInTheDocument();
      expect(screen.getByText(/Relational Plan vs Application Matrix/i)).toBeInTheDocument();
    });
  });

  describe('Persistent Navigation & NavHubBar', () => {
    it('renders NavHubBar and returns to Subscription Hub on click', async () => {
      const user = userEvent.setup();
      render(<PlanApplicationsAssociationView onNavigate={onNavigateMock} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Back to Subscription Hub/i)).toBeInTheDocument();
      });

      const backBtn = screen.getByLabelText(/Back to Subscription Hub/i);
      await user.click(backBtn);

      expect(onNavigateMock).toHaveBeenCalledWith('subscription-system-hub');
    });
  });
});

