import React, { useEffect, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { FormField, ModalFormError, ModalFormFooter } from '@/shared/components/AppModal';
import type { Receipt } from '../../types/receipts';
import type {
  AdjustmentNoteType,
  AdjustmentReasonCode,
  IssueAdjustmentNotePayload,
  ReceiptAdjustmentSummary,
  ReceiptAdjustments,
} from '../../types/receipt-adjustments';
import { formatMoney, receiptLabel } from '../../lib/receipts-format';
import {
  ADJUSTMENT_NOTE_TYPE_HINTS,
  ADJUSTMENT_NOTE_TYPE_LABELS,
  ADJUSTMENT_REASON_CODES,
  ADJUSTMENT_REASON_LABELS,
  projectedNet,
  validateAdjustmentForm,
  type AdjustmentFormErrors,
  type AdjustmentFormState,
} from '../../lib/receipt-adjustments';

interface ReceiptAdjustmentNoteDrawerProps {
  receipt: Receipt;
  /** GET /billing/receipts/:id/adjustments: crédito disponible y pasivo neto actual. */
  loadAdjustments: (receiptId: number) => Promise<ReceiptAdjustments>;
  /** Lanza si falla: el mensaje del servidor se muestra en el panel. */
  onSubmit: (payload: IssueAdjustmentNotePayload) => Promise<void>;
  onClose: () => void;
}

const NOTE_TYPES: AdjustmentNoteType[] = ['CREDIT_NOTE', 'DEBIT_NOTE'];

/** Resumen a partir del propio recibo, si el de las notas no se pudo cargar (el servidor valida igual). */
function summaryFromReceipt(receipt: Receipt): ReceiptAdjustmentSummary {
  return {
    receipt_id: receipt.id,
    invoice_number: receipt.invoice_number,
    currency: receipt.currency,
    is_locked: receipt.is_locked,
    grand_total: receipt.grand_total,
    credited_total: 0,
    debited_total: 0,
    net_total: receipt.grand_total,
    available_credit: receipt.grand_total,
    notes_count: 0,
  };
}

/**
 * ISSUE ADJUSTMENT NOTE (Historia 7): formulario lateral para emitir una nota de crédito o
 * débito sobre un recibo bloqueado. El recibo queda enlazado automáticamente (receipt_id de
 * la fila); se eligen el tipo, el importe y el motivo. El recibo original no cambia: la nota
 * registra el delta y el pasivo neto resultante, que se previsualiza antes de emitirla.
 */
export const ReceiptAdjustmentNoteDrawer: React.FC<ReceiptAdjustmentNoteDrawerProps> = ({
  receipt,
  loadAdjustments,
  onSubmit,
  onClose,
}) => {
  const [form, setForm] = useState<AdjustmentFormState>({ noteType: 'CREDIT_NOTE', amount: '', reasonCode: '' });
  const [errors, setErrors] = useState<AdjustmentFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ReceiptAdjustmentSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAdjustments(receipt.id)
      .then((data) => {
        if (!cancelled) setSummary(data.summary);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSummaryError(err instanceof Error ? err.message : 'Failed to load the adjustment notes.');
          setSummary(summaryFromReceipt(receipt));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadAdjustments, receipt]);

  const update = (patch: Partial<AdjustmentFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Un error ya mostrado deja de aplicar al tocar su campo; el límite del importe depende
    // además del tipo de nota (solo las de crédito tienen tope).
    setErrors((prev) => {
      const next = { ...prev };
      if ('amount' in patch || 'noteType' in patch) delete next.amount;
      if ('reasonCode' in patch) delete next.reasonCode;
      return next;
    });
  };
  const projected = summary ? projectedNet(summary, form.noteType, form.amount) : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary) return;
    const nextErrors = validateAdjustmentForm(form, summary);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0 || !form.reasonCode) return;

    setSubmitting(true);
    try {
      await onSubmit({
        noteType: form.noteType,
        adjustmentAmount: Number(form.amount.trim()),
        reasonCode: form.reasonCode,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The adjustment note could not be issued.');
    } finally {
      setSubmitting(false);
    }
  };

  const currency = summary?.currency ?? receipt.currency;
  const previewRows: Array<[string, number | null, string]> = summary
    ? [
        ['Original grand total', summary.grand_total, 'adjustment-grand-total'],
        ['Credited so far', -summary.credited_total, 'adjustment-credited'],
        ['Debited so far', summary.debited_total, 'adjustment-debited'],
        ['Current net', summary.net_total, 'adjustment-current-net'],
      ]
    : [];

  return (
    <SideDrawer
      title={`Adjust ${receiptLabel(receipt)}`}
      subtitle="ISSUE ADJUSTMENT NOTE"
      onClose={onClose}
      closeDisabled={submitting}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 bg-[#faf8f5] font-poppins">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {submitError && <ModalFormError message={submitError} />}

          <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
            <p className="text-[11px] font-bold text-[#5f5e5e] uppercase">Linked receipt</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#1d1c17]" data-testid="adjustment-linked-receipt">
              <span className="material-symbols-outlined text-amber-700 text-[18px]" aria-hidden="true">
                lock
              </span>
              <strong>{receiptLabel(receipt)}</strong>
              <span className="text-[#8c857b]">· Receipt #{receipt.id}</span>
            </p>
            <p className="mt-2 text-[11.5px] text-[#8c857b]">
              The original receipt stays unchanged: this note records the adjustment and the resulting net amount.
            </p>
          </section>

          <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs space-y-4">
            <fieldset>
              <legend className="text-[11px] font-bold text-[#5f5e5e] uppercase">Note type *</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {NOTE_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`flex flex-col gap-1 p-3 rounded border cursor-pointer transition-colors ${
                      form.noteType === type ? 'border-[#ae001a] bg-[#ae001a]/5' : 'border-[#e8e2d8] hover:border-[#ae001a]/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#1d1c17]">
                      <input
                        type="radio"
                        name="adjustment-note-type"
                        value={type}
                        checked={form.noteType === type}
                        onChange={() => update({ noteType: type })}
                        className="accent-[#ae001a]"
                      />
                      {ADJUSTMENT_NOTE_TYPE_LABELS[type]}
                    </span>
                    <span className="text-[11px] text-[#8c857b]">{ADJUSTMENT_NOTE_TYPE_HINTS[type]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <FormField
              id="adjustment-amount"
              label={`Adjustment amount (${currency}) *`}
              type="number"
              value={form.amount}
              onChange={(amount) => update({ amount })}
              error={errors.amount}
              placeholder="0.00"
            />

            <div className="flex flex-col gap-1.5 min-w-0">
              <label htmlFor="adjustment-reason" className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                Reason *
              </label>
              <select
                id="adjustment-reason"
                value={form.reasonCode}
                onChange={(e) => update({ reasonCode: e.target.value as AdjustmentReasonCode | '' })}
                aria-invalid={Boolean(errors.reasonCode)}
                className={`bg-white text-[#1d1c17] px-3 py-2 border rounded outline-none focus:ring-1 ${
                  errors.reasonCode
                    ? 'border-error focus:ring-error'
                    : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-[#ae001a]'
                }`}
              >
                <option value="">Select a reason…</option>
                {ADJUSTMENT_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {ADJUSTMENT_REASON_LABELS[code]}
                  </option>
                ))}
              </select>
              {errors.reasonCode ? (
                <p className="text-body-sm text-error" role="alert">
                  {errors.reasonCode}
                </p>
              ) : null}
            </div>
          </section>

          <section
            aria-label="Net amount preview"
            className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs text-sm"
          >
            {!summary ? (
              <p role="status" className="text-[#5f5e5e]">
                Loading current adjustments…
              </p>
            ) : (
              <dl className="space-y-1.5">
                {summaryError && (
                  <p className="text-[11.5px] text-amber-800" data-testid="adjustment-summary-error">
                    Current adjustments could not be loaded ({summaryError}); the server will validate the amount.
                  </p>
                )}
                {previewRows.map(([label, value, testId]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-[#5f5e5e]">{label}</dt>
                    <dd className="tabular-nums text-[#1d1c17]" data-testid={testId}>
                      {formatMoney(value, currency)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 pt-2 border-t border-[#e8e2d8]">
                  <dt className="font-bold text-[#1d1c17]">Net after this note</dt>
                  <dd className="tabular-nums font-bold text-[#ae001a]" data-testid="adjustment-projected-net">
                    {projected === null ? '—' : formatMoney(projected, currency)}
                  </dd>
                </div>
                {form.noteType === 'CREDIT_NOTE' && (
                  <p className="text-[11px] text-[#8c857b]" data-testid="adjustment-available-credit">
                    Available credit: {formatMoney(summary.available_credit, currency)}
                  </p>
                )}
              </dl>
            )}
          </section>
        </div>

        <div className="p-4 bg-white">
          <ModalFormFooter
            onCancel={onClose}
            submitLabel={submitting ? 'Issuing…' : 'ISSUE ADJUSTMENT NOTE'}
            isSubmitting={submitting}
            submitDisabled={!summary}
          />
        </div>
      </form>
    </SideDrawer>
  );
};

export default ReceiptAdjustmentNoteDrawer;
