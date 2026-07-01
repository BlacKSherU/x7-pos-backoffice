# Plan Applications View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only sub-panel that displays the applications bundled into a specific Subscription Plan, accessible from the Subscription Plans table via a "View Applications" icon button.

**Architecture:** Two minimal backend changes unlock the `subscriptionPlanId` filter and expose `application.category`. Four frontend tasks wire the type, service method, new view component (with tests first), and shell navigation — following the exact pattern of `PlatformApplicationsView` and `PlatformFeatureCatalogView`.

**Tech Stack:** NestJS + TypeORM (backend), React 19 + TypeScript + Vitest + React Testing Library + Tailwind v4 (frontend)

## Global Constraints

- Backend repo root: `C:\Users\Rafael Cordero\x7-pos-back-end`
- Frontend repo root: `C:\Users\Rafael Cordero\x7-pos-backoffice`
- Branch (both repos): `rafaalejandro_subscription`
- Design tokens: `#222222` structural dark, `#ae001a` primary red, `#f2ede5` warm surface, `#e8e2d8` border, `#5f5e5e` secondary text, `#1d1c17` primary text
- Status badges: active → `bg-green-500/10 text-green-600`; inactive → `bg-[#5f5e5e]/20 text-[#5f5e5e]`
- Tag chip class: `bg-[#f2ede5] border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase px-2 py-0.5 rounded`
- Code snippet class: `font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded`
- All text labels uppercase tracking-widest `text-[11px] font-bold`
- TDD: every new frontend component gets its test file written and run before the implementation exists
- Frequent commits — one per task

---

## File Map

| File | Repo | Action |
|---|---|---|
| `src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts` | backend | Modify — add `subscriptionPlanId` field |
| `src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts` | backend | Modify — filter by planId, expose `application.category` |
| `src/platform-saas/subscriptions/plan-applications/plan-applications.service.spec.ts` | backend | Modify — add 2 tests for new behavior |
| `src/types/subscription.ts` | frontend | Modify — add `PlanApplication` interface |
| `src/services/saasService.ts` | frontend | Modify — add `getPlanApplications` method |
| `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` | frontend | Create — 11 test cases (written before component) |
| `src/components/SaaSDashboard/PlanApplicationsView.tsx` | frontend | Create — read-only view component |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | frontend | Modify — selectedPlan state, nav, breadcrumbs, renderContent |
| `src/components/SaaSDashboard/SubscriptionPlansView.tsx` | frontend | Modify — grid_view button + updated onNavigate type |

---

### Task 1: Backend — subscriptionPlanId filter + application.category

**Files:**
- Modify: `src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts`
- Modify: `src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts`
- Modify: `src/platform-saas/subscriptions/plan-applications/plan-applications.service.spec.ts`

**Interfaces:**
- Produces: `GET /plan-applications?subscriptionPlanId=3` returns only records for plan 3, each with `application.category` in the response

- [ ] **Step 1: Add `subscriptionPlanId` to the DTO**

Replace the entire file `src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts` with:

```ts
//src/subscriptions/plan-applications/dto/query-plan-application.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPlanApplicationDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'inactive', 'deleted'],
    example: 'active',
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'deleted'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by subscription plan ID',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  subscriptionPlanId?: number;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: ['id'],
    example: 'id',
  })
  @IsOptional()
  @IsIn(['id'])
  sortBy?: 'id';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
```

- [ ] **Step 2: Update `findAll` in the service — select + filter + mapping**

In `src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts`, make three edits inside `findAll`:

**2a — destructure `subscriptionPlanId` from query (line ~81):**
```ts
const {
  status,
  page = 1,
  limit = 10,
  sortBy = 'id',
  sortOrder = 'DESC',
  subscriptionPlanId,   // ← add this
} = query;
```

**2b — add `application.category` to the QueryBuilder select (line ~96-104):**
```ts
.select([
  'planApplication',
  'subscriptionPlan.id',
  'subscriptionPlan.name',
  'subscriptionPlan.status',
  'application.id',
  'application.name',
  'application.category',   // ← add this line
  'application.status',
]);
```

