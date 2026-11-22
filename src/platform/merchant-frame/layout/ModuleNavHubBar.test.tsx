import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { navHubById } from '@/platform/navigation/module-nav-hubs';

afterEach(cleanup);

describe('ModuleNavHubBar', () => {
  const hr = navHubById('hr-hub')!;

  it('renders every 3rd-level option and marks the active view', () => {
    render(
      <ModuleNavHubBar
        hub={hr}
        currentFeatureId="collaborators-contracts"
        onNavigate={vi.fn()}
      />,
    );
    const nav = screen.getByRole('navigation', {
      name: /hr & staff module navigation/i,
    });

    for (const label of [
      'Collaborators',
      'Contracts',
      'Time Entries',
    ]) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(
      within(nav).getByRole('button', { name: 'Contracts' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('button', { name: 'Collaborators' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('returns to the module Command Hub from the left button', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ModuleNavHubBar
        hub={hr}
        currentFeatureId="collaborators"
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'HR COMMAND HUB' }));
    expect(onNavigate).toHaveBeenCalledWith('hr-hub');
  });

  it('navigates to the featureId of the clicked option', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ModuleNavHubBar
        hub={hr}
        currentFeatureId="collaborators"
        onNavigate={onNavigate}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Time Entries' }),
    );
    expect(onNavigate).toHaveBeenCalledWith('collaborators-time-entries');
  });

  it('adds the cross-module hub links of the active option only', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const billing = navHubById('billing-transactions-hub')!;
    const { rerender } = render(
      <ModuleNavHubBar
        hub={billing}
        currentFeatureId="billing-inventory-sync"
        onNavigate={onNavigate}
      />,
    );
    const nav = screen.getByRole('navigation', {
      name: /billing & transactions module navigation/i,
    });
    expect(
      within(nav).getByRole('button', { name: 'Inventory Sync' }),
    ).toHaveAttribute('aria-current', 'page');
    await user.click(within(nav).getByRole('button', { name: 'Products Hub' }));
    await user.click(within(nav).getByRole('button', { name: 'Raw Materials Hub' }));
    await user.click(
      within(nav).getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }),
    );
    expect(onNavigate.mock.calls.map(([id]) => id)).toEqual([
      'inventory-dashboard',
      'raw-materials-dashboard',
      'billing-transactions-hub',
    ]);

    rerender(
      <ModuleNavHubBar hub={billing} currentFeatureId="receipt-items" onNavigate={onNavigate} />,
    );
    expect(screen.queryByRole('button', { name: 'Products Hub' })).toBeNull();
  });

  it('is a fixed bottom bar', () => {
    render(
      <ModuleNavHubBar
        hub={hr}
        currentFeatureId="collaborators"
        onNavigate={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole('navigation', { name: /hr & staff module navigation/i })
        .querySelector('.fixed.bottom-0'),
    ).not.toBeNull();
  });
});
