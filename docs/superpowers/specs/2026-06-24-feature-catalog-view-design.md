# Design Spec: Platform Feature Catalog View

**Date:** 2026-06-24
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Overview

Replace the current `subscription-features` stub in `SaaSDashboard` with a real read-only master directory view: `PlatformFeatureCatalogView`. It fetches all platform feature flags and entitlement records from `GET /api/features` and renders them in a structured data table.

Two Quick Launch buttons are also renamed for consistency: "FEATURE CATALOG MAP" (SubscriptionPlansView) and "FEATURE CATALOG INDEX" (PlatformApplicationsView) both become "FEATURE CATALOG".

---

## Acceptance Criteria

- **AC 1** — Layout inherits the established shell: dark sidebar (`#222222`), top header, and breadcrumb path `SaaS Admin › Platform Architecture › Feature Catalog` in the main content header.
- **AC 2** — Main panel shows a data table titled **"PLATFORM FEATURE CATALOG MASTER"** inside a dark `#222222` layout header block.
- **AC 3** — Table rows expose four columns from `FeatureEntity`:
  - **Feature Identity**: bold `name` as primary text + monospace `feature_{id}` label below in muted color.
  - **Scope Definition**: `description` as a muted subtitle string.
  - **Billing / Measurement Unit**: `Unit` field rendered as a bracketed tag (e.g., `[unit]`, `[user]`, `[gb]`) — always lowercase.
  - **Status Badge**: color-coded — bright emerald green for `"active"`, charcoal grey for `"inactive"`.
- **AC 4** — If `data` array is empty, hide the table and render a centered empty-state block: _"No feature definitions found. Click 'Create Feature' to establish your first system capability flag."_

---

## Backend Contract

**Endpoint:** `GET http://localhost:3001/api/features`
**Auth:** JWT Bearer token from `getSaasAuthToken()` (localStorage key `x7_saas_admin_token`)
**Response shape:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Advanced Analytics",
      "description": "Provides advanced data analytics capabilities",
      "Unit": "unit",
      "status": "active"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

**Key nuance:** The entity column is `Unit` with a capital U — the TypeScript interface must match this exactly. `status` is a plain `string` in the entity (not a union type) but will be `"active"` or `"inactive"` in practice.

---

## TypeScript Interface

Add to `src/types/subscription.ts`:

```ts
export interface PlatformFeature {
  id: number;
  name: string;
  description: string;
  Unit: string;   // capital U — matches backend entity column
  status: string; // 'active' | 'inactive'
}
```

---

## Service Function

Add to `src/services/saasService.ts`:

```ts
export async function getFeatures(): Promise<PlatformFeature[]> {
  const token = getSaasAuthToken();
  const res = await fetch('http://localhost:3001/api/features', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch features');
  const json = await res.json();
  return json.data as PlatformFeature[];
}
```

---

## Component: PlatformFeatureCatalogView

**File:** `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`

**Props:**
```ts
interface Props {
  onNavigate?: (view: string) => void;
}
```
(`onNavigate` is optional and reserved for future Quick Launch additions — not rendered in AC scope.)

### State
- `features: PlatformFeature[]`
- `loading: boolean`
- `error: string | null`

### Load pattern
`useEffect` on mount → `getFeatures()` → set state. Matches `PlatformApplicationsView` exactly.

### Layout structure

