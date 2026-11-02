import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from '@/platform/auth/pages/ResetPasswordPage';
import { ResetPasswordSuccessPage } from '@/platform/auth/pages/ResetPasswordSuccessPage';
import * as authApi from '@/platform/auth/api/auth';
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from '@/platform/auth/lib/reset-password';
import { RESET_SUCCESS_HEADING } from '@/platform/auth/lib/reset-password-success';

vi.mock('@/platform/auth/api/auth', () => ({
  resetPassword: vi.fn(),
}));

function renderPage(initialEntry = '/reset-password?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/reset-password/success"
          element={<ResetPasswordSuccessPage />}
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
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

  it('binds password inputs to the required ids', () => {
    renderPage();

    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute(
      'id',
      'new-password',
    );
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      'id',
      'confirm-password',
    );
  });

  it('masks password inputs by default', () => {
    renderPage();

    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('disables submit until password complexity requirements are met', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    const submitButton = screen.getByTestId('reset-password-submit');
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText(/^new password$/i), 'Short1');

    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Minimum 8 characters')).toHaveClass('text-amber-700');

    await user.type(screen.getByLabelText(/^new password$/i), 'erPass!');

    expect(submitButton).toBeEnabled();
  });

  it('blocks submission and shows mismatch validation without calling the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'Secure1!');
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      'Secure2!',
    );
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(authApi.resetPassword).not.toHaveBeenCalled();
    expect(screen.getByText(PASSWORD_MISMATCH_MESSAGE)).toBeInTheDocument();
  });

  it('navigates to the success screen after a valid password update', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(authApi.resetPassword).mockResolvedValue({
      message: 'Password updated successfully',
    });

    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'Secure1!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Secure1!');
    await user.click(screen.getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: RESET_SUCCESS_HEADING }),
      ).toBeInTheDocument();
    });
    expect(sessionStorage.getItem('x7_password_reset_success')).toBeNull();
  });

  it('shows invalid token banner and redirects to forgot password when token is missing', async () => {
    renderPage('/reset-password');

    expect(screen.getByText(INVALID_RESET_TOKEN_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();

    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
    });
  });

  it('handles expired token responses from the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { ApiError } = await import('@/shared/lib/api-error');
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError('Token expired', 410),
    );

    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'Secure1!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Secure1!');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(screen.getByText(INVALID_RESET_TOKEN_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
  });

  it('shows processing state while the API request is in flight', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveRequest: (value: { message: string }) => void = () => {};
    vi.mocked(authApi.resetPassword).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'Secure1!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Secure1!');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByTestId('reset-password-submit')).toBeDisabled();

    resolveRequest({ message: 'Password updated successfully' });

    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    });
  });
});
