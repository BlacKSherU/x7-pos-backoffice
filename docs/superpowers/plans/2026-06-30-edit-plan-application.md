# Edit Plan-Application Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Edit flow to the Plan Applications grid so the SaaS Owner can update the `limits` string and `status` of an existing plan-application mapping via a PATCH call, with instant grid row update and success toast.

**Architecture:** New `EditPlanApplicationDialog` component added at the top of `PlanApplicationsView.tsx` (same file, same pattern as `AssociateAppDialog`). Grid gets an Actions column with a pencil button that fades in on row hover. `saasService` gets one new PATCH method. TDD: failing tests written first, then implementation.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library, `@testing-library/user-event`.

## Global Constraints

- All Tailwind classes must use the project palette: `#ae001a` (red), `#930015` (red hover), `#222222` (dark header), `#1d1c17` (body text), `#5f5e5e` (muted), `#e8e2d8` (border), `#ece8e0` (disabled bg), `#fef9f1` (input bg), `#f8f3eb` / `#f2ede5` (hover/tag bg).
- Material Symbols icon names only (no Heroicons, no SVGs): `edit`, `close`, `progress_activity`, `check_circle`, `error`.
- Backend endpoint: `PATCH /api/plan-applications/:id` — body `{ limits: string, status: 'active' | 'inactive' }`.
- `limits` max length: 50 characters (logical guard, no HTML `maxLength` attr — existing pattern).
- Run tests with: `npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx`
- Run all tests with: `npx vitest run`

---

## File Map

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Add `UpdatePlanApplicationDto` interface |
| `src/services/saasService.ts` | Add `updatePlanApplication` method; import new DTO |
| `src/components/SaaSDashboard/PlanApplicationsView.tsx` | Add `EditPlanApplicationDialog` component; add Actions column; add `editingPA`/`editSubmitting` state; add `handleEdit` handler |
| `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` | Add `updatePlanApplication: vi.fn()` to mock; add ~10 new tests |

---

### Task 1: Types + Service layer

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `UpdatePlanApplicationDto` type; `saasService.updatePlanApplication(id, dto)` method used by Task 3

---

- [ ] **Step 1: Add `UpdatePlanApplicationDto` to types**

Open `src/types/subscription.ts`. After the `CreatePlanApplicationDto` block (around line 31), add:

```ts
export interface UpdatePlanApplicationDto {
  limits: string;
  status: 'active' | 'inactive';
}
```

The file diff in that area looks like:
```ts
export interface CreatePlanApplicationDto {
  subscriptionPlan: number;
  application: number;
  limits: string;
  status: 'active';
}

// ADD THIS:
export interface UpdatePlanApplicationDto {
  limits: string;
  status: 'active' | 'inactive';
}
```

- [ ] **Step 2: Add `updatePlanApplication` to saasService**

Open `src/services/saasService.ts`.

First, update the import on line 1 to include `UpdatePlanApplicationDto`:
```ts
import type {
  SubscriptionPlan,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  Application,
  PlatformFeature,
  PlanApplication,
  CreatePlanApplicationDto,
  UpdatePlanApplicationDto,
} from '../types/subscription';
```

Then add this method to `saasService` immediately after `createPlanApplication` (around line 363):
```ts
async updatePlanApplication(id: number, dto: UpdatePlanApplicationDto): Promise<PlanApplication> {
  const response = await saasApiFetch<{ data: PlanApplication }>(
    `plan-applications/${id}`,
    { method: 'PATCH', body: JSON.stringify(dto) },
  );
  return response.data;
},
```

- [ ] **Step 3: Commit**

```bash
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add UpdatePlanApplicationDto type and updatePlanApplication service method"
```

---

### Task 2: Failing tests (TDD red phase)

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`

**Interfaces:**
- Consumes: `saasService.updatePlanApplication` (from Task 1)
- Produces: 10 failing tests that define the edit feature contract

---

- [ ] **Step 1: Add `updatePlanApplication` to the vi.mock factory**

In `PlanApplicationsView.test.tsx`, find the `vi.mock` block at the top (around line 8). Add `updatePlanApplication: vi.fn()`:

```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
    getApplications: vi.fn(),
    createPlanApplication: vi.fn(),
    updatePlanApplication: vi.fn(),
  },
}));
```

- [ ] **Step 2: Add the 10 new test describe blocks**

Append the following at the end of `PlanApplicationsView.test.tsx` (after the last existing `describe` block):

```ts
describe('PlanApplicationsView — edit trigger (AC 1)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('each data row has a pencil button with correct aria-label', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /edit pos core/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit kitchen display/i })).toBeInTheDocument();
  });

  it('clicking the pencil button opens the edit modal', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument(),
    );
  });
});

