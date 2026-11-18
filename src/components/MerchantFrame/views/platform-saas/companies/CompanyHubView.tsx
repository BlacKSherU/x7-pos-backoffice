// Company Hub (/platform-saas/companies/:id/hub): destino de las filas del Companies Directory.
// Métricas de la company y tarjetas a su perfil, su configuración y su directorio de merchants.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasCompanyHub } from '@/modules/platform-saas/companies/api/saas-companies';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companyLabel, companyTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { formatLocation, formatStatusLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import type { SaasCompanyHub } from '@/modules/platform-saas/companies/types/saas-company';
import { companyNav } from '@/modules/platform-saas/companies/lib/saas-nav';
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

export interface CompanyHubViewProps {
  companyId: number;
}

export const CompanyHubView: React.FC<CompanyHubViewProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const [hub, setHub] = useState<SaasCompanyHub | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSaasCompanyHub(companyId);
      setHub(data);
      rememberCompanyContext(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the company hub. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const company = hub?.company;
  const name = companyLabel(companyId, company?.name);
  const go = (path: string) => () => navigate(path);

  const stats: SaasStatItem[] = [
    {
      id: 'total-merchants',
      label: 'Merchant Branches',
      value: hub?.stats.totalMerchants ?? '—',
      hint: 'Branches registered for the company',
      icon: 'storefront',
    },
    {
      id: 'active-merchants',
      label: 'Active Merchants',
      value: hub?.stats.activeMerchants ?? '—',
      hint: 'Branches currently operating',
      icon: 'check_circle',
    },
    {
      id: 'active-users',
      label: 'Active Users',
      value: hub?.stats.activeUsers ?? '—',
      hint: 'User accounts across the branches',
      icon: 'group',
    },
    {
      id: 'configurations',
      label: 'Configurations',
      value: hub?.stats.configurations ?? '—',
      hint: 'Tenant configuration records',
      icon: 'settings',
    },
  ];

  const cards: SaasFeatureCard[] = [
    {
      id: 'company-profile',
      title: 'Company Profile',
      subtitle: 'LEGAL & FISCAL RECORDS',
      description: 'Edit legal name, commercial name, tax ID, billing address, base currency and account status.',
      icon: 'business',
      actionText: 'Open Company Profile',
      onClick: go(platformSaasPaths.companyProfile(companyId)),
    },
    {
      id: 'company-configuration',
      title: 'Company Configuration',
      subtitle: 'TENANT SETUP & POLICIES',
      description: 'Review the tax, tips, payroll and overtime configuration records of every branch.',
      icon: 'settings',
      actionText: 'Open Company Configuration',
      onClick: go(platformSaasPaths.companyConfiguration(companyId)),
    },
    {
      id: 'company-merchants',
      title: 'Merchants Directory',
      subtitle: 'BRANCHES OF THIS COMPANY',
      description: 'Filter the company branches by city, status or name and open each Merchant Hub.',
      icon: 'storefront',
      actionText: 'Open Merchants Directory',
      onClick: go(platformSaasPaths.companyMerchants(companyId)),
    },
  ];

  const description = company
    ? [
        company.legalName || null,
        company.taxId ? `Tax ID ${company.taxId}` : null,
        formatLocation(company.city, company.country),
        `${formatStatusLabel(company.status)} · ${company.baseCurrency ?? 'USD'}`,
      ]
        .filter((part) => part && part !== '—')
        .join(' · ')
    : 'Company profile, tenant configuration and merchant branches.';

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(companyTrail(companyId, company?.name), 'Company Hub')}
        icon="business"
        title={`${name.toUpperCase()} · COMPANY HUB`}
        description={description}
        actions={[
          {
            label: 'Companies Directory',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: go(platformSaasPaths.companiesDirectory()),
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
        backLabel="Back to Companies Directory"
        backTo={platformSaasPaths.companiesDirectory()}
        items={companyNav(companyId, 'company-hub')}
      />
    </div>
  );
};

export default CompanyHubView;
