# Design Spec: Feature Catalog Search & Filter

**Date:** 2026-06-24
**Branch:** rafaalejandro_subscription
**Status:** Approved

---

## Overview

Add client-side search and filter controls to `PlatformFeatureCatalogView`. No new API calls — all features are already loaded in memory. The feature adds a filter strip above the table and a `useMemo`-derived filtered list that drives the data rows. Follows the exact same pattern as `PlatformApplicationsView`.

---

## Acceptance Criteria

- **AC 1** — A clean filtering panel strip is located directly above the primary table container (above the `bg-[#222222]` header block).
- **AC 2** — Typing text into the search box filters rows dynamically using fuzzy matching (VS Code-style: characters must appear in order) against `feature.name`, `feature.description`, and the formatted id string `feature_${feature.id}`.
- **AC 3** — A "Measurement Unit" dropdown is populated with distinct values from the `Unit` column, sorted alphabetically, prefixed by "All Units". Selecting a value filters to only rows with that exact `Unit`.
- **AC 4** — A "Status" dropdown allows switching between "All Status" (default), "active", and "inactive".
- **AC 5** — When the filtered list is empty but the full `features` array is not (i.e., filters produce zero results), an inline notification row replaces the data rows: _"No platform features match your active filters"_. The `bg-[#222222]` header block and column headers remain visible.

---

## Architecture

**Single file change:** `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`

**Pattern:** Identical to `PlatformApplicationsView` search+filter implementation — three filter state variables, one `useMemo` for unit options, one `useMemo` for the filtered list, a filter strip rendered above the table.

---

## State

```ts
const [searchText, setSearchText] = useState('');
const [unitFilter, setUnitFilter] = useState('');    // '' = All Units
const [statusFilter, setStatusFilter] = useState(''); // '' = All Status
```

---

## Fuzzy Match Algorithm

VS Code-style: characters of the query must appear in the target in order (not necessarily consecutive). Case-insensitive.

```ts
function fuzzyMatch(query: string, target: string): boolean {
  let qi = 0;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i].toLowerCase() === query[qi].toLowerCase()) qi++;
  }
  return qi === query.length;
}
```

Applied against: `feature.name`, `feature.description`, `` `feature_${feature.id}` ``.

If `searchText` is empty, all features pass the fuzzy check.

---

## Derived Values (`useMemo`)

### Unit options

```ts
const unitOptions = useMemo(
  () => [...new Set(features.map(f => f.Unit))].sort(),
  [features]
);
```

### Filtered list

```ts
const filteredFeatures = useMemo(() => {
  return features.filter(f => {
    const q = searchText.trim();
    if (q) {
      const idStr = `feature_${f.id}`;
      const matchesSearch =
        fuzzyMatch(q, f.name) ||
        fuzzyMatch(q, f.description) ||
        fuzzyMatch(q, idStr);
      if (!matchesSearch) return false;
    }
    if (unitFilter && f.Unit !== unitFilter) return false;
    if (statusFilter && f.status !== statusFilter) return false;
    return true;
  });
}, [features, searchText, unitFilter, statusFilter]);
```

---

## Filter Strip UI (AC 1)

Rendered between the outer container border and the `bg-[#222222]` header block. Only rendered when `features.length > 0` (not during loading, error, or AC-4 empty state).

```
bg-white border-b border-[#e8e2d8] px-6 py-3 flex items-center gap-3
```

### Search input

```tsx
<div className="relative flex-1 max-w-sm">
  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
    search
  </span>
  <input
    type="text"
    value={searchText}
    onChange={e => setSearchText(e.target.value)}
    placeholder="Search features..."
    className="w-full pl-9 pr-3 py-1.5 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none transition-all"
    aria-label="Search features"
  />
</div>
```

### Measurement Unit dropdown

