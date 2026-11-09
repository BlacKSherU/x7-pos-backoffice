//src/components/SaaSDashboard/SubscriptionPlansView.test.tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionPlansView } from '@/modules/platform-saas/subscription-system/views/SubscriptionPlansView';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type { SubscriptionPlan } from '@/modules/platform-saas/subscription-system/types/subscription';

vi.mock('@/modules/platform-saas/central-backoffice/api/saas-service', () => ({
  saasService: {
    getSubscriptionPlans: vi.fn(),
    createSubscriptionPlan: vi.fn(),
    updateSubscriptionPlan: vi.fn(),
    deleteSubscriptionPlan: vi.fn(),
    getMetrics: vi.fn(),
  },
}));

const MOCK_PLANS: SubscriptionPlan[] = [
  {
    id: 1,
    name: 'Starter',
    description: 'Entry-level plan for quick service restaurants.',
    price: 49.99,
    billingCycle: 'monthly',
    status: 'active',
  },
  {
    id: 2,
    name: 'Professional',
    description: 'Multi-location support with advanced reporting.',
    price: 129.99,
    billingCycle: 'monthly',
    status: 'active',
  },
  {
    id: 3,
    name: 'Enterprise',
    description: 'Unlimited locations with white-label options.',
    price: 1199.99,
    billingCycle: 'yearly',
    status: 'active',
  },
  {
    id: 4,
    name: 'Legacy Basic',
    description: 'Deprecated legacy tier. Grandfathered accounts only.',
    price: 19.99,
    billingCycle: 'monthly',
    status: 'inactive',
  },
  {
    id: 5,
    name: 'Archived Gold',
    description: 'Legacy gold tier, permanently discontinued.',
    price: 299.99,
    billingCycle: 'monthly',
    status: 'deleted',
  },
];

function renderView() {
  return render(<SubscriptionPlansView />);
}

describe('SubscriptionPlansView — table rendering', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the SUBSCRIPTION MASTER PLANS heading', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION MASTER PLANS')).toBeInTheDocument();
    });
  });

  it('renders all plan names', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Legacy Basic')).toBeInTheDocument();
    });
  });

  it('renders each plan id inside a <code> element', async () => {
    renderView();
    await waitFor(() => {
      const codeEl = screen.getByText('1');
      expect(codeEl.tagName).toBe('CODE');
    });
  });

  it('renders plan descriptions', async () => {
    renderView();
    await waitFor(() => {
      expect(
        screen.getByText('Entry-level plan for quick service restaurants.'),
      ).toBeInTheDocument();
    });
  });

  it('renders price formatted with currency symbol and commas', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('$1,199.99')).toBeInTheDocument();
    });
  });

  it('renders the price label of a custom-priced plan instead of $0.00', async () => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue([
      {
        id: 6,
        name: 'Executive',
        description: 'Custom commercial terms per client.',
        price: null,
        priceLabel: 'Contact sales',
        isCustomPricing: true,
        billingCycle: 'annual',
        status: 'active',
      },
    ]);
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Contact sales')).toBeInTheDocument();
      expect(screen.getByText('/ annual')).toBeInTheDocument();
    });
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('renders billing cycle labels prefixed with /', async () => {
    renderView();
    await waitFor(() => {
      const monthlyLabels = screen.getAllByText('/ monthly');
      expect(monthlyLabels.length).toBeGreaterThan(0);
      expect(screen.getByText('/ yearly')).toBeInTheDocument();
    });
  });

  it('renders active status badges', async () => {
    renderView();
    await waitFor(() => {
      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBeGreaterThan(0);
    });
  });

  it('renders inactive status badge', async () => {
    renderView();
    await waitFor(() => {
      const inactiveBadges = screen.getAllByText('inactive');
      expect(inactiveBadges.length).toBeGreaterThan(0);
    });
  });

  it('inactive plan rows have opacity-75 class', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Legacy Basic')).toBeInTheDocument());

    const legacyCell = screen.getByText('Legacy Basic');
    const row = legacyCell.closest('tr');
    expect(row).toHaveClass('opacity-75');
  });

  it('deleted plan rows have opacity-75 class', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Archived Gold')).toBeInTheDocument());

    const deletedCell = screen.getByText('Archived Gold');
    const row = deletedCell.closest('tr');
    expect(row).toHaveClass('opacity-75');
  });
});

