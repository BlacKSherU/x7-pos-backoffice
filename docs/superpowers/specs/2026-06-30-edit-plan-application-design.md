# Edit Plan-Application Mapping — Design Spec

**Date:** 2026-06-30
**Branch:** rafaalejandro_subscription
**Feature file:** `src/components/SaaSDashboard/PlanApplicationsView.tsx`

---

## User Story

As a SaaS Owner, I want to modify the constraint strings and status of an existing plan-application mapping so that I can fine-tune usage policies without destroying and recreating the relationship entry.

---

## Acceptance Criteria

| AC | Description |
|----|-------------|
| AC 1 | Every row in the association grid has an Actions column with a pencil icon that transitions to full visibility on row-hover. |
| AC 2 | Clicking "Edit" opens a modal with `limits` pre-filled and `subscriptionPlan`/`application` locked as read-only. |
| AC 3 | Saving dispatches a PATCH to the backend, updates the active grid row instantly, and shows a success banner. |

---

## Architecture

### Approach chosen: Option A — inline `EditPlanApplicationDialog` (same file)

The new `EditPlanApplicationDialog` component lives at the top of `PlanApplicationsView.tsx`, directly above `AssociateAppDialog`. No new files. Mirrors the existing modal pattern exactly.

---

## Layer 1 — Types (`src/types/subscription.ts`)

New export:
```ts
export interface UpdatePlanApplicationDto {
  limits: string;
  status: 'active' | 'inactive';
}
```

---

## Layer 2 — Service (`src/services/saasService.ts`)

New method on `saasService`:
```ts
async updatePlanApplication(id: number, dto: UpdatePlanApplicationDto): Promise<PlanApplication> {
  const response = await saasApiFetch<{ data: PlanApplication }>(
    `plan-applications/${id}`,
    { method: 'PATCH', body: JSON.stringify(dto) },
  );
  return response.data;
}
```

Import `UpdatePlanApplicationDto` in the saasService import line.

---

## Layer 3 — `EditPlanApplicationDialog` component

### Props
```ts
interface EditPlanApplicationDialogProps {
  pa: PlanApplication;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { limits: string; status: 'active' | 'inactive' }) => void;
}
```

### Internal state
```ts
const [limits, setLimits] = useState(pa.limits);
const [status, setStatus] = useState<'active' | 'inactive'>(
  pa.status === 'active' ? 'active' : 'inactive'
);
```

### Validation / submit guard
Submit is disabled when ANY of:
- `limits.trim() === ''`
- `limits.length > 50`
- No changes: `limits === pa.limits && status === pa.status`

### Fields
| Field | Type | Behaviour |
|-------|------|-----------|
| Subscription Plan | `<input readOnly>` | Pre-filled with `pa.subscriptionPlan.name`; `bg-[#ece8e0] cursor-not-allowed` |
| Application | `<input readOnly>` | Pre-filled with `pa.application.name`; same locked style |
| Usage Limits | `<textarea>` | Pre-filled with `pa.limits`; char counter `{n}/50`; counter turns `text-[#ae001a] font-bold` when exceeded |
| Association Status | `<select>` | Options: Active / Inactive; pre-selected with `pa.status` |

### Buttons
- **Cancel** — closes modal; disabled while submitting
- **SAVE CHANGES** — red primary button with spinner icon while submitting; disabled when invalid/no-change

### Modal chrome
- Header: dark strip `bg-[#222222]` with label `"EDIT PLAN-APPLICATION"`
- Close X button top-right (same as AssociateAppDialog)
- Overlay: `fixed inset-0 bg-black/50 z-[100]`

---

## Layer 4 — Grid changes (`PlanApplicationsView`)

### New state
```ts
const [editingPA, setEditingPA] = useState<PlanApplication | null>(null);
const [editSubmitting, setEditSubmitting] = useState(false);
```

### `<thead>` — new column
```tsx
<th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
  Actions
</th>
```

### `<tr>` — add `group` class
```tsx
<tr key={pa.id} className="group hover:bg-[#f8f3eb] transition-colors">
```

### New `<td>` per row (last column)
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

### Skeleton row — add extra `<td>` for Actions column
```tsx
<td className="px-6 py-4" />
```

### `handleEdit` handler
```ts
const handleEdit = async (dto: { limits: string; status: 'active' | 'inactive' }) => {
  setEditSubmitting(true);
  try {
    const updated = await saasService.updatePlanApplication(editingPA!.id, dto);
    setPlanApplications(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingPA(null);
    setToast({ message: 'Plan-application updated successfully', type: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update plan-application';
    setEditingPA(null);
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

### Modal mount (after AssociateAppDialog mount)
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

---

## Layer 5 — Tests (`PlanApplicationsView.test.tsx`)

Add `updatePlanApplication: vi.fn()` to the `vi.mock` factory.

### New describe blocks (~10 tests)

**`— edit trigger (AC 1)`** (2 tests)
1. Pencil button is present in the DOM for each data row with correct `aria-label`
2. Pencil button has `opacity-0` class (hidden until hover — CSS-only, not testable in jsdom, so we verify it exists)

**`— edit modal fields (AC 2)`** (4 tests)
1. Clicking pencil opens the modal (Cancel button appears)
2. Subscription Plan input is read-only and pre-filled with plan name
3. Application input is read-only and pre-filled with app name
4. Limits textarea is pre-filled; Status select is pre-selected with current status

**`— edit happy path (AC 3)`** (1 test)
- Change limits + status → click SAVE CHANGES → modal closes → row updated in grid → success toast

**`— edit error path`** (1 test)
- API rejects → modal closes → error toast shown

**`— edit submit disabled`** (2 tests)
1. SAVE CHANGES disabled when limits is cleared
2. SAVE CHANGES disabled when no changes made (dirty check)

**Total new tests:** ~10 → project goes from 33 → ~43 tests.

---

## Error handling

All error paths:
- SESSION_EXPIRED → specific session-expired message (matches existing pattern)
- Other errors → raw error message in toast
- Modal closes on both success and error (same as AssociateAppDialog pattern)

---

## Out of scope

- Pagination (already capped at limit=100, unchanged)
- Deleting plan-application entries
- Editing the linked application or plan (explicitly locked per AC 2)
- The `hasActiveFilters` dead-code cleanup (pre-existing, separate concern)
