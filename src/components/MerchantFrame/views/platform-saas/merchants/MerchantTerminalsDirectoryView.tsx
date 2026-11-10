// Historia 5 ("access its profile, users, and terminal directories") — Merchant Terminals
// Directory (/platform-saas/companies/:companyId/merchants/:merchantId/terminals).
// Terminales de cobro (POS) de la sucursal con búsqueda y filtro de estado.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasMerchant, listSaasMerchantTerminals } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { merchantLabel, merchantTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { ALL, filterTerminalRows, queryValue } from '@/modules/platform-saas/companies/lib/saas-directory-filters';
import { formatDate, formatProviderLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import { useDebouncedValue } from '@/modules/platform-saas/companies/lib/use-debounced-value';
import type { SaasMerchantProfile, SaasMerchantTerminal } from '@/modules/platform-saas/merchants/types/saas-merchant';
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

export const MERCHANT_TERMINALS_TITLE = 'POS TERMINALS DIRECTORY';

const HEADER_CLASS = SAAS.th;

const TERMINAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export interface MerchantTerminalsDirectoryViewProps {
  companyId: number;
  merchantId: number;
}

export const MerchantTerminalsDirectoryView: React.FC<MerchantTerminalsDirectoryViewProps> = ({
  companyId,
  merchantId,
}) => {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<SaasMerchantProfile | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [rows, setRows] = useState<SaasMerchantTerminal[]>([]);
  const [meta, setMeta] = useState<{ total: number; active: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listSaasMerchantTerminals(merchantId, {
        search: queryValue(debouncedSearch),
        status: queryValue(status),
      });
      if (current !== requestId.current) return;
      setRows(result.items.filter((terminal) => Number(terminal.merchantId) === merchantId));
      setMeta(result.meta);
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load merchant terminals. Please try again.');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [merchantId, debouncedSearch, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sucursal y company para las migas (no bloquea la tabla si falla).
  useEffect(() => {
    let active = true;
    getSaasMerchant(merchantId)
      .then((data) => {
        if (active) setMerchant(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [merchantId]);

  const mismatch = merchant !== null && Number(merchant.companyId) !== companyId;
  const visibleRows = useMemo(() => filterTerminalRows(rows, { search, status }), [rows, search, status]);
  const hasFilters = search.trim() !== '' || status !== ALL;
  const name = merchantLabel(merchantId, merchant?.name);
  const hubPath = platformSaasPaths.merchantHub(companyId, merchantId);

  const clearFilters = () => {
    setSearch('');
    setStatus(ALL);
  };

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(merchantTrail(companyId, merchant?.companyName, merchantId, merchant?.name), 'POS Terminals')}
        icon="point_of_sale"
        title={MERCHANT_TERMINALS_TITLE}
        description={`Payment and POS terminals registered for ${name}: device identifiers, provider, model and status.`}
        actions={[
          { label: 'Back to Merchant Hub', icon: 'arrow_back', variant: 'secondary', onClick: () => navigate(hubPath) },
        ]}
      />

      <SaasPanel title="Branch Terminals" metaTestId="terminals-count" meta={meta ? `${meta.active} active · ${meta.total} total` : '...'}>

        <div className={`${SAAS.filterBar} md:grid-cols-[minmax(0,1fr)_12rem]`}>
          <SaasSearchInput label="Search terminals" placeholder="Search by name, model or device ID…" value={search} onChange={(value) => setSearch(value)} />
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All statuses</option>
            {TERMINAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {mismatch ? (
          <SaasErrorState message={`Merchant #${merchantId} does not belong to company #${companyId}.`} />
        ) : isLoading && rows.length === 0 ? (
          <SaasLoadingState label="Loading branch terminals..." />
        ) : error ? (
          <SaasErrorState message={error} onRetry={() => void load()} />
        ) : visibleRows.length === 0 ? (
          <SaasEmptyState
            icon="point_of_sale"
            title={hasFilters ? 'No terminals match your filters' : 'No terminals registered for this branch'}
            description={
              hasFilters
                ? 'Adjust the search text or the status filter to see more terminals.'
                : 'Payment terminals appear here once they are registered for the merchant branch.'
            }
            action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={SAAS.table}>
              <thead className={SAAS.thead}>
                <tr>
                  <th className={HEADER_CLASS}>Terminal</th>
                  <th className={`${HEADER_CLASS} hidden md:table-cell`}>Device ID</th>
                  <th className={`${HEADER_CLASS} hidden sm:table-cell`}>Provider / Model</th>
                  <th className={HEADER_CLASS}>Status</th>
                  <th className={`${HEADER_CLASS} hidden lg:table-cell`}>Created</th>
                  <th className={`${HEADER_CLASS} hidden lg:table-cell`}>Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {visibleRows.map((terminal) => (
                  <tr
                    key={terminal.id}
                    data-testid={`terminal-row-${terminal.id}`}
                    className={SAAS.row}
                  >
                    <td className={`${SAAS.td} min-w-0`}>
                      <p className={SAAS.rowTitle}>
                        {terminal.name}
                      </p>
                      <p className={`${SAAS.rowSubtitle} md:hidden break-all`}>{terminal.deviceIdentifier}</p>
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden md:table-cell break-all font-mono`}>
                      {terminal.deviceIdentifier}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden sm:table-cell`}>
                      <span className="block">{formatProviderLabel(terminal.provider)}</span>
                      <span className={`block ${SAAS.rowSubtitle}`}>{terminal.model || '—'}</span>
                    </td>
                    <td className={SAAS.td}>
                      <SaasStatusBadge status={terminal.status} />
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden lg:table-cell whitespace-nowrap`}>
                      {formatDate(terminal.createdAt)}
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden lg:table-cell whitespace-nowrap`}>
                      {formatDate(terminal.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SaasPanel>
      <SaasNavBar backLabel="Back to Merchant Hub" backTo={hubPath} items={merchantNav(companyId, merchantId, 'merchant-terminals')} />
    </div>
  );
};

export default MerchantTerminalsDirectoryView;