describe('SubscriptionPlansView — filter strip', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the search input', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search plans...')).toBeInTheDocument();
    });
  });

  it('filters rows by plan name on search input', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search plans...'), 'Pro');

    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy Basic')).not.toBeInTheDocument();
  });

  it('filters rows by plan description on search input', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search plans...'), 'quick service');

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.queryByText('Professional')).not.toBeInTheDocument();
  });

  it('filters rows by billing cycle dropdown', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Enterprise')).toBeInTheDocument());

    await user.selectOptions(
      screen.getByTestId('filter-billing-cycle'),
      'yearly',
    );

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
    expect(screen.queryByText('Professional')).not.toBeInTheDocument();
  });

  it('filters rows by status dropdown', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Legacy Basic')).toBeInTheDocument());

    await user.selectOptions(
      screen.getByTestId('filter-status'),
      'inactive',
    );

    expect(screen.getByText('Legacy Basic')).toBeInTheDocument();
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
  });

  it('shows warning row when filters yield no results', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search plans...'), 'xyznotexist');

    expect(
      screen.getByText('No subscription profiles match your search filters'),
    ).toBeInTheDocument();
  });

  it('clears all filters when Clear filters is clicked', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search plans...'), 'xyznotexist');
    expect(
      screen.getByText('No subscription profiles match your search filters'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
  });

  it('billing cycle dropdown includes unique values from data', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    const select = screen.getByTestId('filter-billing-cycle') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);

    expect(options).toContain('All Cycles');
    expect(options).toContain('monthly');
    expect(options).toContain('yearly');
  });

});

describe('SubscriptionPlansView — empty data state', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows empty state panel when service returns no plans', async () => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue([]);
    renderView();
    await waitFor(() => {
      expect(
        screen.getByText(
          "No subscription plans have been provisioned yet. Click 'Add Plan' to initialize your platform's monetization model.",
        ),
      ).toBeInTheDocument();
    });
  });

  it('hides the table when service returns no plans', async () => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue([]);
    renderView();
    await waitFor(() => {
      expect(screen.queryByText('SUBSCRIPTION MASTER PLANS')).not.toBeInTheDocument();
    });
  });
});

