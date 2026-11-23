import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PayrollAdjustmentsView } from './PayrollAdjustmentsView';
import { apiRequest } from '@/shared/api/http';
import type { PayrollAdjustment } from './types';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
}));

const mockAdjustments: PayrollAdjustment[] = [
  {
    id: 1,
    payroll_entry_id: 101,
    collaborator_name: 'Alejandro Cordero',
    adjustment_type: 'BONUS',
    description: 'Performance bonus Q3',
    amount: 250.0,
    created_at: '2026-11-15T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 2,
    payroll_entry_id: 102,
    collaborator_name: 'Maria Gomez',
    adjustment_type: 'DEDUCTION',
    description: 'Uniform deduction',
    amount: 50.0,
    created_at: '2026-11-15T11:00:00Z',
    deleted_at: null,
  },
];

describe('PayrollAdjustmentsView', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue(mockAdjustments);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the adjustments workspace containing Header, Grid, QuickLaunch, and NavHub', async () => {
    render(<PayrollAdjustmentsView />);

    expect(screen.getByTestId('payroll-adjustments-view')).toBeInTheDocument();
    expect(screen.getByTestId('payroll-adjustments-header')).toBeInTheDocument();
    expect(screen.getByTestId('payroll-adjustments-grid')).toBeInTheDocument();
    expect(screen.getByTestId('payroll-adjustments-quick-launch')).toBeInTheDocument();
    expect(screen.getByTestId('payroll-nav-hub')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alejandro Cordero')).toBeInTheDocument();
    });
  });

  it('configures PayrollNavHub with active PAYROLL ADJUSTMENTS tab styling', async () => {
    render(<PayrollAdjustmentsView />);

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(adjustmentsTab).toHaveAttribute('data-active', 'true');
    expect(adjustmentsTab.className).toContain('font-bold');

    const underline = adjustmentsTab.querySelector('[data-testid="active-tab-underline"]');
    expect(underline).toBeInTheDocument();
    expect(underline?.className).toContain('bg-[#ae001a]');

    // Sibling tabs should not have active underline
    const runsTab = screen.getByTestId('nav-tab-payroll-runs');
    expect(runsTab).toHaveAttribute('aria-selected', 'false');
    expect(runsTab.querySelector('[data-testid="active-tab-underline"]')).toBeNull();
  });

  it('triggers onNavigate when clicking a sister tab in the NavHub footer', async () => {
    const handleNavigate = vi.fn();
    render(<PayrollAdjustmentsView onNavigate={handleNavigate} />);

    const runsTab = screen.getByTestId('nav-tab-payroll-runs');
    fireEvent.click(runsTab);

    expect(handleNavigate).toHaveBeenCalledWith('payroll-runs');
  });

  it('hydrates adjustments from API using payrollRunId prop', async () => {
    render(<PayrollAdjustmentsView payrollRunId={42} />);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/payroll-adjustments'),
        expect.objectContaining({ method: 'GET' }),
        expect.any(String),
      );
    });

    expect(await screen.findByText('Performance bonus Q3')).toBeInTheDocument();
    expect(await screen.findByText('Uniform deduction')).toBeInTheDocument();
  });

  it('updates search query and filters grid records accordingly', async () => {
    render(<PayrollAdjustmentsView />);

    await waitFor(() => {
      expect(screen.getByText('Alejandro Cordero')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search adjustments/i);
    fireEvent.change(searchInput, { target: { value: 'Maria' } });

    expect(screen.queryByText('Alejandro Cordero')).toBeNull();
    expect(screen.getByText('Maria Gomez')).toBeInTheDocument();
  });

  it('handles quick launch operations and displays status feedback', async () => {
    render(<PayrollAdjustmentsView />);

    const reSyncBtn = screen.getByRole('button', { name: /re-sync with entries/i });
    fireEvent.click(reSyncBtn);

    const elements = await screen.findAllByText(/re-synced 0 payroll entries/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('opens NewPayrollAdjustmentModal on header action and adds newly saved adjustment to grid', async () => {
    render(<PayrollAdjustmentsView />);

    await waitFor(() => {
      expect(screen.getByText('Performance bonus Q3')).toBeInTheDocument();
    });

    const newBtn = screen.getByTestId('new-adjustment-btn');
    fireEvent.click(newBtn);

    expect(screen.getByTestId('new-payroll-adjustment-modal')).toBeInTheDocument();

    // Fill form in modal
    fireEvent.change(screen.getByTestId('input-adj-collaborator-name'), { target: { value: 'Mateo Morales' } });
    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '450' } });
    fireEvent.change(screen.getByTestId('input-adj-description'), { target: { value: 'Performance bonus' } });

    // Submit modal
    fireEvent.click(screen.getByTestId('submit-adjustment-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('new-payroll-adjustment-modal')).toBeNull();
      expect(screen.getByText('Mateo Morales')).toBeInTheDocument();
      expect(screen.getByText('Performance bonus')).toBeInTheDocument();
    });
  });
});
