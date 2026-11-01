import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/api-error';
import {
  FORGOT_PASSWORD_RATE_LIMIT_MESSAGE,
  FORGOT_PASSWORD_RESEND_COOLDOWN_MS,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  ensureMinimumLoadingDuration,
  getResendCooldownSeconds,
  submitForgotPasswordRequest,
} from '@/platform/auth/lib/forgot-password';

describe('submitForgotPasswordRequest', () => {
  it('blocks submission when email validation fails', async () => {
    const requestFn = vi.fn();

    const result = await submitForgotPasswordRequest('not-an-email', requestFn);

    expect(result).toEqual({
      status: 'validation_error',
      emailError: 'Enter a valid email address.',
    });
    expect(requestFn).not.toHaveBeenCalled();
  });

  it('returns neutral success message on HTTP 200', async () => {
    const requestFn = vi.fn().mockResolvedValue({
      message: 'Recovery link sent to email.',
    });

    const result = await submitForgotPasswordRequest(
      'chef@x7kitchen.com',
      requestFn,
    );

    expect(requestFn).toHaveBeenCalledWith('chef@x7kitchen.com');
    expect(result).toEqual({
      status: 'success',
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    });
  });

  it('returns neutral success message on HTTP 404 to prevent enumeration', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new ApiError('User not found', 404));

    const result = await submitForgotPasswordRequest(
      'unknown@x7kitchen.com',
      requestFn,
    );

    expect(result).toEqual({
      status: 'success',
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    });
  });

  it('returns a cooldown warning on HTTP 429', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new ApiError('Too Many Requests', 429));

    const result = await submitForgotPasswordRequest(
      'chef@x7kitchen.com',
      requestFn,
    );

    expect(result).toEqual({
      status: 'rate_limited',
      message: FORGOT_PASSWORD_RATE_LIMIT_MESSAGE,
    });
  });

  it('returns a network error when the API is unreachable', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await submitForgotPasswordRequest(
      'chef@x7kitchen.com',
      requestFn,
    );

    expect(result).toEqual({
      status: 'error',
      message:
        'Cannot reach the authentication server. Ensure the backend API is running and try again.',
    });
  });

  it('calculates remaining resend cooldown in seconds', () => {
    const lastSentAt = 1_000;
    const now = lastSentAt + FORGOT_PASSWORD_RESEND_COOLDOWN_MS - 5_000;

    expect(getResendCooldownSeconds(lastSentAt, now)).toBe(5);
    expect(
      getResendCooldownSeconds(lastSentAt, lastSentAt + FORGOT_PASSWORD_RESEND_COOLDOWN_MS),
    ).toBe(0);
  });

  it('waits until the minimum loading duration has elapsed', async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    const pending = ensureMinimumLoadingDuration(startedAt);
    await vi.advanceTimersByTimeAsync(999);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    vi.useRealTimers();
  });

  it('returns a generic error for unexpected API failures', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new ApiError('Internal Server Error', 500));

    const result = await submitForgotPasswordRequest(
      'chef@x7kitchen.com',
      requestFn,
    );

    expect(result).toEqual({
      status: 'error',
      message: 'Internal Server Error',
    });
  });
});
