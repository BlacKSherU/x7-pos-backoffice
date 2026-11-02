import type { Customer } from '../types/customer';

export interface CustomerFilterCriteria {
  searchQuery?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Resolves the connected orders count from either an array or pre-aggregated count.
 */
export function resolveOrdersCount(customer: Customer): number {
  if (Array.isArray(customer.orders)) {
    return customer.orders.length;
  }
  if (typeof customer.ordersCount === 'number') {
    return customer.ordersCount;
  }
  if (typeof customer.orders === 'number') {
    return customer.orders;
  }
  return 0;
}

/**
 * Resolves the connected loyalty customers count from either an array or pre-aggregated count.
 */
export function resolveLoyaltyCount(customer: Customer): number {
  if (Array.isArray(customer.loyaltyCustomers)) {
    return customer.loyaltyCustomers.length;
  }
  if (typeof customer.loyaltyCustomersCount === 'number') {
    return customer.loyaltyCustomersCount;
  }
  if (typeof customer.loyaltyCustomers === 'number') {
    return customer.loyaltyCustomers;
  }
  return 0;
}

/**
 * Formats the customer tax identification number.
 * Displays "No RUT assigned" as a placeholder when unassigned.
 */
export function formatRut(rut?: string | null): string {
  if (!rut || !rut.trim()) {
    return 'No RUT assigned';
  }
  return rut.trim();
}

/**
 * Checks whether the customer has a valid RUT assigned.
 */
export function hasRutAssigned(rut?: string | null): boolean {
  return Boolean(rut && rut.trim().length > 0);
}

/**
 * Extracts a deduplicated and sorted list of cities from the customers dataset.
 */
export function getUniqueCities(customers: Customer[]): string[] {
  const cities = new Set<string>();
  for (const c of customers) {
    const val = c.city?.trim();
    if (val) cities.add(val);
  }
  return Array.from(cities).sort((a, b) => a.localeCompare(b));
}

/**
 * Extracts a deduplicated and sorted list of states/regions from the customers dataset.
 */
export function getUniqueStates(customers: Customer[]): string[] {
  const states = new Set<string>();
  for (const c of customers) {
    const val = c.state?.trim();
    if (val) states.add(val);
  }
  return Array.from(states).sort((a, b) => a.localeCompare(b));
}

/**
 * Extracts a deduplicated and sorted list of countries from the customers dataset.
 */
export function getUniqueCountries(customers: Customer[]): string[] {
  const countries = new Set<string>();
  for (const c of customers) {
    const val = c.country?.trim();
    if (val) countries.add(val);
  }
  return Array.from(countries).sort((a, b) => a.localeCompare(b));
}

/**
 * Evaluates whether a customer record satisfies search and geographic filter criteria.
 * Search criteria searches across:
 * - Customer Name (name)
 * - Email Contact Vector (email)
 * - Tax Identification Code (rut)
 */
export function matchesCustomer(
  customer: Customer,
  criteria: CustomerFilterCriteria,
): boolean {
  // Exclude soft-deleted records from active lookups
  if (
    customer.status === 'deleted' ||
    Boolean(customer.deleted_at) ||
    Boolean(customer.deletedAt)
  ) {
    return false;
  }

  const { searchQuery, city, state, country } = criteria;

  // Alphanumeric search term check (case-insensitive substring match)
  if (searchQuery && searchQuery.trim() !== '') {
    const term = searchQuery.trim().toLowerCase();
    const nameMatch = customer.name?.toLowerCase().includes(term) ?? false;
    const emailMatch = customer.email?.toLowerCase().includes(term) ?? false;
    const rutMatch = customer.rut?.toLowerCase().includes(term) ?? false;

    if (!nameMatch && !emailMatch && !rutMatch) {
      return false;
    }
  }

  // Geographic filter: City
  if (city && city !== 'All' && city !== '') {
    if ((customer.city ?? '').toLowerCase() !== city.toLowerCase()) {
      return false;
    }
  }

  // Geographic filter: State
  if (state && state !== 'All' && state !== '') {
    if ((customer.state ?? '').toLowerCase() !== state.toLowerCase()) {
      return false;
    }
  }

  // Geographic filter: Country
  if (country && country !== 'All' && country !== '') {
    if ((customer.country ?? '').toLowerCase() !== country.toLowerCase()) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of customers based on alphanumeric search and geographic criteria.
 */
export function filterCustomers(
  customers: Customer[],
  criteria: CustomerFilterCriteria,
): Customer[] {
  return customers.filter((customer) => matchesCustomer(customer, criteria));
}
