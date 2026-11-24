import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PayrollEntriesView } from './PayrollEntriesView';
import * as httpModule from '@/shared/api/http';
import type { PayrollEntry } from './types';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
}));

const SAMPLE_ENTRIES: PayrollEntry[] = [
  {
    id: 'PE-1001',
    payroll_run_id: 1,
    collaborator_id: 101,
    collaborator_name: 'Carlos Mendoza',
    base_pay: 2400.0,
    overtime_pay: 300.0,
    double_overtime_pay: 0.0,
    tips_amount: 150.0,
    bonuses: 200.0,
    deductions: 100.0,
    gross_total: 2950.0,
    tax_total: 350.0,
    net_total: 2600.0,
    status: 'calculated',
    created_at: new Date().toISOString(),
  },
  {
    id: 'PE-1002',
    payroll_run_id: 1,
    collaborator_id: 102,
    collaborator_name: 'Elena Rostova',
    base_pay: 2100.0,
    overtime_pay: 150.0,
    double_overtime_pay: 50.0,
    tips_amount: 420.0,
    bonuses: 100.0,
    deductions: 50.0,
    gross_total: 2770.0,
    tax_total: 320.0,
    net_total: 2450.0,
    status: 'calculated',
    created_at: new Date().toISOString(),
  },
];

describe('PayrollEntriesView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the complete payroll entries workspace (header, grid, quick launch)', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: [] });

    render(<PayrollEntriesView />);

    // Renders the main workspace container
    expect(screen.getByTestId('payroll-entries-view')).toBeInTheDocument();

    // Renders the specialized header
    expect(screen.getByTestId('payroll-entries-header')).toBeInTheDocument();
    expect(screen.getByText('PAYROLL ENTRIES COMMAND CONTROL')).toBeInTheDocument();

    // Renders the data grid
    expect(screen.getByTestId('payroll-entries-grid')).toBeInTheDocument();

    // Renders the quick launch toolbar
    expect(screen.getByTestId('payroll-entries-quick-launch')).toBeInTheDocument();
  });

  it('hydrates and displays records retrieved from the backend API', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: SAMPLE_ENTRIES });

    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    });
  });

  it('filters grid rows in real-time when typing in header search input', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: SAMPLE_ENTRIES });

    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by collaborator name/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });

    await waitFor(() => {
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      expect(screen.queryByText('Carlos Mendoza')).toBeNull();
    });
  });

  it('interacts with quick launch operational actions', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: SAMPLE_ENTRIES });

    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    });

    const recalculateBtn = screen.getByTestId('quick-action-recalculate');
    expect(recalculateBtn).toBeInTheDocument();

    fireEvent.click(recalculateBtn);

    await waitFor(() => {
      expect(screen.getByTestId('quick-launch-feedback-msg')).toBeInTheDocument();
    });
  });

  it('opens ManualPayrollEntryModal on button click and adds newly saved entry to the grid', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: SAMPLE_ENTRIES });

    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    });

    const manualBtn = screen.getByRole('button', { name: /manual payroll entry/i });
    fireEvent.click(manualBtn);

    expect(screen.getByTestId('manual-payroll-entry-modal')).toBeInTheDocument();

    // Fill form in modal
    fireEvent.change(screen.getByTestId('input-collaborator-name'), { target: { value: 'Mateo Morales' } });
    fireEvent.change(screen.getByTestId('input-base-pay'), { target: { value: '2500' } });

    // Submit modal
    fireEvent.click(screen.getByTestId('submit-payroll-entry-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('manual-payroll-entry-modal')).toBeNull();
      expect(screen.getByText('Mateo Morales')).toBeInTheDocument();
    });
  });

  it('handles empty state when no records are returned by API', async () => {
    vi.mocked(httpModule.apiRequest).mockResolvedValueOnce({ data: [] });

    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText(/no payroll entries found/i)).toBeInTheDocument();
    });
  });
});
