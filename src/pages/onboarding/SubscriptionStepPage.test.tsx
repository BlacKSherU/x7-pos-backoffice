import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionStepPage } from './SubscriptionStepPage';
import { OnboardingRoutes } from './OnboardingRoutes';
import * as onboardingApi from '../../api/onboarding';

vi.mock('../../api/onboarding', () => ({
  getSubscriptionTiers: vi.fn(),
  selectSubscription: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

const mockTiers = [
  {
    id: 'essential',
    name: 'Essential',
    badge: 'Quick Service',
    price: '$69 / MONTH',
    features: ['Up to 2 Standard Terminals'],
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Full Restaurant',
    price: '$149 / MONTH',
    recommended: true,
    features: ['Unlimited Terminals'],
  },
  {
    id: 'executive',
    name: 'Executive',
    badge: 'Enterprise',
    price: 'Custom',
    priceLabel: 'ANNUAL BILLING',
    isCustom: true,
    features: ['Multi-Location Global Sync'],
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route element={<OnboardingRoutes />}>
          <Route path="/register" element={<SubscriptionStepPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubscriptionStepPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(onboardingApi.getSubscriptionTiers).mockResolvedValue(mockTiers);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads tiers and pre-selects Professional', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Plan Selected')).toBeInTheDocument();
    });
    expect(onboardingApi.getSubscriptionTiers).toHaveBeenCalled();
  });

  it('allows changing plan selection', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select Essential' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select Essential' }));
    expect(screen.getByText('Plan Selected')).toBeInTheDocument();
  });

  it('opens contact sales modal for Executive plan', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Contact Sales' })).toBeInTheDocument();
    });

    const executiveCards = screen.getAllByRole('button', { name: /executive/i });
    await user.click(executiveCards[0]);
    await user.click(
      screen.getByRole('button', { name: /contact sales/i }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onboardingApi.selectSubscription).not.toHaveBeenCalled();
  });

  it('shows retry on load failure', async () => {
    vi.mocked(onboardingApi.getSubscriptionTiers).mockRejectedValueOnce(
      new Error('fail'),
    );
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load subscription plans/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
