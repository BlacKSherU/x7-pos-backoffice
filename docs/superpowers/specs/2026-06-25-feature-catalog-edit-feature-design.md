# Design Spec: Edit Feature — Platform Feature Catalog

**Date:** 2026-06-25
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Context

The Platform Feature Catalog (`PlatformFeatureCatalogView`) already supports listing, searching/filtering, and creating features. This spec covers inline row-level editing: a SaaS Owner can modify the `name`, `description`, and `Unit` of an existing feature record via a PATCH call to the backend.

User story acceptance criteria:
- **AC1** — Every data row includes an Actions column with an Edit button visible only on row hover.
- **AC2** — Clicking Edit opens a modal pre-filled with the current database values (name, description, Unit).
- **AC3** — Confirming saves changes via PATCH, updates the grid instantly, and raises a success toast.

---

## Backend

The backend already exposes a fully implemented endpoint:

```
PATCH /features/:id
Body: { name?: string; description?: string; Unit?: string }
Response: { statusCode: 200, message: "Feature updated successfully", data: PlatformFeature }
```

No backend changes required.

---

## Service Layer

Add `updateFeature` to `saasService.ts` following the established PATCH pattern:

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
}
```

---

## Components

### `EditFeatureDialog`

Declared in `PlatformFeatureCatalogView.tsx` alongside `CreateFeatureDialog`.

**Props:**
```ts
interface EditFeatureDialogProps {
  feature: PlatformFeature;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { name: string; description: string; Unit: string }) => void;
}
```

**Behavior:**
- Initializes local state from `feature.name`, `feature.description`, `feature.Unit`.
- Same validation as Create: name ≤ 100 chars, unit ≤ 50 chars, all three fields non-empty.
- Header label: `EDIT FEATURE`. Confirm button label: `Save Changes` (spinner while `submitting`).
- Cancel and X button close the modal without saving.
- Visual style identical to `CreateFeatureDialog` (same Tailwind classes, same field layout).

---

## Table — Actions Column

### Header (`<thead>`)
Add a fifth `<th>` after Status:

```tsx
<th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
  Actions
</th>
```

### Data rows (`filteredFeatures.map`)
Each `<tr>` already has the `group` class. Add a fifth `<td>`:

```tsx
<td className="px-6 py-4 text-center">
  <button
    type="button"
    onClick={() => setEditingFeature(feature)}
    aria-label={`Edit ${feature.name}`}
    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-3 py-1 border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] hover:border-[#ae001a] hover:text-[#ae001a] transition-colors"
  >
    <span className="material-symbols-outlined text-sm">edit</span>
    Edit
  </button>
</td>
```

### Skeleton rows (loading state)
Add an empty fifth `<td>` to each skeleton row to maintain column structure:

```tsx
<td className="px-6 py-4 text-center">
  <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-12 mx-auto" />
</td>
```

### Empty-filter row (`colSpan`)
Update `colSpan={4}` → `colSpan={5}`.

---

## State & Handler (Parent Component)

New state:
```ts
const [editingFeature, setEditingFeature] = useState<PlatformFeature | null>(null);
const [editSubmitting, setEditSubmitting] = useState(false);
```

Handler `handleEditSave`:
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

Modal render (alongside `CreateFeatureDialog`):
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

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Network / server error | Modal closes, error toast with message |
| `SESSION_EXPIRED` | Modal closes, session-expired toast |
| Success | Modal closes, grid updates, success toast |

Modal always closes after any submit attempt (success or error), matching the pattern used by `handleCreateSave`.

---

## Tests

File: `PlatformFeatureCatalogView.test.tsx`

Mock update: add `updateFeature: vi.fn()` to the existing `saasService` mock object.

New test cases:

| Case | Assertion |
|---|---|
| Actions column header renders | `getByText('Actions')` present; `getAllByRole('columnheader')` returns 5 entries |
| Edit button present per row (hidden via opacity, still in DOM) | `getAllByRole('button', { name: /edit/i })` returns 3 buttons for 3 features |
| Click Edit opens modal pre-filled | After click, modal visible; inputs show current name/description/unit |
| Submit success | `updateFeature` resolves; modal closes; toast "Feature updated successfully"; row reflects new values |
| Submit generic error | `updateFeature` rejects with `Error('Server error')`; toast shows error message |
| Submit SESSION_EXPIRED | `updateFeature` rejects with `Error('SESSION_EXPIRED')`; session-expired toast shown |
| Save button disabled while submitting | `updateFeature` never resolves during test; button has `disabled` attribute |

---

## Files Changed

| File | Change |
|---|---|
| `src/services/saasService.ts` | Add `updateFeature` method |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` | Add `EditFeatureDialog`, Actions column, new state + handler |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` | Add `updateFeature` mock + 7 new test cases |
