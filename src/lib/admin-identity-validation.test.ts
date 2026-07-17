import { describe, expect, it } from 'vitest';
import {
  hasAdminIdentityErrors,
  validateAdminIdentity,
} from './admin-identity-validation';

describe('admin-identity-validation', () => {
  const valid = {
    firstName: 'Julian',
    lastName: 'Chen',
    jobTitle: 'Operations Director',
    workEmail: 'admin@restaurant.com',
    password: 'Secure1!',
    confirmPassword: 'Secure1!',
    termsAccepted: true,
  };

  it('accepts valid admin identity', () => {
    const errors = validateAdminIdentity(valid);
    expect(hasAdminIdentityErrors(errors)).toBe(false);
  });

  it('blocks submit without terms acceptance', () => {
    const errors = validateAdminIdentity({ ...valid, termsAccepted: false });
    expect(errors.termsAccepted).toBeDefined();
    expect(hasAdminIdentityErrors(errors)).toBe(true);
  });

  it('requires work email', () => {
    const errors = validateAdminIdentity({ ...valid, workEmail: 'invalid' });
    expect(errors.workEmail).toBeDefined();
  });

  it('requires matching passwords', () => {
    const errors = validateAdminIdentity({
      ...valid,
      confirmPassword: 'Different1!',
    });
    expect(errors.confirmPassword).toBeDefined();
  });

  it('requires strong password', () => {
    const errors = validateAdminIdentity({
      ...valid,
      password: 'weak',
      confirmPassword: 'weak',
    });
    expect(errors.password).toBeDefined();
  });
});
