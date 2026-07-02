import { describe, expect, it } from 'vitest';
import {
  EMPTY_COMPANY_FORM,
  hasCompanyFormErrors,
  validateCompanyForm,
} from './company-form-validation';

describe('validateCompanyForm', () => {
  it('returns no errors for valid company data', () => {
    const errors = validateCompanyForm({
      ...EMPTY_COMPANY_FORM,
      name: 'Acme Corp',
      rut: '12.345.678-9',
      email: 'contact@acme.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street, Suite 100',
      city: 'Miami',
      state: 'Florida',
      country: 'USA',
    });

    expect(hasCompanyFormErrors(errors)).toBe(false);
  });

  it('requires mandatory contact and localization fields', () => {
    const errors = validateCompanyForm(EMPTY_COMPANY_FORM);

    expect(errors.name).toBeDefined();
    expect(errors.rut).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.address).toBeDefined();
    expect(errors.city).toBeDefined();
    expect(errors.state).toBeDefined();
    expect(errors.country).toBeDefined();
    expect(hasCompanyFormErrors(errors)).toBe(true);
  });

  it('rejects invalid email format', () => {
    const errors = validateCompanyForm({
      ...EMPTY_COMPANY_FORM,
      name: 'Acme Corp',
      rut: '12.345.678-9',
      email: 'not-an-email',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street, Suite 100',
      city: 'Miami',
      state: 'Florida',
      country: 'USA',
    });

    expect(errors.email).toBeDefined();
  });
});
