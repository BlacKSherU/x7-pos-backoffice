import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingInventorySyncHeader } from './BillingInventorySyncHeader';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import type { BillingInventorySelection } from '@/modules/core/billing-transactions/lib/billing-inventory-context';

const metrics = (itemsDeducted: number, overrides: Record<string, unknown> = {}) => ({
  statusCode: 200,
  message: 'ok',
  data: {
    dateFrom: '2026-11-16',
    dateTo: '2026-11-22',
    generatedAt: '2026-11-22T14:00:00.000Z',
    salesLocation: { id: 3, name: 'Main Kitchen', code: 'MK' },
    linesEvaluated: 40,
    scanLimitReached: false,
    itemsDeducted,
    unitsDeducted: itemsDeducted * 2,
    statusCounts: { DEDUCTED: itemsDeducted, PENDING: 4, INSUFFICIENT_STOCK: 2, FAILED: 1, NOT_TRACKED: 6 },
    lowStock: {
      total: 3,
      outOfStock: 1,
      low: 2,
      activeAlerts: 2,
      warnings: [
        {
          stockItemId: 46,
          name: 'Cola 355ml',
          sku: 'COLA',
          kind: 'PRODUCT',
          locationId: 3,
          locationName: 'Main Kitchen',
          currentQty: -3,
          minimumQty: 6,
          level: 'OUT_OF_STOCK',
          soldQty: 9,
          lastSaleAt: '2026-11-22T13:00:00.000Z',
          alertId: 31,
        },
        {
          stockItemId: 48,
          name: 'Potato',
          sku: 'RM-POTATO',
          kind: 'RAW_MATERIAL',
          locationId: 3,
          locationName: 'Main Kitchen',
          currentQty: '1',
          minimumQty: '5',
          level: 'LOW',
          soldQty: '6',
          lastSaleAt: '2026-11-22T12:00:00.000Z',
          alertId: null,
        },
      ],
    },
    ...overrides,
  },
});

const validation = {
  statusCode: 200,
  message: 'ok',
  data: {
    source: 'RECEIPT',
    receiptId: 10,
    invoiceNumber: 'INV-000010',
    orderId: 4,
    location: { id: 3, name: 'Main Kitchen', code: 'MK' },
    allAvailable: false,
    summary: {
      lines: 2,
      available: 1,
      lowStockAfterSale: 0,
      insufficientStock: 1,
      notTracked: 0,
      alreadyDeducted: 0,
      locationNotConfigured: 0,
    },
    items: [
      {
        receiptItemId: 31,
        sku: 'BURGER-01',
        itemName: 'Classic burger',
        quantity: '1',
        mappingSource: 'VARIANT',
        productName: 'Classic burger',
        variantName: 'Double',
        status: 'AVAILABLE',
        reason: 'Enough stock at Main Kitchen.',
        components: [
          {
            key: 'supply:7',
            kind: 'RAW_MATERIAL',
            name: 'Beef patty',
            sku: 'RM-BEEF',
            stockItemId: 47,
            requiredQty: 2,
            totalDemand: 2,
            availableQty: 18,
            remainingAfterSale: 16,
            minimumQty: 10,
            shortfall: 0,
            status: 'AVAILABLE',
          },
        ],
      },
      {
        receiptItemId: 32,
        sku: 'FRIES',
        itemName: 'Fries',
        quantity: 3,
        mappingSource: 'PRODUCT',
        productName: 'Fries',
        variantName: null,
        status: 'INSUFFICIENT_STOCK',
        reason: 'Not enough stock at Main Kitchen: Potato needs 3, has 1.',
        components: [
          {
            key: 'supply:11',
            kind: 'RAW_MATERIAL',
            name: 'Potato',
            sku: 'RM-POTATO',
            stockItemId: 48,
            requiredQty: 3,
            totalDemand: 3,
            availableQty: 1,
            remainingAfterSale: -2,
            minimumQty: 5,
            shortfall: 2,
            status: 'INSUFFICIENT_STOCK',
          },
        ],
      },
    ],
    checkedAt: '2026-11-22T14:01:00.000Z',
  },
};

