const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{8,20}$/;
const NAME_PATTERN = /^[a-zA-Z0-9\s\-.&]+$/;
const LOCATION_PATTERN = /^[a-zA-Z\s\-.]+$/;

export interface CompanyFormValues {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export interface CompanyFormFieldErrors {
  name?: string;
  rut?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export const EMPTY_COMPANY_FORM: CompanyFormValues = {
  name: '',
  rut: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
};

export function validateCompanyForm(
  values: CompanyFormValues,
): CompanyFormFieldErrors {
  const errors: CompanyFormFieldErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Company name is required.';
  } else if (name.length < 2 || name.length > 100) {
    errors.name = 'Company name must be between 2 and 100 characters.';
  } else if (!NAME_PATTERN.test(name)) {
    errors.name =
      'Company name can only contain letters, numbers, spaces, hyphens, dots and ampersands.';
  }

  const rut = values.rut.trim();
  if (!rut) {
    errors.rut = 'Tax registration (RUT) is required.';
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Business email is required.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid business email address.';
  }

  const phone = values.phone.trim();
  if (!phone) {
    errors.phone = 'Business phone is required.';
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  const address = values.address.trim();
  if (!address) {
    errors.address = 'Address is required.';
  } else if (address.length < 10 || address.length > 200) {
    errors.address = 'Address must be between 10 and 200 characters.';
  }

  const city = values.city.trim();
  if (!city) {
    errors.city = 'City is required.';
  } else if (city.length < 2 || city.length > 50) {
    errors.city = 'City must be between 2 and 50 characters.';
  } else if (!LOCATION_PATTERN.test(city)) {
    errors.city = 'City can only contain letters, spaces, hyphens and dots.';
  }

  const state = values.state.trim();
  if (!state) {
    errors.state = 'State is required.';
  } else if (state.length < 2 || state.length > 50) {
    errors.state = 'State must be between 2 and 50 characters.';
  } else if (!LOCATION_PATTERN.test(state)) {
    errors.state = 'State can only contain letters, spaces, hyphens and dots.';
  }

  const country = values.country.trim();
  if (!country) {
    errors.country = 'Country is required.';
  } else if (country.length < 2 || country.length > 50) {
    errors.country = 'Country must be between 2 and 50 characters.';
  } else if (!LOCATION_PATTERN.test(country)) {
    errors.country = 'Country can only contain letters, spaces, hyphens and dots.';
  }

  return errors;
}

export function hasCompanyFormErrors(errors: CompanyFormFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toCompanyPayload(
  values: CompanyFormValues,
): CompanyFormValues {
  return {
    name: values.name.trim(),
    rut: values.rut.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    country: values.country.trim(),
  };
}
