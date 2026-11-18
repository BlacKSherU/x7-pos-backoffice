// Historia 4 — Company Merchants Directory (/platform-saas/companies/:companyId/merchants).
// Sucursales de la company con filtros por nombre, ciudad y estado; cada fila abre su Merchant Hub.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSaasCompanyHub,
  listSaasCompanyMerchants,
} from '@/modules/platform-saas/companies/api/saas-companies';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { companyNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companyTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import {
  ALL,
  cityOptions,
  filterMerchantRows,
  queryValue,
} from '@/modules/platform-saas/companies/lib/saas-directory-filters';
import { formatLocation } from '@/modules/platform-saas/companies/lib/saas-format';
import { useDebouncedValue } from '@/modules/platform-saas/companies/lib/use-debounced-value';
import { MERCHANT_STATUS_OPTIONS } from '@/modules/platform-saas/merchants/lib/saas-merchant-profile-validation';
import type { SaasCompanyMerchant } from '@/modules/platform-saas/companies/types/saas-company';
import {
  SaasPanel,
  SaasSearchInput,
  SaasNavBar,
  SaasEmptyState,
  SaasErrorState,
  SaasLoadingState,
  SaasPageHeader,
  SaasStatusBadge,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

const HEADER_CLASS = SAAS.th;

export interface CompanyMerchantsDirectoryViewProps {
  companyId: number;
}

export const CompanyMerchantsDirectoryView: React.FC<CompanyMerchantsDirectoryViewProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [rows, setRows] = useState<SaasCompanyMerchant[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listSaasCompanyMerchants(companyId, {
        search: queryValue(debouncedSearch),
        city: queryValue(city),
        status: queryValue(status),
      });
      if (current !== requestId.current) return;
      // Solo las sucursales de esta company, aunque el backend devolviera otras.
      const own = result.items.filter((merchant) => Number(merchant.companyId) === companyId);
      setRows(own);
      setTotal(result.meta.total ?? own.length);
      setCities((prev) => cityOptions(own, [...prev, ...(result.meta.cities ?? [])]));
      rememberCompanyContext(companyId);
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load company merchants. Please try again.');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [companyId, debouncedSearch, city, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    getSaasCompanyHub(companyId)
      .then((hub) => {
        if (active) setCompanyName(hub.company.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [companyId]);

  const visibleRows = useMemo(
    () => filterMerchantRows(rows, { search, city, status }),
    [rows, search, city, status],
  );

  const hasFilters = search.trim() !== '' || city !== ALL || status !== ALL;
  const openMerchant = (merchant: SaasCompanyMerchant) =>
    navigate(platformSaasPaths.merchantHub(companyId, merchant.id));

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(companyTrail(companyId, companyName), 'Merchants')}
        icon="storefront"
        title="COMPANY MERCHANTS DIRECTORY"
        description={`Merchant branches of ${companyName ?? `company #${companyId}`}: names, locations, branch codes and operational status. Select a branch to open its Merchant Hub.`}
        actions={[
          {
            label: 'Back to Company Hub',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: () => navigate(platformSaasPaths.companyHub(companyId)),
          },
        ]}
      />

      <SaasPanel title="Merchant Branches" metaTestId="merchants-count" meta={total === null ? '...' : `${visibleRows.length} of ${total} branches`}>

        <div className={`${SAAS.filterBar} md:grid-cols-[minmax(0,1fr)_12rem_12rem]`}>
          <SaasSearchInput label="Search merchants" placeholder="Search by branch name, branch code or email…" value={search} onChange={(value) => setSearch(value)} />
          <select
            aria-label="City"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All cities</option>
            {cities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All statuses</option>
            {MERCHANT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading && rows.length === 0 ? (
          <SaasLoadingState label="Loading merchant branches..." />
        ) : error ? (
          <SaasErrorState message={error} onRetry={() => void load()} />
        ) : visibleRows.length === 0 ? (
          <SaasEmptyState
            icon="store"
            title={hasFilters ? 'No merchants match your filters' : 'This company has no merchant branches yet'}
            description={
              hasFilters
                ? 'Adjust the branch name, city or status filters to see more branches.'
                : 'Branches appear here once they are provisioned for the company.'
            }
            action={
              hasFilters
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearch('');
                      setCity(ALL);
                      setStatus(ALL);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={SAAS.table}>
              <thead className={SAAS.thead}>
                <tr>
                  <th className={HEADER_CLASS}>Merchant</th>
                  <th className={`${HEADER_CLASS} hidden sm:table-cell`}>Branch Code</th>
                  <th className={`${HEADER_CLASS} hidden md:table-cell`}>Location</th>
                  <th className={`${HEADER_CLASS} hidden xl:table-cell`}>Timezone</th>
                  <th className={HEADER_CLASS}>Status</th>
                  <th className={`${HEADER_CLASS} text-right`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {visibleRows.map((merchant) => (
                  <tr
                    key={merchant.id}
                    data-testid={`merchant-row-${merchant.id}`}
                    onClick={() => openMerchant(merchant)}
                    className={SAAS.rowLink}
                  >
                    <td className={SAAS.td}>
                      <p className={SAAS.rowTitle}>
                        {merchant.name}
                      </p>
                      <p className={`${SAAS.rowSubtitle} break-all`}>{merchant.email || '—'}</p>
                    </td>
                    <td className={`${SAAS.td} text-sm font-mono text-[#1d1c17] hidden sm:table-cell whitespace-nowrap`}>
                      {merchant.branchCode}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden md:table-cell`}>
                      {formatLocation(merchant.city, merchant.state, merchant.country)}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden xl:table-cell`}>{merchant.timezone || '—'}</td>
                    <td className={SAAS.td}>
                      <SaasStatusBadge status={merchant.status} />
                    </td>
                    <td className={`${SAAS.td} text-right`}>
                      <button
                        type="button"
                        aria-label={`Open ${merchant.name} hub`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openMerchant(merchant);
                        }}
                        className={SAAS.rowAction}
                      >
                        <span className="hidden md:inline">Open Hub</span>
                        <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconSm}`}>arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SaasPanel>
      <SaasNavBar backLabel="Back to Company Hub" backTo={platformSaasPaths.companyHub(companyId)} items={companyNav(companyId, 'company-merchants')} />
    </div>
  );
};

export default CompanyMerchantsDirectoryView;