**2c — add the planId filter after the existing `qb.andWhere('planApplication.status != :deleted', ...)` block (after line ~116):**
```ts
if (subscriptionPlanId) {
  qb.andWhere('subscriptionPlan.id = :subscriptionPlanId', {
    subscriptionPlanId,
  });
}
```

**2d — add `category` to the mapped response (line ~124-138):**
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
    category: item.application.category,   // ← add this line
  },
}));
```

- [ ] **Step 3: Add tests to the service spec**

In `src/platform-saas/subscriptions/plan-applications/plan-applications.service.spec.ts`, add a new `describe` block at the end of the file (before the final closing `}`):

```ts
describe('findAll — subscriptionPlanId filter and category mapping', () => {
  let filterQueryBuilder: any;

  beforeEach(() => {
    filterQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 1,
            limits: '100 users per month',
            status: 'active',
            subscriptionPlan: { id: 3, name: 'Gold Plan' },
            application: { id: 5, name: 'POS Core', category: 'POS Core' },
          },
        ],
        1,
      ]),
    };
    repository.createQueryBuilder.mockReturnValue(filterQueryBuilder);
  });

  it('calls andWhere with subscriptionPlanId when provided', async () => {
    await service.findAll({ subscriptionPlanId: 3, page: 1, limit: 10 });
    expect(filterQueryBuilder.andWhere).toHaveBeenCalledWith(
      'subscriptionPlan.id = :subscriptionPlanId',
      { subscriptionPlanId: 3 },
    );
  });

  it('includes application.category in the mapped response', async () => {
    const result = await service.findAll({ subscriptionPlanId: 3, page: 1, limit: 10 });
    expect(result.data[0]).toHaveProperty('application');
    expect((result.data[0] as any).application).toHaveProperty('category', 'POS Core');
  });
});
```

- [ ] **Step 4: Run the backend tests**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
npx jest plan-applications.service.spec --no-coverage
```

Expected: all tests pass, including the 2 new ones.

