import { ApiError } from '@/shared/lib/api-error';
import { validateEmail } from '@/shared/lib/email-validation';

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  'If the email matches an active account, a recovery link has been sent.';

export const FORGOT_PASSWORD_RATE_LIMIT_MESSAGE =
  'Too many requests. Please wait a few minutes before trying again.';

export const FORGOT_PASSWORD_GENERIC_ERROR_MESSAGE =
  'Unable to process your request right now. Please try again later.';

export const FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE =
  'Cannot reach the authentication server. Ensure the backend API is running and try again.';

export const FORGOT_PASSWORD_SEND_FEEDBACK_MESSAGE =
  'Reset link sent successfully.';

export const FORGOT_PASSWORD_MIN_LOADING_MS = 1_000;

export const FORGOT_PASSWORD_RESEND_COOLDOWN_MS = 30_000;

export function getResendCooldownSeconds(
  lastSentAt: number | null,
  now = Date.now(),
): number {
  if (lastSentAt === null) {
    return 0;
  }

  const remainingMs = lastSentAt + FORGOT_PASSWORD_RESEND_COOLDOWN_MS - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export async function ensureMinimumLoadingDuration(
  startedAt: number,
  minMs = FORGOT_PASSWORD_MIN_LOADING_MS,
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
}

export type ForgotPasswordSubmitResult =
  | { status: 'validation_error'; emailError: string }
  | { status: 'success'; message: string }
  | { status: 'rate_limited'; message: string }
  | { status: 'error'; message: string };

export async function submitForgotPasswordRequest(
  email: string,
  requestFn: (normalizedEmail: string) => Promise<{ message: string }>,
): Promise<ForgotPasswordSubmitResult> {
  const emailError = validateEmail(email);
  if (emailError) {
    return { status: 'validation_error', emailError };
  }

  const normalizedEmail = email.trim();

  try {
    await requestFn(normalizedEmail);
    return { status: 'success', message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return { status: 'success', message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
      }
      if (err.status === 429) {
        return {
          status: 'rate_limited',
          message: FORGOT_PASSWORD_RATE_LIMIT_MESSAGE,
        };
      }
    }

    const isNetworkFailure =
      err instanceof TypeError ||
      (err instanceof Error &&
        /failed to fetch|network|connection refused/i.test(err.message));

    return {
      status: 'error',
      message: isNetworkFailure
        ? FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE
        : err instanceof Error
          ? err.message
          : FORGOT_PASSWORD_GENERIC_ERROR_MESSAGE,
    };
  }
}
