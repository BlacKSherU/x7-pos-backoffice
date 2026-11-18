import type {
  SaasMerchantPatch,
  SaasMerchantProfile,
  SaasMerchantStatus,
} from '@/modules/platform-saas/merchants/types/saas-merchant';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;

export const MERCHANT_STATUS_OPTIONS: ReadonlyArray<{ value: SaasMerchantStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/Santo_Domingo',
  'Europe/London',
  'Europe/Madrid',
];

/** Zona IANA válida para el motor JS (el backend valida con `IsTimeZone`). */
export function isValidTimezone(value: string): boolean {
  const zone = value.trim();
  if (!zone || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Opciones del selector de zona horaria (todas las que conoce el navegador). */
export function listTimezones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones.includes('UTC') ? zones : ['UTC', ...zones];
  } catch {
    // Motores antiguos: lista corta.
  }
  return FALLBACK_TIMEZONES;
}

export interface SaasMerchantProfileForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  status: string;
}

export type SaasMerchantProfileErrors = Partial<Record<keyof SaasMerchantProfileForm, string>>;

export const SAAS_MERCHANT_PROFILE_FIELDS: ReadonlyArray<keyof SaasMerchantProfileForm> = [
  'name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'country',
  'timezone',
  'status',
];

export function merchantToForm(merchant: SaasMerchantProfile): SaasMerchantProfileForm {
  return {
    name: merchant.name ?? '',
    email: merchant.email ?? '',
    phone: merchant.phone ?? '',
    address: merchant.address ?? '',
    city: merchant.city ?? '',
    state: merchant.state ?? '',
    country: merchant.country ?? '',
    timezone: merchant.timezone ?? '',
    status: merchant.status ?? 'active',
  };
}

function lengthError(value: string, label: string, max: number): string | undefined {
  return value.length > max ? `${label} must be at most ${max} characters.` : undefined;
}

export function validateMerchantProfileField(
  field: keyof SaasMerchantProfileForm,
  rawValue: string,
): string | undefined {
  const value = rawValue.trim();
  switch (field) {
    case 'name':
      if (!value) return 'Branch name is required.';
      return lengthError(value, 'Branch name', 100);
    case 'email':
      if (!value) return undefined;
      return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid email address.';
    case 'phone':
      if (!value) return undefined;
      return PHONE_PATTERN.test(value) ? undefined : 'Enter a valid contact number (7-20 digits).';
    case 'address':
      if (!value) return 'Physical address is required.';
      return lengthError(value, 'Physical address', 200);
    case 'city':
      if (!value) return 'City is required.';
      return lengthError(value, 'City', 50);
    case 'state':
      return lengthError(value, 'State', 50);
    case 'country':
      if (!value) return 'Country is required.';
      return lengthError(value, 'Country', 50);
    case 'timezone':
      if (!value) return 'Timezone is required.';
      return isValidTimezone(value) ? undefined : 'Select a valid IANA timezone (e.g. America/New_York).';
    case 'status':
      return MERCHANT_STATUS_OPTIONS.some((option) => option.value === value)
        ? undefined
        : 'Select a valid operational status.';
    default:
      return undefined;
  }
}

export function validateMerchantProfileForm(form: SaasMerchantProfileForm): SaasMerchantProfileErrors {
  const errors: SaasMerchantProfileErrors = {};
  for (const field of SAAS_MERCHANT_PROFILE_FIELDS) {
    const error = validateMerchantProfileField(field, form[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export function hasMerchantErrors(errors: SaasMerchantProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Cuerpo del PATCH: solo los campos que cambiaron, ya recortados. */
export function buildMerchantPatch(
  initial: SaasMerchantProfileForm,
  form: SaasMerchantProfileForm,
): SaasMerchantPatch {
  const patch: Record<string, string> = {};
  for (const field of SAAS_MERCHANT_PROFILE_FIELDS) {
    const next = form[field].trim();
    if (next !== initial[field].trim()) patch[field] = next;
  }
  return patch as SaasMerchantPatch;
}
