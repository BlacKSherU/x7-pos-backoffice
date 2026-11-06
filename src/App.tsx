import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/platform/auth/components/ProtectedRoute';
import { MerchantFrame } from '@/platform/merchant-frame/MerchantFrame';
import { MERCHANT_ROUTE_PATHS } from '@/platform/merchant-frame/merchant-routes';
import { ForgotPasswordPage } from '@/platform/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/platform/auth/pages/LoginPage';
import { ResetPasswordPage } from '@/platform/auth/pages/ResetPasswordPage';
import { ResetPasswordSuccessPage } from '@/platform/auth/pages/ResetPasswordSuccessPage';
import { CompanyStepPage } from '@/platform/onboarding/pages/CompanyStepPage';
import { MerchantStepPage } from '@/platform/onboarding/pages/MerchantStepPage';
import { OnboardingRoutes } from '@/platform/onboarding/pages/OnboardingRoutes';
import { SubscriptionStepPage } from '@/platform/onboarding/pages/SubscriptionStepPage';
import { UserStepPage } from '@/platform/onboarding/pages/UserStepPage';
import { isAuthenticated } from '@/platform/auth/lib/auth-storage';

function RootRedirect() {
  if (!isAuthenticated()) {
    return <Navigate replace to="/login" />;
  }
  return <Navigate replace to="/dashboard" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/reset-password/success"
          element={<ResetPasswordSuccessPage />}
        />
        <Route element={<OnboardingRoutes />}>
          <Route path="/register" element={<SubscriptionStepPage />} />
          <Route path="/register/company" element={<CompanyStepPage />} />
          <Route path="/register/merchant" element={<MerchantStepPage />} />
          <Route path="/register/user" element={<UserStepPage />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        >
          {MERCHANT_ROUTE_PATHS.map((path) => (
            <Route key={path} path={path} element={<></>} />
          ))}
        </Route>
        {/* Legacy URL: Platform SaaS now lives inside the unified backoffice shell. */}
        <Route path="/saas-admin" element={<Navigate replace to="/dashboard" />} />
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
