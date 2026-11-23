import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PayrollAdjustmentsHeader } from './PayrollAdjustmentsHeader';
import type { PayrollAdjustment } from './types';

const SAMPLE_ADJUSTMENTS: PayrollAdjustment[] = [
  {
    id: 'ADJ-001',
    collaborator_name: 'Carlos Mendoza',
    adjustment_type: 'BONUS',
    amount: 500,
    reason: 'Monthly performance bonus',
  },
  {
    id: 'ADJ-002',
    collaborator_name: 'Elena Rostova',
    adjustment_type: 'BONUS',
    amount: '250.50',
    reason: 'Weekend overtime incentive',
  },
  {
    id: 'ADJ-003',
    collaborator_name: 'Mateo Morales',
    adjustment_type: 'DEDUCTION',
    amount: 150,
    reason: 'Uniform deposit',
  },
  {
    id: 'ADJ-004',
    collaborator_name: 'Sofia Valenzuela',
    adjustment_type: 'DEDUCTION',
    amount: '75.25',
    reason: 'Health insurance contribution',
  },
];

describe('PayrollAdjustmentsHeader', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the header with title PAYROLL ADJUSTMENTS CONTROL (Acceptance Criteria 1)', () => {
    render(<PayrollAdjustmentsHeader />);

    const header = screen.getByTestId('payroll-adjustments-header');
    expect(header).toBeInTheDocument();

    const titleElement = screen.getByRole('heading', { level: 1 });
    expect(titleElement).toHaveTextContent('PAYROLL ADJUSTMENTS CONTROL');
  });

  it('renders breadcrumb navigation properly', () => {
    const handleNavigate = vi.fn();
    render(<PayrollAdjustmentsHeader onNavigate={handleNavigate} />);

    expect(screen.getByText('Finance & HR')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Payroll Adjustments')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Finance & HR'));
    expect(handleNavigate).toHaveBeenCalledWith('finance-hr');

    fireEvent.click(screen.getByText('Payroll'));
    expect(handleNavigate).toHaveBeenCalledWith('payrolls');
  });

  it('renders the + NEW ADJUSTMENT button and fires click handlers', () => {
    const handleNew = vi.fn();
    render(<PayrollAdjustmentsHeader onNewAdjustmentClick={handleNew} />);

    const button = screen.getByTestId('new-adjustment-btn');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('+ NEW ADJUSTMENT');
    expect(button.textContent).toContain('add_circle');

    fireEvent.click(button);
    expect(handleNew).toHaveBeenCalledTimes(1);
  });

  it('renders required Material Symbols: tune, add_circle, trending_up, trending_down', () => {
    render(<PayrollAdjustmentsHeader adjustments={SAMPLE_ADJUSTMENTS} />);

    // Header module icon
    expect(screen.getByTestId('payroll-adjustments-header').textContent).toContain('tune');

    // Action button icon
    expect(screen.getByTestId('new-adjustment-btn').textContent).toContain('add_circle');

    // Total Bonuses card icon
    const bonusCard = screen.getByTestId('kpi-total-bonuses');
    expect(bonusCard.textContent).toContain('trending_up');

    // Total Deductions card icon
    const deductionCard = screen.getByTestId('kpi-total-deductions');
    expect(deductionCard.textContent).toContain('trending_down');
  });

  it('accurately segments bonus totals from deduction totals in metric cards (Acceptance Criteria 2)', () => {
    render(<PayrollAdjustmentsHeader adjustments={SAMPLE_ADJUSTMENTS} />);

    // Expected Bonuses: 500 + 250.50 = 750.50
    const bonusValue = screen.getByTestId('metric-value-total-bonuses');
    expect(bonusValue).toHaveTextContent('$750.50');

    // Expected Deductions: 150 + 75.25 = 225.25
    const deductionValue = screen.getByTestId('metric-value-total-deductions');
    expect(deductionValue).toHaveTextContent('$225.25');

    // Expected Net Adjustment: 750.50 - 225.25 = 525.25
    const netValue = screen.getByTestId('metric-value-net-adjustments');
    expect(netValue).toHaveTextContent('$525.25');
  });

  it('provides filter controls by AdjustmentType (ALL vs BONUS vs DEDUCTION)', () => {
    const handleTypeChange = vi.fn();
    const handleFilteredChange = vi.fn();

    render(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        onTypeFilterChange={handleTypeChange}
        onFilteredAdjustmentsChange={handleFilteredChange}
      />,
    );

    // Filter controls are rendered
    const allBtn = screen.getByTestId('filter-type-all');
    const bonusBtn = screen.getByTestId('filter-type-bonus');
    const deductionBtn = screen.getByTestId('filter-type-deduction');

    expect(allBtn).toBeInTheDocument();
    expect(bonusBtn).toBeInTheDocument();
    expect(deductionBtn).toBeInTheDocument();

    // Click BONUSES
    fireEvent.click(bonusBtn);
    expect(handleTypeChange).toHaveBeenCalledWith('BONUS');

    // Verify filtered items sent to callback contain only bonuses
    const lastFilteredAfterBonus =
      handleFilteredChange.mock.calls[handleFilteredChange.mock.calls.length - 1][0];
    expect(lastFilteredAfterBonus).toHaveLength(2);
    expect(lastFilteredAfterBonus.every((item: PayrollAdjustment) => item.adjustment_type === 'BONUS')).toBe(true);

    // Click DEDUCTIONS
    fireEvent.click(deductionBtn);
    expect(handleTypeChange).toHaveBeenCalledWith('DEDUCTION');

    const lastFilteredAfterDeduction =
      handleFilteredChange.mock.calls[handleFilteredChange.mock.calls.length - 1][0];
    expect(lastFilteredAfterDeduction).toHaveLength(2);
    expect(lastFilteredAfterDeduction.every((item: PayrollAdjustment) => item.adjustment_type === 'DEDUCTION')).toBe(true);

    // Click ALL
    fireEvent.click(allBtn);
    expect(handleTypeChange).toHaveBeenCalledWith('ALL');
  });

  it('filters adjustments by search query across collaborator name, reason and ID', () => {
    const handleSearchChange = vi.fn();
    const handleFilteredChange = vi.fn();

    render(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        onSearchChange={handleSearchChange}
        onFilteredAdjustmentsChange={handleFilteredChange}
      />,
    );

    const searchInput = screen.getByTestId('adjustments-search-input');
    fireEvent.change(searchInput, { target: { value: 'Uniform' } });

    expect(handleSearchChange).toHaveBeenCalledWith('Uniform');

    const lastFiltered =
      handleFilteredChange.mock.calls[handleFilteredChange.mock.calls.length - 1][0];
    expect(lastFiltered).toHaveLength(1);
    expect(lastFiltered[0].reason).toContain('Uniform');

    // Clear search button appears
    const clearBtn = screen.getByTestId('clear-adjustments-search-btn');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');
  });

  it('supports controlled selectedType prop', () => {
    const { rerender } = render(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        selectedType="BONUS"
      />,
    );

    const bonusBtn = screen.getByTestId('filter-type-bonus');
    expect(bonusBtn).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        selectedType="DEDUCTION"
      />,
    );

    const deductionBtn = screen.getByTestId('filter-type-deduction');
    expect(deductionBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows manual metrics override', () => {
    render(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        metrics={{
          totalBonuses: 9999,
          totalDeductions: 1111,
          netAdjustmentTotal: 8888,
        }}
      />,
    );

    expect(screen.getByTestId('metric-value-total-bonuses')).toHaveTextContent('$9,999.00');
    expect(screen.getByTestId('metric-value-total-deductions')).toHaveTextContent('$1,111.00');
    expect(screen.getByTestId('metric-value-net-adjustments')).toHaveTextContent('$8,888.00');
  });

  it('supports dataset prop as alias for adjustments', () => {
    render(<PayrollAdjustmentsHeader dataset={SAMPLE_ADJUSTMENTS} />);

    expect(screen.getByTestId('metric-value-total-bonuses')).toHaveTextContent('$750.50');
    expect(screen.getByTestId('metric-value-total-deductions')).toHaveTextContent('$225.25');
  });

  it('supports scopeMetricsToFilter to recompute metrics based on current filter', () => {
    render(
      <PayrollAdjustmentsHeader
        adjustments={SAMPLE_ADJUSTMENTS}
        selectedType="BONUS"
        scopeMetricsToFilter={true}
      />,
    );

    // Under scopeMetricsToFilter with selectedType="BONUS", deductions should be 0 in metrics
    expect(screen.getByTestId('metric-value-total-bonuses')).toHaveTextContent('$750.50');
    expect(screen.getByTestId('metric-value-total-deductions')).toHaveTextContent('$0.00');
  });

  it('displays loading indicator in metric values when isLoading is true', () => {
    render(<PayrollAdjustmentsHeader isLoading={true} />);

    expect(screen.getByTestId('metric-value-total-bonuses')).toHaveTextContent('Loading…');
    expect(screen.getByTestId('metric-value-total-deductions')).toHaveTextContent('Loading…');
    expect(screen.getByTestId('metric-value-net-adjustments')).toHaveTextContent('Loading…');
  });
});
