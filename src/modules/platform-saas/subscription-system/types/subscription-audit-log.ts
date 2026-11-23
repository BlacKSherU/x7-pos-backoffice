export type SubscriptionAuditActionType =
  | 'PLAN_MAPPING_UPDATED'
  | 'SUBSCRIPTION_STATUS_CHANGED';

export type SubscriptionAuditActorRole =
  | 'superadmin'
  | 'saasadmin'
  | 'super_admin'
  | 'saas_admin'
  | string;

export type SubscriptionAuditTargetType =
  | 'PLAN_APPLICATION'
  | 'PLAN_FEATURE'
  | 'COMPANY_SUBSCRIPTION';

export interface SubscriptionAuditLog {
  id: string | number;
  timestamp: string; // ISO 8601 string
  actor_user_id: string | number;
  actor_role: SubscriptionAuditActorRole;
  actor_name?: string;
  actor_email?: string;
  action_type: SubscriptionAuditActionType;
  target_type: SubscriptionAuditTargetType;
  target_id: string | number;
  target_name?: string;
  company_id?: number | null;
  company_name?: string;
  previous_value: Record<string, unknown> | string | null;
  new_value: Record<string, unknown> | string | null;
  reason_notes?: string | null;
  metadata?: Record<string, unknown>;
  ledger_hash?: string;
}

export interface CreateSubscriptionAuditLogDto {
  timestamp?: string;
  actor_user_id?: string | number;
  actor_role?: SubscriptionAuditActorRole;
  actor_name?: string;
  actor_email?: string;
  action_type: SubscriptionAuditActionType;
  target_type: SubscriptionAuditTargetType;
  target_id: string | number;
  target_name?: string;
  company_id?: number | null;
  company_name?: string;
  previous_value: Record<string, unknown> | string | null;
  new_value: Record<string, unknown> | string | null;
  reason_notes?: string | null;
  metadata?: Record<string, unknown>;
}

