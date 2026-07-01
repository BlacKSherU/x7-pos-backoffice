# Register Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the SaaS Owner to register a new platform application via a creation modal opened from a primary button in the filter strip or a FAB.

**Architecture:** All changes are self-contained in `PlatformApplicationsView.tsx` and `saasService.ts`. `RegisterAppDialog` follows the exact same pattern as the existing `EditAppDialog` and `DeactivateAppDialog` components. The FAB is a `fixed` element inside the view component (not in the shell), matching the existing toast/modal fixed-positioning pattern.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest, React Testing Library, `@testing-library/user-event`

## Global Constraints

- All copy (button labels, modal header, toast messages) must match the spec verbatim.
- Status defaults to `"active"` in the creation form.
- PATCH payload for `updateApplication` (already implemented) and POST payload for `createApplication` must always include all four fields: `name`, `description`, `category`, `status`.
- Character limits: `name` max 100, `category` max 50.
- Test file mock block must include every `saasService` method the component calls: `getApplications`, `toggleApplicationInactive`, `updateApplication`, `createApplication`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/services/saasService.ts` | Modify | Add `createApplication` POST method |
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | Modify | Add `RegisterAppDialog`, state, handler, button, FAB |
| `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` | Modify | Fix 5 stale assertions + expand mock + add 11 new tests |

---

### Task 1: Fix stale test assertions and expand service mock

Previous edits in this branch changed several UI strings. Five test assertions now reference outdated copy and the vi.mock is missing two service methods the component already calls. Fix this before adding new code.

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`

**Interfaces:**
- Produces: a fully green test suite (0 failures) before any new feature code is written.

- [ ] **Step 1: Update the vi.mock block to include all four service methods**

Replace the entire `vi.mock` block at the top of the file (lines 8-13):

```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getApplications: vi.fn(),
    toggleApplicationInactive: vi.fn(),
    updateApplication: vi.fn(),
    createApplication: vi.fn(),
  },
}));
```

- [ ] **Step 2: Fix the heading assertion (line 52)**

```ts
// Before
expect(screen.getByText('PLATFORM APPLICATIONS')).toBeInTheDocument();
// After
expect(screen.getByText('PLATFORM APPLICATION MASTER DIRECTORY')).toBeInTheDocument();
```

- [ ] **Step 3: Fix the empty-state text assertion (line 127)**

```ts
// Before
expect(screen.getByText('No Applications Configured')).toBeInTheDocument();
// After
expect(
  screen.getByText(
    "No applications have been registered in the system. Click 'Register Application' to deploy your first software module.",
  ),
).toBeInTheDocument();
```

- [ ] **Step 4: Fix the empty-state "table hidden" assertion (line 135)**

```ts
// Before
expect(screen.queryByText('PLATFORM APPLICATIONS')).not.toBeInTheDocument();
// After
expect(screen.queryByText('PLATFORM APPLICATION MASTER DIRECTORY')).not.toBeInTheDocument();
```

- [ ] **Step 5: Fix both no-results assertions (lines 197 and 206)**

```ts
// Both occurrences: before
'No applications match your search filters'
// After
'No applications match your filtering criteria'
```

- [ ] **Step 6: Run the full test suite and confirm 0 failures**

```
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: all existing tests pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
git commit -m "test: fix stale assertions and expand service mock after UI string updates"
```

---

### Task 2: `createApplication` service method

**Files:**
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Consumes: `saasApiFetch<T>` (already in the file), `Application` type from `../../types/subscription`
- Produces: `saasService.createApplication(dto): Promise<Application>` — used in Task 3

- [ ] **Step 1: Add `createApplication` after `toggleApplicationInactive` in the `saasService` object**

Open `src/services/saasService.ts`. After the closing brace of `toggleApplicationInactive`, add:

```ts
  async createApplication(dto: {
    name: string;
    description: string;
    category: string;
    status: 'active' | 'inactive';
  }): Promise<Application> {
    const response = await saasApiFetch<{ data: Application }>(
      'applications',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );
    return response.data;
  },
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/saasService.ts
git commit -m "feat: add createApplication POST method to saasService"
```

---

### Task 3: RegisterAppDialog, state, handler, entry points, and tests

Full TDD cycle: write all failing tests first, then implement until all pass.

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.tsx`
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`

**Interfaces:**
- Consumes: `saasService.createApplication` from Task 2
- Consumes: `Application` type (`{ id, name, description, category, status }`)
- Produces: fully functional Register Application feature visible in the UI

---

#### 3a — Write the failing tests

- [ ] **Step 1: Add a new `describe` block at the bottom of `PlatformApplicationsView.test.tsx`**

```ts
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
    expect(screen.getByRole('button', { name: /register application/i })).toBeInTheDocument();
  });

  it('renders the FAB register button', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /open register application form/i })).toBeInTheDocument();
  });

  it('clicking REGISTER APPLICATION opens the creation modal', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /register application/i }));

    expect(screen.getByText('REGISTER APPLICATION')).toBeInTheDocument();
  });

  it('clicking the FAB opens the creation modal', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /open register application form/i }));

    expect(screen.getByText('REGISTER APPLICATION')).toBeInTheDocument();
  });

  it('modal form renders name, description, category fields and status select', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /register application/i }));

    expect(screen.getByPlaceholderText('Application name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Application description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. POS Core, Utility, Kitchen Display')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
  });

  it('Save Changes is disabled when name is empty', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /register application/i }));

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('Save Changes is disabled when category is empty', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /register application/i }));

    await user.type(screen.getByPlaceholderText('Application name'), 'Test App');
    await user.type(screen.getByPlaceholderText('Application description'), 'A description');
    // category left empty

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('name field exceeding 100 characters disables Save Changes', async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(screen.getByText('POS Terminal')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /register application/i }));

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

    await user.click(screen.getByRole('button', { name: /register application/i }));

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

    await user.click(screen.getByRole('button', { name: /register application/i }));
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

    await user.click(screen.getByRole('button', { name: /register application/i }));
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

    await user.click(screen.getByRole('button', { name: /register application/i }));
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

    await user.click(screen.getByRole('button', { name: /register application/i }));
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
```

