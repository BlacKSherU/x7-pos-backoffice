import React from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import type { Receipt } from '../../types/receipts';
import {
  RECEIPT_TYPE_BADGE,
  RECEIPT_TYPE_LABELS,
  formatMoney,
  formatReceiptDate,
  parseFiscalData,
  receiptLabel,
} from '../../lib/receipts-format';

interface ReceiptDetailsDrawerProps {
  receipt: Receipt;
  onClose: () => void;
  onEdit: (receipt: Receipt) => void;
  onToggleStatus: (receipt: Receipt) => void;
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
}) => {
  const fiscalPairs = parseFiscalData(receipt.fiscal_data);
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
            <span
              className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${RECEIPT_TYPE_BADGE[receipt.type]}`}
            >
              {RECEIPT_TYPE_LABELS[receipt.type] ?? receipt.type}
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
              {receipt.is_locked && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                  Locked
                </span>
              )}
            </span>
          </Field>
          <Field label="Currency">{receipt.currency}</Field>
          <Field label="Issued">{formatReceiptDate(receipt.created_at)}</Field>
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
        </section>

        <section className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
          <h3 className="text-xs font-bold text-[#8c857b] uppercase tracking-wider border-b border-[#f2ede5] pb-2 mb-3 font-poppins">
            Fiscal data
          </h3>
          {fiscalPairs.length === 0 ? (
            <p className="text-sm text-[#8c857b]">No fiscal data recorded.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              {fiscalPairs.map(([key, value]) => (
                <Field key={key} label={key.replace(/_/g, ' ')}>
                  {value || '—'}
                </Field>
              ))}
            </dl>
          )}
        </section>

        <p className="text-[11px] text-[#8c857b]">Last updated {formatReceiptDate(receipt.updated_at)}</p>
      </div>

      <div className="p-4 border-t border-[#e8e2d8] bg-white flex justify-end gap-3 shrink-0 font-poppins">
        <button
          type="button"
          onClick={() => onToggleStatus(receipt)}
          className={`px-4 py-2 rounded border text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
            receipt.is_active
              ? 'border-red-200 text-red-700 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {receipt.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
        {receipt.is_active && (
          <button
            type="button"
            onClick={() => onEdit(receipt)}
            className="px-5 py-2 rounded bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Edit Receipt
          </button>
        )}
      </div>
    </SideDrawer>
  );
};

export default ReceiptDetailsDrawer;
