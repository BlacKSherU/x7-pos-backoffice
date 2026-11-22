import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BillingReportsView } from './BillingReportsView';
import * as api from '../../api/billing-reports-api';
import * as lib from '../../lib/billing-reports';
import type {
  DiscountAuditReport,
  DiscountAuditRow,
  TaxLiabilityReport,
} from '../../types/billing-reports';

vi.mock('../../api/billing-reports-api', () => ({
  fetchTaxLiabilityReport: vi.fn(),
  fetchDiscountAuditReport: vi.fn(),
  fetchAllDiscountAuditRows: vi.fn(),
  fetchBillingReportCsv: vi.fn(),
}));

vi.mock('../../lib/billing-reports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/billing-reports')>()),
  downloadTextFile: vi.fn(),
}));

const TAX_REPORT: TaxLiabilityReport = {
  filters: { from: null, to: null, rate: null, scope: null, name: null, currency: null },
  generated_at: '2026-02-01T10:00:00.000Z',
  currencies: ['USD'],
  groups: [
    {
      name: 'VAT 19%',
      scope: 'RECEIPT',
      rate: 19,
      currency: 'USD',
      taxable_subtotal: 150.1,
      tax_collected: 28.52,
      tax_lines: 2,
      receipts: 2,
      lines_without_base: 0,
    },
    {
      name: 'Liquor Tax',
      scope: 'ITEM',
      rate: 5,
      currency: 'USD',
      taxable_subtotal: 50.1,
      tax_collected: 2.52,
      tax_lines: 3,
      receipts: 2,
      lines_without_base: 0,
    },
  ],
  totals: { taxable_subtotal: 200.2, tax_collected: 31.04, tax_lines: 5, receipts: 2, groups: 2 },
  totals_by_currency: [
    {
      currency: 'USD',
      taxable_subtotal: 200.2,
      tax_collected: 31.04,
      tax_lines: 5,
      receipts: 2,
      groups: 2,
      by_scope: [
        { scope: 'RECEIPT', taxable_subtotal: 150.1, tax_collected: 28.52, tax_lines: 2 },
        { scope: 'ITEM', taxable_subtotal: 50.1, tax_collected: 2.52, tax_lines: 3 },
      ],
    },
  ],
};

const DISCOUNTED: DiscountAuditRow = {
  receipt_id: 10,
  invoice_number: 'INV-000010',
  receipt_type: 'INVOICE',
  order_id: 200,
  currency: 'USD',
  created_at: '2026-01-15T08:00:00.000Z',
  updated_at: '2026-01-15T09:00:00.000Z',
  is_active: true,
  is_locked: true,
  events: ['DISCOUNT'],
  processed_by_user_id: 7,
  processed_by_role: 'merchant_user',
  processed_by_name: 'cashier_ana',
  original_subtotal: 25,
  discount_applied: 2.5,
  discount_pct: 10,
  total_tax: 4.75,
  final_total: 27.25,
  snapshot: {
    order_id: 200,
    order_number: 'ORD-200',
    item_count: 2,
    items_summary: '2 x Burger Combo; 1 x Soda',
    payment_methods: 'cash, card',
    subtotal: 25,
    discount_total: 2.5,
    total: 27.25,
  },
  order_snapshot: {
    orderNumber: 'ORD-200',
    items: [
      { productName: 'Burger Combo', quantity: 2, notes: 'No onions' },
      { productName: 'Soda', quantity: 1 },
    ],
  },
};

const VOIDED: DiscountAuditRow = {
  ...DISCOUNTED,
  receipt_id: 11,
  invoice_number: 'INV-000011',
  is_active: false,
  is_locked: false,
  events: ['VOID'],
  processed_by_user_id: null,
  processed_by_role: null,
  processed_by_name: null,
  original_subtotal: 10,
  discount_applied: 0,
  discount_pct: 0,
  total_tax: 1.9,
  final_total: 11.9,
  snapshot: null,
  order_snapshot: null,
};

