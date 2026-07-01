# Design Spec: Plan Features View

**Date:** 2026-07-01
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Context

As a SaaS Owner / Platform Super Administrator, I want to view a structured data table displaying the feature toggles and quantitative resource limits mapped to a specific Subscription Plan, so I can audit exactly what granular capabilities and usage caps are bundled into each commercial tier.

This view is accessed from the Subscription Plans master table by drilling into a specific plan row. It renders inside the existing SaaSDashboard shell (dark sidebar, top header with breadcrumbs, footer) — the same shell pattern used by Plan Applications.

Unlike the original (read-only) Plan Applications ticket, this ticket includes full CRUD from the start: Map Feature (create), Edit (limit_value + status), and Delete (soft-delete), because the backend already implements all four operations and the sibling views (Plan Applications, Feature Catalog) already established this level of parity.

### Acceptance Criteria (verbatim from ticket)

- **AC1:** Interface layers inside the shell — dark sidebar, breadcrumbs (`SaaS Admin › Subscription Architecture › Plan Features`), global footer.
- **AC2:** Drilling into a plan shows an isolated sub-panel with dark title banner (`#222222`) reading `FEATURE ENTITLEMENTS BOUND TO PLAN: [Plan_Name]`.
- **AC3:** Table rows expose: Feature Identity (bold `feature.name` + monospace `feature.id` badge below), Measurement Unit (`feature.Unit` in brackets, e.g. `[user]`), Assigned Quantitative Cap (`limit_value` formatted to 2 decimals), Entitlement Status (emerald badge for `active`, dark grey badge for `inactive`).
- **AC4:** If the plan has zero `plan_features` rows, hide the table and show a centered empty state: *"This subscription plan currently has no features or limits mapped. Click 'Map Feature' to establish your first entitlement rule."*

---

## Backend Changes (`x7-pos-back-end`)

Three minimal changes to the existing `plan-features` module. No migrations, no new endpoints.

### 1. `QueryPlanFeatureDto` — add `subscriptionPlanId` filter

File: `src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts`

Add after the existing `status` field, mirroring `query-plan-application.dto.ts`:

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

### 2. `PlanFeaturesService.findAll` — filter by plan + expose `feature.Unit`

File: `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`

**Add `feature.Unit` to the QueryBuilder select** (currently only selects `feature.id`, `feature.name`, `feature.status`):
```ts
.select([
  'planFeature',
  'subscriptionPlan.id',
  'subscriptionPlan.name',
  'subscriptionPlan.status',
  'feature.id',
  'feature.name',
  'feature.Unit',   // ← add this
  'feature.status',
])
```

**Add conditional filter** (after the existing status filters, same position as Plan Applications):
```ts
if (query.subscriptionPlanId) {
  qb.andWhere('subscriptionPlan.id = :subscriptionPlanId', {
    subscriptionPlanId: query.subscriptionPlanId,
  });
}
```

**Add `unit` to the mapped response:**
```ts
const mapped: PlanFeatureResponseDto[] = data.map((item) => ({
  id: item.id,
  limit_value: Number(item.limit_value),
  status: item.status,
  subscriptionPlan: {
    id: item.subscriptionPlan.id,
    name: item.subscriptionPlan.name,
  },
  feature: {
    id: item.feature.id,
    name: item.feature.name,
    unit: item.feature.Unit,   // ← add this
  },
}));
```

Update `PlanFeatureResponseDto` (`dto/plan-feature-response.dto.ts`) to reflect `feature: { id: number; name: string; unit: string }`.

### 3. `PlanFeaturesService.update` — apply `status`, not just `limit_value`

File: `src/platform-saas/subscriptions/plan-features/plan-features.service.ts`

Current code only applies `limit_value` from the DTO even though `UpdatePlanFeatureDto` (which extends `CreatePlanFeatureDto`) also carries `status`. Fix:

```ts
if (dto.limit_value !== undefined) {
  planFeature.limit_value = dto.limit_value;
}
if (dto.status !== undefined) {
  planFeature.status = dto.status;
}
```

`subscriptionPlan`/`feature` reassignment via update is intentionally out of scope — a plan-feature mapping is not meant to be moved to a different plan/feature; it should be deleted and re-created instead.

### Backend test updates

Extend `plan-features.service.spec.ts` and `plan-features.controller.spec.ts` to cover: `subscriptionPlanId` filtering, `unit` present in `findAll` response, and `update` persisting `status`.

---

## Frontend

### Types — `src/types/subscription.ts`

