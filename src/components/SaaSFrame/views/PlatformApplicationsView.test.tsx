//src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformApplicationsView } from './PlatformApplicationsView';
import { saasService } from '../../../services/saasService';
import type { Application } from '../../../types/subscription';

vi.mock('../../../services/saasService', () => ({
  saasService: {
    getApplications: vi.fn(),
    deleteApplication: vi.fn(),
    updateApplication: vi.fn(),
    createApplication: vi.fn(),
  },
}));

const MOCK_APPS: Application[] = [
  {
    id: 1,
    name: 'POS Terminal',
    description: 'Core point-of-sale terminal application.',
    category: 'Core',
    status: 'active',
  },
  {
    id: 2,
    name: 'Kitchen Display',
    description: 'Real-time kitchen order display system.',
    category: 'Operations',
    status: 'active',
  },
  {
    id: 3,
    name: 'Reporting Suite',
    description: 'Advanced reporting and analytics module.',
    category: 'Analytics',
    status: 'inactive',
  },
  {
    id: 4,
    name: 'Legacy Bridge',
    description: 'Deprecated legacy integration bridge.',
    category: 'Core',
    status: 'deleted',
  },
];

function renderView() {
  return render(<PlatformApplicationsView />);
}

describe('PlatformApplicationsView — table rendering', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the PLATFORM APPLICATIONS heading', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('PLATFORM APPLICATION MASTER DIRECTORY')).toBeInTheDocument();
    });
  });

  it('renders all application names', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('POS Terminal')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
      expect(screen.getByText('Reporting Suite')).toBeInTheDocument();
    });
  });

  it('renders application descriptions', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Core point-of-sale terminal application.')).toBeInTheDocument();
    });
  });

  it('renders category values', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getAllByText('Core')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Operations')[0]).toBeInTheDocument();
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
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('inactive rows have opacity-75 class', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());

    const cell = screen.getByText('Reporting Suite');
    const row = cell.closest('tr');
    expect(row).toHaveClass('opacity-75');
  });

  it('active rows do NOT have opacity-75 class', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    const cell = screen.getByText('POS Terminal');
    const row = cell.closest('tr');
    expect(row).not.toHaveClass('opacity-75');
  });
});

describe('PlatformApplicationsView — empty state', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows empty state when service returns no applications', async () => {
    vi.mocked(saasService.getApplications).mockResolvedValue([]);
    renderView();
    await waitFor(() => {
      expect(
        screen.getByText(
          "No applications have been registered in the system. Click 'Register Application' to deploy your first software module.",
        ),
      ).toBeInTheDocument();
    });
  });

  it('hides the table when service returns no applications', async () => {
    vi.mocked(saasService.getApplications).mockResolvedValue([]);
    renderView();
    await waitFor(() => {
      expect(screen.queryByText('PLATFORM APPLICATION MASTER DIRECTORY')).not.toBeInTheDocument();
    });
  });
});

describe('PlatformApplicationsView — filter strip', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the search input', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search applications...')).toBeInTheDocument();
    });
  });

  it('filters rows by application name on search', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search applications...'), 'Kitchen');

    expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
    expect(screen.queryByText('POS Terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('Reporting Suite')).not.toBeInTheDocument();
  });

  it('filters rows by application description on search', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search applications...'), 'analytics');

    expect(screen.getByText('Reporting Suite')).toBeInTheDocument();
    expect(screen.queryByText('POS Terminal')).not.toBeInTheDocument();
  });

  it('filters rows by status dropdown', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('filter-status'), 'inactive');

    expect(screen.getByText('Reporting Suite')).toBeInTheDocument();
    expect(screen.queryByText('POS Terminal')).not.toBeInTheDocument();
  });

  it('shows no-results row when filters yield no matches', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search applications...'), 'xyznotexist');

    expect(screen.getByText('No applications match your filtering criteria')).toBeInTheDocument();
  });

  it('clears all filters when Clear filters is clicked', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search applications...'), 'xyznotexist');
    expect(screen.getByText('No applications match your filtering criteria')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByText('POS Terminal')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
  });
});

