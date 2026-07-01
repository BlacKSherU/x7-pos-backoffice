# Plan Applications Quick Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Quick Launch" shortcut panel to the base of `PlanApplicationsView.tsx` with four buttons that navigate the SaaS Owner between the parent Subscription Plans console, the Applications Catalog, and the Master Feature Flags workbench, plus a decorative Emergency Support button.

**Architecture:** Pure UI addition to an existing React component — a new JSX block reusing the `onNavigate?: (view: string) => void` prop that `PlanApplicationsView` already accepts. No new state, no new service calls, no new files. The panel renders unconditionally (both empty-state and populated-table states), placed between the existing data block and the existing footer.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + React Testing Library + `@testing-library/user-event`.

## Global Constraints

- Quick Launch container: flat dark background `bg-[#2a2a2a]`.
- Exactly 4 buttons.
- White buttons: hover elevation `hover:-translate-y-0.5` (-2px) + `border-b-4 border-[#ae001a]` (red bottom accent).
- Red/primary button (EMERGENCY SUPPORT): `bg-[#ae001a]` background, same hover elevation, no `onClick` wired (no escalation system exists in this codebase to call).
- Button labels exactly: `SUBSCRIPTION PLANS`, `APPLICATIONS CATALOG`, `MASTER FEATURE FLAGS`, `EMERGENCY SUPPORT`.
- Navigation targets: `'subscription'`, `'subscription-applications'`, `'subscription-features'` respectively, via the existing `onNavigate` prop — no signature changes.
- Panel renders unconditionally — visible in both the empty state and the populated table state (per approved spec `docs/superpowers/specs/2026-06-30-plan-applications-quick-launch-design.md`).

---

### Task 1: Write failing tests for the Quick Launch panel

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.test.tsx`

**Interfaces:**
- Consumes: `PlanApplicationsView` component (`plan: SubscriptionPlan`, `onNavigate?: (view: string) => void`), `MOCK_PLAN`, `MOCK_PLAN_APPS` already defined at the top of this test file (lines 17-41).
- Produces: nothing new — this task only adds tests.

- [ ] **Step 1: Add the new describe block**

Append this block at the end of `src/components/SaaSDashboard/PlanApplicationsView.test.tsx` (after the last existing `describe` block, which ends with the `'PlanApplicationsView — edit submit disabled'` suite):

```tsx
describe('PlanApplicationsView — quick launch panel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the Quick Launch panel with heading when apps are present', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByText('Quick Launch')).toBeInTheDocument();
    });
  });

  it('renders the Quick Launch panel with heading in the empty state', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue([]);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('Quick Launch')).toBeInTheDocument();
    });
  });

  it('renders all four Quick Launch buttons', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    render(<PlanApplicationsView plan={MOCK_PLAN} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'APPLICATIONS CATALOG' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'MASTER FEATURE FLAGS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' })).toBeInTheDocument();
    });
  });

  it('calls onNavigate with "subscription" when SUBSCRIPTION PLANS is clicked', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    const onNavigate = vi.fn();
    render(<PlanApplicationsView plan={MOCK_PLAN} onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    await userEvent.click(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription');
  });

  it('calls onNavigate with "subscription-applications" when APPLICATIONS CATALOG is clicked', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    const onNavigate = vi.fn();
    render(<PlanApplicationsView plan={MOCK_PLAN} onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'APPLICATIONS CATALOG' }));
    await userEvent.click(screen.getByRole('button', { name: 'APPLICATIONS CATALOG' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-applications');
  });

  it('calls onNavigate with "subscription-features" when MASTER FEATURE FLAGS is clicked', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    const onNavigate = vi.fn();
    render(<PlanApplicationsView plan={MOCK_PLAN} onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'MASTER FEATURE FLAGS' }));
    await userEvent.click(screen.getByRole('button', { name: 'MASTER FEATURE FLAGS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-features');
  });

  it('does not call onNavigate when EMERGENCY SUPPORT is clicked', async () => {
    vi.mocked(saasService.getPlanApplications).mockResolvedValue(MOCK_PLAN_APPS);
    const onNavigate = vi.fn();
    render(<PlanApplicationsView plan={MOCK_PLAN} onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    await userEvent.click(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- PlanApplicationsView.test.tsx`
Expected: 7 new failures (`Unable to find an element with the text: Quick Launch` / `Unable to find role="button" with name "SUBSCRIPTION PLANS"`, etc.). All other existing tests in this file still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.test.tsx
git commit -m "test: add failing tests for plan-applications quick launch panel (TDD red phase)"
```

---

### Task 2: Implement the Quick Launch panel

**Files:**
- Modify: `src/components/SaaSDashboard/PlanApplicationsView.tsx:402-623` (the `return (...)` block of `PlanApplicationsView`)

**Interfaces:**
- Consumes: `onNavigate?: (view: string) => void` — already destructured from props at `PlanApplicationsView.tsx:281-284`. No new props.
- Produces: nothing new for other tasks — this is the final task.

- [ ] **Step 1: Insert the Quick Launch panel JSX**

In `src/components/SaaSDashboard/PlanApplicationsView.tsx`, find the `{/* Footer */}` comment block (currently starting at line 610):

```tsx
      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center border-t border-[#e8e2d8] pt-5 mt-2 mb-8">
```

Insert this new block immediately **before** it (so it sits between the table/empty-state block and the footer):

```tsx
      {/* Quick Launch */}
      <div className="bg-[#2a2a2a] rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="!text-white font-bold text-base">Quick Launch</h3>
          <p className="text-white/60 text-sm">
            Navigation shortcuts for plan management.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            SUBSCRIPTION PLANS
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-applications')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            APPLICATIONS CATALOG
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-features')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            MASTER FEATURE FLAGS
          </button>
          <button
            type="button"
            className="bg-[#ae001a] text-white text-[11px] font-bold uppercase tracking-widest px-6 py-3 rounded hover:bg-[#930015] hover:-translate-y-0.5 transition-all"
          >
            EMERGENCY SUPPORT
          </button>
        </div>
      </div>

```

This places the panel inside the outer `<div className="flex flex-col gap-6">` wrapper, after both the conditional empty-state block and the conditional table block, and before the footer — so it always renders regardless of `loading`/`fetchError`/empty/populated state.

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npm test -- PlanApplicationsView.test.tsx`
Expected: all tests pass, including the 7 new ones from Task 1.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npm test`
Expected: no new failures compared to the pre-existing baseline (this repo has 0 known frontend test failures as of 2026-06-30).

- [ ] **Step 4: Commit**

```bash
git add src/components/SaaSDashboard/PlanApplicationsView.tsx
git commit -m "feat: add Quick Launch panel to PlanApplicationsView"
```

---

## Self-Review Notes

- **Spec coverage:** AC1 (dark `#2a2a2a` container) → Task 2 Step 1. AC2 (4 buttons, hover elevation, red border, 3 white + 1 red, navigation targets, Emergency Support decorative) → Task 2 Step 1, verified by Task 1's tests. Unconditional visibility (empty + populated state) → Task 1's two heading tests + Task 2 placement before the footer outside any conditional block.
- **Type consistency:** `onNavigate` signature `(view: string) => void` matches the prop already declared in `PlanApplicationsViewProps` (`PlanApplicationsView.tsx:278`) — no changes needed there.
- **No placeholders:** all test and implementation code is complete and copy-pasteable.
