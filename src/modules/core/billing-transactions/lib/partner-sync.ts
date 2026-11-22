import type {
  PartnerAssociation,
  PartnerLinkSource,
  PartnerSyncReceipt,
  PartnerType,
} from '../types/partner-sync';

/** Monto con 2 decimales y código de moneda: `1,234.50 USD`. */
export function formatMoney(amount: number | null | undefined, currency = 'USD'): string {
  const cents = Math.round(Number(amount ?? 0) * 100);
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || 'USD'}`;
}

/** Porcentaje con 2 decimales como máximo: `17.34%`. */
export function formatPercent(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

/** Porcentaje acotado a 0-100 para barras de progreso. */
export function clampPercent(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Número de documento visible: invoice_number o `#<id>`. */
export function receiptLabel(receipt: Pick<PartnerSyncReceipt, 'id' | 'invoice_number'>): string {
  return receipt.invoice_number?.trim() || `#${receipt.id}`;
}

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
};

export const PARTNER_TYPE_ICON: Record<PartnerType, string> = {
  customer: 'person',
  supplier: 'local_shipping',
};

export const LINK_SOURCE_LABEL: Record<PartnerLinkSource, string> = {
  receipt: 'Linked profile',
  order: 'From order',
};

/** Fecha corta legible (`Nov 20, 2026`), o '—' si no es válida. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const ASSOCIATION_LABEL: Record<PartnerAssociation, string> = {
  company: 'Company account',
  merchant: 'Branch only',
};

/** ID positivo escrito por el usuario: número, null si está vacío, 'invalid' si no sirve. */
export function parsePositiveId(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : 'invalid';
}
