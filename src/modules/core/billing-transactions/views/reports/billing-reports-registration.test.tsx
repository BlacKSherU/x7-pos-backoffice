import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderMerchantView, REGISTERED_VIEW_TABS } from '@/platform/merchant-frame/merchant-view-registry';
import type { MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath, MERCHANT_ROUTE_PATHS } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { BillingReportsView } from './BillingReportsView';

// La pantalla `billing-reports` queda registrada en la vista, la ruta, el hub y la NavHubBar.
describe('billing-reports screen registration', () => {
  afterEach(() => cleanup());

  it('renders BillingReportsView for the billing-reports tab', () => {
    const onNavigate = vi.fn();
    const node = renderMerchantView('billing-reports', { onNavigate } as unknown as MerchantViewContext);
    expect(REGISTERED_VIEW_TABS).toContain('billing-reports');
    expect(isValidElement(node)).toBe(true);
    if (!isValidElement<{ onNavigate?: unknown }>(node)) throw new Error('no view');
    expect(node.type).toBe(BillingReportsView);
    expect(node.props.onNavigate).toBe(onNavigate);
  });

  it('routes the nav_item URL to the billing-reports tab', () => {
    expect(MERCHANT_ROUTE_PATHS).toContain('/app/billing-transactions/billing-reports');
    expect(getNavFromPath('/app/billing-transactions/billing-reports')).toEqual({
      category: 'core',
      tab: 'billing-reports',
    });
  });

  it('belongs to the Billing & Transactions hub as a live option', () => {
    const hub = navHubForFeature('billing-reports');
    expect(hub?.appId).toBe('billing-transactions');
    expect(hub?.items.find((item) => item.featureId === 'billing-reports')).toMatchObject({
      label: 'Billing Reports',
      icon: 'summarize',
      live: true,
    });
  });

  it('shows REPORTS as the active NavHubBar entry', () => {
    const hub = navHubForFeature('billing-reports');
    if (!hub) throw new Error('missing hub');
    render(<ModuleNavHubBar hub={hub} currentFeatureId="billing-reports" onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^reports$/i })).toHaveAttribute('aria-current', 'page');
  });
});
