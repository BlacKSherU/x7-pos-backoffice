import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayrollEntriesGrid } from './PayrollEntriesGrid';
import {
  verifyPayrollEntryCalculations,
  isPayrollEntrySoftDeleted,
} from './payroll-entries-helpers';
import type { PayrollEntry } from './types';
import * as httpModule from '@/shared/api/http';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
  unwrapList: vi.fn((json: unknown) => {
    if (Array.isArray(json)) return json;
    const obj = json as { data?: unknown[]; items?: unknown[] };
    return obj?.data ?? obj?.items ?? [];
  }),
}));

const MOCK_ENTRIES: PayrollEntry[] = [
  {
    id: 101,
    payroll_run_id: 12,
    collaborator_id: 501,
    collaborator_name: 'Ana Morales',
    base_pay: 1500.0,
    overtime_pay: 200.0,
    double_overtime_pay: 50.0,
    tips_amount: 100.0,
    bonuses: 150.0,
    deductions: 50.0,
    // Expected gross: 1500 + 200 + 50 + 100 + 150 - 50 = 1950.00
    gross_total: 1950.0,
    tax_total: 250.0,
    // Expected net: 1950 - 250 = 1700.00
    net_total: 1700.0,
    created_at: '2026-11-01T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 102,
    payroll_run_id: 12,
    collaborator_id: 502,
    collaborator_name: 'Roberto Diaz',
    base_pay: '2000.00',
    overtime_pay: '100.00',
    double_overtime_pay: 0,
    tips_amount: '0.00',
    bonuses: '50.00',
    deductions: '150.00',
    // Expected gross: 2000 + 100 + 0 + 0 + 50 - 150 = 2000.00
    // But let's set gross_total to 2200.00 to simulate a mathematical discrepancy!
    gross_total: 2200.0,
    tax_total: 300.0,
    net_total: 1900.0,
    created_at: '2026-11-01T10:15:00Z',
    deleted_at: null,
  },
  {
    id: 103,
    payroll_run_id: 12,
    collaborator_id: 503,
    collaborator_name: 'Elena Rostova (Soft Deleted)',
    base_pay: 1800.0,
    overtime_pay: 0,
    double_overtime_pay: 0,
    tips_amount: 0,
    bonuses: 0,
    deductions: 0,
    gross_total: 1800.0,
    tax_total: 200.0,
    net_total: 1600.0,
    created_at: '2026-11-01T10:30:00Z',
    deleted_at: '2026-11-02T12:00:00Z', // Soft-deleted record!
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PayrollEntriesGrid Component', () => {
  describe('Acceptance Criteria 1: Grid Layout and Mount without overlap', () => {
    it('mounts within workspace viewport without overlapping header or footer frames', () => {
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      const gridElement = screen.getByTestId('payroll-entries-grid');
      expect(gridElement).toBeInTheDocument();
      expect(gridElement.className).toContain("font-['Poppins',sans-serif]");

      // Renders table structure with tbody
      const tbody = screen.getByTestId('payroll-entries-tbody');
      expect(tbody).toBeInTheDocument();
    });

    it('renders all required Material Symbols: edit, delete, visibility, person', () => {
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      const tbody = screen.getByTestId('payroll-entries-tbody');

      // Material symbols inside rows
      expect(within(tbody).getAllByText('person').length).toBeGreaterThan(0);
      expect(within(tbody).getAllByText('visibility').length).toBeGreaterThan(0);
      expect(within(tbody).getAllByText('edit').length).toBeGreaterThan(0);
      expect(within(tbody).getAllByText('delete').length).toBeGreaterThan(0);
    });
  });

  describe('Acceptance Criteria 2: Formats Currency Values with 2-Decimal Precision', () => {
    it('correctly formats all currency fields using 2-decimal precision', () => {
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      // Entry 101 tests
      expect(screen.getByTestId('base-pay-101')).toHaveTextContent('$1,500.00');
      // Overtime 200 + 50 = 250
      expect(screen.getByTestId('overtime-pay-101')).toHaveTextContent('$250.00');
      expect(screen.getByTestId('tips-101')).toHaveTextContent('$100.00');
      expect(screen.getByTestId('bonuses-101')).toHaveTextContent('$150.00');
      expect(screen.getByTestId('deductions-101')).toHaveTextContent('-$50.00');
      expect(screen.getByTestId('gross-total-101')).toHaveTextContent('$1,950.00');
      expect(screen.getByTestId('tax-total-101')).toHaveTextContent('-$250.00');
      expect(screen.getByTestId('net-total-101')).toHaveTextContent('$1,700.00');
    });
  });

  describe('Acceptance Criteria 3: Excludes Soft-Deleted Records by Default', () => {
    it('excludes soft-deleted records (deleted_at !== null) by default', () => {
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      // Entry 101 & 102 are active (deleted_at === null) -> should be visible
      expect(screen.getByTestId('payroll-entry-row-101')).toBeInTheDocument();
      expect(screen.getByTestId('payroll-entry-row-102')).toBeInTheDocument();

      // Entry 103 is soft-deleted (deleted_at !== null) -> excluded by default
      expect(screen.queryByTestId('payroll-entry-row-103')).not.toBeInTheDocument();
      expect(screen.queryByText(/Elena Rostova/i)).not.toBeInTheDocument();
    });

    it('displays soft-deleted records when Show Soft-Deleted toggle is enabled', async () => {
      const user = userEvent.setup();
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      const toggleCheckbox = screen.getByTestId('toggle-include-deleted');
      expect(toggleCheckbox).not.toBeChecked();

      await user.click(toggleCheckbox);
      expect(toggleCheckbox).toBeChecked();

      // Entry 103 should now appear
      expect(screen.getByTestId('payroll-entry-row-103')).toBeInTheDocument();
      expect(screen.getByText(/Elena Rostova/i)).toBeInTheDocument();
      expect(screen.getByTestId('soft-deleted-badge-103')).toHaveTextContent('DELETED');
    });
  });

  describe('Business Logic: Calculated Verification', () => {
    it('verifies gross_total and net_total mathematical consistency', () => {
      // Entry 101: 1500 + 200 + 50 + 100 + 150 - 50 = 1950 (gross), 1950 - 250 = 1700 (net)
      const v1 = verifyPayrollEntryCalculations(MOCK_ENTRIES[0]);
      expect(v1.isValid).toBe(true);
      expect(v1.expectedGross).toBe(1950);
      expect(v1.actualGross).toBe(1950);
      expect(v1.expectedNet).toBe(1700);
      expect(v1.actualNet).toBe(1700);

      // Entry 102: expected gross is 2000, actual is 2200 -> invalid!
      const v2 = verifyPayrollEntryCalculations(MOCK_ENTRIES[1]);
      expect(v2.isValid).toBe(false);
      expect(v2.isGrossValid).toBe(false);
      expect(v2.expectedGross).toBe(2000);
      expect(v2.actualGross).toBe(2200);
    });

    it('renders Verified badge for consistent calculations and Audit badge for discrepancies', () => {
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      // Entry 101 has valid calculations
      expect(screen.getByTestId('verification-badge-101')).toBeInTheDocument();
      expect(screen.getByTestId('verification-badge-101')).toHaveTextContent('Verified');

      // Entry 102 has discrepancy
      expect(screen.getByTestId('discrepancy-badge-102')).toBeInTheDocument();
      expect(screen.getByTestId('discrepancy-badge-102')).toHaveTextContent('Audit');
    });
  });

  describe('Business Logic: Row Inspector & Soft Delete', () => {
    it('opens detail inspector when clicking a row', async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();

      render(
        <PayrollEntriesGrid
          entries={MOCK_ENTRIES}
          onSelectEntry={handleSelect}
        />,
      );

      // Detail inspector is closed initially
      expect(screen.queryByTestId('payroll-entry-inspector')).not.toBeInTheDocument();

      // Click row for Ana Morales (101)
      await user.click(screen.getByTestId('payroll-entry-row-101'));

      expect(handleSelect).toHaveBeenCalledWith(MOCK_ENTRIES[0]);

      // Inspector drawer opens
      const inspector = screen.getByTestId('payroll-entry-inspector');
      expect(inspector).toBeInTheDocument();
      expect(within(inspector).getByText(/Ana Morales/i)).toBeInTheDocument();
      expect(within(inspector).getByText(/Entry #101/i)).toBeInTheDocument();
      expect(within(inspector).getByTestId('inspector-verification-card')).toBeInTheDocument();

      // Close inspector via close button
      await user.click(screen.getByTestId('close-inspector-btn'));
      expect(screen.queryByTestId('payroll-entry-inspector')).not.toBeInTheDocument();
    });

    it('opens detail inspector when clicking the visibility inspect button', async () => {
      const user = userEvent.setup();
      render(<PayrollEntriesGrid entries={MOCK_ENTRIES} />);

      await user.click(screen.getByTestId('inspect-entry-btn-101'));
      expect(screen.getByTestId('payroll-entry-inspector')).toBeInTheDocument();
    });

    it('soft-deletes a record when clicking the delete button (setting deleted_at !== null)', async () => {
      const user = userEvent.setup();
      const handleDeleteCallback = vi.fn();
      const handleEntriesChange = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <PayrollEntriesGrid
          entries={MOCK_ENTRIES}
          onDeleteEntry={handleDeleteCallback}
          onEntriesChange={handleEntriesChange}
        />,
      );

      expect(screen.getByTestId('payroll-entry-row-101')).toBeInTheDocument();

      // Click delete button on entry 101
      const deleteBtn = screen.getByTestId('delete-entry-btn-101');
      await user.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalled();
      expect(handleDeleteCallback).toHaveBeenCalledWith(MOCK_ENTRIES[0]);

      // The entry should now be soft-deleted and excluded from default visible list
      await waitFor(() => {
        expect(screen.queryByTestId('payroll-entry-row-101')).not.toBeInTheDocument();
      });

      expect(handleEntriesChange).toHaveBeenCalled();
      const updatedList: PayrollEntry[] =
        handleEntriesChange.mock.calls[handleEntriesChange.mock.calls.length - 1][0];
      const deletedEntry = updatedList.find((e) => e.id === 101);
      expect(deletedEntry?.deleted_at).toBeTruthy();
    });

    it('cancels soft-delete if confirmation dialog is rejected', async () => {
      const user = userEvent.setup();
      const handleDeleteCallback = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <PayrollEntriesGrid
          entries={MOCK_ENTRIES}
          onDeleteEntry={handleDeleteCallback}
        />,
      );

      const deleteBtn = screen.getByTestId('delete-entry-btn-101');
      await user.click(deleteBtn);

      expect(handleDeleteCallback).not.toHaveBeenCalled();
      expect(screen.getByTestId('payroll-entry-row-101')).toBeInTheDocument();
    });
  });

  describe('Business Logic: Data Hydration via GET /api/v1/payroll-entries?payrollRunId={id}', () => {
    it('fetches records from API when payrollRunId is provided without static entries', async () => {
      const apiRequestMock = vi.mocked(httpModule.apiRequest);
      apiRequestMock.mockResolvedValueOnce({
        data: [MOCK_ENTRIES[0]],
      });

      render(<PayrollEntriesGrid payrollRunId={42} />);

      await waitFor(() => {
        expect(apiRequestMock).toHaveBeenCalledWith(
          expect.stringContaining('/payroll-entries?payroll_run_id=42'),
          { method: 'GET' },
          expect.any(String),
        );
      });

      expect(await screen.findByTestId('payroll-entry-row-101')).toBeInTheDocument();
    });

    it('displays error banner and retry button when API hydration fails', async () => {
      const apiRequestMock = vi.mocked(httpModule.apiRequest);
      apiRequestMock.mockRejectedValueOnce(new Error('Network error: 500'));

      render(<PayrollEntriesGrid payrollRunId={42} />);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Network error: 500/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  describe('Helper Functions', () => {
    it('isPayrollEntrySoftDeleted detects deleted_at accurately', () => {
      expect(isPayrollEntrySoftDeleted({ id: 1, base_pay: 0, overtime_pay: 0, net_total: 0, deleted_at: null })).toBe(false);
      expect(isPayrollEntrySoftDeleted({ id: 2, base_pay: 0, overtime_pay: 0, net_total: 0, deleted_at: undefined })).toBe(false);
      expect(isPayrollEntrySoftDeleted({ id: 3, base_pay: 0, overtime_pay: 0, net_total: 0, deleted_at: '2026-11-01' })).toBe(true);
    });
  });
});