function auditReport(overrides: Partial<DiscountAuditReport> = {}): DiscountAuditReport {
  return {
    data: [DISCOUNTED, VOIDED],
    summary: {
      receipts: 2,
      discounted_receipts: 1,
      voided_receipts: 1,
      by_currency: [
        {
          currency: 'USD',
          receipts: 2,
          original_subtotal: 35,
          discount_applied: 2.5,
          total_tax: 6.65,
          final_total: 39.15,
        },
      ],
    },
    filters: { from: null, to: null, event_type: 'all', user_id: null, receipt_type: null, currency: null },
    generated_at: '2026-02-01T10:00:00.000Z',
    page: 1,
    limit: 50,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
    ...overrides,
  };
}

const thisMonth = lib.periodRange('this-month');

describe('BillingReportsView', () => {
  beforeEach(() => {
    vi.mocked(api.fetchTaxLiabilityReport).mockResolvedValue(TAX_REPORT);
    vi.mocked(api.fetchDiscountAuditReport).mockResolvedValue(auditReport());
    vi.mocked(api.fetchAllDiscountAuditRows).mockResolvedValue({
      rows: [DISCOUNTED, VOIDED],
      summary: auditReport().summary,
      total: 2,
      truncated: false,
    });
    vi.mocked(api.fetchBillingReportCsv).mockResolvedValue('Currency,Tax Name\r\nUSD,VAT\r\n');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the Billing Reports header with Tax Liability and Discount & Void Audit tabs', async () => {
    const onNavigate = vi.fn();
    render(<BillingReportsView onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { name: /billing reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tax liability/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /discount & void audit/i })).toHaveAttribute('aria-selected', 'false');
    await screen.findByText('VAT 19%');

    fireEvent.click(screen.getByRole('button', { name: /receipt taxes/i }));
    expect(onNavigate).toHaveBeenCalledWith('receipt-taxes');
  });

  describe('Tax Liability', () => {
    it('loads the current month by default and groups taxes by rate and scope with matching totals', async () => {
      render(<BillingReportsView />);

      await screen.findByText('VAT 19%');
      expect(api.fetchTaxLiabilityReport).toHaveBeenCalledWith(
        expect.objectContaining({ from: thisMonth.from, to: thisMonth.to }),
      );

      const table = screen.getByRole('table', { name: /tax liability by rate and scope/i });
      const vatRow = within(table).getByText('VAT 19%').closest('tr') as HTMLElement;
      expect(within(vatRow).getByText('Receipt')).toBeInTheDocument();
      expect(within(vatRow).getByText('19.00%')).toBeInTheDocument();
      expect(within(vatRow).getByText('150.10 USD')).toBeInTheDocument();
      expect(within(vatRow).getByText('28.52 USD')).toBeInTheDocument();

      const liquorRow = within(table).getByText('Liquor Tax').closest('tr') as HTMLElement;
      expect(within(liquorRow).getByText('Line item')).toBeInTheDocument();
      expect(within(liquorRow).getByText('5.00%')).toBeInTheDocument();

      const receiptSubtotal = screen.getByTestId('subtotal-USD-RECEIPT');
      expect(within(receiptSubtotal).getByText('28.52 USD')).toBeInTheDocument();
      const itemSubtotal = screen.getByTestId('subtotal-USD-ITEM');
      expect(within(itemSubtotal).getByText('2.52 USD')).toBeInTheDocument();

      // Total = sum of the groups (28.52 + 2.52 = 31.04; 150.10 + 50.10 = 200.20).
      const total = screen.getByTestId('total-USD');
      expect(within(total).getByText('200.20 USD')).toBeInTheDocument();
      expect(within(total).getByText('31.04 USD')).toBeInTheDocument();
      expect(within(total).getByText('5')).toBeInTheDocument();
    });

    it('applies the date range, rate, scope and tax name filters', async () => {
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } });
      fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '19' } });
      fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'ITEM' } });
      fireEvent.change(screen.getByLabelText('Tax name / type'), { target: { value: ' VAT ' } });
      fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'usd' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      await waitFor(() =>
        expect(api.fetchTaxLiabilityReport).toHaveBeenLastCalledWith({
          from: '2026-01-01',
          to: '2026-01-31',
          rate: 19,
          scope: 'ITEM',
          name: 'VAT',
          currency: 'USD',
        }),
      );
    });

    it('fills the dates from a period preset', async () => {
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');

      fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'year-to-date' } });
      expect(screen.getByLabelText('From')).toHaveValue(lib.periodRange('year-to-date').from);
    });

    it('exports CSV and Excel files with the applied filters', async () => {
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');

      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
      await waitFor(() => expect(lib.downloadTextFile).toHaveBeenCalledTimes(1));
      expect(api.fetchBillingReportCsv).toHaveBeenCalledWith(
        'tax-liability',
        expect.objectContaining({ from: thisMonth.from, to: thisMonth.to }),
      );
      const [csvContent, csvName, csvMime] = vi.mocked(lib.downloadTextFile).mock.calls[0];
      expect(csvContent).toBe('\uFEFFCurrency,Tax Name\r\nUSD,VAT\r\n');
      expect(csvName).toBe(`tax-liability_${thisMonth.from}_${thisMonth.to}.csv`);
      expect(csvMime).toBe(lib.CSV_MIME);
      expect(await screen.findByText(`Downloaded ${csvName}`)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /export excel/i }));
      await waitFor(() => expect(lib.downloadTextFile).toHaveBeenCalledTimes(2));
      const [xlsContent, xlsName, xlsMime] = vi.mocked(lib.downloadTextFile).mock.calls[1];
      expect(xlsContent).toContain('<x:Name>Tax Liability</x:Name>');
      expect(xlsName).toBe(`tax-liability_${thisMonth.from}_${thisMonth.to}.xls`);
      expect(xlsMime).toBe(lib.XLS_MIME);
    });

    it('shows the export error coming from the API', async () => {
      vi.mocked(api.fetchBillingReportCsv).mockRejectedValue(new Error('`from` must be on or before `to`'));
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');

      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('`from` must be on or before `to`');
    });

    it('opens a printable layout and prints it', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');

      fireEvent.click(screen.getByRole('button', { name: /print \/ pdf/i }));

      const dialog = screen.getByRole('dialog', { name: /tax liability report print preview/i });
      expect(within(dialog).getByRole('heading', { name: /tax liability report/i })).toBeInTheDocument();
      expect(within(dialog).getByText(`${thisMonth.from} → ${thisMonth.to}`)).toBeInTheDocument();
      expect(within(dialog).getByText('31.04 USD')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: /print \/ save as pdf/i }));
      expect(print).toHaveBeenCalledTimes(1);

      fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      print.mockRestore();
    });

    it('keeps totals per currency when receipts use several currencies', async () => {
      vi.mocked(api.fetchTaxLiabilityReport).mockResolvedValue({
        ...TAX_REPORT,
        currencies: ['EUR', 'USD'],
        groups: [{ ...TAX_REPORT.groups[0], currency: 'EUR' }, TAX_REPORT.groups[0]],
        totals_by_currency: [
          { ...TAX_REPORT.totals_by_currency[0], currency: 'EUR' },
          TAX_REPORT.totals_by_currency[0],
        ],
      });
      render(<BillingReportsView />);

      expect(await screen.findByText(/receipts in eur, usd/i)).toBeInTheDocument();
      expect(screen.getByTestId('total-EUR')).toBeInTheDocument();
      expect(screen.getByTestId('total-USD')).toBeInTheDocument();
    });

    it('shows an empty state when nothing was taxed', async () => {
      vi.mocked(api.fetchTaxLiabilityReport).mockResolvedValue({
        ...TAX_REPORT,
        currencies: [],
        groups: [],
        totals_by_currency: [],
        totals: { taxable_subtotal: 0, tax_collected: 0, tax_lines: 0, receipts: 0, groups: 0 },
      });
      render(<BillingReportsView />);

      expect(await screen.findByText(/no taxes collected for these filters/i)).toBeInTheDocument();
    });
  });

  describe('Discount & Void Audit', () => {
    async function openAudit() {
      render(<BillingReportsView />);
      await screen.findByText('VAT 19%');
      fireEvent.click(screen.getByRole('tab', { name: /discount & void audit/i }));
      return screen.findByTestId('audit-row-10');
    }

    it('lists the user, original subtotal, discount applied and final total of each receipt', async () => {
      const row = await openAudit();

      expect(api.fetchDiscountAuditReport).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'all', from: thisMonth.from, to: thisMonth.to, page: 1, limit: 50 }),
      );
      expect(within(row).getByText('INV-000010')).toBeInTheDocument();
      expect(within(row).getByText('cashier_ana (User #7)')).toBeInTheDocument();
      expect(within(row).getByText('merchant_user')).toBeInTheDocument();
      expect(within(row).getByText('Order ORD-200')).toBeInTheDocument();
      expect(within(row).getByText('2 x Burger Combo; 1 x Soda')).toBeInTheDocument();
      expect(within(row).getByText('25.00 USD')).toBeInTheDocument();
      expect(within(row).getByText('2.50 USD')).toBeInTheDocument();
      expect(within(row).getByText('10.00%')).toBeInTheDocument();
      expect(within(row).getByText('27.25 USD')).toBeInTheDocument();
      expect(within(row).getByText('Discount')).toBeInTheDocument();

      const voided = screen.getByTestId('audit-row-11');
      expect(within(voided).getByText('Void')).toBeInTheDocument();
      expect(within(voided).getByText('Voided')).toBeInTheDocument();
      expect(within(voided).getByText('Not recorded')).toBeInTheDocument();

      const total = screen.getByTestId('audit-total-USD');
      expect(within(total).getByText('35.00 USD')).toBeInTheDocument();
      expect(within(total).getByText('39.15 USD')).toBeInTheDocument();
    });

    it('filters by event type and by the date range, user and receipt type', async () => {
      await openAudit();

      fireEvent.click(screen.getByRole('radio', { name: /voids/i }));
      await waitFor(() =>
        expect(api.fetchDiscountAuditReport).toHaveBeenLastCalledWith(
          expect.objectContaining({ eventType: 'void', page: 1 }),
        ),
      );

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } });
      fireEvent.change(screen.getByLabelText('User ID'), { target: { value: '7' } });
      fireEvent.change(screen.getByLabelText('Receipt type'), { target: { value: 'INVOICE' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      await waitFor(() =>
        expect(api.fetchDiscountAuditReport).toHaveBeenLastCalledWith({
          from: '2026-01-01',
          to: '2026-01-31',
          eventType: 'void',
          userId: 7,
          receiptType: 'INVOICE',
          currency: undefined,
          page: 1,
          limit: 50,
        }),
      );
    });

    it('pages through the audit trail', async () => {
      vi.mocked(api.fetchDiscountAuditReport).mockResolvedValue(
        auditReport({ total: 120, totalPages: 3, hasNext: true }),
      );
      await openAudit();

      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
      await waitFor(() =>
        expect(api.fetchDiscountAuditReport).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 50 })),
      );
    });

    it('expands a row to show the order snapshot details', async () => {
      await openAudit();

      fireEvent.click(screen.getByRole('button', { name: /show order snapshot of INV-000010/i }));

      const details = screen.getByTestId('audit-details-10');
      expect(within(details).getByText(/2 x Burger Combo/)).toBeInTheDocument();
      expect(within(details).getByText(/No onions/)).toBeInTheDocument();
      expect(within(details).getByText('cash, card')).toBeInTheDocument();
    });

    it('exports the audit as CSV with the applied filters', async () => {
      await openAudit();

      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

      await waitFor(() => expect(lib.downloadTextFile).toHaveBeenCalled());
      expect(api.fetchBillingReportCsv).toHaveBeenCalledWith(
        'discount-audit',
        expect.objectContaining({ eventType: 'all', from: thisMonth.from }),
      );
      expect(vi.mocked(lib.downloadTextFile).mock.calls[0][1]).toBe(
        `discount-audit_${thisMonth.from}_${thisMonth.to}.csv`,
      );
    });

    it('prints every matching row, not just the current page', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      await openAudit();

      fireEvent.click(screen.getByRole('button', { name: /print \/ pdf/i }));

      const dialog = await screen.findByRole('dialog', { name: /discount & void audit trail print preview/i });
      expect(api.fetchAllDiscountAuditRows).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'all' }));
      expect(await within(dialog).findByText('cashier_ana (User #7)')).toBeInTheDocument();
      expect(within(dialog).getByText('INV-000011')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: /print \/ save as pdf/i }));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });
});
