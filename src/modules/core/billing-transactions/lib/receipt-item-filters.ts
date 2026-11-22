// Filter state of the INVOICE LINE ITEMS header and its mapping to GET /receipt-items.
import type {
  ReceiptItemOption,
  ReceiptItemStatusFilter,
  ReceiptItemsQuery,
} from '../types/receipt-items';

export interface ReceiptItemFilters {
  /** Free text over description / SKU. */
  search: string;
  /** Encoded item selector value (see itemOptionValue), '' = all items. */
  item: string;
  /** Receipt id as string, '' = all receipts. */
  receiptId: string;
  status: ReceiptItemStatusFilter;
}

export const DEFAULT_RECEIPT_ITEM_FILTERS: ReceiptItemFilters = {
  search: '',
  item: '',
  receiptId: '',
  status: 'true',
};

const SKU_PREFIX = 'sku:';
const NAME_PREFIX = 'name:';

/** Selector value of an item: by SKU when it has one, by exact name otherwise. */
export function itemOptionValue(option: Pick<ReceiptItemOption, 'name' | 'sku'>): string {
  return option.sku ? `${SKU_PREFIX}${option.sku}` : `${NAME_PREFIX}${option.name}`;
}

export function itemOptionLabel(option: ReceiptItemOption): string {
  const sku = option.sku ? ` · ${option.sku}` : '';
  return `${option.name}${sku} (${option.line_count})`;
}

/** Query params for GET /receipt-items from the header filters. */
export function filtersToQuery(filters: ReceiptItemFilters): ReceiptItemsQuery {
  const query: ReceiptItemsQuery = { isActive: filters.status };
  const search = filters.search.trim();
  if (search) query.search = search;
  if (filters.receiptId) query.receiptId = Number(filters.receiptId);
  if (filters.item.startsWith(SKU_PREFIX)) {
    query.sku = filters.item.slice(SKU_PREFIX.length);
  } else if (filters.item.startsWith(NAME_PREFIX)) {
    query.itemName = filters.item.slice(NAME_PREFIX.length);
  }
  return query;
}

export function hasActiveFilters(filters: ReceiptItemFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.item !== '' ||
    filters.receiptId !== '' ||
    filters.status !== DEFAULT_RECEIPT_ITEM_FILTERS.status
  );
}
