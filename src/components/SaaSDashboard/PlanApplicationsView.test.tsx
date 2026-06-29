import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanApplicationsView } from './PlanApplicationsView';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
  },
}));

const MOCK_PLAN: SubscriptionPlan = {
  id: 3,
  name: 'Gold Plan',
  description: 'Full-featured tier.',
  price: 99.99,
  billingCycle: 'monthly',
  status: 'active',
};

const MOCK_PLAN_APPS: PlanApplication[] = [
  {
    id: 1,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    application: { id: 5, name: 'POS Core', category: 'Point of Sale' },
    limits: 'Basic usage limit: 100 users per month',
    status: 'active',
  },
  {
    id: 2,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    application: { id: 7, name: 'Kitchen Display', category: 'Kitchen Display' },
    limits: 'Up to 3 KDS screens',
    status: 'inactive',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanApplicationsView — loading state', () => {
  it('shows skeleton rows while data is loading', () => {
    vi.mocked(saasService.getPlanApplications).mockReturnValue(new Promise(() => {}));
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('PlanApplicationsView — title card', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('shows the dark title card with plan name', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText(/APPLICATIONS BOUND TO PLAN: Gold Plan/i),
      ).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — table rendering', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('renders one row per plan application', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('POS Core')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
    });
  });

  it('shows application ID as a code snippet', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('renders the software category tag for each row', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Point of Sale')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
    });
  });

  it('renders the usage restrictions text', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument();
    });
  });

  it('renders active status badge with emerald styling', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getAllByText(/active/i)[0];
      expect(badge.className).toContain('text-green-600');
    });
  });

  it('renders inactive status badge with grey styling', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getByText(/inactive/i);
      expect(badge.className).toContain('text-[#5f5e5e]');
    });
  });
});

describe('PlanApplicationsView — empty state (AC 4)', () => {
  it('shows empty state block when plan has no applications', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue([]);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(
        screen.getByText(
          /This subscription plan currently has no applications linked/i,
        ),
      ).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — error handling', () => {
  it('shows error toast when API call fails', async () => {
    vi.mocked(saasService.getPlanApplications).mockRejectedValue(
      new Error('Network failure'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('shows session-expired toast on SESSION_EXPIRED error', async () => {
    vi.mocked(saasService.getPlanApplications).mockRejectedValue(
      new Error('SESSION_EXPIRED'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Session expired/i),
      ).toBeInTheDocument();
    });
  });
});
