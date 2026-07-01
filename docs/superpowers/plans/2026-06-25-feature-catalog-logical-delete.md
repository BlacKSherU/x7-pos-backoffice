# Logical Delete — Platform Feature Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add logical delete to the Platform Feature Catalog: trash icon per row opens a confirmation modal, `DELETE /features/:id` sets status to `'deleted'`, the row stays in the grid with a red badge, and the edit icon is disabled for deleted records.

**Architecture:** Three files touched. Service layer gets a `deleteFeature` method. The component file (`PlatformFeatureCatalogView.tsx`) gets a new `DeleteFeatureDialog` component, two new state variables, a handler, and several small inline changes (trash button, badge branch, disabled edit, filter option). The test file gets the mock wired up and 8 new test cases.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, @testing-library/user-event, Tailwind CSS v4, Material Symbols Outlined icons.

## Global Constraints

- Pattern must match `PlatformApplicationsView` exactly (same icon names, same badge classes, same handler shape).
- Deleted badge: `bg-red-500/10 text-red-600`.
- Trash button only renders when `feature.status !== 'deleted'`.
- Edit button disabled (not removed) for deleted features: `disabled={feature.status === 'deleted'}`.
- All new tests go in a single `describe` block named `PlatformFeatureCatalogView — Logical Delete`.
- No new files — all changes to existing files only.
- Run `npm test` (Vitest) to verify; command is `npx vitest run`.
- Material icon names: `delete` for trash, `progress_activity` for spinner.
- Toast message on success: `'Feature deleted successfully'`.
- `SESSION_EXPIRED` toast: `'Session expired. Please refresh the page to sign in again.'`.

---

### Task 1: `deleteFeature` service method + test mock

**Files:**
- Modify: `src/services/saasService.ts` (add `deleteFeature` after `updateFeature`)
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` (add `deleteFeature` to mock object)

**Interfaces:**
- Produces: `saasService.deleteFeature(id: number): Promise<PlatformFeature>` — consumed by Task 2's `handleDeleteConfirm`
- Produces: `saasService.deleteFeature` mock available for Task 3's test cases

- [ ] **Step 1: Add `deleteFeature` to `saasService.ts`**

In `src/services/saasService.ts`, after the `updateFeature` method (currently at line 330), add:

```ts
  async deleteFeature(id: number): Promise<PlatformFeature> {
    const response = await saasApiFetch<{ data: PlatformFeature }>(
      `features/${id}`,
      { method: 'DELETE' },
    );
    return response.data;
  },
```

The closing `};` of the `saasService` object is at line 340. The new method goes between `updateFeature`'s closing `},` and the final `};`.

- [ ] **Step 2: Add `deleteFeature` to the test mock**

In `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`, the `vi.mock` block is at lines 8–14:

```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
    createFeature: vi.fn(),
    updateFeature: vi.fn(),
  },
}));
```

Change it to:

```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
    createFeature: vi.fn(),
    updateFeature: vi.fn(),
    deleteFeature: vi.fn(),
  },
}));
```

- [ ] **Step 3: Run tests to verify nothing broke**

```
npx vitest run
```

Expected: all existing tests pass (currently 61). Zero failures.

- [ ] **Step 4: Commit**

```bash
git add src/services/saasService.ts src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "feat: add deleteFeature service method and test mock"
```

---

### Task 2: Component changes — `DeleteFeatureDialog`, trash button, deleted badge, disabled edit, filter option, state + handler

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`

**Interfaces:**
- Consumes: `saasService.deleteFeature(id: number): Promise<PlatformFeature>` from Task 1
- Produces: `DeleteFeatureDialog` component + `deletingFeature` / `deleteSubmitting` state + `handleDeleteConfirm` handler — consumed by Task 3's tests

- [ ] **Step 1: Add `DeleteFeatureDialog` component**

In `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`, after the closing `};` of `EditFeatureDialog` (currently around line 286), insert the new component:

