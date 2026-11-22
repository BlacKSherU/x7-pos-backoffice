import type { ReceiptItemOption, ReceiptTaxScope } from '../../types/receipt-taxes';

/** `rate` column is decimal(5,2) in the back-end. */
export const RATE_MAX = 999.99;
/** `amount` column is decimal(12,2) in the back-end. */
export const AMOUNT_MAX = 9_999_999_999.99;

export const SCOPE_LABELS: Record<ReceiptTaxScope, string> = {
  RECEIPT: 'Receipt',
  ITEM: 'Item',
};

export const SCOPE_BADGE_CLASSES: Record<ReceiptTaxScope, string> = {
  RECEIPT: 'bg-[#ae001a]/10 text-[#ae001a] border-[#ae001a]/30',
  ITEM: 'bg-sky-50 text-sky-800 border-sky-200',
};

export const SCOPE_ICONS: Record<ReceiptTaxScope, string> = {
  RECEIPT: 'receipt_long',
  ITEM: 'list_alt',
};

/** Amount with 2 decimals plus the ISO currency code, e.g. "1,234.50 USD". */
export function formatMoney(amount: number, currency?: string | null): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency || 'USD'}`;
}

export function formatRate(rate: number): string {
  return `${(Number.isFinite(rate) ? rate : 0).toFixed(2)}%`;
}

export function receiptLabel(receipt: { id: number; invoice_number?: string | null }): string {
  return receipt.invoice_number ? receipt.invoice_number : `Receipt #${receipt.id}`;
}

/** Taxable base of a receipt line: subtotal net of its discount (same rule as the server). */
export function itemTaxableBase(item: Pick<ReceiptItemOption, 'subtotal' | 'discount_amount'>): number {
  return (Math.round(item.subtotal * 100) - Math.round(item.discount_amount * 100)) / 100;
}

/**
 * Preview of the amount the server will calculate: base × rate / 100 rounded half-up to
 * the cent, in integer cents and basis points (no floating point drift).
 */
export function previewTaxAmount(base: number, rate: number): number {
  const baseCents = BigInt(Math.max(0, Math.round((Number.isFinite(base) ? base : 0) * 100)));
  const rateBp = BigInt(Math.round((Number.isFinite(rate) ? rate : 0) * 100));
  return Number((baseCents * rateBp + 5000n) / 10000n) / 100;
}

/** Validates the rate typed in the drawer against decimal(5,2). Returns an error or null. */
export function validateRateInput(raw: string): string | null {
  const text = raw.trim();
  if (!text) return 'Rate is required.';
  if (!/^\d+(\.\d+)?$/.test(text)) return 'Rate must be a positive number (e.g. 19 or 7.5).';
  const [, decimals = ''] = text.split('.');
  if (decimals.length > 2) return 'Rate allows at most 2 decimal places (decimal(5,2)).';
  const value = Number(text);
  if (value > RATE_MAX) return `Rate cannot exceed ${RATE_MAX}% (decimal(5,2)).`;
  return null;
}

/** Error when the previewed amount does not fit decimal(12,2), else null. */
export function validateAmountPreview(amount: number): string | null {
  return amount > AMOUNT_MAX
    ? `Calculated amount exceeds ${AMOUNT_MAX.toLocaleString('en-US')} (decimal(12,2)).`
    : null;
}

export function formatTaxDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}
