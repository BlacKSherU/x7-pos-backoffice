import React, { useEffect, useMemo, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { FormField, ModalFormError, ModalFormFooter } from '@/shared/components/AppModal';
import { SearchableSelect, type SearchableSelectOption } from '@/shared/components/SearchableSelect';
import { ISO_4217_CODES, currencyOptionLabel } from '@/modules/platform-saas/companies/lib/iso-currencies';
import { listReceiptOrderOptions } from '../../api/receipts-api';
import type {
  CreateReceiptPayload,
  Receipt,
  ReceiptOrderOption,
  ReceiptType,
  UpdateReceiptPayload,
} from '../../types/receipts';
import { RECEIPT_TYPE_LABELS, formatMoney, receiptLabel } from '../../lib/receipts-format';
import {
  FISCAL_DATA_MAX_FIELD_LENGTH,
  buildFiscalData,
  sameFiscalData,
  splitFiscalData,
  validateFiscalDataPayload,
  validateFiscalForm,
  type FiscalFormState,
} from '../../lib/receipt-fiscal';

export type ReceiptFormMode = 'create' | 'edit';

/** Espera antes de pedir al back-end las órdenes que coinciden con lo escrito. */
const ORDER_SEARCH_DEBOUNCE_MS = 250;
/** Moneda si la company no tiene moneda base. */
const FALLBACK_CURRENCY = 'USD';

const CURRENCY_OPTIONS: SearchableSelectOption[] = ISO_4217_CODES.map((code) => ({
  value: code,
  label: currencyOptionLabel(code),
}));

const ORDER_STATUS_LABEL = (status: string) => status.replace(/_/g, ' ');

/** Opción del selector de órdenes: número de orden + ID, y cliente · total · estado debajo. */
function orderOption(order: ReceiptOrderOption, currency: string): SearchableSelectOption {
  const issued = order.issued_types.map((type) => RECEIPT_TYPE_LABELS[type]).join(' / ');
  return {
    value: String(order.id),
    label: `Order #${order.order_number} · ID ${order.id}`,
    description: [
      order.customer_name ?? 'No customer',
      formatMoney(order.total, currency),
      ORDER_STATUS_LABEL(order.status),
      issued ? `already has ${issued}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

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
  taxId?: string;
  exemptionCode?: string;
  fiscalExtra?: string;
  fiscalData?: string;
}

interface ReceiptFiscalDataSectionProps {
  fiscal: FiscalFormState;
  errors: FormErrors;
  onChange: (next: FiscalFormState) => void;
}

/**
 * Datos fiscales del recibo (Historia 10): tax_id, exemption_code y tax_exempt con campos
 * propios; el resto de claves de fiscal_data se conserva en un JSON adicional. Marcar la
 * exención exige el código del certificado; el back-end pone entonces total_tax = 0.
 */
const ReceiptFiscalDataSection: React.FC<ReceiptFiscalDataSectionProps> = ({ fiscal, errors, onChange }) => {
  const update = (patch: Partial<FiscalFormState>) => onChange({ ...fiscal, ...patch });
  return (
    <section
      aria-labelledby="receipt-fiscal-heading"
      className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="receipt-fiscal-heading"
          className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
            account_balance
          </span>
          Fiscal data
        </h3>
        {fiscal.taxExempt && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-800 text-[10px] font-bold uppercase tracking-wider"
            data-testid="receipt-form-exempt-badge"
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              verified_user
            </span>
            TAX EXEMPT
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="receipt-tax-id"
          label="Tax ID"
          value={fiscal.taxId}
          onChange={(taxId) => update({ taxId })}
          error={errors.taxId}
          placeholder="e.g. J-12345678-9"
        />
        <FormField
          id="receipt-exemption-code"
          label={fiscal.taxExempt ? 'Exemption code *' : 'Exemption code'}
          value={fiscal.exemptionCode}
          onChange={(exemptionCode) => update({ exemptionCode })}
          error={errors.exemptionCode}
          placeholder="e.g. EX-2026-001"
        />
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={fiscal.taxExempt}
          onChange={(e) => update({ taxExempt: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#ae001a] cursor-pointer"
        />
        <span className="text-sm text-[#1d1c17]">
          <span className="font-semibold">Tax exempt customer</span>
          <span className="block text-[11px] text-[#8c857b]">
            {fiscal.taxExempt
              ? 'Total tax will be 0.00 and every active tax line on this receipt is set to 0.00.'
              : 'Taxes are calculated normally. Unchecking keeps the exemption code on record but suspends it.'}
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <label htmlFor="receipt-fiscal-data" className="text-[11px] font-bold text-[#5f5e5e] uppercase">
          Additional fiscal data (JSON)
        </label>
        <textarea
          id="receipt-fiscal-data"
          value={fiscal.extra}
          onChange={(e) => update({ extra: e.target.value })}
          rows={4}
          placeholder='{"fiscal_number": "F001-1"}'
          aria-invalid={Boolean(errors.fiscalExtra)}
          className={`w-full font-mono text-xs bg-white text-[#1d1c17] px-3 py-2 border rounded outline-none ${
            errors.fiscalExtra
              ? 'border-error focus:ring-1 focus:ring-error'
              : 'border-[#e8e2d8] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]'
          }`}
        />
        {errors.fiscalExtra && (
          <p className="text-body-sm text-error" role="alert">
            {errors.fiscalExtra}
          </p>
        )}
      </div>
      {errors.fiscalData && (
        <p className="text-body-sm text-error" role="alert">
          {errors.fiscalData}
        </p>
      )}
      <p className="text-[11px] text-[#8c857b]">
        Tax ID and exemption code accept up to {FISCAL_DATA_MAX_FIELD_LENGTH} characters. Other keys are stored as
        they are.
      </p>
    </section>
  );
};

/**
 * Alta / edición de un recibo. En edición solo se envían los campos modificados (PATCH).
 * El número de factura es único por merchant: el back-end responde 409 si ya existe y el
 * mensaje se muestra aquí sin cerrar el panel.
 */
export const ReceiptFormDrawer: React.FC<ReceiptFormDrawerProps> = ({ mode, receipt, onSubmit, onClose }) => {
  const isEdit = mode === 'edit' && Boolean(receipt);
  const [orderId, setOrderId] = useState<string>(receipt ? String(receipt.order_id) : '');
  const [type, setType] = useState<ReceiptType>(receipt?.type ?? 'RECEIPT');
  const [currency, setCurrency] = useState<string>(receipt?.currency ?? '');
  const [orderOptions, setOrderOptions] = useState<ReceiptOrderOption[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrderOption | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(receipt?.invoice_number ?? '');
  const [fiscal, setFiscal] = useState<FiscalFormState>(() => splitFiscalData(receipt?.fiscal_data));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editingOrderId = isEdit ? receipt?.order_id : undefined;

  // Órdenes facturables con el tipo elegido (el back-end deja fuera las que ya tienen un recibo
  // activo de ese tipo); en edición siempre incluye la orden del recibo.
  useEffect(() => {
    let cancelled = false;
    setOrdersLoading(true);
    const timer = setTimeout(() => {
      listReceiptOrderOptions({ search: orderSearch, type, includeOrderId: editingOrderId })
        .then((result) => {
          if (cancelled) return;
          setOrderOptions(result.orders);
          setDefaultCurrency(result.default_currency);
          setOrdersError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setOrderOptions([]);
          setOrdersError(err instanceof Error ? err.message : 'Orders could not be loaded.');
        })
        .finally(() => {
          if (!cancelled) setOrdersLoading(false);
        });
    }, orderSearch ? ORDER_SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderSearch, type, editingOrderId]);

  // Recibo nuevo: la moneda arranca en la moneda base de la company.
  useEffect(() => {
    if (isEdit || currency || ordersLoading) return;
    setCurrency(defaultCurrency ?? FALLBACK_CURRENCY);
  }, [isEdit, currency, ordersLoading, defaultCurrency]);

  const handleTypeChange = (next: ReceiptType) => {
    setType(next);
    // La orden elegida ya tiene un recibo de ese tipo: el alta respondería 409.
    if (selectedOrder && Number(orderId) !== editingOrderId && selectedOrder.issued_types.includes(next)) {
      setOrderId('');
      setSelectedOrder(null);
    }
  };

  const optionCurrency = currency || defaultCurrency || FALLBACK_CURRENCY;
  const orderSelectOptions = useMemo(
    () => orderOptions.map((order) => orderOption(order, optionCurrency)),
    [orderOptions, optionCurrency],
  );
  const currencyOptions = useMemo(
    () =>
      currency && !ISO_4217_CODES.includes(currency)
        ? [{ value: currency, label: currency }, ...CURRENCY_OPTIONS]
        : CURRENCY_OPTIONS,
    [currency],
  );
  const selectedOrderLabel = selectedOrder
    ? orderOption(selectedOrder, optionCurrency).label
    : orderId
      ? `Order ID ${orderId}`
      : undefined;

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const parsedOrder = Number(orderId);
    if (!orderId.trim() || !Number.isInteger(parsedOrder) || parsedOrder <= 0) {
      next.orderId = 'Select the order to bill.';
    }
    if (!currency.trim()) next.currency = 'Select a currency.';
    else if (currency.trim().length > 10) next.currency = 'Use an ISO 4217 code (max 10 characters).';
    if (invoiceNumber.trim().length > 50) next.invoiceNumber = 'Invoice number is limited to 50 characters.';
    if (isEdit && receipt?.invoice_number && !invoiceNumber.trim()) {
      next.invoiceNumber = 'An issued invoice number cannot be cleared.';
    }
    // Datos fiscales (Historia 10): mismas reglas que el back-end, campo por campo y sobre el
    // payload final (tax_id / exemption_code ≤ 64, tax_exempt ⇒ exemption_code).
    const fiscalErrors = validateFiscalForm(fiscal);
    if (fiscalErrors.taxId) next.taxId = fiscalErrors.taxId;
    if (fiscalErrors.exemptionCode) next.exemptionCode = fiscalErrors.exemptionCode;
    if (fiscalErrors.extra) next.fiscalExtra = fiscalErrors.extra;
    if (Object.keys(fiscalErrors).length === 0) {
      const payloadError = validateFiscalDataPayload(buildFiscalData(fiscal, receipt?.fiscal_data));
      if (payloadError) next.fiscalData = payloadError;
    }
    return next;
  };

  const buildPayload = (): CreateReceiptPayload | UpdateReceiptPayload => {
    const normalizedCurrency = currency.trim().toUpperCase();
    const trimmedInvoice = invoiceNumber.trim();
    const compactFiscal = buildFiscalData(fiscal, receipt?.fiscal_data);

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
    if (!sameFiscalData(compactFiscal, receipt.fiscal_data)) changes.fiscalData = compactFiscal;
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
              <SearchableSelect
                id="receipt-order-id"
                label="Order *"
                value={orderId}
                options={orderSelectOptions}
                selectedLabel={selectedOrderLabel}
                onChange={(value) => {
                  setOrderId(value);
                  setSelectedOrder(orderOptions.find((order) => String(order.id) === value) ?? null);
                  setErrors((prev) => ({ ...prev, orderId: undefined }));
                }}
                onSearch={setOrderSearch}
                loading={ordersLoading}
                placeholder="Select an order"
                searchPlaceholder="Order number, ID or customer"
                emptyMessage={
                  ordersError ?? `No orders left to bill as ${RECEIPT_TYPE_LABELS[type].toLowerCase()}.`
                }
                error={errors.orderId}
              />
              <div className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor="receipt-type" className="text-[11px] font-bold text-[#5f5e5e] uppercase">
                  Type *
                </label>
                <select
                  id="receipt-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as ReceiptType)}
                  className="bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]"
                >
                  <option value="RECEIPT">Receipt</option>
                  <option value="INVOICE">Invoice</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SearchableSelect
                id="receipt-currency"
                label="Currency *"
                value={currency}
                options={currencyOptions}
                onChange={(value) => {
                  setCurrency(value);
                  setErrors((prev) => ({ ...prev, currency: undefined }));
                }}
                placeholder={ordersLoading ? 'Loading…' : 'Select a currency'}
                searchPlaceholder="Code or name (CLP, peso…)"
                emptyMessage="No currency matches."
                error={errors.currency}
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

          <ReceiptFiscalDataSection fiscal={fiscal} errors={errors} onChange={setFiscal} />
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
