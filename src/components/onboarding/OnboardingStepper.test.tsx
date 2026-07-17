import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OnboardingStepper } from './OnboardingStepper';

describe('OnboardingStepper', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows active step label', () => {
    render(
      <OnboardingStepper
        currentStep={2}
        subtitle="Step 2 of 4: Business Profile"
      />,
    );
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4: Business Profile')).toBeInTheDocument();
  });

  it('shows checkmark for completed steps', () => {
    render(<OnboardingStepper currentStep={3} />);
    const checks = screen.getAllByText('check');
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it('renders a larger active step circle', () => {
    const { container } = render(<OnboardingStepper currentStep={2} />);
    expect(container.querySelector('.w-11.h-11')).toBeTruthy();
  });
});
