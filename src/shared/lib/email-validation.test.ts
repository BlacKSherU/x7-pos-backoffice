import { describe, expect, it } from 'vitest';
import { validateEmail } from '@/shared/lib/email-validation';

describe('validateEmail', () => {
  it('returns an error when email is empty', () => {
    expect(validateEmail('')).toBe('Email address is required.');
    expect(validateEmail('   ')).toBe('Email address is required.');
  });

  it('returns an error for invalid email format', () => {
    expect(validateEmail('invalid-email')).toBe('Enter a valid email address.');
    expect(validateEmail('user@')).toBe('Enter a valid email address.');
    expect(validateEmail('@domain.com')).toBe('Enter a valid email address.');
  });

  it('returns undefined for a valid email', () => {
    expect(validateEmail('chef@x7kitchen.com')).toBeUndefined();
    expect(validateEmail('  chef@x7kitchen.com  ')).toBeUndefined();
  });
});