- [ ] **Step 5: Commit backend changes**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-back-end"
git add src/platform-saas/subscriptions/plan-applications/dto/query-plan-application.dto.ts
git add src/platform-saas/subscriptions/plan-applications/plan-applications.service.ts
git add src/platform-saas/subscriptions/plan-applications/plan-applications.service.spec.ts
git commit -m "feat: add subscriptionPlanId filter and application.category to plan-applications findAll"
```

---

### Task 2: Frontend type + service method

**Files:**
- Modify: `src/types/subscription.ts`
- Modify: `src/services/saasService.ts`

**Interfaces:**
- Produces: `PlanApplication` interface; `saasService.getPlanApplications(planId: number): Promise<PlanApplication[]>`

- [ ] **Step 1: Add `PlanApplication` to `src/types/subscription.ts`**

Append after the `PlatformFeature` interface (end of file):

```ts
export interface PlanApplication {
  id: number;
  subscriptionPlan: { id: number; name: string };
  application: { id: number; name: string; category: string };
  limits: string;
  status: string;
}
```

- [ ] **Step 2: Add `getPlanApplications` to `src/services/saasService.ts`**

**2a — Update the import at line 1** to include `PlanApplication`:

```ts
import type { SubscriptionPlan, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto, Application, PlatformFeature, PlanApplication } from '../types/subscription';
```

**2b — Add the method after `deleteFeature`** (at end of the `saasService` object, before the closing `}`):

```ts
  async getPlanApplications(planId: number): Promise<PlanApplication[]> {
    const response = await saasApiFetch<{
      data: PlanApplication[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(`plan-applications?subscriptionPlanId=${planId}&limit=100`);
    return response.data;
  },
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
git add src/types/subscription.ts src/services/saasService.ts
git commit -m "feat: add PlanApplication type and getPlanApplications service method"
```

---

### Task 3: Write failing tests for PlanApplicationsView (TDD)

**Files:**
- Create: `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`

**Interfaces:**
- Consumes: `PlanApplication` from `../../types/subscription`; `saasService.getPlanApplications` mock; `SubscriptionPlan` from `../../types/subscription`
- Produces: failing test suite (component does not exist yet)

- [ ] **Step 1: Create the test file**

Create `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanApplicationsView } from './PlanApplicationsView';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';

vi.mock('../../services/saasService', () => ({
  saasService: {
    getPlanApplications: vi.fn(),
  },
}));

const MOCK_PLAN: SubscriptionPlan = {
  id: 3,
  name: 'Gold Plan',
  description: 'Full-featured tier.',
  price: 99.99,
  billingCycle: 'monthly',
  status: 'active',
};

const MOCK_PLAN_APPS: PlanApplication[] = [
  {
    id: 1,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    application: { id: 5, name: 'POS Core', category: 'Point of Sale' },
    limits: 'Basic usage limit: 100 users per month',
    status: 'active',
  },
  {
    id: 2,
    subscriptionPlan: { id: 3, name: 'Gold Plan' },
    application: { id: 7, name: 'Kitchen Display', category: 'Kitchen Display' },
    limits: 'Up to 3 KDS screens',
    status: 'inactive',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanApplicationsView — loading state', () => {
  it('shows skeleton rows while data is loading', () => {
    vi.mocked(saasService.getPlanApplications).mockReturnValue(new Promise(() => {}));
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('PlanApplicationsView — title card', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('shows the dark title card with plan name', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText(/APPLICATIONS BOUND TO PLAN: Gold Plan/i),
      ).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — table rendering', () => {
  beforeEach(() => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
  });

  it('renders one row per plan application', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('POS Core')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
    });
  });

  it('shows application ID as a code snippet', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('renders the software category tag for each row', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Point of Sale')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Display')).toBeInTheDocument();
    });
  });

  it('renders the usage restrictions text', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText('Basic usage limit: 100 users per month'),
      ).toBeInTheDocument();
    });
  });

  it('renders active status badge with emerald styling', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getAllByText(/active/i)[0];
      expect(badge.className).toContain('text-green-600');
    });
  });

  it('renders inactive status badge with grey styling', async () => {
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      const badge = screen.getByText(/inactive/i);
      expect(badge.className).toContain('text-[#5f5e5e]');
    });
  });
});

describe('PlanApplicationsView — empty state (AC 4)', () => {
  it('shows empty state block when plan has no applications', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue([]);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(
        screen.getByText(
          /This subscription plan currently has no applications linked/i,
        ),
      ).toBeInTheDocument();
    });
  });
});

