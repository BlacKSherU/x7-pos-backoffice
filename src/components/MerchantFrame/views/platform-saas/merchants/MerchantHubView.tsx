// Historia 5 — Merchant Hub (/platform-saas/companies/:companyId/merchants/:merchantId/hub).
// KPIs de la sucursal (terminales POS, transacciones locales, usuarios) y tarjetas a su perfil,
// a su directorio de usuarios y a su directorio de terminales POS.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasMerchantHub } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { merchantLabel, merchantTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { formatStatusLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import type { SaasMerchantHub } from '@/modules/platform-saas/merchants/types/saas-merchant';
import { merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import {
  SaasErrorState,
  SaasNavBar,
  SaasFeatureCards,
  SaasPageHeader,
  SaasStatCards,
  type SaasFeatureCard,
  type SaasStatItem,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

export interface MerchantHubViewProps {
  companyId: number;
  merchantId: number;
}

export const MerchantHubView: React.FC<MerchantHubViewProps> = ({ companyId, merchantId }) => {
  const navigate = useNavigate();
  const [hub, setHub] = useState<SaasMerchantHub | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSaasMerchantHub(merchantId);
      if (Number(data.merchant.companyId) !== companyId) {
        setHub(null);
        setError(`Merchant #${merchantId} does not belong to company #${companyId}.`);
        return;
      }
      setHub(data);
      rememberCompanyContext(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the merchant hub. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const merchant = hub?.merchant;
  const name = merchantLabel(merchantId, merchant?.name);
  const go = (path: string) => () => navigate(path);
  const s = hub?.stats;

  const stats: SaasStatItem[] = [
    {
      id: 'active-pos-terminals',
      label: 'Active POS Terminals',
      value: s?.activePosTerminals ?? '—',
      hint: s ? `${s.totalPosTerminals} terminals registered` : 'Payment terminals of the branch',
      icon: 'point_of_sale',
    },
    {
      id: 'local-transactions',
      label: 'Local Transactions',
      value: s?.transactionsToday ?? '—',
      hint: s ? `Today · ${s.transactionsTotal} in total` : 'Transactions of the branch',
      icon: 'receipt_long',
    },
    {
      id: 'active-users',
      label: 'Active Users',
      value: s?.activeUsers ?? '—',
      hint: s ? `${s.totalUsers} user accounts` : 'Users of the branch',
      icon: 'group',
    },
  ];

  const cards: SaasFeatureCard[] = [
    {
      id: 'merchant-profile',
      title: 'Merchant Profile',
      subtitle: 'BRANCH DETAILS & SETTINGS',
      description: 'Update the branch name, contact numbers, physical address, timezone and operational status.',
      icon: 'storefront',
      actionText: 'Open Merchant Profile',
      onClick: go(platformSaasPaths.merchantProfile(companyId, merchantId)),
    },
    {
      id: 'merchant-users',
      title: 'Merchant User Directory',
      subtitle: 'USERS, ROLES & STATUS',
      description: 'Review the users assigned to this branch, their roles, emails and account status.',
      icon: 'group',
      actionText: 'Open User Directory',
      onClick: go(platformSaasPaths.merchantUsers(merchantId)),
    },
    {
      id: 'merchant-terminals',
      title: 'POS Terminals',
      subtitle: 'PAYMENT DEVICES & STATUS',
      description: 'Review the payment and POS terminals of this branch: device IDs, provider, model and status.',
      icon: 'point_of_sale',
      actionText: 'Open Terminals Directory',
      onClick: go(platformSaasPaths.merchantTerminals(companyId, merchantId)),
    },
  ];

  const description = merchant
    ? [merchant.branchCode, merchant.city, formatStatusLabel(merchant.status), merchant.companyName]
        .filter(Boolean)
        .join(' · ')
    : 'Operational parameters of the merchant branch.';

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(merchantTrail(companyId, merchant?.companyName, merchantId, merchant?.name), 'Merchant Hub')}
        icon="storefront"
        title={`${name.toUpperCase()} · MERCHANT HUB`}
        description={description}
        actions={[
          {
            label: 'Company Merchants',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: go(platformSaasPaths.companyMerchants(companyId)),
          },
        ]}
      />

      {error ? (
        <SaasErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <SaasStatCards stats={stats} loading={isLoading} />
          <SaasFeatureCards cards={cards} />
        </>
      )}

      <SaasNavBar
        backLabel="Back to Company Merchants"
        backTo={platformSaasPaths.companyMerchants(companyId)}
        items={merchantNav(companyId, merchantId, 'merchant-hub')}
      />
    </div>
  );
};

export default MerchantHubView;
