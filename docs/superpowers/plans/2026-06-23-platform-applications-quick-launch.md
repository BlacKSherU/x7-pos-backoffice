# Platform Applications Quick Launch Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quick Launch panel at the bottom of `PlatformApplicationsView` with 4 navigation shortcuts, mirroring the existing panel in `SubscriptionPlansView`.

**Architecture:** Add an `onNavigate` prop to `PlatformApplicationsView`, insert the Quick Launch block after the table card, wire it in `SaaSDashboard`, and add a `subscription-live-installs` stub route. No new files; no shared component.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest, React Testing Library.

## Global Constraints

- Button hover: `translateY(-2px)` via `hover:-translate-y-0.5 transition-transform`
- White button border accent: `border-b-4 border-[#ae001a]` (border-bottom: 4px solid #ae001a)
- Panel background: `bg-[#2a2a2a]`
- EMERGENCY SUPPORT has no `onClick` (stub, consistent with `SubscriptionPlansView`)
- Quick Launch panel only in the main return — NOT in the empty-state early return
- Run tests with: `npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`

---

## File Map

| File | Change |
|------|--------|
| `src/components/SaaSDashboard/PlatformApplicationsView.tsx` | Add `onNavigate` prop + Quick Launch panel block |
| `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx` | Add tests for Quick Launch rendering and navigation callbacks |
| `src/components/SaaSDashboard/SaaSDashboard.tsx` | Pass `onNavigate`, add stub, update breadcrumb/title/description |

---

## Task 1: Quick Launch panel in PlatformApplicationsView

**Files:**
- Modify: `src/components/SaaSDashboard/PlatformApplicationsView.tsx`
- Test: `src/components/SaaSDashboard/PlatformApplicationsView.test.tsx`

**Interfaces:**
- Produces: `PlatformApplicationsView` now accepts `onNavigate?: (view: string) => void`

---

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the bottom of `PlatformApplicationsView.test.tsx`, after the existing test suites. The existing `renderView()` helper renders without props; add a separate helper for the navigation tests:

```tsx
describe('PlatformApplicationsView — Quick Launch panel', () => {
  beforeEach(() => {
    vi.mocked(saasService.getApplications).mockResolvedValue(MOCK_APPS);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the Quick Launch panel with heading', async () => {
    render(<PlatformApplicationsView />);
    await waitFor(() => {
      expect(screen.getByText('Quick Launch')).toBeInTheDocument();
    });
  });

  it('renders all four Quick Launch buttons', async () => {
    render(<PlatformApplicationsView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' })).toBeInTheDocument();
    });
  });

  it('calls onNavigate with "subscription" when SUBSCRIPTION PLANS is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    await userEvent.click(screen.getByRole('button', { name: 'SUBSCRIPTION PLANS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription');
  });

  it('calls onNavigate with "subscription-features" when FEATURE CATALOG INDEX is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' }));
    await userEvent.click(screen.getByRole('button', { name: 'FEATURE CATALOG INDEX' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-features');
  });

  it('calls onNavigate with "subscription-live-installs" when ACTIVE LIVE INSTALLS is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' }));
    await userEvent.click(screen.getByRole('button', { name: 'ACTIVE LIVE INSTALLS' }));
    expect(onNavigate).toHaveBeenCalledWith('subscription-live-installs');
  });

  it('does not call onNavigate when EMERGENCY SUPPORT is clicked', async () => {
    const onNavigate = vi.fn();
    render(<PlatformApplicationsView onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    await userEvent.click(screen.getByRole('button', { name: 'EMERGENCY SUPPORT' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: the 6 new tests FAIL (component doesn't accept `onNavigate` prop yet and has no Quick Launch panel).

- [ ] **Step 3: Add `onNavigate` prop and Quick Launch panel to `PlatformApplicationsView`**

In `PlatformApplicationsView.tsx`:

**3a. Add the props interface** — insert before the component (after line 4, before `interface EditAppDialogProps`):

```tsx
interface PlatformApplicationsViewProps {
  onNavigate?: (view: string) => void;
}
```

**3b. Update the component signature** — change line 332:

```tsx
// BEFORE
export const PlatformApplicationsView: React.FC = () => {

// AFTER
export const PlatformApplicationsView: React.FC<PlatformApplicationsViewProps> = ({ onNavigate }) => {
```

**3c. Insert the Quick Launch panel** — add it after the closing `</div>` of the Table Card (after the `</div>` on line 668) and before the FAB `<button>` (line 670). The result in the main return's `<div className="flex flex-col gap-6">` should be:

```tsx
      {/* Quick Launch */}
      <div className="bg-[#2a2a2a] rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="!text-white font-bold text-base">Quick Launch</h3>
          <p className="text-white/60 text-sm">
            Navigation shortcuts for platform management.
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
            onClick={() => onNavigate?.('subscription-features')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            FEATURE CATALOG INDEX
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-live-installs')}
            className="bg-white text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest px-6 py-3 border-b-4 border-[#ae001a] hover:-translate-y-0.5 transition-transform"
          >
            ACTIVE LIVE INSTALLS
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

- [ ] **Step 4: Run tests and confirm all pass**

```
npx vitest run src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
```

Expected: all tests PASS (existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/SaaSDashboard/PlatformApplicationsView.tsx src/components/SaaSDashboard/PlatformApplicationsView.test.tsx
git commit -m "feat: add Quick Launch panel to PlatformApplicationsView"
```

---

## Task 2: Wire SaaSDashboard — prop, stub route, breadcrumb, header

**Files:**
- Modify: `src/components/SaaSDashboard/SaaSDashboard.tsx`

**Interfaces:**
- Consumes: `PlatformApplicationsView` now accepts `onNavigate?: (view: string) => void` (from Task 1)

---

- [ ] **Step 1: Pass `onNavigate` to `PlatformApplicationsView`**

In `SaaSDashboard.tsx` line 80, change:

```tsx
// BEFORE
    if (activeTab === 'subscription-applications') {
      return <PlatformApplicationsView />;
    }

// AFTER
    if (activeTab === 'subscription-applications') {
      return <PlatformApplicationsView onNavigate={handleNavigateView} />;
    }
```

- [ ] **Step 2: Add `subscription-live-installs` to the stub block**

The stub block starts at line 83. Change the condition and the config object:

```tsx
// BEFORE
    if (
      activeTab === 'subscription-features' ||
      activeTab === 'subscription-payments'
    ) {
      const subConfig = {
        'subscription-features': {
          icon: 'featured_play_list',
          title: 'Feature Catalog Map',
          desc: 'Master feature flags and platform capability tables.',
        },
        'subscription-payments': {
          icon: 'payments',
          title: 'Subscription Payments',
          desc: 'Centralized billing book tracking payment logs from active merchants.',
        },
      }[activeTab as 'subscription-features' | 'subscription-payments'];
      return (
        <div className="bg-white border border-[#e8e2d8] p-12 rounded flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[#d51f2c] text-6xl">{subConfig.icon}</span>
          <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">{subConfig.title}</h2>
          <p className="text-body-md text-[#666666] mt-2 max-w-md text-center">{subConfig.desc}</p>
          <button
            onClick={() => setActiveTab('subscription')}
            className="mt-6 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#d51f2c] transition-all"
          >
            Back to Subscription Plans
          </button>
        </div>
      );
    }

// AFTER
    if (
      activeTab === 'subscription-features' ||
      activeTab === 'subscription-payments' ||
      activeTab === 'subscription-live-installs'
    ) {
      const subConfig = {
        'subscription-features': {
          icon: 'featured_play_list',
          title: 'Feature Catalog Map',
          desc: 'Master feature flags and platform capability tables.',
          backLabel: 'Back to Subscription Plans',
          backTab: 'subscription',
        },
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
      }[activeTab as 'subscription-features' | 'subscription-payments' | 'subscription-live-installs'];
      return (
        <div className="bg-white border border-[#e8e2d8] p-12 rounded flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[#d51f2c] text-6xl">{subConfig.icon}</span>
          <h2 className="text-h2 font-black text-[#222222] mt-4 uppercase">{subConfig.title}</h2>
          <p className="text-body-md text-[#666666] mt-2 max-w-md text-center">{subConfig.desc}</p>
          <button
            onClick={() => setActiveTab(subConfig.backTab)}
            className="mt-6 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#d51f2c] transition-all"
          >
            {subConfig.backLabel}
          </button>
        </div>
      );
    }
```

- [ ] **Step 3: Add breadcrumb for `subscription-live-installs`**

Around line 320, the breadcrumb block currently covers only `subscription-applications`. Expand it:

```tsx
// BEFORE
              {activeTab === 'subscription-applications' && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span>Platform Architecture</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">Applications</span>
                </nav>
              )}

// AFTER
              {(activeTab === 'subscription-applications' || activeTab === 'subscription-live-installs') && (
                <nav className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1">
                  <span>SaaS Admin</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span>Platform Architecture</span>
                  <span className="text-[#d51f2c]">›</span>
                  <span className="text-[#1d1c17]">
                    {activeTab === 'subscription-applications' ? 'Applications' : 'Live Installs'}
                  </span>
                </nav>
              )}
```

- [ ] **Step 4: Add `subscription-live-installs` to the h1 title chain**

Around line 331, extend the ternary:

```tsx
// BEFORE
                  : activeTab === 'subscription-payments' ? 'Payments'
                  : activeTab}

// AFTER
                  : activeTab === 'subscription-payments' ? 'Payments'
                  : activeTab === 'subscription-live-installs' ? 'Live Installs'
                  : activeTab}
```

- [ ] **Step 5: Add `subscription-live-installs` to the description paragraph**

Around line 343, extend the ternary in the `<p>` below the `<h1>`:

```tsx
// BEFORE
                        : activeTab === 'subscription-payments'
                          ? 'Track payment logs and incoming cash movements from active merchants.'
                          : `Visualización interactiva y gestión para /${activeTab}.`}

// AFTER
                        : activeTab === 'subscription-payments'
                          ? 'Track payment logs and incoming cash movements from active merchants.'
                          : activeTab === 'subscription-live-installs'
                            ? 'Monitor live merchant profiles mapped to individual applications.'
                            : `Visualización interactiva y gestión para /${activeTab}.`}
```

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```
npx vitest run src/components/SaaSDashboard/
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SaaSDashboard/SaaSDashboard.tsx
git commit -m "feat: wire Quick Launch navigation and add subscription-live-installs stub"
```