```tsx
<select
  value={unitFilter}
  onChange={e => setUnitFilter(e.target.value)}
  className="border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] px-3 py-1.5 focus:border-[#ae001a] outline-none"
  aria-label="Filter by measurement unit"
>
  <option value="">All Units</option>
  {unitOptions.map(u => (
    <option key={u} value={u}>{u}</option>
  ))}
</select>
```

### Status dropdown

```tsx
<select
  value={statusFilter}
  onChange={e => setStatusFilter(e.target.value)}
  className="border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] px-3 py-1.5 focus:border-[#ae001a] outline-none"
  aria-label="Filter by status"
>
  <option value="">All Status</option>
  <option value="active">active</option>
  <option value="inactive">inactive</option>
</select>
```

### Clear Filters button

Visible only when at least one filter is active (`searchText || unitFilter || statusFilter`):

```tsx
<button
  type="button"
  onClick={() => { setSearchText(''); setUnitFilter(''); setStatusFilter(''); }}
  className="text-[11px] font-bold uppercase tracking-widest text-[#ae001a] hover:underline ml-auto"
>
  Clear Filters
</button>
```

---

## Table Rendering with Filtered List

Replace `features.map(...)` in the existing table with `filteredFeatures.map(...)`.

When `filteredFeatures.length === 0` and `features.length > 0`, render the inline no-results row **instead of** the data rows, but keep the `bg-[#222222]` header block:

```tsx
{filteredFeatures.length === 0 ? (
  <div className="px-6 py-10 text-center bg-white border-b border-[#e8e2d8]">
    <p className="text-sm text-[#5f5e5e]">
      No platform features match your active filters
    </p>
  </div>
) : (
  filteredFeatures.map(feature => (
    /* existing row JSX */
  ))
)}
```

---

## Component Return Structure (after changes)

```
loading → early return (unchanged)
error → early return (unchanged)
features.length === 0 → early return empty state (unchanged, AC 4 from prior spec)

return (
  <div class="space-y-0 border border-[#e8e2d8] overflow-hidden">
    {/* Filter strip — NEW */}
    <div class="bg-white border-b border-[#e8e2d8] px-6 py-3 flex gap-3">
      search input | unit dropdown | status dropdown | [clear filters]
    </div>

    {/* Header block — unchanged */}
    <div class="bg-[#222222] px-6 py-4">
      PLATFORM FEATURE CATALOG MASTER + column headers
    </div>

    {/* Filtered rows or inline no-results */}
    {filteredFeatures.length === 0
      ? <inline no-results row>
      : filteredFeatures.map(row => <existing row JSX>)
    }
  </div>
)
```

---

## Tests to Add (`PlatformFeatureCatalogView.test.tsx`)

New describe suites appended to the existing test file:

| Suite | Test |
|---|---|
| Filter strip | Renders the search input |
| Filter strip | Renders the Measurement Unit dropdown with "All Units" option |
| Filter strip | Renders the Status dropdown with "All Status", "active", "inactive" options |
| Filter strip | Unit dropdown is populated with distinct Unit values from data |
| Fuzzy search | Filters rows by matching characters in feature name |
| Fuzzy search | Filters rows by matching characters in feature description |
| Fuzzy search | Filters rows by matching feature_N id string |
| Fuzzy search | Shows all rows when search input is empty |
| Unit filter | Shows only rows matching selected unit |
| Status filter | Shows only active rows when "active" selected |
| Status filter | Shows only inactive rows when "inactive" selected |
| No-results | Shows inline "No platform features match your active filters" when filters produce zero results |
| No-results | Does NOT show the AC-4 empty state message when features exist but filters produce zero results |
| Clear Filters | Clear Filters button is hidden when no filter is active |
| Clear Filters | Clear Filters button appears when a filter is active |
| Clear Filters | Clicking Clear Filters resets all filters and shows all rows |

---

## Files Modified Summary

| File | Type | Change |
|---|---|---|
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` | Modified | Add filter state, fuzzy fn, useMemo, filter strip UI, inline no-results |
| `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` | Modified | Append ~16 new test cases across 5 new describe suites |
