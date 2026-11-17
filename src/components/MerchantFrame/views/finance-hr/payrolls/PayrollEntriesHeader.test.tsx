import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayrollEntriesHeader } from './PayrollEntriesHeader';
import {
  calculatePayrollMetrics,
  filterPayrollEntries,
  formatCurrency,
  parseMonetaryValue,
} from './payroll-entries-helpers';
import type { PayrollEntry } from './types';

afterEach(() => {
  cleanup();
});

const MOCK_PAYROLL_ENTRIES: PayrollEntry[] = [
  {
    id: 'PE-1001',
    entry_id: 'PE-1001',
    collaborator_name: 'Alejandro Gomez',
    base_pay: 1200.0,
    overtime_pay: 150.0,
    double_overtime_pay: 50.0,
    net_total: 1400.0,
  },
  {
    id: 1002,
    collaborator_name: 'Maria Fernandez',
    base_pay: '2000.50',
    overtime_pay: '300.00',
    double_overtime_pay: 0,
    net_total: '2300.50',
  },
  {
    id: 'PE-1003',
    collaborator: {
      id: 55,
      name: 'Carlos Santana',
    },
    base_pay: 800.0,
    overtime_pay: 0,
    double_overtime_pay: 100.0,
    net_total: 900.0,
  },
  {
    id: 1004,
    collaborator: {
      first_name: 'Lucia',
      last_name: 'Mendez',
    },
    base_pay: 1500.0,
    overtime_pay: 200.0,
    // double_overtime_pay omitted to test default handling
    net_total: 1700.0,
  },
];

