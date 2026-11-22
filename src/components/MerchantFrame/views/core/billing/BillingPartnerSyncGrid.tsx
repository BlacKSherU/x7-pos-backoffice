// Grid BillingPartnerSyncGrid (Historia 22): recibos agrupados por cliente / proveedor con nombre,
// tax ID, volumen total y cantidad de facturas. Filtra por customer ID y por asociaciones de
// compañía (alcance sucursal / compañía, sucursal y tipo de asociación del socio) y permite
// asignar o reasignar rápido un recibo a otro socio (o quitarle el enlace).

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Toast, type ToastState } from '@/shared/components/Toast';
import {
  fetchCompanyMerchants,
  fetchPartnerGroups,
  fetchPartnerSyncReceipts,
  unlinkReceiptPartner,
} from '@/modules/core/billing-transactions/api/partner-sync-api';
import {
  ASSOCIATION_LABEL,
  LINK_SOURCE_LABEL,
  PARTNER_TYPE_ICON,
  PARTNER_TYPE_LABEL,
  formatMoney,
  formatShortDate,
  parsePositiveId,
  receiptLabel,
} from '@/modules/core/billing-transactions/lib/partner-sync';
import type {
  CompanyMerchant,
  PartnerAssociation,
  PartnerGroup,
  PartnerGroupSortBy,
  PartnerGroupsSummary,
  PartnerLinkState,
  PartnerSyncPartnerFilterParams,
  PartnerSyncReceipt,
  PartnerSyncScope,
  PartnerType,
  SortOrder,
} from '@/modules/core/billing-transactions/types/partner-sync';
import { LinkPartnerDrawer } from './LinkPartnerDrawer';

const PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type PartnerTypeFilter = 'all' | PartnerType;
type AssociationFilter = 'all' | PartnerAssociation;

export interface BillingPartnerSyncGridProps {
  /** Alcance: sucursal en sesión o toda la compañía. Con `onScopeChange` lo controla la vista. */
  scope?: PartnerSyncScope;
  /** Sucursal elegida dentro de la compañía (solo con scope=company). */
  merchantId?: number;
  onScopeChange?: (scope: PartnerSyncScope, merchantId?: number) => void;
  /** Cambia cuando otra parte de la vista modificó enlaces: recarga el grid. */
  refreshKey?: number;
  /** Un recibo se asignó, reasignó o desenlazó desde el grid (para refrescar el header). */
  onChanged?: (receipt: PartnerSyncReceipt) => void;
}

interface DetailState {
  rows: PartnerSyncReceipt[];
  page: number;
  total: number;
  hasNext: boolean;
}

const EMPTY_SUMMARY: PartnerGroupsSummary = { partners: 0, invoices: 0, total_volume: 0 };

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]';
const CONTROL_CLASS =
  'h-[38px] w-full rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] px-3 text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/30';
const TH_CLASS = 'px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] text-left whitespace-nowrap';
const TD_CLASS = 'px-4 py-3 align-middle';
const SMALL_BUTTON_CLASS =
  'h-7 px-2.5 rounded-md border text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

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

