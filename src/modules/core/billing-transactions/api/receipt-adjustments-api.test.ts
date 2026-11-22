import { afterEach, describe, expect, it, vi } from 'vitest';
import { calledRoutes, fakeBackend, jsonResponse } from '@/test/fetch';
import { issueAdjustmentNote, listReceiptAdjustments } from './receipt-adjustments-api';

const rawSummary = {
  receipt_id: 2,
  invoice_number: 'INV-000002',
  currency: 'EUR',
  is_locked: true,
  grand_total: '1234.50',
  credited_total: '34.50',
  debited_total: '0.00',
  net_total: '1200.00',
  available_credit: '1200.00',
  notes_count: 1,
};
const rawNote = {
  id: 5,
  receipt_id: 2,
  merchant_id: 1,
  note_type: 'CREDIT_NOTE',
  note_number: 'CN-000001',
  original_invoice_number: 'INV-000002',
  adjustment_amount: '34.50',
  resulting_net_amount: '1200.00',
  currency: 'EUR',
  reason_code: 'PARTIAL_RETURN',
  processed_by_user_id: 7,
  processed_by_role: 'merchant_admin',
  created_at: '2026-11-22T10:00:00Z',
};

describe('receipt-adjustments-api (Historia 7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GET /billing/receipts/:id/adjustments normalizes decimals and derives the signed delta', async () => {
    const fetchMock = fakeBackend({
      '/billing/receipts/2/adjustments': { data: { summary: rawSummary, notes: [rawNote] } },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listReceiptAdjustments(2);

    expect(calledRoutes(fetchMock)).toEqual(['GET /billing/receipts/2/adjustments']);
    expect(result.summary).toMatchObject({ grand_total: 1234.5, credited_total: 34.5, net_total: 1200 });
    expect(result.notes[0]).toMatchObject({ adjustment_amount: 34.5, signed_amount: -34.5, resulting_net_amount: 1200 });
  });

  it('POST /billing/receipts/:id/adjustments sends note type, amount and reason', async () => {
    let body: unknown;
    const fetchMock = fakeBackend({
      'POST /billing/receipts/2/adjustments': (init: RequestInit | undefined) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse(
          { data: { note: { ...rawNote, signed_amount: -34.5 }, summary: rawSummary } },
          201,
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const issued = await issueAdjustmentNote(2, {
      noteType: 'CREDIT_NOTE',
      adjustmentAmount: 34.5,
      reasonCode: 'PARTIAL_RETURN',
    });

    expect(body).toEqual({ noteType: 'CREDIT_NOTE', adjustmentAmount: 34.5, reasonCode: 'PARTIAL_RETURN' });
    expect(issued.note.note_number).toBe('CN-000001');
    expect(issued.summary.available_credit).toBe(1200);
  });

  it('surfaces the server validation message', async () => {
    vi.stubGlobal(
      'fetch',
      fakeBackend({
        'POST /billing/receipts/1/adjustments': () =>
          jsonResponse(
            { statusCode: 400, message: 'Adjustment notes can only be issued for fiscally locked receipts.' },
            400,
          ),
      }),
    );
    await expect(
      issueAdjustmentNote(1, { noteType: 'DEBIT_NOTE', adjustmentAmount: 1, reasonCode: 'OTHER' }),
    ).rejects.toThrow('Adjustment notes can only be issued for fiscally locked receipts.');
  });
});
