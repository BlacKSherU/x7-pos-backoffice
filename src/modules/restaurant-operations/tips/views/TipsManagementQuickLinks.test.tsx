import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TipsManagementQuickLinks } from '@/modules/restaurant-operations/tips/views/TipsManagementQuickLinks';

describe('TipsManagementQuickLinks — Navigation Hub Bar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all 6 tip management shortcut anchors with exact labels and space_dashboard icon', () => {
    render(<TipsManagementQuickLinks activeModule="tips-settlements" />);

    expect(screen.getByTestId('tips-navigation-hub')).toBeInTheDocument();
    expect(screen.getByText('space_dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tips Navigation Hub')).toBeInTheDocument();

    expect(screen.getByTestId('nav-link-tips-ledger')).toHaveTextContent(/tips ledger/i);
    expect(screen.getByTestId('nav-link-tips-pools')).toHaveTextContent(/tip pools/i);
    expect(screen.getByTestId('nav-link-tips-pool-members')).toHaveTextContent(/pool members/i);
    expect(screen.getByTestId('nav-link-tips-allocations')).toHaveTextContent(/tip allocations/i);
    expect(screen.getByTestId('nav-link-tips-settlements')).toHaveTextContent(/tip settlements/i);
    expect(screen.getByTestId('nav-link-tips-cash-movements')).toHaveTextContent(/cash tip movements/i);
  });

  it('highlights the active route context with corporate red styling', () => {
    render(<TipsManagementQuickLinks activeModule="/tips/settlements" />);

    const activeBtn = screen.getByTestId('nav-link-tips-settlements');
    expect(activeBtn).toHaveClass('bg-[#ae001a]');
    expect(activeBtn).toHaveClass('text-white');
  });

  it('triggers onNavigate callback cleanly across all 6 sub-module shortcuts', () => {
    const onNavigate = vi.fn();
    render(<TipsManagementQuickLinks activeModule="tips-settlements" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('nav-link-tips-ledger'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/ledger');

    fireEvent.click(screen.getByTestId('nav-link-tips-pools'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/pools');

    fireEvent.click(screen.getByTestId('nav-link-tips-pool-members'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/pool-members');

    fireEvent.click(screen.getByTestId('nav-link-tips-allocations'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/allocations');

    fireEvent.click(screen.getByTestId('nav-link-tips-settlements'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/settlements');

    fireEvent.click(screen.getByTestId('nav-link-tips-cash-movements'));
    expect(onNavigate).toHaveBeenCalledWith('/tips/cash-movements');
  });
});
