// Drawer "LINK CUSTOMER PROFILE": elige un recibo y el cliente o proveedor al que se asigna.
// Lo abren el header (sin recibo, hay que buscarlo) y el grid (con el recibo ya elegido,
// para asignar o reasignar rápido).

import React, { useEffect, useId, useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { ModalFormError } from '@/shared/components/AppModal';
import {
  fetchPartnerOptions,
  fetchPartnerSyncReceipts,
  linkReceiptToPartner,
} from '@/modules/core/billing-transactions/api/partner-sync-api';
import {
  LINK_SOURCE_LABEL,
  PARTNER_TYPE_ICON,
  PARTNER_TYPE_LABEL,
  formatMoney,
  receiptLabel,
} from '@/modules/core/billing-transactions/lib/partner-sync';
import type {
  PartnerOption,
  PartnerSyncReceipt,
  PartnerType,
} from '@/modules/core/billing-transactions/types/partner-sync';

const SEARCH_DEBOUNCE_MS = 300;

export interface LinkPartnerDrawerProps {
  /** Recibo ya elegido (asignación rápida desde el grid). Sin él, el drawer permite buscarlo. */
  initialReceipt?: PartnerSyncReceipt | null;
  initialPartnerType?: PartnerType;
  onClose: () => void;
  onLinked: (receipt: PartnerSyncReceipt) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Valor que se actualiza `delay` ms después del último cambio. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const LinkPartnerDrawer: React.FC<LinkPartnerDrawerProps> = ({
  initialReceipt = null,
  initialPartnerType = 'customer',
  onClose,
  onLinked,
}) => {
  const receiptGroupName = useId();
  const partnerGroupName = useId();

  // ---- Paso 1: recibo ----
  const [selectedReceipt, setSelectedReceipt] = useState<PartnerSyncReceipt | null>(initialReceipt);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [receipts, setReceipts] = useState<PartnerSyncReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(!initialReceipt);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const debouncedReceiptSearch = useDebouncedValue(receiptSearch, SEARCH_DEBOUNCE_MS);

  // ---- Paso 2: socio ----
  const [partnerType, setPartnerType] = useState<PartnerType>(initialPartnerType);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const debouncedPartnerSearch = useDebouncedValue(partnerSearch, SEARCH_DEBOUNCE_MS);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pickReceipt = !initialReceipt;

  useEffect(() => {
    if (!pickReceipt) return;
    let cancelled = false;
    setReceiptsLoading(true);
    setReceiptsError(null);
    fetchPartnerSyncReceipts({
      search: debouncedReceiptSearch,
      linkState: unlinkedOnly ? 'unlinked' : 'all',
      limit: 20,
    })
      .then((result) => {
        if (!cancelled) setReceipts(result.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setReceiptsError(errorMessage(err, 'Failed to load receipts.'));
      })
      .finally(() => {
        if (!cancelled) setReceiptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickReceipt, debouncedReceiptSearch, unlinkedOnly]);

  useEffect(() => {
    let cancelled = false;
    setPartnersLoading(true);
    setPartnersError(null);
    fetchPartnerOptions(partnerType, debouncedPartnerSearch)
      .then((options) => {
        if (!cancelled) setPartners(options);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPartnersError(errorMessage(err, 'Failed to load business partners.'));
      })
      .finally(() => {
        if (!cancelled) setPartnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partnerType, debouncedPartnerSearch]);

  const changePartnerType = (type: PartnerType) => {
    if (type === partnerType) return;
    setPartnerType(type);
    setSelectedPartnerId(null);
  };

  const canSubmit = Boolean(selectedReceipt && selectedPartnerId && !selectedReceipt.is_locked);
  const submitLabel = partnerType === 'supplier' ? 'LINK SUPPLIER PROFILE' : 'LINK CUSTOMER PROFILE';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReceipt || !selectedPartnerId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const linked = await linkReceiptToPartner(selectedReceipt.id, partnerType, selectedPartnerId);
      onLinked(linked);
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to link the receipt to the business partner.'));
      setSubmitting(false);
    }
  };

  const currentPartner = selectedReceipt?.partner ?? null;

  return (
    <SideDrawer
      title="LINK CUSTOMER PROFILE"
      subtitle="BUSINESS PARTNERS BILLING LINK"
      onClose={onClose}
      closeDisabled={submitting}
      maxWidth={620}
    >
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 font-poppins">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {/* ---- 1. Recibo ---- */}
          <section aria-labelledby={`${receiptGroupName}-title`} className="flex flex-col gap-3">
            <h3
              id={`${receiptGroupName}-title`}
              className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
                receipt_long
              </span>
              1. Receipt
            </h3>

            {pickReceipt && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <span
                      className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a]"
                      aria-hidden="true"
                    >
                      search
                    </span>
                    <input
                      type="text"
                      value={receiptSearch}
                      onChange={(e) => setReceiptSearch(e.target.value)}
                      placeholder="Invoice number, partner name or tax ID..."
                      aria-label="Search receipts"
                      className="h-[36px] w-full pl-9 pr-3 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17]"
                    />
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1c17] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={unlinkedOnly}
                      onChange={(e) => setUnlinkedOnly(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#ae001a] cursor-pointer"
                    />
                    Without linked profile
                  </label>
                </div>

                {receiptsError && <ModalFormError message={receiptsError} />}

                <div
                  role="radiogroup"
                  aria-label="Receipts"
                  className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1"
                >
                  {receiptsLoading ? (
                    <p className="text-xs text-[#5f5e5e] py-3">Loading receipts...</p>
                  ) : receipts.length === 0 ? (
                    <p className="text-xs text-[#5f5e5e] py-3">No receipts match the search.</p>
                  ) : (
                    receipts.map((receipt) => {
                      const checked = selectedReceipt?.id === receipt.id;
                      return (
                        <label
                          key={receipt.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${
                            receipt.is_locked
                              ? 'border-[#e8e2d8] bg-[#f8f6f2] text-[#8c857b] cursor-not-allowed'
                              : checked
                                ? 'border-[#ae001a] bg-red-50/60 cursor-pointer'
                                : 'border-[#e8e2d8] bg-white hover:border-[#b8b0a2] cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name={receiptGroupName}
                            value={receipt.id}
                            checked={checked}
                            disabled={receipt.is_locked}
                            onChange={() => setSelectedReceipt(receipt)}
                            aria-label={`Receipt ${receiptLabel(receipt)}`}
                            className="accent-[#ae001a]"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block font-bold text-[#1d1c17] truncate">
                              {receiptLabel(receipt)}{' '}
                              <span className="font-semibold text-[#76736a]">· {receipt.type}</span>
                            </span>
                            <span className="block text-[11px] text-[#5f5e5e] truncate">
                              {receipt.partner?.name ?? 'No partner'} · {LINK_SOURCE_LABEL[receipt.link_source]}
                            </span>
                          </span>
                          <span className="font-bold text-[#1d1c17] whitespace-nowrap">
                            {formatMoney(receipt.grand_total, receipt.currency)}
                          </span>
                          {receipt.is_locked && (
                            <span
                              className="material-symbols-outlined text-[16px] text-[#8c857b]"
                              title="Fiscally locked"
                              aria-label="Fiscally locked"
                            >
                              lock
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {selectedReceipt && (
              <div
                data-testid="selected-receipt"
                className="rounded-lg border border-[#e8e2d8] bg-[#fcfcfb] p-3 text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#1d1c17]">
                    {receiptLabel(selectedReceipt)} · {selectedReceipt.type}
                  </span>
                  <span className="font-extrabold text-[#1d1c17]">
                    {formatMoney(selectedReceipt.grand_total, selectedReceipt.currency)}
                  </span>
                </div>
                <div className="text-[#5f5e5e]">
                  Current partner:{' '}
                  <span className="font-semibold text-[#1d1c17]">{currentPartner?.name ?? 'None'}</span>
                  {currentPartner && (
                    <span className="ml-1 text-[#76736a]">({LINK_SOURCE_LABEL[selectedReceipt.link_source]})</span>
                  )}
                  {selectedReceipt.tax_id && <span className="ml-2">Tax ID {selectedReceipt.tax_id}</span>}
                </div>
                {selectedReceipt.is_locked && (
                  <p className="text-[#ba1a1a] font-semibold" role="alert">
                    This receipt is fiscally locked and cannot be modified.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ---- 2. Socio ---- */}
          <section aria-labelledby={`${partnerGroupName}-title`} className="flex flex-col gap-3">
            <h3
              id={`${partnerGroupName}-title`}
              className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-[#ae001a]" aria-hidden="true">
                groups
              </span>
              2. Business partner
            </h3>

            <div className="flex items-center gap-2">
              <div className="flex items-center h-[34px] bg-[#f2ede5] p-0.5 rounded-lg border border-[#e8e2d8]">
                {(['customer', 'supplier'] as PartnerType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={partnerType === type}
                    onClick={() => changePartnerType(type)}
                    className={`h-full px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      partnerType === type
                        ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]'
                        : 'text-[#5f5e5e] hover:text-[#ae001a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      {PARTNER_TYPE_ICON[type]}
                    </span>
                    {PARTNER_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a]"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  placeholder="Name, tax ID or email..."
                  aria-label="Search business partners"
                  className="h-[34px] w-full pl-9 pr-3 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17]"
                />
              </div>
            </div>

            {partnersError && <ModalFormError message={partnersError} />}

            <div
              role="radiogroup"
              aria-label="Business partners"
              className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1"
            >
              {partnersLoading ? (
                <p className="text-xs text-[#5f5e5e] py-3">Loading partners...</p>
              ) : partners.length === 0 ? (
                <p className="text-xs text-[#5f5e5e] py-3">
                  No {partnerType === 'supplier' ? 'suppliers' : 'customers'} found for this company.
                </p>
              ) : (
                partners.map((partner) => {
                  const checked = selectedPartnerId === partner.id;
                  const isCurrent =
                    currentPartner?.type === partner.type && currentPartner.id === partner.id;
                  return (
                    <label
                      key={`${partner.type}-${partner.id}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked ? 'border-[#ae001a] bg-red-50/60' : 'border-[#e8e2d8] bg-white hover:border-[#b8b0a2]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={partnerGroupName}
                        value={partner.id}
                        checked={checked}
                        onChange={() => setSelectedPartnerId(partner.id)}
                        aria-label={`${PARTNER_TYPE_LABEL[partner.type]} ${partner.name}`}
                        className="accent-[#ae001a]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-[#1d1c17] truncate">{partner.name}</span>
                        <span className="block text-[11px] text-[#5f5e5e] truncate">
                          Tax ID {partner.tax_id ?? '—'}
                          {partner.email ? ` · ${partner.email}` : ''}
                        </span>
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Current
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </section>

          {submitError && <ModalFormError message={submitError} />}
        </div>

        <div className="shrink-0 flex justify-end gap-3 px-5 py-4 border-t border-[#e8e2d8] bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 border border-[#e8e2d8] rounded-lg text-xs font-semibold text-[#1d1c17] hover:bg-[#f8f3eb] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider text-white bg-[#ae001a] hover:bg-[#d2272f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              partner_exchange
            </span>
            {submitting ? 'LINKING...' : submitLabel}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
};

export default LinkPartnerDrawer;
