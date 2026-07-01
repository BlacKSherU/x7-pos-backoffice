# Create Feature — Feature Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create Feature" modal workflow to `PlatformFeatureCatalogView` — triggered by a "+ CREATE FEATURE" button in the filter strip and a FAB — that POSTs to `features` and prepends the new row to the table.

**Architecture:** Two tasks in dependency order: (1) add `createFeature()` to `saasService`, (2) add `Toast` + `CreateFeatureDialog` inline components, state, handler, filter-strip button, and FAB to `PlatformFeatureCatalogView`. Pattern is identical to `RegisterAppDialog` in `PlatformApplicationsView`.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind v4, `saasService` fetch abstraction.

## Global Constraints

- Design tokens: `#222222` (dark header), `#ae001a` (red accent), `#e8e2d8` (border), `#fef9f1` (input bg), `#5f5e5e` (muted text), `#f2ede5` (hover bg)
- Backend field name is capital-U `Unit` — never lowercase
- `status` is always `"active"` in the POST payload; not shown in the form (AC 3)
- On error: modal CLOSES, red toast shown — matches `PlatformApplicationsView` pattern exactly
- Modal submit button label: `"Create Feature"` (not "Save Changes")
- Filter strip button aria-label: `"Create Feature"`
- FAB aria-label: `"Open create-feature form"`
- Toast auto-dismisses after 3000 ms
- No new files — all additions go into the two existing files

---

### Task 1: `createFeature` service method

**Files:**
- Modify: `src/services/saasService.ts` (after `getFeatures`, before the closing `};`)

**Interfaces:**
- Consumes: `saasApiFetch<T>` (already in file), `PlatformFeature` type (already imported)
- Produces:
  ```ts
  saasService.createFeature(dto: {
    name: string;
    description: string;
    Unit: string;
    status: string;
  }): Promise<PlatformFeature>
  ```

- [ ] **Step 1: Write the failing test**

There is no dedicated service test file. The service method will be tested via the component integration test in Task 2 (mocked). For Task 1, verify the method exists and TypeScript compiles — run the full suite to confirm nothing is broken.

- [ ] **Step 2: Add `createFeature` to `saasService.ts`**

Open `src/services/saasService.ts`. After the `getFeatures` method (line ~312) and before the closing `};`, add:

```ts
  async createFeature(dto: {
    name: string;
    description: string;
    Unit: string;
    status: string;
  }): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      'features',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );
    return response.data;
  },
```

The full tail of the file should look like:

```ts
  async getFeatures(): Promise<PlatformFeature[]> {
    const response = await saasApiFetch<{
      data: PlatformFeature[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>('features');
    return response.data;
  },

  async createFeature(dto: {
    name: string;
    description: string;
    Unit: string;
    status: string;
  }): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      'features',
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    );
    return response.data;
  },
};
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests pass (currently 156+).

- [ ] **Step 4: Commit**

```bash
git add src/services/saasService.ts
git commit -m "feat: add createFeature service method"
```

---

### Task 2: Create Feature UI — dialog, toast, filter-strip button, FAB

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`

**Interfaces:**
- Consumes: `saasService.createFeature(dto)` from Task 1
- Consumes: `PlatformFeature` type (already imported in both files)

#### Part A — update the vi.mock in the test file

The existing mock in `PlatformFeatureCatalogView.test.tsx` only mocks `getFeatures`. Add `createFeature` to it.

- [ ] **Step 1: Update vi.mock and add NEW_FEATURE constant**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`.

Change the `vi.mock` block (currently lines 8-12) from:
```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
  },
}));
```

to:
```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
    createFeature: vi.fn(),
  },
}));
```

After the `MOCK_FEATURES` constant (after the closing `];`), add:

```ts
const NEW_FEATURE: PlatformFeature = {
  id: 99,
  name: 'New Test Feature',
  description: 'A freshly created test feature.',
  Unit: 'unit',
  status: 'active',
};
```

- [ ] **Step 2: Run existing tests to confirm mock change didn't break anything**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: 36/36 pass.

#### Part B — write failing tests for the new behavior

- [ ] **Step 3: Append the new test suites to the test file**

Add at the very end of `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`:

```ts
describe('PlatformFeatureCatalogView — Create Feature entry points', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('renders the "+ CREATE FEATURE" button in the filter strip', async () => {
    render(<PlatformFeatureCatalogView />);
    expect(
      await screen.findByRole('button', { name: 'Create Feature' }),
    ).toBeInTheDocument();
  });

  it('clicking "+ CREATE FEATURE" opens the modal', async () => {
    render(<PlatformFeatureCatalogView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Create Feature' }));
    expect(screen.getByText('CREATE FEATURE')).toBeInTheDocument();
  });

  it('renders the FAB button', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    expect(screen.getByRole('button', { name: 'Open create-feature form' })).toBeInTheDocument();
  });

  it('clicking the FAB opens the modal', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Open create-feature form' }));
    expect(screen.getByText('CREATE FEATURE')).toBeInTheDocument();
  });
});

