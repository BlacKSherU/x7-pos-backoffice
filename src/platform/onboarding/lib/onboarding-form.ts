export function onboardingFieldClass(hasError: boolean): string {
  const base =
    'w-full px-4 py-3 border rounded-lg text-body-md text-text focus:ring-1 outline-none bg-white transition-all';
  return hasError
    ? `${base} border-error focus:ring-error focus:border-error`
    : `${base} border-border focus:ring-text focus:border-text`;
}
