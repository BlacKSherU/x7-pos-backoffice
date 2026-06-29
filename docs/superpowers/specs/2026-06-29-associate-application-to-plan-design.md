# Design Spec: Associate Application to Subscription Plan

**Date:** 2026-06-29
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Context

As a SaaS Owner, I want to bind an existing platform application to a target Subscription Plan while declaring its textual operational limits, so that I can expand the software capabilities made available to merchants when purchasing that tier.

This feature extends the existing `PlanApplicationsView` (read-only grid + search/filter, already implemented) with a creation workflow. The backend endpoint `POST /plan-applications` already exists — only the frontend is missing.

---

## Acceptance Criteria (from user story)

- **AC 1:** Workflow triggered by brand-red "ASSOCIATE APPLICATION" button OR lower-right FAB.
- **AC 2:** Creation modal with three fields: plan (read-only), application dropdown (unassociated apps only), limits textarea (max 50 chars, mandatory).
- **AC 3:** `status` defaults to `"active"` automatically on creation (sent in POST body).
- **AC 4:** On confirm — close modal, prepend new row to grid in real time, show success toast.

---

## Architecture

Only frontend changes. The `POST /plan-applications` backend endpoint already accepts `{ subscriptionPlanId, applicationId, limits, status }` and returns the full `PlanApplication` object.

### Files changed

| File | Change |
|---|---|
| `src/types/subscription.ts` | Add `CreatePlanApplicationDto` |
| `src/services/saasService.ts` | Add `createPlanApplication()` method |
| `src/components/SaaSDashboard/PlanApplicationsView.tsx` | New state + `AssociateAppDialog` component + buttons + FAB |
| `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` | ~12 new test cases |

### Data flow

```
[ASSOCIATE APPLICATION button | FAB]
  └─► openAssociateModal()
        ├─► setShowAssociateModal(true)
        └─► getApplications()
              └─► filter out ids already in planApplications
              └─► setAvailableApps(filtered)

[AssociateAppDialog: confirm → onSave({ applicationId, limits })]
  └─► handleAssociate()
        ├─► createPlanApplication({ subscriptionPlanId: plan.id, applicationId, limits, status: 'active' })
        ├─► setPlanApplications(prev => [newPA, ...prev])   // real-time grid sync
        ├─► setShowAssociateModal(false)
        └─► setToast({ message: 'Application associated successfully', type: 'success' })
```

---

## Types — `src/types/subscription.ts`

Add after `UpdateSubscriptionPlanDto`:

```ts
export interface CreatePlanApplicationDto {
  subscriptionPlanId: number;
  applicationId: number;
  limits: string;
  status: 'active';
}
```

---

## Service — `src/services/saasService.ts`

Add `createPlanApplication` after `getPlanApplications`:

```ts
async createPlanApplication(dto: CreatePlanApplicationDto): Promise<PlanApplication> {
  const response = await saasApiFetch<{ data: PlanApplication }>(
    'plan-applications',
    { method: 'POST', body: JSON.stringify(dto) },
  );
  return response.data;
},
```

Import `CreatePlanApplicationDto` from `../types/subscription`.

---

## Component — `PlanApplicationsView.tsx`

### New state variables

```ts
const [showAssociateModal, setShowAssociateModal] = useState(false);
const [availableApps, setAvailableApps] = useState<Application[]>([]);
const [loadingApps, setLoadingApps] = useState(false);
const [associateSubmitting, setAssociateSubmitting] = useState(false);
```

Import `Application` from `../../types/subscription`.

### `openAssociateModal()`

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
```

### `handleAssociate()`

```ts
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
      setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
    } else {
      setToast({ message: msg, type: 'error' });
    }
  } finally {
    setAssociateSubmitting(false);
  }
};
```

### Button placements

**1. Filter controls row** (when data exists) — rightmost element:

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

**2. Empty state** — primary CTA after the description paragraph:

```tsx
<button
  type="button"
  onClick={openAssociateModal}
  className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
>
  <span className="material-symbols-outlined text-base">add_link</span>
  ASSOCIATE APPLICATION
