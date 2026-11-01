import { ApiError } from '@/shared/lib/api-error';

export type PasswordCriteria = {
  minLength: boolean;
  uppercase: boolean;
  numberOrSpecial: boolean;
};

export const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match';

export const INVALID_RESET_TOKEN_MESSAGE =
  'The password reset link is invalid or has expired.';

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  'Your password has been updated successfully.';

export type ResetPasswordSubmitResult =
  | { status: 'missing_token' }
  | { status: 'validation_error'; message: string }
  | { status: 'success'; message: string }
  | { status: 'invalid_token'; message: string }
  | { status: 'error'; message: string };

export function evaluatePasswordCriteria(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    numberOrSpecial: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordValid(criteria: PasswordCriteria): boolean {
  return (
    criteria.minLength && criteria.uppercase && criteria.numberOrSpecial
  );
}

export function isInvalidResetTokenStatus(status: number): boolean {
  return status === 404 || status === 410;
}

export async function submitResetPasswordRequest(
  token: string,
  newPassword: string,
  confirmPassword: string,
  resetFn: (token: string, newPassword: string) => Promise<{ message: string }>,
): Promise<ResetPasswordSubmitResult> {
  if (!token.trim()) {
    return { status: 'missing_token' };
  }

  const criteria = evaluatePasswordCriteria(newPassword);
  if (!isPasswordValid(criteria)) {
    return {
      status: 'validation_error',
      message: 'Password does not meet security requirements.',
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      status: 'validation_error',
      message: PASSWORD_MISMATCH_MESSAGE,
    };
  }

  try {
    const response = await resetFn(token, newPassword);
    return {
      status: 'success',
      message: response.message || RESET_PASSWORD_SUCCESS_MESSAGE,
    };
  } catch (err) {
    if (err instanceof ApiError && isInvalidResetTokenStatus(err.status)) {
      return {
        status: 'invalid_token',
        message: INVALID_RESET_TOKEN_MESSAGE,
      };
    }

    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Reset failed',
    };
  }
}
