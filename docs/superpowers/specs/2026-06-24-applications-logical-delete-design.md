---
name: applications-logical-delete
description: Logical delete for Platform Applications — trash icon replaces lock, Edit modal gains status field, deleted rows stay visible
metadata:
  type: project
---

# Design Spec: Logical Delete for Platform Applications

**Date:** 2026-06-24
**Branch:** rafaalejandro_subscription
**Story:** Add a logical delete (trash icon) to `PlatformApplicationsView` that permanently marks an application as `deleted` via `DELETE /api/applications/:id`, keeps the row visible in the table, and prevents further distribution. The Edit modal gains a Status field (active/inactive) to replace the now-removed lock/deactivate button.

---

## Context

`PlatformApplicationsView` currently has:
- A lock icon (🔒) that deactivates an app via `toggleApplicationInactive` (PATCH to inactive)
- No way to permanently delete an app
- No status field in the Edit modal

This change mirrors the logical delete pattern from `SubscriptionPlansView` with one addition: since the Edit modal didn't previously offer status editing, the Status field is added to the Edit modal so deactivation capability is not lost.

---

## Scope

**In scope:**
- Add `'deleted'` to `Application.status` type union
- Remove `toggleApplicationInactive` from `saasService` and all references
- Extend `updateApplication` signature to accept `status: 'active' | 'inactive'` in updates
- Add `deleteApplication(id)` calling `DELETE /api/applications/:id`
- Add Status select to `EditAppDialog` (active / inactive only — deleted is never an edit option)
- Remove lock button, `DeactivateAppDialog`, `togglingApp`, `toggleSubmitting`, `handleToggleConfirm`
- Add trash button in Actions column
- Add `DeleteAppDialog` confirmation sub-component
- Add `deletingApp`, `deleteSubmitting` state and `handleDeleteConfirm` handler
- "deleted" badge in Status column (`bg-red-500/10 text-red-600`)
- Edit button disabled for deleted apps; trash button hidden for deleted apps
- `"deleted"` option in Status filter dropdown
- Row `opacity-75` for deleted apps (already applies via `status !== 'active'`)

**Out of scope:**
- Restoring/undeleting applications
- Bulk delete
- Any backend changes
- Filtering deleted apps out by default

---

## Type Changes

`src/types/subscription.ts` — extend `Application.status`:

```ts
export interface Application {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'inactive' | 'deleted';
}
```

`CreateSubscriptionPlanDto` and `UpdateSubscriptionPlanDto` remain unchanged. The `deleted` status is set exclusively via the DELETE endpoint, never via create or edit flows.

---

## Service Changes

`src/services/saasService.ts`:

**Remove** `toggleApplicationInactive`.

**Update** `updateApplication` signature and body:

```ts
async updateApplication(
  app: Application,
  updates: { name: string; description: string; category: string; status: 'active' | 'inactive' },
): Promise<Application> {
  const response = await saasApiFetch<{ data: Application }>(
    `applications/${app.id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        category: updates.category,
        status: updates.status,  // was: app.status (old hardcoded value)
      }),
    },
  );
  return response.data;
},
```

**Add** `deleteApplication`:

```ts
async deleteApplication(id: number): Promise<Application> {
  const response = await saasApiFetch<{ data: Application }>(
    `applications/${id}`,
    { method: 'DELETE' },
  );
  return response.data;
},
```

---

## Component Changes

### EditAppDialog

Add Status select as the last field, before the action buttons:

```tsx
<div className="space-y-1.5">
  <label
    htmlFor="edit-status"
    className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]"
  >
    Status
  </label>
  <select
    id="edit-status"
    aria-label="Status"
    value={status}
    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
    className="w-full px-3 py-2 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] outline-none transition-all"
  >
    <option value="active">active</option>
    <option value="inactive">inactive</option>
  </select>