describe('PayrollEntriesHeader Component', () => {
  describe('Acceptance Criteria 1: Title & Breadcrumbs Rendering', () => {
    it('renders cleanly with title PAYROLL ENTRIES COMMAND CONTROL', () => {
      render(<PayrollEntriesHeader entries={MOCK_PAYROLL_ENTRIES} />);

      const titleHeading = screen.getByRole('heading', {
        name: /PAYROLL ENTRIES COMMAND CONTROL/i,
      });
      expect(titleHeading).toBeInTheDocument();
      expect(screen.getByTestId('payroll-entries-header')).toBeInTheDocument();
    });

    it('displays the required breadcrumbs: Finance & HR / Payroll / Payroll Entries', () => {
      const handleNavigate = vi.fn();
      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onNavigate={handleNavigate}
        />,
      );

      const nav = screen.getByRole('navigation', { name: /Breadcrumb/i });
      expect(nav).toBeInTheDocument();

      const financeBtn = within(nav).getByRole('button', { name: /Finance & HR/i });
      const payrollBtn = within(nav).getByRole('button', { name: /Payroll/i });
      const currentSpan = within(nav).getByText(/Payroll Entries/i);

      expect(financeBtn).toBeInTheDocument();
      expect(payrollBtn).toBeInTheDocument();
      expect(currentSpan).toBeInTheDocument();

      fireEvent.click(financeBtn);
      expect(handleNavigate).toHaveBeenCalledWith('finance-hr');

      fireEvent.click(payrollBtn);
      expect(handleNavigate).toHaveBeenCalledWith('payrolls');
    });

    it('renders the + MANUAL PAYROLL ENTRY action button and invokes callback', async () => {
      const user = userEvent.setup();
      const handleManualClick = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onManualEntryClick={handleManualClick}
        />,
      );

      const actionBtn = screen.getByTestId('manual-payroll-entry-btn');
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent(/MANUAL PAYROLL ENTRY/i);

      // Verify material symbol 'add' is present in the action button
      const addIcon = within(actionBtn).getByText('add');
      expect(addIcon).toBeInTheDocument();
      expect(addIcon).toHaveClass('material-symbols-outlined');

      await user.click(actionBtn);
      expect(handleManualClick).toHaveBeenCalledTimes(1);
    });

    it('supports onOpenCreateModal alias for the manual entry button', async () => {
      const user = userEvent.setup();
      const handleModalClick = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onOpenCreateModal={handleModalClick}
        />,
      );

      const actionBtn = screen.getByTestId('manual-payroll-entry-btn');
      await user.click(actionBtn);
      expect(handleModalClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Acceptance Criteria 2: Dynamic Monetary Metric Cards Calculation & Formatting', () => {
    it('computes and formats dynamic top-level summary metrics correctly', () => {
      // Expected calculations from MOCK_PAYROLL_ENTRIES:
      // Base Pay: 1200 + 2000.50 + 800 + 1500 = 5500.50
      // Overtime: (150 + 50) + (300 + 0) + (0 + 100) + (200 + 0) = 800.00
      // Net Total: 1400 + 2300.50 + 900 + 1700 = 6300.50
      render(<PayrollEntriesHeader entries={MOCK_PAYROLL_ENTRIES} />);

      const basePayCard = screen.getByTestId('kpi-base-pay');
      const overtimeCard = screen.getByTestId('kpi-overtime-pay');
      const netTotalCard = screen.getByTestId('kpi-net-total');

      expect(basePayCard).toBeInTheDocument();
      expect(overtimeCard).toBeInTheDocument();
      expect(netTotalCard).toBeInTheDocument();

      // Check formatted monetary values
      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('$5,500.50');
      expect(screen.getByTestId('metric-value-overtime')).toHaveTextContent('$800.00');
      expect(screen.getByTestId('metric-value-net-total')).toHaveTextContent('$6,300.50');

      // Check Material Symbols: payments, account_balance_wallet
      expect(within(basePayCard).getByText('payments')).toBeInTheDocument();
      expect(within(overtimeCard).getByText('payments')).toBeInTheDocument();
      expect(within(netTotalCard).getByText('account_balance_wallet')).toBeInTheDocument();
    });

    it('dynamically updates metrics when entries prop changes', () => {
      const { rerender } = render(<PayrollEntriesHeader entries={MOCK_PAYROLL_ENTRIES} />);

      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('$5,500.50');
      expect(screen.getByTestId('metric-value-overtime')).toHaveTextContent('$800.00');
      expect(screen.getByTestId('metric-value-net-total')).toHaveTextContent('$6,300.50');

      // Update with an additional entry or different dataset
      const updatedEntries: PayrollEntry[] = [
        ...MOCK_PAYROLL_ENTRIES,
        {
          id: 'PE-1005',
          collaborator_name: 'Sofia Vega',
          base_pay: 1000.0,
          overtime_pay: 200.0,
          double_overtime_pay: 100.0,
          net_total: 1300.0,
        },
      ];

      rerender(<PayrollEntriesHeader entries={updatedEntries} />);

      // New expected:
      // Base Pay: 5500.50 + 1000 = 6500.50
      // Overtime: 800 + (200 + 100) = 1100.00
      // Net Total: 6300.50 + 1300 = 7600.50
      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('$6,500.50');
      expect(screen.getByTestId('metric-value-overtime')).toHaveTextContent('$1,100.00');
      expect(screen.getByTestId('metric-value-net-total')).toHaveTextContent('$7,600.50');
    });

    it('renders zeroed values formatted cleanly when dataset is empty', () => {
      render(<PayrollEntriesHeader entries={[]} />);

      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('$0.00');
      expect(screen.getByTestId('metric-value-overtime')).toHaveTextContent('$0.00');
      expect(screen.getByTestId('metric-value-net-total')).toHaveTextContent('$0.00');
    });

    it('accepts dataset alias prop interchangeably with entries', () => {
      render(<PayrollEntriesHeader dataset={MOCK_PAYROLL_ENTRIES} />);

      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('$5,500.50');
    });

    it('displays loading state on metric cards when isLoading is true', () => {
      render(<PayrollEntriesHeader entries={MOCK_PAYROLL_ENTRIES} isLoading={true} />);

      expect(screen.getByTestId('metric-value-base-pay')).toHaveTextContent('Loading…');
      expect(screen.getByTestId('metric-value-overtime')).toHaveTextContent('Loading…');
      expect(screen.getByTestId('metric-value-net-total')).toHaveTextContent('Loading…');
    });
  });

  describe('Acceptance Criteria 3: Live Filtering by Collaborator Name and Entry ID', () => {
    it('triggers live filtering by collaborator name and fires onFilteredEntriesChange', async () => {
      const user = userEvent.setup();
      const handleFilteredEntries = vi.fn();
      const handleSearchChange = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onFilteredEntriesChange={handleFilteredEntries}
          onSearchChange={handleSearchChange}
        />,
      );

      const searchInput = screen.getByTestId('payroll-search-input');
      expect(searchInput).toBeInTheDocument();

      // Initial call with all entries
      expect(handleFilteredEntries).toHaveBeenLastCalledWith(MOCK_PAYROLL_ENTRIES);

      // Type collaborator name "Alejandro"
      await user.type(searchInput, 'Alejandro');

      expect(handleSearchChange).toHaveBeenCalled();
      const lastCallFiltered =
        handleFilteredEntries.mock.calls[handleFilteredEntries.mock.calls.length - 1][0];
      expect(lastCallFiltered).toHaveLength(1);
      expect(lastCallFiltered[0].collaborator_name).toBe('Alejandro Gomez');

      // Check counter status text
      expect(screen.getByTestId('filter-results-counter')).toHaveTextContent('1 of 4 entries');
    });

    it('triggers live filtering by entry ID', async () => {
      const user = userEvent.setup();
      const handleFilteredEntries = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onFilteredEntriesChange={handleFilteredEntries}
        />,
      );

      const searchInput = screen.getByTestId('payroll-search-input');

      // Search by entry ID 1002
      await user.type(searchInput, '1002');

      const lastCall =
        handleFilteredEntries.mock.calls[handleFilteredEntries.mock.calls.length - 1][0];
      expect(lastCall).toHaveLength(1);
      expect(lastCall[0].id).toBe(1002);
    });

    it('filters across nested collaborator.name and first_name/last_name schemas', async () => {
      const user = userEvent.setup();
      const handleFilteredEntries = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onFilteredEntriesChange={handleFilteredEntries}
        />,
      );

      const searchInput = screen.getByTestId('payroll-search-input');

      // Search Carlos (collaborator.name)
      await user.type(searchInput, 'Santana');
      let filtered =
        handleFilteredEntries.mock.calls[handleFilteredEntries.mock.calls.length - 1][0];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].collaborator?.name).toBe('Carlos Santana');

      // Clear search
      await user.clear(searchInput);

      // Search Lucia (collaborator.first_name)
      await user.type(searchInput, 'Lucia');
      filtered =
        handleFilteredEntries.mock.calls[handleFilteredEntries.mock.calls.length - 1][0];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].collaborator?.first_name).toBe('Lucia');
    });

    it('clears the search query when clicking the clear search button', async () => {
      const user = userEvent.setup();
      const handleFilteredEntries = vi.fn();

      render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          onFilteredEntriesChange={handleFilteredEntries}
        />,
      );

      const searchInput = screen.getByTestId('payroll-search-input');
      await user.type(searchInput, 'Maria');

      const clearBtn = screen.getByTestId('clear-search-btn');
      expect(clearBtn).toBeInTheDocument();

      await user.click(clearBtn);

      expect(searchInput).toHaveValue('');
      const lastFiltered =
        handleFilteredEntries.mock.calls[handleFilteredEntries.mock.calls.length - 1][0];
      expect(lastFiltered).toHaveLength(MOCK_PAYROLL_ENTRIES.length);
    });

    it('supports controlled searchQuery prop', () => {
      const handleSearchChange = vi.fn();
      const { rerender } = render(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          searchQuery="PE-1001"
          onSearchChange={handleSearchChange}
        />,
      );

      const searchInput = screen.getByTestId('payroll-search-input');
      expect(searchInput).toHaveValue('PE-1001');

      rerender(
        <PayrollEntriesHeader
          entries={MOCK_PAYROLL_ENTRIES}
          searchQuery="Carlos"
          onSearchChange={handleSearchChange}
        />,
      );
      expect(searchInput).toHaveValue('Carlos');
    });
  });

  describe('Styling & Technical Details', () => {
    it('applies Poppins font family and corporate red hover classes', () => {
      const { container } = render(<PayrollEntriesHeader entries={MOCK_PAYROLL_ENTRIES} />);

      // Root header container contains Poppins font specification
      const headerElem = container.querySelector('[data-testid="payroll-entries-header"]');
      expect(headerElem?.className).toContain("font-['Poppins',sans-serif]");

      // Check corporate red hover accents (#ae001a)
      const manualBtn = screen.getByTestId('manual-payroll-entry-btn');
      expect(manualBtn.className).toContain('bg-[#ae001a]');

      // Check metric cards have hover borders with corporate red
      const basePayCard = screen.getByTestId('kpi-base-pay');
      expect(basePayCard.className).toContain('hover:border-[#ae001a]');
    });
  });

  describe('Pure Helper Functions', () => {
    it('parseMonetaryValue parses numbers, strings, and dirty currency strings', () => {
      expect(parseMonetaryValue(123.45)).toBe(123.45);
      expect(parseMonetaryValue('123.45')).toBe(123.45);
      expect(parseMonetaryValue('$1,234.56')).toBe(1234.56);
      expect(parseMonetaryValue(null)).toBe(0);
      expect(parseMonetaryValue(undefined)).toBe(0);
      expect(parseMonetaryValue('invalid')).toBe(0);
    });

    it('calculatePayrollMetrics calculates exact sums for base, overtime, and net pay', () => {
      const metrics = calculatePayrollMetrics(MOCK_PAYROLL_ENTRIES);
      expect(metrics.totalBasePay).toBeCloseTo(5500.5, 2);
      expect(metrics.totalOvertimePay).toBeCloseTo(800.0, 2);
      expect(metrics.totalNetPay).toBeCloseTo(6300.5, 2);
      expect(metrics.entryCount).toBe(4);
    });

    it('formatCurrency formats amounts into localized USD currency', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('filterPayrollEntries filters entries case-insensitively by name and id', () => {
      const filteredByName = filterPayrollEntries(MOCK_PAYROLL_ENTRIES, 'fernandez');
      expect(filteredByName).toHaveLength(1);
      expect(filteredByName[0].id).toBe(1002);

      const filteredById = filterPayrollEntries(MOCK_PAYROLL_ENTRIES, 'PE-1003');
      expect(filteredById).toHaveLength(1);
      expect(filteredById[0].id).toBe('PE-1003');

      const all = filterPayrollEntries(MOCK_PAYROLL_ENTRIES, '');
      expect(all).toHaveLength(4);
    });
  });
});
