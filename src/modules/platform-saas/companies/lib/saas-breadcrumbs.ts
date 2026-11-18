import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';

export interface SaasCrumb {
  label: string;
  /** Sin `to` la miga es la página actual (no navegable). */
  to?: string;
}

export function companyLabel(companyId: number, name?: string | null): string {
  return name?.trim() || `Company #${companyId}`;
}

export function merchantLabel(merchantId: number, name?: string | null): string {
  return name?.trim() || `Merchant #${merchantId}`;
}

/** Platform SaaS › Companies Hub */
export function companiesTrail(): SaasCrumb[] {
  return [{ label: 'Platform SaaS' }, { label: 'Companies Hub', to: platformSaasPaths.companiesHub() }];
}

/** … › Companies Directory › <Company> */
export function companyTrail(companyId: number, companyName?: string | null): SaasCrumb[] {
  return [
    ...companiesTrail(),
    { label: 'Companies Directory', to: platformSaasPaths.companiesDirectory() },
    { label: companyLabel(companyId, companyName), to: platformSaasPaths.companyHub(companyId) },
  ];
}

/** … › <Company> › Merchants › <Merchant> */
export function merchantTrail(
  companyId: number,
  companyName: string | null | undefined,
  merchantId: number,
  merchantName?: string | null,
): SaasCrumb[] {
  return [
    ...companyTrail(companyId, companyName),
    { label: 'Merchants', to: platformSaasPaths.companyMerchants(companyId) },
    { label: merchantLabel(merchantId, merchantName), to: platformSaasPaths.merchantHub(companyId, merchantId) },
  ];
}

/** Añade la página actual (sin enlace) al final del rastro. */
export function withCurrent(trail: SaasCrumb[], current: string): SaasCrumb[] {
  return [...trail, { label: current }];
}
