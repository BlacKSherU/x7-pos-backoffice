import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PayrollAdjustmentsGrid } from './PayrollAdjustmentsGrid';
import type { PayrollAdjustment, PayrollEntry } from './types';
import * as httpModule from '@/shared/api/http';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
}));

const SAMPLE_ENTRIES: PayrollEntry[] = [
  {
    id: 'PE-1001',
    collaborator_name: 'Carlos Mendoza',
    base_pay: 2000,
    overtime_pay: 0,
    double_overtime_pay: 0,
    tips_amount: 0,
    bonuses: 500,
    deductions: 100,
    tax_total: 200,
    gross_total: 2400, // 2000 + 500 - 100 = 2400
    net_total: 2200,   // 2400 - 200 = 2200
  },
];

const SAMPLE_ADJUSTMENTS: PayrollAdjustment[] = [
  {
    id: 'ADJ-101',
    payroll_entry_id: 'PE-1001',
    collaborator_id: 101,
    collaborator_name: 'Carlos Mendoza',
    adjustment_type: 'BONUS',
    description: 'Q3 Performance Bonus',
    amount: 500,
    created_at: '2026-11-15T10:00:00Z',
  },
  {
    id: 'ADJ-102',
    payroll_entry_id: 'PE-1001',
    collaborator_id: 101,
    collaborator_name: 'Carlos Mendoza',
    adjustment_type: 'DEDUCTION',
    description: 'Health Insurance Plan',
    amount: 100,
    created_at: '2026-11-15T10:30:00Z',
  },
];

