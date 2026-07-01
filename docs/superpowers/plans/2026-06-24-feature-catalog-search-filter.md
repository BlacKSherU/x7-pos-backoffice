# Feature Catalog Search & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side filter strip (fuzzy search + Unit dropdown + Status dropdown) to `PlatformFeatureCatalogView` and cover all new behaviors with tests.

**Architecture:** All filtering is client-side using `useMemo` — features are already loaded in memory. A `fuzzyMatch` helper (VS Code-style, chars in order) is added at module level. Three state variables drive the filter strip UI. The filtered list replaces the raw `features` array in the data rows render. No new API calls, no new files.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind v4.

## Global Constraints

- Fuzzy match: characters of the query must appear in the target **in order**, case-insensitive.
- Fuzzy search targets: `feature.name`, `feature.description`, `` `feature_${feature.id}` ``.
- Unit dropdown option values: exact `feature.Unit` strings (capital U), derived as `[...new Set(features.map(f => f.Unit))].sort()`.
- Status dropdown values: exactly `"active"` and `"inactive"` (lowercase).
- Inline no-results text: exactly `"No platform features match your active filters"`.
- Clear Filters button: only rendered when `Boolean(searchText || unitFilter || statusFilter)` is true.
- Filter strip only renders when `features.length > 0` (not during loading, error, or empty state).
- The `bg-[#222222]` header block must remain visible during no-results state (AC 5).
- Do NOT commit — user handles all git commits.
- Test command: `cd "c:\Users\Rafael Cordero\x7-pos-backoffice" && npm test -- --reporter=verbose PlatformFeatureCatalogView.test`

---

### Task 1: Search & Filter — TDD

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` (append new describe suites)
- Modify: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` (add filter logic + UI)

**Interfaces:**
- Consumes: existing `PlatformFeature` interface (`id: number`, `name: string`, `description: string`, `Unit: string`, `status: string`); existing `saasService.getFeatures()` mock already in test file
- Produces: updated component with filter strip, `fuzzyMatch` fn, `filteredFeatures` useMemo

---

