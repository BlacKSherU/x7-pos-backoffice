import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayrollEntriesQuickLaunch } from './PayrollEntriesQuickLaunch';
import {
  generatePayrollSummaryCsv,
  recalculatePayrollEntries,
  recalculatePayrollEntryCalculations,
} from './payroll-entries-helpers';
import type { PayrollEntry } from './types';

const MOCK_ENTRIES: PayrollEntry[] = [
  {
    id: 'PE-101',
    collaborator_id: 11,
    collaborator_name: 'Mateo Morales',
    base_pay: 1000.0,
    overtime_pay: 150.0,
    double_overtime_pay: 50.0,
    tips_amount: 50.0,
    bonuses: 100.0,
    deductions: 50.0,
    // Expected gross: (1000 + 150 + 50 + 50 + 100 - 50) = 1300.00
    // Incorrect gross initially:
    gross_total: 999.0,
    tax_total: 200.0,
    // Expected net: 1300 - 200 = 1100.00
    net_total: 800.0,
    created_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'PE-102',
    collaborator_id: 12,
    collaborator_name: 'Camila Perez',
    base_pay: 2000.0,
    overtime_pay: 0,
    double_overtime_pay: 0,
    tips_amount: 100.0,
    bonuses: 200.0,
    deductions: 100.0,
    // Expected gross: 2000 + 0 + 0 + 100 + 200 - 100 = 2200.00
    gross_total: 2200.0,
    tax_total: 300.0,
    // Expected net: 2200 - 300 = 1900.00
    net_total: 1900.0,
    created_at: '2026-11-01T08:15:00Z',
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PayrollEntriesQuickLaunch Component', () => {
  describe('Acceptance Criteria 1: Persistent Bar Above NavHub Footer & Styling', () => {
    it('remains persistent directly above the NavHub footer with positioning classes', () => {
      render(<PayrollEntriesQuickLaunch entries={MOCK_ENTRIES} isPersistent={true} />);

      const barElement = screen.getByTestId('payroll-entries-quick-launch');
      expect(barElement).toBeInTheDocument();
      // Verifies persistence positioning directly above NavHub footer (bottom-12 sm:bottom-[46px])
      expect(barElement.className).toContain('sticky');
      expect(barElement.className).toContain('bottom-12');
      expect(barElement.className).toContain('sm:bottom-[46px]');
      expect(barElement.className).toContain('z-30');

      // Verifies Poppins typography and corporate red accents
      expect(barElement.className).toContain("font-['Poppins',sans-serif]");
    });

    it('displays corporate red hover accents (#ae001a) on buttons and top border', () => {
      render(<PayrollEntriesQuickLaunch entries={MOCK_ENTRIES} />);

      const barElement = screen.getByTestId('payroll-entries-quick-launch');
      const innerContainer = barElement.firstElementChild;
      expect(innerContainer?.className).toContain('border-[#ae001a]');

      const recalculateBtn = screen.getByTestId('quick-action-recalculate');
      expect(recalculateBtn.className).toContain('hover:bg-[#ae001a]');
      expect(recalculateBtn.className).toContain('hover:border-[#ae001a]');

      const exportBtn = screen.getByTestId('quick-action-export-summary');
      expect(exportBtn.className).toContain('hover:bg-[#ae001a]');
    });

    it('renders all 4 primary action buttons with required Material Symbols: calculate, tune, download, verified_user', () => {
      render(<PayrollEntriesQuickLaunch entries={MOCK_ENTRIES} />);

      // 1. RE-CALCULATE NET PAY with calculate
      const btnRecalculate = screen.getByTestId('quick-action-recalculate');
      expect(btnRecalculate).toHaveTextContent(/RE-CALCULATE NET PAY/i);
      expect(btnRecalculate.querySelector('.material-symbols-outlined')).toHaveTextContent('calculate');

      // 2. BULK ADJUSTMENTS with tune
      const btnBulk = screen.getByTestId('quick-action-bulk-adjustments');
      expect(btnBulk).toHaveTextContent(/BULK ADJUSTMENTS/i);
      expect(btnBulk.querySelector('.material-symbols-outlined')).toHaveTextContent('tune');

      // 3. EXPORT PAYROLL SUMMARY with download
      const btnExport = screen.getByTestId('quick-action-export-summary');
      expect(btnExport).toHaveTextContent(/EXPORT PAYROLL SUMMARY/i);
      expect(btnExport.querySelector('.material-symbols-outlined')).toHaveTextContent('download');

      // 4. AUDIT TAXES with verified_user
      const btnAudit = screen.getByTestId('quick-action-audit-taxes');
      expect(btnAudit).toHaveTextContent(/AUDIT TAXES/i);
      expect(btnAudit.querySelector('.material-symbols-outlined')).toHaveTextContent('verified_user');
    });

    it('displays current line item and selection count badge', () => {
      const { rerender } = render(<PayrollEntriesQuickLaunch entries={MOCK_ENTRIES} />);

      expect(screen.getByTestId('quick-launch-scope-badge')).toHaveTextContent('2 Line Items');

      // With selection
      rerender(<PayrollEntriesQuickLaunch entries={MOCK_ENTRIES} selectedRowIds={['PE-101']} />);
      expect(screen.getByTestId('quick-launch-scope-badge')).toHaveTextContent('1 Selected');
    });
  });

  describe('Acceptance Criteria 2: Clicking Export Triggers CSV/Excel Generation', () => {
    it('triggers CSV generation and download containing collaborator breakdown with current grid dataset', async () => {
      const user = userEvent.setup();
      const handleExportCallback = vi.fn();

      // Mock DOM appendChild and click on anchor
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          el.click = mockClick;
        }
        return el;
      });

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          onExportPayrollSummary={handleExportCallback}
        />,
      );

      const exportBtn = screen.getByTestId('quick-action-export-summary');
      await user.click(exportBtn);

      // Verifies download click was triggered on DOM anchor
      expect(mockClick).toHaveBeenCalled();

      // Verifies callback received the generated CSV content
      expect(handleExportCallback).toHaveBeenCalledTimes(1);
      const csv = handleExportCallback.mock.calls[0][0];

      // Verifies CSV contains collaborator breakdown and columns
      expect(csv).toContain('Collaborator Name');
      expect(csv).toContain('Mateo Morales');
      expect(csv).toContain('Camila Perez');
      expect(csv).toContain('Base Pay');
      expect(csv).toContain('Net Total');

      // Verifies feedback message is shown
      expect(screen.getByTestId('quick-launch-feedback-msg')).toHaveTextContent(/Exported 2 payroll line items/i);
    });

    it('exports only selected entries when a selection is active', async () => {
      const user = userEvent.setup();
      const handleExportCallback = vi.fn();

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          selectedRowIds={['PE-101']}
          onExportPayrollSummary={handleExportCallback}
        />,
      );

      const exportBtn = screen.getByTestId('quick-action-export-summary');
      await user.click(exportBtn);

      expect(handleExportCallback).toHaveBeenCalledTimes(1);
      const csv = handleExportCallback.mock.calls[0][0];

      expect(csv).toContain('Mateo Morales');
      expect(csv).not.toContain('Camila Perez');
    });
  });

  describe('Business Logic: RE-CALCULATE NET PAY Formula Execution', () => {
    it('re-computes gross and net formulas for all entries when no specific row is selected', async () => {
      const user = userEvent.setup();
      const handleRecalculate = vi.fn();
      const handleEntriesChange = vi.fn();

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          onRecalculateNetPay={handleRecalculate}
          onEntriesChange={handleEntriesChange}
        />,
      );

      const recalculateBtn = screen.getByTestId('quick-action-recalculate');
      await user.click(recalculateBtn);

      expect(handleRecalculate).toHaveBeenCalledTimes(1);
      expect(handleEntriesChange).toHaveBeenCalledTimes(1);

      const updatedEntries: PayrollEntry[] = handleRecalculate.mock.calls[0][0];
      expect(updatedEntries).toHaveLength(2);

      // Entry PE-101 was: gross_total: 999.0, net_total: 800.0
      // Re-calculated:
      // gross = 1000 + 150 + 50 + 50 + 100 - 50 = 1300
      // net = 1300 - 200 = 1100
      const entry1 = updatedEntries.find((e) => e.id === 'PE-101');
      expect(entry1?.gross_total).toBe(1300.0);
      expect(entry1?.net_total).toBe(1100.0);
    });

    it('re-computes gross and net formulas only for selected rows when a selection is active', async () => {
      const user = userEvent.setup();
      const handleRecalculate = vi.fn();

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          selectedRowIds={['PE-101']}
          onRecalculateNetPay={handleRecalculate}
        />,
      );

      const recalculateBtn = screen.getByTestId('quick-action-recalculate');
      await user.click(recalculateBtn);

      const updatedEntries: PayrollEntry[] = handleRecalculate.mock.calls[0][0];
      const entry1 = updatedEntries.find((e) => e.id === 'PE-101');
      const entry2 = updatedEntries.find((e) => e.id === 'PE-102');

      // Entry 1 recalculated
      expect(entry1?.gross_total).toBe(1300.0);
      expect(entry1?.net_total).toBe(1100.0);

      // Entry 2 kept its original values
      expect(entry2?.gross_total).toBe(2200.0);
      expect(entry2?.net_total).toBe(1900.0);
    });
  });

  describe('Other Action Button Callbacks', () => {
    it('triggers onBulkAdjustments when clicking BULK ADJUSTMENTS button', async () => {
      const user = userEvent.setup();
      const handleBulk = vi.fn();

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          onBulkAdjustments={handleBulk}
        />,
      );

      await user.click(screen.getByTestId('quick-action-bulk-adjustments'));
      expect(handleBulk).toHaveBeenCalledTimes(1);
    });

    it('triggers onAuditTaxes when clicking AUDIT TAXES button', async () => {
      const user = userEvent.setup();
      const handleAudit = vi.fn();

      render(
        <PayrollEntriesQuickLaunch
          entries={MOCK_ENTRIES}
          onAuditTaxes={handleAudit}
        />,
      );

      await user.click(screen.getByTestId('quick-action-audit-taxes'));
      expect(handleAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Helper Functions for Recalculation and CSV Export', () => {
    it('recalculatePayrollEntryCalculations correctly computes gross and net totals', () => {
      const entry = recalculatePayrollEntryCalculations(MOCK_ENTRIES[0]);
      expect(entry.gross_total).toBe(1300);
      expect(entry.net_total).toBe(1100);
    });

    it('recalculatePayrollEntries updates target entries by IDs', () => {
      const updated = recalculatePayrollEntries(MOCK_ENTRIES, ['PE-101']);
      expect(updated[0].gross_total).toBe(1300);
      expect(updated[1].gross_total).toBe(2200);
    });

    it('generatePayrollSummaryCsv creates valid formatted CSV lines', () => {
      const csv = generatePayrollSummaryCsv(MOCK_ENTRIES);
      expect(csv).toContain('Collaborator Name');
      expect(csv).toContain('Mateo Morales');
      expect(csv).toContain('Camila Perez');
    });
  });
});
