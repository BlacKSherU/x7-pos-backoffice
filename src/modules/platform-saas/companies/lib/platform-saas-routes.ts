/**
 * URLs de Platform SaaS con contexto de company / merchant / usuario (historias 1-7).
 *
 * Todas renderizan MerchantFrame (categoría `platform-saas`); la URL fija la pestaña y los ids.
 * merchant-routes.ts resuelve la pestaña con `matchPlatformSaasRoute` y las vistas construyen
 * sus enlaces con `platformSaasPaths`, así ruta y enlace no se desalinean.
 */

export const PLATFORM_SAAS_CATEGORY = 'platform-saas';

export const PLATFORM_SAAS_TABS = {
  companiesHub: 'saas-companies-hub',
  companiesDirectory: 'saas-companies-directory',
  companyHub: 'saas-company-hub',
  companyProfile: 'saas-company-profile',
  companyConfiguration: 'saas-company-configuration',
  companyMerchants: 'saas-company-merchants',
  merchantHub: 'saas-merchant-hub',
  merchantProfile: 'saas-merchant-profile',
  merchantTerminals: 'saas-merchant-terminals',
  merchantUsers: 'saas-merchant-users',
  merchantUserDetail: 'saas-merchant-user-detail',
} as const;

export type PlatformSaasTab = (typeof PLATFORM_SAAS_TABS)[keyof typeof PLATFORM_SAAS_TABS];

/** Título que muestra la cabecera global (GlobalHeader) para cada pestaña de Platform SaaS. */
export const PLATFORM_SAAS_TAB_TITLES: Record<PlatformSaasTab, string> = {
  'saas-companies-hub': 'Companies Overview',
  'saas-companies-directory': 'Companies Directory',
  'saas-company-hub': 'Company Overview',
  'saas-company-profile': 'Company Profile',
  'saas-company-configuration': 'Company Configuration',
  'saas-company-merchants': 'Company Merchants',
  'saas-merchant-hub': 'Merchant Overview',
  'saas-merchant-profile': 'Merchant Profile',
  'saas-merchant-terminals': 'Merchant Terminals',
  'saas-merchant-users': 'Merchant User Directory',
  'saas-merchant-user-detail': 'User Dashboard',
};

export function platformSaasTabTitle(tab: string): string | null {
  return (PLATFORM_SAAS_TAB_TITLES as Record<string, string>)[tab] ?? null;
}

export type PlatformSaasParamName = 'companyId' | 'merchantId' | 'userId';

export type PlatformSaasRouteParams = Partial<Record<PlatformSaasParamName, number>>;

export interface PlatformSaasRouteMatch {
  tab: PlatformSaasTab;
  params: PlatformSaasRouteParams;
}

const ID = '([1-9]\\d*)';

const PATTERNS: Array<[RegExp, PlatformSaasTab, PlatformSaasParamName[]]> = [
  [new RegExp('^/platform-saas/companies/hub$'), PLATFORM_SAAS_TABS.companiesHub, []],
  [new RegExp('^/platform-saas/companies/directory$'), PLATFORM_SAAS_TABS.companiesDirectory, []],
  [new RegExp(`^/platform-saas/companies/${ID}/hub$`), PLATFORM_SAAS_TABS.companyHub, ['companyId']],
  [new RegExp(`^/platform-saas/companies/${ID}/profile$`), PLATFORM_SAAS_TABS.companyProfile, ['companyId']],
  [
    new RegExp(`^/platform-saas/companies/${ID}/configuration$`),
    PLATFORM_SAAS_TABS.companyConfiguration,
    ['companyId'],
  ],
  [new RegExp(`^/platform-saas/companies/${ID}/merchants$`), PLATFORM_SAAS_TABS.companyMerchants, ['companyId']],
  [
    new RegExp(`^/platform-saas/companies/${ID}/merchants/${ID}/hub$`),
    PLATFORM_SAAS_TABS.merchantHub,
    ['companyId', 'merchantId'],
  ],
  [
    new RegExp(`^/platform-saas/companies/${ID}/merchants/${ID}/profile$`),
    PLATFORM_SAAS_TABS.merchantProfile,
    ['companyId', 'merchantId'],
  ],
  [
    new RegExp(`^/platform-saas/companies/${ID}/merchants/${ID}/terminals$`),
    PLATFORM_SAAS_TABS.merchantTerminals,
    ['companyId', 'merchantId'],
  ],
  [new RegExp(`^/platform-saas/merchants/${ID}/users$`), PLATFORM_SAAS_TABS.merchantUsers, ['merchantId']],
  [
    new RegExp(`^/platform-saas/merchants/${ID}/users/${ID}$`),
    PLATFORM_SAAS_TABS.merchantUserDetail,
    ['merchantId', 'userId'],
  ],
];

/** Pestaña e ids de una URL de Platform SaaS, o null si la URL no es una de ellas. */
export function matchPlatformSaasRoute(path: string): PlatformSaasRouteMatch | null {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  for (const [pattern, tab, names] of PATTERNS) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const params: PlatformSaasRouteParams = {};
    names.forEach((name, index) => {
      params[name] = Number(match[index + 1]);
    });
    return { tab, params };
  }
  return null;
}

/** Pestañas de estas URLs: MerchantFrame no las conoce por el menú del backend. */
export const PLATFORM_SAAS_CONTEXT_TABS: ReadonlySet<string> = new Set(Object.values(PLATFORM_SAAS_TABS));

export function isPlatformSaasContextTab(tab: string): boolean {
  return PLATFORM_SAAS_CONTEXT_TABS.has(tab);
}

export const platformSaasPaths = {
  companiesHub: () => '/platform-saas/companies/hub',
  companiesDirectory: () => '/platform-saas/companies/directory',
  companyHub: (companyId: number) => `/platform-saas/companies/${companyId}/hub`,
  companyProfile: (companyId: number) => `/platform-saas/companies/${companyId}/profile`,
  companyConfiguration: (companyId: number) => `/platform-saas/companies/${companyId}/configuration`,
  companyMerchants: (companyId: number) => `/platform-saas/companies/${companyId}/merchants`,
  merchantHub: (companyId: number, merchantId: number) =>
    `/platform-saas/companies/${companyId}/merchants/${merchantId}/hub`,
  merchantProfile: (companyId: number, merchantId: number) =>
    `/platform-saas/companies/${companyId}/merchants/${merchantId}/profile`,
  merchantTerminals: (companyId: number, merchantId: number) =>
    `/platform-saas/companies/${companyId}/merchants/${merchantId}/terminals`,
  merchantUsers: (merchantId: number) => `/platform-saas/merchants/${merchantId}/users`,
  merchantUserDetail: (merchantId: number, userId: number) =>
    `/platform-saas/merchants/${merchantId}/users/${userId}`,
} as const;

/** URL canónica de una pestaña sin parámetros (para el menú lateral). */
export function pathForPlatformSaasTab(tab: string): string | null {
  if (tab === PLATFORM_SAAS_TABS.companiesHub) return platformSaasPaths.companiesHub();
  if (tab === PLATFORM_SAAS_TABS.companiesDirectory) return platformSaasPaths.companiesDirectory();
  return null;
}
