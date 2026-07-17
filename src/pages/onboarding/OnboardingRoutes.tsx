import { Outlet } from 'react-router-dom';
import { ToastProvider } from '../../components/onboarding/Toast';
import { OnboardingProvider } from '../../context/OnboardingContext';

export function OnboardingRoutes() {
  return (
    <OnboardingProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </OnboardingProvider>
  );
}
