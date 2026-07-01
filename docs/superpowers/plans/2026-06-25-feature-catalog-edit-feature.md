# Edit Feature — Platform Feature Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline Edit button per table row that opens a pre-filled modal to update a feature's name, description, and Unit via PATCH, then instantly reflects changes in the grid with a success toast.

**Architecture:** Three-layer change — service method, view component, tests. `EditFeatureDialog` mirrors `CreateFeatureDialog` and is declared in the same file. The Actions column uses Tailwind's existing `group-hover` pattern for visibility. State is managed in the parent `PlatformFeatureCatalogView` component with optimistic local update on success.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, React Testing Library, `@testing-library/user-event`, Material Symbols icons.

## Global Constraints

- All Tailwind classes must use the project's existing tokens: `#ae001a` (brand red), `#1d1c17` (text), `#5f5e5e` (muted), `#e8e2d8` (border), `#f2ede5` / `#fef9f1` (surface), `#ece8e0` (header bg), `#222222` (modal header).
- Icon set: `material-symbols-outlined` only — class on `<span>`, text content is the icon name.
- All form inputs must be `type="button"` submit controls (no `<form>` submit events).
- `Unit` field key is capitalized (`Unit`) in the DTO and in `PlatformFeature` type — never lowercase `unit`.
- Test runner: `npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`.
- No backend changes needed — `PATCH /features/:id` is already implemented.

---

## File Map

| File | Change |
| --- | --- |
| `src/services/saasService.ts` | Add `updateFeature` method after `createFeature` |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` | Add `EditFeatureDialog`, Actions column, state + handler |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` | Add `updateFeature` mock + 7 new test cases |

---

### Task 1: Add `updateFeature` to `saasService.ts`

**Files:**
- Modify: `src/services/saasService.ts:314-328` (after `createFeature`, before the closing `};`)

**Interfaces:**
- Produces: `saasService.updateFeature(id: number, dto: { name: string; description: string; Unit: string }): Promise<PlatformFeature>`

