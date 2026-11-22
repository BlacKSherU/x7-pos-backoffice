import type {
  AdjustmentNoteType,
  AdjustmentReasonCode,
  ReceiptAdjustmentSummary,
} from '../types/receipt-adjustments';
import type { Receipt } from '../types/receipts';
import { toCents } from './receipt-fiscal';
import { formatMoney } from './receipts-format';

/**
 * Notas de ajuste (Historia 7): etiquetas y validación del formulario "ISSUE ADJUSTMENT NOTE",
 * con las mismas reglas que el back-end (receipt-adjustments.util.ts).
 */
export const ADJUSTMENT_NOTE_TYPE_LABELS: Record<AdjustmentNoteType, string> = {
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
};

export const ADJUSTMENT_NOTE_TYPE_HINTS: Record<AdjustmentNoteType, string> = {
  CREDIT_NOTE: 'Reduces the net amount owed (refunds, returns, price reductions).',
  DEBIT_NOTE: 'Increases the net amount owed (missed charges, upward corrections).',
};

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReasonCode, string> = {
  REFUND: 'Refund',
  PARTIAL_RETURN: 'Partial return',
  PRICE_CORRECTION: 'Price correction',
  BILLING_ERROR: 'Billing error',
  DISCOUNT_ADJUSTMENT: 'Discount adjustment',
  MISSED_CHARGE: 'Missed charge',
  OTHER: 'Other',
};

export const ADJUSTMENT_REASON_CODES = Object.keys(ADJUSTMENT_REASON_LABELS) as AdjustmentReasonCode[];

/** Solo los recibos bloqueados (y activos) admiten notas de ajuste. */
export function canIssueAdjustment(receipt: Pick<Receipt, 'is_locked' | 'is_active'>): boolean {
  return receipt.is_locked && receipt.is_active;
}

export interface AdjustmentFormState {
  noteType: AdjustmentNoteType;
  amount: string;
  reasonCode: AdjustmentReasonCode | '';
}

export interface AdjustmentFormErrors {
  amount?: string;
  reasonCode?: string;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Valida el formulario: importe > 0 con hasta 2 decimales, ≤ grand_total del recibo y, en
 * notas de crédito, ≤ el crédito disponible (grand_total − créditos ya emitidos).
 */
export function validateAdjustmentForm(
  state: AdjustmentFormState,
  summary: Pick<ReceiptAdjustmentSummary, 'grand_total' | 'available_credit' | 'currency'>,
): AdjustmentFormErrors {
  const errors: AdjustmentFormErrors = {};
  const raw = state.amount.trim();
  if (!raw) {
    errors.amount = 'Enter the adjustment amount.';
  } else if (!AMOUNT_PATTERN.test(raw)) {
    errors.amount = 'Use a positive amount with at most 2 decimals.';
  } else {
    const cents = toCents(raw);
    if (cents <= 0) {
      errors.amount = 'The amount must be greater than 0.';
    } else if (cents > toCents(summary.grand_total)) {
      errors.amount = `The amount cannot exceed the receipt grand total (${formatMoney(summary.grand_total, summary.currency)}).`;
    } else if (state.noteType === 'CREDIT_NOTE' && cents > toCents(summary.available_credit)) {
      errors.amount = `Credit notes cannot exceed the grand total: ${formatMoney(summary.available_credit, summary.currency)} still available.`;
    }
  }
  if (!state.reasonCode) errors.reasonCode = 'Select a reason.';
  return errors;
}

/** Pasivo neto proyectado tras la nota (null si el importe aún no es válido). */
export function projectedNet(
  summary: Pick<ReceiptAdjustmentSummary, 'net_total'>,
  noteType: AdjustmentNoteType,
  amount: string,
): number | null {
  const raw = amount.trim();
  if (!AMOUNT_PATTERN.test(raw)) return null;
  const delta = toCents(raw);
  if (delta <= 0) return null;
  const net = toCents(summary.net_total) + (noteType === 'CREDIT_NOTE' ? -delta : delta);
  return net / 100;
}
