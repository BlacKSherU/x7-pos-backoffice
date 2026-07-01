# Design Spec: Logical Delete — Platform Feature Catalog

**Date:** 2026-06-25
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Context

The Platform Feature Catalog supports listing, filtering, creating, and editing features. This spec adds logical delete: a trash icon per row opens a confirmation modal, DELETE /features/:id sets status to `'deleted'`, the row stays in the grid with a red "deleted" badge, and the edit icon is disabled for deleted records.

Pattern source: `PlatformApplicationsView` and `SubscriptionPlansView` — implementation must match exactly.

---

## Backend

`DELETE /features/:id` is already implemented. It sets `feature.status = 'deleted'` and returns the updated `PlatformFeature`. No backend changes needed.

---

## Service Layer

Add `deleteFeature` to `saasService.ts` after `updateFeature`, following the `deleteApplication` pattern:

```ts
async deleteFeature(id: number): Promise<PlatformFeature> {
  const response = await saasApiFetch<{ data: PlatformFeature }>(
    `features/${id}`,
    { method: 'DELETE' },
  );
  return response.data;
}
```

---

## Components

### `DeleteFeatureDialog`

Declared in `PlatformFeatureCatalogView.tsx` alongside `EditFeatureDialog`. Stateless — receives all data via props.

**Props:**
```ts
interface DeleteFeatureDialogProps {
  feature: PlatformFeature;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
```

**Structure:**
- Backdrop: `fixed inset-0 bg-black/50 z-[100]`, centered, `max-w-md`
- Header (`#222222`): text `DELETE FEATURE`, X close button
- Body message: `Deleting "${feature.name}" will prevent it from being assigned to new subscription plans. The record is retained for historical reference.`
- Footer buttons:
  - `Cancel` — `border border-[#e8e2d8]`, disabled while submitting
  - `Delete Feature` — `bg-[#ae001a]`, spinner + `Deleting...` while submitting

---

## Table Changes

### Actions column — trash button

Added next to the existing edit pencil. Mirrors `PlatformApplicationsView` exactly:

```tsx
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
```

The trash button only renders when `feature.status !== 'deleted'`.

### Edit button — disabled for deleted

```tsx
disabled={feature.status === 'deleted'}
className={`p-1 transition-colors ${
  feature.status === 'deleted'
    ? 'opacity-50 cursor-not-allowed'
    : 'hover:text-[#ae001a]'
}`}
```

### Status column — deleted badge

```tsx
<span className="bg-red-500/10 text-red-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
  deleted
</span>
```

Added as third branch in the status conditional (active → green, inactive → muted, deleted → red).

### Status filter dropdown

Add `<option value="deleted">deleted</option>` after the `inactive` option.

---

## State and Handler

New state in `PlatformFeatureCatalogView`:

```ts
const [deletingFeature, setDeletingFeature] = useState<PlatformFeature | null>(null);
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
```

Handler `handleDeleteConfirm`:

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

Modal render (alongside existing dialogs):

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

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Success | Modal closes, row badge → "deleted", edit icon disabled, toast success |
| `SESSION_EXPIRED` | Modal closes, session-expired toast |
| Generic error | Modal closes, error toast with message |

---

## Tests

File: `PlatformFeatureCatalogView.test.tsx`

Add `deleteFeature: vi.fn()` to mock object.

New test cases (describe block: `— Logical Delete`):

| Case | Assertion |
|---|---|
| Trash button present for non-deleted features | 3 buttons `aria-label=/delete/i` for 3 active/inactive features |
| Trash button absent for deleted features | render with a deleted feature → no trash button for that row |
| Click trash → confirmation modal visible | modal shows `DELETE FEATURE` header + feature name in body |
| Confirm → `deleteFeature` called, row shows "deleted" badge, toast success | `deleteFeature(id)` called; badge text "deleted" visible; toast shown |
| `SESSION_EXPIRED` → session toast | modal closes, session-expired message |
| Generic error → error toast | modal closes, error message |
| Delete button disabled while submitting | `deleteFeature` never resolves; confirm button has `disabled` |
| Edit button disabled for deleted feature | render feature with `status: 'deleted'` → edit button is disabled |

---

## Files Changed

| File | Change |
|---|---|
| `src/services/saasService.ts` | Add `deleteFeature` method |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` | Add `DeleteFeatureDialog`, trash button, deleted badge, disabled edit, status filter option, state + handler |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` | Add `deleteFeature` mock + 8 new test cases |
