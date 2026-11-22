import React, { useMemo, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import {
  computeLineAmounts,
  formatMoney,
  formatQuantity,
  receiptOptionLabel,
} from '@/modules/core/billing-transactions/lib/receipt-item-math';
import type {
  CreateReceiptItemPayload,
  ReceiptItem,
  ReceiptOption,
  UpdateReceiptItemPayload,
} from '@/modules/core/billing-transactions/types/receipt-items';

export type ReceiptItemFormSubmit =
  | { mode: 'create'; payload: CreateReceiptItemPayload }
  | { mode: 'edit'; id: number; payload: UpdateReceiptItemPayload };

interface ReceiptItemFormDrawerProps {
  mode: 'create' | 'edit';
  item?: ReceiptItem | null;
  receipts: ReceiptOption[];
  receiptsLoading?: boolean;
  /** Pre-selected receipt when creating (e.g. the receipt filter in use). */
  defaultReceiptId?: number | null;
  submitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (submit: ReceiptItemFormSubmit) => void;
}

const numberToInput = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const inputClass =
  'w-full h-[38px] px-3 text-sm rounded-lg border bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] outline-none transition-all font-poppins focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 disabled:bg-[#f2ede5] disabled:text-[#5f5e5e] disabled:cursor-not-allowed';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1.5 font-poppins';

export const ReceiptItemFormDrawer: React.FC<ReceiptItemFormDrawerProps> = ({
  mode,
  item,
  receipts,
  receiptsLoading = false,
  defaultReceiptId,
  submitting,
  submitError,
  onCancel,
  onSubmit,
}) => {
  const isEdit = mode === 'edit' && item != null;
  const [receiptId, setReceiptId] = useState<string>(
    isEdit ? String(item.receipt_id) : defaultReceiptId ? String(defaultReceiptId) : '',
  );
  const [name, setName] = useState<string>(isEdit ? item.name : '');
  const [sku, setSku] = useState<string>(isEdit ? item.sku ?? '' : '');
  const [quantity, setQuantity] = useState<string>(isEdit ? numberToInput(item.quantity) : '1');
  const [unitPrice, setUnitPrice] = useState<string>(isEdit ? numberToInput(item.unit_price) : '');
  const [discountAmount, setDiscountAmount] = useState<string>(
    isEdit ? numberToInput(item.discount_amount) : '0',
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  // Live calculation: recomputed on every keystroke in quantity / unit price / discount.
  const amounts = useMemo(
    () => computeLineAmounts({ quantity, unitPrice, discountAmount }),
    [quantity, unitPrice, discountAmount],
  );

  const selectedReceipt = useMemo(
    () => receipts.find((r) => String(r.id) === receiptId) ?? null,
    [receipts, receiptId],
  );
  const currency = selectedReceipt?.currency ?? item?.currency ?? 'USD';

  const nameError = !name.trim()
    ? 'Description is required.'
    : name.trim().length > 255
      ? 'Description cannot exceed 255 characters.'
      : undefined;
  const skuError = sku.trim().length > 100 ? 'SKU cannot exceed 100 characters.' : undefined;
  const receiptError = !isEdit && !receiptId ? 'Select the receipt this line belongs to.' : undefined;

  const isValid = amounts.isValid && !nameError && !skuError && !receiptError;
  const show = (field: string) => attempted || touched[field];
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!isValid || submitting) return;

    const trimmedSku = sku.trim();
    const common = {
      name: name.trim(),
      quantity: amounts.quantity as number,
      unitPrice: amounts.unitPrice as number,
      discountAmount: amounts.discountAmount,
    };

    if (isEdit) {
      onSubmit({
        mode: 'edit',
        id: item.id,
        payload: { ...common, sku: trimmedSku ? trimmedSku : null },
      });
    } else {
      onSubmit({
        mode: 'create',
        payload: {
          receiptId: Number(receiptId),
          ...common,
          ...(trimmedSku ? { sku: trimmedSku } : {}),
        },
      });
    }
  };

  const fieldError = (message?: string, field?: string) =>
    message && field && show(field) ? (
      <p role="alert" className="mt-1 text-[11px] font-medium text-[#ba1a1a] font-poppins">
        {message}
      </p>
    ) : null;

  return (
    <SideDrawer
      title={isEdit ? `Edit line · ${item.name}` : 'New receipt line item'}
      subtitle={isEdit ? 'INVOICE LINE ITEM' : 'ADD LINE ITEM'}
      onClose={onCancel}
      closeDisabled={submitting}
      maxWidth={560}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 flex flex-col min-h-0 font-poppins"
        aria-label={isEdit ? 'Edit receipt item form' : 'Create receipt item form'}
      >
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Receipt */}
          <div>
            <label htmlFor="receipt-item-receipt" className={labelClass}>
              Receipt / Invoice
            </label>
            {isEdit ? (
              <input
                id="receipt-item-receipt"
                className={`${inputClass} border-[#d5cfc4]`}
                value={item.receipt_invoice_number ?? `Receipt #${item.receipt_id}`}
                disabled
                readOnly
              />
            ) : (
              <select
                id="receipt-item-receipt"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
                onBlur={() => markTouched('receipt')}
                disabled={receiptsLoading}
                className={`${inputClass} ${receiptError && show('receipt') ? 'border-[#ba1a1a]' : 'border-[#d5cfc4]'}`}
              >
                <option value="">{receiptsLoading ? 'Loading receipts…' : 'Select a receipt…'}</option>
                {receipts.map((r) => (
                  // Historia 11: un recibo bloqueado no admite líneas nuevas.
                  <option
                    key={r.id}
                    value={String(r.id)}
                    disabled={Boolean(r.is_locked) && String(r.id) !== receiptId}
                  >
                    {receiptOptionLabel(r)}
                    {r.is_locked ? ' — locked' : ''}
                  </option>
                ))}
              </select>
            )}
            {isEdit ? (
              <p className="mt-1 text-[11px] text-[#76736a]">
                A line cannot be moved to another receipt. Delete it and create it on the target receipt instead.
              </p>
            ) : null}
            {fieldError(receiptError, 'receipt')}
          </div>

          {/* Description + SKU */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="receipt-item-name" className={labelClass}>
                Description
              </label>
              <input
                id="receipt-item-name"
                value={name}
                maxLength={255}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched('name')}
                placeholder="e.g. Burger Combo"
                className={`${inputClass} ${nameError && show('name') ? 'border-[#ba1a1a]' : 'border-[#d5cfc4]'}`}
              />
              {fieldError(nameError, 'name')}
            </div>
            <div>
              <label htmlFor="receipt-item-sku" className={labelClass}>
                SKU
              </label>
              <input
                id="receipt-item-sku"
                value={sku}
                maxLength={100}
                onChange={(e) => setSku(e.target.value)}
                onBlur={() => markTouched('sku')}
                placeholder="Optional"
                className={`${inputClass} border-[#d5cfc4] font-mono`}
              />
              {fieldError(skuError, 'sku')}
            </div>
          </div>

          {/* Quantity / Unit price / Discount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="receipt-item-quantity" className={labelClass}>
                Quantity
              </label>
              <input
                id="receipt-item-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => markTouched('quantity')}
                className={`${inputClass} text-right tabular-nums ${
                  amounts.errors.quantity && show('quantity') ? 'border-[#ba1a1a]' : 'border-[#d5cfc4]'
                }`}
              />
              {fieldError(amounts.errors.quantity, 'quantity')}
            </div>
            <div>
              <label htmlFor="receipt-item-unit-price" className={labelClass}>
                Unit price ({currency})
              </label>
              <input
                id="receipt-item-unit-price"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                onBlur={() => markTouched('unitPrice')}
                placeholder="0.00"
                className={`${inputClass} text-right tabular-nums ${
                  amounts.errors.unitPrice && show('unitPrice') ? 'border-[#ba1a1a]' : 'border-[#d5cfc4]'
                }`}
              />
              {fieldError(amounts.errors.unitPrice, 'unitPrice')}
            </div>
            <div>
              <label htmlFor="receipt-item-discount" className={labelClass}>
                Discount ({currency})
              </label>
              <input
                id="receipt-item-discount"
                inputMode="decimal"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                onBlur={() => markTouched('discountAmount')}
                placeholder="0.00"
                className={`${inputClass} text-right tabular-nums ${
                  amounts.errors.discountAmount && (show('discountAmount') || amounts.subtotal !== null)
                    ? 'border-[#ba1a1a]'
                    : 'border-[#d5cfc4]'
                }`}
              />
              {/* The discount vs subtotal rule is shown as soon as it is broken: it depends on other fields. */}
              {amounts.errors.discountAmount && (show('discountAmount') || amounts.subtotal !== null) ? (
                <p role="alert" className="mt-1 text-[11px] font-medium text-[#ba1a1a] font-poppins">
                  {amounts.errors.discountAmount}
                </p>
              ) : null}
            </div>
          </div>

          {/* Live calculation */}
          <section
            aria-label="Line calculation"
            className="rounded-xl border border-[#e8e2d8] bg-[#fef9f1] p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">
              <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
                calculate
              </span>
              Live calculation
            </div>
            <div className="flex items-center justify-between text-sm text-[#1d1c17]">
              <span>
                Subtotal
                <span className="ml-1 text-[11px] text-[#76736a]">
                  {amounts.quantity !== null && amounts.unitPrice !== null
                    ? `(${formatQuantity(amounts.quantity)} × ${formatMoney(amounts.unitPrice, currency)})`
                    : '(quantity × unit price)'}
                </span>
              </span>
              <span data-testid="receipt-item-live-subtotal" className="font-semibold tabular-nums">
                {amounts.subtotal !== null ? formatMoney(amounts.subtotal, currency) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-[#1d1c17]">
              <span>Discount</span>
              <span data-testid="receipt-item-live-discount" className="tabular-nums text-[#5f5e5e]">
                − {formatMoney(amounts.discountAmount, currency)}
              </span>
            </div>
            <div className="border-t border-[#e8e2d8] pt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1d1c17]">Line total</span>
              <span data-testid="receipt-item-live-total" className="text-lg font-extrabold text-[#ae001a] tabular-nums">
                {amounts.total !== null ? formatMoney(amounts.total, currency) : '—'}
              </span>
            </div>
            <p className="text-[11px] text-[#76736a]">
              Subtotal is rounded to 2 decimals. The server recalculates the line and the receipt totals on save.
            </p>
          </section>

          {submitError ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#e8e2d8] bg-white px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 border border-[#e8e2d8] text-[#1d1c17] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || (attempted && !isValid)}
            className="px-5 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 rounded"
          >
            {submitting ? (
              <span className="material-symbols-outlined text-base animate-spin" aria-hidden="true">
                progress_activity
              </span>
            ) : null}
            {isEdit ? 'Save changes' : 'Add line item'}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
};

export default ReceiptItemFormDrawer;