describe('PlatformFeatureCatalogView — Create Feature modal validation', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  async function openModal() {
    render(<PlatformFeatureCatalogView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Create Feature' }));
  }

  it('modal renders Name, Description, and Unit fields', async () => {
    await openModal();
    expect(screen.getByPlaceholderText('Feature name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Feature description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. unit, user, gb')).toBeInTheDocument();
  });

  it('submit button is disabled when fields are empty', async () => {
    await openModal();
    expect(screen.getByRole('button', { name: /create feature/i })).toBeDisabled();
  });

  it('submit button is enabled when all fields are filled', async () => {
    await openModal();
    await userEvent.type(screen.getByPlaceholderText('Feature name'), 'My Feature');
    await userEvent.type(screen.getByPlaceholderText('Feature description'), 'Some description');
    await userEvent.type(screen.getByPlaceholderText('e.g. unit, user, gb'), 'unit');
    expect(screen.getByRole('button', { name: /create feature/i })).toBeEnabled();
  });

  it('name counter turns red and submit is disabled when name exceeds 100 chars', async () => {
    await openModal();
    await userEvent.type(screen.getByPlaceholderText('Feature name'), 'A'.repeat(101));
    await userEvent.type(screen.getByPlaceholderText('Feature description'), 'desc');
    await userEvent.type(screen.getByPlaceholderText('e.g. unit, user, gb'), 'unit');
    expect(screen.getByRole('button', { name: /create feature/i })).toBeDisabled();
  });

  it('unit counter turns red and submit is disabled when unit exceeds 50 chars', async () => {
    await openModal();
    await userEvent.type(screen.getByPlaceholderText('Feature name'), 'Valid Name');
    await userEvent.type(screen.getByPlaceholderText('Feature description'), 'desc');
    await userEvent.type(screen.getByPlaceholderText('e.g. unit, user, gb'), 'U'.repeat(51));
    expect(screen.getByRole('button', { name: /create feature/i })).toBeDisabled();
  });

  it('clicking Cancel closes the modal', async () => {
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('CREATE FEATURE')).not.toBeInTheDocument();
  });
});