- [ ] **Step 1: Append new test suites to the existing test file**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`. The file already imports `userEvent` — if it does not, add `import userEvent from '@testing-library/user-event';` after the existing imports. Then **append** the following suites at the bottom of the file (after the last closing `}`):

```tsx
describe('PlatformFeatureCatalogView — filter strip', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('renders the search input', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Search features' })).toBeInTheDocument();
    });
  });

  it('renders the Measurement Unit dropdown with All Units option', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Filter by measurement unit' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'All Units' })).toBeInTheDocument();
    });
  });

  it('renders the Status dropdown', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    });
  });

  it('unit dropdown is populated with distinct sorted Unit values from data', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      // MOCK_FEATURES has Unit values: 'user', 'gb', 'unit' — sorted: 'gb', 'unit', 'user'
      expect(screen.getByRole('option', { name: 'gb' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'unit' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'user' })).toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — fuzzy search', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('filters rows by matching characters in feature name', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'ana');
    await waitFor(() => {
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.queryByText('Cloud Storage')).not.toBeInTheDocument();
      expect(screen.queryByText('API Access')).not.toBeInTheDocument();
    });
  });

  it('filters rows by matching characters in feature description', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'file');
    await waitFor(() => {
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Analytics')).not.toBeInTheDocument();
    });
  });

  it('filters rows by matching feature_N id string', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'feature_2');
    await waitFor(() => {
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Analytics')).not.toBeInTheDocument();
      expect(screen.queryByText('API Access')).not.toBeInTheDocument();
    });
  });

  it('shows all rows when search input is empty', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('API Access')).toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — unit filter', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('shows only rows matching selected unit', async () => {
    render(<PlatformFeatureCatalogView />);
    const select = await screen.findByRole('combobox', { name: 'Filter by measurement unit' });
    await userEvent.selectOptions(select, 'gb');
    await waitFor(() => {
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Analytics')).not.toBeInTheDocument();
      expect(screen.queryByText('API Access')).not.toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — status filter', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('shows only active rows when active is selected', async () => {
    render(<PlatformFeatureCatalogView />);
    const select = await screen.findByRole('combobox', { name: 'Filter by status' });
    await userEvent.selectOptions(select, 'active');
    await waitFor(() => {
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('API Access')).toBeInTheDocument();
      expect(screen.queryByText('Cloud Storage')).not.toBeInTheDocument();
    });
  });

  it('shows only inactive rows when inactive is selected', async () => {
    render(<PlatformFeatureCatalogView />);
    const select = await screen.findByRole('combobox', { name: 'Filter by status' });
    await userEvent.selectOptions(select, 'inactive');
    await waitFor(() => {
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Analytics')).not.toBeInTheDocument();
      expect(screen.queryByText('API Access')).not.toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — no results (AC 5)', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('shows inline no-results message when filters produce zero results', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'zzzzzzzzz');
    await waitFor(() => {
      expect(
        screen.getByText('No platform features match your active filters'),
      ).toBeInTheDocument();
    });
  });

  it('does not show the empty-state message when filters produce zero results', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'zzzzzzzzz');
    await waitFor(() => {
      expect(screen.queryByText(/No feature definitions found/)).not.toBeInTheDocument();
    });
  });

  it('keeps the table header visible when filters produce zero results', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'zzzzzzzzz');
    await waitFor(() => {
      expect(screen.getByText('PLATFORM FEATURE CATALOG MASTER')).toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — clear filters', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('Clear Filters button is hidden when no filter is active', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => screen.getByText('Advanced Analytics'));
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
  });

  it('Clear Filters button appears when search text is entered', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'ana');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    });
  });

  it('clicking Clear Filters resets all filters and shows all rows', async () => {
    render(<PlatformFeatureCatalogView />);
    const input = await screen.findByRole('textbox', { name: 'Search features' });
    await userEvent.type(input, 'ana');
    await waitFor(() => screen.getByRole('button', { name: 'Clear Filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => {
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('API Access')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Confirm existing test file already imports userEvent**

Open `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` and check the top imports. If `userEvent` is not imported, add this line after the existing imports:

```tsx
import userEvent from '@testing-library/user-event';
```

- [ ] **Step 3: Run the new tests — confirm they fail**

```bash
cd "c:\Users\Rafael Cordero\x7-pos-backoffice" && npm test -- --reporter=verbose PlatformFeatureCatalogView.test
```

Expected: The original 11 tests still pass. The new suites fail with errors like "Unable to find role 'textbox'" because the filter strip doesn't exist yet.

- [ ] **Step 4: Replace PlatformFeatureCatalogView.tsx with the updated implementation**

Replace the entire content of `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx` with:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { saasService } from '../../services/saasService';
import type { PlatformFeature } from '../../types/subscription';

interface PlatformFeatureCatalogViewProps {
  onNavigate?: (view: string) => void;
}

function fuzzyMatch(query: string, target: string): boolean {
  let qi = 0;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i].toLowerCase() === query[qi].toLowerCase()) qi++;
  }
  return qi === query.length;
}

export const PlatformFeatureCatalogView: React.FC<PlatformFeatureCatalogViewProps> = () => {
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    saasService.getFeatures()
      .then((data) => setFeatures(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const unitOptions = useMemo(
    () => [...new Set(features.map((f) => f.Unit))].sort(),
    [features],
  );

  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      const q = searchText.trim();
      if (q) {
        const idStr = `feature_${f.id}`;
        if (!fuzzyMatch(q, f.name) && !fuzzyMatch(q, f.description) && !fuzzyMatch(q, idStr)) {
          return false;
        }
      }
      if (unitFilter && f.Unit !== unitFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      return true;
    });
  }, [features, searchText, unitFilter, statusFilter]);

  const hasActiveFilter = Boolean(searchText || unitFilter || statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined text-[#d51f2c] text-4xl animate-spin">
          progress_activity
        </span>
        <span className="ml-3 text-[#5f5e5e] text-sm font-medium">Loading feature catalog...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 p-8 text-center">
        <span className="material-symbols-outlined text-red-500 text-4xl" aria-hidden="true">
          report
        </span>
        <p className="mt-3 text-red-700 font-medium">Failed to load feature catalog.</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="bg-white border border-[#e8e2d8] p-16 flex flex-col items-center text-center">
        <span className="material-symbols-outlined text-[#d51f2c] text-6xl">featured_play_list</span>
        <p className="text-[#5f5e5e] mt-4 max-w-sm text-sm leading-relaxed">
          No feature definitions found. Click 'Create Feature' to establish your first system
          capability flag.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-[#e8e2d8] overflow-hidden">
      {/* Filter strip */}
      <div className="bg-white border-b border-[#e8e2d8] px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-9 pr-3 py-1.5 border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none transition-all"
            aria-label="Search features"
          />
        </div>
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] px-3 py-1.5 focus:border-[#ae001a] outline-none"
          aria-label="Filter by measurement unit"
        >
          <option value="">All Units</option>
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#e8e2d8] bg-[#fef9f1] text-sm text-[#1d1c17] px-3 py-1.5 focus:border-[#ae001a] outline-none"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              setUnitFilter('');
              setStatusFilter('');
            }}
            className="text-[11px] font-bold uppercase tracking-widest text-[#ae001a] hover:underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Header block */}
      <div className="bg-[#222222] px-6 py-4">
        <h2 className="text-[13px] font-black uppercase tracking-widest text-white">
          PLATFORM FEATURE CATALOG MASTER
        </h2>
        <p className="text-white/50 text-[11px] mt-0.5">
          Feature flags and entitlement definitions for this platform.
        </p>
        <div className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 mt-4 px-0">
          {['FEATURE IDENTITY', 'SCOPE DEFINITION', 'UNIT', 'STATUS'].map((col) => (
            <span
              key={col}
              className="text-[10px] font-bold uppercase tracking-widest text-white/40"
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Filtered rows or inline no-results */}
      {filteredFeatures.length === 0 ? (
        <div className="px-6 py-10 text-center bg-white border-b border-[#e8e2d8]">
          <p className="text-sm text-[#5f5e5e]">
            No platform features match your active filters
          </p>
        </div>
      ) : (
        filteredFeatures.map((feature) => (
          <div
            key={feature.id}
            className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 border-b border-[#e8e2d8] px-6 py-4 bg-white hover:bg-[#f9f7f4] transition-colors items-center"
          >
            <div className="min-w-0">
              <p className="font-bold text-[#1d1c17] text-sm leading-tight">{feature.name}</p>
              <code className="text-[11px] text-[#5f5e5e] font-mono">feature_{feature.id}</code>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[#5f5e5e] leading-snug">{feature.description}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest border border-[#222222] px-2 py-0.5 text-[#222222] font-mono">
                [{feature.Unit.toLowerCase()}]
              </span>
            </div>
            <div>
              {feature.status === 'active' ? (
                <span className="bg-emerald-500 text-white text-[10px] font-bold uppercase px-2 py-0.5">
                  active
                </span>
              ) : (
                <span className="bg-[#444444] text-white text-[10px] font-bold uppercase px-2 py-0.5">
                  inactive
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
```

- [ ] **Step 5: Run the full test suite — confirm all pass**

```bash
cd "c:\Users\Rafael Cordero\x7-pos-backoffice" && npm test -- --reporter=verbose PlatformFeatureCatalogView.test
```

Expected: All tests pass (11 original + ~16 new = ~27 total).

Then run the full suite to confirm no regressions:

```bash
cd "c:\Users\Rafael Cordero\x7-pos-backoffice" && npm test
```

Expected: 135+ tests passing, 0 failures (excluding the pre-existing flaky `ForgotPasswordPage` timing test if it appears).

- [ ] **Step 6: Verify TypeScript**

```bash
cd "c:\Users\Rafael Cordero\x7-pos-backoffice" && npx tsc --noEmit
```

Expected: No output (zero errors).
