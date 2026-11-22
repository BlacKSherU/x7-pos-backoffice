import { apiRequest } from '@/shared/api/http';
import type {
  IssueAdjustmentNotePayload,
  IssuedAdjustmentNote,
  ReceiptAdjustmentNote,
  ReceiptAdjustmentSummary,
  ReceiptAdjustments,
} from '../types/receipt-adjustments';

const BASE = '/billing/receipts';

type Envelope<T> = { data: T };

/** Los decimal(12,2) pueden llegar como string desde Postgres: siempre a number. */
export function normalizeAdjustmentNote(raw: ReceiptAdjustmentNote): ReceiptAdjustmentNote {
  const amount = Number(raw.adjustment_amount ?? 0);
  return {
    ...raw,
    original_invoice_number: raw.original_invoice_number ?? null,
    adjustment_amount: amount,
    signed_amount:
      raw.signed_amount !== undefined && raw.signed_amount !== null
        ? Number(raw.signed_amount)
        : raw.note_type === 'CREDIT_NOTE'
          ? -amount
          : amount,
    resulting_net_amount: Number(raw.resulting_net_amount ?? 0),
    currency: raw.currency || 'USD',
  };
}

export function normalizeAdjustmentSummary(raw: ReceiptAdjustmentSummary): ReceiptAdjustmentSummary {
  return {
    ...raw,
    invoice_number: raw.invoice_number ?? null,
    currency: raw.currency || 'USD',
    is_locked: Boolean(raw.is_locked),
    grand_total: Number(raw.grand_total ?? 0),
    credited_total: Number(raw.credited_total ?? 0),
    debited_total: Number(raw.debited_total ?? 0),
    net_total: Number(raw.net_total ?? 0),
    available_credit: Number(raw.available_credit ?? 0),
    notes_count: Number(raw.notes_count ?? 0),
  };
}

/** GET /billing/receipts/:id/adjustments — notas del recibo y su pasivo neto (Historia 7). */
export async function listReceiptAdjustments(receiptId: number): Promise<ReceiptAdjustments> {
  const json = await apiRequest<Envelope<ReceiptAdjustments>>(
    `${BASE}/${receiptId}/adjustments`,
    { method: 'GET' },
    'Failed to load the adjustment notes.',
  );
  return {
    summary: normalizeAdjustmentSummary(json.data.summary),
    notes: (json.data.notes ?? []).map(normalizeAdjustmentNote),
  };
}

/**
 * POST /billing/receipts/:id/adjustments — emite una nota de crédito / débito sobre un recibo
 * bloqueado. El back-end valida el importe (≤ grand_total y crédito acumulado ≤ grand_total)
 * y registra el usuario y el rol que la emiten.
 */
export async function issueAdjustmentNote(
  receiptId: number,
  payload: IssueAdjustmentNotePayload,
): Promise<IssuedAdjustmentNote> {
  const json = await apiRequest<Envelope<IssuedAdjustmentNote>>(
    `${BASE}/${receiptId}/adjustments`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to issue the adjustment note.',
  );
  return {
    note: normalizeAdjustmentNote(json.data.note),
    summary: normalizeAdjustmentSummary(json.data.summary),
  };
}
