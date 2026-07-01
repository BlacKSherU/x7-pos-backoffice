# Feature Catalog View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `subscription-features` stub in SaaSDashboard with a real `PlatformFeatureCatalogView` that fetches from `GET /api/features` and renders a master data table; rename two Quick Launch buttons to "FEATURE CATALOG" for consistency.

**Architecture:** Four tasks in dependency order — foundation types+service, then the new component (TDD), then SaaSDashboard wiring, then the two Quick Launch button renames with test fixes. Each task is independently committable.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind v4, `saasService` fetch abstraction with JWT.

## Global Constraints

- All new UI text must match the spec verbatim (table title, empty state message, breadcrumb labels).
- `Unit` field from the backend entity uses a capital U — match this exactly in the TypeScript interface and in all property accesses.
- Status badge: `"active"` → emerald green (`bg-emerald-500`), any other value → charcoal (`bg-[#444444]`).
- Unit tag rendered as `[{feature.Unit.toLowerCase()}]` — always lowercase, always brackets.
- `feature_{id}` code label uses the numeric `id` from the entity — there is no separate string `code` field.
- `getFeatures()` goes inside the `saasService` object (not a named export) — same pattern as `getApplications()`.
- Tests mock `saasService` via `vi.mock('../../services/saasService', ...)`.
- Run `npm test` from `c:\Users\Rafael Cordero\x7-pos-backoffice` to execute tests.

---

### Task 1: Foundation — PlatformFeature type + getFeatures service

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `PlatformFeature` interface (consumed by Tasks 2 and 3); `saasService.getFeatures()` returning `Promise<PlatformFeature[]>` (mocked in Task 2 tests)

- [ ] **Step 1: Add PlatformFeature interface to types**

Open `src/types/subscription.ts` and append at the end of the file:

```ts
export interface PlatformFeature {
  id: number;
  name: string;
  description: string;
  Unit: string;
  status: string;
}
```

- [ ] **Step 2: Add getFeatures to saasService**

Open `src/services/saasService.ts`. The file has a `saasService` object literal. Add `getFeatures` as the last method before the closing `};`:

```ts
  async getFeatures(): Promise<PlatformFeature[]> {
    const response = await saasApiFetch<{
      data: PlatformFeature[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>('features');
    return response.data;
  },
```

Also add `PlatformFeature` to the existing import at line 1:

```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application, PlatformFeature } from '../types/subscription';
```

- [ ] **Step 3: Commit**

```bash
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add PlatformFeature type and getFeatures service method"
```

---

### Task 2: PlatformFeatureCatalogView — TDD

**Files:**
- Create: `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx`
- Create: `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`

**Interfaces:**
- Consumes: `PlatformFeature` from `../../types/subscription`; `saasService.getFeatures()` from `../../services/saasService`
- Produces: `PlatformFeatureCatalogView` React component with optional prop `onNavigate?: (view: string) => void`

- [ ] **Step 1: Create the test file**

Create `src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx` with this content:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformFeatureCatalogView } from './PlatformFeatureCatalogView';
import { saasService } from '../../services/saasService';
import type { PlatformFeature } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getFeatures: vi.fn(),
  },
}));

const MOCK_FEATURES: PlatformFeature[] = [
  {
    id: 1,
    name: 'Advanced Analytics',
    description: 'Provides advanced data analytics capabilities.',
    Unit: 'user',
    status: 'active',
  },
  {
    id: 2,
    name: 'Cloud Storage',
    description: 'Persistent file storage for merchant documents.',
    Unit: 'gb',
    status: 'inactive',
  },
  {
    id: 3,
    name: 'API Access',
    description: 'Programmatic access via REST endpoints.',
    Unit: 'unit',
    status: 'active',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlatformFeatureCatalogView — loading state', () => {
  it('shows a loading indicator while fetching', () => {
    vi.mocked(saasService.getFeatures).mockReturnValue(new Promise(() => {}));
    render(<PlatformFeatureCatalogView />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('PlatformFeatureCatalogView — error state', () => {
  it('shows an error message when the API call fails', async () => {
    vi.mocked(saasService.getFeatures).mockRejectedValue(new Error('Network error'));
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});

describe('PlatformFeatureCatalogView — table rendering', () => {
  beforeEach(() => {
    vi.mocked(saasService.getFeatures).mockResolvedValue(MOCK_FEATURES);
  });

  it('renders the table title PLATFORM FEATURE CATALOG MASTER', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('PLATFORM FEATURE CATALOG MASTER')).toBeInTheDocument();
    });
  });

  it('renders feature names as primary bold text', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('API Access')).toBeInTheDocument();
    });
  });

  it('renders monospace feature_{id} code labels below each name', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('feature_1')).toBeInTheDocument();
      expect(screen.getByText('feature_2')).toBeInTheDocument();
      expect(screen.getByText('feature_3')).toBeInTheDocument();
    });
  });

  it('renders feature descriptions as muted subtitle text', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('Provides advanced data analytics capabilities.')).toBeInTheDocument();
    });
  });

  it('renders Unit as a lowercase bracketed tag', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.getByText('[user]')).toBeInTheDocument();
      expect(screen.getByText('[gb]')).toBeInTheDocument();
      expect(screen.getByText('[unit]')).toBeInTheDocument();
    });
  });

  it('renders an emerald badge for active features', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBeGreaterThan(0);
      expect(activeBadges[0]).toHaveClass('bg-emerald-500');
    });
  });

  it('renders a charcoal badge for inactive features', async () => {
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      const inactiveBadge = screen.getByText('inactive');
      expect(inactiveBadge).toHaveClass('bg-[#444444]');
    });
  });
});

