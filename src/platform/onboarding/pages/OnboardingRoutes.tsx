import { Outlet } from 'react-router-dom';
import { ToastProvider } from '@/platform/onboarding/components/Toast';
import { OnboardingProvider } from '@/platform/onboarding/context/OnboardingContext';

export function OnboardingRoutes() {
  return (
    <OnboardingProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </OnboardingProvider>
  );
}
