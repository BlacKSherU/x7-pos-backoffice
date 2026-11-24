import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PayrollAdjustmentsQuickLaunch } from './PayrollAdjustmentsQuickLaunch';
import type { PayrollAdjustment, PayrollEntry } from './types';

const SAMPLE_ENTRIES: PayrollEntry[] = [
  {
    id: 'PE-1001',
    collaborator_name: 'Carlos Mendoza',
    base_pay: 2000,
    overtime_pay: 0,
    double_overtime_pay: 0,
    tips_amount: 0,
    bonuses: 0,
    deductions: 0,
    tax_total: 200,
    gross_total: 2000,
    net_total: 1800,
  },
];

const SAMPLE_ADJUSTMENTS: PayrollAdjustment[] = [
  {
    id: 'ADJ-101',
    payroll_entry_id: 'PE-1001',
    collaborator_name: 'Carlos Mendoza',
    adjustment_type: 'BONUS',
    description: 'Quarterly Bonus',
    amount: 300,
  },
  {
    id: 'ADJ-102',
    payroll_entry_id: 'PE-1001',
    collaborator_name: 'Carlos Mendoza',
    adjustment_type: 'DEDUCTION',
    description: 'Gym Membership',
    amount: 100,
  },
];

describe('PayrollAdjustmentsQuickLaunch', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders persistently at the bottom of the workspace grid (Acceptance Criteria)', () => {
    render(<PayrollAdjustmentsQuickLaunch isPersistent={true} />);

    const bar = screen.getByTestId('payroll-adjustments-quick-launch');
    expect(bar).toBeInTheDocument();
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('bottom-12');
    expect(bar.className).toContain('z-30');
  });

  it('renders all 4 primary action buttons with required icons and text', () => {
    render(<PayrollAdjustmentsQuickLaunch adjustments={SAMPLE_ADJUSTMENTS} />);

    // 1. [ APPLY BULK BONUS ] with auto_awesome
    const bulkBonusBtn = screen.getByTestId('quick-action-bulk-bonus');
    expect(bulkBonusBtn).toBeInTheDocument();
    expect(bulkBonusBtn).toHaveTextContent('APPLY BULK BONUS');
    expect(bulkBonusBtn.textContent).toContain('auto_awesome');

    // 2. [ IMPORT DEDUCTIONS CSV ] with upload_file
    const importDeductionsBtn = screen.getByTestId('quick-action-import-deductions');
    expect(importDeductionsBtn).toBeInTheDocument();
    expect(importDeductionsBtn).toHaveTextContent('IMPORT DEDUCTIONS CSV');
    expect(importDeductionsBtn.textContent).toContain('upload_file');

    // 3. [ RE-SYNC WITH ENTRIES ] with sync
    const resyncBtn = screen.getByTestId('quick-action-resync-entries');
    expect(resyncBtn).toBeInTheDocument();
    expect(resyncBtn).toHaveTextContent('RE-SYNC WITH ENTRIES');
    expect(resyncBtn.textContent).toContain('sync');

    // 4. [ ADJUSTMENT REPORT ] with assessment
    const reportBtn = screen.getByTestId('quick-action-adjustment-report');
    expect(reportBtn).toBeInTheDocument();
    expect(reportBtn).toHaveTextContent('ADJUSTMENT REPORT');
    expect(reportBtn.textContent).toContain('assessment');
  });

  it('[ RE-SYNC WITH ENTRIES ] forces recalculation of PayrollEntry.bonuses and deductions fields', () => {
    const handleReSync = vi.fn();
    const handleEntriesChange = vi.fn();

    render(
      <PayrollAdjustmentsQuickLaunch
        adjustments={SAMPLE_ADJUSTMENTS}
        payrollEntries={SAMPLE_ENTRIES}
        onReSyncWithEntries={handleReSync}
        onEntriesChange={handleEntriesChange}
      />,
    );

    const resyncBtn = screen.getByTestId('quick-action-resync-entries');
    fireEvent.click(resyncBtn);

    // Associated entry PE-1001 should be recalculated:
    // bonuses: 300
    // deductions: 100
    // gross_total: 2000 + 300 - 100 = 2200
    // net_total: 2200 - 200 = 2000
    expect(handleReSync).toHaveBeenCalledTimes(1);
    const updatedEntries: PayrollEntry[] = handleReSync.mock.calls[0][0];

    expect(updatedEntries).toHaveLength(1);
    expect(updatedEntries[0].bonuses).toBe(300);
    expect(updatedEntries[0].deductions).toBe(100);
    expect(updatedEntries[0].gross_total).toBe(2200);
    expect(updatedEntries[0].net_total).toBe(2000);

    expect(handleEntriesChange).toHaveBeenCalledWith(updatedEntries);

    // Feedback message is shown
    expect(screen.getByTestId('adjustments-feedback-msg')).toBeInTheDocument();
  });

  it('triggers onApplyBulkBonus when [ APPLY BULK BONUS ] is clicked', () => {
    const handleBulkBonus = vi.fn();

    render(
      <PayrollAdjustmentsQuickLaunch
        adjustments={SAMPLE_ADJUSTMENTS}
        onApplyBulkBonus={handleBulkBonus}
      />,
    );

    const button = screen.getByTestId('quick-action-bulk-bonus');
    fireEvent.click(button);

    expect(handleBulkBonus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('adjustments-feedback-msg')).toHaveTextContent(
      /bulk bonus/i,
    );
  });

  it('handles CSV file selection when [ IMPORT DEDUCTIONS CSV ] is triggered', async () => {
    const handleImport = vi.fn();

    render(
      <PayrollAdjustmentsQuickLaunch
        onImportDeductionsCsv={handleImport}
      />,
    );

    const fileInput = screen.getByTestId('deductions-file-input');
    const dummyFile = new File(['amount,type\n100,DEDUCTION'], 'deductions.csv', {
      type: 'text/csv',
    });

    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    await waitFor(() => {
      expect(handleImport).toHaveBeenCalledWith(dummyFile);
    });
  });

  it('triggers CSV download and callback when [ ADJUSTMENT REPORT ] is clicked', () => {
    const handleReport = vi.fn();
    const mockClick = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(
      <PayrollAdjustmentsQuickLaunch
        adjustments={SAMPLE_ADJUSTMENTS}
        onAdjustmentReport={handleReport}
      />,
    );

    const reportBtn = screen.getByTestId('quick-action-adjustment-report');
    fireEvent.click(reportBtn);

    expect(handleReport).toHaveBeenCalledTimes(1);
    const csvContent = handleReport.mock.calls[0][0];

    expect(csvContent).toContain('Adjustment ID,Payroll Entry ID,Collaborator Name');
    expect(csvContent).toContain('ADJ-101');
    expect(csvContent).toContain('Quarterly Bonus');
    expect(csvContent).toContain('ADJ-102');
    expect(csvContent).toContain('Gym Membership');
  });

  it('displays accurate scope badge for all items vs selected items', () => {
    const { rerender } = render(
      <PayrollAdjustmentsQuickLaunch adjustments={SAMPLE_ADJUSTMENTS} />,
    );

    const badge = screen.getByTestId('adjustments-quick-launch-scope-badge');
    expect(badge).toHaveTextContent('2 Adjustments');

    // With active row selection
    rerender(
      <PayrollAdjustmentsQuickLaunch
        adjustments={SAMPLE_ADJUSTMENTS}
        selectedRowIds={['ADJ-101']}
      />,
    );

    expect(badge).toHaveTextContent('1 Selected');
  });

  it('supports relative positioning when isPersistent is false', () => {
    render(<PayrollAdjustmentsQuickLaunch isPersistent={false} />);

    const bar = screen.getByTestId('payroll-adjustments-quick-launch');
    expect(bar.className).toContain('relative');
    expect(bar.className).not.toContain('sticky');
  });
});
