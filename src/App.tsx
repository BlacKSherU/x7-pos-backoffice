import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RestaurantDashboard } from './components/RestaurantDashboard/RestaurantDashboard';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ResetPasswordSuccessPage } from './pages/ResetPasswordSuccessPage';
import SaaSDashboard from './components/SaaSDashboard/SaaSDashboard';
import { CompanyStepPage } from './pages/onboarding/CompanyStepPage';
import { MerchantStepPage } from './pages/onboarding/MerchantStepPage';
import { OnboardingRoutes } from './pages/onboarding/OnboardingRoutes';
import { SubscriptionStepPage } from './pages/onboarding/SubscriptionStepPage';
import { UserStepPage } from './pages/onboarding/UserStepPage';
import { isAuthenticated } from './lib/auth-storage';

function RootRedirect() {
  return (
    <Navigate replace to={isAuthenticated() ? '/dashboard' : '/login'} />
  );
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/products"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/categories"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/privacy-policy"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/terms-of-service"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/help-center"
          element={
            <ProtectedRoute>
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saas-admin"
          element={<SaaSDashboard />}
        />
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