describe('SubscriptionPlansView — edit plan', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders an edit button for each plan row', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    const editButtons = screen.getAllByRole('button', { name: /^Edit /i });
    expect(editButtons).toHaveLength(MOCK_PLANS.length);
  });

  it('edit button has correct aria-label', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Edit Starter' })).toBeInTheDocument();
  });

  it('clicking edit opens modal pre-filled with plan name', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));

    expect(screen.getByText('EDIT SUBSCRIPTION PLAN')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('e.g. Professional') as HTMLInputElement;
    expect(nameInput.value).toBe('Starter');
  });

  it('clicking edit pre-fills price and billingCycle', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));

    const priceInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    expect(priceInput.value).toBe('49.99');

    const billingSelect = screen.getByDisplayValue('Monthly') as HTMLSelectElement;
    expect(billingSelect.value).toBe('monthly');
  });

  it('submitting edit calls updateSubscriptionPlan with correct payload', async () => {
    const updatedPlan = { ...MOCK_PLANS[0], name: 'Starter Edited' };
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue(updatedPlan);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));

    const nameInput = screen.getByPlaceholderText('e.g. Professional');
    await user.clear(nameInput);
    await user.type(nameInput, 'Starter Edited');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(saasService.updateSubscriptionPlan).toHaveBeenCalledWith(1, {
        name: 'Starter Edited',
        description: 'Entry-level plan for quick service restaurants.',
        price: 49.99,
        billingCycle: 'monthly',
      });
    });
  });

  it('successful update patches the row in the table without re-fetch', async () => {
    const updatedPlan = { ...MOCK_PLANS[0], name: 'Starter Renamed' };
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue(updatedPlan);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));
    const nameInput = screen.getByPlaceholderText('e.g. Professional');
    await user.clear(nameInput);
    await user.type(nameInput, 'Starter Renamed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Starter Renamed')).toBeInTheDocument();
      expect(screen.queryByText('Starter')).not.toBeInTheDocument();
    });
  });

  it('successful update shows success toast', async () => {
    const updatedPlan = { ...MOCK_PLANS[0] };
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue(updatedPlan);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Subscription plan updated successfully')).toBeInTheDocument();
    });
  });

  it('SESSION_EXPIRED closes modal and shows error toast', async () => {
    vi.mocked(saasService.updateSubscriptionPlan).mockRejectedValue(new Error('SESSION_EXPIRED'));

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('EDIT SUBSCRIPTION PLAN')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('server error shows inline form error and keeps modal open', async () => {
    vi.mocked(saasService.updateSubscriptionPlan).mockRejectedValue(
      new Error('A plan with this name already exists'),
    );

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Starter' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('EDIT SUBSCRIPTION PLAN')).toBeInTheDocument();
      expect(screen.getByText('A plan with this name already exists')).toBeInTheDocument();
    });
  });
});

describe('SubscriptionPlansView — status toggle', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue([
      { id: 1, name: 'Gold Plan', description: 'Full tier', price: 99.99, billingCycle: 'monthly', status: 'active' },
      { id: 2, name: 'Silver Plan', description: 'Mid tier', price: 49.99, billingCycle: 'monthly', status: 'inactive' },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a Deactivate button for an active plan and an Activate button for an inactive plan', async () => {
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('Gold Plan')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Deactivate Gold Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate Silver Plan' })).toBeInTheDocument();
  });

  it('deactivates an active plan after confirming', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue({
      id: 1, name: 'Gold Plan', description: 'Full tier', price: 99.99, billingCycle: 'monthly', status: 'inactive',
    });
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('Gold Plan')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Deactivate Gold Plan' }));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));
    await waitFor(() =>
      expect(saasService.updateSubscriptionPlan).toHaveBeenCalledWith(1, { status: 'inactive' }),
    );
  });

  it('activates an inactive plan after confirming', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue({
      id: 2, name: 'Silver Plan', description: 'Mid tier', price: 49.99, billingCycle: 'monthly', status: 'active',
    });
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('Silver Plan')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Activate Silver Plan' }));
    await user.click(screen.getByRole('button', { name: /^activate$/i }));
    await waitFor(() =>
      expect(saasService.updateSubscriptionPlan).toHaveBeenCalledWith(2, { status: 'active' }),
    );
  });
});

describe('SubscriptionPlansView — Edit no longer touches status', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue([
      { id: 1, name: 'Gold Plan', description: 'Full tier', price: 99.99, billingCycle: 'monthly', status: 'active' },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render a Status field in the Edit dialog', async () => {
    const user = userEvent.setup();
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('Gold Plan')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Gold Plan' }));
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });

  it('saves without a status field in the payload', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.updateSubscriptionPlan).mockResolvedValue({
      id: 1, name: 'Gold Plan Renamed', description: 'Full tier', price: 99.99, billingCycle: 'monthly', status: 'active',
    });
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('Gold Plan')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Gold Plan' }));
    const nameInput = screen.getByDisplayValue('Gold Plan');
    await user.clear(nameInput);
    await user.type(nameInput, 'Gold Plan Renamed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(saasService.updateSubscriptionPlan).toHaveBeenCalledWith(1, {
        name: 'Gold Plan Renamed',
        description: 'Full tier',
        price: 99.99,
        billingCycle: 'monthly',
      }),
    );
  });
});

