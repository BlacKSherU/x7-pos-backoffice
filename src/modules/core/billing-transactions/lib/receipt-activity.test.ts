import { describe, expect, it } from 'vitest';
import {
  auditActorName,
  compareTotals,
  describeAuditEvent,
  formatAuditTimestamp,
  formatDelta,
} from './receipt-activity';

const totals = (subtotal: number, total_tax: number, total_discount: number, grand_total: number) => ({
  subtotal,
  total_tax,
  total_discount,
  grand_total,
});

describe('receipt-activity (Historia 6)', () => {
  it('compares subtotal, total_tax and grand_total before and after in integer cents', () => {
    const rows = compareTotals(totals(0.1, 0.2, 0, 0.3), totals(0.3, 0.2, 0, 0.5));
    expect(rows.map((row) => [row.key, row.previous, row.next, row.deltaCents, row.changed])).toEqual([
      ['subtotal', 0.1, 0.3, 20, true],
      ['total_tax', 0.2, 0.2, 0, false],
      ['grand_total', 0.3, 0.5, 20, true],
    ]);
  });

  it('adds the discount row only when the discount changed', () => {
    const rows = compareTotals(totals(10, 0, 0, 10), totals(10, 0, 2.5, 7.5));
    expect(rows.map((row) => row.key)).toEqual(['subtotal', 'total_tax', 'total_discount', 'grand_total']);
    expect(rows.find((row) => row.key === 'total_discount')?.deltaCents).toBe(250);
  });

  it('handles events without previous totals (creation) or without totals at all', () => {
    const rows = compareTotals(null, totals(0, 0, 0, 0));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.previous === null && row.deltaCents === null && !row.changed)).toBe(true);
    expect(compareTotals(null, null)).toEqual([]);
  });

  it('formats signed deltas', () => {
    expect(formatDelta(250)).toBe('+2.50');
    expect(formatDelta(-100)).toBe('−1.00');
    expect(formatDelta(0)).toBe('±0.00');
    expect(formatDelta(123456)).toBe('+1,234.56');
  });

  it('names the actor by username/email, user id or System', () => {
    expect(auditActorName({ user_id: 7, user_name: 'ana' })).toBe('ana');
    expect(auditActorName({ user_id: 7, user_name: null })).toBe('User #7');
    expect(auditActorName({ user_id: null, user_name: null })).toBe('System');
  });

  it('formats the exact timestamp with seconds and milliseconds', () => {
    const local = new Date(2026, 10, 22, 9, 5, 7, 42);
    expect(formatAuditTimestamp(local.toISOString())).toMatch(/^Nov 22, 2026, 09:05:07\.042$/);
    expect(formatAuditTimestamp('not a date')).toBe('not a date');
  });

  it('describes each kind of event from its metadata', () => {
    expect(describeAuditEvent({ action: 'CREATED', metadata: { backfill: true } })).toMatch(/activity log was enabled/);
    expect(describeAuditEvent({ action: 'CREATED', metadata: { source: 'order_settlement' } })).toBe(
      'Issued when the order was settled.',
    );
    expect(describeAuditEvent({ action: 'UPDATED', metadata: { changed_fields: ['currency', 'fiscal_data'] } })).toBe(
      'Changed: currency, fiscal_data.',
    );
    expect(describeAuditEvent({ action: 'UPDATED', metadata: { changed_fields: [] } })).toBe(
      'Saved without field changes.',
    );
    expect(describeAuditEvent({ action: 'ITEM_MODIFIED', metadata: { operation: 'DELETED', name: 'Soda' } })).toBe(
      'Line item "Soda" deleted.',
    );
    expect(
      describeAuditEvent({ action: 'TAX_MODIFIED', metadata: { operation: 'CREATED', name: 'VAT', rate: 19 } }),
    ).toBe('Tax "VAT" (19%) added.');
    expect(
      describeAuditEvent({
        action: 'MODIFICATION_BLOCKED',
        metadata: { method: 'PATCH', path: '/api/receipts/2', reason: 'LOCKED' },
      }),
    ).toBe('Blocked PATCH /api/receipts/2: the receipt is locked.');
    expect(describeAuditEvent({ action: 'MODIFICATION_BLOCKED', metadata: { reason: 'INACTIVE' } })).toBe(
      'Change blocked: the receipt is deactivated.',
    );
    expect(
      describeAuditEvent({
        action: 'ADJUSTMENT_ISSUED',
        metadata: { note_type: 'CREDIT_NOTE', note_number: 'CN-000001', adjustment_amount: 10 },
      }),
    ).toBe('Credit note CN-000001 for 10.00 issued.');
    expect(describeAuditEvent({ action: 'LOCKED', metadata: null })).toMatch(/fiscally locked/);
    expect(describeAuditEvent({ action: 'DEACTIVATED', metadata: null })).toMatch(/logical delete/);
  });
});