- [ ] **Step 1: Write the failing test (add to the mock and add a new describe block)**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`.

Change the mock object at line 8-13 to include `updateFeature`:

```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
    createFeature: vi.fn(),
    updateFeature: vi.fn(),
  },
}));
```

Add this test at the **end** of the file (after the last `});`):

```ts
describe('PlatformFeatureCatalogView — Edit Feature service', () => {
  it('saasService.updateFeature is defined in the mock', () => {
    expect(saasService.updateFeature).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes (mock existence check)**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: all existing tests pass; new test passes.

- [ ] **Step 3: Implement `updateFeature` in `saasService.ts`**

Open `src/services/saasService.ts`. Locate the `createFeature` method (ends around line 328 with `return response.data;`). Insert the new method **immediately after** it, before the closing `};` of the service object:

```ts
  async updateFeature(
    id: number,
    dto: { name: string; description: string; Unit: string },
  ): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      `features/${id}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
    return response.data;
  },
```

- [ ] **Step 4: Run the test again to confirm everything still passes**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/services/saasService.ts src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "feat: add updateFeature service method and mock"
```

---

### Task 2: Add `EditFeatureDialog` component

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` — insert new component after `CreateFeatureDialog` (after line 147)

**Interfaces:**
- Consumes: `PlatformFeature` from `../../types/subscription`
- Produces: `EditFeatureDialog` React component used in Task 3

- [ ] **Step 1: Write the failing tests for the modal**

Add this describe block at the end of `PlatformFeatureCatalogView.test.tsx`:

```ts
describe('PlatformFeatureCatalogView — Edit Feature modal', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  async function openEditModal() {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    const editBtn = screen.getAllByRole('button', { name: /edit advanced analytics/i })[0];
    await userEvent.click(editBtn);
  }

  it('renders the Actions column header', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('renders an Edit button for each feature row', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      const editBtns = screen.getAllByRole('button', { name: /edit/i }).filter(
        (b) => b.getAttribute('aria-label')?.startsWith('Edit '),
      );
      expect(editBtns).toHaveLength(3);
    });
  });

  it('clicking Edit opens the modal with EDIT FEATURE header', async () => {
    await openEditModal();
    expect(screen.getByText('EDIT FEATURE')).toBeInTheDocument();
  });

  it('modal is pre-filled with the feature current values', async () => {
    await openEditModal();
    expect(screen.getByDisplayValue('Advanced Analytics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Provides advanced data analytics capabilities.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('user')).toBeInTheDocument();
  });

  it('clicking Cancel closes the modal without saving', async () => {
    await openEditModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('EDIT FEATURE')).not.toBeInTheDocument();
    expect(saasService.updateFeature).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm the new tests FAIL**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: new tests fail (Actions column and modal don't exist yet). All previous tests still pass.

- [ ] **Step 3: Add `EditFeatureDialog` to `PlatformFeatureCatalogView.tsx`**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`. After the closing `};` of `CreateFeatureDialog` (line 147), insert the new component:

```tsx
interface EditFeatureDialogProps {
  feature: PlatformFeature;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { name: string; description: string; Unit: string }) => void;
}

const EditFeatureDialog: React.FC<EditFeatureDialogProps> = ({ feature, submitting, onClose, onSave }) => {
  const [name, setName] = React.useState(feature.name);
  const [description, setDescription] = React.useState(feature.description);
  const [unit, setUnit] = React.useState(feature.Unit);

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
            EDIT FEATURE
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
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add Actions column header to `<thead>`**

In `PlatformFeatureCatalogView.tsx`, locate the `<thead>` block. After the `<th>` for Status (around line 323), add:

```tsx
                  <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Actions
                  </th>
```

- [ ] **Step 5: Add empty Actions `<td>` to skeleton rows**

In the loading skeleton section (the `[1, 2, 3].map((i) => (` block), each `<tr>` has 4 `<td>`. Add a fifth after the Status skeleton `<td>`:

```tsx
                      <td className="px-6 py-4 text-center">
                        <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-12 mx-auto" />
                      </td>
```

- [ ] **Step 6: Update the no-results `colSpan` from 4 to 5**

Find `colSpan={4}` in the empty filter results row and change it to `colSpan={5}`.

- [ ] **Step 7: Add Edit button `<td>` to each data row**

Inside the `filteredFeatures.map((feature) => (` block, after the Status `<td>` (after the closing `</td>` of the status cell, before the closing `</tr>`), add:

```tsx
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          aria-label={`Edit ${feature.name}`}
                          onClick={() => setEditingFeature(feature)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-3 py-1 border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] hover:border-[#ae001a] hover:text-[#ae001a]"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          Edit
                        </button>
                      </td>
```

- [ ] **Step 8: Add state and `EditFeatureDialog` render to parent component**

At the top of `PlatformFeatureCatalogView`, after the existing state declarations, add:

```ts
  const [editingFeature, setEditingFeature] = useState<PlatformFeature | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
```

At the end of the JSX return (alongside the existing `{isCreating && <CreateFeatureDialog ... />}` block), add:

```tsx
      {editingFeature && (
        <EditFeatureDialog
          feature={editingFeature}
          submitting={editSubmitting}
          onClose={() => setEditingFeature(null)}
          onSave={handleEditSave}
        />
      )}
```

Note: `handleEditSave` will be added in Task 3. TypeScript will flag this — it's expected at this step.

- [ ] **Step 9: Run the modal tests**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: the modal tests from Step 1 now pass. `handleEditSave` missing will cause a TS error — fix by adding a stub temporarily if needed:

```ts
  const handleEditSave = async (_dto: { name: string; description: string; Unit: string }) => {};
```

- [ ] **Step 10: Commit**

```
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx
git commit -m "feat: add EditFeatureDialog and Actions column to Feature Catalog"
```

---

### Task 3: Wire `handleEditSave` and submit tests

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` — replace stub handler with real implementation
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` — add submit tests

**Interfaces:**
- Consumes: `saasService.updateFeature(id: number, dto: { name: string; description: string; Unit: string }): Promise<PlatformFeature>`
- Consumes: `editingFeature: PlatformFeature | null` (Task 2 state)

- [ ] **Step 1: Write the failing submit tests**

Add this describe block at the end of `PlatformFeatureCatalogView.test.tsx`:

```ts
describe('PlatformFeatureCatalogView — Edit Feature submit', () => {
  const UPDATED_FEATURE: PlatformFeature = {
    id: 1,
    name: 'Advanced Analytics v2',
    description: 'Updated description.',
    Unit: 'user',
    status: 'active',
  };

  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  async function openAndSubmitEdit() {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    const editBtn = screen.getAllByRole('button', { name: /edit advanced analytics/i })[0];
    await userEvent.click(editBtn);
    const nameInput = screen.getByDisplayValue('Advanced Analytics');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, UPDATED_FEATURE.name);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
  }

  it('on success: modal closes, row updated in grid, success toast shown', async () => {
    vi.mocked(saasService.updateFeature).mockResolvedValue(UPDATED_FEATURE);
    await openAndSubmitEdit();
    await waitFor(() => {
      expect(screen.queryByText('EDIT FEATURE')).not.toBeInTheDocument();
      expect(screen.getByText('Advanced Analytics v2')).toBeInTheDocument();
      expect(screen.getByText('Feature updated successfully')).toBeInTheDocument();
    });
  });

  it('updateFeature is called with the correct id and payload', async () => {
    vi.mocked(saasService.updateFeature).mockResolvedValue(UPDATED_FEATURE);
    await openAndSubmitEdit();
    await waitFor(() => {
      expect(saasService.updateFeature).toHaveBeenCalledWith(1, {
        name: UPDATED_FEATURE.name,
        description: 'Provides advanced data analytics capabilities.',
        Unit: 'user',
      });
    });
  });

  it('SESSION_EXPIRED: modal closes, session-expired toast shown', async () => {
    vi.mocked(saasService.updateFeature).mockRejectedValue(new Error('SESSION_EXPIRED'));
    await openAndSubmitEdit();
    await waitFor(() => {
      expect(screen.queryByText('EDIT FEATURE')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('API error: modal closes, error toast shown', async () => {
    vi.mocked(saasService.updateFeature).mockRejectedValue(new Error('Feature name already exists'));
    await openAndSubmitEdit();
    await waitFor(() => {
      expect(screen.queryByText('EDIT FEATURE')).not.toBeInTheDocument();
      expect(screen.getByText('Feature name already exists')).toBeInTheDocument();
    });
  });

  it('Save Changes button is disabled while submitting', async () => {
    vi.mocked(saasService.updateFeature).mockReturnValue(new Promise(() => {}));
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    const editBtn = screen.getAllByRole('button', { name: /edit advanced analytics/i })[0];
    await userEvent.click(editBtn);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });
});
```

- [ ] **Step 2: Run to confirm submit tests FAIL**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: the 5 new submit tests fail; all previous tests pass.

- [ ] **Step 3: Replace the stub handler with the real `handleEditSave`**

In `PlatformFeatureCatalogView.tsx`, replace the stub `handleEditSave` with:

```ts
  const handleEditSave = async (dto: { name: string; description: string; Unit: string }) => {
    if (!editingFeature) return;
    setEditSubmitting(true);
    try {
      const updated = await saasService.updateFeature(editingFeature.id, dto);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setEditingFeature(null);
      setToast({ message: 'Feature updated successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update feature';
      setEditingFeature(null);
      if (msg === 'SESSION_EXPIRED') {
        setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setEditSubmitting(false);
    }
  };
```

- [ ] **Step 4: Run all tests and confirm they pass**

```
npx vitest run src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
```

Expected: all tests pass, including all 5 new submit tests.

- [ ] **Step 5: Commit**

```
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "feat: wire handleEditSave for Edit Feature with PATCH, grid update, and toast"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| AC1 — Actions column, Edit button hidden until row hover | Task 2, Steps 4 + 7 |
| AC2 — Modal pre-filled with current values via PATCH | Task 2 Step 3 + Task 3 Step 3 |
| AC3 — Confirm saves, grid updates, success toast | Task 3 Step 3 |
| `updateFeature` service method | Task 1 |
| Error handling (SESSION_EXPIRED + generic) | Task 3 Step 3 |
| `colSpan` update to 5 | Task 2 Step 6 |
| Skeleton 5th column | Task 2 Step 5 |
| 7 new test cases | Tasks 2–3 |

All spec sections covered. No placeholders. Types consistent: `PlatformFeature`, `Unit` (capitalized), `updateFeature` signature matches across all tasks.
