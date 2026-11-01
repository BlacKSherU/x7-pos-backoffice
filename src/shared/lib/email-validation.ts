const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return 'Email address is required.';
  }

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return 'Enter a valid email address.';
  }

  return undefined;
}