describe('PlatformFeatureCatalogView — empty state', () => {
  it('renders the empty-state message when no features are returned', async () => {
    vi.mocked(saasService.getFeatures).mockResolvedValue([]);
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(
        screen.getByText(
          "No feature definitions found. Click 'Create Feature' to establish your first system capability flag.",
        ),
      ).toBeInTheDocument();
    });
  });

  it('does not render the table title in the empty state', async () => {
    vi.mocked(saasService.getFeatures).mockResolvedValue([]);
    render(<PlatformFeatureCatalogView />);
    await waitFor(() => {
      expect(screen.queryByText('PLATFORM FEATURE CATALOG MASTER')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd "c:\Users\Rafael Cordero\x7-pos-backoffice"
npm test -- --reporter=verbose PlatformFeatureCatalogView.test
```

Expected: All tests fail with "Cannot find module './PlatformFeatureCatalogView'" or similar.

- [ ] **Step 3: Create the component**

Create `src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { saasService } from '../../services/saasService';
import type { PlatformFeature } from '../../types/subscription';

interface PlatformFeatureCatalogViewProps {
  onNavigate?: (view: string) => void;
}

export const PlatformFeatureCatalogView: React.FC<PlatformFeatureCatalogViewProps> = () => {
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saasService.getFeatures()
      .then((data) => setFeatures(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
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
          No feature definitions found. Click 'Create Feature' to establish your first system capability flag.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-[#e8e2d8] overflow-hidden">
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

      {/* Data rows */}
      {features.map((feature) => (
        <div
          key={feature.id}
          className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 border-b border-[#e8e2d8] px-6 py-4 bg-white hover:bg-[#f9f7f4] transition-colors items-center"
        >
          {/* Feature Identity */}
          <div className="min-w-0">
            <p className="font-bold text-[#1d1c17] text-sm leading-tight">{feature.name}</p>
            <code className="text-[11px] text-[#5f5e5e] font-mono">feature_{feature.id}</code>
          </div>

          {/* Scope Definition */}
          <div className="min-w-0">
            <p className="text-sm text-[#5f5e5e] leading-snug">{feature.description}</p>
          </div>

          {/* Unit tag */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest border border-[#222222] px-2 py-0.5 text-[#222222] font-mono">
              [{feature.Unit.toLowerCase()}]
            </span>
          </div>

          {/* Status badge */}
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
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npm test -- --reporter=verbose PlatformFeatureCatalogView.test
```

Expected: All tests pass (green).

- [ ] **Step 5: Commit**

```bash
git add src/components/SaaSDashboard/PlatformFeatureCatalogView.tsx src/components/SaaSDashboard/PlatformFeatureCatalogView.test.tsx
git commit -m "feat: add PlatformFeatureCatalogView component with tests"
```

---

### Task 3: SaaSDashboard wiring

**Files:**
- Modify: `src/components/SaaSDashboard/SaaSDashboard.tsx`

**Interfaces:**
- Consumes: `PlatformFeatureCatalogView` from `./PlatformFeatureCatalogView`

- [ ] **Step 1: Add import**

At the top of `src/components/SaaSDashboard/SaaSDashboard.tsx`, add the import after the existing `PlatformApplicationsView` import (line 8):

```ts
import { PlatformFeatureCatalogView } from './PlatformFeatureCatalogView';
```

- [ ] **Step 2: Mount the view in renderContent**

In `renderContent()`, add a new branch right after the `subscription-applications` branch (after line 81):

```tsx
if (activeTab === 'subscription-features') {
  return <PlatformFeatureCatalogView onNavigate={handleNavigateView} />;
}
```

- [ ] **Step 3: Remove subscription-features from the stub fallback**

Find the stub `if` block that handles multiple tabs (around line 83). Change:

```tsx
if (
  activeTab === 'subscription-features' ||
  activeTab === 'subscription-payments' ||
  activeTab === 'subscription-live-installs'
) {
```

to:

```tsx
if (
  activeTab === 'subscription-payments' ||
  activeTab === 'subscription-live-installs'
) {
```

Also remove the `'subscription-features'` entry from `subConfig`:

```tsx
const subConfig = {
  'subscription-payments': {
    icon: 'payments',
    title: 'Subscription Payments',
    desc: 'Centralized billing book tracking payment logs from active merchants.',
    backLabel: 'Back to Subscription Plans',
    backTab: 'subscription',
  },
  'subscription-live-installs': {
    icon: 'monitoring',
    title: 'Active Live Installs',
    desc: 'Deployment audit screen — monitor live merchant profiles mapped to individual applications.',
    backLabel: 'Back to Applications',
    backTab: 'subscription-applications',
  },
}[activeTab as 'subscription-payments' | 'subscription-live-installs'];
```

- [ ] **Step 4: Add breadcrumb for subscription-features**

Find the breadcrumb `nav` block (around line 332). It currently shows for `subscription-applications` and `subscription-live-installs`. Extend the condition to include `subscription-features`:

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
      {activeTab === 'subscription-applications'
        ? 'Applications'
        : activeTab === 'subscription-live-installs'
          ? 'Live Installs'
          : 'Feature Catalog'}
    </span>
  </nav>
)}
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All existing tests pass. No new failures.

- [ ] **Step 6: Commit**

```bash
git add src/components/SaaSDashboard/SaaSDashboard.tsx
git commit -m "feat: wire PlatformFeatureCatalogView into SaaSDashboard with breadcrumb"
```

---

### Task 4: Quick Launch button renames + test fixes

**Files:**
- Modify: `src/components/SaaSDashboard/SubscriptionPlansView.tsx`
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.tsx`
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`

**Interfaces:**
- No new interfaces — pure label changes.

- [ ] **Step 1: Rename button in SubscriptionPlansView**

In `src/components/SaaSDashboard/SubscriptionPlansView.tsx`, find the Quick Launch button with text `FEATURE CATALOG MAP` (around line 493) and change the label:

```tsx
{/* Before */}
FEATURE CATALOG MAP
{/* After */}
FEATURE CATALOG
```

- [ ] **Step 2: Rename button in PlatformApplicationsView**

In `src/components/SaaSDashboard/PlatformApplicationsView.tsx`, find the Quick Launch button with text `FEATURE CATALOG INDEX` (around line 695) and change the label:

```tsx
{/* Before */}
FEATURE CATALOG INDEX
{/* After */}
FEATURE CATALOG
```

- [ ] **Step 3: Update the three test assertions in PlatformApplicationsView.test.tsx**

In `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`, replace all three occurrences of `'FEATURE CATALOG INDEX'` with `'FEATURE CATALOG'`:

**Line ~370** (renders-all-four-buttons test):
```tsx
// Before
expect(screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' })).toBeInTheDocument();
// After
expect(screen.getByRole('button', { name: 'FEATURE CATALOG' })).toBeInTheDocument();
```

**Lines ~387 and ~388** (navigation click test):
```tsx
// Before
await waitFor(() => screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' }));
await userEvent.click(screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' }));
// After
await waitFor(() => screen.getByRole('button', { name: 'FEATURE CATALOG' }));
await userEvent.click(screen.getByRole('button', { name: 'FEATURE CATALOG' }));
```

**Line ~384** (test description string — update for clarity):
```tsx
// Before
it('calls onNavigate with "subscription-features" when FEATURE CATALOG INDEX is clicked', async () => {
// After
it('calls onNavigate with "subscription-features" when FEATURE CATALOG is clicked', async () => {
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Confirm the renamed button tests in PlatformApplicationsView.test.tsx are green.

- [ ] **Step 5: Commit**

```bash
git add src/components/SaaSDashboard/SubscriptionPlansView.tsx src/components/SaaSDashboard/PlatformApplicationsView.tsx src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
git commit -m "feat: rename Quick Launch buttons to FEATURE CATALOG and update tests"
```
