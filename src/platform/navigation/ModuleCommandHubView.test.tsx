import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleCommandHubView } from '@/platform/navigation/ModuleCommandHubView';
import { navHubById } from '@/platform/navigation/module-nav-hubs';

afterEach(cleanup);

describe('ModuleCommandHubView', () => {
  it('lists every workspace of the module and opens the clicked one', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ModuleCommandHubView
        hub={navHubById('pos-hub')!}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText('Point of Sale Command Hub')).toBeInTheDocument();
    for (const label of [
      'Order Discounts & Promotions',
      'Order Items & Course Routing',
      'Order Modifiers & Upcharges',
      'Order Payment Tenders',
      'Order Taxes & Surcharges',
      'Point of Sale Orders & Bills',
    ]) {
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    }

    await user.click(screen.getByText('Order Payment Tenders', { exact: true }));
    expect(onNavigate).toHaveBeenCalledWith('order-payments');
  });

  it('reports how many workspaces are available and how many are still in development', () => {
    render(
      <ModuleCommandHubView
        hub={navHubById('business-partners-hub')!}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In Development').length).toBeGreaterThan(0);
  });
});
