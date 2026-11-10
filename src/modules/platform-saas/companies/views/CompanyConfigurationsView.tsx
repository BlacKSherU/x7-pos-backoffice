import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyConfigurations } from '@/modules/platform-saas/companies/api/companies';
import {
  getSaasCompanyConfigurations,
  getSaasCompanyHub,
} from '@/modules/platform-saas/companies/api/saas-companies';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companyTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import {
  SaasEmptyState,
  SaasErrorState,
  SaasLoadingState,
  SaasNavBar,
  SaasPageHeader,
  SaasPanel,
  SaasStatCards,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';
import { companyNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import {
  getConfigurationStatusClass,
} from '@/modules/platform-saas/companies/lib/company-configurations';
import { navigateToDashboardFeature } from '@/modules/platform-saas/merchants/lib/merchant-directory-navigation';
import type { CompanyConfigurationsData } from '@/modules/platform-saas/companies/types/company';

const CONFIGURATION_MODULES = [
  {
    label: 'Payroll Rules',
    description: 'Corporate payroll calculation policies across branches.',
    icon: 'payments',
    target: { activeTab: 'merchant-payroll-rules', activeCategory: 'financehr' },
  },
  {
    label: 'Overtime Rules',
    description: 'Shared overtime thresholds and branch compliance settings.',
    icon: 'schedule',
    target: { activeTab: 'merchant-overtime-rules', activeCategory: 'financehr' },
  },
  {
    label: 'Tips Configuration',
    description: 'Tip pooling and settlement policies for corporate stores.',
    icon: 'savings',
    target: { activeTab: 'tips', activeCategory: 'restaurantoperations' },
  },
] as const;

export interface CompanyConfigurationsViewProps {
  /**
   * Company a mostrar (Platform SaaS, /platform-saas/companies/:id/configuration). Sin él, la
   * vista es la configuración de la company propia (/dashboard/company-configurations).
   */
  companyId?: number;
}

export const CompanyConfigurationsView: React.FC<CompanyConfigurationsViewProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const isTenantView = companyId != null;
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [data, setData] = useState<CompanyConfigurationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfigurations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response =
        companyId != null
          ? await getSaasCompanyConfigurations(companyId)
          : await getCompanyConfigurations();
      setData(response);
      if (companyId != null) rememberCompanyContext(companyId);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load company configurations. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadConfigurations();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga solo al cambiar de company
  }, [companyId]);

  // Nombre de la company para las migas (no bloquea la vista si falla).
  useEffect(() => {
    if (companyId == null) return;
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

  // Platform SaaS (/platform-saas/companies/:id/configuration): mismas piezas y escala que el
  // resto de vistas de companies (SaasViewKit) y la barra inferior de navegación.
  if (companyId != null) {
    return (
      <div className={SAAS.page}>
        <SaasPageHeader
          breadcrumbs={withCurrent(companyTrail(companyId, companyName), 'Company Configuration')}
          icon="settings"
          title="COMPANY CONFIGURATION"
          description="Tenant configuration records (tax, tips, payroll and overtime rules) of every branch of the company."
          actions={[
            {
              label: 'Back to Company Hub',
              icon: 'arrow_back',
              variant: 'secondary',
              onClick: () => navigate(platformSaasPaths.companyHub(companyId)),
            },
          ]}
        />

        {isLoading && !data ? (
          <SaasLoadingState label="Loading company configurations..." />
        ) : error ? (
          <SaasErrorState message={error} onRetry={() => void loadConfigurations()} />
        ) : data ? (
          <>
            <SaasStatCards
              stats={[
                {
                  id: 'total-configurations',
                  label: 'Configuration Records',
                  value: data.summary.totalConfigurations,
                  hint: 'Records of every branch',
                  icon: 'tune',
                },
                {
                  id: 'active-configurations',
                  label: 'Active Configurations',
                  value: data.summary.activeConfigurations,
                  hint: 'Currently applied',
                  icon: 'check_circle',
                },
                {
                  id: 'configuration-types',
                  label: 'Configuration Types',
                  value: data.summary.configurationTypes,
                  hint: 'Tax, tips, payroll, overtime',
                  icon: 'category',
                },
              ]}
            />
            <SaasPanel title="Configuration Registry" metaTestId="configurations-count" meta={`${data.items.length} records`}>
              {data.items.length === 0 ? (
                <SaasEmptyState
                  icon="settings"
                  title="No configuration records found for this company yet."
                  description="Configuration records appear here once the company branches define tax, tips, payroll or overtime rules."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className={SAAS.table}>
                    <thead className={SAAS.thead}>
                      <tr>
                        <th className={SAAS.th}>Configuration Type</th>
                        <th className={SAAS.th}>Branch</th>
                        <th className={SAAS.th}>Status</th>
                        <th className={`${SAAS.th} hidden sm:table-cell`}>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8e2d8]">
                      {data.items.map((item) => (
                        <tr key={item.id} data-testid={`configuration-row-${item.id}`} className={SAAS.row}>
                          <td className={SAAS.td}>
                            <p className={SAAS.rowTitle}>{item.configurationLabel}</p>
                          </td>
                          <td className={SAAS.td}>
                            <p className="text-sm text-[#1d1c17] break-words">{item.merchantName}</p>
                            <p className={SAAS.rowSubtitle}>Branch ID: {item.merchantId}</p>
                          </td>
                          <td className={SAAS.td}>
                            <span
                              className={`inline-flex items-center h-6 px-2 rounded border border-transparent text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getConfigurationStatusClass(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className={`${SAAS.td} hidden sm:table-cell whitespace-nowrap`}>{item.updatedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SaasPanel>
          </>
        ) : null}

        <SaasNavBar
          backLabel="Back to Company Hub"
          backTo={platformSaasPaths.companyHub(companyId)}
          items={companyNav(companyId, 'company-configuration')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left min-w-0">
      {isTenantView ? (
        <SaasPageHeader
          breadcrumbs={withCurrent(companyTrail(companyId, companyName), 'Company Configuration')}
          icon="settings"
          title="COMPANY CONFIGURATION"
          description="Tenant configuration records (tax, tips, payroll and overtime rules) of every branch of the company."
          actions={[
            {
              label: 'Back to Company Hub',
              icon: 'arrow_back',
              variant: 'secondary',
              onClick: () => navigate(platformSaasPaths.companyHub(companyId)),
            },
          ]}
        />
      ) : (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/dashboard/company-profile')}
          className="px-5 py-2.5 border border-[#e8e2d8] rounded font-semibold text-[#1d1c17] bg-white hover:bg-[#f8f3eb] transition-colors text-label-caps"
        >
          Back to Company Profile
        </button>
      </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">
            sync
          </span>
          <p className="text-secondary text-body-md mt-2 font-sans">
            Loading corporate configurations...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white border border-[#e8e2d8] p-12 text-center rounded shadow-sm">
          <span className="material-symbols-outlined text-[#ba1a1a] text-4xl">
            error
          </span>
          <p className="text-[#ba1a1a] font-bold mt-2 font-sans">{error}</p>
          <button
            type="button"
            onClick={() => void loadConfigurations()}
            className="mt-4 px-4 py-2 bg-[#222222] text-white font-bold text-label-caps hover:bg-[#ae001a] transition-all font-sans"
          >
            Retry Connection
          </button>
        </div>
      ) : data ? (
        <>
          <div className="bg-white border border-[#e8e2d8] overflow-hidden rounded shadow-sm">
            <div className="bg-[#222222] p-4">
              <span className="text-label-caps font-bold text-white uppercase tracking-wider">
                CORPORATE SYSTEM CONFIGURATIONS
              </span>
              <p className="text-white/80 text-body-sm mt-2 max-w-3xl">
                {isTenantView
                  ? 'Branch-level configuration records linked to this company.'
                  : 'Global system variables and branch-level configuration records linked to your parent company.'}
              </p>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryTile
                  label="Total Configuration Records"
                  value={data.summary.totalConfigurations}
                  icon="tune"
                />
                <SummaryTile
                  label="Active Configurations"
                  value={data.summary.activeConfigurations}
                  icon="check_circle"
                />
                <SummaryTile
                  label="Configuration Types"
                  value={data.summary.configurationTypes}
                  icon="category"
                />
              </div>

              {!isTenantView && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CONFIGURATION_MODULES.map((module) => (
                  <button
                    key={module.label}
                    type="button"
                    onClick={() =>
                      navigateToDashboardFeature(navigate, module.target)
                    }
                    className="text-left border border-[#e8e2d8] rounded p-5 bg-[#f9f7f4] hover:bg-[#f8f3eb] hover:border-[#ae001a]/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[#ae001a] text-2xl">
                      {module.icon}
                    </span>
                    <p className="font-bold text-[#1d1c17] mt-3">{module.label}</p>
                    <p className="text-body-sm text-secondary mt-1">
                      {module.description}
                    </p>
                  </button>
                ))}
              </div>
              )}

              <div className="border border-[#e8e2d8] rounded overflow-hidden">
                <div className="bg-[#ece8e0] px-6 py-3 border-b border-[#e8e2d8]">
                  <span className="text-label-caps font-bold text-[#5f5e5e]">
                    Configuration Registry
                  </span>
                </div>

                {data.items.length === 0 ? (
                  <div className="px-6 py-14">
                    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 text-center">
                      <span className="material-symbols-outlined text-[#5f5e5e] text-5xl">
                        settings
                      </span>
                      <p className="text-[#1d1c17] font-bold font-sans">
                        No configuration records found for this company yet.
                      </p>
                      <p className="text-body-sm text-secondary font-sans leading-relaxed">
                        {isTenantView
                          ? 'Configuration records appear here once the company branches define tax, tips, payroll or overtime rules.'
                          : 'Use the module shortcuts above to create payroll, overtime, or tips policies for your corporate branches.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-white border-b border-[#e8e2d8]">
                        <tr>
                          <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                            Configuration Type
                          </th>
                          <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                            Branch
                          </th>
                          <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-label-caps font-bold text-[#5f5e5e]">
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[#e8e2d8] hover:bg-[#f8f3eb] transition-colors"
                          >
                            <td className="px-6 py-4 font-bold text-[#1d1c17]">
                              {item.configurationLabel}
                            </td>
                            <td className="px-6 py-4 text-body-md text-[#1d1c17]">
                              <p>{item.merchantName}</p>
                              <p className="text-body-sm text-secondary">
                                Branch ID: {item.merchantId}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-label-caps font-bold ${getConfigurationStatusClass(item.status)}`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-body-md text-[#1d1c17]">
                              {item.updatedAt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="border border-[#e8e2d8] rounded p-4 text-center bg-[#f9f7f4]">
      <span className="material-symbols-outlined text-[#ae001a] text-2xl">
        {icon}
      </span>
      <p className="text-2xl font-black text-[#1d1c17] mt-2">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mt-1">
        {label}
      </p>
    </div>
  );
}