```tsx
interface DeleteFeatureDialogProps {
  feature: PlatformFeature;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteFeatureDialog: React.FC<DeleteFeatureDialogProps> = ({ feature, submitting, onClose, onConfirm }) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md shadow-2xl">
      <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          DELETE FEATURE
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="text-white/50 hover:text-white transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-[#1d1c17] leading-relaxed">
          Deleting &ldquo;{feature.name}&rdquo; will prevent it from being assigned to new subscription
          plans. The record is retained for historical reference.
        </p>
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
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && (
              <span className="material-symbols-outlined text-base animate-spin">
                progress_activity
              </span>
            )}
            {submitting ? 'Deleting...' : 'Delete Feature'}
          </button>
        </div>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2: Add `deletingFeature` and `deleteSubmitting` state**

In `PlatformFeatureCatalogView`, the existing state declarations are around lines 296–307:

```ts
const [editingFeature, setEditingFeature] = useState<PlatformFeature | null>(null);
const [editSubmitting, setEditSubmitting] = useState(false);
```

After those two lines, add:

```ts
const [deletingFeature, setDeletingFeature] = useState<PlatformFeature | null>(null);
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
```

- [ ] **Step 3: Add `handleDeleteConfirm` handler**

After `handleEditSave` (which closes around line 383), add:

```ts
  const handleDeleteConfirm = async () => {
    if (!deletingFeature) return;
    setDeleteSubmitting(true);
    try {
      const updated = await saasService.deleteFeature(deletingFeature.id);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setDeletingFeature(null);
      setToast({ message: 'Feature deleted successfully', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete feature';
      setDeletingFeature(null);
      if (msg === 'SESSION_EXPIRED') {
        setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };
```

- [ ] **Step 4: Add `deleted` option to the status filter dropdown**

In the filter strip, the status `<select>` currently has three `<option>` elements ending with `inactive`. Add the `deleted` option after `inactive`:

```tsx
<option value="deleted">deleted</option>
```

The select should look like:

```tsx
<select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
  className="px-3 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded-xl text-sm focus:border-[#ae001a] outline-none font-[Poppins]"
  aria-label="Filter by status"
>
  <option value="All Status">All Status</option>
  <option value="active">active</option>
  <option value="inactive">inactive</option>
  <option value="deleted">deleted</option>
</select>
```

- [ ] **Step 5: Update the status badge to handle `deleted`**

The current status badge is a ternary (lines 562–570). Replace it with a three-branch conditional:

Current:
```tsx
{feature.status === 'active' ? (
  <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
    active
  </span>
) : (
  <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
    inactive
  </span>
)}
```

Replace with:
```tsx
{feature.status === 'active' ? (
  <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
    active
  </span>
) : feature.status === 'deleted' ? (
  <span className="bg-red-500/10 text-red-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
    deleted
  </span>
) : (
  <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
    inactive
  </span>
)}
```

- [ ] **Step 6: Update the Actions column — disabled edit + trash button**

The current Actions column (lines 572–583) contains only the edit button. Replace the entire `<td>`:

Current:
```tsx
<td className="px-6 py-4">
  <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
    <button
      type="button"
      aria-label={`Edit ${feature.name}`}
      onClick={() => setEditingFeature(feature)}
      className="p-1 transition-colors hover:text-[#ae001a]"
    >
      <span className="material-symbols-outlined text-xl">edit</span>
    </button>
  </div>
</td>
```

Replace with:
```tsx
<td className="px-6 py-4">
  <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
    <button
      type="button"
      aria-label={`Edit ${feature.name}`}
      onClick={() => setEditingFeature(feature)}
      disabled={feature.status === 'deleted'}
      className={`p-1 transition-colors ${
        feature.status === 'deleted'
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:text-[#ae001a]'
      }`}
    >
      <span className="material-symbols-outlined text-xl">edit</span>
    </button>
    {feature.status !== 'deleted' && (
      <button
        type="button"
        aria-label={`Delete ${feature.name}`}
        onClick={() => setDeletingFeature(feature)}
        className="p-1 hover:text-red-600 transition-colors"
      >
        <span className="material-symbols-outlined text-xl">delete</span>
      </button>
    )}
  </div>
</td>
```

- [ ] **Step 7: Render `DeleteFeatureDialog` in the JSX**

Find where `EditFeatureDialog` is rendered (in the return, after the main content):

```tsx
{editingFeature && (
  <EditFeatureDialog
    key={editingFeature.id}
    feature={editingFeature}
    submitting={editSubmitting}
    onClose={() => setEditingFeature(null)}
    onSave={handleEditSave}
  />
)}
```

After that block, add:

```tsx
{deletingFeature && (
  <DeleteFeatureDialog
    feature={deletingFeature}
    submitting={deleteSubmitting}
    onClose={() => setDeletingFeature(null)}
    onConfirm={handleDeleteConfirm}
  />
)}
```

- [ ] **Step 8: Run tests to verify all existing tests still pass**

```
npx vitest run
```

Expected: all existing tests pass (61). Zero failures.

- [ ] **Step 9: Commit**

```bash
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx
git commit -m "feat: add DeleteFeatureDialog, trash button, deleted badge, and disabled edit"
```

---

### Task 3: Test cases — Logical Delete describe block (8 tests)

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`

**Interfaces:**
- Consumes: `saasService.deleteFeature` mock from Task 1
- Consumes: `DeleteFeatureDialog`, trash button, deleted badge, disabled edit from Task 2

- [ ] **Step 1: Add a `DELETED_FEATURE` constant and the new describe block**

At the end of `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` (after line 697, the closing `}`), append:

```ts
describe('PlatformFeatureCatalogView — Logical Delete', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('renders a trash button for each non-deleted feature', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      const trashBtns = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('Delete '));
      expect(trashBtns).toHaveLength(3);
    });
  });

  it('does not render a trash button for a deleted feature', async () => {
    const featuresWithDeleted: PlatformFeature[] = [
      ...MOCK_FEATURES,
      { id: 4, name: 'Legacy Module', description: 'Old module.', Unit: 'unit', status: 'deleted' },
    ];
    vi.mocked(saasService.getFeatures).mockResolvedValue(featuresWithDeleted);
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Legacy Module'));
    expect(
      screen.queryByRole('button', { name: 'Delete Legacy Module' }),
    ).not.toBeInTheDocument();
  });

  it('clicking trash opens the DELETE FEATURE confirmation modal', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Advanced Analytics' }));
    expect(screen.getByText('DELETE FEATURE')).toBeInTheDocument();
    expect(screen.getByText(/Deleting "Advanced Analytics"/)).toBeInTheDocument();
  });

  it('on success: modal closes, row shows deleted badge, toast shown', async () => {
    const deletedFeature: PlatformFeature = { ...MOCK_FEATURES[0], status: 'deleted' };
    vi.mocked(saasService.deleteFeature).mockResolvedValue(deletedFeature);
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Advanced Analytics' }));
    await userEvent.click(screen.getByRole('button', { name: /delete feature/i }));
    await waitFor(() => {
      expect(screen.queryByText('DELETE FEATURE')).not.toBeInTheDocument();
      const deletedBadge = screen.getByText('deleted', { selector: 'span' });
      expect(deletedBadge).toHaveClass('text-red-600');
      expect(screen.getByText('Feature deleted successfully')).toBeInTheDocument();
    });
  });

  it('SESSION_EXPIRED: modal closes, session-expired toast shown', async () => {
    vi.mocked(saasService.deleteFeature).mockRejectedValue(new Error('SESSION_EXPIRED'));
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Advanced Analytics' }));
    await userEvent.click(screen.getByRole('button', { name: /delete feature/i }));
    await waitFor(() => {
      expect(screen.queryByText('DELETE FEATURE')).not.toBeInTheDocument();
      expect(
        screen.getByText('Session expired. Please refresh the page to sign in again.'),
      ).toBeInTheDocument();
    });
  });

  it('generic API error: modal closes, error toast shown', async () => {
    vi.mocked(saasService.deleteFeature).mockRejectedValue(new Error('Cannot delete active feature'));
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Advanced Analytics' }));
    await userEvent.click(screen.getByRole('button', { name: /delete feature/i }));
    await waitFor(() => {
      expect(screen.queryByText('DELETE FEATURE')).not.toBeInTheDocument();
      expect(screen.getByText('Cannot delete active feature')).toBeInTheDocument();
    });
  });

  it('Delete Feature button is disabled while submitting', async () => {
    vi.mocked(saasService.deleteFeature).mockReturnValue(new Promise(() => {}));
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Advanced Analytics' }));
    await userEvent.click(screen.getByRole('button', { name: /delete feature/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
    });
  });

  it('edit button is disabled for a deleted feature', async () => {
    const featuresWithDeleted: PlatformFeature[] = [
      ...MOCK_FEATURES,
      { id: 4, name: 'Legacy Module', description: 'Old module.', Unit: 'unit', status: 'deleted' },
    ];
    vi.mocked(saasService.getFeatures).mockResolvedValue(featuresWithDeleted);
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Legacy Module'));
    const editBtn = screen.getByRole('button', { name: 'Edit Legacy Module' });
    expect(editBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run all tests**

```
npx vitest run
```

Expected: 69 tests pass (61 existing + 8 new). Zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "test: add 8 logical delete tests for PlatformFeatureCatalogView"
```
