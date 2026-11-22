import React, { useEffect, useState } from 'react';
import type { ReceiptAdjustments } from '../../types/receipt-adjustments';
import { formatAmount, formatMoney, formatReceiptDate } from '../../lib/receipts-format';
import { ADJUSTMENT_NOTE_TYPE_LABELS, ADJUSTMENT_REASON_LABELS } from '../../lib/receipt-adjustments';

interface ReceiptAdjustmentNotesSectionProps {
  receiptId: number;
  currency: string;
  loadAdjustments: (receiptId: number) => Promise<ReceiptAdjustments>;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: ReceiptAdjustments };

/**
 * Notas de crédito / débito de un recibo bloqueado (Historia 7) en su ficha: cada nota con su
 * número, tipo, motivo, delta con signo y neto resultante, y el pasivo neto ajustado del
 * recibo (grand_total − créditos + débitos). El grand_total original no cambia.
 */
export const ReceiptAdjustmentNotesSection: React.FC<ReceiptAdjustmentNotesSectionProps> = ({
  receiptId,
  currency,
  loadAdjustments,
}) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadAdjustments(receiptId)
      .then((data) => {
        if (!cancelled) setState({ status: 'loaded', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load the adjustment notes.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadAdjustments, receiptId]);

  return (
    <section
      aria-labelledby="receipt-adjustments-heading"
      className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs"
      data-testid="receipt-detail-adjustments"
    >
      <h3
        id="receipt-adjustments-heading"
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-3"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          receipt_long
        </span>
        Adjustment notes
      </h3>

      {state.status === 'loading' && (
        <p role="status" className="text-sm text-[#5f5e5e]">
          Loading adjustment notes…
        </p>
      )}

      {state.status === 'error' && (
        <p className="text-sm text-red-700" data-testid="receipt-detail-adjustments-error">
          {state.message}
        </p>
      )}

      {state.status === 'loaded' && (
        <>
          {state.data.notes.length === 0 ? (
            <p className="text-sm text-[#5f5e5e]">No credit or debit notes have been issued for this receipt.</p>
          ) : (
            <ul className="divide-y divide-[#efe9df]" aria-label="Adjustment notes">
              {state.data.notes.map((note) => (
                <li
                  key={note.id}
                  className="py-2 flex items-start justify-between gap-3"
                  data-testid={`receipt-adjustment-${note.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d1c17]">
                      {note.note_number}{' '}
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                          note.note_type === 'CREDIT_NOTE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-orange-50 text-orange-800 border border-orange-200'
                        }`}
                      >
                        {ADJUSTMENT_NOTE_TYPE_LABELS[note.note_type]}
                      </span>
                    </p>
                    <p className="text-[11.5px] text-[#8c857b]">
                      {ADJUSTMENT_REASON_LABELS[note.reason_code] ?? note.reason_code} · User #
                      {note.processed_by_user_id} · {note.processed_by_role} · {formatReceiptDate(note.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        note.signed_amount < 0 ? 'text-emerald-700' : 'text-orange-700'
                      }`}
                      data-testid={`receipt-adjustment-${note.id}-amount`}
                    >
                      {note.signed_amount < 0 ? '−' : '+'}
                      {formatAmount(Math.abs(note.signed_amount))}
                    </p>
                    <p className="text-[11px] text-[#8c857b] tabular-nums">
                      Net after: {formatAmount(note.resulting_net_amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-3 pt-3 border-t border-[#e8e2d8] space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#5f5e5e]">Original grand total</dt>
              <dd className="tabular-nums">{formatMoney(state.data.summary.grand_total, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#5f5e5e]">Credit notes</dt>
              <dd className="tabular-nums">−{formatMoney(state.data.summary.credited_total, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#5f5e5e]">Debit notes</dt>
              <dd className="tabular-nums">+{formatMoney(state.data.summary.debited_total, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-bold">
              <dt className="text-[#1d1c17]">Adjusted net</dt>
              <dd className="tabular-nums text-[#ae001a]" data-testid="receipt-detail-adjusted-net">
                {formatMoney(state.data.summary.net_total, currency)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
};

export default ReceiptAdjustmentNotesSection;
