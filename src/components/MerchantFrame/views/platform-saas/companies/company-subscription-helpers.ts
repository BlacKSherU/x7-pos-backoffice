import type {
  SubscriptionLifecycleStatus,
} from '@/modules/platform-saas/subscription-system/types/subscription';

export function normalizeLifecycleStatus(
  status: SubscriptionLifecycleStatus | string | undefined,
): 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED' | 'INACTIVE' {
  if (!status) return 'INACTIVE';
  const upper = status.toUpperCase();
  if (upper === 'ACTIVE') return 'ACTIVE';
  if (upper === 'GRACE_PERIOD' || upper === 'GRACE') return 'GRACE_PERIOD';
  if (upper === 'SUSPENDED') return 'SUSPENDED';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
  return 'INACTIVE';
}

export function statusBadge(status: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED' | 'INACTIVE'): {
  label: string;
  className: string;
  icon: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
        icon: 'check_circle',
      };
    case 'GRACE_PERIOD':
      return {
        label: 'Grace Period',
        className: 'bg-amber-500/15 text-amber-900 border-amber-500/30 font-bold',
        icon: 'hourglass_top',
      };
    case 'SUSPENDED':
      return {
        label: 'Suspended',
        className: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
        icon: 'pause_circle',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
        icon: 'cancel',
      };
    default:
      return {
        label: 'Inactive',
        className: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20',
        icon: 'do_not_disturb_on',
      };
  }
}

export function paymentStatusBadge(status: string): { label: string; className: string } {
  const norm = status.toLowerCase();
  if (norm === 'paid' || norm === 'completed' || norm === 'settled') {
    return { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
  }
  if (norm === 'pending') {
    return { label: 'Pending', className: 'bg-amber-500/10 text-amber-800 border-amber-500/20' };
  }
  if (norm === 'failed') {
    return { label: 'Failed', className: 'bg-rose-500/10 text-rose-700 border-rose-500/20' };
  }
  if (norm === 'refunded') {
    return { label: 'Refunded', className: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
  }
  return { label: status, className: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' };
}