```ts
export interface PlanFeature {
  id: number;
  subscriptionPlan: { id: number; name: string };
  feature: { id: number; name: string; unit: string };
  limit_value: number;
  status: string;
}

export interface CreatePlanFeatureDto {
  subscriptionPlan: number;
  feature: number;
  limit_value: number;
  status: 'active';
}

export interface UpdatePlanFeatureDto {
  limit_value: number;
  status: 'active' | 'inactive';
}
```

### Service — `src/services/saasService.ts`

Add after `updatePlanApplication`, following the exact pattern of the plan-applications methods:

```ts
async getPlanFeatures(planId: number): Promise<PlanFeature[]> {
  const response = await saasApiFetch<{
    data: PlanFeature[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>(`plan-features?subscriptionPlanId=${planId}&limit=100`);
  return response.data;
},

async createPlanFeature(dto: CreatePlanFeatureDto): Promise<PlanFeature> {
  const response = await saasApiFetch<{ data: PlanFeature }>(
    'plan-features',
    { method: 'POST', body: JSON.stringify(dto) },
  );
  return response.data;
},

async updatePlanFeature(id: number, dto: UpdatePlanFeatureDto): Promise<PlanFeature> {
  const response = await saasApiFetch<{ data: PlanFeature }>(
    `plan-features/${id}`,
    { method: 'PATCH', body: JSON.stringify(dto) },
  );
  return response.data;
},

async deletePlanFeature(id: number): Promise<PlanFeature> {
  const response = await saasApiFetch<{ data: PlanFeature }>(
    `plan-features/${id}`,
    { method: 'DELETE' },
  );
  return response.data;
},
```

Import `PlanFeature`, `CreatePlanFeatureDto`, `UpdatePlanFeatureDto` from `../types/subscription`.

---

### Shell — `src/components/SaaSDashboard/SaaSDashboard.tsx`

**1. `renderContent` — add new case** (import `PlanFeaturesView`):
```ts
if (activeTab === 'subscription-plan-features' && selectedPlan) {
  return (
    <PlanFeaturesView
      plan={selectedPlan}
      onNavigate={handleNavigateView}
    />
  );
}
```

**2. Breadcrumbs — add `subscription-plan-features` to the condition and label chain:**
```tsx
(activeTab === 'subscription-plan-applications' ||
 activeTab === 'subscription-plan-features' ||
 activeTab === 'subscription-applications' ||
 activeTab === 'subscription-live-installs' ||
 activeTab === 'subscription-features') && (
  <nav ...>
    <span>SaaS Admin</span>
    <span className="text-[#d51f2c]">›</span>
    <span>
      {activeTab === 'subscription-plan-applications' || activeTab === 'subscription-plan-features'
        ? 'Subscription Architecture'
        : 'Platform Architecture'}
    </span>
    <span className="text-[#d51f2c]">›</span>
    <span className="text-[#1d1c17]">
      {activeTab === 'subscription-plan-applications'
        ? 'Plan Applications'
        : activeTab === 'subscription-plan-features'
        ? 'Plan Features'
        : activeTab === 'subscription-applications'
        ? 'Applications'
        : activeTab === 'subscription-live-installs'
        ? 'Live Installs'
        : 'Feature Catalog'}
    </span>
  </nav>
)
```

**3. Header title/description — add case:**
```
: activeTab === 'subscription-plan-features' ? 'Plan Features'
```
```
: activeTab === 'subscription-plan-features'
  ? `Feature entitlements and quantitative limits bundled into the "${selectedPlan?.name}" subscription tier.`
```

`selectedPlan` state and `handleNavigateView`/`onNavigate` signature are already generalized to `(view: string, plan?: SubscriptionPlan)` from the Plan Applications work — no change needed there.

---

### `SubscriptionPlansView.tsx` — new row action button

Add a "View Features" icon button in the Actions column, alongside the existing `grid_view` (Applications) button, only for non-deleted plans:

```tsx
{plan.status !== 'deleted' && (
  <button
    type="button"
    aria-label={`View features for ${plan.name}`}
    onClick={() => onNavigate?.('subscription-plan-features', plan)}
    className="p-1 hover:text-[#ae001a] transition-colors"
  >
    <span className="material-symbols-outlined text-xl">tune</span>
  </button>
)}
```

---

### New component — `src/components/SaaSDashboard/PlanFeaturesView.tsx`

Mirrors `PlanApplicationsView.tsx` structurally (same file shape: dialogs defined above the main component, single default export).

**Props:**
```ts
interface PlanFeaturesViewProps {
  plan: SubscriptionPlan;
  onNavigate?: (view: string) => void;
}
```

