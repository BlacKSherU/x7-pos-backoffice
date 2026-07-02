import { describe, expect, it } from 'vitest';
import {
  EMPTY_MERCHANT_FORM,
  hasMerchantFormErrors,
  toMerchantPayload,
  validateMerchantForm,
} from './merchant-form-validation';

describe('merchant-form-validation', () => {
  const valid = {
    ...EMPTY_MERCHANT_FORM,
    name: 'Downtown Bistro',
    rut: '12-3456789',
    email: 'contact@store.com',
    phone: '+1 (555) 000-0000',
    address: '123 Main Street',
    city: 'Miami',
    state: 'Florida',
    country: 'USA',
  };

  it('accepts a valid merchant form', () => {
    const errors = validateMerchantForm(valid);
    expect(hasMerchantFormErrors(errors)).toBe(false);
  });

  it('requires mandatory fields', () => {
    const errors = validateMerchantForm(EMPTY_MERCHANT_FORM);
    expect(errors.name).toBeDefined();
    expect(errors.rut).toBeDefined();
    expect(errors.address).toBeDefined();
    expect(errors.city).toBeDefined();
    expect(errors.state).toBeDefined();
    expect(errors.country).toBeDefined();
  });

  it('validates optional email and phone when provided', () => {
    const errors = validateMerchantForm({
      ...valid,
      email: 'invalid-email',
      phone: '!!!',
    });
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  it('omits blank optional contact fields from payload', () => {
    const payload = toMerchantPayload({
      ...valid,
      email: '',
      phone: '   ',
    });
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });
});
