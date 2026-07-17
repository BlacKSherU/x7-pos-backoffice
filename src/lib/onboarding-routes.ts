import type { OnboardingStep } from '../types/onboarding';

const STEP_ROUTES: Record<OnboardingStep, string> = {
  1: '/register',
  2: '/register/company',
  3: '/register/merchant',
  4: '/register/user',
};

export function getOnboardingStepRoute(step: OnboardingStep): string {
  return STEP_ROUTES[step];
}
