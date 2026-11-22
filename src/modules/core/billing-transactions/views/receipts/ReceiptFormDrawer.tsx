import React, { useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { FormField, ModalFormError, ModalFormFooter } from '@/shared/components/AppModal';
import type {
  CreateReceiptPayload,
  Receipt,
  ReceiptType,
  UpdateReceiptPayload,
} from '../../types/receipts';
import { receiptLabel, validateFiscalDataInput } from '../../lib/receipts-format';

export type ReceiptFormMode = 'create' | 'edit';

interface ReceiptFormDrawerProps {
  mode: ReceiptFormMode;
  receipt?: Receipt | null;
  /** Lanza si falla: el mensaje (p. ej. el 409 de número de factura duplicado) se muestra en el panel. */
  onSubmit: (payload: CreateReceiptPayload | UpdateReceiptPayload) => Promise<void>;
  onClose: () => void;
}

interface FormErrors {
  orderId?: string;
  currency?: string;
  invoiceNumber?: string;
  fiscalData?: string;
}

/** Texto JSON con sangría para editar fiscal_data cómodamente. */
function prettyFiscalData(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Mismo JSON aunque cambien espacios/sangría: no se envía como cambio. */
function sameJson(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return a.trim() === b.trim();
  }
}

/**
 * Alta / edición de un recibo. En edición solo se envían los campos modificados (PATCH).
 * El número de factura es único por merchant: el back-end responde 409 si ya existe y el
 * mensaje se muestra aquí sin cerrar el panel.
 */
export const ReceiptFormDrawer: React.FC<ReceiptFormDrawerProps> = ({ mode, receipt, onSubmit, onClose }) => {
  const isEdit = mode === 'edit' && Boolean(receipt);
  const [orderId, setOrderId] = useState<string>(receipt ? String(receipt.order_id) : '');
  const [type, setType] = useState<ReceiptType>(receipt?.type ?? 'RECEIPT');
  const [currency, setCurrency] = useState<string>(receipt?.currency ?? 'USD');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(receipt?.invoice_number ?? '');
  const [fiscalData, setFiscalData] = useState<string>(prettyFiscalData(receipt?.fiscal_data));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const parsedOrder = Number(orderId);
    if (!orderId.trim() || !Number.isInteger(parsedOrder) || parsedOrder <= 0) {
      next.orderId = 'Enter a valid order ID.';
    }
    if (!currency.trim()) next.currency = 'Currency is required.';
    else if (currency.trim().length > 10) next.currency = 'Use an ISO 4217 code (max 10 characters).';
    if (invoiceNumber.trim().length > 50) next.invoiceNumber = 'Invoice number is limited to 50 characters.';
    if (isEdit && receipt?.invoice_number && !invoiceNumber.trim()) {
      next.invoiceNumber = 'An issued invoice number cannot be cleared.';
    }
    const fiscalError = validateFiscalDataInput(fiscalData);
    if (fiscalError) next.fiscalData = fiscalError;
    return next;
  };

  const buildPayload = (): CreateReceiptPayload | UpdateReceiptPayload => {
    const normalizedCurrency = currency.trim().toUpperCase();
    const trimmedInvoice = invoiceNumber.trim();
    const compactFiscal = fiscalData.trim() ? JSON.stringify(JSON.parse(fiscalData)) : '';

    if (!isEdit || !receipt) {
      const payload: CreateReceiptPayload = {
        orderId: Number(orderId),
        type,
        currency: normalizedCurrency,
      };
      if (compactFiscal) payload.fiscalData = compactFiscal;
      if (trimmedInvoice) payload.invoiceNumber = trimmedInvoice;
      return payload;
    }

    const changes: UpdateReceiptPayload = {};
    if (Number(orderId) !== receipt.order_id) changes.orderId = Number(orderId);
    if (type !== receipt.type) changes.type = type;
    if (normalizedCurrency !== receipt.currency) changes.currency = normalizedCurrency;
    if (trimmedInvoice && trimmedInvoice !== (receipt.invoice_number ?? '')) changes.invoiceNumber = trimmedInvoice;
    if (!sameJson(compactFiscal, receipt.fiscal_data ?? '')) changes.fiscalData = compactFiscal;
    return changes;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = buildPayload();
    if (isEdit && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The receipt could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      title={isEdit && receipt ? `Edit ${receiptLabel(receipt)}` : 'New Receipt'}
      subtitle={isEdit ? 'UPDATE RECEIPT' : 'ISSUE RECEIPT'}
      onClose={onClose}
      closeDisabled={submitting}
      maxWidth={560}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 bg-[#faf8f5] font-poppins">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {submitError && <ModalFormError message={submitError} />}

          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="receipt-order-id"
                label="Order ID *"
                type="number"
                value={orderId}
                onChange={setOrderId}
                error={errors.orderId}
                placeholder="e.g. 1024"
              />
              <div className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor="receipt-type" className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                  Type *
                </label>
                <select
                  id="receipt-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ReceiptType)}
                  className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]"
                >
                  <option value="RECEIPT">Receipt</option>
                  <option value="INVOICE">Invoice</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="receipt-currency"
                label="Currency *"
                value={currency}
                onChange={setCurrency}
                error={errors.currency}
                placeholder="USD"
              />
              <FormField
                id="receipt-invoice-number"
                label="Invoice number"
                value={invoiceNumber}
                onChange={setInvoiceNumber}
                error={errors.invoiceNumber}
                placeholder={isEdit ? '' : 'Auto-assigned (INV-######)'}
              />
            </div>
            <p className="text-[11px] text-[#8c857b]">
              Invoice numbers are unique per merchant. Leave it empty on creation to receive the next sequential
              number.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs space-y-2">
            <label htmlFor="receipt-fiscal-data" className="text-[11px] font-bold text-[#5f5e5e] uppercase">
              Fiscal data (JSON)
            </label>
            <textarea
              id="receipt-fiscal-data"
              value={fiscalData}
              onChange={(e) => setFiscalData(e.target.value)}
              rows={6}
              placeholder='{"tax_id": "12345678", "fiscal_number": "ABC123"}'
              aria-invalid={Boolean(errors.fiscalData)}
              className={`w-full font-mono text-xs bg-white text-[#1d1c17] px-3 py-2 border rounded outline-none ${
                errors.fiscalData
                  ? 'border-error focus:ring-1 focus:ring-error'
                  : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]'
              }`}
            />
            {errors.fiscalData && (
              <p className="text-body-sm text-error" role="alert">
                {errors.fiscalData}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-white">
          <ModalFormFooter
            onCancel={onClose}
            submitLabel={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Receipt'}
            isSubmitting={submitting}
          />
        </div>
      </form>
    </SideDrawer>
  );
};

export default ReceiptFormDrawer;
