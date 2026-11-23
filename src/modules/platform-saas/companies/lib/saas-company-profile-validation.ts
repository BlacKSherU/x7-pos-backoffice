import type {
  SaasCompanyProfile,
  SaasCompanyProfilePatch,
  SaasCompanyStatus,
} from '@/modules/platform-saas/companies/types/saas-company';
import { currencyOptionLabel, ISO_4217_CODES } from '@/modules/platform-saas/companies/lib/iso-currencies';

/**
 * Mismo patrón que el backend (`TAX_ID_PATTERN`, src/common/decorators/validation.decorators.ts):
 * letras y dígitos, con puntos, guiones, barras o espacios entre medias y al menos un dígito.
 * Acepta EIN 12-3456789, RUT 12.345.678-K o VAT DE123456789.
 */
export const TAX_ID_PATTERN = /^(?=.*\d)[A-Za-z0-9](?:[A-Za-z0-9.\-/ ]{0,48}[A-Za-z0-9])?$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s\-()]{8,20}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Monedas base admitidas: la lista ISO 4217 completa (iso-currencies.ts), ordenada por código y
 * con su nombre. Coincide con `SUPPORTED_CURRENCIES` del backend.
 */
export const SUPPORTED_CURRENCIES: ReadonlyArray<{ code: string; label: string }> = [...ISO_4217_CODES]
  .sort((a, b) => a.localeCompare(b))
  .map((code) => ({ code, label: currencyOptionLabel(code) }));

const SUPPORTED_CURRENCY_CODES: ReadonlySet<string> = new Set(ISO_4217_CODES);

export const COMPANY_STATUS_OPTIONS: ReadonlyArray<{ value: SaasCompanyStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

export interface SaasCompanyProfileForm {
  legalName: string;
  commercialName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  baseCurrency: string;
  status: string;
}

export type SaasCompanyProfileErrors = Partial<Record<keyof SaasCompanyProfileForm, string>>;

export const SAAS_COMPANY_PROFILE_FIELDS: ReadonlyArray<keyof SaasCompanyProfileForm> = [
  'legalName',
  'commercialName',
  'taxId',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'country',
  'baseCurrency',
  'status',
];

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCY_CODES.has(code);
}

export function isValidTaxId(value: string): boolean {
  return TAX_ID_PATTERN.test(value.trim());
}

export function profileToForm(profile: SaasCompanyProfile): SaasCompanyProfileForm {
  return {
    legalName: profile.legalName ?? '',
    commercialName: profile.commercialName ?? '',
    taxId: profile.taxId ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? '',
    baseCurrency: (profile.baseCurrency ?? '').toUpperCase(),
    status: profile.status ?? 'active',
  };
}

function lengthError(value: string, label: string, max: number): string | undefined {
  return value.length > max ? `${label} must be at most ${max} characters.` : undefined;
}

/** Error de un campo (o undefined). Se usa al escribir (validación en tiempo real) y al enviar. */
export function validateCompanyProfileField(
  field: keyof SaasCompanyProfileForm,
  rawValue: string,
): string | undefined {
  const value = rawValue.trim();
  switch (field) {
    case 'legalName':
      if (!value) return 'Legal name is required.';
      return lengthError(value, 'Legal name', 150);
    case 'commercialName':
      if (!value) return 'Commercial name is required.';
      return lengthError(value, 'Commercial name', 100);
    case 'taxId':
      if (!value) return 'Tax ID is required.';
      if (!isValidTaxId(value)) {
        return 'Enter a valid tax ID: letters and digits separated by dots, hyphens, slashes or spaces (e.g. 12-3456789).';
      }
      return undefined;
    case 'email':
      if (!value) return 'Business email is required.';
      return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid business email address.';
    case 'phone':
      if (!value) return undefined;
      return PHONE_PATTERN.test(value) ? undefined : 'Enter a valid phone number (8-20 digits).';
    case 'address':
      if (!value) return 'Billing address is required.';
      return lengthError(value, 'Billing address', 200);
    case 'city':
      if (!value) return 'City is required.';
      return lengthError(value, 'City', 50);
    case 'state':
      return lengthError(value, 'State', 50);
    case 'country':
      if (!value) return 'Country is required.';
      return lengthError(value, 'Country', 50);
    case 'baseCurrency':
      if (!value) return 'Base currency is required.';
      if (!CURRENCY_PATTERN.test(value) || !isSupportedCurrency(value)) {
        return 'Select a supported ISO 4217 currency (e.g. USD).';
      }
      return undefined;
    case 'status':
      return COMPANY_STATUS_OPTIONS.some((option) => option.value === value)
        ? undefined
        : 'Select a valid account status.';
    default:
      return undefined;
  }
}

export function validateCompanyProfileForm(form: SaasCompanyProfileForm): SaasCompanyProfileErrors {
  const errors: SaasCompanyProfileErrors = {};
  for (const field of SAAS_COMPANY_PROFILE_FIELDS) {
    const error = validateCompanyProfileField(field, form[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export function hasProfileErrors(errors: SaasCompanyProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Cuerpo del PATCH: solo los campos que cambiaron respecto a lo cargado, ya recortados. */
export function buildCompanyProfilePatch(
  initial: SaasCompanyProfileForm,
  form: SaasCompanyProfileForm,
): SaasCompanyProfilePatch {
  const patch: Record<string, string> = {};
  for (const field of SAAS_COMPANY_PROFILE_FIELDS) {
    let next = form[field].trim();
    if (field === 'baseCurrency') next = next.toUpperCase();
    if (next !== initial[field].trim()) patch[field] = next;
  }
  return patch as SaasCompanyProfilePatch;
}
