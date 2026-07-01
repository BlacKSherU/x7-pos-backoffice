# Design Spec: Plan Applications View

**Date:** 2026-06-29
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Context

As a SaaS Owner / Platform Super Administrator, I need a sub-panel that shows which applications are bundled into a specific Subscription Plan, so I can audit and control the software modules packaged into each commercial tier.

This view is accessed from the Subscription Plans master table by selecting a specific plan row. It renders inside the existing SaaSDashboard shell (dark sidebar, top header, breadcrumbs, footer).

---

## Backend Changes

Two minimal changes to the existing `plan-applications` module. No migrations, no new endpoints.

### 1. `QueryPlanApplicationDto` — add `subscriptionPlanId` filter

File: `src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts`

Add an optional `subscriptionPlanId` field after the existing `status` field:

```ts
@ApiPropertyOptional({
  description: 'Filter by subscription plan ID',
  example: 1,
})
@Type(() => Number)
@IsOptional()
@IsNumber()
@Min(1)
subscriptionPlanId?: number;
```

### 2. `PlanApplicationsService.findAll` — filter by plan + expose `application.category`

File: `src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts`

Two changes inside `findAll`:

**Add `application.category` to the QueryBuilder select:**
```ts
.select([
  'planApplication',
  'subscriptionPlan.id',
  'subscriptionPlan.name',
  'subscriptionPlan.status',
  'application.id',
  'application.name',
  'application.category',  // ← add this
  'application.status',
])
```

**Add conditional filter after the existing status filters:**
```ts
if (query.subscriptionPlanId) {
  qb.andWhere('subscriptionPlan.id = :subscriptionPlanId', {
    subscriptionPlanId: query.subscriptionPlanId,
  });
}
```

**Add `application.category` to the mapped response:**
```ts
const mapped = data.map((item) => ({
  id: item.id,
  limits: item.limits,
  status: item.status,
  subscriptionPlan: {
    id: item.subscriptionPlan.id,
    name: item.subscriptionPlan.name,
  },
  application: {
    id: item.application.id,
    name: item.application.name,
    category: item.application.category,  // ← add this
  },
}));
```

---

## Frontend

### Types — `src/types/subscription.ts`

Add `PlanApplication` interface:

```ts
export interface PlanApplication {
  id: number;
  subscriptionPlan: { id: number; name: string };
  application: { id: number; name: string; category: string };
  limits: string;
  status: string;
}
```

---

### Service — `src/services/saasService.ts`

Add `getPlanApplications` after `getFeatures`:

```ts
async getPlanApplications(planId: number): Promise<PlanApplication[]> {
  const response = await saasApiFetch<{
    data: PlanApplication[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>(`plan-applications?subscriptionPlanId=${planId}&limit=100`);
  return response.data;
},
```

Import `PlanApplication` from `../types/subscription`.

---

### Shell — `src/components/SaaSDashboard/SaaSDashboard.tsx`

**1. Add `selectedPlan` state:**
```ts
const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
```

**2. Extend `handleNavigateView` signature (backward-compatible):**
```ts
const handleNavigateView = (view: string, plan?: SubscriptionPlan) => {
  if (plan) setSelectedPlan(plan);
  setActiveTab(view);
};
```

**3. Extend `onNavigate` prop type for all child views:**

Change all `onNavigate?: (view: string) => void` prop types to:
```ts
onNavigate?: (view: string, plan?: SubscriptionPlan) => void
```

Affected views: `SubscriptionPlansView`, `PlatformApplicationsView`, `PlatformFeatureCatalogView`.

**4. Breadcrumbs — add `subscription-plan-applications` case:**

In the existing breadcrumb nav block (currently checks for `subscription-applications`, `subscription-live-installs`, `subscription-features`), add `subscription-plan-applications`:

```tsx
(activeTab === 'subscription-plan-applications' ||
 activeTab === 'subscription-applications' ||
 activeTab === 'subscription-live-installs' ||
 activeTab === 'subscription-features') && (
  <nav ...>
    <span>SaaS Admin</span>
    <span className="text-[#d51f2c]">›</span>
    <span>
      {activeTab === 'subscription-plan-applications'
        ? 'Subscription Architecture'
        : 'Platform Architecture'}
    </span>
    <span className="text-[#d51f2c]">›</span>
    <span className="text-[#1d1c17]">
      {activeTab === 'subscription-plan-applications'
        ? 'Plan Applications'
        : activeTab === 'subscription-applications'
        ? 'Applications'
        : activeTab === 'subscription-live-installs'
        ? 'Live Installs'
        : 'Feature Catalog'}
    </span>
  </nav>
)
```

**5. Header title/description — add `subscription-plan-applications` case:**

In the `h1` ternary chain, add:
```
: activeTab === 'subscription-plan-applications' ? 'Plan Applications'
```

In the description `p` ternary chain, add:
```
: activeTab === 'subscription-plan-applications'
  ? `Applications bundled into the "${selectedPlan?.name}" subscription tier.`
```

**6. `renderContent` — add new case:**
```ts
if (activeTab === 'subscription-plan-applications' && selectedPlan) {
  return (
    <PlanApplicationsView
      plan={selectedPlan}
      onNavigate={handleNavigateView}
    />
  );
}
```

Import `PlanApplicationsView` at the top of the file.

**7. Sidebar active state** — already compatible. The existing check is:
```ts
item.id === 'subscription' && activeTab.startsWith('subscription-')
```
`'subscription-plan-applications'` starts with `'subscription-'` → Subscription Plans tab highlights correctly.

---

### `SubscriptionPlansView.tsx` — row action button