describe('PlanApplicationsView — edit modal fields (AC 2)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('shows subscription plan name in a read-only input', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));

    await waitFor(() => expect(screen.getByDisplayValue('Gold Plan')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Gold Plan')).toHaveAttribute('readonly');
  });

  it('shows application name in a read-only input', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));

    await waitFor(() => expect(screen.getByDisplayValue('POS Core')).toBeInTheDocument());
    expect(screen.getByDisplayValue('POS Core')).toHaveAttribute('readonly');
  });

  it('pre-fills the limits textarea with the current value', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));

    await waitFor(() =>
      expect(
        screen.getByDisplayValue('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument(),
    );
  });

  it('pre-selects the Association Status dropdown with the current status', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /association status/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox', { name: /association status/i })).toHaveValue('active');
  });
});

describe('PlanApplicationsView — edit happy path (AC 3)', () => {
  it('on save: closes modal, updates row in grid, shows success toast', async () => {
    const user = userEvent.setup();
    const updatedPA: PlanApplication = {
      id: 1,
      subscriptionPlan: { id: 3, name: 'Gold Plan' },
      application: { id: 5, name: 'POS Core', category: 'Point of Sale' },
      limits: 'Updated limit',
      status: 'inactive',
    };
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.updatePlanApplication).mockResolvedValue(updatedPA);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument(),
    );

    await user.clear(screen.getByDisplayValue('Basic usage limit: 100 users per month'));
    await user.type(
      screen.getByPlaceholderText(/Up to 5 terminals/i),
      'Updated limit',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /association status/i }),
      'inactive',
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Plan-application updated successfully')).toBeInTheDocument();
      expect(screen.getByText('Updated limit')).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — edit error path', () => {
  it('on API error: closes modal and shows error toast', async () => {
    const user = userEvent.setup();
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    vi.mocked(saasService.updatePlanApplication).mockRejectedValue(
      new Error('Update failed'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument(),
    );

    await user.clear(screen.getByDisplayValue('Basic usage limit: 100 users per month'));
    await user.type(
      screen.getByPlaceholderText(/Up to 5 terminals/i),
      'Different limit',
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — edit submit disabled', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('SAVE CHANGES is disabled when limits field is cleared', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument(),
    );

    await user.clear(screen.getByDisplayValue('Basic usage limit: 100 users per month'));

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('SAVE CHANGES is disabled when no changes have been made', async () => {
    const user = userEvent.setup();
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => expect(screen.getByText('POS Core')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit pos core/i }));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument(),
    );

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run tests — verify 10 new tests fail, existing 33 still pass**

```bash
npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx
```

Expected: 33 existing tests PASS, 10 new tests FAIL (components/buttons not found yet).

- [ ] **Step 4: Commit failing tests**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.test.tsx
git commit -m "test: add failing tests for edit plan-application workflow (TDD red phase)"
```

---

### Task 3: Implement `EditPlanApplicationDialog` + grid wiring

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.tsx`

**Interfaces:**
- Consumes: `UpdatePlanApplicationDto` (Task 1); `saasService.updatePlanApplication` (Task 1); tests from Task 2
- Produces: working edit flow; all 43 tests green

---

- [ ] **Step 1: Add `EditPlanApplicationDialog` component**

Open `src/components/SaaSDashboard/PlanApplicationsView.tsx`. Insert the following new component immediately **before** the `AssociateAppDialog` interface declaration (before line 5 — before `interface AssociateAppDialogProps`):

```tsx
interface EditPlanApplicationDialogProps {
  pa: PlanApplication;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { limits: string; status: 'active' | 'inactive' }) => void;
}

const EditPlanApplicationDialog: React.FC<EditPlanApplicationDialogProps> = ({
  pa,
  submitting,
  onClose,
  onSave,
}) => {
  const initialStatus: 'active' | 'inactive' = pa.status === 'active' ? 'active' : 'inactive';
  const [limits, setLimits] = React.useState(pa.limits);
  const [status, setStatus] = React.useState<'active' | 'inactive'>(initialStatus);

  const limitsExceeded = limits.length > 50;
  const noChanges = limits === pa.limits && status === initialStatus;
  const isValid = limits.trim() !== '' && !limitsExceeded && !noChanges;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            EDIT PLAN-APPLICATION
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
              title="Subscription Plan"
              value={pa.subscriptionPlan.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Application
            </label>
            <input
              type="text"
              readOnly
              title="Application"
              value={pa.application.name}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#ece8e0] text-sm text-[#5f5e5e] cursor-not-allowed outline-none"
            />
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
          <div className="space-y-1.5">
            <label
              htmlFor="edit-status-select"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Association Status
            </label>
            <select
              id="edit-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
              onClick={() => onSave({ limits: limits.trim(), status })}
              disabled={!isValid || submitting}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Saving…' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add `editingPA` and `editSubmitting` state to `PlanApplicationsView`**

Inside `PlanApplicationsView` component body, after the `associateSubmitting` state declaration (around line 164), add:

```ts
const [editingPA, setEditingPA] = useState<PlanApplication | null>(null);
const [editSubmitting, setEditSubmitting] = useState(false);
```

- [ ] **Step 3: Add `handleEdit` handler**

After the `handleAssociate` function (around line 230), add:

```ts
const handleEdit = async (dto: { limits: string; status: 'active' | 'inactive' }) => {
  setEditSubmitting(true);
  try {
    const updated = await saasService.updatePlanApplication(editingPA!.id, dto);
    setPlanApplications((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPA(null);
    setToast({ message: 'Plan-application updated successfully', type: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update plan-application';
    setEditingPA(null);
    if (msg === 'SESSION_EXPIRED') {
      setToast({
        message: 'Session expired. Please refresh the page to sign in again.',
        type: 'error',
      });
    } else {
      setToast({ message: msg, type: 'error' });
    }
  } finally {
    setEditSubmitting(false);
  }
};
```

- [ ] **Step 4: Add Actions column to `<thead>`**

Find the `<thead>` in `PlanApplicationsView.tsx`. After the Association Status `<th>` (the last `<th>` in the header row), add:

```tsx
<th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
  Actions
</th>
```

- [ ] **Step 5: Add `group` class to data rows and pencil `<td>`**

Find the data row `<tr>` inside `filteredApplications.map(...)`. Change it from:

```tsx
<tr
  key={pa.id}
  className="hover:bg-[#f8f3eb] transition-colors"
>
```

to:

```tsx
<tr
  key={pa.id}
  className="group hover:bg-[#f8f3eb] transition-colors"
>
```

Then, after the Association Status `<td>` (the last `<td>` in each data row), add:

```tsx
<td className="px-6 py-4 text-center">
  <button
    type="button"
    aria-label={`Edit ${pa.application.name}`}
    onClick={() => setEditingPA(pa)}
    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5f5e5e] hover:text-[#ae001a]"
  >
    <span className="material-symbols-outlined text-[20px]">edit</span>
  </button>
</td>
```

- [ ] **Step 6: Add empty `<td>` to skeleton rows**

Find the skeleton row `<tr>` blocks (the `[1, 2, 3].map(...)` section). Each skeleton row currently has 4 `<td>`. Add an empty fifth `<td>` for the Actions column:

```tsx
<td className="px-6 py-4" />
```

(Add this after the last skeleton `<td>` in each skeleton row.)

- [ ] **Step 7: Mount `EditPlanApplicationDialog` in JSX**

Find where `AssociateAppDialog` is mounted (around line 468). Immediately after its closing `)}`, add:

```tsx
{editingPA && (
  <EditPlanApplicationDialog
    pa={editingPA}
    submitting={editSubmitting}
    onClose={() => setEditingPA(null)}
    onSave={handleEdit}
  />
)}
```

- [ ] **Step 8: Run tests — verify all 43 pass**

```bash
npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx
```

Expected output: **43 tests pass, 0 fail.**

If any test fails, read the error carefully. Common issues:
- `getByDisplayValue('POS Core')` matches more than one element → scope to `within(modal)` using `screen.getByRole('dialog')` or a wrapping element.
- `getByRole('button', { name: /save changes/i })` not found → check that button text is exactly `'SAVE CHANGES'` and the matcher is case-insensitive.

- [ ] **Step 9: Run full test suite**

```bash
npx vitest run
```

Expected: all tests across the project pass.

- [ ] **Step 10: Commit implementation**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.tsx
git commit -m "feat: add EditPlanApplicationDialog with pencil-on-hover and PATCH support"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| AC 1: Actions column + pencil icon, opacity-0 → group-hover:opacity-100 | Task 3 steps 4-5 |
| AC 2: Edit modal with limits pre-filled, plan/app read-only | Task 3 step 1 |
| AC 2: Status select pre-filled | Task 3 step 1 |
| AC 3: PATCH dispatch via service | Task 1 step 2 + Task 3 step 3 |
| AC 3: Instant grid row update via `prev.map` | Task 3 step 3 |
| AC 3: Success toast | Task 3 step 3 |
| SESSION_EXPIRED error path | Task 3 step 3 |
| Dirty-check (no PATCH when unchanged) | Task 3 step 1 (`noChanges` guard) |
| `limits` max 50 chars | Task 3 step 1 (`limitsExceeded` guard) |
| Skeleton row Actions column alignment | Task 3 step 6 |
| `UpdatePlanApplicationDto` type | Task 1 step 1 |
| ~10 new tests | Task 2 |

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.

**Type consistency:** `UpdatePlanApplicationDto` defined in Task 1 step 1; imported in service Task 1 step 2; `handleEdit` in Task 3 step 3 uses `{ limits: string; status: 'active' | 'inactive' }` which matches the DTO exactly. `onSave` prop type in `EditPlanApplicationDialogProps` matches `handleEdit`'s parameter type.
