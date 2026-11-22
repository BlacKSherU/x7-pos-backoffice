import React from 'react';
import type { ReceiptDetails } from '../../types/receipts';
import { formatMoney, formatQuantity, formatRate } from '../../lib/receipts-format';

/** Estado de carga del detalle de una fila expandida (se pide al expandirla). */
export type ReceiptDetailsState =
  | { status: 'loading' }
  | { status: 'loaded'; data: ReceiptDetails }
  | { status: 'error'; message: string };

interface ReceiptLineDetailsProps {
  receiptId: number;
  label: string;
  currency: string;
  state: ReceiptDetailsState | undefined;
  onRetry: () => void;
}

const subHeader =
  'px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#5f5e5e] font-poppins whitespace-nowrap';
const subCell = 'px-3 py-2 text-[12.5px] text-[#1d1c17] font-poppins';

const SectionTitle: React.FC<{ icon: string; title: string; count?: number }> = ({ icon, title, count }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
      {icon}
    </span>
    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1d1c17] font-poppins">{title}</h4>
    {count !== undefined && (
      <span className="px-1.5 rounded-full bg-[#f1ece4] text-[10px] font-bold text-[#5f5e5e] font-poppins">{count}</span>
    )}
  </div>
);

/**
 * Sub-tabla maestro-detalle de un recibo: líneas (name, quantity, unit_price, total) e
 * impuestos (name, rate, amount). La fila la monta ReceiptsDataGrid al expandir.
 */
export const ReceiptLineDetails: React.FC<ReceiptLineDetailsProps> = ({
  receiptId,
  label,
  currency,
  state,
  onRetry,
}) => {
  if (!state || state.status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-[#5f5e5e] font-poppins py-2">
        <span className="material-symbols-outlined text-[16px] animate-spin text-[#ae001a]" aria-hidden="true">
          progress_activity
        </span>
        Loading items and taxes…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-red-700 font-poppins py-2">
        <span>{state.message}</span>
        <button
          type="button"
          onClick={onRetry}
          className="px-2.5 py-1 rounded border border-red-200 font-semibold text-[#ae001a] hover:bg-red-50 cursor-pointer font-poppins"
        >
          Retry
        </button>
      </div>
    );
  }

  const { items, taxes, items_total: itemsTotal, taxes_total: taxesTotal } = state.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 min-w-0">
      <section aria-label={`Line items of ${label}`} className="min-w-0">
        <SectionTitle icon="list" title="Line items" count={items.length} />
        <div className="bg-white border border-[#e8e2d8] rounded-lg overflow-x-auto">
          <table className="w-full border-collapse" aria-label={`Items of ${label}`}>
            <thead className="bg-[#f6f3ee] border-b border-[#e8e2d8]">
              <tr>
                <th className={`${subHeader} text-left`}>Item</th>
                <th className={`${subHeader} text-right`}>Qty</th>
                <th className={`${subHeader} text-right`}>Unit price</th>
                <th className={`${subHeader} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ebe3]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${subCell} text-center text-[#8c857b] italic`}>
                    No line items on this receipt.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} data-testid={`receipt-${receiptId}-item-${item.id}`}>
                    <td className={subCell}>
                      <div className="font-semibold">{item.name}</div>
                      {item.sku && <div className="text-[10.5px] text-[#8c857b] font-mono">{item.sku}</div>}
                    </td>
                    <td className={`${subCell} text-right tabular-nums`}>{formatQuantity(item.quantity)}</td>
                    <td className={`${subCell} text-right tabular-nums whitespace-nowrap`}>
                      {formatMoney(item.unit_price, currency)}
                    </td>
                    <td className={`${subCell} text-right tabular-nums whitespace-nowrap font-semibold`}>
                      {formatMoney(item.total, currency)}
                      {item.discount_amount > 0 && (
                        <div className="text-[10.5px] font-normal text-[#8c857b]">
                          −{formatMoney(item.discount_amount, currency)} discount
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="border-t border-[#e8e2d8] bg-[#faf8f5]">
                <tr>
                  <td colSpan={3} className={`${subCell} text-right text-[10.5px] font-bold uppercase tracking-wider text-[#5f5e5e]`}>
                    Items total
                  </td>
                  <td
                    className={`${subCell} text-right tabular-nums whitespace-nowrap font-bold`}
                    data-testid={`receipt-${receiptId}-items-total`}
                  >
                    {formatMoney(itemsTotal, currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section aria-label={`Tax lines of ${label}`} className="min-w-0">
        <SectionTitle icon="percent" title="Tax lines" count={taxes.length} />
        <div className="bg-white border border-[#e8e2d8] rounded-lg overflow-x-auto">
          <table className="w-full border-collapse" aria-label={`Taxes of ${label}`}>
            <thead className="bg-[#f6f3ee] border-b border-[#e8e2d8]">
              <tr>
                <th className={`${subHeader} text-left`}>Tax</th>
                <th className={`${subHeader} text-right`}>Rate</th>
                <th className={`${subHeader} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ebe3]">
              {taxes.length === 0 ? (
                <tr>
                  <td colSpan={3} className={`${subCell} text-center text-[#8c857b] italic`}>
                    No tax lines on this receipt.
                  </td>
                </tr>
              ) : (
                taxes.map((tax) => (
                  <tr key={tax.id} data-testid={`receipt-${receiptId}-tax-${tax.id}`}>
                    <td className={subCell}>
                      <div className="font-semibold">{tax.name}</div>
                      <div className="text-[10.5px] text-[#8c857b]">
                        {tax.scope === 'ITEM' && tax.receipt_item_id ? `Item #${tax.receipt_item_id}` : 'Receipt level'}
                      </div>
                    </td>
                    <td className={`${subCell} text-right tabular-nums`}>{formatRate(tax.rate)}</td>
                    <td className={`${subCell} text-right tabular-nums whitespace-nowrap font-semibold`}>
                      {formatMoney(tax.amount, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {taxes.length > 0 && (
              <tfoot className="border-t border-[#e8e2d8] bg-[#faf8f5]">
                <tr>
                  <td colSpan={2} className={`${subCell} text-right text-[10.5px] font-bold uppercase tracking-wider text-[#5f5e5e]`}>
                    Taxes total
                  </td>
                  <td
                    className={`${subCell} text-right tabular-nums whitespace-nowrap font-bold`}
                    data-testid={`receipt-${receiptId}-taxes-total`}
                  >
                    {formatMoney(taxesTotal, currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};

export default ReceiptLineDetails;
