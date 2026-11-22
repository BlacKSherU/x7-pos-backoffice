import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReceiptTaxesQuickLinks } from './ReceiptTaxesQuickLinks';
import { ModuleNavHubBar } from '@/platform/merchant-frame/layout/ModuleNavHubBar';
import { getNavFromPath } from '@/platform/merchant-frame/merchant-routes';
import { navHubForFeature } from '@/platform/navigation/module-nav-hubs';

afterEach(() => cleanup());

describe('ReceiptTaxesQuickLinks', () => {
  it('lists RECEIPTS, RECEIPT ITEMS and RECEIPTS TAXES with the current screen active', () => {
    render(<ReceiptTaxesQuickLinks onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Billing and transactions shortcuts' });

    expect(within(nav).getByRole('button', { name: 'RECEIPTS' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'RECEIPT ITEMS' })).toBeInTheDocument();
    // The current screen is not a link: it is announced as the current page.
    expect(within(nav).queryByRole('button', { name: 'RECEIPTS TAXES' })).toBeNull();
    const active = within(nav).getByText('RECEIPTS TAXES');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.closest('span[aria-current="page"]')?.parentElement).toHaveClass('bg-[#ae001a]');
  });

  it('navigates to the sibling screens and back to the epic hub without reloading', () => {
    const onNavigate = vi.fn();
    render(<ReceiptTaxesQuickLinks onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'RECEIPTS' }));
    fireEvent.click(screen.getByRole('button', { name: 'RECEIPT ITEMS' }));
    fireEvent.click(screen.getByRole('button', { name: 'BILLING HUB' }));

    expect(onNavigate.mock.calls.map(([id]) => id)).toEqual([
      'receipt-orders',
      'receipt-items',
      'billing-transactions-hub',
    ]);
  });
});

describe('Billing & Transactions NavHubBar on Receipt Taxes', () => {
  const hub = navHubForFeature('receipt-taxes')!;

  it('belongs to the Billing & Transactions hub and is live', () => {
    expect(hub.hubId).toBe('billing-transactions-hub');
    expect(hub.items.map((item) => item.featureId)).toEqual(
      expect.arrayContaining(['receipt-orders', 'receipt-items', 'receipt-taxes']),
    );
    expect(hub.items.find((item) => item.featureId === 'receipt-taxes')?.live).toBe(true);
  });

  it('is fixed at the bottom with RECEIPTS TAXES active in #ae001a', () => {
    render(<ModuleNavHubBar hub={hub} currentFeatureId="receipt-taxes" onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: /billing & transactions module navigation/i });
    expect(nav.querySelector('.fixed.bottom-0')).not.toBeNull();

    const active = within(nav).getByRole('button', { name: 'Receipts Taxes' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-[#ae001a]');
    expect(within(nav).getByRole('button', { name: 'Receipts' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('button', { name: 'Receipt Items' })).not.toHaveAttribute('aria-current');
  });

  it('switches tabs to the siblings and returns to the epic Command Hub', () => {
    const onNavigate = vi.fn();
    render(<ModuleNavHubBar hub={hub} currentFeatureId="receipt-taxes" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Receipts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receipt Items' }));
    fireEvent.click(screen.getByRole('button', { name: 'BILLING & TRANSACTIONS COMMAND HUB' }));

    expect(onNavigate.mock.calls.map(([id]) => id)).toEqual([
      'receipt-orders',
      'receipt-items',
      'billing-transactions-hub',
    ]);
  });

  it('opens the Receipt Taxes tab from its deep link', () => {
    expect(getNavFromPath('/app/billing-transactions/receipt-taxes')).toEqual({
      category: 'core',
      tab: 'receipt-taxes',
    });
    expect(getNavFromPath('/app/billing-transactions')?.tab).toBe('billing-transactions-hub');
  });
});
