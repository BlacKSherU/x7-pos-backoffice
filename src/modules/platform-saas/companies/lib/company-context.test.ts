import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPANY_CONTEXT_STORAGE_KEY,
  clearCompanyContext,
  getRememberedCompanyContext,
  rememberCompanyContext,
  pickCompanyContext,
} from '@/modules/platform-saas/companies/lib/company-context';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('company context', () => {
  it('remembers the last opened company in sessionStorage', () => {
    rememberCompanyContext(8);
    expect(sessionStorage.getItem(COMPANY_CONTEXT_STORAGE_KEY)).toBe('8');
    expect(getRememberedCompanyContext()).toBe(8);
    clearCompanyContext();
    expect(getRememberedCompanyContext()).toBeNull();
  });

  it('ignores invalid ids', () => {
    rememberCompanyContext(0);
    expect(getRememberedCompanyContext()).toBeNull();
    sessionStorage.setItem(COMPANY_CONTEXT_STORAGE_KEY, 'abc');
    expect(getRememberedCompanyContext()).toBeNull();
  });

  it('prefers the remembered company, then the own company, then the first active one', () => {
    const companies = [
      { id: 2, status: 'suspended' },
      { id: 3, status: 'active' },
      { id: 5, status: 'active' },
    ];
    expect(pickCompanyContext({ remembered: 5, ownCompanyId: 3, companies })).toBe(5);
    expect(pickCompanyContext({ remembered: null, ownCompanyId: 5, companies })).toBe(5);
    expect(pickCompanyContext({ remembered: null, ownCompanyId: null, companies })).toBe(3);
    // a remembered or own company outside the options is ignored
    expect(pickCompanyContext({ remembered: 99, ownCompanyId: 98, companies })).toBe(3);
    // without an active company: the first one; without companies: none
    expect(pickCompanyContext({ remembered: null, ownCompanyId: null, companies: [{ id: 2, status: 'inactive' }] })).toBe(2);
    expect(pickCompanyContext({ remembered: null, ownCompanyId: null, companies: [] })).toBeNull();
  });

  it('falls back to the remembered or own company when the list could not be loaded', () => {
    expect(pickCompanyContext({ remembered: 4, ownCompanyId: 6, companies: null })).toBe(4);
    expect(pickCompanyContext({ remembered: null, ownCompanyId: 6, companies: null })).toBe(6);
    expect(pickCompanyContext({ remembered: null, ownCompanyId: null, companies: null })).toBeNull();
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberCompanyContext(4)).not.toThrow();
    expect(getRememberedCompanyContext()).toBeNull();
    expect(pickCompanyContext({ remembered: getRememberedCompanyContext(), ownCompanyId: 6, companies: null })).toBe(6);
  });
});
