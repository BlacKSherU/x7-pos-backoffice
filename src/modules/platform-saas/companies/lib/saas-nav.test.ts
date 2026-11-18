import { describe, expect, it } from 'vitest';
import { companiesNav, companyNav, merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';

describe('saas nav destinations', () => {
  it('companies level points the company modules to the context company', () => {
    const items = companiesNav('companies-hub', 7);
    expect(items.map((i) => [i.label, i.to, i.active])).toEqual([
      ['Companies Hub', '/platform-saas/companies/hub', true],
      ['Companies Directory', '/platform-saas/companies/directory', false],
      ['Company Profile', '/platform-saas/companies/7/profile', false],
      ['Company Configuration', '/platform-saas/companies/7/configuration', false],
      ['Company Merchants', '/platform-saas/companies/7/merchants', false],
    ]);
    expect(companiesNav('companies-directory', null).filter((i) => i.to).map((i) => i.id)).toEqual([
      'companies-hub',
      'companies-directory',
    ]);
  });

  it('company and merchant levels list their sibling views', () => {
    expect(companyNav(3, 'company-profile').map((i) => [i.to, i.active])).toEqual([
      ['/platform-saas/companies/3/hub', false],
      ['/platform-saas/companies/3/profile', true],
      ['/platform-saas/companies/3/configuration', false],
      ['/platform-saas/companies/3/merchants', false],
    ]);
    expect(merchantNav(3, 8, 'merchant-terminals').map((i) => [i.label, i.to, i.active])).toEqual([
      ['Merchant Hub', '/platform-saas/companies/3/merchants/8/hub', false],
      ['Merchant Profile', '/platform-saas/companies/3/merchants/8/profile', false],
      ['Users', '/platform-saas/merchants/8/users', false],
      ['POS Terminals', '/platform-saas/companies/3/merchants/8/terminals', true],
    ]);
    // sin company conocida solo el directorio de usuarios tiene destino
    expect(merchantNav(null, 8).filter((i) => i.to).map((i) => i.id)).toEqual(['merchant-users']);
  });
});
