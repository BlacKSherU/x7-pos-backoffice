import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOnboardingStepRoute } from '../lib/onboarding-routes';
import {
  getMaxAllowedStep,
  getOnboardingSessionId,
} from '../lib/onboarding-storage';
import type { OnboardingStep } from '../types/onboarding';

export function useOnboardingGuard(requiredStep: OnboardingStep): void {
  const navigate = useNavigate();

  useEffect(() => {
    const maxAllowed = getMaxAllowedStep();

    if (requiredStep > 1 && !getOnboardingSessionId()) {
      navigate(getOnboardingStepRoute(1), { replace: true });
      return;
    }

    if (requiredStep > maxAllowed) {
      navigate(getOnboardingStepRoute(maxAllowed), { replace: true });
    }
  }, [navigate, requiredStep]);
}
