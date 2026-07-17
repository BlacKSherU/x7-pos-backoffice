import { validateEmail } from './email-validation';
import {
  evaluatePasswordCriteria,
  isPasswordValid,
  PASSWORD_MISMATCH_MESSAGE,
} from './reset-password';

export interface AdminIdentityFieldErrors {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  workEmail?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
}

export function validateAdminIdentity(values: {
  firstName: string;
  lastName: string;
  jobTitle: string;
  workEmail: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}): AdminIdentityFieldErrors {
  const errors: AdminIdentityFieldErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required.';
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  }

  if (!values.jobTitle.trim()) {
    errors.jobTitle = 'Job title is required.';
  }

  const emailError = validateEmail(values.workEmail);
  if (emailError) {
    errors.workEmail = emailError;
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (!isPasswordValid(evaluatePasswordCriteria(values.password))) {
    errors.password = 'Password does not meet security requirements.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = PASSWORD_MISMATCH_MESSAGE;
  }

  if (!values.termsAccepted) {
    errors.termsAccepted =
      'You must accept the Terms of Service and Privacy Policy.';
  }

  return errors;
}

export function hasAdminIdentityErrors(
  errors: AdminIdentityFieldErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
