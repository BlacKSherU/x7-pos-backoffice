import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { NewPayrollAdjustmentModal } from './NewPayrollAdjustmentModal';
import { apiRequest } from '@/shared/api/http';

vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn(),
}));

describe('NewPayrollAdjustmentModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<NewPayrollAdjustmentModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('new-payroll-adjustment-modal')).toBeNull();
  });

  it('renders correctly with title, fields, and preview strip when isOpen is true', () => {
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={vi.fn()} payrollRunId={3} />);

    expect(screen.getByTestId('new-payroll-adjustment-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /new payroll adjustment/i })).toBeInTheDocument();
    expect(screen.getByTestId('type-option-bonus')).toBeInTheDocument();
    expect(screen.getByTestId('type-option-deduction')).toBeInTheDocument();
    expect(screen.getByTestId('input-adj-collaborator-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-adj-amount')).toBeInTheDocument();
    expect(screen.getByTestId('input-adj-description')).toBeInTheDocument();
    expect(screen.getByTestId('adjustment-preview-strip')).toBeInTheDocument();
  });

  it('allows toggling between BONUS and DEDUCTION types and updates preview', () => {
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={vi.fn()} />);

    // Default is BONUS
    expect(screen.getByTestId('type-option-bonus')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('type-option-deduction')).toHaveAttribute('aria-checked', 'false');

    // Type amount 150
    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '150' } });
    expect(screen.getByTestId('preview-net-impact')).toHaveTextContent('+$150.00');

    // Toggle to DEDUCTION
    fireEvent.click(screen.getByTestId('type-option-deduction'));
    expect(screen.getByTestId('type-option-deduction')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('type-option-bonus')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('preview-net-impact')).toHaveTextContent('-$150.00');
  });

  it('validates that collaborator name is required', async () => {
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('input-adj-description'), { target: { value: 'Bonus' } });
    fireEvent.click(screen.getByTestId('submit-adjustment-btn'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/specify the collaborator name/i);
  });

  it('validates that amount must be greater than 0', async () => {
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('input-adj-collaborator-name'), { target: { value: 'Maria Gomez' } });
    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('input-adj-description'), { target: { value: 'Bonus' } });
    fireEvent.click(screen.getByTestId('submit-adjustment-btn'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/amount greater than 0/i);
  });

  it('validates that description is required', async () => {
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('input-adj-collaborator-name'), { target: { value: 'Maria Gomez' } });
    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByTestId('submit-adjustment-btn'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/description or reason/i);
  });

  it('submits valid adjustment, triggers onSave and closes modal', async () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (typeof path === 'string' && path.includes('/payroll-entries')) {
        return { data: [{ id: 1, collaborator_name: 'Maria Gomez' }] };
      }
      return {
        id: 'ADJ-101',
        collaborator_name: 'Maria Gomez',
        adjustment_type: 'bonus',
        amount: 300,
        description: 'Outstanding performance',
      };
    });

    render(
      <NewPayrollAdjustmentModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        payrollRunId={2}
      />,
    );

    fireEvent.change(screen.getByTestId('input-adj-collaborator-name'), { target: { value: 'Maria Gomez' } });
    fireEvent.change(screen.getByTestId('input-adj-amount'), { target: { value: '300' } });
    fireEvent.change(screen.getByTestId('input-adj-description'), { target: { value: 'Outstanding performance' } });

    fireEvent.click(screen.getByTestId('submit-adjustment-btn'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborator_name: 'Maria Gomez',
        adjustment_type: 'BONUS',
        amount: 300,
        description: 'Outstanding performance',
      }),
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking close button, cancel, or pressing Escape', () => {
    const handleClose = vi.fn();
    render(<NewPayrollAdjustmentModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByTestId('close-modal-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });
});
