import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ManualPayrollEntryModal } from './ManualPayrollEntryModal';
import { apiRequest } from '@/shared/api/http';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
}));

describe('ManualPayrollEntryModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<ManualPayrollEntryModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('manual-payroll-entry-modal')).toBeNull();
  });

  it('renders correctly with title, fields, and calculation strip when isOpen is true', () => {
    render(<ManualPayrollEntryModal isOpen={true} onClose={vi.fn()} payrollRunId={10} />);

    expect(screen.getByTestId('manual-payroll-entry-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /manual payroll entry/i })).toBeInTheDocument();
    expect(screen.getByTestId('input-collaborator-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-base-pay')).toBeInTheDocument();
    expect(screen.getByTestId('input-overtime-pay')).toBeInTheDocument();
    expect(screen.getByTestId('input-double-overtime-pay')).toBeInTheDocument();
    expect(screen.getByTestId('input-tips-amount')).toBeInTheDocument();
    expect(screen.getByTestId('input-bonuses')).toBeInTheDocument();
    expect(screen.getByTestId('input-deductions')).toBeInTheDocument();
    expect(screen.getByTestId('input-tax-total')).toBeInTheDocument();
    expect(screen.getByTestId('calculation-preview-strip')).toBeInTheDocument();
  });

  it('updates real-time gross and net calculations dynamically', () => {
    render(<ManualPayrollEntryModal isOpen={true} onClose={vi.fn()} />);

    // Base Pay: 1000
    fireEvent.change(screen.getByTestId('input-base-pay'), { target: { value: '1000' } });
    // Overtime: 200
    fireEvent.change(screen.getByTestId('input-overtime-pay'), { target: { value: '200' } });
    // Tips: 50
    fireEvent.change(screen.getByTestId('input-tips-amount'), { target: { value: '50' } });
    // Bonuses: 100
    fireEvent.change(screen.getByTestId('input-bonuses'), { target: { value: '100' } });
    // Deductions: 30
    fireEvent.change(screen.getByTestId('input-deductions'), { target: { value: '30' } });
    // Taxes: 120
    fireEvent.change(screen.getByTestId('input-tax-total'), { target: { value: '120' } });

    // Gross: 1000 + 200 + 50 + 100 - 30 = 1320
    expect(screen.getByTestId('preview-gross-total')).toHaveTextContent('$1,320.00');
    // Net: 1320 - 120 = 1200
    expect(screen.getByTestId('preview-net-total')).toHaveTextContent('$1,200.00');
  });

  it('validates that collaborator name is required', async () => {
    render(<ManualPayrollEntryModal isOpen={true} onClose={vi.fn()} />);

    // Try submitting without collaborator name
    fireEvent.change(screen.getByTestId('input-base-pay'), { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('submit-payroll-entry-btn'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/please enter the collaborator name/i);
  });

  it('validates that base pay must be greater than 0', async () => {
    render(<ManualPayrollEntryModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('input-collaborator-name'), { target: { value: 'Elena Rostova' } });
    fireEvent.change(screen.getByTestId('input-base-pay'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('submit-payroll-entry-btn'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/base pay amount greater than 0/i);
  });

  it('submits valid entry, triggers onSave and closes modal', async () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (typeof path === 'string' && path.includes('/collaborators')) {
        return { data: [{ id: 1, first_name: 'Elena', last_name: 'Rostova' }] };
      }
      return {
        id: 'PE-999',
        collaborator_name: 'Elena Rostova',
        base_pay: 1500,
        net_total: 1300,
      };
    });

    render(
      <ManualPayrollEntryModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        payrollRunId={5}
      />,
    );

    fireEvent.change(screen.getByTestId('input-collaborator-name'), { target: { value: 'Elena Rostova' } });
    fireEvent.change(screen.getByTestId('input-base-pay'), { target: { value: '1500' } });
    fireEvent.change(screen.getByTestId('input-tax-total'), { target: { value: '200' } });

    fireEvent.click(screen.getByTestId('submit-payroll-entry-btn'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborator_name: 'Elena Rostova',
        base_pay: 1500,
        net_total: 1300,
      }),
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking close button or cancel', () => {
    const handleClose = vi.fn();
    render(<ManualPayrollEntryModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByTestId('close-modal-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(<ManualPayrollEntryModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
