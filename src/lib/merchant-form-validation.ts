const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,20}$/;
const TAX_ID_PATTERN = /^[A-Za-z0-9-]{5,20}$/;

export interface MerchantFormValues {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export interface MerchantFormFieldErrors {
  name?: string;
  rut?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export const EMPTY_MERCHANT_FORM: MerchantFormValues = {
  name: '',
  rut: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
};

export function validateMerchantForm(
  values: MerchantFormValues,
): MerchantFormFieldErrors {
  const errors: MerchantFormFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Store name is required.';
  } else if (values.name.trim().length < 2) {
    errors.name = 'Store name must be at least 2 characters.';
  }

  const rut = values.rut.trim();
  if (!rut) {
    errors.rut = 'Tax identification is required.';
  } else if (!TAX_ID_PATTERN.test(rut)) {
    errors.rut = 'Enter a valid tax identification number.';
  }

  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  const phone = values.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
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

export function hasMerchantFormErrors(errors: MerchantFormFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toMerchantPayload(values: MerchantFormValues) {
  return {
    name: values.name.trim(),
    rut: values.rut.trim(),
    email: values.email.trim() || undefined,
    phone: values.phone.trim() || undefined,
    address: values.address.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    country: values.country.trim(),
  };
}
