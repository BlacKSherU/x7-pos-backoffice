// Line math for Receipt Items. Mirrors the back-end (receipt-item-calculation.ts) so the
// drawer can show subtotal/total live while typing; the server recalculates on save.
//
//   subtotal = round2(quantity × unit_price)
//   total    = subtotal − discount_amount
//
// All arithmetic in integer cents (no 0.1 × 3 = 0.30000000000000004 drift).

/** decimal(10,2) */
export const MAX_QUANTITY = 99_999_999.99;
/** decimal(12,2) */
export const MAX_AMOUNT = 9_999_999_999.99;

export interface LineAmountsInput {
  quantity: string;
  unitPrice: string;
  discountAmount: string;
}

export interface LineAmountsErrors {
  quantity?: string;
  unitPrice?: string;
  discountAmount?: string;
}

export interface LineAmounts {
  quantity: number | null;
  unitPrice: number | null;
  discountAmount: number;
  /** null while quantity or unit price are missing/invalid. */
  subtotal: number | null;
  total: number | null;
  errors: LineAmountsErrors;
  isValid: boolean;
}

const DECIMAL_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

/** Number of decimal places typed by the user ("1.50" → 2, "3" → 0). */
export function decimalPlaces(raw: string): number {
  const [, fraction = ''] = raw.trim().split('.');
  return fraction.length;
}

/** Parses a decimal typed in an input. '' → null; garbage → NaN. */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!DECIMAL_PATTERN.test(trimmed)) return Number.NaN;
  return Number.parseFloat(trimmed);
}

/** Integer cents of a number with at most 2 decimals. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** subtotal in cents = round(qCents × pCents / 100), half up (values are ≥ 0). */
export function subtotalCents(quantity: number, unitPrice: number): number {
  return Math.round((toCents(quantity) * toCents(unitPrice)) / 100);
}

export function computeLineAmounts(input: LineAmountsInput): LineAmounts {
  const errors: LineAmountsErrors = {};

  const quantity = parseDecimal(input.quantity);
  if (quantity === null) {
    errors.quantity = 'Quantity is required.';
  } else if (Number.isNaN(quantity)) {
    errors.quantity = 'Quantity must be a number.';
  } else if (decimalPlaces(input.quantity) > 2) {
    errors.quantity = 'Quantity supports at most 2 decimal places.';
  } else if (quantity <= 0) {
    errors.quantity = 'Quantity must be greater than 0.';
  } else if (quantity > MAX_QUANTITY) {
    errors.quantity = `Quantity cannot exceed ${MAX_QUANTITY.toLocaleString('en-US')}.`;
  }

  const unitPrice = parseDecimal(input.unitPrice);
  if (unitPrice === null) {
    errors.unitPrice = 'Unit price is required.';
  } else if (Number.isNaN(unitPrice)) {
    errors.unitPrice = 'Unit price must be a number.';
  } else if (decimalPlaces(input.unitPrice) > 2) {
    errors.unitPrice = 'Unit price supports at most 2 decimal places.';
  } else if (unitPrice < 0) {
    errors.unitPrice = 'Unit price cannot be negative.';
  } else if (unitPrice > MAX_AMOUNT) {
    errors.unitPrice = `Unit price cannot exceed ${MAX_AMOUNT.toLocaleString('en-US')}.`;
  }

  const discountParsed = parseDecimal(input.discountAmount);
  const discountAmount = discountParsed === null ? 0 : discountParsed;
  if (Number.isNaN(discountAmount)) {
    errors.discountAmount = 'Discount must be a number.';
  } else if (decimalPlaces(input.discountAmount) > 2) {
    errors.discountAmount = 'Discount supports at most 2 decimal places.';
  } else if (discountAmount < 0) {
    errors.discountAmount = 'Discount cannot be negative.';
  }

  const amountsUsable = !errors.quantity && !errors.unitPrice && quantity !== null && unitPrice !== null;
  let subtotal: number | null = null;
  let total: number | null = null;

  if (amountsUsable) {
    const sub = subtotalCents(quantity as number, unitPrice as number);
    subtotal = sub / 100;
    if (sub > toCents(MAX_AMOUNT)) {
      errors.unitPrice = 'Quantity × unit price exceeds the maximum line amount.';
    }
    if (!errors.discountAmount) {
      const disc = toCents(discountAmount);
      if (disc > sub) {
        errors.discountAmount = 'Discount cannot be greater than the subtotal.';
      } else {
        total = (sub - disc) / 100;
      }
    }
  }

  return {
    quantity: errors.quantity ? null : quantity,
    unitPrice: errors.unitPrice ? null : unitPrice,
    discountAmount: Number.isNaN(discountAmount) ? 0 : discountAmount,
    subtotal,
    total: Object.keys(errors).length === 0 ? total : null,
    errors,
    isValid: Object.keys(errors).length === 0 && subtotal !== null && total !== null,
  };
}

const MONEY_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Monetary amount with 2 decimals + currency code: `1,234.50 USD`. */
export function formatMoney(amount: number | null | undefined, currency = 'USD'): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${MONEY_FORMAT.format(value)} ${currency || 'USD'}`;
}

/** Amount with 2 decimals and no currency (for compact cells): `1,234.50`. */
export function formatAmount(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return MONEY_FORMAT.format(value);
}

/** Quantity at the column scale (decimal(10,2)): `2.00`, `1.25`. */
export function formatQuantity(quantity: number | null | undefined): string {
  return formatAmount(quantity);
}

/** Label of a receipt in selectors: `INV-000010 · invoice · 26.66 USD` (or `Receipt #11 · …`). */
export function receiptOptionLabel(receipt: {
  id: number;
  type?: string | null;
  grand_total: number;
  currency: string;
  invoice_number?: string | null;
}): string {
  const ref = receipt.invoice_number ? receipt.invoice_number : `Receipt #${receipt.id}`;
  const type = receipt.type ? ` · ${receipt.type}` : '';
  return `${ref}${type} · ${formatMoney(receipt.grand_total, receipt.currency)}`;
}
