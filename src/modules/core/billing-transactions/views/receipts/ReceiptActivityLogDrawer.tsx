import React, { useCallback, useEffect, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import type { Receipt, ReceiptActivityEvent, ReceiptActivityLog } from '../../types/receipts';
import { formatAmount, receiptLabel } from '../../lib/receipts-format';
import {
  AUDIT_ACTION_ICONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONE,
  auditActorName,
  compareTotals,
  describeAuditEvent,
  formatAuditTimestamp,
  formatDelta,
} from '../../lib/receipt-activity';

interface ReceiptActivityLogDrawerProps {
  receipt: Receipt;
  /** GET /receipts/:id/activity-log. */
  loadActivityLog: (receiptId: number) => Promise<ReceiptActivityLog>;
  onClose: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; log: ReceiptActivityLog };

/** Comparación antes → después de subtotal, total_tax y grand_total de un evento. */
const TotalsComparison: React.FC<{ event: ReceiptActivityEvent; currency: string }> = ({ event, currency }) => {
  const rows = compareTotals(event.previous_values, event.new_values);
  if (rows.length === 0) return null;
  return (
    <table
      className="mt-3 w-full text-[12px] font-poppins border-collapse"
      aria-label={`Totals before and after event ${event.id}`}
      data-testid={`activity-event-${event.id}-totals`}
    >
      <thead>
        <tr className="text-[9.5px] font-bold uppercase tracking-wider text-[#8c857b]">
          <th className="text-left font-bold py-1">{currency}</th>
          <th className="text-right font-bold py-1">Previous</th>
          <th className="text-right font-bold py-1">New</th>
          <th className="text-right font-bold py-1">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            data-testid={`activity-event-${event.id}-${row.key}`}
            data-changed={row.changed ? 'true' : 'false'}
            className="border-t border-[#efe9df]"
          >
            <th scope="row" className="text-left font-semibold text-[#5f5e5e] py-1">
              {row.label}
            </th>
            <td className="text-right tabular-nums text-[#5f5e5e] py-1">
              {row.previous === null ? '—' : formatAmount(row.previous)}
            </td>
            <td className={`text-right tabular-nums py-1 ${row.changed ? 'font-bold text-[#1d1c17]' : 'text-[#1d1c17]'}`}>
              {row.next === null ? '—' : formatAmount(row.next)}
            </td>
            <td
              className={`text-right tabular-nums py-1 ${
                row.deltaCents === null || row.deltaCents === 0
                  ? 'text-[#8c857b]'
                  : row.deltaCents > 0
                    ? 'text-emerald-700 font-semibold'
                    : 'text-red-700 font-semibold'
              }`}
            >
              {row.deltaCents === null ? 'new' : formatDelta(row.deltaCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * VIEW ACTIVITY LOG (Historia 6): timeline lateral del audit trail de un recibo, en orden
 * cronológico exacto (created_at, id). Cada evento muestra la acción, quién la ejecutó
 * (usuario y rol), el timestamp exacto y la comparación de subtotal / total_tax / grand_total
 * antes y después.
 */
export const ReceiptActivityLogDrawer: React.FC<ReceiptActivityLogDrawerProps> = ({
  receipt,
  loadActivityLog,
  onClose,
}) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadActivityLog(receipt.id)
      .then((log) => {
        if (!cancelled) setState({ status: 'loaded', log });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load the activity log.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadActivityLog, receipt.id, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <SideDrawer title={receiptLabel(receipt)} subtitle="ACTIVITY LOG" onClose={onClose} maxWidth={560}>
      <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-[#faf8f5] font-poppins">
        <div className="flex items-center gap-2 mb-4 text-[#1d1c17]">
          <span className="material-symbols-outlined text-[#ae001a] text-[22px]" aria-hidden="true">
            history
          </span>
          <h3 className="text-[12px] font-bold uppercase tracking-widest">Audit trail</h3>
          {state.status === 'loaded' && (
            <span className="ml-auto text-[11px] text-[#8c857b]" data-testid="activity-log-count">
              {state.log.events.length} {state.log.events.length === 1 ? 'event' : 'events'} · oldest first
            </span>
          )}
        </div>

        {state.status === 'loading' && (
          <p role="status" className="text-sm text-[#5f5e5e]">
            Loading activity…
          </p>
        )}

        {state.status === 'error' && (
          <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
            <p>{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 px-3 py-1.5 bg-[#222222] text-white font-bold text-[11px] uppercase tracking-widest hover:bg-[#ae001a] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {state.status === 'loaded' && state.log.events.length === 0 && (
          <p className="text-sm text-[#5f5e5e]" data-testid="activity-log-empty">
            No activity has been recorded for this receipt yet.
          </p>
        )}

        {state.status === 'loaded' && state.log.events.length > 0 && (
          <ol aria-label="Activity timeline" className="relative border-l-2 border-[#e8e2d8] ml-3 space-y-4">
            {state.log.events.map((event) => (
              <li key={event.id} data-testid={`activity-event-${event.id}`} className="relative pl-6">
                <span
                  className={`absolute -left-[15px] top-3 flex items-center justify-center w-7 h-7 rounded-full border ${
                    AUDIT_ACTION_TONE[event.action] ?? 'border-zinc-300 bg-white text-zinc-700'
                  }`}
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {AUDIT_ACTION_ICONS[event.action] ?? 'history'}
                  </span>
                </span>
                <article className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      data-testid={`activity-event-${event.id}-action`}
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                        AUDIT_ACTION_TONE[event.action] ?? 'border-zinc-300 bg-white text-zinc-700'
                      }`}
                    >
                      {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#1d1c17]">{describeAuditEvent(event)}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[#5f5e5e]">
                    <div className="inline-flex items-center gap-1" data-testid={`activity-event-${event.id}-user`}>
                      <dt className="inline-flex items-center">
                        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                          person
                        </span>
                        <span className="sr-only">User</span>
                      </dt>
                      <dd>
                        <span className="font-semibold text-[#1d1c17]">{auditActorName(event)}</span>
                        {event.user_name && event.user_id ? (
                          <span className="text-[#8c857b]"> (#{event.user_id})</span>
                        ) : null}
                        {event.role ? <span> · {event.role}</span> : null}
                      </dd>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <dt className="inline-flex items-center">
                        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                          schedule
                        </span>
                        <span className="sr-only">Timestamp</span>
                      </dt>
                      <dd>
                        <time
                          dateTime={event.created_at}
                          title={event.created_at}
                          data-testid={`activity-event-${event.id}-time`}
                          className="tabular-nums"
                        >
                          {formatAuditTimestamp(event.created_at)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  <TotalsComparison event={event} currency={state.log.currency} />
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SideDrawer>
  );
};

export default ReceiptActivityLogDrawer;
