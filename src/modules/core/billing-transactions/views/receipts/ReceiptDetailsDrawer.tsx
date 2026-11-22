import React from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import type { Receipt } from '../../types/receipts';
import {
  RECEIPT_TYPE_BADGE,
  RECEIPT_TYPE_LABELS,
  formatAmount,
  formatMoney,
  formatReceiptDate,
  parseFiscalData,
  receiptLabel,
} from '../../lib/receipts-format';
import {
  FISCAL_STRUCTURED_KEYS,
  grandTotalBalance,
  isReceiptMutable,
  resolveTaxExemption,
} from '../../lib/receipt-fiscal';
import { FiscalLockBadge, TaxExemptBadge } from './ReceiptFiscalBadges';
import type { ReceiptAdjustments } from '../../types/receipt-adjustments';
import { canIssueAdjustment } from '../../lib/receipt-adjustments';
import { ReceiptAdjustmentNotesSection } from './ReceiptAdjustmentNotesSection';

interface ReceiptDetailsDrawerProps {
  receipt: Receipt;
  onClose: () => void;
  onEdit: (receipt: Receipt) => void;
  /** Baja lógica (solo recibos activos sin bloquear). */
  onToggleStatus: (receipt: Receipt) => void;
  /** LOCK RECEIPT (Historia 11). */
  onLock?: (receipt: Receipt) => void;
  /** VIEW ACTIVITY LOG (Historia 6). */
  onViewActivity?: (receipt: Receipt) => void;
  /** ISSUE ADJUSTMENT NOTE (Historia 7): solo recibos bloqueados. */
  onIssueAdjustment?: (receipt: Receipt) => void;
  /** Notas de crédito / débito del recibo (GET /billing/receipts/:id/adjustments). */
  loadAdjustments?: (receiptId: number) => Promise<ReceiptAdjustments>;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[10.5px] font-bold text-[#8c857b] uppercase tracking-wider font-poppins">{label}</p>
    <div className="mt-0.5 text-sm text-[#1d1c17] font-poppins break-words">{children}</div>
  </div>
);

/** Ficha de solo lectura de un recibo (montos con 2 decimales + moneda, fiscal_data, estado). */
export const ReceiptDetailsDrawer: React.FC<ReceiptDetailsDrawerProps> = ({
  receipt,
  onClose,
  onEdit,
  onToggleStatus,
  onLock,
  onViewActivity,
  onIssueAdjustment,
  loadAdjustments,
}) => {
  const mutable = isReceiptMutable(receipt);
  const exemption = resolveTaxExemption(receipt.fiscal_data);
  const balance = grandTotalBalance(receipt);
  // tax_id / exemption_code / tax_exempt tienen fila propia; el resto de claves se lista debajo.
  const fiscalPairs = parseFiscalData(receipt.fiscal_data).filter(
    ([key]) => !(FISCAL_STRUCTURED_KEYS as readonly string[]).includes(key),
  );
  const amounts: Array<[string, number]> = [
    ['Subtotal', receipt.subtotal],
    ['Taxes', receipt.total_tax],
    ['Discounts', -Math.abs(receipt.total_discount)],
  ];

  return (
    <SideDrawer title={receiptLabel(receipt)} subtitle="RECEIPT DETAILS" onClose={onClose} maxWidth={560}>
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 bg-[#faf8f5] font-poppins">
        <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs grid grid-cols-2 gap-4">
          <Field label="Invoice number">{receipt.invoice_number ?? '—'}</Field>
          <Field label="Order ID">#{receipt.order_id}</Field>
          <Field label="Type">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${RECEIPT_TYPE_BADGE[receipt.type]}`}
              >
                {RECEIPT_TYPE_LABELS[receipt.type] ?? receipt.type}
              </span>
              <TaxExemptBadge receipt={receipt} />
            </span>
          </Field>
          <Field label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  receipt.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {receipt.is_active ? 'Active' : 'Inactive'}
              </span>
              {receipt.is_locked && <FiscalLockBadge testId="receipt-detail-locked" />}
            </span>
          </Field>
          <Field label="Currency">{receipt.currency}</Field>
          <Field label="Issued">{formatReceiptDate(receipt.created_at)}</Field>
          {receipt.is_locked && (
            <Field label="Locked by">
              <span data-testid="receipt-detail-locked-by">
                {receipt.processed_by_user_id ? `User #${receipt.processed_by_user_id}` : 'Unknown user'}
                {receipt.processed_by_role ? ` · ${receipt.processed_by_role}` : ''}
              </span>
            </Field>
          )}
        </section>

        <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
          <h3 className="text-xs font-bold text-[#8c857b] uppercase tracking-wider border-b border-[#f2ede5] pb-2 mb-3 font-poppins">
            Amounts
          </h3>
          <dl className="space-y-2 text-sm">
            {amounts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#5f5e5e]">{label}</dt>
                <dd className="tabular-nums text-[#1d1c17]">{formatMoney(value, receipt.currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-[#f2ede5] pt-2">
              <dt className="font-bold text-[#1d1c17]">Grand total</dt>
              <dd className="tabular-nums font-bold text-[#ae001a]" data-testid="receipt-detail-grand-total">
                {formatMoney(receipt.grand_total, receipt.currency)}
              </dd>
            </div>
          </dl>
          <div
            data-testid="receipt-detail-balance"
            data-balanced={balance.balanced ? 'true' : 'false'}
            className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] ${
              balance.balanced
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {balance.balanced ? 'check_circle' : 'error'}
            </span>
            <span className="tabular-nums">
              <span className="block font-semibold">
                {formatAmount(receipt.subtotal)} + {formatAmount(receipt.total_tax)} −{' '}
                {formatAmount(Math.abs(receipt.total_discount))} = {formatAmount(balance.expected)}{' '}
                {receipt.currency}
              </span>
              {balance.balanced
                ? 'Subtotal + tax − discount matches the grand total to the cent.'
                : `Grand total differs by ${formatMoney(balance.differenceCents / 100, receipt.currency)} from subtotal + tax − discount.`}
            </span>
          </div>
          {exemption.exempt && (
            <p className="mt-2 text-[11.5px] text-sky-800" data-testid="receipt-detail-exemption-note">
              Tax exemption {exemption.exemptionCode ?? ''} applied: total tax and every active tax line are 0.00.
            </p>
          )}
        </section>

        <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
          <h3 className="text-xs font-bold text-[#8c857b] uppercase tracking-wider border-b border-[#f2ede5] pb-2 mb-3 font-poppins">
            Fiscal data
          </h3>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Tax ID">{exemption.taxId ?? '—'}</Field>
            <Field label="Exemption code">{exemption.exemptionCode ?? '—'}</Field>
            <Field label="Tax exempt">
              <span data-testid="receipt-detail-tax-exempt">{exemption.exempt ? 'Yes' : 'No'}</span>
            </Field>
            {fiscalPairs.map(([key, value]) => (
              <Field key={key} label={key.replace(/_/g, ' ')}>
                {value || '—'}
              </Field>
            ))}
          </dl>
        </section>

        {/* Historia 7: solo un recibo bloqueado puede tener notas de ajuste. */}
        {loadAdjustments && receipt.is_locked && (
          <ReceiptAdjustmentNotesSection
            receiptId={receipt.id}
            currency={receipt.currency}
            loadAdjustments={loadAdjustments}
          />
        )}

        <p className="text-[11px] text-[#8c857b]">Last updated {formatReceiptDate(receipt.updated_at)}</p>
      </div>

      <div className="p-4 border-t border-[#e8e2d8] bg-white flex flex-wrap justify-end gap-3 shrink-0 font-poppins">
        {onViewActivity && (
          <button
            type="button"
            onClick={() => onViewActivity(receipt)}
            className="mr-auto px-4 py-2 rounded border border-[#e8e2d8] text-[#1d1c17] hover:border-[#ae001a] hover:text-[#ae001a] text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              history
            </span>
            VIEW ACTIVITY LOG
          </button>
        )}
        {mutable ? (
          <>
            <button
              type="button"
              onClick={() => onToggleStatus(receipt)}
              className="px-4 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Deactivate
            </button>
            {onLock && (
              <button
                type="button"
                onClick={() => onLock(receipt)}
                className="px-4 py-2 rounded border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  lock
                </span>
                LOCK RECEIPT
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(receipt)}
              className="px-5 py-2 rounded bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Edit Receipt
            </button>
          </>
        ) : (
          <>
            <p className="mr-auto self-center text-[11px] text-[#8c857b]" data-testid="receipt-detail-immutable">
              {receipt.is_locked
                ? 'Fiscally locked: corrections go through credit / debit notes.'
                : 'Logically deleted receipts are kept for the financial history and cannot be modified.'}
            </p>
            {onIssueAdjustment && canIssueAdjustment(receipt) && (
              <button
                type="button"
                onClick={() => onIssueAdjustment(receipt)}
                className="px-5 py-2 rounded bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  receipt_long
                </span>
                ISSUE ADJUSTMENT NOTE
              </button>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  );
};

export default ReceiptDetailsDrawer;
