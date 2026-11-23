import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PayrollNavHub } from './PayrollNavHub';
import { DEFAULT_PAYROLL_NAV_ITEMS } from './payroll-entries-helpers';

describe('PayrollNavHub', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the persistent navigation hub with proper accessibility attributes', () => {
    render(<PayrollNavHub />);

    const nav = screen.getByRole('navigation', { name: /payroll navigation hub/i });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('data-testid', 'payroll-nav-hub');
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('bottom-0');
    expect(nav.className).toContain('border-[#ae001a]');
  });

  it('renders all 4 required navigation tabs with exact labels', () => {
    render(<PayrollNavHub />);

    expect(screen.getByRole('tab', { name: /payroll runs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payroll entries/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payroll adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payroll tax detail/i })).toBeInTheDocument();
  });

  it('renders the required Material Symbols icons for each tab', () => {
    render(<PayrollNavHub />);

    // view_list for PAYROLL RUNS
    const runsTab = screen.getByTestId('nav-tab-payroll-runs');
    expect(runsTab.textContent).toContain('view_list');

    // payments for PAYROLL ENTRIES
    const entriesTab = screen.getByTestId('nav-tab-payroll-entries');
    expect(entriesTab.textContent).toContain('payments');

    // tune for PAYROLL ADJUSTMENTS
    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab.textContent).toContain('tune');

    // receipt_long for PAYROLL TAX DETAIL
    const taxTab = screen.getByTestId('nav-tab-payroll-tax-detail');
    expect(taxTab.textContent).toContain('receipt_long');
  });

  it('highlights PAYROLL ENTRIES as active by default with bold styling and underline indicator', () => {
    render(<PayrollNavHub />);

    const entriesTab = screen.getByTestId('nav-tab-payroll-entries');
    expect(entriesTab).toHaveAttribute('aria-selected', 'true');
    expect(entriesTab).toHaveAttribute('aria-current', 'page');
    expect(entriesTab).toHaveAttribute('data-active', 'true');
    expect(entriesTab.className).toContain('font-bold');

    // Check underline indicator is rendered inside the active tab
    const underline = entriesTab.querySelector('[data-testid="active-tab-underline"]');
    expect(underline).toBeInTheDocument();
    expect(underline?.className).toContain('bg-[#ae001a]');

    // Other tabs should not have the underline indicator
    const runsTab = screen.getByTestId('nav-tab-payroll-runs');
    expect(runsTab).toHaveAttribute('aria-selected', 'false');
    expect(runsTab.querySelector('[data-testid="active-tab-underline"]')).toBeNull();
  });

  it('correctly reflects current route /finance-hr/payrolls/entries', () => {
    render(<PayrollNavHub currentRoute="/finance-hr/payrolls/entries" />);

    const entriesTab = screen.getByTestId('nav-tab-payroll-entries');
    expect(entriesTab).toHaveAttribute('aria-selected', 'true');
    expect(entriesTab.querySelector('[data-testid="active-tab-underline"]')).toBeInTheDocument();

    const indicator = screen.getByTestId('payroll-nav-route-indicator');
    expect(indicator).toHaveTextContent('/finance-hr/payrolls/entries');
  });

  it('correctly reflects route /finance-hr/payrolls/runs', () => {
    render(<PayrollNavHub currentRoute="/finance-hr/payrolls/runs" />);

    const runsTab = screen.getByTestId('nav-tab-payroll-runs');
    expect(runsTab).toHaveAttribute('aria-selected', 'true');
    expect(runsTab.querySelector('[data-testid="active-tab-underline"]')).toBeInTheDocument();

    const entriesTab = screen.getByTestId('nav-tab-payroll-entries');
    expect(entriesTab).toHaveAttribute('aria-selected', 'false');
  });

  it('correctly reflects route /finance-hr/payrolls/adjustments and applies active styling', () => {
    render(<PayrollNavHub currentRoute="/finance-hr/payrolls/adjustments" />);

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(adjustmentsTab).toHaveAttribute('aria-current', 'page');
    expect(adjustmentsTab).toHaveAttribute('data-active', 'true');
    expect(adjustmentsTab.className).toContain('font-bold');
    expect(adjustmentsTab.className).toContain('text-white');

    // Corporate red underline indicator
    const underline = adjustmentsTab.querySelector('[data-testid="active-tab-underline"]');
    expect(underline).toBeInTheDocument();
    expect(underline?.className).toContain('bg-[#ae001a]');

    // Corporate red icon accent
    const icon = adjustmentsTab.querySelector('.material-symbols-outlined');
    expect(icon?.className).toContain('text-[#ae001a]');

    // Other tabs should be inactive
    expect(screen.getByTestId('nav-tab-payroll-runs')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('nav-tab-payroll-entries')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('nav-tab-payroll-tax-detail')).toHaveAttribute('aria-selected', 'false');
  });

  it('highlights PAYROLL ADJUSTMENTS with active styling when activeTab is payroll-adjustments', () => {
    render(<PayrollNavHub activeTab="payroll-adjustments" />);

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(adjustmentsTab).toHaveAttribute('data-active', 'true');
    expect(adjustmentsTab.className).toContain('font-bold');
    expect(adjustmentsTab.querySelector('[data-testid="active-tab-underline"]')).toBeInTheDocument();
  });

  it('normalizes shorthand activeTab or route containing adjustments', () => {
    render(<PayrollNavHub activeTab="adjustments" currentRoute="/dashboard/payroll-adjustments" />);

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(adjustmentsTab.querySelector('[data-testid="active-tab-underline"]')).toBeInTheDocument();
  });

  it('correctly reflects route /finance-hr/payrolls/tax-detail', () => {
    render(<PayrollNavHub currentRoute="/finance-hr/payrolls/tax-detail" />);

    const taxTab = screen.getByTestId('nav-tab-payroll-tax-detail');
    expect(taxTab).toHaveAttribute('aria-selected', 'true');
    expect(taxTab.querySelector('[data-testid="active-tab-underline"]')).toBeInTheDocument();
  });

  it('allows explicit activeTab to override currentRoute', () => {
    render(
      <PayrollNavHub
        currentRoute="/finance-hr/payrolls/entries"
        activeTab="payroll-adjustments"
      />,
    );

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');

    const entriesTab = screen.getByTestId('nav-tab-payroll-entries');
    expect(entriesTab).toHaveAttribute('aria-selected', 'false');
  });

  it('triggers onNavigate and onTabChange when clicking sister tabs without page reload', () => {
    const handleNavigate = vi.fn();
    const handleTabChange = vi.fn();

    render(
      <PayrollNavHub
        onNavigate={handleNavigate}
        onTabChange={handleTabChange}
      />,
    );

    const adjustmentsTab = screen.getByTestId('nav-tab-payroll-adjustments');
    fireEvent.click(adjustmentsTab);

    expect(handleNavigate).toHaveBeenCalledTimes(1);
    expect(handleNavigate).toHaveBeenCalledWith(
      'payroll-adjustments',
      '/finance-hr/payrolls/adjustments',
    );

    expect(handleTabChange).toHaveBeenCalledTimes(1);
    expect(handleTabChange).toHaveBeenCalledWith('payroll-adjustments');
  });

  it('triggers onNavigate with correct path when clicking PAYROLL RUNS', () => {
    const handleNavigate = vi.fn();

    render(<PayrollNavHub onNavigate={handleNavigate} />);

    fireEvent.click(screen.getByTestId('nav-tab-payroll-runs'));

    expect(handleNavigate).toHaveBeenCalledWith(
      'payroll-runs',
      '/finance-hr/payrolls/runs',
    );
  });

  it('triggers onNavigate with correct path when clicking PAYROLL TAX DETAIL', () => {
    const handleNavigate = vi.fn();

    render(<PayrollNavHub onNavigate={handleNavigate} />);

    fireEvent.click(screen.getByTestId('nav-tab-payroll-tax-detail'));

    expect(handleNavigate).toHaveBeenCalledWith(
      'payroll-tax-detail',
      '/finance-hr/payrolls/tax-detail',
    );
  });

  it('renders and invokes back button when onBack is supplied', () => {
    const handleBack = vi.fn();

    render(
      <PayrollNavHub
        onBack={handleBack}
        backLabel="Back to Main Hub"
      />,
    );

    const backBtn = screen.getByTestId('payroll-nav-back-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('aria-label', 'Back to Main Hub');

    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('supports relative positioning when isPersistent is false', () => {
    render(<PayrollNavHub isPersistent={false} />);

    const nav = screen.getByTestId('payroll-nav-hub');
    expect(nav.className).toContain('relative');
    expect(nav.className).not.toContain('fixed');
  });

  it('supports custom className and custom title', () => {
    render(
      <PayrollNavHub
        title="EXECUTIVE PAYROLL"
        className="custom-nav-hub-class"
      />,
    );

    const nav = screen.getByTestId('payroll-nav-hub');
    expect(nav.className).toContain('custom-nav-hub-class');
    expect(screen.getByText('EXECUTIVE PAYROLL')).toBeInTheDocument();
  });

  it('supports custom items array', () => {
    const customItems = [
      ...DEFAULT_PAYROLL_NAV_ITEMS.slice(0, 2),
    ];

    render(<PayrollNavHub items={customItems} />);

    expect(screen.getByTestId('nav-tab-payroll-runs')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tab-payroll-entries')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-tab-payroll-adjustments')).toBeNull();
  });
});
