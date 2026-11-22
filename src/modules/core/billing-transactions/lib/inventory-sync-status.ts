import type {
  InventoryDeductionStatus,
  InventorySyncRow,
  StockAvailabilityStatus,
} from '../types/inventory-sync';

export interface DeductionStatusMeta {
  label: string;
  icon: string;
  /** Clases del badge (fondo, texto y borde). */
  badgeClass: string;
  description: string;
}

/** Badges de estado de deducción: mismo color en el grid y en los contadores del header. */
export const DEDUCTION_STATUS_META: Record<InventoryDeductionStatus, DeductionStatusMeta> = {
  DEDUCTED: {
    label: 'Deducted',
    icon: 'check_circle',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Every recipe component has its OUT_FOR_SALE stock movement.',
  },
  PENDING: {
    label: 'Pending',
    icon: 'schedule',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'The order is not paid yet; stock is deducted when it is.',
  },
  INSUFFICIENT_STOCK: {
    label: 'Insufficient Stock',
    icon: 'warning',
    badgeClass: 'bg-[#ae001a] text-white border-[#8e0015]',
    description: 'Not enough stock at the sales location, or the sale left stock negative.',
  },
  FAILED: {
    label: 'Commit Failed',
    icon: 'error',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-400',
    description: 'The order is paid but the inventory deduction did not commit.',
  },
  NOT_TRACKED: {
    label: 'Not Tracked',
    icon: 'link_off',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    description: 'The line has no SKU, an unknown SKU, or a product without recipe.',
  },
};

/** Clases de resaltado de fila: stock insuficiente (rojo) y commit fallido (ámbar). */
export function rowHighlightClass(row: Pick<InventorySyncRow, 'insufficientStock' | 'commitFailed'>): string {
  if (row.commitFailed) return 'bg-amber-50 border-l-4 border-l-amber-500';
  if (row.insufficientStock) return 'bg-[#fff1f2] border-l-4 border-l-[#ae001a]';
  return 'border-l-4 border-l-transparent';
}

/** Stock item con el que filtrar el kardex desde el Quick Launch (el primero deducido o el de ventas). */
export function primaryStockItemId(row: InventorySyncRow): number | null {
  return (
    row.movements[0]?.stockItemId ??
    row.components.find((c) => c.stockItemId != null)?.stockItemId ??
    null
  );
}

/** Badges del resultado de "VALIDATE STOCK AVAILABILITY". */
export const AVAILABILITY_STATUS_META: Record<StockAvailabilityStatus, DeductionStatusMeta> = {
  AVAILABLE: {
    label: 'Available',
    icon: 'check_circle',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'There is enough stock and it stays above the minimum.',
  },
  LOW_STOCK_AFTER_SALE: {
    label: 'Low After Sale',
    icon: 'trending_down',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-400',
    description: 'There is enough stock, but it ends at or below the minimum.',
  },
  INSUFFICIENT_STOCK: {
    label: 'Insufficient Stock',
    icon: 'warning',
    badgeClass: 'bg-[#ae001a] text-white border-[#8e0015]',
    description: 'A component does not have enough stock at the location.',
  },
  NOT_TRACKED: {
    label: 'Not Tracked',
    icon: 'link_off',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    description: 'The line does not consume inventory.',
  },
  ALREADY_DEDUCTED: {
    label: 'Already Deducted',
    icon: 'task_alt',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'The receipt order already deducted its stock.',
  },
  LOCATION_NOT_CONFIGURED: {
    label: 'No Location',
    icon: 'location_off',
    badgeClass: 'bg-zinc-200 text-zinc-800 border-zinc-400',
    description: 'The merchant has no sales stock location configured.',
  },
};
