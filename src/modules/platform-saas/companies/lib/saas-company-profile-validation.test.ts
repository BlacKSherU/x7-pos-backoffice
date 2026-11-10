import { describe, expect, it } from 'vitest';
import {
  buildCompanyProfilePatch,
  hasProfileErrors,
  isValidTaxId,
  profileToForm,
  SUPPORTED_CURRENCIES,
  validateCompanyProfileField,
  validateCompanyProfileForm,
  type SaasCompanyProfileForm,
} from '@/modules/platform-saas/companies/lib/saas-company-profile-validation';

const FORM: SaasCompanyProfileForm = {
  legalName: 'Acme Holdings LLC',
  commercialName: 'Acme',
  taxId: '12-3456789',
  email: 'hq@acme.com',
  phone: '+1 (555) 000-1000',
  address: '100 Corporate Plaza',
  city: 'Miami',
  state: 'FL',
  country: 'United States',
  baseCurrency: 'USD',
  status: 'active',
};

describe('tax id format', () => {
  it.each(['12-3456789', '12.345.678-K', 'DE123456789', '20-1234567/01', 'A1'])('accepts %s', (value) => {
    expect(isValidTaxId(value)).toBe(true);
  });

  it.each(['', 'ABCDEF', '-123', '123-', '12#34', 'x'.repeat(51) + '1'])('rejects %s', (value) => {
    expect(isValidTaxId(value)).toBe(false);
  });

  it('explains the format when invalid', () => {
    expect(validateCompanyProfileField('taxId', 'ABC')).toMatch(/valid tax ID/);
    expect(validateCompanyProfileField('taxId', ' ')).toBe('Tax ID is required.');
  });
});

describe('validateCompanyProfileForm', () => {
  it('accepts a complete profile', () => {
    expect(hasProfileErrors(validateCompanyProfileForm(FORM))).toBe(false);
  });

  it('requires the mandatory fields', () => {
    const errors = validateCompanyProfileForm({
      ...FORM,
      legalName: '',
      commercialName: '  ',
      taxId: '',
      email: '',
      address: '',
      city: '',
      country: '',
      baseCurrency: '',
    });
    expect(Object.keys(errors).sort()).toEqual(
      ['address', 'baseCurrency', 'city', 'commercialName', 'country', 'email', 'legalName', 'taxId'].sort(),
    );
  });

  it('keeps phone and state optional but validated', () => {
    expect(validateCompanyProfileForm({ ...FORM, phone: '', state: '' })).toEqual({});
    expect(validateCompanyProfileField('phone', 'abc')).toMatch(/phone/);
  });

  it('enforces length limits of the contract', () => {
    expect(validateCompanyProfileField('legalName', 'a'.repeat(151))).toMatch(/150/);
    expect(validateCompanyProfileField('commercialName', 'a'.repeat(101))).toMatch(/100/);
  });

  it('only accepts supported ISO 4217 currencies', () => {
    expect(validateCompanyProfileField('baseCurrency', 'EUR')).toBeUndefined();
    expect(validateCompanyProfileField('baseCurrency', 'usd')).toMatch(/ISO 4217/);
    expect(validateCompanyProfileField('baseCurrency', 'XYZ')).toMatch(/ISO 4217/);
    // the whole ISO 4217 list, not a dozen currencies
    for (const code of ['JPY', 'CHF', 'CNY', 'INR', 'ZAR', 'SEK', 'UYU', 'XAF']) {
      expect(validateCompanyProfileField('baseCurrency', code)).toBeUndefined();
    }
    expect(validateCompanyProfileField('baseCurrency', 'jpy')).toMatch(/ISO 4217/);
    expect(validateCompanyProfileField('baseCurrency', 'XXX')).toMatch(/ISO 4217/);
    expect(validateCompanyProfileField('baseCurrency', 'HRK')).toMatch(/ISO 4217/);
  });

  it('lists every ISO 4217 currency sorted by code, with its name', () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(170);
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toEqual([...codes].sort());
    expect(new Set(codes).size).toBe(codes.length);
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'JPY')?.label).toBe('JPY — Japanese Yen');
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'CHF')?.label).toBe('CHF — Swiss Franc');
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'CLP')?.label).toBe('CLP — Chilean Peso');
  });

  it('only accepts company statuses', () => {
    expect(validateCompanyProfileField('status', 'suspended')).toBeUndefined();
    expect(validateCompanyProfileField('status', 'deleted')).toMatch(/status/);
  });

  it('validates the email format', () => {
    expect(validateCompanyProfileField('email', 'not-an-email')).toMatch(/valid/);
  });
});

describe('buildCompanyProfilePatch', () => {
  it('sends only the changed fields, trimmed', () => {
    expect(buildCompanyProfilePatch(FORM, { ...FORM, legalName: '  Acme Corp  ', baseCurrency: 'eur' })).toEqual({
      legalName: 'Acme Corp',
      baseCurrency: 'EUR',
    });
    expect(buildCompanyProfilePatch(FORM, { ...FORM })).toEqual({});
  });

  it('maps the profile into the form', () => {
    const form = profileToForm({
      id: 1,
      legalName: null,
      commercialName: 'Acme',
      taxId: '1-2',
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      country: null,
      baseCurrency: 'usd',
      status: 'active',
      metrics: { activeMerchantBranches: 0, globalCorporateCustomers: 0, authorizedMasterSuppliers: 0 },
    });
    expect(form.legalName).toBe('');
    expect(form.baseCurrency).toBe('USD');
  });
});
