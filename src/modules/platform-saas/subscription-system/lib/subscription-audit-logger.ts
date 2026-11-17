import type {
  SubscriptionAuditLog,
  CreateSubscriptionAuditLogDto,
  SubscriptionAuditActorRole,
} from '../types/subscription-audit-log';
import { getStoredUser, getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';

export const SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY = 'x7_subscription_audit_logs';

// Initial baseline seed logs for audit trail inspection
export const SEED_SUBSCRIPTION_AUDIT_LOGS: SubscriptionAuditLog[] = [
  {
    id: 'log_sub_1092',
    timestamp: '2026-11-13T14:45:00.000Z',
    actor_user_id: 1,
    actor_name: 'Rafael Cordero (SuperAdmin)',
    actor_email: 'superadmin@x7pos.com',
    actor_role: 'superadmin',
    action_type: 'PLAN_MAPPING_UPDATED',
    target_type: 'PLAN_APPLICATION',
    target_id: 103,
    target_name: 'Delivery Fleet Tracking',
    company_id: null,
    company_name: undefined,
    previous_value: {
      linked: false,
      plan_id: 2,
      plan_name: 'Professional',
      application_id: 103,
      application_name: 'Delivery Fleet Tracking',
    },
    new_value: {
      linked: true,
      plan_id: 2,
      plan_name: 'Professional',
      application_id: 103,
      application_name: 'Delivery Fleet Tracking',
    },
    reason_notes: 'Updated Professional plan bundle with Q4 fleet tracking capabilities.',
    metadata: {
      scope: 'global_catalog',
      session_ip: '192.168.1.100',
    },
    ledger_hash: '0x8f2d61a9bc3451e0f84a3219ef891c01e3895ac712bf',
  },
  {
    id: 'log_sub_1091',
    timestamp: '2026-11-12T16:20:00.000Z',
    actor_user_id: 42,
    actor_name: 'Elena Morales (SaaS Compliance)',
    actor_email: 'compliance@x7platform.com',
    actor_role: 'saasadmin',
    action_type: 'SUBSCRIPTION_STATUS_CHANGED',
    target_type: 'COMPANY_SUBSCRIPTION',
    target_id: 101,
    target_name: 'Bella Vista Gourmet - Professional Tier',
    company_id: 10,
    company_name: 'Bella Vista Gourmet',
    previous_value: {
      status: 'ACTIVE',
      isExpired: false,
    },
    new_value: {
      status: 'SUSPENDED',
      immediate: true,
      isExpired: false,
    },
    reason_notes: 'Delinquent subscription invoice over 45 days. Tenant write access suspended as per SLA.',
    metadata: {
      invoices_overdue: 2,
      total_balance_due_usd: 398.0,
      termination_scope: 'immediate',
    },
    ledger_hash: '0x5c3e72b1aa9046f1e29811c0ab845d02fa741cb834de',
  },
  {
    id: 'log_sub_1090',
    timestamp: '2026-11-10T11:05:00.000Z',
    actor_user_id: 1,
    actor_name: 'Rafael Cordero (SuperAdmin)',
    actor_email: 'superadmin@x7pos.com',
    actor_role: 'superadmin',
    action_type: 'PLAN_MAPPING_UPDATED',
    target_type: 'PLAN_FEATURE',
    target_id: 205,
    target_name: 'Advanced Cost Analytics & Forecasting',
    company_id: null,
    company_name: undefined,
    previous_value: {
      linked: true,
      plan_id: 1,
      plan_name: 'Essential',
      feature_id: 205,
      limit_value: 5,
    },
    new_value: {
      linked: false,
      plan_id: 1,
      plan_name: 'Essential',
      feature_id: 205,
      limit_value: 0,
    },
    reason_notes: 'Repackaged advanced forecasting to Enterprise and Professional tiers only.',
    metadata: {
      rule_version: 'v2026.4',
    },
    ledger_hash: '0x4a1b99cf021387d89ab55e123fc76e1098bc52a198de',
  },
  {
    id: 'log_sub_1089',
    timestamp: '2026-11-08T09:30:00.000Z',
    actor_user_id: 42,
    actor_name: 'Elena Morales (SaaS Compliance)',
    actor_email: 'compliance@x7platform.com',
    actor_role: 'saasadmin',
    action_type: 'SUBSCRIPTION_STATUS_CHANGED',
    target_type: 'COMPANY_SUBSCRIPTION',
    target_id: 102,
    target_name: 'Sabor Criollo Corp - Essential Tier',
    company_id: 20,
    company_name: 'Sabor Criollo Corp',
    previous_value: {
      status: 'SUSPENDED',
    },
    new_value: {
      status: 'ACTIVE',
      renewalDate: '2026-12-08T00:00:00.000Z',
    },
    reason_notes: 'Wire transfer payment verified by accounting; tenant credentials and access unblocked.',
    metadata: {
      transaction_id: 'WT-2026-99182',
    },
    ledger_hash: '0x71e809cb554162da091c6674e10b45e20aa39021f4bc',
  },
];

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
    return inMemoryLogs ?? [...SEED_SUBSCRIPTION_AUDIT_LOGS];
  }

  try {
    const raw = localStorage.getItem(SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        SUBSCRIPTION_AUDIT_LOGS_STORAGE_KEY,
        JSON.stringify(SEED_SUBSCRIPTION_AUDIT_LOGS),
      );
      inMemoryLogs = [...SEED_SUBSCRIPTION_AUDIT_LOGS];
      return [...SEED_SUBSCRIPTION_AUDIT_LOGS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryLogs = parsed;
      return parsed;
    }
  } catch {
    // fallback
  }

  return inMemoryLogs ?? [...SEED_SUBSCRIPTION_AUDIT_LOGS];
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

