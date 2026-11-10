import { describe, expect, it } from 'vitest';
import {
  buildMerchantPatch,
  hasMerchantErrors,
  isValidTimezone,
  listTimezones,
  validateMerchantProfileField,
  validateMerchantProfileForm,
  type SaasMerchantProfileForm,
} from '@/modules/platform-saas/merchants/lib/saas-merchant-profile-validation';

const FORM: SaasMerchantProfileForm = {
  name: 'Downtown',
  email: 'downtown@acme.com',
  phone: '+1 305 555 0100',
  address: '1 Main Street',
  city: 'Miami',
  state: 'FL',
  country: 'United States',
  timezone: 'America/New_York',
  status: 'active',
};

describe('timezone validation', () => {
  it.each(['America/New_York', 'Europe/Madrid', 'UTC', 'America/Argentina/Buenos_Aires'])('accepts %s', (zone) => {
    expect(isValidTimezone(zone)).toBe(true);
  });

  it.each(['', 'Mars/Olympus', 'GMT+99', 'New York'])('rejects %s', (zone) => {
    expect(isValidTimezone(zone)).toBe(false);
  });

  it('lists IANA zones including UTC', () => {
    const zones = listTimezones();
    expect(zones).toContain('UTC');
    expect(zones).toContain('America/New_York');
  });

  it('reports a required or invalid timezone', () => {
    expect(validateMerchantProfileField('timezone', '')).toBe('Timezone is required.');
    expect(validateMerchantProfileField('timezone', 'Mars/Olympus')).toMatch(/IANA/);
  });
});

describe('validateMerchantProfileForm', () => {
  it('accepts a complete branch', () => {
    expect(hasMerchantErrors(validateMerchantProfileForm(FORM))).toBe(false);
  });

  it('requires name, address, city, country and timezone', () => {
    const errors = validateMerchantProfileForm({ ...FORM, name: '', address: '', city: '', country: '', timezone: '' });
    expect(Object.keys(errors).sort()).toEqual(['address', 'city', 'country', 'name', 'timezone']);
  });

  it('validates optional contact fields only when present', () => {
    expect(validateMerchantProfileForm({ ...FORM, email: '', phone: '' })).toEqual({});
    expect(validateMerchantProfileField('email', 'nope')).toMatch(/valid email/);
    expect(validateMerchantProfileField('phone', '12')).toMatch(/contact number/);
  });

  it('limits the branch name to 100 characters and the status to the enum', () => {
    expect(validateMerchantProfileField('name', 'a'.repeat(101))).toMatch(/100/);
    expect(validateMerchantProfileField('status', 'closed')).toMatch(/status/);
  });
});

describe('buildMerchantPatch', () => {
  it('sends only the changed fields', () => {
    expect(buildMerchantPatch(FORM, { ...FORM, phone: ' +1 305 555 0199 ', timezone: 'America/Chicago' })).toEqual({
      phone: '+1 305 555 0199',
      timezone: 'America/Chicago',
    });
    expect(buildMerchantPatch(FORM, FORM)).toEqual({});
  });
});
