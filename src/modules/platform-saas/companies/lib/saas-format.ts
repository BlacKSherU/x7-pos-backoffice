export function formatStatusLabel(status: string | null | undefined): string {
  const value = (status ?? '').trim();
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

/** `merchant_admin` → `Merchant Admin`. */
export function formatRoleLabel(role: string | null | undefined): string {
  const value = (role ?? '').trim();
  if (!value) return '—';
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatLocation(...parts: Array<string | null | undefined>): string {
  const text = parts.map((part) => part?.trim()).filter(Boolean).join(', ');
  return text || '—';
}

const PROVIDER_LABELS: Record<string, string> = {
  cardpointe: 'CardPointe',
  stripe: 'Stripe',
  clover: 'Clover',
};

/** Pasarela de cobro de un terminal: `cardpointe` → `CardPointe`. */
export function formatProviderLabel(provider: string | null | undefined): string {
  const value = (provider ?? '').trim();
  if (!value) return '—';
  return PROVIDER_LABELS[value.toLowerCase()] ?? formatStatusLabel(value);
}
