// Dashboard de un usuario de sucursal (/platform-saas/merchants/:merchantId/users/:userId):
// destino de las filas del Merchant User Directory (historia 2). Usa GET /users/:id.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserById, getUserHrSummary } from '@/modules/platform-saas/users/api/users';
import { getSaasMerchant } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import {
  companiesTrail,
  merchantLabel,
  merchantTrail,
  withCurrent,
} from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { formatRoleLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import type { HrCollaborator, MerchantUser } from '@/modules/platform-saas/users/types/user';
import type { SaasMerchantProfile } from '@/modules/platform-saas/merchants/types/saas-merchant';
import { merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import {
  SaasErrorState,
  SaasNavBar,
  SaasPanel,
  SaasLoadingState,
  SaasPageHeader,
  SaasStatCards,
  SaasStatusBadge,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

export interface MerchantUserDashboardViewProps {
  merchantId: number;
  userId: number;
}

export const MerchantUserDashboardView: React.FC<MerchantUserDashboardViewProps> = ({ merchantId, userId }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<MerchantUser | null>(null);
  const [merchant, setMerchant] = useState<SaasMerchantProfile | null>(null);
  const [collaborators, setCollaborators] = useState<HrCollaborator[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserById(userId);
      if (Number(data.merchantId) !== merchantId) {
        setUser(null);
        setError(`User #${userId} does not belong to merchant #${merchantId}.`);
        return;
      }
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [merchantId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Contexto (sucursal, company) y fichas de RR. HH.: opcionales, no bloquean el dashboard.
  useEffect(() => {
    let active = true;
    getSaasMerchant(merchantId)
      .then((data) => {
        if (active) setMerchant(data);
      })
      .catch(() => undefined);
    getUserHrSummary(userId)
      .then((summary) => {
        if (active) setCollaborators(summary.collaborators ?? []);
      })
      .catch(() => {
        if (active) setCollaborators(null);
      });
    return () => {
      active = false;
    };
  }, [merchantId, userId]);

  const branch = merchantLabel(merchantId, merchant?.name);
  const trail = merchant
    ? merchantTrail(merchant.companyId, merchant.companyName, merchantId, merchant.name)
    : [...companiesTrail(), { label: branch }];
  const usersCrumb = { label: 'Users', to: platformSaasPaths.merchantUsers(merchantId) };
  const displayName = user ? user.username || user.email : `User #${userId}`;
  const status = user ? (user.isActive ? 'active' : 'inactive') : null;

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent([...trail, usersCrumb], displayName)}
        icon="account_circle"
        title="USER DASHBOARD"
        description={`Profile, role and access status of ${displayName} in ${branch}.`}
        actions={[
          {
            label: 'Back to Users',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: () => navigate(platformSaasPaths.merchantUsers(merchantId)),
          },
        ]}
      />

      {isLoading && !user ? (
        <SaasLoadingState label="Loading user..." />
      ) : error ? (
        <SaasErrorState message={error} onRetry={() => void load()} />
      ) : user ? (
        <>
          <SaasStatCards
            stats={[
              { id: 'role', label: 'Role', value: formatRoleLabel(user.role), hint: 'Access role', icon: 'shield_person' },
              { id: 'scope', label: 'Scope', value: formatRoleLabel(user.scope), hint: 'Application surface', icon: 'devices' },
              {
                id: 'status',
                label: 'Account Status',
                value: user.isActive ? 'Active' : 'Inactive',
                hint: user.isActive ? 'Can sign in' : 'Sign-in disabled',
                icon: 'verified_user',
              },
              {
                id: 'hr-profiles',
                label: 'HR Profiles',
                value: collaborators ? collaborators.length : '—',
                hint: 'Linked collaborator records',
                icon: 'badge',
              },
            ]}
          />

          <SaasPanel title="User Profile">
            <dl className={`${SAAS.cardPadding} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
              <Info label="Username" value={user.username || '—'} />
              <Info label="Email" value={user.email} />
              <Info label="User ID" value={String(user.id)} />
              <Info label="Role" value={formatRoleLabel(user.role)} />
              <Info label="Scope" value={formatRoleLabel(user.scope)} />
              <div className="min-w-0">
                <dt className={SAAS.label}>Status</dt>
                <dd>
                  <SaasStatusBadge status={status} />
                </dd>
              </div>
              <Info label="Merchant Branch" value={branch} />
              <Info label="Company" value={merchant?.companyName ?? '—'} />
            </dl>
          </SaasPanel>

          {collaborators && collaborators.length > 0 && (
            <SaasPanel title="Linked HR Collaborators">
              <ul className="divide-y divide-[#e8e2d8]">
                {collaborators.map((collaborator) => (
                  <li key={collaborator.id} className="px-5 h-16 flex flex-wrap items-center justify-between gap-2">
                    <span className={SAAS.rowTitle}>{collaborator.name}</span>
                    <span className={SAAS.rowSubtitle}>
                      {[collaborator.department, collaborator.role].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </SaasPanel>
          )}
        </>
      ) : null}

      <SaasNavBar
        backLabel="Back to Users"
        backTo={platformSaasPaths.merchantUsers(merchantId)}
        items={merchantNav(merchant?.companyId, merchantId, 'merchant-users')}
      />
    </div>
  );
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className={SAAS.label}>{label}</dt>
      <dd className="text-sm font-semibold text-[#1d1c17] break-words min-h-6">{value}</dd>
    </div>
  );
}

export default MerchantUserDashboardView;
