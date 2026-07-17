import { createContext } from 'react';
import type {
  OnboardingDraftPayload,
  OnboardingStep,
} from '../types/onboarding';

export interface OnboardingContextValue {
  sessionId: string | null;
  selectedTierId: string | null;
  currentStep: OnboardingStep;
  setSessionId: (id: string) => void;
  setSelectedTier: (tierId: string) => void;
  advanceStep: (step: OnboardingStep) => void;
  persistDraft: (
    payload: Omit<OnboardingDraftPayload, 'sessionId'>,
  ) => Promise<void>;
  exitOnboarding: () => Promise<void>;
}

export const OnboardingContext =
  createContext<OnboardingContextValue | null>(null);