</div>
```

`EditAppDialogProps.onSave` signature change:
```ts
// BEFORE
onSave: (updates: { name: string; description: string; category: string }) => void;
// AFTER
onSave: (updates: { name: string; description: string; category: string; status: 'active' | 'inactive' }) => void;
```

State inside `EditAppDialog`:
```ts
const [status, setStatus] = React.useState<'active' | 'inactive'>(
  app.status === 'deleted' ? 'active' : app.status
);
```
(Guard for the `deleted` case — should never happen in practice since the Edit button is disabled for deleted apps, but keeps TypeScript happy.)

### State removed from PlatformApplicationsView

```ts
// REMOVE all of these:
const [togglingApp, setTogglingApp] = useState<Application | null>(null);
const [toggleSubmitting, setToggleSubmitting] = useState(false);
```

### State added to PlatformApplicationsView

```ts
const [deletingApp, setDeletingApp] = useState<Application | null>(null);
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
```

### Handler removed

Remove `handleToggleConfirm` entirely.

### Handler added: handleDeleteConfirm

```ts
const handleDeleteConfirm = async () => {
  if (!deletingApp) return;
  setDeleteSubmitting(true);
  try {
    const updated = await saasService.deleteApplication(deletingApp.id);
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setDeletingApp(null);
    setToast({ message: 'Application deleted successfully', type: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete application';
    setDeletingApp(null);
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

### handleEditSave update

Pass `status` through to `updateApplication`:

```ts
const handleEditSave = async (updates: { name: string; description: string; category: string; status: 'active' | 'inactive' }) => {
  if (!editingApp) return;
  setEditSubmitting(true);
  try {
    const updated = await saasService.updateApplication(editingApp, updates);
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingApp(null);
    setToast({ message: 'Application updated successfully', type: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update application';
    setEditingApp(null);
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

### Actions Column (per row)

```tsx
<div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
  <button
    type="button"
    aria-label={`Edit ${app.name}`}
    onClick={() => setEditingApp(app)}
    disabled={app.status === 'deleted'}
    className={`p-1 transition-colors ${
      app.status === 'deleted'
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:text-[#ae001a]'
    }`}
  >
    <span className="material-symbols-outlined text-xl">edit</span>
  </button>
  {app.status !== 'deleted' && (
    <button
      type="button"
      aria-label={`Delete ${app.name}`}
      onClick={() => setDeletingApp(app)}
      className="p-1 hover:text-red-600 transition-colors"
    >
      <span className="material-symbols-outlined text-xl">delete</span>
    </button>
  )}
</div>
```

### DeleteAppDialog Sub-component

```tsx
interface DeleteAppDialogProps {
  app: Application;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteAppDialog: React.FC<DeleteAppDialogProps> = ({ app, submitting, onClose, onConfirm }) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md shadow-2xl">
      <div className="bg-[#222222] px-6 py-4 flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          DELETE APPLICATION
        </span>
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-[#1d1c17]">
          {`Deleting "${app.name}" will permanently prevent it from being distributed to new subscribers. The record is retained for historical analytics.`}
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
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            )}
            {submitting ? 'Deleting...' : 'Delete Application'}
          </button>
        </div>
      </div>
    </div>
  </div>
);
```

---

## Visual Changes

### Status badge

```tsx
// active — unchanged
<span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">active</span>

// inactive — unchanged
<span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">inactive</span>

// deleted — new
<span className="bg-red-500/10 text-red-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">deleted</span>
```

### Status filter dropdown

```tsx
<option value="All Status">All Status</option>
<option value="active">active</option>
<option value="inactive">inactive</option>
<option value="deleted">deleted</option>  {/* new */}
```

### Row opacity

Already correct: `className={`...${app.status !== 'active' ? ' opacity-75' : ''}`}` — covers both `inactive` and `deleted`.

### Left accent bar

Already correct: uses `bg-[#c8c6c5]` for non-active — no change needed.

---

## Test Changes

### Remove from mock

```ts
// REMOVE
toggleApplicationInactive: vi.fn(),
// ADD
deleteApplication: vi.fn(),
```

### Update MOCK_APPS

Add one app with `status: 'deleted'`:

```ts
{
  id: 4,
  name: 'Legacy Bridge',
  description: 'Deprecated legacy integration bridge.',
  category: 'Core',
  status: 'deleted',
},
```

### Remove tests

- All tests in `describe('PlatformApplicationsView — deactivate', ...)` (or equivalent — covers `togglingApp`, `DeactivateAppDialog`, `handleToggleConfirm`)

### Add tests: `describe('PlatformApplicationsView — delete application', ...)`

| # | Test |
|---|---|
| 1 | Renders a Delete button for each active app |
| 2 | Renders a Delete button for each inactive app |
| 3 | Does NOT render a Delete button for deleted apps |
| 4 | Clicking "Delete POS Terminal" opens `DeleteAppDialog` with correct copy |
| 5 | Clicking Cancel closes the dialog |
| 6 | Confirming delete calls `deleteApplication` with the correct app id |
| 7 | Successful delete updates the row in-place (shows "deleted" badge) and shows success toast |
| 8 | `SESSION_EXPIRED` closes dialog and shows session-expired toast |
| 9 | Edit button is disabled for deleted apps |

### Add tests: `describe('PlatformApplicationsView — edit status field', ...)`

| # | Test |
|---|---|
| 10 | Edit modal renders a Status select pre-populated with the app's current status |
| 11 | Saving the edit modal calls `updateApplication` with the selected status |

### Update existing edit tests

`updateApplication` mock calls must now include `status` in the `updates` argument.

---

## Files Affected

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Add `'deleted'` to `Application.status` union |
| `src/services/saasService.ts` | Remove `toggleApplicationInactive`; extend `updateApplication` signature; add `deleteApplication` |
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | Remove deactivate code; add status field to `EditAppDialog`; add trash button + `DeleteAppDialog` + handler |
| `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` | Remove deactivate tests; add delete + edit-status tests; update mocks and `MOCK_APPS` |
