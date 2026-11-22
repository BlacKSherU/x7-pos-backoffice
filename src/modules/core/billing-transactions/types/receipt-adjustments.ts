// Notas de crédito / débito (Historia 7; back-end: src/core/billing-transactions/receipt-adjustments).

export type AdjustmentNoteType = 'CREDIT_NOTE' | 'DEBIT_NOTE';

export type AdjustmentReasonCode =
  | 'REFUND'
  | 'PARTIAL_RETURN'
  | 'PRICE_CORRECTION'
  | 'BILLING_ERROR'
  | 'DISCOUNT_ADJUSTMENT'
  | 'MISSED_CHARGE'
  | 'OTHER';

export interface ReceiptAdjustmentNote {
  id: number;
  receipt_id: number;
  merchant_id: number;
  note_type: AdjustmentNoteType;
  /** Único por merchant: CN-###### / DN-######. */
  note_number: string;
  /** invoice_number del recibo original. */
  original_invoice_number: string | null;
  /** Delta (siempre > 0; el signo lo da note_type). */
  adjustment_amount: number;
  /** Delta con signo sobre el pasivo neto (negativo en notas de crédito). */
  signed_amount: number;
  /** Pasivo neto del recibo justo después de esta nota. */
  resulting_net_amount: number;
  currency: string;
  reason_code: AdjustmentReasonCode;
  processed_by_user_id: number;
  processed_by_role: string;
  created_at: string;
}

/** Pasivo neto del recibo: grand_total − notas de crédito + notas de débito. */
export interface ReceiptAdjustmentSummary {
  receipt_id: number;
  invoice_number: string | null;
  currency: string;
  is_locked: boolean;
  grand_total: number;
  credited_total: number;
  debited_total: number;
  net_total: number;
  /** grand_total − credited_total: lo que aún admite una nota de crédito. */
  available_credit: number;
  notes_count: number;
}

/** GET /billing/receipts/:id/adjustments */
export interface ReceiptAdjustments {
  summary: ReceiptAdjustmentSummary;
  notes: ReceiptAdjustmentNote[];
}

/** POST /billing/receipts/:id/adjustments (el recibo va en la ruta). */
export interface IssueAdjustmentNotePayload {
  noteType: AdjustmentNoteType;
  adjustmentAmount: number;
  reasonCode: AdjustmentReasonCode;
}

export interface IssuedAdjustmentNote {
  note: ReceiptAdjustmentNote;
  summary: ReceiptAdjustmentSummary;
}
