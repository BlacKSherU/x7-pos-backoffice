import React, { useEffect, useMemo, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import {
  fetchReceiptItemOptions,
  fetchReceiptOptions,
} from '../../api/receipt-taxes-api';
import type {
  CreateReceiptTaxPayload,
  ReceiptItemOption,
  ReceiptOption,
  ReceiptTax,
  ReceiptTaxScope,
  UpdateReceiptTaxPayload,
} from '../../types/receipt-taxes';
import {
  formatMoney,
  itemTaxableBase,
  previewTaxAmount,
  receiptLabel,
  validateAmountPreview,
  validateRateInput,
} from './receiptTaxesHelpers';

export type ReceiptTaxFormPayload = CreateReceiptTaxPayload | UpdateReceiptTaxPayload;

interface ReceiptTaxFormDrawerProps {
  mode: 'create' | 'edit';
  initialTax?: ReceiptTax | null;
  submitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (payload: ReceiptTaxFormPayload) => void;
}

const FIELD_CLASS =
  'bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-sm focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full font-poppins disabled:bg-[#f4efe6] disabled:text-[#5f5e5e]';
const LABEL_CLASS = 'text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider font-poppins';

const SCOPE_OPTIONS: Array<{ value: ReceiptTaxScope; title: string; icon: string; description: string }> = [
  {
    value: 'RECEIPT',
    title: 'Global receipt',
    icon: 'receipt_long',
    description: 'Charged once over the receipt subtotal (e.g. VAT on the whole sale).',
  },
  {
    value: 'ITEM',
    title: 'Specific item',
    icon: 'list_alt',
    description: 'Charged over the taxable base of one line (subtotal minus its discount).',
  },
];

export const ReceiptTaxFormDrawer: React.FC<ReceiptTaxFormDrawerProps> = ({
  mode,
  initialTax,
  submitting,
  submitError,
  onCancel,
  onSubmit,
}) => {
  const isEdit = mode === 'edit' && !!initialTax;

  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  const [items, setItems] = useState<ReceiptItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [receiptId, setReceiptId] = useState<string>(initialTax ? String(initialTax.receipt_id) : '');
  const [scope, setScope] = useState<ReceiptTaxScope>(initialTax?.scope ?? 'RECEIPT');
  const [itemId, setItemId] = useState<string>(
    initialTax?.receipt_item_id ? String(initialTax.receipt_item_id) : '',
  );
  const [name, setName] = useState<string>(initialTax?.name ?? '');
  const [rate, setRate] = useState<string>(initialTax ? String(initialTax.rate) : '');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReceiptOptions()
      .then((list) => {
        if (!cancelled) setReceipts(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setReceiptsError(err instanceof Error ? err.message : 'Failed to load receipts.');
      })
      .finally(() => {
        if (!cancelled) setReceiptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!receiptId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setItemsLoading(true);
      setItemsError(null);
    });
    fetchReceiptItemOptions(Number(receiptId))
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setItems([]);
          setItemsError(err instanceof Error ? err.message : 'Failed to load receipt items.');
        }
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  const selectedReceipt = useMemo(
    () => receipts.find((r) => String(r.id) === receiptId) ?? null,
    [receipts, receiptId],
  );
  const selectedItem = useMemo(
    () => items.find((i) => String(i.id) === itemId) ?? null,
    [items, itemId],
  );
  const currency = selectedReceipt?.currency ?? initialTax?.currency ?? 'USD';

  const rateError = validateRateInput(rate);
  const nameError = name.trim() ? null : 'Tax name is required.';
  const receiptError = receiptId ? null : 'Select the receipt this tax belongs to.';
  const itemError = scope === 'ITEM' && !itemId ? 'Select the receipt item this tax applies to.' : null;

  const taxableBase: number | null =
    scope === 'ITEM'
      ? selectedItem
        ? itemTaxableBase(selectedItem)
        : null
      : selectedReceipt
        ? selectedReceipt.subtotal
        : null;
  const estimatedAmount = taxableBase !== null && !rateError ? previewTaxAmount(taxableBase, Number(rate)) : null;
  const amountError = estimatedAmount !== null ? validateAmountPreview(estimatedAmount) : null;

  const isValid = !rateError && !nameError && !receiptError && !itemError && !amountError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || submitting) return;
    const base = {
      name: name.trim(),
      rate: Number(rate),
      scope,
      ...(scope === 'ITEM' ? { receiptItemId: Number(itemId) } : {}),
    };
    onSubmit(isEdit ? base : { receiptId: Number(receiptId), ...base });
  };

  const showError = (error: string | null) => touched && error;

  return (
    <SideDrawer
      title={isEdit ? 'Edit Receipt Tax' : 'New Receipt Tax'}
      subtitle="RECEIPT TAXES"
      onClose={onCancel}
      closeDisabled={submitting}
      maxWidth={560}
    >
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 text-left font-poppins" noValidate>
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {submitError && (
            <div className="border border-red-300 bg-red-50 px-4 py-3 rounded text-sm text-red-700" role="alert">
              {submitError}
            </div>
          )}

          {/* Receipt */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rt-receipt" className={LABEL_CLASS}>
              Receipt
            </label>
            {isEdit ? (
              <input
                id="rt-receipt"
                type="text"
                disabled
                value={
                  initialTax?.receipt_invoice_number
                    ? initialTax.receipt_invoice_number
                    : `Receipt #${initialTax?.receipt_id}`
                }
                className={FIELD_CLASS}
              />
            ) : (
              <select
                id="rt-receipt"
                value={receiptId}
                onChange={(e) => {
                  setReceiptId(e.target.value);
                  setItemId('');
                  setItems([]);
                }}
                disabled={receiptsLoading}
                className={FIELD_CLASS}
              >
                <option value="">{receiptsLoading ? 'Loading receipts…' : 'Select a receipt'}</option>
                {receipts.map((r) => (
                  // Historia 11: un recibo bloqueado no admite impuestos nuevos.
                  <option key={r.id} value={r.id} disabled={Boolean(r.is_locked) && String(r.id) !== receiptId}>
                    {receiptLabel(r)} — subtotal {formatMoney(r.subtotal, r.currency)}
                    {r.is_locked ? ' — locked' : ''}
                  </option>
                ))}
              </select>
            )}
            {receiptsError && <p className="text-xs text-red-600">{receiptsError}</p>}
            {showError(receiptError) && <p className="text-xs text-red-600 font-medium">{receiptError}</p>}
          </div>

          {/* Scope */}
          <fieldset className="flex flex-col gap-2">
            <legend className={`${LABEL_CLASS} mb-1.5`}>Tax scope</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCOPE_OPTIONS.map((option) => {
                const checked = scope === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'border-[#ae001a] bg-[#ae001a]/5' : 'border-[#e8e2d8] hover:border-[#ae001a]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rt-scope"
                      value={option.value}
                      checked={checked}
                      onChange={() => setScope(option.value)}
                      className="mt-1 accent-[#ae001a]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-sm font-semibold text-[#1d1c17]">
                        <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
                          {option.icon}
                        </span>
                        {option.title}
                      </span>
                      <span className="block text-[11px] text-[#5f5e5e] mt-0.5 leading-snug">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Item selector (ITEM scope) */}
          {scope === 'ITEM' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rt-item" className={LABEL_CLASS}>
                Receipt item
              </label>
              <select
                id="rt-item"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                disabled={!receiptId || itemsLoading}
                className={FIELD_CLASS}
              >
                <option value="">
                  {!receiptId
                    ? 'Select a receipt first'
                    : itemsLoading
                      ? 'Loading items…'
                      : items.length === 0
                        ? 'This receipt has no active items'
                        : 'Select an item'}
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ''} — base {formatMoney(itemTaxableBase(item), currency)}
                  </option>
                ))}
              </select>
              {itemsError && <p className="text-xs text-red-600">{itemsError}</p>}
              {showError(itemError) && <p className="text-xs text-red-600 font-medium">{itemError}</p>}
            </div>
          )}

          {/* Name + rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rt-name" className={LABEL_CLASS}>
                Tax name
              </label>
              <input
                id="rt-name"
                type="text"
                value={name}
                maxLength={150}
                placeholder="e.g. VAT 19%"
                onChange={(e) => setName(e.target.value)}
                className={FIELD_CLASS}
              />
              {showError(nameError) && <p className="text-xs text-red-600 font-medium">{nameError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rt-rate" className={LABEL_CLASS}>
                Rate (%)
              </label>
              <input
                id="rt-rate"
                type="text"
                inputMode="decimal"
                value={rate}
                placeholder="19.00"
                onChange={(e) => setRate(e.target.value)}
                className={FIELD_CLASS}
              />
              {(touched || rate) && rateError && <p className="text-xs text-red-600 font-medium">{rateError}</p>}
            </div>
          </div>

          {/* Amount preview */}
          <div className="rounded-lg border border-[#e8e2d8] bg-[#fef9f1] p-4" data-testid="rt-amount-preview">
            <div className="flex items-center justify-between gap-3">
              <span className={LABEL_CLASS}>Taxable base</span>
              <span className="text-sm font-semibold text-[#1d1c17]">
                {taxableBase !== null ? formatMoney(taxableBase, currency) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className={LABEL_CLASS}>Estimated tax amount</span>
              <span className="text-lg font-extrabold text-[#ae001a]">
                {estimatedAmount !== null ? formatMoney(estimatedAmount, currency) : '—'}
              </span>
            </div>
            <p className="text-[11px] text-[#5f5e5e] mt-2 leading-snug">
              The final amount is calculated by the server ({scope === 'ITEM' ? 'item subtotal minus discount' : 'receipt subtotal'} × rate),
              rounded to the cent, and the receipt totals are updated as soon as you save.
            </p>
            {amountError && <p className="text-xs text-red-600 font-medium mt-1">{amountError}</p>}
          </div>
        </div>

        <div className="p-4 border-t border-[#e8e2d8] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-[#e8e2d8] text-[#5f5e5e] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest transition-colors"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tax'}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
};

export default ReceiptTaxFormDrawer;
