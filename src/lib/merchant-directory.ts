import type { CompanyMerchant } from '../types/merchant';

export const ALL_REGIONS = 'All Regions';

export function formatMerchantLocation(merchant: CompanyMerchant): string {
  return [merchant.city, merchant.state, merchant.country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildRegionOptions(merchants: CompanyMerchant[]): string[] {
  const regions = new Set<string>();

  merchants.forEach((merchant) => {
    const country = merchant.country?.trim();
    const state = merchant.state?.trim();

    if (country && state) {
      regions.add(`${country} — ${state}`);
      return;
    }

    if (country) {
      regions.add(country);
    } else if (state) {
      regions.add(state);
    }
  });

  return [ALL_REGIONS, ...Array.from(regions).sort((a, b) => a.localeCompare(b))];
}

export function merchantMatchesRegion(
  merchant: CompanyMerchant,
  regionFilter: string,
): boolean {
  if (regionFilter === ALL_REGIONS) {
    return true;
  }

  const country = merchant.country?.trim() ?? '';
  const state = merchant.state?.trim() ?? '';
  const combined = country && state ? `${country} — ${state}` : country || state;

  return combined === regionFilter;
}

export function merchantMatchesSearch(
  merchant: CompanyMerchant,
  searchQuery: string,
): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const merchantName = merchant.name.toLowerCase();

  return tokens.every((token) => merchantName.includes(token));
}

export function filterMerchants(
  merchants: CompanyMerchant[],
  searchQuery: string,
  regionFilter: string,
): CompanyMerchant[] {
  return merchants.filter(
    (merchant) =>
      merchantMatchesSearch(merchant, searchQuery) &&
      merchantMatchesRegion(merchant, regionFilter),
  );
}

export function getStatusBadgeClass(status: CompanyMerchant['status']): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';
    case 'inactive':
      return 'bg-zinc-200 text-zinc-700';
    case 'suspended':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}

export function formatStatusLabel(status: CompanyMerchant['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