**State:**
```ts
const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
const [loading, setLoading] = useState(true);
const [fetchError, setFetchError] = useState(false);
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState('');
const [showMapModal, setShowMapModal] = useState(false);
const [availableFeatures, setAvailableFeatures] = useState<PlatformFeature[]>([]);
const [loadingFeatures, setLoadingFeatures] = useState(false);
const [mapSubmitting, setMapSubmitting] = useState(false);
const [editingPF, setEditingPF] = useState<PlanFeature | null>(null);
const [editSubmitting, setEditSubmitting] = useState(false);
const [deletingPF, setDeletingPF] = useState<PlanFeature | null>(null);
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
```

**Data fetch on mount:** `saasService.getPlanFeatures(plan.id)`, same error/SESSION_EXPIRED handling pattern as `PlanApplicationsView`.

**Layout structure:**
```
<div className="flex flex-col gap-6">

  {/* Dark Title Card (AC2) */}
  <div className="bg-[#222222] px-6 py-4">
    <span className="text-[11px] font-bold uppercase tracking-widest text-white">
      FEATURE ENTITLEMENTS BOUND TO PLAN: {plan.name}
    </span>
  </div>

  {/* Empty State (AC4) OR Table */}
  {!loading && !fetchError && planFeatures.length === 0 ? (
    <EmptyState onMap={openMapModal} onBack={() => onNavigate?.('subscription')} />
  ) : (
    <TableCard loading={loading} rows={filteredFeatures} onMap={openMapModal} onEdit={setEditingPF} onDelete={setDeletingPF} />
  )}

  {/* Quick Launch */}
  <QuickLaunchPanel onNavigate={onNavigate} />

  {/* Footer (AC1) */}
  <footer>
    <button onClick={() => onNavigate?.('subscription')}>← Back to Subscription Plans</button>
    © 2026 X7 Point of Sale. All rights reserved.
  </footer>

  {/* FAB */}
  {!fetchError && <FabButton onClick={openMapModal} />}

  {showMapModal && <MapFeatureDialog .../>}
  {editingPF && <EditPlanFeatureDialog .../>}
  {deletingPF && <DeletePlanFeatureDialog .../>}
  {toast && <Toast .../>}
</div>
```

**Table columns (AC3):**

