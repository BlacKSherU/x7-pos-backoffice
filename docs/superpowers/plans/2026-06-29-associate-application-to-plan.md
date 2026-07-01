# Associate Application to Subscription Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a creation workflow to `PlanApplicationsView` that lets users bind an existing platform application to the current subscription plan with a textual usage limit, via a modal form triggered by a brand-red button and/or a FAB.

**Architecture:** On modal open, load `getApplications()` lazily in the parent and filter out already-associated app ids client-side. The `AssociateAppDialog` is an extracted component above the view, matching the existing dialog pattern (`RegisterAppDialog`, `CreateFeatureDialog`). On confirm, POST to the existing `plan-applications` endpoint and prepend the returned row to the local state.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (`@testing-library/react`, `@testing-library/user-event`), Tailwind v4, Material Symbols icons.

## Global Constraints

- Brand red: `#ae001a` / hover: `#930015`
- All buttons: `text-[11px] font-bold uppercase tracking-widest`
- Modal overlay: `fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4`
- Modal card: `bg-white w-full max-w-lg shadow-2xl`
- Modal dark header: `bg-[#222222] px-6 py-4 flex justify-between items-center`
- Input base: `border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none transition-all`
- Read-only input bg: `bg-[#ece8e0] text-[#5f5e5e] cursor-not-allowed`
- FAB: `fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50`
- `status` must always be sent as `"active"` on creation — never user-selectable
- TDD order: write failing tests first, then implement

---

### Task 1: Add `CreatePlanApplicationDto` type and `createPlanApplication` service method

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `CreatePlanApplicationDto` (interface), `saasService.createPlanApplication(dto): Promise<PlanApplication>` — both consumed by Task 3

- [ ] **Step 1: Add `CreatePlanApplicationDto` to `src/types/subscription.ts`**

After the `UpdateSubscriptionPlanDto` interface (around line 24), insert:

```ts
export interface CreatePlanApplicationDto {
  subscriptionPlanId: number;
  applicationId: number;
  limits: string;
  status: 'active';
}
```

- [ ] **Step 2: Update the import in `src/services/saasService.ts` and add the service method**

Line 1 currently reads:
```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application, PlatformFeature, PlanApplication } from '../types/subscription';
```

Replace it with:
```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application, PlatformFeature, PlanApplication, CreatePlanApplicationDto } from '../types/subscription';
```

Then, after the `getPlanApplications` method (after the closing `},` around line 355), add:

```ts
  async createPlanApplication(dto: CreatePlanApplicationDto): Promise<PlanApplication> {
    const response = await saasApiFetch<{ data: PlanApplication }>(
      'plan-applications',
      { method: 'POST', body: JSON.stringify(dto) },
    );
    return response.data;
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: exits with no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add CreatePlanApplicationDto type and createPlanApplication service method"
```

---

