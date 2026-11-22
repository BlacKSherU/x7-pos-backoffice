import { isValidElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend } from '@/test/fetch';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { navHubById, navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import { renderMerchantView, type MerchantViewContext } from '@/platform/merchant-frame/merchant-view-registry';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { ReceiptsView } from './ReceiptsView';
import { ReceiptsQuickLaunch } from './ReceiptsQuickLaunch';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const emptyPage = { data: [], page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

describe('Receipts — NavHubBar (Historia 17)', () => {
  const billingHub = navHubById('billing-transactions-hub')!;

  it('belongs to the Billing & Transactions hub, so MerchantFrame anchors the bar in the Receipts view', () => {
    expect(navHubForFeature('receipt-orders')?.hubId).toBe('billing-transactions-hub');
    expect(billingHub.items.find((item) => item.featureId === 'receipt-orders')?.live).toBe(true);
  });

  function renderBar(onNavigate = vi.fn()) {
    render(<ModuleNavHubBar hub={billingHub} currentFeatureId="receipt-orders" onNavigate={onNavigate} />);
    return { onNavigate, nav: screen.getByRole('navigation', { name: /billing & transactions module navigation/i }) };
  }

  it('is a fixed bar at the bottom of the view', () => {
    const { nav } = renderBar();
    expect(nav.querySelector('.fixed.bottom-0')).not.toBeNull();
  });

  it('lists RECEIPTS, RECEIPT ITEMS and RECEIPTS TAXES with RECEIPTS active (#ae001a, bold)', () => {
    const { nav } = renderBar();

    const buttons = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent?.replace(/^(receipt_long|list|percent)/, '').trim());
    expect(buttons).toEqual(expect.arrayContaining(['Receipts', 'Receipt Items', 'Receipts Taxes']));
    expect(buttons.indexOf('Receipts')).toBeLessThan(buttons.indexOf('Receipt Items'));
    expect(buttons.indexOf('Receipt Items')).toBeLessThan(buttons.indexOf('Receipts Taxes'));

    const receipts = within(nav).getByRole('button', { name: 'Receipts' });
    expect(receipts).toHaveAttribute('aria-current', 'page');
    expect(receipts.className).toContain('bg-[#ae001a]');
    expect(receipts.className).toContain('font-bold');
    expect(within(nav).getByRole('button', { name: 'Receipt Items' })).not.toHaveAttribute('aria-current');
  });

  it('navigates to RECEIPT ITEMS and RECEIPTS TAXES as SPA views', async () => {
    const { nav, onNavigate } = renderBar();

    await userEvent.click(within(nav).getByRole('button', { name: 'Receipt Items' }));
    await userEvent.click(within(nav).getByRole('button', { name: 'Receipts Taxes' }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'receipt-items');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'receipt-taxes');
  });

  it('returns to the Command Hub from the left button', async () => {
    const { onNavigate } = renderBar();

    await userEvent.click(screen.getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }));

    expect(onNavigate).toHaveBeenCalledWith('billing-transactions-hub');
  });

  it('registers the Receipts view and its URL', () => {
    const navigateToFeature = vi.fn();
    const node = renderMerchantView('receipt-orders', { navigateToFeature } as unknown as MerchantViewContext);
    expect(isValidElement(node) && node.type).toBe(ReceiptsView);
    expect(getNavFromPath('/app/billing-transactions/receipt-orders')).toEqual({
      category: 'core',
      tab: 'receipt-orders',
    });
  });
});

describe('Receipts — Quick Launch (Historia 17)', () => {
  it('marks RECEIPTS as the active anchor and links the sibling views', async () => {
    const onNavigate = vi.fn();
    render(<ReceiptsQuickLaunch onNavigate={onNavigate} onNewReceipt={vi.fn()} onShowDeactivated={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Receipts quick launch' });
    const active = within(nav).getByText('RECEIPTS');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.parentElement?.className).toContain('bg-[#ae001a]');

    await userEvent.click(within(nav).getByRole('button', { name: /receipt items/i }));
    await userEvent.click(within(nav).getByRole('button', { name: /receipts taxes/i }));
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'receipt-items');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'receipt-taxes');
  });

  it('offers shortcuts to frequent operations', async () => {
    const onNewReceipt = vi.fn();
    const onShowDeactivated = vi.fn();
    render(<ReceiptsQuickLaunch onNewReceipt={onNewReceipt} onShowDeactivated={onShowDeactivated} />);

    await userEvent.click(screen.getByRole('button', { name: /new receipt/i }));
    await userEvent.click(screen.getByRole('button', { name: /deactivated receipts/i }));

    expect(onNewReceipt).toHaveBeenCalledTimes(1);
    expect(onShowDeactivated).toHaveBeenCalledTimes(1);
  });

  it('is wired into the Receipts view: new receipt drawer and deactivated list', async () => {
    const fetchMock = fakeBackend({ '/receipts': emptyPage, '/receipts/summary': { data: null } });
    vi.stubGlobal('fetch', fetchMock);
    const onNavigate = vi.fn();
    render(<ReceiptsView onNavigate={onNavigate} />);

    const quickLaunch = screen.getByRole('navigation', { name: 'Receipts quick launch' });
    await userEvent.click(within(quickLaunch).getByRole('button', { name: /deactivated receipts/i }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([u]) => /\/receipts\?.*status=inactive/.test(String(u))),
      ).toBe(true),
    );

    await userEvent.click(within(quickLaunch).getByRole('button', { name: /new receipt/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('New Receipt');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(quickLaunch).getByRole('button', { name: /receipt items/i }));
    expect(onNavigate).toHaveBeenCalledWith('receipt-items');
  });
});
