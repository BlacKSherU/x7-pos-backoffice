const EIN_PATTERN = /^\d{2}-\d{7}$/;
const STATE_PATTERN = /^[A-Z]{2}$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

export interface BusinessProfileFieldErrors {
  legalBusinessName?: string;
  taxId?: string;
  primaryIndustry?: string;
  registeredAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export function formatEinInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function validateBusinessProfile(values: {
  legalBusinessName: string;
  taxId: string;
  primaryIndustry: string;
  registeredAddress: string;
  city: string;
  state: string;
  zipCode: string;
}): BusinessProfileFieldErrors {
  const errors: BusinessProfileFieldErrors = {};

  if (!values.legalBusinessName.trim()) {
    errors.legalBusinessName = 'Legal business name is required.';
  }

  if (!values.taxId.trim()) {
    errors.taxId = 'Tax ID / EIN is required.';
  } else if (!EIN_PATTERN.test(values.taxId.trim())) {
    errors.taxId = 'Enter a valid EIN in 00-0000000 format.';
  }

  if (!values.primaryIndustry.trim()) {
    errors.primaryIndustry = 'Primary industry is required.';
  }

  if (!values.registeredAddress.trim()) {
    errors.registeredAddress = 'Registered address is required.';
  }

  if (!values.city.trim()) {
    errors.city = 'City is required.';
  }

  const state = values.state.trim().toUpperCase();
  if (!state) {
    errors.state = 'State is required.';
  } else if (!STATE_PATTERN.test(state)) {
    errors.state = 'Enter a valid 2-letter state code.';
  }

  if (!values.zipCode.trim()) {
    errors.zipCode = 'Zip code is required.';
  } else if (!ZIP_PATTERN.test(values.zipCode.trim())) {
    errors.zipCode = 'Enter a valid US zip code.';
  }

  return errors;
}

export function hasBusinessProfileErrors(
  errors: BusinessProfileFieldErrors,
): boolean {
  return Object.keys(errors).length > 0;
}

export const EIN_VALIDATION_HINT =
  'Double-check your EIN using your SS-4 tax form guidelines.';
