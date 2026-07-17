import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { saveOnboardingDraft } from '../api/onboarding';
import {
  clearOnboardingSession,
  getOnboardingCurrentStep,
  getOnboardingSessionId,
  getSelectedTierId,
  setOnboardingCurrentStep,
  setOnboardingSessionId,
  setSelectedTierId,
} from '../lib/onboarding-storage';
import type { OnboardingDraftPayload, OnboardingStep } from '../types/onboarding';
import { OnboardingContext } from './OnboardingContextValue';

interface OnboardingProviderProps {
  children: ReactNode;
  initialStep?: OnboardingStep;
}

export function OnboardingProvider({
  children,
  initialStep = 1,
}: OnboardingProviderProps) {
  const navigate = useNavigate();
  const [sessionId, setSessionIdState] = useState(
    () => getOnboardingSessionId(),
  );
  const [selectedTierId, setSelectedTierIdState] = useState(
    () => getSelectedTierId(),
  );
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    () => getOnboardingCurrentStep() ?? initialStep,
  );

  const setSessionId = useCallback((id: string) => {
    setOnboardingSessionId(id);
    setSessionIdState(id);
  }, []);

  const setSelectedTier = useCallback((tierId: string) => {
    setSelectedTierId(tierId);
    setSelectedTierIdState(tierId);
  }, []);

  const advanceStep = useCallback((step: OnboardingStep) => {
    setOnboardingCurrentStep(step);
    setCurrentStep(step);
  }, []);

  const persistDraft = useCallback(
    async (payload: Omit<OnboardingDraftPayload, 'sessionId'>) => {
      await saveOnboardingDraft({
        sessionId: sessionId ?? undefined,
        step: payload.step ?? currentStep,
        selectedTierId: payload.selectedTierId ?? selectedTierId ?? undefined,
        businessProfile: payload.businessProfile,
        merchantProfile: payload.merchantProfile,
        adminIdentity: payload.adminIdentity,
      });
    },
    [currentStep, selectedTierId, sessionId],
  );

  const exitOnboarding = useCallback(async () => {
    try {
      await saveOnboardingDraft({
        sessionId: sessionId ?? undefined,
        step: currentStep,
        selectedTierId: selectedTierId ?? undefined,
      });
    } catch {
      // Best-effort draft save on exit
    }
    clearOnboardingSession();
    navigate('/login', { replace: true });
  }, [currentStep, navigate, selectedTierId, sessionId]);

  const value = useMemo(
    () => ({
      sessionId,
      selectedTierId,
      currentStep,
      setSessionId,
      setSelectedTier,
      advanceStep,
      persistDraft,
      exitOnboarding,
    }),
    [
      sessionId,
      selectedTierId,
      currentStep,
      setSessionId,
      setSelectedTier,
      advanceStep,
      persistDraft,
      exitOnboarding,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
