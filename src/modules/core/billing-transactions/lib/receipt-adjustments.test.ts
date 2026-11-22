import { describe, expect, it } from 'vitest';
import { canIssueAdjustment, projectedNet, validateAdjustmentForm } from './receipt-adjustments';

const summary = { grand_total: 119, available_credit: 100, currency: 'USD', net_total: 100 };

describe('receipt-adjustments (Historia 7)', () => {
  it('only locked, active receipts accept adjustment notes', () => {
    expect(canIssueAdjustment({ is_locked: true, is_active: true })).toBe(true);
    expect(canIssueAdjustment({ is_locked: false, is_active: true })).toBe(false);
    expect(canIssueAdjustment({ is_locked: true, is_active: false })).toBe(false);
  });

  it('requires a positive amount with at most 2 decimals and a reason', () => {
    expect(validateAdjustmentForm({ noteType: 'CREDIT_NOTE', amount: '', reasonCode: '' }, summary)).toEqual({
      amount: 'Enter the adjustment amount.',
      reasonCode: 'Select a reason.',
    });
    for (const amount of ['abc', '-1', '1.234', '1e3']) {
      expect(
        validateAdjustmentForm({ noteType: 'DEBIT_NOTE', amount, reasonCode: 'OTHER' }, summary).amount,
      ).toBe('Use a positive amount with at most 2 decimals.');
    }
    expect(
      validateAdjustmentForm({ noteType: 'DEBIT_NOTE', amount: '0.00', reasonCode: 'OTHER' }, summary).amount,
    ).toBe('The amount must be greater than 0.');
    expect(validateAdjustmentForm({ noteType: 'DEBIT_NOTE', amount: '10.5', reasonCode: 'OTHER' }, summary)).toEqual(
      {},
    );
  });

  it('caps every note at the grand total and credit notes at the available credit (in cents)', () => {
    expect(
      validateAdjustmentForm({ noteType: 'DEBIT_NOTE', amount: '119.01', reasonCode: 'OTHER' }, summary).amount,
    ).toBe('The amount cannot exceed the receipt grand total (119.00 USD).');
    expect(validateAdjustmentForm({ noteType: 'DEBIT_NOTE', amount: '119', reasonCode: 'OTHER' }, summary)).toEqual({});
    expect(
      validateAdjustmentForm({ noteType: 'CREDIT_NOTE', amount: '100.01', reasonCode: 'REFUND' }, summary).amount,
    ).toBe('Credit notes cannot exceed the grand total: 100.00 USD still available.');
    expect(
      validateAdjustmentForm({ noteType: 'CREDIT_NOTE', amount: '100', reasonCode: 'REFUND' }, summary),
    ).toEqual({});
  });

  it('projects the net amount after the note', () => {
    expect(projectedNet(summary, 'CREDIT_NOTE', '0.10')).toBe(99.9);
    expect(projectedNet(summary, 'DEBIT_NOTE', '19.99')).toBe(119.99);
    expect(projectedNet(summary, 'DEBIT_NOTE', '')).toBeNull();
    expect(projectedNet(summary, 'DEBIT_NOTE', '0')).toBeNull();
  });
});
