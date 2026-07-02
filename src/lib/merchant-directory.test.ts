import { describe, expect, it } from 'vitest';
import {
  ALL_REGIONS,
  buildRegionOptions,
  filterMerchants,
  formatMerchantLocation,
  formatStatusLabel,
  getStatusBadgeClass,
  merchantMatchesSearch,
} from './merchant-directory';
import type { CompanyMerchant } from '../types/merchant';

const merchants: CompanyMerchant[] = [
  {
    id: 1,
    name: 'Downtown Bistro',
    rut: '12-3456789',
    email: 'downtown@example.com',
    phone: '+15550001',
    city: 'Miami',
    state: 'California',
    country: 'USA',
    status: 'active',
    companyId: 10,
  },
  {
    id: 2,
    name: 'Uptown Cafe',
    rut: '98-7654321',
    email: 'uptown@example.com',
    phone: '+15550002',
    city: 'Austin',
    state: 'Texas',
    country: 'USA',
    status: 'inactive',
    companyId: 10,
  },
];

describe('merchant-directory helpers', () => {
  it('formats merchant location', () => {
    expect(formatMerchantLocation(merchants[0])).toBe(
      'Miami, California, USA',
    );
  });

  it('builds distinct region options', () => {
    expect(buildRegionOptions(merchants)).toEqual([
      ALL_REGIONS,
      'USA — California',
      'USA — Texas',
    ]);
  });

  it('matches fuzzy search tokens by merchant name', () => {
    expect(merchantMatchesSearch(merchants[0], 'down town')).toBe(true);
    expect(merchantMatchesSearch(merchants[0], 'uptown')).toBe(false);
  });

  it('combines search and region filters', () => {
    const filtered = filterMerchants(merchants, 'cafe', 'USA — Texas');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Uptown Cafe');
  });

  it('returns status badge classes and labels', () => {
    expect(getStatusBadgeClass('active')).toContain('emerald');
    expect(getStatusBadgeClass('suspended')).toContain('amber');
    expect(formatStatusLabel('inactive')).toBe('Inactive');
  });
});