</button>
```

**3. FAB** (visible when `!fetchError` — not rendered if the initial data load failed):

```tsx
<button
  type="button"
  aria-label="Open associate-application form"
  onClick={openAssociateModal}
  className="fixed bottom-8 right-8 w-14 h-14 bg-[#ae001a] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#930015] transition-all transform hover:scale-110 active:scale-95 z-50"
>
  <span className="material-symbols-outlined text-3xl">add</span>
</button>
```

### Modal mounting

```tsx
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

---

## `AssociateAppDialog` component

Extracted above `PlanApplicationsView`, same pattern as `RegisterAppDialog` in `PlatformApplicationsView.tsx`.

### Props

```ts
interface AssociateAppDialogProps {
  plan: SubscriptionPlan;
  availableApps: Application[];
  loadingApps: boolean;
  submitting: boolean;
  onClose: () => void;
  onSave: (dto: { applicationId: number; limits: string }) => void;
}
```

### Internal state

```ts
const [selectedAppId, setSelectedAppId] = React.useState<number | ''>('');
const [limits, setLimits] = React.useState('');
```

### Validation

```ts
const limitsExceeded = limits.length > 50;
const isValid =
  selectedAppId !== '' &&
  limits.trim() !== '' &&
  !limitsExceeded &&
  !loadingApps;
```

### Form fields

**Subscription Plan (read-only):**
```tsx
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
```

**Application dropdown:**
```tsx
<div className="space-y-1.5">
  <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
    Application
  </label>
  <select
    value={selectedAppId}
    onChange={(e) => setSelectedAppId(e.target.value === '' ? '' : Number(e.target.value))}
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
```

**Usage Limits (textarea with counter):**
```tsx
<div className="space-y-1.5">
  <div className="flex justify-between">
    <label className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
      Usage Limits
    </label>
    <span className={`text-[11px] ${limitsExceeded ? 'text-[#ae001a] font-bold' : 'text-[#5f5e5e]'}`}>
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
```

**Action buttons:**
```tsx
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
    onClick={() => onSave({ applicationId: selectedAppId as number, limits: limits.trim() })}
    disabled={!isValid || submitting}
    className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
  >
    {submitting && (
      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
    )}
    {submitting ? 'Associating…' : 'ASSOCIATE'}
  </button>
</div>
```

---

## Tests — `PlanApplicationsView.test.tsx`

Extended mock:
```ts
vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
    getApplications: vi.fn(),
    createPlanApplication: vi.fn(),
  },
}));
```

Additional mock data:
```ts
const MOCK_ALL_APPS: Application[] = [
  { id: 5, name: 'POS Core', description: '', category: 'Point of Sale', status: 'active' },
  { id: 7, name: 'Kitchen Display', description: '', category: 'Kitchen Display', status: 'active' },
  { id: 9, name: 'Analytics Pro', description: '', category: 'Analytics', status: 'active' },
];
// ids 5 and 7 are already in MOCK_PLAN_APPS, so only id 9 should appear in dropdown
```

| Describe group | Test |
|---|---|
| **Trigger buttons** | "ASSOCIATE APPLICATION" button visible in filter row when data loaded |
| | "ASSOCIATE APPLICATION" button visible in empty state |
| | FAB visible with `aria-label="Open associate-application form"` |
| | Clicking filter-row button opens modal |
| | Clicking FAB opens modal |
| **Modal — fields** | Modal shows plan name in read-only field |
| | Dropdown only lists apps not already associated (excludes ids 5 and 7) |
| | Submit button disabled when no app selected and limits empty |
| | Char counter turns red and submit blocked when limits > 50 chars |
| **Happy path** | Confirm → modal closes + new row prepended to grid + success toast |
| **Error path** | API error → modal closes + error toast shown |
| **Edge case** | When all apps already associated, dropdown shows "All applications already associated" and submit is blocked |

---

## Files Changed

| File | Change |
|---|---|
| `src/types/subscription.ts` | Add `CreatePlanApplicationDto` |
| `src/services/saasService.ts` | Add `createPlanApplication()` |
| `src/components/SaaSDashboard/PlanApplicationsView.tsx` | `AssociateAppDialog` + new state + handlers + buttons + FAB |
| `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` | ~12 new test cases |