In the Actions column of each plan row, add a "View Applications" button before the edit button. Only shown for non-deleted plans:

```tsx
{plan.status !== 'deleted' && (
  <button
    type="button"
    aria-label={`View applications for ${plan.name}`}
    onClick={() => onNavigate?.('subscription-plan-applications', plan)}
    className="p-1 hover:text-[#ae001a] transition-colors"
  >
    <span className="material-symbols-outlined text-xl">grid_view</span>
  </button>
)}
```

Update the component's `onNavigate` prop type:
```ts
interface SubscriptionPlansViewProps {
  onNavigate?: (view: string, plan?: SubscriptionPlan) => void;
}
```

---

### New component — `src/components/SaaSDashboard/PlanApplicationsView.tsx`

**Props:**
```ts
interface PlanApplicationsViewProps {
  plan: SubscriptionPlan;
  onNavigate?: (view: string) => void;
}
```

**State:**
```ts
const [planApplications, setPlanApplications] = useState<PlanApplication[]>([]);
const [loading, setLoading] = useState(true);
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```

**Data fetch on mount:**
```ts
useEffect(() => {
  saasService
    .getPlanApplications(plan.id)
    .then(setPlanApplications)
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to load plan applications';
      if (msg === 'SESSION_EXPIRED') {
        setToast({ message: 'Session expired. Please refresh the page to sign in again.', type: 'error' });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    })
    .finally(() => setLoading(false));
}, [plan.id]);
```

**Layout structure:**
```
<div className="flex flex-col gap-6">

  {/* Dark Title Card */}
  <div className="bg-[#222222] px-6 py-4">
    <span className="text-[11px] font-bold uppercase tracking-widest text-white">
      APPLICATIONS BOUND TO PLAN: {plan.name}
    </span>
  </div>

  {/* Empty State OR Table */}
  {!loading && planApplications.length === 0 ? (
    <EmptyState />
  ) : (
    <TableCard loading={loading} rows={planApplications} />
  )}

  {/* Footer */}
  <footer>
    <button onClick={() => onNavigate?.('subscription')}> ← Back to Subscription Plans </button>
    © 2026 X7 ...
  </footer>

  {toast && <Toast ... />}
</div>
```

**Table columns:**

| Column header | Content |
|---|---|
| LINKED APPLICATION & ID | Bold `application.name` + `<code>` snippet showing `id` |
| SOFTWARE CATEGORY | Tag chip: `bg-[#f2ede5] border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase px-2 py-0.5 rounded` |
| USAGE RESTRICTIONS | `<p className="text-sm text-[#5f5e5e]">{limits}</p>` |
| ASSOCIATION STATUS | Badge: active → `bg-green-500/10 text-green-600`; inactive → `bg-[#5f5e5e]/20 text-[#5f5e5e]` |

**Loading skeleton:** 3 rows, each cell has `h-4 bg-[#ece8e0] rounded animate-pulse`. Same pattern as other views.

**Empty state (AC 4):**
```tsx
<div data-testid="empty-state" className="flex flex-col items-center justify-center py-24 gap-6">
  <span className="material-symbols-outlined text-[#5f5e5e]" style={{ fontSize: '72px' }}>
    app_registration
  </span>
  <div className="text-center">
    <h3 className="text-xl font-bold text-[#1d1c17]">No Applications Linked</h3>
    <p className="text-sm text-[#5f5e5e] mt-2 max-w-md text-center">
      This subscription plan currently has no applications linked.
      Click &apos;Associate Application&apos; to bundle your first software module.
    </p>
  </div>
  <button
    type="button"
    onClick={() => onNavigate?.('subscription')}
    className="text-[#ae001a] text-sm font-semibold hover:underline"
  >
    ← Back to Subscription Plans
  </button>
</div>
```

**Toast sub-component:** Reuse same pattern as `SubscriptionPlansView` (`Toast` component with auto-dismiss at 3 seconds).

---

### Tests — `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`

Mock setup: `vi.mock('../../services/saasService', ...)` with `getPlanApplications: vi.fn()`. Provide a stub `plan` object.

| Test case | Assertion |
|---|---|
| Loading state | 3 skeleton rows visible, table cells have `animate-pulse` |
| Table renders with data | Rows equal to mock data length, application names visible |
| Dark title card shows plan name | `APPLICATIONS BOUND TO PLAN: {plan.name}` in document |
| Linked Application column | Bold name + code snippet with `id` |
| Software Category column | Category text inside tag chip |
| Usage Restrictions column | `limits` text rendered |
| Active status badge | `bg-green-500/10` badge with text "active" |
| Inactive status badge | Muted grey badge with text "inactive" |
| Empty state (AC 4) | `data-testid="empty-state"` visible, exact empty-state message text |
| API error → error toast | Toast with error message appears |
| SESSION_EXPIRED → session toast | Session expired message appears |

---

## Files Changed

| File | Repo | Change |
|---|---|---|
| `src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts` | backend | Add `subscriptionPlanId` field |
| `src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts` | backend | Filter by planId + expose `application.category` |
| `src/types/subscription.ts` | frontend | Add `PlanApplication` interface |
| `src/services/saasService.ts` | frontend | Add `getPlanApplications` method |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | frontend | `selectedPlan` state, nav extended, new case, breadcrumbs, header |
| `src/components/SaaSDashboard/SubscriptionPlansView.tsx` | frontend | `grid_view` button on each row + updated `onNavigate` type |
| `src/components/SaaSDashboard/PlanApplicationsView.tsx` | frontend | **New** — read-only view |
| `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` | frontend | **New** — ~11 test cases |
