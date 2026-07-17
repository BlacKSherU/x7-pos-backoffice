import { describe, expect, it } from 'vitest';
import {
  formatEinInput,
  hasBusinessProfileErrors,
  validateBusinessProfile,
} from './business-profile-validation';

describe('business-profile-validation', () => {
  const valid = {
    legalBusinessName: 'Acme Restaurant LLC',
    taxId: '12-3456789',
    primaryIndustry: 'Full Service Restaurant',
    registeredAddress: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
  };

  it('accepts valid business profile', () => {
    const errors = validateBusinessProfile(valid);
    expect(hasBusinessProfileErrors(errors)).toBe(false);
  });

  it('formats EIN input', () => {
    expect(formatEinInput('123456789')).toBe('12-3456789');
    expect(formatEinInput('12')).toBe('12');
  });

  it('rejects invalid EIN format', () => {
    const errors = validateBusinessProfile({ ...valid, taxId: '12345' });
    expect(errors.taxId).toBeDefined();
  });

  it('rejects invalid state code', () => {
    const errors = validateBusinessProfile({ ...valid, state: 'NYC' });
    expect(errors.state).toBeDefined();
  });

  it('rejects invalid zip code', () => {
    const errors = validateBusinessProfile({ ...valid, zipCode: 'ABCDE' });
    expect(errors.zipCode).toBeDefined();
  });

  it('accepts zip+4 format', () => {
    const errors = validateBusinessProfile({ ...valid, zipCode: '10001-1234' });
    expect(errors.zipCode).toBeUndefined();
  });
});
