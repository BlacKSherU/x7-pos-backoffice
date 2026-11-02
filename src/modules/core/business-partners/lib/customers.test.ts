import { describe, it, expect } from 'vitest';
import {
  resolveOrdersCount,
  resolveLoyaltyCount,
  formatRut,
  hasRutAssigned,
  getUniqueCities,
  getUniqueStates,
  getUniqueCountries,
  matchesCustomer,
  filterCustomers,
} from './customers';
import type { Customer } from '../types/customer';

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 101,
    name: 'Acme Corporation',
    rut: '76.123.456-7',
    email: 'billing@acme.com',
    phone: '+56 9 1234 5678',
    address: 'Av. Providencia 1234, Of. 501',
    city: 'Santiago',
    state: 'Región Metropolitana',
    country: 'Chile',
    orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
    loyaltyCustomers: [{ id: 10 }],
  },
  {
    id: 102,
    name: 'Beta Global Logistics',
    rut: null,
    email: 'contact@betaglobal.com',
    phone: '+1 555 987 6543',
    address: '100 Ocean Blvd',
    city: 'Miami',
    state: 'Florida',
    country: 'United States',
    orders: 5,
    loyaltyCustomers: 0,
  },
  {
    id: 103,
    name: 'Carlos Mendez',
    rut: '15.987.654-K',
    email: 'carlos.mendez@gmail.com',
    phone: '+56 9 8765 4321',
    address: 'Calle San Martin 450',
    city: 'Viña del Mar',
    state: 'Valparaíso',
    country: 'Chile',
    ordersCount: 1,
    loyaltyCustomersCount: 2,
  },
  {
    id: 104,
    name: 'Delta Ventures',
    rut: '',
    email: 'delta@holdings.cl',
    phone: null,
    address: null,
    city: null,
    state: null,
    country: null,
  },
];

describe('customers helper functions', () => {
  describe('resolveOrdersCount', () => {
    it('resolves count from orders array length', () => {
      expect(resolveOrdersCount(MOCK_CUSTOMERS[0])).toBe(3);
    });

    it('resolves count from numeric orders field', () => {
      expect(resolveOrdersCount(MOCK_CUSTOMERS[1])).toBe(5);
    });

    it('resolves count from ordersCount field', () => {
      expect(resolveOrdersCount(MOCK_CUSTOMERS[2])).toBe(1);
    });

    it('returns 0 when orders information is absent', () => {
      expect(resolveOrdersCount(MOCK_CUSTOMERS[3])).toBe(0);
    });
  });

  describe('resolveLoyaltyCount', () => {
    it('resolves count from loyaltyCustomers array length', () => {
      expect(resolveLoyaltyCount(MOCK_CUSTOMERS[0])).toBe(1);
    });

    it('resolves count from numeric loyaltyCustomers field', () => {
      expect(resolveLoyaltyCount(MOCK_CUSTOMERS[1])).toBe(0);
    });

    it('resolves count from loyaltyCustomersCount field', () => {
      expect(resolveLoyaltyCount(MOCK_CUSTOMERS[2])).toBe(2);
    });

    it('returns 0 when loyalty information is absent', () => {
      expect(resolveLoyaltyCount(MOCK_CUSTOMERS[3])).toBe(0);
    });
  });

  describe('formatRut & hasRutAssigned', () => {
    it('formats assigned RUT correctly', () => {
      expect(formatRut('76.123.456-7')).toBe('76.123.456-7');
      expect(hasRutAssigned('76.123.456-7')).toBe(true);
    });

    it('renders "No RUT assigned" for null, undefined, or empty RUT', () => {
      expect(formatRut(null)).toBe('No RUT assigned');
      expect(formatRut(undefined)).toBe('No RUT assigned');
      expect(formatRut('')).toBe('No RUT assigned');
      expect(formatRut('   ')).toBe('No RUT assigned');
      expect(hasRutAssigned(null)).toBe(false);
      expect(hasRutAssigned('')).toBe(false);
    });
  });

  describe('getUniqueCities, getUniqueStates, getUniqueCountries', () => {
    it('extracts unique cities alphabetically', () => {
      expect(getUniqueCities(MOCK_CUSTOMERS)).toEqual([
        'Miami',
        'Santiago',
        'Viña del Mar',
      ]);
    });

    it('extracts unique states alphabetically', () => {
      expect(getUniqueStates(MOCK_CUSTOMERS)).toEqual([
        'Florida',
        'Región Metropolitana',
        'Valparaíso',
      ]);
    });

    it('extracts unique countries alphabetically', () => {
      expect(getUniqueCountries(MOCK_CUSTOMERS)).toEqual([
        'Chile',
        'United States',
      ]);
    });
  });

  describe('matchesCustomer & filterCustomers', () => {
    it('matches customer by name (case-insensitive substring)', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { searchQuery: 'acme' });
      expect(results.map((c) => c.id)).toEqual([101]);
    });

    it('matches customer by email vector (case-insensitive substring)', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { searchQuery: 'contact@betaglobal' });
      expect(results.map((c) => c.id)).toEqual([102]);
    });

    it('matches customer by tax identification RUT code', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { searchQuery: '15.987' });
      expect(results.map((c) => c.id)).toEqual([103]);
    });

    it('filters by city dropdown', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { city: 'Santiago' });
      expect(results.map((c) => c.id)).toEqual([101]);
    });

    it('filters by state dropdown', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { state: 'Florida' });
      expect(results.map((c) => c.id)).toEqual([102]);
    });

    it('filters by country dropdown', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { country: 'Chile' });
      expect(results.map((c) => c.id)).toEqual([101, 103]);
    });

    it('combines alphanumeric search and regional filters', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, {
        searchQuery: 'mendez',
        country: 'Chile',
      });
      expect(results.map((c) => c.id)).toEqual([103]);
    });

    it('returns empty array when search query matches no records', () => {
      const results = filterCustomers(MOCK_CUSTOMERS, { searchQuery: 'nonexistent-query-xyz' });
      expect(results).toEqual([]);
    });

    it('evaluates matchesCustomer directly and excludes soft-deleted records', () => {
      expect(matchesCustomer(MOCK_CUSTOMERS[0], { searchQuery: 'acme' })).toBe(true);
      expect(matchesCustomer({ ...MOCK_CUSTOMERS[0], status: 'deleted' }, { searchQuery: 'acme' })).toBe(false);
    });
  });
});