describe('PlatformApplicationsView — delete application', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a Delete button for each active app', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Delete POS Terminal' })).toBeInTheDocument();
  });

  it('renders a Delete button for each inactive app', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Delete Reporting Suite' })).toBeInTheDocument();
  });

  it('does NOT render a Delete button for deleted apps', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Legacy Bridge')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'Delete Legacy Bridge' }),
    ).not.toBeInTheDocument();
  });

  it('clicking Delete opens the confirmation dialog with correct copy', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete POS Terminal' }));

    expect(screen.getByText('DELETE APPLICATION')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Deleting "POS Terminal" will permanently prevent it from being distributed to new subscribers. The record is retained for historical analytics.',
      ),
    ).toBeInTheDocument();
  });

  it('clicking Cancel closes the confirmation dialog', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete POS Terminal' }));
    expect(screen.getByText('DELETE APPLICATION')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('DELETE APPLICATION')).not.toBeInTheDocument();
  });

  it('confirming calls deleteApplication with the correct app id', async () => {
    const deleted = { ...MOCK_APPS[0], status: 'deleted' as const };
    vi.mocked(saasService.deleteApplication).mockResolvedValue(deleted);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /delete application/i }));

    await waitFor(() => {
      expect(saasService.deleteApplication).toHaveBeenCalledWith(MOCK_APPS[0].id);
    });
  });

  it('successful delete updates row in-place to deleted badge and shows success toast', async () => {
    const deleted = { ...MOCK_APPS[0], status: 'deleted' as const };
    vi.mocked(saasService.deleteApplication).mockResolvedValue(deleted);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /delete application/i }));

    await waitFor(() => {
      expect(screen.queryByText('DELETE APPLICATION')).not.toBeInTheDocument();
      expect(screen.getByText('Application deleted successfully')).toBeInTheDocument();
    });
  });

  it('SESSION_EXPIRED closes dialog and shows session-expired toast', async () => {
    vi.mocked(saasService.deleteApplication).mockRejectedValue(new Error('SESSION_EXPIRED'));

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /delete application/i }));

    await waitFor(() => {
      expect(screen.queryByText('DELETE APPLICATION')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('Edit button is disabled for deleted apps', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Legacy Bridge')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Edit Legacy Bridge' })).toBeDisabled();
  });

  it('renders deleted status badge for deleted apps', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Legacy Bridge')).toBeInTheDocument());
    expect(screen.getAllByText('deleted').length).toBeGreaterThan(0);
  });
});