### Task 2: Write failing tests for the associate-application workflow (TDD red phase)

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`

**Interfaces:**
- Consumes: `saasService.getApplications` (mocked), `saasService.createPlanApplication` (mocked), `Application` type from `../../types/subscription`

- [ ] **Step 1: Extend the service mock and add `Application` import**

At the top of the file, the current import block is:
```ts
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanApplicationsView } from './PlanApplicationsView';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
  },
}));
```

Replace the entire block above with:
```ts
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanApplicationsView } from './PlanApplicationsView';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan, Application } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
    getApplications: vi.fn(),
    createPlanApplication: vi.fn(),
  },
}));
```

- [ ] **Step 2: Add `MOCK_ALL_APPS` constant after `MOCK_PLAN_APPS`**

After the closing `];` of `MOCK_PLAN_APPS` (around line 38), add:

```ts
const MOCK_ALL_APPS: Application[] = [
  { id: 5, name: 'POS Core', description: '', category: 'Point of Sale', status: 'active' },
  { id: 7, name: 'Kitchen Display', description: '', category: 'Kitchen Display', status: 'active' },
  { id: 9, name: 'Analytics Pro', description: '', category: 'Analytics', status: 'active' },
];
// ids 5 and 7 are already in MOCK_PLAN_APPS; only id 9 should appear in the dropdown
```

- [ ] **Step 3: Append failing tests for trigger buttons (AC 1)**

At the end of the file, append:

```ts
describe('PlanApplicationsView — associate application trigger buttons (AC 1)', () => {
  it('renders "ASSOCIATE APPLICATION" button in the filter row when data is loaded', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: /associate application/i }),
    ).toBeInTheDocument();
  });

  it('renders "ASSOCIATE APPLICATION" button in the empty state', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue([]);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: /associate application/i }),
    ).toBeInTheDocument();
  });

  it('renders the FAB with aria-label "Open associate-application form"', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: /open associate-application form/i }),
    ).toBeInTheDocument();
  });

  it('clicking "ASSOCIATE APPLICATION" opens the modal', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_ALL_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument(),
    );
  });

  it('clicking the FAB opens the modal', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_ALL_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(
      screen.getByRole('button', { name: /open associate-application form/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 4: Append failing tests for modal fields (AC 2)**

```ts
describe('PlanApplicationsView — associate application modal fields (AC 2)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_ALL_APPS);
  });

  it('modal shows the plan name in a read-only input', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));

    await waitFor(() => {
      const input = screen.getByDisplayValue('Gold Plan');
      expect(input).toHaveAttribute('readonly');
    });
  });

  it('dropdown lists only platform apps not currently associated with this plan', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));

    await waitFor(() =>
      expect(screen.getByText('Analytics Pro (Analytics)')).toBeInTheDocument(),
    );
    expect(screen.queryByText('POS Core (Point of Sale)')).not.toBeInTheDocument();
    expect(screen.queryByText('Kitchen Display (Kitchen Display)')).not.toBeInTheDocument();
  });

  it('submit button is disabled when no application is selected', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^associate$/i })).toBeDisabled(),
    );
  });

  it('char counter turns red and submit is blocked when limits exceed 50 characters', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Up to 5 terminals/i)).toBeInTheDocument(),
    );

    await user.type(
      screen.getByPlaceholderText(/Up to 5 terminals/i),
      'a'.repeat(51),
    );

    const counter = screen.getByText('51/50');
    expect(counter.className).toContain('text-[#ae001a]');
    expect(screen.getByRole('button', { name: /^associate$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 5: Append failing tests for happy path, error path, and edge case (AC 3, AC 4)**

```ts
describe('PlanApplicationsView — associate application happy path (AC 4)', () => {
  it('on confirm: closes modal, prepends new row to grid, shows success toast', async () => {
    const user = userEvent.setup();
    const newPA: PlanApplication = {
      id: 99,
      subscriptionPlan: { id: 3, name: 'Gold Plan' },
      application: { id: 9, name: 'Analytics Pro', category: 'Analytics' },
      limits: 'Max 5 reports',
      status: 'active',
    };
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_ALL_APPS);
    vi.mocked(saasService.createPlanApplication).mockResolvedValue(newPA);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));
    await waitFor(() =>
      expect(screen.getByText('Analytics Pro (Analytics)')).toBeInTheDocument(),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^application$/i }),
      String(9),
    );
    await user.type(
      screen.getByPlaceholderText(/Up to 5 terminals/i),
      'Max 5 reports',
    );
    await user.click(screen.getByRole('button', { name: /^associate$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Application associated successfully')).toBeInTheDocument();
      expect(screen.getByText('Analytics Pro')).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — associate application error path', () => {
  it('on API error: closes modal and shows error toast', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_ALL_APPS);
    vi.mocked(saasService.createPlanApplication).mockRejectedValue(
      new Error('Server unavailable'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));
    await waitFor(() =>
      expect(screen.getByText('Analytics Pro (Analytics)')).toBeInTheDocument(),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^application$/i }),
      String(9),
    );
    await user.type(
      screen.getByPlaceholderText(/Up to 5 terminals/i),
      'Max 5 reports',
    );
    await user.click(screen.getByRole('button', { name: /^associate$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — associate application edge case', () => {
  it('shows "All applications already associated" when no apps are available and submit is blocked', async () => {
    const user = userEvent.setup();
    const appsAllAssociated: Application[] = [
      { id: 5, name: 'POS Core', description: '', category: 'Point of Sale', status: 'active' },
      { id: 7, name: 'Kitchen Display', description: '', category: 'Kitchen Display', status: 'active' },
    ];
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.getApplications).mockResolvedValue(appsAllAssociated);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /associate application/i }));

    await waitFor(() =>
      expect(screen.getByText('All applications already associated')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^associate$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 6: Run tests to confirm existing pass and new ones fail**

Run: `npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx`
Expected: 21 existing tests pass, 12 new tests fail with messages like `Unable to find role="button" with name /associate application/i`

- [ ] **Step 7: Commit failing tests**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.test.tsx
git commit -m "test: add failing tests for associate-application workflow (TDD red phase)"
```

---

### Task 3: Implement `AssociateAppDialog` + state/handlers/buttons/FAB in `PlanApplicationsView`

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.tsx`

**Interfaces:**
- Consumes: `CreatePlanApplicationDto` from Task 1, `saasService.getApplications()` and `saasService.createPlanApplication()` from Task 1
- Produces: `AssociateAppDialog` component, `openAssociateModal()` handler, `handleAssociate()` handler

- [ ] **Step 1: Add `Application` to the import**

Line 3 currently reads:
```ts
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';
```

Replace with:
```ts
import type { PlanApplication, SubscriptionPlan, Application } from '../../types/subscription';
```

- [ ] **Step 2: Insert `AssociateAppDialog` above `PlanApplicationsViewProps`**

Before the `interface PlanApplicationsViewProps` block, insert the full component:

```tsx
interface AssociateAppDialogProps {
  plan: SubscriptionPlan;
  availableApps: Application[];
  loadingApps: boolean;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { applicationId: number; limits: string }) => void;
}

const AssociateAppDialog: React.FC<AssociateAppDialogProps> = ({
  plan,
  availableApps,
  loadingApps,
  submitting,
  onClose,
  onSave,
}) => {
  const [selectedAppId, setSelectedAppId] = React.useState<number | ''>('');
  const [limits, setLimits] = React.useState('');

  const limitsExceeded = limits.length > 50;
  const isValid =
    selectedAppId !== '' &&
    limits.trim() !== '' &&
    !limitsExceeded &&
    !loadingApps;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            ASSOCIATE APPLICATION
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
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Subscription Plan
            </label>
            <input
              type="text"
              readOnly
              value={plan.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="associate-app-select"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Application
            </label>
            <select
              id="associate-app-select"
              value={selectedAppId}
              onChange={(e) =>
                setSelectedAppId(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={loadingApps}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all disabled:opacity-50"
            >
              {loadingApps ? (
                <option value="">Loading applications…</option>
              ) : availableApps.length === 0 ? (
                <option value="">All applications already associated</option>
              ) : (
                <>
                  <option value="">Select an application…</option>
                  {availableApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.category})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Usage Limits
              </label>
              <span
                className={`text-[11px] ${limitsExceeded ? 'text-[#ae001a] font-bold' : 'text-[#5f5e5e]'}`}
              >
                {limits.length}/50
              </span>
            </div>
            <textarea
              value={limits}
              onChange={(e) => setLimits(e.target.value)}
              rows={3}
              placeholder="e.g. Up to 5 terminals, 100 users/month"
              className={`w-full px-3 py-2 border bg-[#fef9f1] text-sm text-[#1d1c17] focus:ring-1 outline-none transition-all resize-none ${
                limitsExceeded
                  ? 'border-[#ae001a] focus:border-[#ae001a] focus:ring-[#ae001a]'
                  : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-[#ae001a]'
              }`}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
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
              onClick={() =>
                onSave({ applicationId: selectedAppId as number, limits: limits.trim() })
              }
              disabled={!isValid || submitting}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Associating…' : 'ASSOCIATE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Add new state variables inside `PlanApplicationsView`**

After the line `const [statusFilter, setStatusFilter] = useState('');` (around line 20), add:

```ts
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [availableApps, setAvailableApps] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [associateSubmitting, setAssociateSubmitting] = useState(false);
```

- [ ] **Step 4: Add `openAssociateModal` and `handleAssociate` handlers**

After the second `useEffect` block (the toast auto-dismiss one, around line 44) and before the `filteredApplications` useMemo, add:

```ts
  const openAssociateModal = () => {
    setShowAssociateModal(true);
    setLoadingApps(true);
    saasService
      .getApplications()
      .then((apps) => {
        const associatedIds = new Set(planApplications.map((pa) => pa.application.id));
        setAvailableApps(apps.filter((a) => !associatedIds.has(a.id)));
      })
      .catch(() => setAvailableApps([]))
      .finally(() => setLoadingApps(false));
  };

  const handleAssociate = async (dto: { applicationId: number; limits: string }) => {
    setAssociateSubmitting(true);
    try {
      const newPA = await saasService.createPlanApplication({
        subscriptionPlanId: plan.id,
        applicationId: dto.applicationId,
        limits: dto.limits,
        status: 'active',
      });
      setPlanApplications((prev) => [newPA, ...prev]);
      setShowAssociateModal(false);
      setToast({ message: 'Application associated successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to associate application';
      setShowAssociateModal(false);
      if (msg === 'SESSION_EXPIRED') {
        setToast({
          message: 'Session expired. Please refresh the page to sign in again.',
          type: 'error',
        });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setAssociateSubmitting(false);
    }
  };
```

- [ ] **Step 5: Add "ASSOCIATE APPLICATION" button to the empty state**

In the empty state block (around line 86), the current back-button is:

```tsx
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="text-[#ae001a] text-sm font-semibold hover:underline"
          >
            ← Back to Subscription Plans
          </button>
```

Replace it with:

```tsx
          <button
            type="button"
            onClick={openAssociateModal}
            className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add_link</span>
            ASSOCIATE APPLICATION
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="text-[#ae001a] text-sm font-semibold hover:underline"
          >
            ← Back to Subscription Plans
          </button>
```

- [ ] **Step 6: Add "ASSOCIATE APPLICATION" button to the filter controls row**

In the filter controls row (the `div` with `flex flex-col sm:flex-row gap-3`, around line 110), after the closing `</div>` of the status-filter div, add:

```tsx
              <button
                type="button"
                onClick={openAssociateModal}
                className="px-4 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base">add_link</span>
                ASSOCIATE APPLICATION
              </button>
```

- [ ] **Step 7: Add FAB and modal mount at the bottom of the JSX**

After the closing `</footer>` tag and before `{toast && (`, add:

```tsx
      {/* FAB */}
      {!fetchError && (
        <button
          type="button"
          aria-label="Open associate-application form"
          onClick={openAssociateModal}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      )}

      {/* Associate Application Modal */}
      {showAssociateModal && (
        <AssociateAppDialog
          plan={plan}
          availableApps={availableApps}
          loadingApps={loadingApps}
          submitting={associateSubmitting}
          onClose={() => setShowAssociateModal(false)}
          onSave={handleAssociate}
        />
      )}
```

- [ ] **Step 8: Run the full test suite and confirm all 33 tests pass**

Run: `npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx`
Expected: `Test Files 1 passed` — all 33 tests (21 existing + 12 new) pass with no failures

- [ ] **Step 9: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.tsx
git commit -m "feat: add AssociateAppDialog modal with FAB and trigger buttons to PlanApplicationsView"
```

---

## Self-Review

**Spec coverage:**
- AC 1 — "ASSOCIATE APPLICATION" button (brand red) + FAB: ✅ Task 3 Steps 5, 6, 7
- AC 2 — Modal: plan read-only, app dropdown (unassociated only), limits max 50 chars: ✅ Task 3 Steps 2, 4
- AC 3 — `status: 'active'` auto-set on creation: ✅ Task 3 Step 4 — hardcoded in `handleAssociate`
- AC 4 — Close modal + prepend row to grid + success toast: ✅ Task 3 Step 4 — `setPlanApplications(prev => [newPA, ...prev])`

**Placeholder scan:** No TBDs. All code blocks are complete and runnable.

**Type consistency:**
- `CreatePlanApplicationDto` defined in Task 1, consumed verbatim in Task 3 Step 4 ✅
- `Application` imported in Task 3 Step 1, used for `availableApps: Application[]` state ✅
- `AssociateAppDialogProps.onSave` receives `{ applicationId: number; limits: string }`, exactly matched by `handleAssociate(dto)` signature ✅
- `saasService.createPlanApplication` returns `Promise<PlanApplication>`, assigned to `newPA` and prepended to `planApplications: PlanApplication[]` ✅
- Test selector `getByRole('combobox', { name: /^application$/i })` works because the `<select>` has `id="associate-app-select"` and the `<label>` has `htmlFor="associate-app-select"` ✅