```
<div class="space-y-0">
  <!-- Header block -->
  <div class="bg-[#222222] px-6 py-4">
    <h2>PLATFORM FEATURE CATALOG MASTER</h2>
    <p class="text-white/50 text-xs">Feature flags and entitlement definitions for this platform.</p>
    <!-- Column headers row -->
    <div class="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 mt-4">
      FEATURE IDENTITY | SCOPE DEFINITION | UNIT | STATUS
    </div>
  </div>

  <!-- Data rows (shown when features.length > 0) -->
  {features.map(f => (
    <div class="grid grid-cols-[2fr_3fr_1fr_1fr] border-b border-[#e8e2d8] px-6 py-4 bg-white hover:bg-[#f9f7f4] group">
      <!-- Feature Identity -->
      <div>
        <p class="font-bold text-[#1d1c17] text-sm">{f.name}</p>
        <code class="text-[11px] text-[#5f5e5e] font-mono">feature_{f.id}</code>
      </div>
      <!-- Scope Definition -->
      <div>
        <p class="text-sm text-[#5f5e5e]">{f.description}</p>
      </div>
      <!-- Unit tag -->
      <div>
        <span class="text-[10px] font-bold uppercase tracking-widest border border-[#222222] px-2 py-0.5 text-[#222222] font-mono">
          [{f.Unit.toLowerCase()}]
        </span>
      </div>
      <!-- Status badge -->
      <div>
        {f.status === 'active'
          ? <span class="bg-emerald-500 text-white text-[10px] font-bold uppercase px-2 py-0.5">active</span>
          : <span class="bg-[#444444] text-white text-[10px] font-bold uppercase px-2 py-0.5">inactive</span>
        }
      </div>
    </div>
  ))}

  <!-- Empty state (shown when features.length === 0 and not loading) -->
  <div class="flex flex-col items-center text-center p-16 bg-white border border-[#e8e2d8]">
    <span class="material-symbols-outlined text-[#d51f2c] text-6xl">featured_play_list</span>
    <p class="text-[#5f5e5e] mt-4 max-w-sm">
      No feature definitions found. Click 'Create Feature' to establish your first system capability flag.
    </p>
  </div>
</div>
```

### Loading state
Centered `material-symbols-outlined` spinner `progress_activity` — same style as PlatformApplicationsView.

### Error state
Red-bordered block with error message — same style as PlatformApplicationsView.

---

## SaaSDashboard.tsx Changes

### 1. Import and mount
```ts
import { PlatformFeatureCatalogView } from './PlatformFeatureCatalogView';

// In renderContent():
if (activeTab === 'subscription-features') {
  return <PlatformFeatureCatalogView onNavigate={handleNavigateView} />;
}
```

Remove `'subscription-features'` from the stub fallback `if` condition.

### 2. Breadcrumb
Extend the existing breadcrumb condition to include `subscription-features`:

```tsx
{(activeTab === 'subscription-applications' ||
  activeTab === 'subscription-live-installs' ||
  activeTab === 'subscription-features') && (
  <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
    <span>SaaS Admin</span>
    <span className="text-[#d51f2c]">›</span>
    <span>Platform Architecture</span>
    <span className="text-[#d51f2c]">›</span>
    <span className="text-[#1d1c17]">
      {activeTab === 'subscription-applications' ? 'Applications'
        : activeTab === 'subscription-live-installs' ? 'Live Installs'
        : 'Feature Catalog'}
    </span>
  </nav>
)}
```

---

## Quick Launch Button Renames

### SubscriptionPlansView.tsx
Line ~493: `FEATURE CATALOG MAP` → `FEATURE CATALOG`

### PlatformApplicationsView.tsx
Line ~695: `FEATURE CATALOG INDEX` → `FEATURE CATALOG`

### PlatformApplicationsView.test.tsx
Three assertions updated from `'FEATURE CATALOG INDEX'` to `'FEATURE CATALOG'`:
- `getByRole('button', { name: 'FEATURE CATALOG' })` in the renders-all-four-buttons test
- `getByRole('button', { name: 'FEATURE CATALOG' })` in the navigation click test (×2)

---

## Tests: PlatformFeatureCatalogView.test.tsx

Coverage plan (matches PlatformApplicationsView.test.tsx structure):

| Suite | Tests |
|---|---|
| Loading state | Shows spinner while fetching |
| Error state | Shows error block when API throws |
| Data table | Renders header "PLATFORM FEATURE CATALOG MASTER" |
| Data table | Renders feature name as bold primary text |
| Data table | Renders monospace `feature_{id}` code below name |
| Data table | Renders description as muted subtitle |
| Data table | Renders `[unit]` tag in lowercase brackets |
| Data table | Renders emerald "active" badge |
| Data table | Renders charcoal "inactive" badge |
| Empty state | Hides table and shows empty-state message when data is empty |

---

## Files Modified Summary

| File | Type | Change |
|---|---|---|
| `src/types/subscription.ts` | Modified | Add `PlatformFeature` interface |
| `src/services/saasService.ts` | Modified | Add `getFeatures()` |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` | **New** | Full view component |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` | **New** | Unit tests |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | Modified | Mount view, add breadcrumb, remove from stub |
| `src/components/SaaSDashboard/SubscriptionPlansView.tsx` | Modified | Rename Quick Launch button |
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | Modified | Rename Quick Launch button |
| `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` | Modified | Update 3 button-name assertions |