describe('PlatformFeatureCatalogView — Create Feature submit', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  async function fillAndSubmit() {
    render(<PlatformFeatureCatalogView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Create Feature' }));
    await userEvent.type(screen.getByPlaceholderText('Feature name'), NEW_FEATURE.name);
    await userEvent.type(screen.getByPlaceholderText('Feature description'), NEW_FEATURE.description);
    await userEvent.type(screen.getByPlaceholderText('e.g. unit, user, gb'), NEW_FEATURE.Unit);
    await userEvent.click(screen.getByRole('button', { name: /create feature/i }));
  }

  it('on success: modal closes, new feature prepended, success toast shown', async () => {
    vi.mocked(saasService.createFeature).mockResolvedValue(NEW_FEATURE);
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.queryByText('CREATE FEATURE')).not.toBeInTheDocument();
      expect(screen.getByText('New Test Feature')).toBeInTheDocument();
      expect(screen.getByText('Feature created successfully')).toBeInTheDocument();
    });
  });

  it('createFeature is called with correct payload including status active', async () => {
    vi.mocked(saasService.createFeature).mockResolvedValue(NEW_FEATURE);
    await fillAndSubmit();
    await waitFor(() => {
      expect(saasService.createFeature).toHaveBeenCalledWith({
        name: NEW_FEATURE.name,
        description: NEW_FEATURE.description,
        Unit: NEW_FEATURE.Unit,
        status: 'active',
      });
    });
  });

  it('SESSION_EXPIRED: modal closes, session-expired toast shown', async () => {
    vi.mocked(saasService.createFeature).mockRejectedValue(new Error('SESSION_EXPIRED'));
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.queryByText('CREATE FEATURE')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('API error: modal closes, error message toast shown', async () => {
    vi.mocked(saasService.createFeature).mockRejectedValue(
      new Error('Feature name already exists'),
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.queryByText('CREATE FEATURE')).not.toBeInTheDocument();
      expect(screen.getByText('Feature name already exists')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 4: Run new tests to confirm they fail**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: new suites FAIL (modal not yet implemented). Existing 36 tests still pass.

#### Part C — implement the UI

- [ ] **Step 5: Add `Toast` and `CreateFeatureDialog` components to the view file**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`.

After the imports (after line 4 `import type { PlatformFeature }...`) and before the `fuzzyMatch` function, add the two inline components:

```tsx
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
      {toast.type === 'success' ? 'check_circle' : 'report'}
    </span>
    {toast.message}
    <button type="button" onClick={onDismiss} className="ml-2 text-white/70 hover:text-white">
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  </div>
);

interface CreateFeatureDialogProps {
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { name: string; description: string; Unit: string }) => void;
}

const CreateFeatureDialog: React.FC<CreateFeatureDialogProps> = ({ submitting, onClose, onSave }) => {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [unit, setUnit] = React.useState('');

  const nameExceeded = name.length > 100;
  const unitExceeded = unit.length > 50;
  const isValid =
    name.trim() !== '' &&
    description.trim() !== '' &&
    unit.trim() !== '' &&
    !nameExceeded &&
    !unitExceeded;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl">
        <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            CREATE FEATURE
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
              placeholder="Feature name"
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
              placeholder="Feature description"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Unit
              </label>
              <span className={`text-[11px] ${unitExceeded ? 'text-[#ae001a] font-bold' : 'text-[#5f5e5e]'}`}>
                {unit.length}/50
              </span>
            </div>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={`w-full px-3 py-2 border bg-[#fef9f1] text-sm text-[#1d1c17] focus:ring-1 outline-none transition-all ${
                unitExceeded
                  ? 'border-[#ae001a] focus:border-[#ae001a] focus:ring-[#ae001a]'
                  : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-[#ae001a]'
              }`}
              placeholder="e.g. unit, user, gb"
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
              onClick={() => onSave({ name: name.trim(), description: description.trim(), Unit: unit.trim() })}
              disabled={submitting || !isValid}
              className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {submitting ? 'Creating...' : 'Create Feature'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Add state, effect, and handler to the main component**

Inside `PlatformFeatureCatalogView` (after the existing `useState` declarations for `statusFilter`), add:

```tsx
  const [isCreating, setIsCreating] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```

After the existing `useEffect` (the one that calls `saasService.getFeatures()`), add the toast auto-dismiss effect:

```tsx
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
```

After the `hasActiveFilter` line, add the handler:

```tsx
  const handleCreateSave = async (dto: { name: string; description: string; Unit: string }) => {
    setCreateSubmitting(true);
    try {
      const newFeature = await saasService.createFeature({ ...dto, status: 'active' });
      setFeatures((prev) => [newFeature, ...prev]);
      setIsCreating(false);
      setToast({ message: 'Feature created successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create feature';
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

- [ ] **Step 7: Add "+ CREATE FEATURE" button to the filter strip**

In the filter strip `<div>` (currently ends with the conditional `{hasActiveFilter && ...}` Clear Filters button), add the Create Feature button AFTER the Clear Filters button and before the closing `</div>`:

```tsx
        <button
          type="button"
          aria-label="Create Feature"
          onClick={() => setIsCreating(true)}
          className="ml-auto px-4 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          CREATE FEATURE
        </button>
```

**Important:** Remove `ml-auto` from the Clear Filters button (it currently has `ml-auto`). The Create Feature button now carries `ml-auto` to push it to the right. The Clear Filters button sits immediately before it.

The full updated filter strip `<div className="bg-white border-b ...">` should have this child order:
1. Search input wrapper
2. Unit select
3. Status select
4. `{hasActiveFilter && <button>Clear Filters</button>}` — NO `ml-auto`
5. `<button aria-label="Create Feature" ... className="ml-auto ...">CREATE FEATURE</button>`

- [ ] **Step 8: Add Toast, FAB, and modal wire-up to the main return**

The main return currently opens with `<>`. Update it to:

```tsx
  return (
    <>
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      <div className="space-y-0 border border-[#e8e2d8] overflow-hidden">
        {/* filter strip, header block, rows — unchanged */}
      </div>

      {/* Quick Launch — unchanged */}

      {/* FAB */}
      <button
        type="button"
        aria-label="Open create-feature form"
        onClick={() => setIsCreating(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Modal */}
      {isCreating && (
        <CreateFeatureDialog
          submitting={createSubmitting}
          onClose={() => setIsCreating(false)}
          onSave={handleCreateSave}
        />
      )}
    </>
  );
```

- [ ] **Step 9: Run tests — all must pass**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: all tests pass (36 existing + ~13 new = ~49 total).

- [ ] **Step 10: Run the full suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "feat: add Create Feature modal, Toast, FAB, and filter-strip button to Feature Catalog"
```