describe('PayrollAdjustmentsGrid', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders all required table column headers and data binding fields', () => {
    render(<PayrollAdjustmentsGrid adjustments={SAMPLE_ADJUSTMENTS} />);

    // Columns
    expect(screen.getByText('ADJUSTMENT ID')).toBeInTheDocument();
    expect(screen.getByText('ENTRY ID')).toBeInTheDocument();
    expect(screen.getByText('COLLABORATOR')).toBeInTheDocument();
    expect(screen.getByText('TYPE')).toBeInTheDocument();
    expect(screen.getByText('DESCRIPTION / REASON')).toBeInTheDocument();
    expect(screen.getByText('AMOUNT')).toBeInTheDocument();
    expect(screen.getByText('DATE')).toBeInTheDocument();
    expect(screen.getByText('ACTIONS')).toBeInTheDocument();

    // Data binding
    expect(screen.getByText('#ADJ-101')).toBeInTheDocument();
    expect(screen.getAllByText('#PE-1001').length).toBe(2);
    expect(screen.getAllByText('Carlos Mendoza').length).toBeGreaterThan(0);
    expect(screen.getByText('Q3 Performance Bonus')).toBeInTheDocument();
    expect(screen.getByText('Health Insurance Plan')).toBeInTheDocument();
  });

  it('displays pill badges for BONUS (green) and DEDUCTION (amber/red) (Acceptance Criteria 1)', () => {
    render(<PayrollAdjustmentsGrid adjustments={SAMPLE_ADJUSTMENTS} />);

    // Bonus badge: green styling
    const bonusBadge = screen.getByTestId('badge-bonus-ADJ-101');
    expect(bonusBadge).toBeInTheDocument();
    expect(bonusBadge.textContent).toContain('BONUS');
    expect(bonusBadge.className).toContain('bg-emerald-50');
    expect(bonusBadge.className).toContain('text-emerald-700');

    // Deduction badge: amber/red styling
    const deductionBadge = screen.getByTestId('badge-deduction-ADJ-102');
    expect(deductionBadge).toBeInTheDocument();
    expect(deductionBadge.textContent).toContain('DEDUCTION');
    expect(deductionBadge.className).toContain('bg-rose-50');
    expect(deductionBadge.className).toContain('text-rose-700');
  });

  it('formats positive amounts in green for BONUS and negative amounts in red for DEDUCTION', () => {
    render(<PayrollAdjustmentsGrid adjustments={SAMPLE_ADJUSTMENTS} />);

    const bonusAmount = screen.getByTestId('adjustment-amount-ADJ-101');
    expect(bonusAmount).toHaveTextContent('+$500.00');
    expect(bonusAmount.className).toContain('text-emerald-700');

    const deductionAmount = screen.getByTestId('adjustment-amount-ADJ-102');
    expect(deductionAmount).toHaveTextContent('-$100.00');
    expect(deductionAmount.className).toContain('text-rose-700');
  });

  it('deleting an adjustment triggers recalculation of associated PayrollEntry net total (Acceptance Criteria 2)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const handleRecalculated = vi.fn();
    const handleAdjustmentsChange = vi.fn();

    render(
      <PayrollAdjustmentsGrid
        adjustments={SAMPLE_ADJUSTMENTS}
        payrollEntries={SAMPLE_ENTRIES}
        onPayrollEntryRecalculated={handleRecalculated}
        onAdjustmentsChange={handleAdjustmentsChange}
      />,
    );

    // Initial state: PE-1001 net total is 2200 (bonuses: 500, deductions: 100)
    // Click delete on bonus adjustment ADJ-101 (amount: 500)
    const deleteBonusBtn = screen.getByTestId('action-delete-ADJ-101');
    fireEvent.click(deleteBonusBtn);

    expect(window.confirm).toHaveBeenCalledTimes(1);

    // The associated PayrollEntry should be recalculated:
    // bonuses: 500 - 500 = 0
    // gross_total: 2000 + 0 - 100 = 1900
    // net_total: 1900 - 200 = 1700
    expect(handleRecalculated).toHaveBeenCalledTimes(1);
    const recalculatedEntry: PayrollEntry = handleRecalculated.mock.calls[0][0];
    const triggerAdjustment: PayrollAdjustment = handleRecalculated.mock.calls[0][1];

    expect(triggerAdjustment.id).toBe('ADJ-101');
    expect(recalculatedEntry.bonuses).toBe(0);
    expect(recalculatedEntry.gross_total).toBe(1900);
    expect(recalculatedEntry.net_total).toBe(1700);

    // The adjustment in adjustmentsChange should now have deleted_at timestamp
    expect(handleAdjustmentsChange).toHaveBeenCalledTimes(1);
    const updatedAdjustments: PayrollAdjustment[] = handleAdjustmentsChange.mock.calls[0][0];
    const deletedAdj = updatedAdjustments.find((a) => a.id === 'ADJ-101');
    expect(deletedAdj?.deleted_at).toBeDefined();
    expect(deletedAdj?.deleted_at).not.toBeNull();
  });

  it('deleting a deduction adjustment increases the associated PayrollEntry net total', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const handleRecalculated = vi.fn();

    render(
      <PayrollAdjustmentsGrid
        adjustments={SAMPLE_ADJUSTMENTS}
        payrollEntries={SAMPLE_ENTRIES}
        onPayrollEntryRecalculated={handleRecalculated}
      />,
    );

    // Initial state: PE-1001 net total is 2200 (bonuses: 500, deductions: 100)
    // Click delete on deduction adjustment ADJ-102 (amount: 100)
    const deleteDeductionBtn = screen.getByTestId('action-delete-ADJ-102');
    fireEvent.click(deleteDeductionBtn);

    // The associated PayrollEntry should be recalculated:
    // deductions: 100 - 100 = 0
    // gross_total: 2000 + 500 - 0 = 2500
    // net_total: 2500 - 200 = 2300
    expect(handleRecalculated).toHaveBeenCalledTimes(1);
    const recalculatedEntry: PayrollEntry = handleRecalculated.mock.calls[0][0];

    expect(recalculatedEntry.deductions).toBe(0);
    expect(recalculatedEntry.gross_total).toBe(2500);
    expect(recalculatedEntry.net_total).toBe(2300);
  });

  it('clicking a row opens the inspector drawer and clicking close button dismisses it', () => {
    const handleSelect = vi.fn();
    render(
      <PayrollAdjustmentsGrid
        adjustments={SAMPLE_ADJUSTMENTS}
        onSelectAdjustment={handleSelect}
      />,
    );

    // Drawer should not be present initially
    expect(screen.queryByTestId('adjustment-inspector-drawer')).toBeNull();

    // Click row for ADJ-101
    const row = screen.getByTestId('adjustment-row-ADJ-101');
    fireEvent.click(row);

    expect(handleSelect).toHaveBeenCalledWith(SAMPLE_ADJUSTMENTS[0]);

    // Drawer should now be visible
    const drawer = screen.getByTestId('adjustment-inspector-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent('#ADJ-101');
    expect(drawer).toHaveTextContent('Q3 Performance Bonus');

    // Close button
    const closeBtn = screen.getByTestId('close-adjustment-inspector-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('adjustment-inspector-drawer')).toBeNull();
  });

  it('filters rows when searchQuery or selectedType is applied', () => {
    const { rerender } = render(
      <PayrollAdjustmentsGrid
        adjustments={SAMPLE_ADJUSTMENTS}
        searchQuery="Health"
      />,
    );

    expect(screen.getByText('Health Insurance Plan')).toBeInTheDocument();
    expect(screen.queryByText('Q3 Performance Bonus')).toBeNull();

    rerender(
      <PayrollAdjustmentsGrid
        adjustments={SAMPLE_ADJUSTMENTS}
        selectedType="BONUS"
      />,
    );

    expect(screen.getByText('Q3 Performance Bonus')).toBeInTheDocument();
    expect(screen.queryByText('Health Insurance Plan')).toBeNull();
  });

  it('toggles visibility of soft-deleted records when Show Soft-Deleted checkbox is checked', () => {
    const adjustmentsWithDeleted: PayrollAdjustment[] = [
      ...SAMPLE_ADJUSTMENTS,
      {
        id: 'ADJ-103',
        collaborator_name: 'Carlos Mendoza',
        adjustment_type: 'BONUS',
        description: 'Cancelled bonus',
        amount: 200,
        deleted_at: '2026-11-16T12:00:00Z',
      },
    ];

    render(<PayrollAdjustmentsGrid adjustments={adjustmentsWithDeleted} />);

    // Initially soft-deleted ADJ-103 is hidden
    expect(screen.queryByText('Cancelled bonus')).toBeNull();

    // Check "Show Soft-Deleted"
    const toggle = screen.getByTestId('toggle-include-deleted-adjustments');
    fireEvent.click(toggle);

    // Now it should be visible with strike-through styling
    const row = screen.getByTestId('adjustment-row-ADJ-103');
    expect(row).toBeInTheDocument();
    expect(row.className).toContain('line-through');
  });

  it('hydrates adjustments from API when payrollRunId is provided without adjustments prop', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({
      data: SAMPLE_ADJUSTMENTS,
    });

    render(<PayrollAdjustmentsGrid payrollRunId={1} />);

    await waitFor(() => {
      expect(httpModule.apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/payroll-adjustments'),
        { method: 'GET' },
        expect.any(String),
      );
      expect(screen.getByText('Q3 Performance Bonus')).toBeInTheDocument();
    });
  });

  it('displays empty state when no adjustments exist', () => {
    render(<PayrollAdjustmentsGrid adjustments={[]} />);

    expect(screen.getByText(/no payroll adjustments found/i)).toBeInTheDocument();
  });
});