describe('SubscriptionPlansView — Secondary Header, KPIs & Navigation Hub', () => {
  beforeEach(() => {
    vi.mocked(saasService.getSubscriptionPlans).mockResolvedValue(MOCK_PLANS);
    vi.mocked(saasService.getMetrics).mockResolvedValue({
      totalMerchants: { value: 2842, growth: 12.5, trend: [100, 200] },
      quickService: { count: 1120, terminals: 4480 },
      fullRestaurant: { count: 942, terminals: 7536 },
      enterprise: { count: 780, terminals: 15600 },
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the secondary header with breadcrumbs and title', async () => {
    render(<SubscriptionPlansView />);
    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION PLANS CONFIGURATION')).toBeInTheDocument();
      expect(screen.getByText('Platform SaaS')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subscription System Hub' })).toBeInTheDocument();
    });
  });

  it('navigates to subscription-system-hub when breadcrumb link or header button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<SubscriptionPlansView onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTION PLANS CONFIGURATION')).toBeInTheDocument();
    });

    const hubBreadcrumb = screen.getByRole('button', { name: 'Subscription System Hub' });
    await user.click(hubBreadcrumb);
    expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');

    const hubButtons = screen.getAllByRole('button', { name: /subscription hub/i });
    await user.click(hubButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith('subscription-system-hub');
  });

  it('displays real-time KPI metrics in stat cards', async () => {
    render(<SubscriptionPlansView />);
    await waitFor(() => {
      // 3 active plans out of 5 in MOCK_PLANS
      expect(screen.getByTestId('stat-active-plans')).toHaveTextContent('3');
      // Total subscribers from metrics mock (2,842)
      expect(screen.getByTestId('stat-subscribers-count')).toHaveTextContent('2,842');
      // Billing cycles cadence: 4 monthly (Starter, Professional, Legacy Basic, Archived Gold), 1 yearly (Enterprise)
      expect(screen.getByTestId('stat-cadence-count')).toHaveTextContent('4M / 1Y');
      // Average price for active paid plans (Starter: 49.99, Professional: 129.99, Enterprise: 1199.99) -> 1379.97 / 3 = $459.99
      expect(screen.getByTestId('stat-avg-price')).toHaveTextContent('$459.99');
    });
  });

  it('shows grandfathering explanation when opening deactivation dialog for an active plan', async () => {
    const user = userEvent.setup();
    render(<SubscriptionPlansView />);
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    const deactivateBtn = screen.getByRole('button', { name: 'Deactivate Starter' });
    await user.click(deactivateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /prevents new subscriptions from selecting it while grandfathering existing active subscribers until renewal/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it('supports selecting quarterly billing cycle when creating a plan', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.createSubscriptionPlan).mockResolvedValue({
      id: 99,
      name: 'Quarterly Growth',
      description: 'Quarterly billing plan',
      price: 199.99,
      billingCycle: 'quarterly',
      status: 'active',
    });
    render(<SubscriptionPlansView />);
    await waitFor(() => expect(screen.getByText('SUBSCRIPTION MASTER PLANS')).toBeInTheDocument());

    const addButtons = screen.getAllByRole('button', { name: /add plan/i });
    await user.click(addButtons[0]);

    const nameInput = screen.getByPlaceholderText('e.g. Professional');
    await user.type(nameInput, 'Quarterly Growth');

    const descInput = screen.getByPlaceholderText("Describe what's included in this plan...");
    await user.type(descInput, 'Quarterly billing plan');

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '199.99');

    // Look for the select element inside the modal
    const cycleSelect = screen.getByTestId('modal-billing-cycle');
    await user.selectOptions(cycleSelect, 'quarterly');

    const createBtn = screen.getByRole('button', { name: /create plan/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(saasService.createSubscriptionPlan).toHaveBeenCalledWith({
        name: 'Quarterly Growth',
        description: 'Quarterly billing plan',
        price: 199.99,
        billingCycle: 'quarterly',
        status: 'active',
      });
    });
  });
});
