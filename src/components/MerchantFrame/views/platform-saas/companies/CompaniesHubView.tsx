// Historia 1 — Companies Hub (/platform-saas/companies/hub).
// Cabecera secundaria (con el selector "Company context"), métricas de companies, tarjetas de
// módulo y barra inferior de acceso rápido (NavHubBar). Company Profile / Company Configuration / Company Merchants abren
// siempre la vista de la company elegida en el selector.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasCompaniesStats, listSaasCompanies } from '@/modules/platform-saas/companies/api/saas-companies';
import { getCompanyProfile } from '@/modules/platform-saas/companies/api/companies';
import { getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';
import {
  getRememberedCompanyContext,
  pickCompanyContext,
  rememberCompanyContext,
} from '@/modules/platform-saas/companies/lib/company-context';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companiesTrail, companyLabel } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { formatStatusLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import type { SaasCompaniesStats, SaasCompanyListItem } from '@/modules/platform-saas/companies/types/saas-company';
import { companiesNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import {
  SaasAlert,
  SaasFeatureCards,
  SaasNavBar,
  SaasPageHeader,
  SaasStatCards,
  type SaasFeatureCard,
  type SaasStatItem,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

export const COMPANIES_HUB_TITLE = 'COMPANIES COMMAND HUB';

/** Companies del selector de contexto: el máximo que admite GET /v1/saas/companies por página. */
const CONTEXT_COMPANIES_LIMIT = 100;

type ContextTarget = 'profile' | 'configuration' | 'merchants';

/**
 * Company of the signed-in Company Administrator. Platform staff have no own company to fall
 * back to (GET /companies/company/profile answers 403 to them by design), so for them the hub
 * uses the remembered context or the first active company, without the request.
 */
async function loadOwnCompanyId(): Promise<number | null> {
  if (getEffectiveUserRole() !== 'merchant_admin') return null;
  try {
    const own = await getCompanyProfile();
    return own?.id ?? null;
  } catch {
    // Without a readable own company the hub uses the first active company.
    return null;
  }
}

export const CompaniesHubView: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SaasCompaniesStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<SaasCompanyListItem[] | null>(null);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [contextId, setContextIdState] = useState<number | null>(null);
  const [isContextReady, setIsContextReady] = useState(false);
  // La elección vigente, también para un clic que llega antes de que se resuelva el contexto.
  const contextRef = useRef<number | null>(null);
  const contextPromise = useRef<Promise<number | null> | null>(null);

  const setContextId = (id: number | null) => {
    contextRef.current = id;
    setContextIdState(id);
  };

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStats(await getSaasCompaniesStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company statistics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Opciones del selector (GET /api/v1/saas/companies) y company por defecto.
  useEffect(() => {
    let active = true;
    const companiesRequest = listSaasCompanies({ limit: CONTEXT_COMPANIES_LIMIT })
      .then((result) => ({ items: result.items, error: null as string | null }))
      .catch((err: unknown) => ({
        items: null,
        error: err instanceof Error ? err.message : 'Failed to load companies.',
      }));
    const promise = Promise.all([companiesRequest, loadOwnCompanyId()]).then(([list, ownId]) => {
      const id = pickCompanyContext({
        remembered: getRememberedCompanyContext(),
        ownCompanyId: ownId,
        companies: list.items,
      });
      if (active) {
        setCompanies(list.items);
        setCompaniesError(list.error);
        if (contextRef.current === null) setContextId(id);
        setIsContextReady(true);
      }
      return id;
    });
    contextPromise.current = promise;
    return () => {
      active = false;
    };
  }, []);

  const changeContext = (value: string) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return;
    setContextId(id);
    rememberCompanyContext(id);
  };

  const openContextFeature = async (target: ContextTarget) => {
    const id = contextRef.current ?? (await contextPromise.current) ?? contextRef.current;
    if (!id) {
      // Solo sin ninguna company registrada (o sin poder listarlas): hay que elegir una.
      navigate(platformSaasPaths.companiesDirectory());
      return;
    }
    if (target === 'profile') navigate(platformSaasPaths.companyProfile(id));
    else if (target === 'configuration') navigate(platformSaasPaths.companyConfiguration(id));
    else navigate(platformSaasPaths.companyMerchants(id));
  };

  const openDirectory = () => navigate(platformSaasPaths.companiesDirectory());

  const value = (n: number | undefined) => (stats && typeof n === 'number' ? n : '—');

  const statItems: SaasStatItem[] = [
    {
      id: 'active-companies',
      label: 'Active Companies',
      value: value(stats?.activeCompanies),
      hint: stats
        ? `${stats.totalCompanies} company profiles · ${stats.suspendedCompanies} suspended`
        : 'Company profiles',
      icon: 'business',
    },
    {
      id: 'tenant-configurations',
      label: 'Tenant Configurations',
      value: value(stats?.tenantConfigurations),
      hint: stats ? `${stats.activeConfigurations} active configurations` : 'Configuration records',
      icon: 'settings',
    },
    {
      id: 'system-profiles',
      label: 'System Profiles',
      value: value(stats?.systemProfiles),
      hint: 'User profiles registered in the system',
      icon: 'badge',
    },
    {
      id: 'active-merchants',
      label: 'Active Merchants',
      value: value(stats?.activeMerchants),
      hint: 'Operating merchant branches',
      icon: 'storefront',
    },
  ];

  const contextOptions: Array<{ id: number; label: string }> = (companies ?? []).map((company) => ({
    id: company.id,
    label:
      (company.status ?? '').toLowerCase() === 'active'
        ? companyLabel(company.id, company.name)
        : `${companyLabel(company.id, company.name)} (${formatStatusLabel(company.status)})`,
  }));
  if (contextId && !contextOptions.some((option) => option.id === contextId)) {
    contextOptions.unshift({ id: contextId, label: companyLabel(contextId) });
  }
  const contextName = contextOptions.find((option) => option.id === contextId)?.label;
  const contextHint = !isContextReady
    ? 'Resolving the company context…'
    : contextId
      ? `Opens ${contextName ?? companyLabel(contextId)}.`
      : 'No company registered yet: pick one from the directory.';

  const cards: SaasFeatureCard[] = [
    {
      id: 'company-profile',
      title: 'Company Profile',
      subtitle: 'LEGAL, FISCAL & ADMINISTRATIVE RECORDS',
      description: `Inspect and edit legal name, commercial name, tax ID, billing address, base currency and account status. ${contextHint}`,
      icon: 'business',
      actionText: 'Open Company Profile',
      onClick: () => void openContextFeature('profile'),
    },
    {
      id: 'company-configuration',
      title: 'Company Configuration',
      subtitle: 'TENANT SETUP & BRANCH POLICIES',
      description: `Review tenant configuration records (tax, tips, payroll and overtime rules) across the company branches. ${contextHint}`,
      icon: 'settings',
      actionText: 'Open Company Configuration',
      onClick: () => void openContextFeature('configuration'),
    },
    {
      id: 'companies-directory',
      title: 'Companies Directory',
      subtitle: 'ALL REGISTERED TENANTS',
      description: 'Search and filter every registered company by status, subscription tier or name, and open its Company Hub.',
      icon: 'domain',
      actionText: 'Open Companies Directory',
      onClick: openDirectory,
    },
  ];

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={companiesTrail()}
        icon="business"
        title={COMPANIES_HUB_TITLE}
        description="Company profile management and tenant setup: inspect company profiles, review tenant configurations and jump into each company's management sub-modules."
        actions={[{ label: 'Companies Directory', icon: 'domain', onClick: openDirectory }]}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 font-poppins">
          <div className="flex items-center gap-1.5 shrink-0">
            <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconMd} text-[#ae001a]`}>
              apartment
            </span>
            <label htmlFor="companies-hub-context" className={`${SAAS.caption} text-[#5f5e5e]`}>
              Company context
            </label>
          </div>
          <select
            id="companies-hub-context"
            data-testid="company-context-select"
            value={contextId ? String(contextId) : ''}
            onChange={(event) => changeContext(event.target.value)}
            disabled={!isContextReady || contextOptions.length === 0}
            aria-describedby="companies-hub-context-hint"
            className={`${SAAS.input} border-[#e8e2d8] sm:max-w-[24rem] font-poppins font-semibold cursor-pointer hover:text-primary transition-colors duration-200`}
          >
            {!isContextReady && <option value="">Loading companies…</option>}
            {isContextReady && contextOptions.length === 0 && <option value="">No companies available</option>}
            {contextOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.label}
              </option>
            ))}
          </select>
          <span id="companies-hub-context-hint" className={`${SAAS.rowSubtitle} min-w-0`}>
            {companiesError
              ? `Could not load the company list (${companiesError}).`
              : 'Company Profile, Company Configuration and Company Merchants open this company.'}
          </span>
        </div>
      </SaasPageHeader>

      {error && (
        <SaasAlert tone="error" role="alert">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => void loadStats()} className={SAAS.buttonDark}>
              Retry
            </button>
          </span>
        </SaasAlert>
      )}

      <SaasStatCards stats={statItems} loading={isLoading} />

      <SaasFeatureCards cards={cards} />

      <SaasNavBar
        backLabel="Back to Platform SaaS Dashboard"
        backTo="/dashboard"
        items={companiesNav('companies-hub', contextId)}
      />
    </div>
  );
};

export default CompaniesHubView;
