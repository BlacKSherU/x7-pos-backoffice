// Historia 7 — Companies Directory (/platform-saas/companies/directory).
// Se abre desde el Companies Hub; cada fila lleva al Company Hub (/platform-saas/companies/:id/hub).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSaasCompanies } from '@/modules/platform-saas/companies/api/saas-companies';
import { getRememberedCompanyContext, rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { companiesNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companiesTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { ALL, filterCompanyRows, queryValue } from '@/modules/platform-saas/companies/lib/saas-directory-filters';
import { formatLocation } from '@/modules/platform-saas/companies/lib/saas-format';
import { useDebouncedValue } from '@/modules/platform-saas/companies/lib/use-debounced-value';
import { COMPANY_STATUS_OPTIONS } from '@/modules/platform-saas/companies/lib/saas-company-profile-validation';
import type {
  SaasCompaniesListMeta,
  SaasCompanyListItem,
  SaasSubscriptionTier,
} from '@/modules/platform-saas/companies/types/saas-company';
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

const PAGE_SIZE = 50;
const HEADER_CLASS = SAAS.th;

export const CompaniesDirectoryView: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [tier, setTier] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SaasCompanyListItem[]>([]);
  const [meta, setMeta] = useState<SaasCompaniesListMeta | null>(null);
  const [tiers, setTiers] = useState<SaasSubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listSaasCompanies({
        search: queryValue(debouncedSearch),
        status: queryValue(status),
        tier: queryValue(tier),
        page,
        limit: PAGE_SIZE,
      });
      if (current !== requestId.current) return;
      setRows(result.items);
      setMeta(result.meta);
      if (result.meta.tiers?.length) setTiers(result.meta.tiers);
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load companies. Please try again.');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [debouncedSearch, status, tier, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => filterCompanyRows(rows, { search, status, tier }), [rows, search, status, tier]);

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const openCompany = (company: SaasCompanyListItem) => {
    rememberCompanyContext(company.id);
    navigate(platformSaasPaths.companyHub(company.id));
  };

  const hasFilters = search.trim() !== '' || status !== ALL || tier !== ALL;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(companiesTrail(), 'Companies Directory')}
        icon="domain"
        title="COMPANIES DIRECTORY"
        description="Every enterprise tenant registered on the platform. Filter by status, subscription tier or search by name, legal name, tax ID or email, then open the company's hub."
        actions={[
          {
            label: 'Back to Companies Hub',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: () => navigate(platformSaasPaths.companiesHub()),
          },
        ]}
      />

      <SaasPanel title="Registered Companies" metaTestId="companies-count" meta={isLoading && !meta ? '...' : `${meta?.total ?? visibleRows.length} companies`}>

        <div className={`${SAAS.filterBar} md:grid-cols-[minmax(0,1fr)_12rem_14rem]`}>
          <SaasSearchInput label="Search companies" placeholder="Search by name, legal name, tax ID or email…" value={search} onChange={(value) => changeFilter(() => setSearch(value))} />
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => changeFilter(() => setStatus(event.target.value))}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All statuses</option>
            {COMPANY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Subscription tier"
            value={tier}
            onChange={(event) => changeFilter(() => setTier(event.target.value))}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All subscription tiers</option>
            {tiers.map((option) => (
              <option key={option.planId} value={String(option.planId)}>
                {option.planName}
              </option>
            ))}
          </select>
        </div>

        {isLoading && rows.length === 0 ? (
          <SaasLoadingState label="Loading companies..." />
        ) : error ? (
          <SaasErrorState message={error} onRetry={() => void load()} />
        ) : visibleRows.length === 0 ? (
          <SaasEmptyState
            icon="domain_disabled"
            title={hasFilters ? 'No companies match your filters' : 'No companies registered yet'}
            description={
              hasFilters
                ? 'Adjust the search text, status or subscription tier to see more companies.'
                : 'Companies appear here once a tenant is registered on the platform.'
            }
            action={
              hasFilters
                ? {
                    label: 'Clear filters',
                    onClick: () =>
                      changeFilter(() => {
                        setSearch('');
                        setStatus(ALL);
                        setTier(ALL);
                      }),
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={SAAS.table}>
              <thead className={SAAS.thead}>
                <tr>
                  <th className={HEADER_CLASS}>Company</th>
                  <th className={`${HEADER_CLASS} hidden md:table-cell`}>Tax ID</th>
                  <th className={`${HEADER_CLASS} hidden lg:table-cell`}>Location</th>
                  <th className={`${HEADER_CLASS} hidden sm:table-cell`}>Subscription Tier</th>
                  <th className={`${HEADER_CLASS} hidden lg:table-cell text-right`}>Merchants</th>
                  <th className={HEADER_CLASS}>Status</th>
                  <th className={`${HEADER_CLASS} text-right`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {visibleRows.map((company) => (
                  <tr
                    key={company.id}
                    data-testid={`company-row-${company.id}`}
                    onClick={() => openCompany(company)}
                    className={SAAS.rowLink}
                  >
                    <td className={`${SAAS.td} min-w-0`}>
                      <p className={SAAS.rowTitle}>
                        {company.name}
                      </p>
                      <p className={`${SAAS.rowSubtitle} break-words`}>
                        {company.legalName || company.email || '—'}
                      </p>
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden md:table-cell whitespace-nowrap`}>
                      {company.taxId || '—'}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden lg:table-cell`}>
                      {formatLocation(company.city, company.country)}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden sm:table-cell`}>
                      {company.subscriptionTier?.planName ?? 'No plan'}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden lg:table-cell text-right`}>
                      {company.merchantCount ?? 0}
                    </td>
                    <td className={SAAS.td}>
                      <SaasStatusBadge status={company.status} />
                    </td>
                    <td className={`${SAAS.td} text-right`}>
                      <button
                        type="button"
                        aria-label={`Open ${company.name} hub`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openCompany(company);
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

        {meta && totalPages > 1 && !error && (
          <div className="px-5 py-3 border-t border-[#e8e2d8] flex items-center justify-between gap-3 text-xs text-[#5f5e5e]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={SAAS.buttonSecondary}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={SAAS.buttonSecondary}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SaasPanel>
      <SaasNavBar backLabel="Back to Companies Hub" backTo={platformSaasPaths.companiesHub()} items={companiesNav('companies-directory', getRememberedCompanyContext())} />
    </div>
  );
};

export default CompaniesDirectoryView;
