import { describe, expect, it } from 'vitest';
import {
  ALL,
  cityOptions,
  filterCompanyRows,
  filterMerchantRows,
  filterTerminalRows,
  filterUserRows,
  queryValue,
} from '@/modules/platform-saas/companies/lib/saas-directory-filters';
import type { SaasCompanyListItem, SaasCompanyMerchant } from '@/modules/platform-saas/companies/types/saas-company';
import type { SaasMerchantUser } from '@/modules/platform-saas/merchants/types/saas-merchant';

const company = (over: Partial<SaasCompanyListItem>): SaasCompanyListItem => ({
  id: 1,
  name: 'Acme',
  legalName: 'Acme Holdings LLC',
  taxId: '12-3456789',
  email: 'hq@acme.com',
  phone: null,
  city: 'Miami',
  country: 'US',
  status: 'active',
  baseCurrency: 'USD',
  subscriptionTier: { planId: 2, planName: 'Pro' },
  merchantCount: 3,
  ...over,
});

const merchant = (over: Partial<SaasCompanyMerchant>): SaasCompanyMerchant => ({
  id: 1,
  name: 'Downtown',
  branchCode: 'MCH-0001',
  email: 'downtown@acme.com',
  phone: null,
  address: null,
  city: 'Miami',
  state: 'FL',
  country: 'US',
  timezone: 'America/New_York',
  status: 'active',
  companyId: 1,
  ...over,
});

describe('filterCompanyRows', () => {
  const rows = [
    company({ id: 1 }),
    company({ id: 2, name: 'Beta Foods', legalName: null, taxId: '99-0000000', status: 'suspended', subscriptionTier: null }),
  ];

  it('searches name, legal name, tax id and email', () => {
    expect(filterCompanyRows(rows, { search: 'holdings', status: ALL, tier: ALL }).map((r) => r.id)).toEqual([1]);
    expect(filterCompanyRows(rows, { search: '99-0000', status: ALL, tier: ALL }).map((r) => r.id)).toEqual([2]);
  });

  it('filters by status and tier', () => {
    expect(filterCompanyRows(rows, { search: '', status: 'suspended', tier: ALL }).map((r) => r.id)).toEqual([2]);
    expect(filterCompanyRows(rows, { search: '', status: ALL, tier: '2' }).map((r) => r.id)).toEqual([1]);
  });
});

describe('filterMerchantRows', () => {
  const rows = [merchant({ id: 1 }), merchant({ id: 2, name: 'Airport', branchCode: 'MCH-0002', city: 'Orlando', status: 'inactive' })];

  it('filters by branch name or code, city (case-insensitive) and status', () => {
    expect(filterMerchantRows(rows, { search: 'mch-0002', city: ALL, status: ALL }).map((r) => r.id)).toEqual([2]);
    expect(filterMerchantRows(rows, { search: '', city: 'miami', status: ALL }).map((r) => r.id)).toEqual([1]);
    expect(filterMerchantRows(rows, { search: '', city: ALL, status: 'inactive' }).map((r) => r.id)).toEqual([2]);
  });

  it('builds distinct sorted city options', () => {
    expect(cityOptions(rows, ['miami', 'Tampa'])).toEqual(['miami', 'Orlando', 'Tampa']);
  });
});

describe('filterUserRows', () => {
  const users: SaasMerchantUser[] = [
    { id: 1, username: 'ana', email: 'ana@acme.com', role: 'merchant_admin', status: 'active', merchantId: 1, createdAt: null },
    { id: 2, username: 'bob', email: 'bob@acme.com', role: 'merchant_user', status: 'inactive', merchantId: 1, createdAt: null },
  ];

  it('filters by text and status', () => {
    expect(filterUserRows(users, { search: 'bob', status: ALL }).map((u) => u.id)).toEqual([2]);
    expect(filterUserRows(users, { search: '', status: 'active' }).map((u) => u.id)).toEqual([1]);
  });
});

describe('filterTerminalRows', () => {
  const base = { provider: 'stripe', paymentConfigName: null, cashDrawerId: null, merchantId: 2, createdAt: '', updatedAt: '' };
  const terminals = [
    { ...base, id: 1, name: 'Front Counter', model: 'Bolt P3', deviceIdentifier: 'HSN-001', status: 'active' },
    { ...base, id: 2, name: 'Patio Reader', model: null, deviceIdentifier: 'tmr_abc', status: 'inactive' },
  ];
  it('matches name, model and device id, and the status', () => {
    expect(filterTerminalRows(terminals, { search: 'bolt', status: ALL }).map((t) => t.id)).toEqual([1]);
    expect(filterTerminalRows(terminals, { search: 'TMR_', status: ALL }).map((t) => t.id)).toEqual([2]);
    expect(filterTerminalRows(terminals, { search: 'patio', status: 'active' })).toEqual([]);
    expect(filterTerminalRows(terminals, { search: '', status: 'inactive' }).map((t) => t.id)).toEqual([2]);
  });
});

describe('queryValue', () => {
  it('drops empty and "all" values', () => {
    expect(queryValue(ALL)).toBeUndefined();
    expect(queryValue('  ')).toBeUndefined();
    expect(queryValue(' active ')).toBe('active');
  });
});
