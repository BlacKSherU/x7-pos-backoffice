import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PayrollEntriesView } from './PayrollEntriesView';

// Mock apiRequest so it does not make real network calls in tests
vi.mock('@/shared/api/http', () => ({
  apiRequest: vi.fn().mockRejectedValue(new Error('Network disabled in unit tests')),
}));

describe('PayrollEntriesView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the complete payroll entries workspace (header, grid, quick launch)', async () => {
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

  it('displays default seed employee records in the grid', async () => {
    render(<PayrollEntriesView />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      expect(screen.getByText('Mateo Morales')).toBeInTheDocument();
      expect(screen.getByText('Sofia Valenzuela')).toBeInTheDocument();
    });
  });

  it('filters grid rows in real-time when typing in header search input', async () => {
    render(<PayrollEntriesView />);

    const searchInput = screen.getByPlaceholderText(/search by collaborator name/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });

    await waitFor(() => {
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      expect(screen.queryByText('Carlos Mendoza')).toBeNull();
      expect(screen.queryByText('Mateo Morales')).toBeNull();
    });
  });

  it('interacts with quick launch operational actions', async () => {
    render(<PayrollEntriesView />);

    const recalculateBtn = screen.getByTestId('quick-action-recalculate');
    expect(recalculateBtn).toBeInTheDocument();

    fireEvent.click(recalculateBtn);

    await waitFor(() => {
      expect(screen.getByTestId('quick-launch-feedback-msg')).toBeInTheDocument();
    });
  });
});
