# Platform Applications — Toggle Status Feature

**Date:** 2026-06-22
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Overview

Replace the placeholder stub for the `subscription-applications` tab with a fully functional `PlatformApplicationsView` component. The view lists Platform Applications from the real backend API and allows a SaaS Owner to deactivate an application via a "Toggle Status" action, instead of a hard delete.

---

## Acceptance Criteria

- **AC1** The actions column must feature a lock icon ("Toggle Status") button instead of a destructive delete option.
- **AC2** Clicking the lock icon launches a confirmation modal warning that deactivating the app will affect downstream plan-applications and subscription-applications.
- **AC3** Confirming executes `PATCH /api/applications/:id` with `status: 'inactive'` (full object sent because backend DTO requires all fields).
- **AC4** Inactive rows instantly render with `opacity-75` and a neutral grey "Inactive" badge.

---

## Architecture

### 1. Types — `src/types/subscription.ts`

Add:

```ts
export interface Application {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'inactive';
}
```

No new DTOs needed — toggle only sends `status: 'inactive'` alongside the existing app fields.

### 2. Service — `src/services/saasService.ts`

Add two methods to `saasService`:

| Method | HTTP | Endpoint | Notes |
|---|---|---|---|
| `getApplications()` | GET | `/api/applications` | Returns `{ data: Application[], pagination: {...} }` |
| `toggleApplicationInactive(app: Application)` | PATCH | `/api/applications/:id` | Sends full object with `status: 'inactive'`; returns `{ data: Application }` |

Full object sent on PATCH because `UpdateApplicationDto extends CreateApplicationDto` and all fields carry `@IsNotEmpty()` validators on the backend.

### 3. New Component — `src/components/SaaSDashboard/PlatformApplicationsView.tsx`

Self-contained component following the `SubscriptionPlansView` pattern.

**State:**
- `applications: Application[]`
- `loading: boolean`
- `searchTerm: string`
- `statusFilter: 'All Status' | 'active' | 'inactive'`
- `togglingApp: Application | null` — drives the confirmation modal
- `toggleSubmitting: boolean`
- `toast: { message: string; type: 'success' | 'error' } | null`

**Filter strip (card):**
- Text search input (searches name + description)
- Status select: `All Status / active / inactive`
- Clear filters button

**Table card:**
- Header: dark `#222222` bar — "PLATFORM APPLICATIONS" label + count
- Columns: App Name & ID | Description | Category | Status | Actions
- Loading skeletons (3 rows with pulse animation)
- Empty state with `inventory_2` icon
- No-results state with "Clear filters" link

**Row rendering:**
- `active` row: normal opacity, red `#ae001a` left accent bar, green "active" badge
- `inactive` row: `opacity-75`, grey `#c8c6c5` left accent bar, grey "Inactive" badge
- Actions (visible on hover via `group-hover:opacity-100`):
  - `edit` icon button — stub (shows `alert('Edit simulation')`)
  - `lock` icon button — only rendered when `status === 'active'`; triggers confirmation modal

**Deactivation confirmation modal (`DeactivateAppDialog`):**
- Header: `DEACTIVATE APPLICATION`
- Body: `"Deactivating '[App Name]' will affect all downstream subscription bundles (plan-applications) and operational storefront access points (subscription-applications). This application will no longer be distributed to new subscribers."`
- Buttons: Cancel | Deactivate (red)

**Toast:** 3-second auto-dismiss, same pattern as SubscriptionPlansView.

### 4. Integration — `src/components/SaaSDashboard/SaaSDashboard.tsx`

Replace the stub block for `activeTab === 'subscription-applications'` (lines 78–113) with:

```tsx
if (activeTab === 'subscription-applications') {
  return <PlatformApplicationsView />;
}
```

---

## Scope Boundary

- Only the active → inactive direction is implemented per AC3. Re-activation from this view is out of scope.
- The Edit button is a stub (`alert`). Full edit CRUD is a separate story.
- No pagination controls in the table (renders all results from the API).

---

## Design Tokens (matching existing system)

| Token | Value |
|---|---|
| Active badge | `bg-green-500/10 text-green-600` |
| Inactive badge | `bg-[#5f5e5e]/20 text-[#5f5e5e]` |
| Inactive row | `opacity-75` |
| Active accent bar | `bg-[#ae001a]` |
| Inactive accent bar | `bg-[#c8c6c5]` |
| CTA red | `#ae001a` / hover `#930015` |
| Background warm | `#fef9f1` |
| Border | `#e8e2d8` |

---

## Files Changed

| File | Change |
|---|---|
| `src/types/subscription.ts` | Add `Application` interface |
| `src/services/saasService.ts` | Add `getApplications`, `toggleApplicationInactive` |
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | New file |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | Replace stub with `<PlatformApplicationsView />` |
