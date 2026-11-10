import type {
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from '@/modules/restaurant-operations/pos/types/payments';
import { getEffectiveUserRole, getStoredUser } from '@/platform/auth/lib/auth-storage';

export function formatMoney(amount: number, currency = 'USD'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/** Fecha y hora por separado, para tablas estrechas */
export function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '—', time: '' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: '—', time: '' };
  return { date: d.toLocaleDateString(), time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export const STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  voided: 'Voided',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  succeeded: 'Succeeded',
};

export const STATUS_BADGE_CLASSES: Record<PaymentTransactionStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-700',
  paid: 'bg-green-500/10 text-green-700',
  succeeded: 'bg-green-500/10 text-green-700',
  failed: 'bg-red-500/10 text-red-700',
  voided: 'bg-[#5f5e5e]/20 text-[#5f5e5e]',
  partially_refunded: 'bg-blue-500/10 text-blue-700',
  refunded: 'bg-purple-500/10 text-purple-700',
};

export const TYPE_LABELS: Record<PaymentTransactionType, string> = {
  sale: 'Sale',
  refund: 'Refund',
  void: 'Void',
};

export const TYPE_BADGE_CLASSES: Record<PaymentTransactionType, string> = {
  sale: 'bg-[#222222]/10 text-[#222222]',
  refund: 'bg-blue-500/10 text-blue-700',
  void: 'bg-orange-500/10 text-orange-700',
};

export function cardLabel(tx: Pick<PaymentTransaction, 'cardBrand' | 'cardLast4'>): string {
  if (!tx.cardLast4) return '—';
  const brand = tx.cardBrand ? tx.cardBrand.charAt(0).toUpperCase() + tx.cardBrand.slice(1) : 'Card';
  return `${brand} •••• ${tx.cardLast4}`;
}

/** Puede devolver o anular: Store Manager / Finance (igual que el backend). */
export function canReversePayments(): boolean {
  const role = getEffectiveUserRole();
  if (role === 'super_admin' || role === 'portal_admin' || role === 'merchant_admin') return true;
  const stored = getStoredUser() as { shiftRole?: string | null } | null;
  return role === 'merchant_user' && stored?.shiftRole === 'manager';
}

export const canRefund = (tx: PaymentTransaction) =>
  tx.type === 'sale' && (tx.status === 'paid' || tx.status === 'partially_refunded') && tx.refundableAmount > 0;

export const canVoid = (tx: PaymentTransaction) =>
  tx.type === 'sale' && tx.status === 'paid' && tx.refundedAmount === 0;

/** Clases de los controles de formulario (las mismas que el resto del backoffice). */
export const INPUT_CLASS =
  'bg-white text-[#1d1c17] px-3 py-2 border border-[#e8e2d8] rounded text-sm focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none w-full disabled:bg-[#f2ede5] disabled:text-[#5f5e5e]';
export const LABEL_CLASS = 'text-[11px] font-bold text-[#5f5e5e] uppercase';
export const PRIMARY_BUTTON =
  'px-5 py-2 bg-[#ae001a] hover:bg-[#930015] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap';
export const SECONDARY_BUTTON =
  'px-4 py-2 border border-[#e8e2d8] text-[#5f5e5e] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f2ede5] transition-colors disabled:opacity-40 whitespace-nowrap';
export const ICON_BUTTON = 'p-1 text-[#1d1c17] hover:text-[#ae001a] transition-colors disabled:opacity-30';
export const TH_CLASS = 'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]';
