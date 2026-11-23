import type {
  SubscriptionAuditLog,
  CreateSubscriptionAuditLogDto,
  SubscriptionAuditActorRole,
} from '../types/subscription-audit-log';
import { getStoredUser, getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';

export const SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY = 'x7_subscription_audit_logs';

export const SEED_SUBSCRIPTION_AUDIT_LOGS: SubscriptionAuditLog[] = [];

let inMemoryLogs: SubscriptionAuditLog[] | null = null;

function computePseudoHash(entry: Partial<SubscriptionAuditLog>): string {
  const payload = `${entry.timestamp}_${entry.actor_user_id}_${entry.action_type}_${entry.target_id}_${JSON.stringify(entry.new_value)}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex}${Date.now().toString(16).slice(-8)}`;
}

export function getStoredAuditLogs(): SubscriptionAuditLog[] {
  if (typeof window === 'undefined') {
    return inMemoryLogs ?? [];
  }

  try {
    const raw = localStorage.getItem(SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryLogs = parsed;
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  return inMemoryLogs ?? [];
}

export function saveStoredAuditLogs(logs: SubscriptionAuditLog[]): void {
  inMemoryLogs = logs;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }
}

export function normalizeAuditActorRole(r?: string | null): SubscriptionAuditActorRole {
  if (!r) return 'superadmin';
  const lower = r.toLowerCase().trim();
  if (
    lower.includes('super') ||
    lower === 'super_admin' ||
    lower === 'superadmin' ||
    lower === 'saas owner' ||
    lower === 'portal_admin'
  ) {
    return 'superadmin';
  }
  if (lower.includes('saas') || lower.includes('compliance') || lower.includes('admin')) {
    return 'saasadmin';
  }
  return 'saasadmin';
}

/**
 * Appends an immutable audit log entry to the ledger.
 * Once created, an audit log is immutable and cannot be updated or erased.
 */
export async function recordSubscriptionAuditLog(
  dto: CreateSubscriptionAuditLogDto,
): Promise<SubscriptionAuditLog> {
  const storedUser = getStoredUser();
  const effectiveRole = getEffectiveUserRole();

  const timestamp = dto.timestamp ?? new Date().toISOString();
  const actor_user_id = dto.actor_user_id ?? storedUser?.id ?? 1;
  const actor_role = dto.actor_role ?? normalizeAuditActorRole(effectiveRole ?? storedUser?.role);
  const actor_name =
    dto.actor_name ??
    (storedUser ? `${storedUser.email.split('@')[0]} (${actor_role})` : `Admin User (${actor_role})`);
  const actor_email = dto.actor_email ?? storedUser?.email ?? 'admin@x7platform.com';

  const id = `audit_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ledger_hash = computePseudoHash({
    timestamp,
    actor_user_id,
    action_type: dto.action_type,
    target_id: dto.target_id,
    new_value: dto.new_value,
  });

  const entry: SubscriptionAuditLog = {
    id,
    timestamp,
    actor_user_id,
    actor_role,
    actor_name,
    actor_email,
    action_type: dto.action_type,
    target_type: dto.target_type,
    target_id: dto.target_id,
    target_name: dto.target_name,
    company_id: dto.company_id ?? null,
    company_name: dto.company_name,
    previous_value: dto.previous_value,
    new_value: dto.new_value,
    reason_notes: dto.reason_notes ?? null,
    metadata: dto.metadata ?? {},
    ledger_hash,
  };

  const existing = getStoredAuditLogs();
  // Immutable ledger: newest entries prepended or appended in order
  const updated = [entry, ...existing];
  saveStoredAuditLogs(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('x7-subscription-audit-log-created', {
        detail: { log: entry },
      }),
    );
  }

  return entry;
}

/**
 * Retrieves audit logs, optionally filtered by company ID.
 */
export async function fetchSubscriptionAuditLogsFromStorage(
  companyId?: number,
): Promise<SubscriptionAuditLog[]> {
  const logs = getStoredAuditLogs();
  if (companyId !== undefined && companyId !== null) {
    return logs.filter((log) => log.company_id === Number(companyId));
  }
  return [...logs];
}

export function resetAuditLogsStorageForTesting(): void {
  inMemoryLogs = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

