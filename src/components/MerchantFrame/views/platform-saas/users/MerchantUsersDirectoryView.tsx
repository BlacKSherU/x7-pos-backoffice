// Historia 2 — Merchant User Directory (/platform-saas/merchants/:merchantId/users).
// Usuarios de la sucursal (por defecto los activos); cada fila abre el dashboard del usuario.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasMerchant, listSaasMerchantUsers } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import {
  companiesTrail,
  merchantLabel,
  merchantTrail,
  withCurrent,
} from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { ALL, filterUserRows, queryValue } from '@/modules/platform-saas/companies/lib/saas-directory-filters';
import { formatRoleLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import { useDebouncedValue } from '@/modules/platform-saas/companies/lib/use-debounced-value';
import type { SaasMerchantProfile, SaasMerchantUser } from '@/modules/platform-saas/merchants/types/saas-merchant';
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

const USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export interface MerchantUsersDirectoryViewProps {
  merchantId: number;
}

export const MerchantUsersDirectoryView: React.FC<MerchantUsersDirectoryViewProps> = ({ merchantId }) => {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<SaasMerchantProfile | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [rows, setRows] = useState<SaasMerchantUser[]>([]);
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
      const result = await listSaasMerchantUsers(merchantId, {
        search: queryValue(debouncedSearch),
        status: queryValue(status),
      });
      if (current !== requestId.current) return;
      setRows(result.items.filter((user) => Number(user.merchantId) === merchantId));
      setMeta(result.meta);
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load merchant users. Please try again.');
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

  const visibleRows = useMemo(() => filterUserRows(rows, { search, status }), [rows, search, status]);
  const hasFilters = search.trim() !== '' || status !== ALL;
  const name = merchantLabel(merchantId, merchant?.name);

  const trail = merchant
    ? merchantTrail(merchant.companyId, merchant.companyName, merchantId, merchant.name)
    : [...companiesTrail(), { label: name }];

  const openUser = (user: SaasMerchantUser) => navigate(platformSaasPaths.merchantUserDetail(merchantId, user.id));

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(trail, 'Users')}
        icon="group"
        title="MERCHANT USER DIRECTORY"
        description={`Users assigned to ${name}: credentials, roles, email addresses and account status. Select a user to open their dashboard.`}
        actions={
          merchant
            ? [
                {
                  label: 'Back to Merchant Hub',
                  icon: 'arrow_back',
                  variant: 'secondary',
                  onClick: () => navigate(platformSaasPaths.merchantHub(merchant.companyId, merchantId)),
                },
              ]
            : []
        }
      />

      <SaasPanel title="Branch Users" metaTestId="users-count" meta={meta ? `${meta.active} active · ${meta.total} total` : '...'}>

        <div className={`${SAAS.filterBar} md:grid-cols-[minmax(0,1fr)_12rem]`}>
          <SaasSearchInput label="Search users" placeholder="Search by username, email or role…" value={search} onChange={(value) => setSearch(value)} />
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={`${SAAS.input} border-[#e8e2d8]`}
          >
            <option value={ALL}>All statuses</option>
            {USER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading && rows.length === 0 ? (
          <SaasLoadingState label="Loading branch users..." />
        ) : error ? (
          <SaasErrorState message={error} onRetry={() => void load()} />
        ) : visibleRows.length === 0 ? (
          <SaasEmptyState
            icon="person_off"
            title={hasFilters ? 'No users match your filters' : 'No users assigned to this branch'}
            description={
              hasFilters
                ? 'Adjust the search text or the status filter to see more users.'
                : 'Users appear here once they are created for the merchant branch.'
            }
            action={
              hasFilters
                ? {
                    label: 'Show all users',
                    onClick: () => {
                      setSearch('');
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
                  <th className={HEADER_CLASS}>User</th>
                  <th className={`${HEADER_CLASS} hidden md:table-cell`}>Email</th>
                  <th className={`${HEADER_CLASS} hidden sm:table-cell`}>Role</th>
                  <th className={HEADER_CLASS}>Status</th>
                  <th className={`${HEADER_CLASS} text-right`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {visibleRows.map((user) => (
                  <tr
                    key={user.id}
                    data-testid={`user-row-${user.id}`}
                    onClick={() => openUser(user)}
                    className={SAAS.rowLink}
                  >
                    <td className={SAAS.td}>
                      <p className={SAAS.rowTitle}>
                        {user.username || user.email}
                      </p>
                      <p className={`${SAAS.rowSubtitle} md:hidden break-all`}>{user.email}</p>
                    </td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden md:table-cell break-all`}>{user.email}</td>
                    <td className={`${SAAS.td} text-sm text-[#1d1c17] hidden sm:table-cell`}>{formatRoleLabel(user.role)}</td>
                    <td className={SAAS.td}>
                      <SaasStatusBadge status={user.status} />
                    </td>
                    <td className={`${SAAS.td} text-right`}>
                      <button
                        type="button"
                        aria-label={`Open ${user.username || user.email} dashboard`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openUser(user);
                        }}
                        className={SAAS.rowAction}
                      >
                        <span className="hidden md:inline">Open</span>
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
      <SaasNavBar backLabel="Back to Merchant Hub" backTo={merchant ? platformSaasPaths.merchantHub(merchant.companyId, merchantId) : platformSaasPaths.companiesHub()} items={merchantNav(merchant?.companyId, merchantId, 'merchant-users')} />
    </div>
  );
};

export default MerchantUsersDirectoryView;
