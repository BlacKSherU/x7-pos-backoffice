import { describe, expect, it } from 'vitest';
import {
  PLATFORM_SAAS_TABS,
  isPlatformSaasContextTab,
  matchPlatformSaasRoute,
  pathForPlatformSaasTab,
  platformSaasPaths,
} from '@/modules/platform-saas/companies/lib/platform-saas-routes';

describe('matchPlatformSaasRoute', () => {
  it.each([
    ['/platform-saas/companies/hub', PLATFORM_SAAS_TABS.companiesHub, {}],
    ['/platform-saas/companies/directory', PLATFORM_SAAS_TABS.companiesDirectory, {}],
    ['/platform-saas/companies/7/hub', PLATFORM_SAAS_TABS.companyHub, { companyId: 7 }],
    ['/platform-saas/companies/7/profile', PLATFORM_SAAS_TABS.companyProfile, { companyId: 7 }],
    ['/platform-saas/companies/7/configuration', PLATFORM_SAAS_TABS.companyConfiguration, { companyId: 7 }],
    ['/platform-saas/companies/7/merchants', PLATFORM_SAAS_TABS.companyMerchants, { companyId: 7 }],
    ['/platform-saas/companies/7/merchants/12/hub', PLATFORM_SAAS_TABS.merchantHub, { companyId: 7, merchantId: 12 }],
    ['/platform-saas/companies/7/merchants/12/profile', PLATFORM_SAAS_TABS.merchantProfile, { companyId: 7, merchantId: 12 }],
    ['/platform-saas/companies/7/merchants/12/terminals', PLATFORM_SAAS_TABS.merchantTerminals, { companyId: 7, merchantId: 12 }],
    ['/platform-saas/merchants/12/users', PLATFORM_SAAS_TABS.merchantUsers, { merchantId: 12 }],
    ['/platform-saas/merchants/12/users/40', PLATFORM_SAAS_TABS.merchantUserDetail, { merchantId: 12, userId: 40 }],
  ])('%s → %s', (path, tab, params) => {
    expect(matchPlatformSaasRoute(path)).toEqual({ tab, params });
  });

  it('ignores a trailing slash', () => {
    expect(matchPlatformSaasRoute('/platform-saas/companies/3/hub/')?.params).toEqual({ companyId: 3 });
  });

  it.each([
    '/platform-saas',
    '/platform-saas/companies/abc/hub',
    '/platform-saas/companies/0/hub',
    '/platform-saas/companies/3/unknown',
    '/dashboard/company-profile',
  ])('returns null for %s', (path) => {
    expect(matchPlatformSaasRoute(path)).toBeNull();
  });
});

describe('platformSaasPaths', () => {
  it('builds every URL so that it resolves back to its tab and ids', () => {
    expect(matchPlatformSaasRoute(platformSaasPaths.companyHub(5))?.tab).toBe(PLATFORM_SAAS_TABS.companyHub);
    expect(matchPlatformSaasRoute(platformSaasPaths.merchantHub(5, 9))?.params).toEqual({ companyId: 5, merchantId: 9 });
    expect(platformSaasPaths.merchantUserDetail(9, 2)).toBe('/platform-saas/merchants/9/users/2');
    expect(platformSaasPaths.companiesHub()).toBe('/platform-saas/companies/hub');
  });

  it('gives a canonical URL only to the tabs without ids', () => {
    expect(pathForPlatformSaasTab(PLATFORM_SAAS_TABS.companiesHub)).toBe('/platform-saas/companies/hub');
    expect(pathForPlatformSaasTab(PLATFORM_SAAS_TABS.companiesDirectory)).toBe('/platform-saas/companies/directory');
    expect(pathForPlatformSaasTab(PLATFORM_SAAS_TABS.companyHub)).toBeNull();
    expect(pathForPlatformSaasTab('companies-registry')).toBeNull();
  });

  it('knows which tabs carry the company context', () => {
    expect(isPlatformSaasContextTab('saas-company-profile')).toBe(true);
    expect(isPlatformSaasContextTab('company-profile')).toBe(false);
  });
});
