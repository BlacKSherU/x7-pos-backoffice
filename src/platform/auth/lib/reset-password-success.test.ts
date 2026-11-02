import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RESET_PASSWORD_SUCCESS_SESSION_KEY,
  consumePasswordResetSuccess,
  markPasswordResetSuccess,
} from '@/platform/auth/lib/reset-password-success';

describe('reset-password-success session helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('marks and consumes a one-time success session flag', () => {
    markPasswordResetSuccess();

    expect(sessionStorage.getItem(RESET_PASSWORD_SUCCESS_SESSION_KEY)).toBe(
      '1',
    );
    expect(consumePasswordResetSuccess()).toBe(true);
    expect(sessionStorage.getItem(RESET_PASSWORD_SUCCESS_SESSION_KEY)).toBeNull();
    expect(consumePasswordResetSuccess()).toBe(false);
  });
});