const groupKey = (group: Pick<PartnerGroup, 'partner_type' | 'partner_id'>) =>
  `${group.partner_type}:${group.partner_id}`;

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex h-[38px] rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 px-3 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
              active ? 'bg-[#ae001a] text-white' : 'text-[#5f5e5e] hover:text-[#ae001a]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const BillingPartnerSyncGrid: React.FC<BillingPartnerSyncGridProps> = ({
  scope: scopeProp,
  merchantId: merchantIdProp,
  onScopeChange,
  refreshKey = 0,
  onChanged,
}) => {
  const ids = useId();

  // ---- Alcance (controlado por la vista o local) ----
  const [localScope, setLocalScope] = useState<{ scope: PartnerSyncScope; merchantId?: number }>({
    scope: scopeProp ?? 'merchant',
    merchantId: merchantIdProp,
  });
  const scope: PartnerSyncScope = onScopeChange ? (scopeProp ?? 'merchant') : localScope.scope;
  const branchId = scope === 'company' ? (onScopeChange ? merchantIdProp : localScope.merchantId) : undefined;

  // ---- Filtros ----
  const [search, setSearch] = useState('');
  const [partnerType, setPartnerType] = useState<PartnerTypeFilter>('all');
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [association, setAssociation] = useState<AssociationFilter>('all');
  const [linkState, setLinkState] = useState<PartnerLinkState>('all');
  const [sortBy, setSortBy] = useState<PartnerGroupSortBy>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const debouncedCustomerId = useDebouncedValue(customerIdInput, SEARCH_DEBOUNCE_MS);
  const customerIdInvalid = parsePositiveId(customerIdInput) === 'invalid';
  const parsedCustomerId = parsePositiveId(debouncedCustomerId);
  const customerId = typeof parsedCustomerId === 'number' ? parsedCustomerId : undefined;
  const debouncedCustomerIdInvalid = parsedCustomerId === 'invalid';

  // ---- Datos ----
  const [groups, setGroups] = useState<PartnerGroup[]>([]);
  const [summary, setSummary] = useState<PartnerGroupsSummary>(EMPTY_SUMMARY);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [merchants, setMerchants] = useState<CompanyMerchant[] | null>(null);
  const [merchantsError, setMerchantsError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<PartnerGroup | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);

  const [drawerReceipt, setDrawerReceipt] = useState<PartnerSyncReceipt | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const filters = useMemo<PartnerSyncPartnerFilterParams>(
    () => ({
      scope,
      merchantId: branchId,
      partnerType: partnerType === 'all' ? undefined : partnerType,
      customerId,
      association: association === 'all' ? undefined : association,
      linkState,
    }),
    [scope, branchId, partnerType, customerId, association, linkState],
  );

  // Grid agrupado por socio.
  useEffect(() => {
    if (debouncedCustomerIdInvalid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPartnerGroups({ ...filters, search: debouncedSearch, sortBy, sortOrder, page, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setGroups(result.data);
        // El detalle abierto sigue abierto mientras su socio siga en el resultado.
        setExpanded((prev) => (prev && result.data.some((g) => groupKey(g) === groupKey(prev)) ? prev : null));
        setSummary(result.summary);
        setTotalPages(result.totalPages);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Failed to load business partner billing.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, debouncedSearch, debouncedCustomerIdInvalid, sortBy, sortOrder, page, refreshKey, reloadTick]);

  // Sucursales de la compañía: opciones del filtro y la sucursal en sesión (la única editable).
  useEffect(() => {
    if (scope !== 'company' || merchants) return;
    let cancelled = false;
    setMerchantsError(null);
    fetchCompanyMerchants()
      .then((data) => {
        if (!cancelled) setMerchants(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMerchantsError(errorMessage(err, 'Failed to load company merchants.'));
      });
    return () => {
      cancelled = true;
    };
  }, [scope, merchants]);

  const loadDetail = useCallback(
    (group: PartnerGroup, detailPage: number, append: boolean) => {
      let cancelled = false;
      setDetailLoading(true);
      setDetailError(null);
      fetchPartnerSyncReceipts({
        ...filters,
        partnerType: group.partner_type,
        customerId: group.partner_type === 'customer' ? group.partner_id : undefined,
        supplierId: group.partner_type === 'supplier' ? group.partner_id : undefined,
        page: detailPage,
        limit: DETAIL_PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return;
          setDetail((prev) => ({
            rows: append && prev ? [...prev.rows, ...result.data] : result.data,
            page: result.page,
            total: result.total,
            hasNext: result.hasNext,
          }));
        })
        .catch((err: unknown) => {
          if (!cancelled) setDetailError(errorMessage(err, 'Failed to load receipts.'));
        })
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [filters],
  );

  // Recibos del socio abierto.
  useEffect(() => {
    if (!expanded) {
      setDetail(null);
      return;
    }
    return loadDetail(expanded, 1, false);
  }, [expanded, detailTick, refreshKey, loadDetail]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  // ---- Handlers de filtros (todos vuelven a la página 1) ----
  const changeScope = (next: PartnerSyncScope, nextMerchantId?: number) => {
    setPage(1);
    if (onScopeChange) onScopeChange(next, nextMerchantId);
    else setLocalScope({ scope: next, merchantId: nextMerchantId });
  };

  const hasFilters =
    search.trim() !== '' ||
    partnerType !== 'all' ||
    customerIdInput.trim() !== '' ||
    association !== 'all' ||
    linkState !== 'all' ||
    branchId !== undefined;

  const clearFilters = () => {
    setSearch('');
    setPartnerType('all');
    setCustomerIdInput('');
    setAssociation('all');
    setLinkState('all');
    setPage(1);
    if (branchId !== undefined) changeScope(scope);
  };

  // ---- Acciones sobre recibos ----
  const currentMerchantId = merchants?.find((m) => m.is_current)?.id ?? null;

  /** Por qué un recibo no se puede asignar desde aquí (null si se puede). */
  const lockReason = (receipt: PartnerSyncReceipt): string | null => {
    if (receipt.is_locked) return 'Fiscally locked receipts cannot be reassigned.';
    if (scope === 'company' && currentMerchantId != null && receipt.merchant_id !== currentMerchantId) {
      return 'Only receipts issued by your branch can be reassigned.';
    }
    return null;
  };

  const afterChange = (receipt: PartnerSyncReceipt, message: string) => {
    setToast({ type: 'success', message });
    reload();
    setDetailTick((t) => t + 1);
    onChanged?.(receipt);
  };

  const handleLinked = (receipt: PartnerSyncReceipt) => {
    setDrawerReceipt(null);
    afterChange(
      receipt,
      `Receipt ${receiptLabel(receipt)} assigned to ${receipt.partner?.name ?? 'the business partner'}.`,
    );
  };

  const handleUnlink = async (receipt: PartnerSyncReceipt) => {
    setUnlinkingId(receipt.id);
    try {
      const updated = await unlinkReceiptPartner(receipt.id);
      afterChange(updated, `Receipt ${receiptLabel(updated)} now uses its order customer.`);
    } catch (err) {
      setToast({ type: 'error', message: errorMessage(err, 'Failed to remove the business partner link.') });
    } finally {
      setUnlinkingId(null);
    }
  };

  const toggleGroup = (group: PartnerGroup) => {
    setExpanded((prev) => (prev && groupKey(prev) === groupKey(group) ? null : group));
  };

  const summaryCurrency = groups[0]?.currency ?? 'USD';
  const lastPage = Math.max(1, totalPages);

  return (
    <section
      aria-label="Receipts by business partner"
      className="bg-white border border-[#e8e2d8] rounded-xl shadow-sm flex flex-col min-w-0 font-poppins"
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Título + resumen */}
      <div className="px-5 pt-5 pb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[#1d1c17] font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ae001a] text-[20px]" aria-hidden="true">
              groups
            </span>
            Receipts by business partner
          </h3>
          <p className="text-[#5f5e5e] text-xs mt-1">
            Customers and suppliers with their tax ID, invoiced volume and invoice count. Open a partner to assign or
            reassign its receipts.
          </p>
        </div>
        <div data-testid="partner-grid-summary" className="text-xs text-[#5f5e5e] whitespace-nowrap">
          <span className="font-bold text-[#1d1c17]">{summary.partners}</span> partners ·{' '}
          <span className="font-bold text-[#1d1c17]">{summary.invoices}</span> invoices ·{' '}
          <span className="font-bold text-[#1d1c17]">{formatMoney(summary.total_volume, summaryCurrency)}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={`${ids}-search`} className={LABEL_CLASS}>
            Partner
          </label>
          <div className="relative">
            <span
              className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9b958b]"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id={`${ids}-search`}
              type="search"
              aria-label="Search partners"
              placeholder="Name, tax ID or partner ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`${CONTROL_CLASS} pl-9`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-customer`} className={LABEL_CLASS}>
            Customer ID
          </label>
          <input
            id={`${ids}-customer`}
            type="text"
            inputMode="numeric"
            placeholder="e.g. 12"
            value={customerIdInput}
            aria-invalid={customerIdInvalid}
            aria-describedby={customerIdInvalid ? `${ids}-customer-error` : undefined}
            onChange={(e) => {
              setCustomerIdInput(e.target.value);
              setPage(1);
            }}
            className={`${CONTROL_CLASS} ${customerIdInvalid ? 'border-[#ba1a1a]' : ''}`}
          />
          {customerIdInvalid && (
            <span id={`${ids}-customer-error`} className="text-[10.5px] text-[#ba1a1a]">
              Enter a valid customer ID.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Partner type</span>
          <Segmented<PartnerTypeFilter>
            label="Partner type"
            value={partnerType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'customer', label: 'Customers' },
              { value: 'supplier', label: 'Suppliers' },
            ]}
            onChange={(value) => {
              setPartnerType(value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Scope</span>
          <Segmented<PartnerSyncScope>
            label="Scope"
            value={scope}
            options={[
              { value: 'merchant', label: 'Branch' },
              { value: 'company', label: 'Company-wide' },
            ]}
            onChange={(value) => changeScope(value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-branch`} className={LABEL_CLASS}>
            Company branch
          </label>
          <select
            id={`${ids}-branch`}
            value={branchId ?? ''}
            disabled={scope !== 'company'}
            onChange={(e) => changeScope('company', e.target.value ? Number(e.target.value) : undefined)}
            className={`${CONTROL_CLASS} disabled:opacity-50`}
          >
            <option value="">{scope === 'company' ? 'All branches' : 'Session branch'}</option>
            {(merchants ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.is_current ? `${m.name} (current)` : m.name}
              </option>
            ))}
          </select>
          {merchantsError && scope === 'company' && (
            <span className="text-[10.5px] text-[#ba1a1a]">{merchantsError}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-association`} className={LABEL_CLASS}>
            Company association
          </label>
          <select
            id={`${ids}-association`}
            value={association}
            onChange={(e) => {
              setAssociation(e.target.value as AssociationFilter);
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All partners</option>
            <option value="company">Company accounts</option>
            <option value="merchant">Branch-only customers</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-link`} className={LABEL_CLASS}>
            Profile link
          </label>
          <select
            id={`${ids}-link`}
            value={linkState}
            onChange={(e) => {
              setLinkState(e.target.value as PartnerLinkState);
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All receipts</option>
            <option value="linked">Linked profiles</option>
            <option value="unlinked">From order customer</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-sort`} className={LABEL_CLASS}>
            Sort by
          </label>
          <div className="flex gap-2">
            <select
              id={`${ids}-sort`}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as PartnerGroupSortBy);
                setPage(1);
              }}
              className={CONTROL_CLASS}
            >
              <option value="volume">Total volume</option>
              <option value="invoices">Invoice count</option>
              <option value="name">Name</option>
              <option value="lastInvoice">Last invoice</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSortOrder((o) => (o === 'DESC' ? 'ASC' : 'DESC'));
                setPage(1);
              }}
              aria-label={sortOrder === 'DESC' ? 'Sort ascending' : 'Sort descending'}
              title={sortOrder === 'DESC' ? 'Descending' : 'Ascending'}
              className="h-[38px] w-[38px] shrink-0 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-[#5f5e5e] hover:text-[#ae001a] flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {sortOrder === 'DESC' ? 'arrow_downward' : 'arrow_upward'}
              </span>
            </button>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="h-[38px] px-3 rounded-lg text-xs font-bold text-[#ae001a] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                filter_alt_off
              </span>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mx-5 mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs text-[#ba1a1a]"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              error
            </span>
            {error}
          </span>
          <button type="button" onClick={reload} className="font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className={`overflow-x-auto border-t border-[#e8e2d8] ${loading && loaded ? 'opacity-60' : ''}`}>
        <table className="w-full min-w-[640px] text-left" aria-busy={loading}>
          <thead className="bg-[#f7f4ef]">
            <tr>
              <th className={TH_CLASS}>Partner</th>
              <th className={TH_CLASS}>Tax ID</th>
              <th className={`${TH_CLASS} hidden lg:table-cell`}>Association</th>
              <th className={`${TH_CLASS} text-right`}>Invoices</th>
              <th className={`${TH_CLASS} text-right`}>Total volume</th>
              <th className={`${TH_CLASS} text-right hidden md:table-cell`}>Outstanding</th>
              <th className={`${TH_CLASS} hidden xl:table-cell`}>Last invoice</th>
              <th className={TH_CLASS}>
                <span className="sr-only">Receipts</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {!loaded && loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#5f5e5e]">
                  Loading business partners...
                </td>
              </tr>
            )}
            {loaded && groups.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#5f5e5e]">
                  <span className="material-symbols-outlined text-[28px] text-[#c9c2b6] block mb-1" aria-hidden="true">
                    group_off
                  </span>
                  No receipts match these filters.
                </td>
              </tr>
            )}
            {groups.map((group) => {
              const key = groupKey(group);
              const isOpen = expanded != null && groupKey(expanded) === key;
              return (
                <React.Fragment key={key}>
                  <tr data-testid={`partner-row-${key}`} className={isOpen ? 'bg-[#fdf8f3]' : 'hover:bg-[#fcfaf7]'}>
                    <td className={TD_CLASS}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-lg bg-[#f2ede5] text-[#ae001a] flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {PARTNER_TYPE_ICON[group.partner_type]}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1d1c17] truncate max-w-[260px]">{group.name}</div>
                          <div className="text-[10.5px] text-[#5f5e5e]">
                            {PARTNER_TYPE_LABEL[group.partner_type]} #{group.partner_id}
                            {group.merchant_count > 1 && <> · {group.merchant_count} branches</>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD_CLASS} text-xs text-[#1d1c17] whitespace-nowrap`}>
                      {group.tax_id ?? <span className="text-[#9b958b]">—</span>}
                      {group.fiscal_tax_id && (
                        <span
                          title="Taken from the receipt fiscal data"
                          className="ml-1.5 px-1 py-0.5 rounded text-[8.5px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          Fiscal
                        </span>
                      )}
                    </td>
                    <td className={`${TD_CLASS} hidden lg:table-cell`}>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                          group.association === 'company'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-[#f2ede5] text-[#5f5e5e] border-[#e8e2d8]'
                        }`}
                      >
                        {ASSOCIATION_LABEL[group.association]}
                      </span>
                    </td>
                    <td className={`${TD_CLASS} text-right whitespace-nowrap`}>
                      <div className="text-sm font-bold text-[#1d1c17]">{group.invoice_count}</div>
                      <div className="text-[10px] text-[#5f5e5e]">{group.linked_invoice_count} linked</div>
                    </td>
                    <td className={`${TD_CLASS} text-right text-sm font-semibold text-[#1d1c17] whitespace-nowrap`}>
                      {formatMoney(group.total_volume, group.currency)}
                    </td>
                    <td
                      className={`${TD_CLASS} text-right text-xs whitespace-nowrap hidden md:table-cell ${
                        group.outstanding_balance > 0 ? 'text-rose-700 font-semibold' : 'text-[#5f5e5e]'
                      }`}
                    >
                      {formatMoney(group.outstanding_balance, group.currency)}
                    </td>
                    <td className={`${TD_CLASS} text-xs text-[#5f5e5e] whitespace-nowrap hidden xl:table-cell`}>
                      {formatShortDate(group.last_invoice_at)}
                    </td>
                    <td className={`${TD_CLASS} text-right`}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        disabled={group.partner_id <= 0}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} receipts of ${group.name}`}
                        className="h-8 w-8 rounded-lg border border-[#d5cfc4] text-[#5f5e5e] hover:text-[#ae001a] flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          {isOpen ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="px-4 pb-4 pt-1 bg-[#fdf8f3]">
                        <div
                          data-testid="partner-receipts"
                          className="rounded-lg border border-[#e8e2d8] bg-white divide-y divide-[#f0ebe3]"
                        >
                          {detailError && (
                            <div role="alert" className="px-4 py-3 text-xs text-[#ba1a1a] flex justify-between gap-3">
                              {detailError}
                              <button
                                type="button"
                                onClick={() => setDetailTick((t) => t + 1)}
                                className="font-bold underline cursor-pointer"
                              >
                                Retry
                              </button>
                            </div>
                          )}
                          {!detail && detailLoading && (
                            <div className="px-4 py-3 text-xs text-[#5f5e5e]">Loading receipts...</div>
                          )}
                          {detail && detail.rows.length === 0 && !detailLoading && (
                            <div className="px-4 py-3 text-xs text-[#5f5e5e]">No receipts for this partner.</div>
                          )}
                          {detail?.rows.map((receipt) => {
                            const reason = lockReason(receipt);
                            const label = receiptLabel(receipt);
                            const linked = receipt.link_source === 'receipt';
                            return (
                              <div
                                key={receipt.id}
                                data-testid={`partner-receipt-${receipt.id}`}
                                className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5"
                              >
                                <div className="min-w-[140px] flex-1">
                                  <div className="text-xs font-bold text-[#1d1c17] flex items-center gap-1.5">
                                    {label}
                                    <span className="px-1 py-0.5 rounded text-[8.5px] font-bold uppercase bg-[#f2ede5] text-[#5f5e5e]">
                                      {receipt.type}
                                    </span>
                                    {receipt.is_locked && (
                                      <span
                                        className="material-symbols-outlined text-[14px] text-[#5f5e5e]"
                                        title="Fiscally locked"
                                        aria-label="Fiscally locked"
                                      >
                                        lock
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10.5px] text-[#5f5e5e]">
                                    {formatShortDate(receipt.created_at)} · Tax ID {receipt.tax_id ?? '—'}
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                                    linked
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-[#f2ede5] text-[#5f5e5e] border-[#e8e2d8]'
                                  }`}
                                >
                                  {LINK_SOURCE_LABEL[receipt.link_source]}
                                </span>
                                <span className="text-xs font-semibold text-[#1d1c17] whitespace-nowrap min-w-[110px] text-right">
                                  {formatMoney(receipt.grand_total, receipt.currency)}
                                </span>
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <button
                                    type="button"
                                    disabled={reason != null}
                                    title={reason ?? undefined}
                                    onClick={() => setDrawerReceipt(receipt)}
                                    aria-label={`${linked ? 'Reassign' : 'Assign'} receipt ${label}`}
                                    className={`${SMALL_BUTTON_CLASS} border-[#ae001a] text-[#ae001a] hover:bg-[#ae001a] hover:text-white`}
                                  >
                                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                                      swap_horiz
                                    </span>
                                    {linked ? 'Reassign' : 'Assign'}
                                  </button>
                                  {linked && (
                                    <button
                                      type="button"
                                      disabled={reason != null || unlinkingId === receipt.id}
                                      title={reason ?? 'Use the order customer again'}
                                      onClick={() => void handleUnlink(receipt)}
                                      aria-label={`Unlink receipt ${label}`}
                                      className={`${SMALL_BUTTON_CLASS} border-[#d5cfc4] text-[#5f5e5e] hover:text-[#ae001a]`}
                                    >
                                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                                        link_off
                                      </span>
                                      Unlink
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {detail?.hasNext && (
                            <div className="px-4 py-2 text-center">
                              <button
                                type="button"
                                disabled={detailLoading}
                                onClick={() => expanded && loadDetail(expanded, detail.page + 1, true)}
                                className="text-xs font-bold text-[#ae001a] hover:underline cursor-pointer disabled:opacity-50"
                              >
                                Load more receipts ({detail.rows.length} of {detail.total})
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-[#e8e2d8] flex items-center justify-between gap-3 text-xs text-[#5f5e5e]">
          <span>
            Page {page} of {lastPage}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 rounded-lg border border-[#d5cfc4] font-bold hover:text-[#ae001a] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="h-8 px-3 rounded-lg border border-[#d5cfc4] font-bold hover:text-[#ae001a] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {drawerReceipt && (
        <LinkPartnerDrawer
          initialReceipt={drawerReceipt}
          initialPartnerType={drawerReceipt.partner?.type ?? 'customer'}
          onClose={() => setDrawerReceipt(null)}
          onLinked={handleLinked}
        />
      )}
    </section>
  );
};

export default BillingPartnerSyncGrid;
