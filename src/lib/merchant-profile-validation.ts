import { validateEmail } from './email-validation';

const PHONE_PATTERN = /^[+]?[\d\s().-]{7,20}$/;

export interface MerchantProfileFieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export function validateMerchantProfile(values: {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
}): MerchantProfileFieldErrors {
  const errors: MerchantProfileFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Store name is required.';
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const trimmedPhone = values.phone?.trim() ?? '';
  if (trimmedPhone && !PHONE_PATTERN.test(trimmedPhone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (!values.address.trim()) {
    errors.address = 'Address is required.';
  }

  if (!values.city.trim()) {
    errors.city = 'City is required.';
  }

  if (!values.state.trim()) {
    errors.state = 'State is required.';
  }

  if (!values.country.trim()) {
    errors.country = 'Country is required.';
  }

  return errors;
}

export function hasMerchantProfileErrors(
  errors: MerchantProfileFieldErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