const SELECTION: BillingInventorySelection = {
  receiptItemId: 31,
  receiptId: 10,
  invoiceNumber: 'INV-000010',
  sku: 'BURGER-01',
  orderId: 4,
  stockItemId: 47,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BillingInventorySyncHeader', () => {
  it('displays the INVENTORY & BILLING STOCK SYNC title with its icons', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync/metrics': metrics(5) }));

    const { container } = render(<BillingInventorySyncHeader refreshIntervalMs={0} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^INVENTORY & BILLING STOCK SYNC$/);
    const icons = [...container.querySelectorAll('.material-symbols-outlined')].map((el) => el.textContent?.trim());
    expect(icons).toEqual(expect.arrayContaining(['inventory_2', 'warehouse', 'trending_down']));
    expect(screen.getByRole('button', { name: /VALIDATE STOCK AVAILABILITY/ })).toBeInTheDocument();
    await screen.findByText(/updated/);
  });

  it('shows items deducted, stock movement status and low stock warnings from the API', async () => {
    vi.stubGlobal('fetch', fakeBackend({ '/billing/inventory-sync/metrics': metrics(12) }));

    render(<BillingInventorySyncHeader refreshIntervalMs={0} />);

    expect(await screen.findByTestId('kpi-items-deducted-value')).toHaveTextContent('12');
    expect(screen.getByTestId('kpi-items-deducted')).toHaveTextContent('24 units sold · 40 receipt lines checked');
    expect(screen.getByTestId('kpi-movement-status-value')).toHaveTextContent('3 issues');
    expect(screen.getByTestId('kpi-status-PENDING')).toHaveTextContent('Pending4');
    expect(screen.getByTestId('kpi-status-FAILED')).toHaveTextContent('Commit Failed1');
    expect(screen.getByTestId('kpi-movement-status')).toHaveTextContent('Sales deduct from Main Kitchen');

    const lowStock = screen.getByTestId('kpi-low-stock');
    expect(screen.getByTestId('kpi-low-stock-value')).toHaveTextContent('3');
    expect(lowStock).toHaveTextContent('1 out of stock · 2 low · 2 active alerts');
    expect(within(lowStock).getByText('Cola 355ml')).toBeInTheDocument();
    expect(within(lowStock).getByText('-3 / 6')).toBeInTheDocument();
    expect(within(lowStock).getByText('1 / 5')).toBeInTheDocument();
  });

  it('refreshes the live counters periodically', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        '/billing/inventory-sync/metrics': () => {
          calls += 1;
          return jsonResponse(metrics(calls * 10));
        },
      }),
    );

    render(<BillingInventorySyncHeader refreshIntervalMs={40} />);

    expect(await screen.findByTestId('kpi-items-deducted-value')).toHaveTextContent('10');
    await vi.waitFor(() => expect(Number(screen.getByTestId('kpi-items-deducted-value').textContent)).toBeGreaterThanOrEqual(20));
  });

  it('reloads when the refresh key changes and keeps the last metrics on errors', async () => {
    let fail = false;
    const fetchMock = fakeBackend({
      '/billing/inventory-sync/metrics': () =>
        fail ? jsonResponse({ message: 'Database unavailable' }, 500) : jsonResponse(metrics(7)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(<BillingInventorySyncHeader refreshIntervalMs={0} refreshKey={0} />);
    expect(await screen.findByTestId('kpi-items-deducted-value')).toHaveTextContent('7');

    fail = true;
    rerender(<BillingInventorySyncHeader refreshIntervalMs={0} refreshKey={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Showing the last known metrics. Database unavailable');
    expect(screen.getByTestId('kpi-items-deducted-value')).toHaveTextContent('7');
    expect(calledRoutes(fetchMock)).toEqual(['GET /billing/inventory-sync/metrics', 'GET /billing/inventory-sync/metrics']);
  });

  it('validates the selected receipt and refreshes the metrics afterwards', async () => {
    const bodies: unknown[] = [];
    const fetchMock = fakeBackend({
      '/billing/inventory-sync/metrics': metrics(5),
      'POST /billing/inventory-sync/validate-stock': (init: RequestInit | undefined) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse(validation);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const onValidated = vi.fn();
    const user = userEvent.setup();

    render(<BillingInventorySyncHeader refreshIntervalMs={0} selection={SELECTION} onValidated={onValidated} />);
    await screen.findByText(/updated/);

    await user.click(screen.getByRole('button', { name: /VALIDATE STOCK AVAILABILITY/ }));
    const drawer = screen.getByRole('dialog', { name: 'Validate Stock Availability' });
    expect(within(drawer).getByRole('tab', { name: 'Receipt' })).toHaveAttribute('aria-selected', 'true');
    expect(within(drawer).getByPlaceholderText('INV-000012')).toHaveValue('INV-000010');

    await user.click(within(drawer).getByRole('button', { name: 'Run Validation' }));

    expect(await within(drawer).findByTestId('stock-validation-summary')).toHaveTextContent('Stock check failed');
    expect(bodies).toEqual([{ receiptId: 10 }]);
    expect(within(drawer).getByTestId('stock-validation-line-1')).toHaveTextContent('Potato needs 3, has 1');
    expect(within(within(drawer).getByTestId('stock-validation-line-1')).getByTestId('availability-status-INSUFFICIENT_STOCK')).toBeInTheDocument();
    expect(onValidated).toHaveBeenCalledWith(expect.objectContaining({ allAvailable: false }));
    await vi.waitFor(() =>
      expect(calledRoutes(fetchMock).filter((r) => r === 'GET /billing/inventory-sync/metrics')).toHaveLength(2),
    );
  });

  it('validates an ad-hoc SKU list', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        '/billing/inventory-sync/metrics': metrics(5),
        'POST /billing/inventory-sync/validate-stock': (init: RequestInit | undefined) => {
          bodies.push(JSON.parse(String(init?.body)));
          return jsonResponse({
            ...validation,
            data: { ...validation.data, source: 'ITEMS', receiptId: null, invoiceNumber: null, allAvailable: true },
          });
        },
      }),
    );
    const user = userEvent.setup();

    render(<BillingInventorySyncHeader refreshIntervalMs={0} />);
    await user.click(screen.getByRole('button', { name: /VALIDATE STOCK AVAILABILITY/ }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('tab', { name: 'SKU List' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(drawer).getByRole('button', { name: 'Run Validation' }));
    expect(within(drawer).getByRole('alert')).toHaveTextContent('Add at least one SKU to validate.');

    await user.type(within(drawer).getByLabelText('SKU 1'), 'BURGER-01');
    await user.clear(within(drawer).getByLabelText('Quantity 1'));
    await user.type(within(drawer).getByLabelText('Quantity 1'), '4');
    await user.click(within(drawer).getByRole('button', { name: 'Add SKU' }));
    await user.type(within(drawer).getByLabelText('SKU 2'), 'FRIES');
    await user.click(within(drawer).getByRole('button', { name: 'Run Validation' }));

    expect(await within(drawer).findByTestId('stock-validation-summary')).toHaveTextContent('Stock available for every line');
    expect(bodies).toEqual([
      {
        items: [
          { sku: 'BURGER-01', quantity: 4 },
          { sku: 'FRIES', quantity: 1 },
        ],
      },
    ]);

    await user.click(within(drawer).getByRole('button', { name: 'Close drawer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
