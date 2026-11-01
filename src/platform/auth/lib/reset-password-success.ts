export const RESET_SUCCESS_HEADING = 'Success!';

export const RESET_SUCCESS_SUBTITLE =
  'Your password has been successfully updated. You can now use your new password to sign in to your dashboard.';

export const RESET_SUCCESS_REDIRECT_DELAY_MS = 5000;

export const SECURE_AUTH_BUILD_SIGNATURE = 'X7_SECURE_AUTH_v4.0';

export const RESET_PASSWORD_SUCCESS_PATH = '/reset-password/success';

export const RESET_PASSWORD_SUCCESS_SESSION_KEY = 'x7_password_reset_success';

export function markPasswordResetSuccess(): void {
  sessionStorage.setItem(RESET_PASSWORD_SUCCESS_SESSION_KEY, '1');
}

export function consumePasswordResetSuccess(): boolean {
  const allowed =
    sessionStorage.getItem(RESET_PASSWORD_SUCCESS_SESSION_KEY) === '1';
  if (allowed) {
    sessionStorage.removeItem(RESET_PASSWORD_SUCCESS_SESSION_KEY);
  }
  return allowed;
}
