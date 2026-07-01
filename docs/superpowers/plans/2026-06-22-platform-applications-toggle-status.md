# Platform Applications — Toggle Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `PlatformApplicationsView` component that lists Platform Applications from `GET /api/applications` and lets the SaaS Owner deactivate an app via a lock-icon toggle (PATCH → `status: 'inactive'`), replacing the existing placeholder stub.

**Architecture:** New self-contained `PlatformApplicationsView.tsx` following the `SubscriptionPlansView` pattern — own state, own service calls, own sub-components. Types added to the shared `subscription.ts`. Two new methods added to `saasService`. `SaaSDashboard.tsx` swaps the stub for the new component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library (`@testing-library/react`, `@testing-library/user-event`), `vi.mock` for service isolation.

## Global Constraints

- All Tailwind classes must use the existing design tokens: `#ae001a` / `#930015` (CTA red), `#222222` (dark), `#fef9f1` (warm bg), `#e8e2d8` (border), `#5f5e5e` (secondary text), `#f8f3eb` (row hover).
- Status badge classes: active → `bg-green-500/10 text-green-600`, inactive → `bg-[#5f5e5e]/20 text-[#5f5e5e]`.
- Inactive rows: `opacity-75` (matches SubscriptionPlansView pattern).
- Service fetch wrapper is `saasApiFetch` defined in `saasService.ts` — do not create a new one.
- Tests use `vi.mock`, `vi.mocked`, `cleanup`, `waitFor`, `userEvent` — exactly as in `SubscriptionPlansView.test.tsx`.
- No new npm packages.
- `material-symbols-outlined` icon for the toggle button: `lock`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/subscription.ts` | Modify | Add `Application` interface |
| `src/services/saasService.ts` | Modify | Add `getApplications` + `toggleApplicationInactive` |
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | Create | Full view component + sub-components |
| `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` | Create | Vitest test suite |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | Modify | Replace stub with `<PlatformApplicationsView />` |

---

### Task 1: Add `Application` type and service methods

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `Application` type consumed by Tasks 2 and 3; `saasService.getApplications` and `saasService.toggleApplicationInactive` consumed by Task 2.

- [ ] **Step 1: Add `Application` interface to `src/types/subscription.ts`**

Open `src/types/subscription.ts`. Append after the existing exports:

```ts
export interface Application {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'inactive';
}
```

- [ ] **Step 2: Add service methods to `src/services/saasService.ts`**

Add `Application` to the import at the top of `src/services/saasService.ts`:

```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application } from '../types/subscription';
```

Then inside the `saasService` object, after `deleteSubscriptionPlan`, add:

```ts
  async getApplications(): Promise<Application[]> {
    const response = await saasApiFetch<{
      data: Application[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>('applications');
    return response.data;
  },

  async toggleApplicationInactive(app: Application): Promise<Application> {
    const response = await saasApiFetch<{ data: Application }>(
      `applications/${app.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: app.name,
          description: app.description,
          category: app.category,
          status: 'inactive',
        }),
      },
    );
    return response.data;
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add Application type and service methods for platform applications"
```

---

### Task 2: Create `PlatformApplicationsView` with TDD

**Files:**
- Create: `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`
- Create: `src/components/SaaSDashboard/PlatformApplicationsView.tsx`

**Interfaces:**
- Consumes: `Application` from `src/types/subscription.ts`, `saasService.getApplications`, `saasService.toggleApplicationInactive` from `src/services/saasService.ts`.
- Produces: `PlatformApplicationsView` React component (no props) consumed by Task 3.

---

#### Step 1: Write the full test file (all tests fail — component doesn't exist yet)

- [ ] Create `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` with this content:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformApplicationsView } from './PlatformApplicationsView';
import { saasService } from '../../services/saasService';
import type { Application } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getApplications: vi.fn(),
    toggleApplicationInactive: vi.fn(),
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
      expect(screen.getByText('PLATFORM APPLICATIONS')).toBeInTheDocument();
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
      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
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
      expect(screen.getByText('No Applications Configured')).toBeInTheDocument();
    });
  });

  it('hides the table when service returns no applications', async () => {
    vi.mocked(saasService.getApplications).mockResolvedValue([]);
    renderView();
    await waitFor(() => {
      expect(screen.queryByText('PLATFORM APPLICATIONS')).not.toBeInTheDocument();
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

    expect(screen.getByText('No applications match your search filters')).toBeInTheDocument();
  });

  it('clears all filters when Clear filters is clicked', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search applications...'), 'xyznotexist');
    expect(screen.getByText('No applications match your search filters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByText('POS Terminal')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
  });
});

describe('PlatformApplicationsView — toggle status action', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a Deactivate button only for active apps', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    const deactivateButtons = screen.getAllByRole('button', { name: /^Deactivate /i });
    expect(deactivateButtons).toHaveLength(2); // only active apps
  });

  it('does NOT render a Deactivate button for inactive apps', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Reporting Suite')).toBeInTheDocument());

    expect(
      screen.queryByRole('button', { name: 'Deactivate Reporting Suite' }),
    ).not.toBeInTheDocument();
  });

  it('clicking Deactivate opens confirmation modal with app name', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));

    expect(screen.getByText('DEACTIVATE APPLICATION')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Deactivating "POS Terminal" will affect all downstream subscription bundles (plan-applications) and operational storefront access points (subscription-applications). This application will no longer be distributed to new subscribers.',
      ),
    ).toBeInTheDocument();
  });

  it('clicking Cancel closes the confirmation modal', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));
    expect(screen.getByText('DEACTIVATE APPLICATION')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('DEACTIVATE APPLICATION')).not.toBeInTheDocument();
  });

  it('confirming calls toggleApplicationInactive with the correct app', async () => {
    const deactivated = { ...MOCK_APPS[0], status: 'inactive' as const };
    vi.mocked(saasService.toggleApplicationInactive).mockResolvedValue(deactivated);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(saasService.toggleApplicationInactive).toHaveBeenCalledWith(MOCK_APPS[0]);
    });
  });

  it('successful toggle updates row in-place to inactive and shows success toast', async () => {
    const deactivated = { ...MOCK_APPS[0], status: 'inactive' as const };
    vi.mocked(saasService.toggleApplicationInactive).mockResolvedValue(deactivated);

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(screen.queryByText('DEACTIVATE APPLICATION')).not.toBeInTheDocument();
      expect(screen.getByText('Application deactivated successfully')).toBeInTheDocument();
    });

    const cell = screen.getByText('POS Terminal');
    const row = cell.closest('tr');
    expect(row).toHaveClass('opacity-75');
  });

  it('SESSION_EXPIRED closes modal and shows session-expired toast', async () => {
    vi.mocked(saasService.toggleApplicationInactive).mockRejectedValue(
      new Error('SESSION_EXPIRED'),
    );

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(screen.queryByText('DEACTIVATE APPLICATION')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('API error closes modal and shows error toast', async () => {
    vi.mocked(saasService.toggleApplicationInactive).mockRejectedValue(
      new Error('Application has active subscriptions'),
    );

    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Deactivate POS Terminal' }));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(screen.queryByText('DEACTIVATE APPLICATION')).not.toBeInTheDocument();
      expect(screen.getByText('Application has active subscriptions')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail (component not yet created)**

```bash
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: many failures — `Cannot find module './PlatformApplicationsView'`.

- [ ] **Step 3: Create `src/components/SaaSDashboard/PlatformApplicationsView.tsx`**

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { saasService } from '../../services/saasService';
import type { Application } from '../../types/subscription';

interface DeactivateAppDialogProps {
  app: Application;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeactivateAppDialog: React.FC<DeactivateAppDialogProps> = ({
  app,
  submitting,
  onClose,
  onConfirm,
}) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md shadow-2xl">
      <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          DEACTIVATE APPLICATION
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-[#1d1c17]">
          {`Deactivating "${app.name}" will affect all downstream subscription bundles (plan-applications) and operational storefront access points (subscription-applications). This application will no longer be distributed to new subscribers.`}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && (
              <span className="material-symbols-outlined text-base animate-spin">
                progress_activity
              </span>
            )}
            {submitting ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' };
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => (
  <div
    className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 shadow-lg text-white text-sm font-medium ${
      toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}
  >
    <span className="material-symbols-outlined text-lg">
      {toast.type === 'success' ? 'check_circle' : 'error'}
    </span>
    {toast.message}
    <button
      type="button"
      onClick={onDismiss}
      className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  </div>
);

export const PlatformApplicationsView: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [togglingApp, setTogglingApp] = useState<Application | null>(null);
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    saasService
      .getApplications()
      .then(setApplications)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(
    () =>
      applications
        .filter(
          (a) =>
            searchTerm === '' ||
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.description.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .filter((a) => statusFilter === 'All Status' || a.status === statusFilter),
    [applications, searchTerm, statusFilter],
  );

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Status');
  };

  const handleToggleConfirm = async () => {
    if (!togglingApp) return;
    setToggleSubmitting(true);
    try {
      const updated = await saasService.toggleApplicationInactive(togglingApp);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setTogglingApp(null);
      setToast({ message: 'Application deactivated successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deactivate application';
      setTogglingApp(null);
      if (msg === 'SESSION_EXPIRED') {
        setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setToggleSubmitting(false);
    }
  };

  if (!loading && applications.length === 0) {
    return (
      <div
        data-testid="empty-state"
        className="flex flex-col items-center justify-center py-24 gap-6"
      >
        <span className="material-symbols-outlined text-[#5f5e5e]" style={{ fontSize: '72px' }}>
          inventory_2
        </span>
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#1d1c17]">No Applications Configured</h3>
          <p className="text-sm text-[#5f5e5e] mt-2 max-w-md text-center">
            No platform applications have been provisioned yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Strip */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-5 flex flex-row justify-between items-center gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-lg">
            search
          </span>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded-xl text-sm focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none transition-all font-[Poppins]"
            placeholder="Search applications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select
            data-testid="filter-status"
            aria-label="Filter by status"
            className="px-3 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded-xl text-sm focus:border-[#ae001a] outline-none font-[Poppins]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All Status">All Status</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 border border-[#e8e2d8] text-[#5f5e5e] text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#f2ede5] transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-[#e8e2d8] overflow-hidden">
        <div className="px-4 py-3 bg-[#222222] flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            PLATFORM APPLICATIONS
          </span>
          <span className="text-white/50 text-xs">
            {loading ? '...' : `${filtered.length} applications`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                  App Name &amp; ID
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                  Category
                </th>
                <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e2d8]">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-48" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-16 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-12 mx-auto" />
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#5f5e5e] text-4xl">
                        search_off
                      </span>
                      <p className="text-sm text-[#5f5e5e]">
                        No applications match your search filters
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[#ae001a] text-sm font-semibold hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((app) => (
                  <tr
                    key={app.id}
                    className={`group hover:bg-[#f8f3eb] transition-colors${app.status !== 'active' ? ' opacity-75' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-1 h-10 rounded-full flex-shrink-0 ${
                            app.status === 'active' ? 'bg-[#ae001a]' : 'bg-[#c8c6c5]'
                          }`}
                        />
                        <div>
                          <p className="font-bold text-[#1d1c17]">{app.name}</p>
                          <code className="font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded">
                            {app.id}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-[280px]">
                      <p className="text-sm text-[#5f5e5e] line-clamp-2">{app.description}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold uppercase text-[#5f5e5e] border border-[#e8e2d8] bg-[#f2ede5] px-2 py-0.5 rounded">
                        {app.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {app.status === 'active' ? (
                        <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                          active
                        </span>
                      ) : (
                        <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          aria-label={`Edit ${app.name}`}
                          onClick={() => alert('Edit simulation')}
                          className="p-1 hover:text-[#ae001a] transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        {app.status === 'active' && (
                          <button
                            type="button"
                            aria-label={`Deactivate ${app.name}`}
                            onClick={() => setTogglingApp(app)}
                            className="p-1 hover:text-[#ae001a] transition-colors"
                          >
                            <span className="material-symbols-outlined text-xl">lock</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {togglingApp && (
        <DeactivateAppDialog
          app={togglingApp}
          submitting={toggleSubmitting}
          onClose={() => setTogglingApp(null)}
          onConfirm={handleToggleConfirm}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};

export default PlatformApplicationsView;
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: all tests pass. If any fail, fix the component code before proceeding. Do not move to the next step with failing tests.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SaaSDashboard/PlatformApplicationsView.tsx src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
git commit -m "feat: add PlatformApplicationsView with toggle-status deactivation flow"
```

---

### Task 3: Wire `PlatformApplicationsView` into `SaaSDashboard`

**Files:**
- Modify: `src/components/SaaSDashboard/SaaSDashboard.tsx:78-113`

**Interfaces:**
- Consumes: `PlatformApplicationsView` (no props) from `./PlatformApplicationsView`.

- [ ] **Step 1: Add the import to `SaaSDashboard.tsx`**

At the top of `src/components/SaaSDashboard/SaaSDashboard.tsx`, add after the existing imports:

```ts
import { PlatformApplicationsView } from './PlatformApplicationsView';
```

- [ ] **Step 2: Replace the stub with the real component**

In `SaaSDashboard.tsx`, inside `renderContent()`, find the block that checks `activeTab === 'subscription-applications' || activeTab === 'subscription-features' || activeTab === 'subscription-payments'` (lines 78–113). Replace that entire block with:

```tsx
if (activeTab === 'subscription-applications') {
  return <PlatformApplicationsView />;
}

if (
  activeTab === 'subscription-features' ||
  activeTab === 'subscription-payments'
) {
  const subConfig = {
    'subscription-features': {
      icon: 'featured_play_list',
      title: 'Feature Catalog Map',
      desc: 'Master feature flags and platform capability tables.',
    },
    'subscription-payments': {
      icon: 'payments',
      title: 'Subscription Payments',
      desc: 'Centralized billing book tracking payment logs from active merchants.',
    },
  }[activeTab as 'subscription-features' | 'subscription-payments'];
  return (
    <div className="bg-white border border-[#e8e2d8] p-12 rounded flex flex-col items-center text-center">
      <span className="material-symbols-outlined text-[#d51f2c] text-6xl">{subConfig.icon}</span>
      <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">{subConfig.title}</h2>
      <p className="text-body-md text-[#666666] mt-2 max-w-md text-center">{subConfig.desc}</p>
      <button
        onClick={() => setActiveTab('subscription')}
        className="mt-6 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#d51f2c] transition-all"
      >
        Back to Subscription Plans
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SaaSDashboard/SaaSDashboard.tsx
git commit -m "feat: wire PlatformApplicationsView into SaaSDashboard subscription-applications tab"
```

---

## Self-Review

**Spec coverage check:**
- AC1 (lock icon instead of delete): ✅ `lock` button rendered per active row, no delete button.
- AC2 (warning modal with plan-applications + subscription-applications copy): ✅ `DeactivateAppDialog` exact copy matches spec.
- AC3 (PATCH → `status: 'inactive'`): ✅ `toggleApplicationInactive` sends `PATCH /api/applications/:id` with full object + `status: 'inactive'`.
- AC4 (opacity-75 + grey badge on inactive rows): ✅ row class `opacity-75` when `status !== 'active'`, grey badge for inactive.

**Placeholder scan:** No TBDs, no "add appropriate error handling" patterns, no "similar to" references.

**Type consistency:** `Application` defined in Task 1, imported in Tasks 2 and 3. `saasService.getApplications` and `saasService.toggleApplicationInactive` defined in Task 1, called in Task 2 component and mocked in Task 2 tests. `PlatformApplicationsView` named export used in Task 3 import.