describe('PlanApplicationsView — error handling', () => {
  it('shows error toast when API call fails', async () => {
    vi.mocked(saasService.getPlanApplications).mockRejectedValue(
      new Error('Network failure'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('shows session-expired toast on SESSION_EXPIRED error', async () => {
    vi.mocked(saasService.getPlanApplications).mockRejectedValue(
      new Error('SESSION_EXPIRED'),
    );
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Session expired/i),
      ).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail with "module not found"**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx
```

Expected: FAIL — `Cannot find module './PlanApplicationsView'`

---

### Task 4: Implement PlanApplicationsView

**Files:**
- Create: `src/components/SaaSDashboard/PlanApplicationsView.tsx`

**Interfaces:**
- Consumes: `PlanApplication` from `../../types/subscription`; `SubscriptionPlan` from `../../types/subscription`; `saasService.getPlanApplications`
- Produces: exported `PlanApplicationsView` component

- [ ] **Step 1: Create the component**

Create `src/components/SaaSDashboard/PlanApplicationsView.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';

interface PlanApplicationsViewProps {
  plan: SubscriptionPlan;
  onNavigate?: (view: string) => void;
}

export const PlanApplicationsView: React.FC<PlanApplicationsViewProps> = ({
  plan,
  onNavigate,
}) => {
  const [planApplications, setPlanApplications] = useState<PlanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    saasService
      .getPlanApplications(plan.id)
      .then(setPlanApplications)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load plan applications';
        if (msg === 'SESSION_EXPIRED') {
          setToast({
            message: 'Session expired. Please refresh the page to sign in again.',
            type: 'error',
          });
        } else {
          setToast({ message: msg, type: 'error' });
        }
      })
      .finally(() => setLoading(false));
  }, [plan.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="flex flex-col gap-6">
      {/* Dark Title Card */}
      <div className="bg-[#222222] px-6 py-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          APPLICATIONS BOUND TO PLAN: {plan.name}
        </span>
      </div>

      {/* Empty State */}
      {!loading && planApplications.length === 0 && (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center py-24 gap-6"
        >
          <span
            className="material-symbols-outlined text-[#5f5e5e]"
            style={{ fontSize: '72px' }}
          >
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
      )}

      {/* Table */}
      {(loading || planApplications.length > 0) && (
        <div className="bg-white border border-[#e8e2d8] overflow-hidden">
          <div className="px-4 py-3 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white">
              BOUND APPLICATIONS
            </span>
            <span className="text-white/50 text-xs">
              {loading ? '...' : `${planApplications.length} entries`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Linked Application &amp; ID
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Software Category
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Usage Restrictions
                  </th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Association Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {loading
                  ? [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-40" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-24" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-48" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-14 mx-auto" />
                        </td>
                      </tr>
                    ))
                  : planApplications.map((pa) => (
                      <tr
                        key={pa.id}
                        className="hover:bg-[#f8f3eb] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#1d1c17]">{pa.application.name}</p>
                          <code className="font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded">
                            {pa.id}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-[#f2ede5] border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                            {pa.application.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-[#5f5e5e]">{pa.limits}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {pa.status === 'active' ? (
                            <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              active
                            </span>
                          ) : (
                            <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center border-t border-[#e8e2d8] pt-5 mt-2 mb-8">
        <button
          type="button"
          onClick={() => onNavigate?.('subscription')}
          className="text-[11px] font-bold uppercase tracking-widest text-[#ae001a] hover:underline flex items-center gap-1"
        >
          ← Back to Subscription Plans
        </button>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mt-3 md:mt-0">
          © 2026 X7 Point of Sale. All rights reserved.
        </p>
      </footer>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanApplicationsView;
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run src/components/SaaSDashboard/PlanApplicationsView.test.tsx
```

Expected: all 11 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.tsx
git add src/components/SaaSDashboard/PlanApplicationsView.test.tsx
git commit -m "feat: add PlanApplicationsView component with tests"
```

---

### Task 5: Wire shell — SaaSDashboard + SubscriptionPlansView navigation

**Files:**
- Modify: `src/components/SaaSDashboard/SaaSDashboard.tsx`
- Modify: `src/components/SaaSDashboard/SubscriptionPlansView.tsx`

**Interfaces:**
- Consumes: `PlanApplicationsView` (from Task 4); `SubscriptionPlan` type; `handleNavigateView(view, plan?)`
- Produces: clicking `grid_view` on a plan row navigates to `subscription-plan-applications` and renders `PlanApplicationsView` with the selected plan

- [ ] **Step 1: Update `SaaSDashboard.tsx` — imports, state, navigation, breadcrumbs, renderContent**

**1a — Add imports at the top of the file** (after existing imports):

```ts
import { PlanApplicationsView } from './PlanApplicationsView';
import type { SubscriptionPlan } from '../../types/subscription';
```

**1b — Add `selectedPlan` state** (after the `activeTab` state declaration around line 13):

```ts
const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
```

**1c — Replace `handleNavigateView`** (currently at line 70-72):

```ts
const handleNavigateView = (view: string, plan?: SubscriptionPlan) => {
  if (plan) setSelectedPlan(plan);
  setActiveTab(view);
};
```

**1d — Replace the breadcrumb condition block** (currently lines 329-345). Replace:

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

With:

```tsx
{(activeTab === 'subscription-applications' ||
activeTab === 'subscription-live-installs' ||
activeTab === 'subscription-features' ||
activeTab === 'subscription-plan-applications') && (
  <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
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
)}
```

**1e — Add `subscription-plan-applications` to the h1 ternary chain** (around line 348). Add before the final `: activeTab` fallback:

```
: activeTab === 'subscription-plan-applications' ? 'Plan Applications'
```

**1f — Add description to the p ternary chain** (around line 362). Add before the final fallback line:

```
: activeTab === 'subscription-plan-applications'
  ? `Applications bundled into the "${selectedPlan?.name}" subscription tier.`
```

**1g — Add the new case to `renderContent`** (insert before the `if (activeTab === 'subscription-payments' || ...)` block):

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

- [ ] **Step 2: Update `SubscriptionPlansView.tsx` — onNavigate type + grid_view button**

**2a — Update the props interface** (around line 22-24):

```ts
interface SubscriptionPlansViewProps {
  onNavigate?: (view: string, plan?: SubscriptionPlan) => void;
}
```

**2b — Add the `grid_view` button in the Actions column** (inside the `filtered.map((plan) => ...)` tbody row, in the actions `td`, before the edit button). The current actions div contains only edit and delete buttons. Add `grid_view` first:

```tsx
<div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
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
  <button
    type="button"
    aria-label={`Edit ${plan.name}`}
    onClick={() => openEditModal(plan)}
    disabled={plan.status === 'deleted'}
    className={`p-1 transition-colors ${
      plan.status === 'deleted'
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:text-[#ae001a]'
    }`}
  >
    <span className="material-symbols-outlined text-xl">edit</span>
  </button>
  {plan.status !== 'deleted' && (
    <button
      type="button"
      aria-label={`Delete ${plan.name}`}
      onClick={() => setDeletingPlan(plan)}
      className="p-1 hover:text-red-600 transition-colors"
    >
      <span className="material-symbols-outlined text-xl">delete</span>
    </button>
  )}
</div>
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd "C:\Users\Rafael Cordero\x7-pos-backoffice"
npx vitest run
```

Expected: all tests pass. If `SubscriptionPlansView.test.tsx` has tests that render the Actions column, verify no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/components/SaaSDashboard/SaaSDashboard.tsx
git add src/components/SaaSDashboard/SubscriptionPlansView.tsx
git commit -m "feat: wire PlanApplicationsView into shell navigation and SubscriptionPlansView row actions"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| AC 1: dark sidebar, breadcrumbs `SaaS Admin > Subscription Architecture > Plan Applications`, footer | Task 5 (shell breadcrumbs + SaaSDashboard header) |
| AC 2: title card `APPLICATIONS BOUND TO PLAN: [Plan_Name]` with `#222222` | Task 4 (PlanApplicationsView dark title card) |
| AC 3a: Linked Application — bold name + id code snippet | Task 4 |
| AC 3b: Software Category — tag chip | Task 4 |
| AC 3c: Usage Restrictions — limits text | Task 4 |
| AC 3d: Association Status — emerald active / charcoal inactive | Task 4 |
| AC 4: empty state with exact text | Task 4 |
| Backend `subscriptionPlanId` filter | Task 1 |
| Backend `application.category` in response | Task 1 |
| Navigation from plan row | Task 5 (SubscriptionPlansView) |
| `PlanApplication` type | Task 2 |
| `getPlanApplications` service method | Task 2 |
| Tests for all key behaviors | Task 3 (written before component) |

All requirements covered. No gaps.

**Placeholder scan:** No TBD, TODO, or vague steps found. Every step has complete code.

**Type consistency:**
- `PlanApplication.application.category` — defined in Task 2, accessed in Task 4 template, returned by backend in Task 1 ✓
- `handleNavigateView(view: string, plan?: SubscriptionPlan)` — defined in Task 5 step 1c, consumed as `onNavigate?.('subscription-plan-applications', plan)` in Task 5 step 2b ✓
- `saasService.getPlanApplications(plan.id)` — defined in Task 2, called in Task 4 `useEffect` ✓
- `data-testid="empty-state"` — used in test (Task 3) and rendered in component (Task 4) ✓
