import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordSuccessPage } from '@/platform/auth/pages/ResetPasswordSuccessPage';
import {
  RESET_SUCCESS_HEADING,
  RESET_SUCCESS_SUBTITLE,
  SECURE_AUTH_BUILD_SIGNATURE,
  markPasswordResetSuccess,
} from '@/platform/auth/lib/reset-password-success';

function renderSuccessPage(authorized = true) {
  if (authorized) {
    markPasswordResetSuccess();
  }

  return render(
    <MemoryRouter initialEntries={['/reset-password/success']}>
      <Routes>
        <Route
          path="/reset-password/success"
          element={<ResetPasswordSuccessPage />}
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPasswordSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('renders success heading and instructional subtitle', () => {
    renderSuccessPage();

    expect(
      screen.getByRole('heading', { name: RESET_SUCCESS_HEADING }),
    ).toBeInTheDocument();
    expect(screen.getByText(RESET_SUCCESS_SUBTITLE)).toBeInTheDocument();
  });

  it('exposes the secure auth build signature metadata', () => {
    renderSuccessPage();

    expect(screen.getByTestId('secure-auth-signature')).toHaveTextContent(
      SECURE_AUTH_BUILD_SIGNATURE,
    );
  });

  it('navigates to login when Back to Login is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSuccessPage();

    await user.click(screen.getByTestId('reset-success-back-to-login'));

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to login automatically after 5 seconds', async () => {
    renderSuccessPage();

    await vi.advanceTimersByTimeAsync(5000);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('redirects unauthorized direct visits to login', async () => {
    renderSuccessPage(false);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('keeps the user on the success view when the browser back action fires', async () => {
    renderSuccessPage();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(
      screen.getByRole('heading', { name: RESET_SUCCESS_HEADING }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