- [ ] **Step 2: Run tests to confirm all 11 new tests fail**

```
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: existing tests pass, 11 new tests FAIL.

---

#### 3b — Implement RegisterAppDialog

- [ ] **Step 3: Add the `RegisterAppDialog` component to `PlatformApplicationsView.tsx`**

Add this component directly above `interface DeactivateAppDialogProps` (which itself is above `const DeactivateAppDialog`):

```tsx
interface RegisterAppDialogProps {
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { name: string; description: string; category: string; status: 'active' | 'inactive' }) => void;
}

const RegisterAppDialog: React.FC<RegisterAppDialogProps> = ({ submitting, onClose, onSave }) => {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [status, setStatus] = React.useState<'active' | 'inactive'>('active');

  const nameExceeded = name.length > 100;
  const categoryExceeded = category.length > 50;
  const isValid =
    name.trim() !== '' &&
    description.trim() !== '' &&
    category.trim() !== '' &&
    !nameExceeded &&
    !categoryExceeded;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            REGISTER APPLICATION
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
            <div className="flex justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Name
              </label>
              <span className={`text-[11px] ${nameExceeded ? 'text-[#ae001a] font-bold' : 'text-[#5f5e5e]'}`}>
                {name.length}/100
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border bg-[#fef9f1] text-sm text-[#1d1c17] focus:ring-1 outline-none transition-all ${
                nameExceeded
                  ? 'border-[#ae001a] focus:border-[#ae001a] focus:ring-[#ae001a]'
                  : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-[#ae001a]'
              }`}
              placeholder="Application name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none transition-all resize-none"
              placeholder="Application description"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Category
              </label>
              <span className={`text-[11px] ${categoryExceeded ? 'text-[#ae001a] font-bold' : 'text-[#5f5e5e]'}`}>
                {category.length}/50
              </span>
            </div>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full px-3 py-2 border bg-[#fef9f1] text-sm text-[#1d1c17] focus:ring-1 outline-none transition-all ${
                categoryExceeded
                  ? 'border-[#ae001a] focus:border-[#ae001a] focus:ring-[#ae001a]'
                  : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-[#ae001a]'
              }`}
              placeholder="e.g. POS Core, Utility, Kitchen Display"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="register-status"
              className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
            >
              Status
            </label>
            <select
              id="register-status"
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
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
              onClick={() => onSave({ name: name.trim(), description: description.trim(), category: category.trim(), status })}
              disabled={submitting || !isValid}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add `isCreating` and `createSubmitting` state to `PlatformApplicationsView`**

Inside the component, after the `editSubmitting` state line:

```ts
const [isCreating, setIsCreating] = useState(false);
const [createSubmitting, setCreateSubmitting] = useState(false);
```

- [ ] **Step 5: Add `handleCreateSave` handler**

After the `handleEditSave` function, before `handleToggleConfirm`:

```ts
const handleCreateSave = async (dto: {
  name: string;
  description: string;
  category: string;
  status: 'active' | 'inactive';
}) => {
  setCreateSubmitting(true);
  try {
    const newApp = await saasService.createApplication(dto);
    setApplications((prev) => [newApp, ...prev]);
    setIsCreating(false);
    setToast({ message: 'Application registered successfully', type: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to register application';
    setIsCreating(false);
    if (msg === 'SESSION_EXPIRED') {
      setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
    } else {
      setToast({ message: msg, type: 'error' });
    }
  } finally {
    setCreateSubmitting(false);
  }
};
```

- [ ] **Step 6: Add the "REGISTER APPLICATION" button to the filter strip**

Inside the filter strip `<div className="flex items-center gap-3 flex-shrink-0">`, after the "Clear filters" button:

```tsx
<button
  type="button"
  onClick={() => setIsCreating(true)}
  className="px-4 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
>
  <span className="material-symbols-outlined text-base">add</span>
  Register Application
</button>
```

- [ ] **Step 7: Add the FAB inside the component's return, before the `{editingApp && ...}` block**

```tsx
<button
  type="button"
  aria-label="Open register application form"
  onClick={() => setIsCreating(true)}
  className="fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50"
>
  <span className="material-symbols-outlined text-3xl">add</span>
</button>
```

- [ ] **Step 8: Render `RegisterAppDialog` inside the component's return**

After the FAB and before `{editingApp && ...}`:

```tsx
{isCreating && (
  <RegisterAppDialog
    submitting={createSubmitting}
    onClose={() => setIsCreating(false)}
    onSave={handleCreateSave}
  />
)}
```

- [ ] **Step 9: Run the full test suite — all tests must pass**

```
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: all tests pass, 0 failures.

- [ ] **Step 10: Verify TypeScript compiles clean**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/SaaSDashboard/PlatformApplicationsView.tsx src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
git commit -m "feat: register application modal with validation, FAB, and primary button"
```
