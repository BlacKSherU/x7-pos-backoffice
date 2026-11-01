import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/api-error';
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
  evaluatePasswordCriteria,
  isPasswordValid,
  submitResetPasswordRequest,
} from '@/platform/auth/lib/reset-password';

describe('evaluatePasswordCriteria', () => {
  it('flags missing requirements for weak passwords', () => {
    expect(evaluatePasswordCriteria('abc')).toEqual({
      minLength: false,
      uppercase: false,
      numberOrSpecial: false,
    });
  });

  it('accepts passwords that meet all rules', () => {
    const criteria = evaluatePasswordCriteria('Secure1!');
    expect(criteria).toEqual({
      minLength: true,
      uppercase: true,
      numberOrSpecial: true,
    });
    expect(isPasswordValid(criteria)).toBe(true);
  });
});

describe('submitResetPasswordRequest', () => {
  const token = 'valid-reset-token';

  it('blocks submission when token is missing', async () => {
    const resetFn = vi.fn();

    const result = await submitResetPasswordRequest(
      '',
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(result).toEqual({ status: 'missing_token' });
    expect(resetFn).not.toHaveBeenCalled();
  });

  it('blocks submission when password criteria are not met', async () => {
    const resetFn = vi.fn();

    const result = await submitResetPasswordRequest(
      token,
      'short',
      'short',
      resetFn,
    );

    expect(result.status).toBe('validation_error');
    expect(resetFn).not.toHaveBeenCalled();
  });

  it('blocks submission when passwords do not match', async () => {
    const resetFn = vi.fn();

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure2!',
      resetFn,
    );

    expect(result).toEqual({
      status: 'validation_error',
      message: PASSWORD_MISMATCH_MESSAGE,
    });
    expect(resetFn).not.toHaveBeenCalled();
  });

  it('returns success message on HTTP 200', async () => {
    const resetFn = vi.fn().mockResolvedValue({
      message: 'Password updated successfully',
    });

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(resetFn).toHaveBeenCalledWith(token, 'Secure1!');
    expect(result).toEqual({
      status: 'success',
      message: 'Password updated successfully',
    });
  });

  it('falls back to default success message when API message is empty', async () => {
    const resetFn = vi.fn().mockResolvedValue({ message: '' });

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(result).toEqual({
      status: 'success',
      message: RESET_PASSWORD_SUCCESS_MESSAGE,
    });
  });

  it('returns invalid token message on HTTP 410', async () => {
    const resetFn = vi
      .fn()
      .mockRejectedValue(new ApiError('Token expired', 410));

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(result).toEqual({
      status: 'invalid_token',
      message: INVALID_RESET_TOKEN_MESSAGE,
    });
  });

  it('returns invalid token message on HTTP 404', async () => {
    const resetFn = vi
      .fn()
      .mockRejectedValue(new ApiError('Invalid or expired token', 404));

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(result).toEqual({
      status: 'invalid_token',
      message: INVALID_RESET_TOKEN_MESSAGE,
    });
  });

  it('returns API error message for other failures', async () => {
    const resetFn = vi
      .fn()
      .mockRejectedValue(new ApiError('Validation failed', 422));

    const result = await submitResetPasswordRequest(
      token,
      'Secure1!',
      'Secure1!',
      resetFn,
    );

    expect(result).toEqual({
      status: 'error',
      message: 'Validation failed',
    });
  });
});
