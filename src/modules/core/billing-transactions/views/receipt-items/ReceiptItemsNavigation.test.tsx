import { isValidElement, type ReactElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptItemsQuickLaunch } from './ReceiptItemsQuickLaunch';
import { ReceiptItemsView } from './ReceiptItemsView';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { navHubById, navHubForFeature } from '@/platform/navigation/module-nav-hubs';
import {
  renderMerchantView,
  type MerchantViewContext,
} from '@/platform/merchant-frame/merchant-view-registry';
import { fakeBackend } from '@/test/fetch';

vi.mock('@/platform/auth/lib/auth-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/auth/lib/auth-storage')>()),
  getAccessToken: vi.fn(() => 'mock-token'),
  redirectToLogin: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const SIBLINGS = ['receipt-orders', 'receipt-items', 'receipt-taxes'];

describe('Receipt Items — Quick Launch (Historia 15)', () => {
  it('offers RECEIPTS, RECEIPT ITEMS (active) and RECEIPTS TAXES', () => {
    render(<ReceiptItemsQuickLaunch onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Billing and transactions shortcuts' });

    expect(within(nav).getByRole('button', { name: 'RECEIPTS' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'RECEIPTS TAXES' })).toBeInTheDocument();

    // Active anchor: not a button, aria-current, corporate red + underline.
    expect(within(nav).queryByRole('button', { name: 'RECEIPT ITEMS' })).not.toBeInTheDocument();
    const active = within(nav).getByText('RECEIPT ITEMS');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('underline');
    expect(active.closest('span[aria-current="page"].bg-\\[\\#ae001a\\]')).not.toBeNull();
  });

  it('navigates to the sibling screens through onNavigate (SPA, no reload)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<ReceiptItemsQuickLaunch onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: 'RECEIPTS' }));
    await user.click(screen.getByRole('button', { name: 'RECEIPTS TAXES' }));

    expect(onNavigate.mock.calls).toEqual([['receipt-orders'], ['receipt-taxes']]);
  });

  it('is rendered inside the Receipt Items workspace', async () => {
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        '/receipt-items': { data: [], page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        '/receipt-items/item-options': { data: [] },
        '/receipts': { data: [] },
      }),
    );
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<ReceiptItemsView onNavigate={onNavigate} />);

    await screen.findByTestId('receipt-items-empty');
    await user.click(screen.getByRole('button', { name: 'RECEIPTS TAXES' }));
    expect(onNavigate).toHaveBeenCalledWith('receipt-taxes');
  });
});

describe('Receipt Items — NavHubBar (Historia 15)', () => {
  const hub = navHubForFeature('receipt-items');

  it('belongs to the Billing & Transactions hub and is live', () => {
    expect(hub?.hubId).toBe('billing-transactions-hub');
    expect(hub?.items.find((i) => i.featureId === 'receipt-items')?.live).toBe(true);
  });

  it('lists RECEIPTS, RECEIPT ITEMS, RECEIPTS TAXES in that order', () => {
    // El hub puede tener más pantallas (sync, reportes); las tres hermanas abren la épica en orden.
    expect(hub?.items.map((i) => i.featureId).slice(0, SIBLINGS.length)).toEqual(SIBLINGS);
  });

  it('renders a bar anchored at the bottom with RECEIPT ITEMS active (#ae001a + underline)', () => {
    if (!hub) throw new Error('billing hub missing');
    render(<ModuleNavHubBar hub={hub} currentFeatureId="receipt-items" onNavigate={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: /billing & transactions module navigation/i });
    const bar = nav.firstElementChild as HTMLElement;
    expect(bar).toHaveClass('fixed', 'bottom-0');

    const labels = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent?.replace(/^(receipt_long|list|percent)/, '').trim());
    // First button is the "back to hub" arrow; the rest keep the epic order.
    expect(labels.slice(1, 4)).toEqual(['Receipts', 'Receipt Items', 'Receipts Taxes']);

    const active = within(nav).getByRole('button', { name: 'Receipt Items' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-[#ae001a]');
    const underline = active.querySelector('[data-active-indicator="underline"]');
    expect(underline).not.toBeNull();
    expect(underline).toHaveClass('underline', 'decoration-2');

    for (const name of ['Receipts', 'Receipts Taxes']) {
      const btn = within(nav).getByRole('button', { name });
      expect(btn).not.toHaveAttribute('aria-current');
      expect(btn.querySelector('[data-active-indicator]')).toBeNull();
    }
  });

  it('routes every option and the back button to SPA feature ids of the same hub', async () => {
    if (!hub) throw new Error('billing hub missing');
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<ModuleNavHubBar hub={hub} currentFeatureId="receipt-items" onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: 'Receipts' }));
    await user.click(screen.getByRole('button', { name: 'Receipts Taxes' }));
    await user.click(screen.getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }));

    expect(onNavigate.mock.calls).toEqual([['receipt-orders'], ['receipt-taxes'], ['billing-transactions-hub']]);
    // Each target keeps the bar mounted (same hub) and the hub id resolves to its Command Hub:
    // no unknown tab, so no routing error in the SPA.
    for (const featureId of SIBLINGS) {
      expect(navHubForFeature(featureId)?.hubId).toBe('billing-transactions-hub');
    }
    expect(navHubById('billing-transactions-hub')?.appId).toBe('billing-transactions');
  });

  it('is wired in the view registry with MerchantFrame navigateToFeature', () => {
    const navigateToFeature = vi.fn();
    const ctx = { navigateToFeature, onNavigate: vi.fn() } as unknown as MerchantViewContext;
    const node = renderMerchantView('receipt-items', ctx);
    expect(isValidElement(node)).toBe(true);
    const element = node as ReactElement<{ onNavigate?: (v: string) => void }>;
    expect(element.type).toBe(ReceiptItemsView);
    expect(element.props.onNavigate).toBe(navigateToFeature);
  });
});
