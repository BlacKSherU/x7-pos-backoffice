import type { ReceiptActivityEvent, ReceiptAuditAction, ReceiptTotalsSnapshot } from '../types/receipts';
import { formatAmount } from './receipts-format';
import { toCents } from './receipt-fiscal';

/**
 * Audit trail de un recibo (Historia 6): etiquetas, iconos y textos de cada evento del
 * timeline "VIEW ACTIVITY LOG", y la comparación de totales antes / después.
 */
export const AUDIT_ACTION_LABELS: Record<ReceiptAuditAction, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  LOCKED: 'Locked',
  TAX_MODIFIED: 'Tax modified',
  ITEM_MODIFIED: 'Line item modified',
  DEACTIVATED: 'Deactivated',
  MODIFICATION_BLOCKED: 'Modification blocked',
  ADJUSTMENT_ISSUED: 'Adjustment issued',
};

/** Icono Material Symbols de cada evento. */
export const AUDIT_ACTION_ICONS: Record<ReceiptAuditAction, string> = {
  CREATED: 'add_circle',
  UPDATED: 'edit',
  LOCKED: 'lock',
  TAX_MODIFIED: 'percent',
  ITEM_MODIFIED: 'list_alt',
  DEACTIVATED: 'block',
  MODIFICATION_BLOCKED: 'gpp_bad',
  ADJUSTMENT_ISSUED: 'receipt_long',
};

/** Colores (borde / fondo / texto) del marcador de cada evento. */
export const AUDIT_ACTION_TONE: Record<ReceiptAuditAction, string> = {
  CREATED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  UPDATED: 'border-sky-200 bg-sky-50 text-sky-800',
  LOCKED: 'border-amber-200 bg-amber-50 text-amber-800',
  TAX_MODIFIED: 'border-violet-200 bg-violet-50 text-violet-800',
  ITEM_MODIFIED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  DEACTIVATED: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  MODIFICATION_BLOCKED: 'border-red-200 bg-red-50 text-red-800',
  ADJUSTMENT_ISSUED: 'border-[#ae001a]/30 bg-[#ae001a]/5 text-[#ae001a]',
};

export const AUDIT_TOTAL_FIELDS: Array<{ key: keyof ReceiptTotalsSnapshot; label: string }> = [
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'total_tax', label: 'Total tax' },
  { key: 'total_discount', label: 'Discounts' },
  { key: 'grand_total', label: 'Grand total' },
];

/** Los tres totales que el timeline compara siempre (el descuento solo si cambió). */
const ALWAYS_COMPARED: ReadonlyArray<keyof ReceiptTotalsSnapshot> = ['subtotal', 'total_tax', 'grand_total'];

export interface TotalsComparisonRow {
  key: keyof ReceiptTotalsSnapshot;
  label: string;
  previous: number | null;
  next: number | null;
  /** next − previous en centavos enteros (null si falta alguno de los dos). */
  deltaCents: number | null;
  changed: boolean;
}

/**
 * Filas "antes → después" de subtotal, total_tax y grand_total (y total_discount si cambió),
 * comparadas en centavos enteros. Sin totales en el evento devuelve [].
 */
export function compareTotals(
  previous: ReceiptTotalsSnapshot | null,
  next: ReceiptTotalsSnapshot | null,
): TotalsComparisonRow[] {
  if (!previous && !next) return [];
  return AUDIT_TOTAL_FIELDS.map(({ key, label }) => {
    const before = previous ? previous[key] : null;
    const after = next ? next[key] : null;
    const deltaCents = before === null || after === null ? null : toCents(after) - toCents(before);
    return {
      key,
      label,
      previous: before,
      next: after,
      deltaCents,
      changed: deltaCents !== null && deltaCents !== 0,
    };
  }).filter((row) => ALWAYS_COMPARED.includes(row.key) || row.changed);
}

/** Diferencia con signo: "+2.50", "−1.00" (signo menos tipográfico) o "±0.00". */
export function formatDelta(deltaCents: number): string {
  if (deltaCents === 0) return '±0.00';
  const sign = deltaCents > 0 ? '+' : '−';
  return `${sign}${formatAmount(Math.abs(deltaCents) / 100)}`;
}

/** "jdoe" / "User #7" / "System" según lo que traiga el evento. */
export function auditActorName(event: Pick<ReceiptActivityEvent, 'user_id' | 'user_name'>): string {
  if (event.user_name) return event.user_name;
  if (event.user_id) return `User #${event.user_id}`;
  return 'System';
}

/** Timestamp exacto con segundos y milisegundos: "Nov 22, 2026, 10:15:30.123". */
export function formatAuditTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const base = d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${base}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

const OPERATION_VERBS: Record<string, string> = {
  CREATED: 'added',
  UPDATED: 'edited',
  DELETED: 'deleted',
  RESTORED: 'restored',
  ACTIVATED: 'activated',
  DEACTIVATED: 'deactivated',
};

/** Frase con el detalle del evento a partir de su metadata. */
export function describeAuditEvent(event: Pick<ReceiptActivityEvent, 'action' | 'metadata'>): string {
  const meta = event.metadata ?? {};
  const verb = OPERATION_VERBS[String(meta.operation ?? '')] ?? 'changed';
  switch (event.action) {
    case 'CREATED':
      if (meta.backfill === true) return 'Existing receipt recorded when the activity log was enabled.';
      if (meta.source === 'order_settlement') return 'Issued when the order was settled.';
      return 'Receipt created.';
    case 'UPDATED': {
      const fields = Array.isArray(meta.changed_fields) ? meta.changed_fields.map(String) : [];
      return fields.length > 0 ? `Changed: ${fields.join(', ')}.` : 'Saved without field changes.';
    }
    case 'LOCKED':
      return 'Receipt fiscally locked: no further edits.';
    case 'ITEM_MODIFIED': {
      const name = text(meta.name);
      return name ? `Line item "${name}" ${verb}.` : `Line item ${verb}.`;
    }
    case 'TAX_MODIFIED': {
      const name = text(meta.name);
      const rate = text(meta.rate);
      const label = name ? `"${name}"${rate !== null ? ` (${rate}%)` : ''}` : '';
      return label ? `Tax ${label} ${verb}.` : `Tax ${verb}.`;
    }
    case 'DEACTIVATED':
      return 'Receipt deactivated (logical delete).';
    case 'MODIFICATION_BLOCKED': {
      const request = [text(meta.method), text(meta.path)].filter(Boolean).join(' ');
      const reason = meta.reason === 'INACTIVE' ? 'the receipt is deactivated' : 'the receipt is locked';
      return request ? `Blocked ${request}: ${reason}.` : `Change blocked: ${reason}.`;
    }
    case 'ADJUSTMENT_ISSUED': {
      const type = meta.note_type === 'DEBIT_NOTE' ? 'Debit note' : 'Credit note';
      const number = text(meta.note_number);
      const amount = text(meta.adjustment_amount);
      return `${type}${number ? ` ${number}` : ''}${amount ? ` for ${formatAmount(Number(amount))}` : ''} issued.`;
    }
    default:
      return '';
  }
}
