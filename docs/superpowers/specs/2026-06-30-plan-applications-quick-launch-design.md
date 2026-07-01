# Design: Quick Launch panel for Plan Applications View

**Date:** 2026-06-30
**Branch:** rafaalejandro_subscription
**Status:** Approved

## User Story

As a SaaS Owner, I want to access horizontal shortcut links at the base of the
application mapping layout, so that I can move between parent plans, base
catalogs, or granular feature flags without navigating through multiple
dropdown folders.

## Context

`PlanApplicationsView.tsx` (the plan ↔ application mapping screen) has no
Quick Launch panel today. A near-identical panel already exists in
`PlatformApplicationsView.tsx` (added 2026-06-24, see
`docs/superpowers/specs/2026-06-23-platform-applications-quick-launch-design.md`)
and is the proven reference implementation for this AC wording — same
container styling, same hover elevation, same red bottom-border accent. This
spec reuses that pattern for the new screen rather than inventing a new one.

## Acceptance Criteria

- **AC1:** The base of the main content view houses a "Quick Launch"
  container with a flat dark background (`#2a2a2a`).
- **AC2:** The deck renders exactly four interactive buttons with
  `hover:-translate-y-0.5` elevation (-2px) and `border-b-4 border-[#ae001a]`
  (red accent bottom border) on the three white buttons:
  - **SUBSCRIPTION PLANS** (white) → navigates to the parent pricing tier
    console (`onNavigate?.('subscription')`, mounts `SubscriptionPlansView`).
  - **APPLICATIONS CATALOG** (white) → navigates to the baseline software
    catalog grid (`onNavigate?.('subscription-applications')`, mounts
    `PlatformApplicationsView`).
  - **MASTER FEATURE FLAGS** (white) → navigates to the system-wide
    capabilities matrix (`onNavigate?.('subscription-features')`, mounts
    `PlatformFeatureCatalogView`).
  - **EMERGENCY SUPPORT** (primary red) → visual-only, no `onClick`. No
    escalation/paging system exists in this codebase to wire it to; the
    precedent panel leaves this button decorative for the same reason.

## Placement & Visibility

Rendered unconditionally — visible in both the "No Applications Linked"
empty state and the populated table state. `PlanApplicationsView` has no
early return (unlike `PlatformApplicationsView`, which returns early for its
empty state and excludes Quick Launch there); all states render inside one
`<div className="flex flex-col gap-6">`, so the panel sits as a normal block
between the empty-state/table block and the existing footer.

## Component Changes

`src/components/SaaSDashboard/PlanApplicationsView.tsx`:

- Reuses the existing `onNavigate?: (view: string) => void` prop — already
  present on `PlanApplicationsViewProps`, no signature change needed.
- New JSX block, copied structurally from `PlatformApplicationsView.tsx`'s
  Quick Launch panel (heading, subtext, 4 buttons), with the three navigation
  targets and label text from AC2 above.
- No new state, no new service calls.

## Testing

TDD: a new `describe('PlanApplicationsView — quick launch')` block in
`PlanApplicationsView.test.tsx` asserting:

1. All four buttons render with their exact labels, in both the empty state
   and the populated-table state.
2. Each white button calls `onNavigate` with the correct view key on click.
3. EMERGENCY SUPPORT has no click handler wired (clicking it does not call
   `onNavigate`).

Tests committed first (red), then implementation (green), per project
convention.

## Out of Scope

- Wiring EMERGENCY SUPPORT to any real alerting/paging system.
- Changing the Quick Launch panel already shipped on
  `PlatformApplicationsView.tsx`.