describe('PlatformApplicationsView — Quick Launch panel', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the Quick Launch panel with heading', async () => {
    render(<PlatformApplicationsView />);
    await waitFor(() => {
      expect(screen.getByText('Quick Launch')).toBeInTheDocument();
    });
  });

  it('renders all four Quick Launch buttons', async () => {
    render(<PlatformApplicationsView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'FEATURE CATALOG' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' })).toBeInTheDocument();
    });
  });

  it('calls onNavigate with "subscription" when SUBSCRIPTION PLANS is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    await userEvent.click(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription');
  });

  it('calls onNavigate with "subscription-features" when FEATURE CATALOG is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'FEATURE CATALOG' }));
    await userEvent.click(screen.getByRole('button', { name: 'FEATURE CATALOG' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-features');
  });

  it('calls onNavigate with "subscription-live-installs" when ACTIVE LIVE INSTALLS is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' }));
    await userEvent.click(screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-live-installs');
  });

  it('does not call onNavigate when EMERGENCY SUPPORT is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    await userEvent.click(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('PlatformApplicationsView — register application', () => {
  const NEW_APP: Application = {
    id: 99,
    name: 'Loyalty Engine',
    description: 'Customer loyalty points management system.',
    category: 'Marketing',
    status: 'active',
  };

  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the REGISTER APPLICATION button in the filter strip', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^register application$/i })).toBeInTheDocument();
  });

  it('renders the FAB register button', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /open register-application form/i })).toBeInTheDocument();
  });

  it('clicking REGISTER APPLICATION opens the creation modal', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    expect(screen.getByText('REGISTER APPLICATION')).toBeInTheDocument();
  });

  it('clicking the FAB opens the creation modal', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /open register-application form/i }));

    expect(screen.getByText('REGISTER APPLICATION')).toBeInTheDocument();
  });

  it('modal form renders name, description, category fields and status select', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    expect(screen.getByPlaceholderText('Application name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Application description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
  });

  it('Save Changes is disabled when name is empty', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('Save Changes is disabled when category is empty', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    await user.type(screen.getByPlaceholderText('Application name'), 'Test App');
    await user.type(screen.getByPlaceholderText('Application description'), 'A description');
    // category left empty

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('name field exceeding 100 characters disables Save Changes', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    const longName = 'A'.repeat(101);
    await user.type(screen.getByPlaceholderText('Application name'), longName);
    await user.type(screen.getByPlaceholderText('Application description'), 'desc');
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), 'Cat');

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('category field exceeding 50 characters disables Save Changes', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));

    await user.type(screen.getByPlaceholderText('Application name'), 'Valid Name');
    await user.type(screen.getByPlaceholderText('Application description'), 'desc');
    const longCategory = 'C'.repeat(51);
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), longCategory);

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('successful creation closes modal, prepends new row, and shows success toast', async () => {
    vi.mocked(saasService.createApplication).mockResolvedValue(NEW_APP);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));
    await user.type(screen.getByPlaceholderText('Application name'), NEW_APP.name);
    await user.type(screen.getByPlaceholderText('Application description'), NEW_APP.description);
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), NEW_APP.category);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('REGISTER APPLICATION')).not.toBeInTheDocument();
      expect(screen.getByText('Loyalty Engine')).toBeInTheDocument();
      expect(screen.getByText('Application registered successfully')).toBeInTheDocument();
    });
  });

  it('createApplication is called with correct payload including status active', async () => {
    vi.mocked(saasService.createApplication).mockResolvedValue(NEW_APP);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));
    await user.type(screen.getByPlaceholderText('Application name'), NEW_APP.name);
    await user.type(screen.getByPlaceholderText('Application description'), NEW_APP.description);
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), NEW_APP.category);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(saasService.createApplication).toHaveBeenCalledWith({
        name: NEW_APP.name,
        description: NEW_APP.description,
        category: NEW_APP.category,
        status: 'active',
      });
    });
  });

  it('SESSION_EXPIRED closes modal and shows session-expired toast', async () => {
    vi.mocked(saasService.createApplication).mockRejectedValue(new Error('SESSION_EXPIRED'));

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));
    await user.type(screen.getByPlaceholderText('Application name'), 'Any App');
    await user.type(screen.getByPlaceholderText('Application description'), 'desc');
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), 'Cat');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('REGISTER APPLICATION')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('API error closes modal and shows error toast', async () => {
    vi.mocked(saasService.createApplication).mockRejectedValue(
      new Error('Application name already exists'),
    );

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^register application$/i }));
    await user.type(screen.getByPlaceholderText('Application name'), 'Any App');
    await user.type(screen.getByPlaceholderText('Application description'), 'desc');
    await user.type(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display'), 'Cat');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('REGISTER APPLICATION')).not.toBeInTheDocument();
      expect(screen.getByText('Application name already exists')).toBeInTheDocument();
    });
  });
});

describe('PlatformApplicationsView — edit application status', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('Edit modal renders a Status select pre-populated with the app current status', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Reporting Suite' }));

    const statusSelect = screen.getByRole('combobox', { name: /^status$/i });
    expect(statusSelect).toBeInTheDocument();
    expect((statusSelect as HTMLSelectElement).value).toBe('inactive');
  });

  it('saving the edit modal calls updateApplication with the selected status', async () => {
    const updated = { ...MOCK_APPS[2], status: 'active' as const };
    vi.mocked(saasService.updateApplication).mockResolvedValue(updated);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit Reporting Suite' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /^status$/i }), 'active');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(saasService.updateApplication).toHaveBeenCalledWith(
        MOCK_APPS[2],
        expect.objectContaining({ status: 'active' }),
      );
    });
  });
});
