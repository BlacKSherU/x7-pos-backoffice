import type { OnboardingStep } from '../types/onboarding';

const SESSION_ID_KEY = 'x7_onboarding_session_id';
const SELECTED_TIER_KEY = 'x7_onboarding_selected_tier';
const CURRENT_STEP_KEY = 'x7_onboarding_current_step';

export function getOnboardingSessionId(): string | null {
  return sessionStorage.getItem(SESSION_ID_KEY);
}

export function setOnboardingSessionId(sessionId: string): void {
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
}

export function getSelectedTierId(): string | null {
  return sessionStorage.getItem(SELECTED_TIER_KEY);
}

export function setSelectedTierId(tierId: string): void {
  sessionStorage.setItem(SELECTED_TIER_KEY, tierId);
}

export function getOnboardingCurrentStep(): OnboardingStep | null {
  const raw = sessionStorage.getItem(CURRENT_STEP_KEY);
  if (!raw) return null;
  const step = Number(raw);
  if (step >= 1 && step <= 4) {
    return step as OnboardingStep;
  }
  return null;
}

export function setOnboardingCurrentStep(step: OnboardingStep): void {
  sessionStorage.setItem(CURRENT_STEP_KEY, String(step));
}

export function clearOnboardingSession(): void {
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SELECTED_TIER_KEY);
  sessionStorage.removeItem(CURRENT_STEP_KEY);
}

export function getMaxAllowedStep(): OnboardingStep {
  const step = getOnboardingCurrentStep();
  return step ?? 1;
}