| Column header | Content |
|---|---|
| FEATURE IDENTITY | Bold `pf.feature.name` + `<code>` badge below showing `pf.feature.id` (same cell pattern as Plan Applications' "Linked Application & ID") |
| MEASUREMENT UNIT | `<span className="font-mono text-xs text-[#5f5e5e]">[{pf.feature.unit}]</span>` |
| ASSIGNED CAP | `{Number(pf.limit_value).toFixed(2)}`, right-aligned |
| ENTITLEMENT STATUS | Badge: `active` → `bg-green-500/10 text-green-600`; `inactive` → `bg-[#5f5e5e]/20 text-[#5f5e5e]` (no `deleted` case — deleted rows never reach the client because `findAll` excludes them by default) |
| ACTIONS | Edit (pencil, opens `EditPlanFeatureDialog`) + Delete (trash, opens `DeletePlanFeatureDialog`), hover-reveal like other views |

**Loading skeleton:** 3 rows, `h-4 bg-[#ece8e0] rounded animate-pulse` per cell — same pattern as `PlanApplicationsView`.

**Empty state (AC4, exact copy):**
```tsx
<div data-testid="empty-state" className="flex flex-col items-center justify-center py-24 gap-6">
  <span className="material-symbols-outlined text-[#5f5e5e] text-[72px]">tune</span>
  <div className="text-center">
    <h3 className="text-xl font-bold text-[#1d1c17]">No Features Mapped</h3>
    <p className="text-sm text-[#5f5e5e] mt-2 max-w-md text-center">
      This subscription plan currently has no features or limits mapped.
      Click &apos;Map Feature&apos; to establish your first entitlement rule.
    </p>
  </div>
  <button
    type="button"
    onClick={openMapModal}
    className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
  >
    <span className="material-symbols-outlined text-base">add_link</span>
    MAP FEATURE
  </button>
  <button
    type="button"
    onClick={() => onNavigate?.('subscription')}
    className="text-[#ae001a] text-sm font-semibold hover:underline"
  >
    ← Back to Subscription Plans
  </button>
</div>
```

**Filter controls row** (search by feature name + status filter dropdown active/inactive), identical pattern to `PlanApplicationsView`'s filter row, plus a "MAP FEATURE" button.

**`MapFeatureDialog` (create):**
- Dark header `MAP FEATURE`.
- Read-only `Subscription Plan` input (`plan.name`).
- `Feature` select populated from `saasService.getFeatures()` filtered to `status === 'active'` AND excluding features already mapped to this plan (`!existingFeatureIds.has(f.id)`, computed from current `planFeatures`, mirroring `AssociateAppDialog`'s `availableApps` logic).
- `Assigned Cap` numeric input (`type="number"`, `min="0"`, `step="0.01"`), required.
- On save: `saasService.createPlanFeature({ subscriptionPlan: plan.id, feature: selectedFeatureId, limit_value: Number(limitValue), status: 'active' })`.

**`EditPlanFeatureDialog`:**
- Dark header `EDIT PLAN-FEATURE`.
- Read-only `Subscription Plan` and `Feature` inputs.
- `Assigned Cap` numeric input (prefilled with current `limit_value`).
- `Entitlement Status` select (`active`/`inactive`), prefilled.
- On save: `saasService.updatePlanFeature(pf.id, { limit_value, status })`.

**`DeletePlanFeatureDialog`:**
- Confirmation dialog, mirrors Feature Catalog's `DeleteFeatureDialog`: "Are you sure you want to remove this entitlement? This will unmap **{feature.name}** from **{plan.name}**."
- On confirm: `saasService.deletePlanFeature(pf.id)` → remove the row from local `planFeatures` state (soft-deleted rows are excluded from the view; no "deleted" badge state needed here, unlike Feature Catalog which lists deleted features).

**Toast:** Same auto-dismiss-at-3s pattern as `PlanApplicationsView`.

---

### Tests — `src/components/SaaSDashboard/PlanFeaturesView.test.tsx`

Mock `saasService` (`getPlanFeatures`, `getFeatures`, `createPlanFeature`, `updatePlanFeature`, `deletePlanFeature`). Stub `plan: SubscriptionPlan` and `MOCK_PLAN_FEATURES: PlanFeature[]`.

| Test case | Assertion |
|---|---|
| Loading state | 3 skeleton rows visible |
| Dark title banner | `FEATURE ENTITLEMENTS BOUND TO PLAN: {plan.name}` in document |
| Table renders with data | Row count matches mock data |
| Feature Identity column | Bold name + monospace `id` badge below |
| Measurement Unit column | `[{unit}]` rendered |
| Assigned Cap column | `limit_value` formatted to exactly 2 decimals (e.g. `10.00`, `500.00`) |
| Entitlement Status — active | Emerald badge (`bg-green-500/10 text-green-600`), text "active" |
| Entitlement Status — inactive | Dark grey badge (`bg-[#5f5e5e]/20 text-[#5f5e5e]`), text "inactive" |
| Empty state (AC4) | `data-testid="empty-state"` visible, table absent, exact message text present |
| Map Feature flow | Opens dialog, excludes already-mapped features from the select, submits, new row appears |
| Edit flow | Opens dialog prefilled, submits, row updates |
| Delete flow | Opens confirm dialog, submits, row removed from table |
| Search/status filter | Filtering narrows visible rows |
| API error → error toast | Toast with error message appears |
| SESSION_EXPIRED → session toast | Session expired message appears |

Also extend `SaaSDashboard`-level integration coverage (or add a focused test) verifying the breadcrumb reads `SaaS Admin › Subscription Architecture › Plan Features` when `activeTab === 'subscription-plan-features'`.

---

## Files Changed

| File | Repo | Change |
|---|---|---|
| `src/platform-saas/subscriptions/plan-features/dto/query-plan-feature.dto.ts` | backend | Add `subscriptionPlanId` field |
| `src/platform-saas/subscriptions/plan-features/dto/plan-feature-response.dto.ts` | backend | Add `unit` to nested `feature` shape |
| `src/platform-saas/subscriptions/plan-features/plan-features.service.ts` | backend | Filter by planId, expose `feature.Unit`, persist `status` on update |
| `src/platform-saas/subscriptions/plan-features/plan-features.service.spec.ts` | backend | Cover the 3 changes above |
| `src/platform-saas/subscriptions/plan-features/plan-features.controller.spec.ts` | backend | Cover filtered query param |
| `src/types/subscription.ts` | frontend | Add `PlanFeature`, `CreatePlanFeatureDto`, `UpdatePlanFeatureDto` |
| `src/services/saasService.ts` | frontend | Add `getPlanFeatures`, `createPlanFeature`, `updatePlanFeature`, `deletePlanFeature` |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | frontend | New `renderContent` case, breadcrumbs, header title/description |
| `src/components/SaaSDashboard/SubscriptionPlansView.tsx` | frontend | `tune` row-action button |
| `src/components/SaaSDashboard/PlanFeaturesView.tsx` | frontend | **New** — full CRUD view |
| `src/components/SaaSDashboard/PlanFeaturesView.test.tsx` | frontend | **New** — ~15 test cases |
