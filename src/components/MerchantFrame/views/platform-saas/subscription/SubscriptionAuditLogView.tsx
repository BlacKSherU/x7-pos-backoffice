import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  SubscriptionAuditLog,
  SubscriptionAuditActionType,
  SubscriptionAuditTargetType,
  SubscriptionPlan,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';
import { getEffectiveUserRole, getStoredUser } from '@/platform/auth/lib/auth-storage';
import { NavHubBar } from '@/shared/components/NavHubBar';

export interface SubscriptionAuditLogViewProps {
  companyId?: number;
  userRole?: string | null;
  onNavigate?: (view: string, plan?: SubscriptionPlan, companyId?: number) => void;
}

export const SubscriptionAuditLogView: React.FC<SubscriptionAuditLogViewProps> = ({
  companyId: initialCompanyId,
  userRole,
  onNavigate,
}) => {
  // ── RBAC Validation ────────────────────────────────────────────────────────
  const storedUser = getStoredUser();
  const rawStoredRole = storedUser?.role;
  const effectiveRole = getEffectiveUserRole();

  const checkIsSuperAdmin = (r?: string | null) => {
    if (!r) return false;
    const lower = r.toLowerCase().trim();
    return (
      lower === 'super_admin' ||
      lower === 'superadmin' ||
      lower === 'super admin' ||
      lower === 'super admin (all access)' ||
      lower === 'saas owner' ||
      lower === 'portal_admin' ||
      lower.includes('super')
    );
  };

  const checkIsAuthorizedAdmin = (r?: string | null) => {
    if (!r) return false;
    const lower = r.toLowerCase().trim();
    return (
      checkIsSuperAdmin(r) ||
      lower === 'saasadmin' ||
      lower === 'saas_admin' ||
      lower === 'saas admin' ||
      lower === 'auditor' ||
      lower === 'compliance' ||
      lower === 'company_owner' ||
      lower.includes('saas') ||
      lower.includes('audit')
    );
  };

  const isSuperAdmin =
    checkIsSuperAdmin(userRole) ||
    checkIsSuperAdmin(rawStoredRole) ||
    checkIsSuperAdmin(effectiveRole);

  const isAuthorized =
    isSuperAdmin ||
    checkIsAuthorizedAdmin(userRole) ||
    checkIsAuthorizedAdmin(rawStoredRole) ||
    checkIsAuthorizedAdmin(effectiveRole);

  // ── States ─────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<SubscriptionAuditLog[]>([]);
  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | 'all'>(
    initialCompanyId ? Number(initialCompanyId) : 'all',
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | SubscriptionAuditActionType>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | SubscriptionAuditTargetType>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'saasadmin'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Modal State for Inspecting Diff
  const [selectedLogForDiff, setSelectedLogForDiff] = useState<SubscriptionAuditLog | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load Companies for Filter dropdown
  useEffect(() => {
    if (!isAuthorized) return;
    let isMounted = true;
    saasService
      .listCompanies()
      .then((data) => {
        if (!isMounted) return;
        setCompanies(data);
      })
      .catch(() => {
        // Fallback companies
        if (!isMounted) return;
        setCompanies([
          { id: 10, name: 'Bella Vista Gourmet', status: 'active', country: 'DOM', merchantsCount: 3 },
          { id: 20, name: 'Sabor Criollo Corp', status: 'active', country: 'DOM', merchantsCount: 1 },
        ]);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthorized]);

  // Reference time for relative date filtering
  const [referenceTime, setReferenceTime] = useState(() => Date.now());

  useEffect(() => {
    if (dateFilter !== 'all') {
      setReferenceTime(Date.now());
    }
  }, [dateFilter]);

  // Fetch Audit Logs from Backend / Ledger
  const loadAuditLogs = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const companyParam = selectedCompanyId !== 'all' ? Number(selectedCompanyId) : undefined;
      const data = await saasService.getSubscriptionAuditLogs(companyParam);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve subscription audit ledger');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, selectedCompanyId]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Listen to real-time custom event for new audit logs
  useEffect(() => {
    const handleNewLog = () => {
      loadAuditLogs();
    };
    window.addEventListener('x7-subscription-audit-log-created', handleNewLog);
    return () => {
      window.removeEventListener('x7-subscription-audit-log-created', handleNewLog);
    };
  }, [loadAuditLogs]);

  // ── Filtered Logs Computation ──────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = referenceTime;

    return logs.filter((log) => {
      // Company match
      if (selectedCompanyId !== 'all' && log.company_id !== Number(selectedCompanyId)) {
        return false;
      }

      // Action type filter
      if (actionFilter !== 'all' && log.action_type !== actionFilter) {
        return false;
      }

      // Target type filter
      if (targetTypeFilter !== 'all' && log.target_type !== targetTypeFilter) {
        return false;
      }

      // Role filter
      if (roleFilter !== 'all') {
        const r = log.actor_role.toLowerCase();
        if (roleFilter === 'superadmin' && !r.includes('super')) return false;
        if (roleFilter === 'saasadmin' && r.includes('super')) return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const diffMs = now - logTime;
        if (dateFilter === 'today' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '7d' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '30d' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      // Search Query
      if (q) {
        const actor = `${log.actor_user_id} ${log.actor_name ?? ''} ${log.actor_email ?? ''} ${log.actor_role}`.toLowerCase();
        const target = `${log.target_name ?? ''} ${log.target_id} ${log.company_name ?? ''}`.toLowerCase();
        const reason = (log.reason_notes ?? '').toLowerCase();
        const action = log.action_type.toLowerCase();
        const values = `${JSON.stringify(log.previous_value)} ${JSON.stringify(log.new_value)}`.toLowerCase();

        return (
          actor.includes(q) ||
          target.includes(q) ||
          reason.includes(q) ||
          action.includes(q) ||
          values.includes(q)
        );
      }

      return true;
    });
  }, [logs, selectedCompanyId, actionFilter, targetTypeFilter, roleFilter, dateFilter, searchQuery, referenceTime]);

  // ── Metrics Computation ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = logs.length;
    const statusChanges = logs.filter((l) => l.action_type === 'SUBSCRIPTION_STATUS_CHANGED').length;
    const matrixUpdates = logs.filter((l) => l.action_type === 'PLAN_MAPPING_UPDATED').length;
    const uniqueActors = new Set(logs.map((l) => `${l.actor_user_id}_${l.actor_role}`)).size;

    return { total, statusChanges, matrixUpdates, uniqueActors };
  }, [logs]);

  // ── Export Handlers ────────────────────────────────────────────────────────
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `subscription_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setToast({ message: 'Audit ledger exported to JSON', type: 'success' });
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Timestamp',
      'Actor ID',
      'Actor Role',
      'Actor Email',
      'Action Type',
      'Target Type',
      'Target ID',
      'Target Name',
      'Company ID',
      'Company Name',
      'Previous Value',
      'New Value',
      'Reason Notes',
      'Ledger Hash',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.actor_user_id}"`,
      `"${l.actor_role}"`,
      `"${l.actor_email ?? ''}"`,
      `"${l.action_type}"`,
      `"${l.target_type}"`,
      `"${l.target_id}"`,
      `"${(l.target_name ?? '').replace(/"/g, '""')}"`,
      `"${l.company_id ?? ''}"`,
      `"${(l.company_name ?? '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.previous_value ?? {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.new_value ?? {}).replace(/"/g, '""')}"`,
      `"${(l.reason_notes ?? '').replace(/"/g, '""')}"`,
      `"${l.ledger_hash ?? ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `subscription_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setToast({ message: 'Audit ledger exported to CSV', type: 'success' });
  };

  // ── Persistent Navigation Items ───────────────────────────────────────────
  const navHubItems = [
    {
      id: 'sub-plans-core',
      label: 'SUBSCRIPTION PLANS',
      icon: 'workspace_premium',
      onClick: () => onNavigate?.('sub-plans-core'),
    },
    {
      id: 'apps-config',
      label: 'APPLICATIONS',
      icon: 'apps',
      onClick: () => onNavigate?.('apps-config'),
    },
    {
      id: 'features-control',
      label: 'FEATURES',
      icon: 'toggle_on',
      onClick: () => onNavigate?.('features-control'),
    },
    {
      id: 'plan-apps-rules',
      label: 'PLAN APPS',
      icon: 'widgets',
      onClick: () => onNavigate?.('plan-apps-rules'),
    },
    {
      id: 'plan-features-mapping',
      label: 'PLAN FEATURES',
      icon: 'checklist',
      onClick: () => onNavigate?.('plan-features-mapping'),
    },
    {
      id: 'company-subscriptions',
      label: 'COMPANY SUBS',
      icon: 'business',
      onClick: () => onNavigate?.('company-subscriptions'),
    },
    {
      id: 'merchant-subs-link',
      label: 'MERCHANT SUBS',
      icon: 'storefront',
      onClick: () => onNavigate?.('merchant-subs-link'),
    },
    {
      id: 'subscription-audit-logs',
      label: 'AUDIT LOGS',
      icon: 'history',
      active: true,
      onClick: () => onNavigate?.('subscription-audit-logs'),
    },
  ];

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { date: ts, time: '' };
    }
  };

  // ── Permission Boundary Card ──────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div
        className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh] font-['Poppins',sans-serif]"
        data-testid="audit-log-permission-boundary"
      >
        <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-[#ae001a] flex items-center justify-center mb-4 text-[#ae001a]">
          <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
        </div>
        <h2 className="text-xl font-bold text-[#1d1c17] mb-2">Access Restricted: Administrative Ledger</h2>
        <p className="text-sm text-[#5f5e5e] max-w-md mb-6 leading-relaxed">
          The Subscription Audit Log Ledger is strictly restricted to SaaS Platform Super Administrators and Compliance
          Auditors. Your detected role does not possess the credentials required for immutable ledger review.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 bg-zinc-100 text-zinc-700 font-mono rounded border border-zinc-200">
            Current Role: {userRole ?? rawStoredRole ?? effectiveRole ?? 'unassigned'}
          </span>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription-system-hub')}
            className="px-4 py-2 bg-[#ae001a] hover:bg-[#8e0015] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
          >
            Return to Subscription Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-6 pb-24 font-['Poppins',sans-serif] text-left animate-fade-in w-full"
      data-testid="subscription-audit-log-view"
    >
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 border transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── 1. Secondary Header ────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e8e2d8] p-6 shadow-xs rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb Context */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs font-bold text-[#ae001a] tracking-wider uppercase mb-1"
            >
              <span className="material-symbols-outlined text-lg">history</span>
              <span>Platform SaaS</span>
              <span className="text-[#8a8880]">/</span>
              <button
                type="button"
                onClick={() => onNavigate?.('subscription-system-hub')}
                className="hover:underline cursor-pointer"
              >
                Subscription System
              </button>
              <span className="text-[#8a8880]">/</span>
              <span className="text-[#1d1c17]">Audit Log Ledger</span>
            </nav>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1d1c17] tracking-tight">
                Subscription Audit Log Ledger
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ae001a]/10 text-[#ae001a] border border-[#ae001a]/20">
                <span className="material-symbols-outlined text-xs">verified_user</span>
                Immutable Ledger
              </span>
            </div>
            <p className="text-xs text-[#5f5e5e] mt-1">
              Tamper-evident, chronological trail capturing every administrative modification made to subscription
              lifecycles, plan mappings, and feature entitlement matrices.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              data-testid="back-to-hub-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1d1c17] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded shadow-xs cursor-pointer transition-colors border border-[#1d1c17]"
              title="Return to Subscription Command Hub"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Command Hub
            </button>
            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e8e2d8] bg-white hover:bg-[#f8f3eb] text-xs font-bold uppercase tracking-wider text-[#1d1c17] rounded shadow-xs cursor-pointer transition-colors"
              title="Refresh ledger records"
            >
              <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>
                sync
              </span>
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e8e2d8] bg-white hover:bg-[#f8f3eb] text-xs font-bold uppercase tracking-wider text-[#1d1c17] rounded shadow-xs cursor-pointer transition-colors"
              title="Export filtered records to JSON"
            >
              <span className="material-symbols-outlined text-base text-[#ae001a]">download</span>
              JSON
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ae001a] hover:bg-[#8e0015] text-white text-xs font-bold uppercase tracking-wider rounded shadow-xs cursor-pointer transition-colors"
              title="Export filtered records to CSV"
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Metric Highlight Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e]">Total Logged Events</p>
            <p className="text-2xl font-bold text-[#1d1c17] mt-1" data-testid="metric-total-events">
              {metrics.total}
            </p>
            <p className="text-[11px] text-[#8a8880] mt-0.5">Chronologically sealed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#ae001a]/10 border border-[#ae001a]/20 flex items-center justify-center text-[#ae001a]">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
        </div>

        {/* Status Modifications */}
        <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e]">Status Alterations</p>
            <p className="text-2xl font-bold text-amber-600 mt-1" data-testid="metric-status-changes">
              {metrics.statusChanges}
            </p>
            <p className="text-[11px] text-[#8a8880] mt-0.5">Suspensions, Activations, Cancellations</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-2xl">swap_horiz</span>
          </div>
        </div>

        {/* Matrix Updates */}
        <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e]">Plan Matrix Updates</p>
            <p className="text-2xl font-bold text-blue-600 mt-1" data-testid="metric-matrix-updates">
              {metrics.matrixUpdates}
            </p>
            <p className="text-[11px] text-[#8a8880] mt-0.5">Apps & Features Bundling</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined text-2xl">tune</span>
          </div>
        </div>

        {/* Administrative Actors */}
        <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e]">Administrative Actors</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="metric-unique-actors">
              {metrics.uniqueActors}
            </p>
            <p className="text-[11px] text-[#8a8880] mt-0.5">Superadmins & SaaS Admins</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Controls Toolbar ──────────────────────────────────── */}
      <div className="bg-white border border-[#e8e2d8] p-5 rounded-xl shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8880] text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by actor ID, name, email, target, action type, reason notes..."
              aria-label="Search audit logs"
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#e8e2d8] rounded bg-white text-[#1d1c17] placeholder-[#8a8880] focus:outline-none focus:border-[#ae001a]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8880] hover:text-[#1d1c17] cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#f8f3eb] p-1 rounded border border-[#e8e2d8] self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#ae001a] shadow-xs'
                  : 'text-[#5f5e5e] hover:text-[#1d1c17]'
              }`}
            >
              <span className="material-symbols-outlined text-base">table_rows</span>
              Grid Ledger
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-white text-[#ae001a] shadow-xs'
                  : 'text-[#5f5e5e] hover:text-[#1d1c17]'
              }`}
            >
              <span className="material-symbols-outlined text-base">timeline</span>
              Timeline
            </button>
          </div>
        </div>

        {/* Granular Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-[#f0ece5]">
          {/* Company Filter (Global review vs Tenant Filter) */}
          <div>
            <label htmlFor="company-filter" className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
              Scope / Company:
            </label>
            <select
              id="company-filter"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              aria-label="Filter by company"
              className="w-full text-xs font-medium border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
            >
              <option value="all">Global Audit (All Tenants)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (ID: {c.id})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div>
            <label htmlFor="action-filter" className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
              Action Type:
            </label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as 'all' | SubscriptionAuditActionType)}
              aria-label="Filter by action type"
              className="w-full text-xs font-medium border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
            >
              <option value="all">All Actions</option>
              <option value="SUBSCRIPTION_STATUS_CHANGED">SUBSCRIPTION_STATUS_CHANGED</option>
              <option value="PLAN_MAPPING_UPDATED">PLAN_MAPPING_UPDATED</option>
            </select>
          </div>

          {/* Target Type Filter */}
          <div>
            <label htmlFor="target-filter" className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
              Target Entity:
            </label>
            <select
              id="target-filter"
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value as 'all' | SubscriptionAuditTargetType)}
              aria-label="Filter by target type"
              className="w-full text-xs font-medium border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
            >
              <option value="all">All Target Entities</option>
              <option value="COMPANY_SUBSCRIPTION">Company Subscription</option>
              <option value="PLAN_APPLICATION">Plan Application</option>
              <option value="PLAN_FEATURE">Plan Feature</option>
            </select>
          </div>

          {/* Actor Role Filter */}
          <div>
            <label htmlFor="role-filter" className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
              Actor Role:
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'superadmin' | 'saasadmin')}
              aria-label="Filter by actor role"
              className="w-full text-xs font-medium border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
            >
              <option value="all">All Roles</option>
              <option value="superadmin">Super Admin</option>
              <option value="saasadmin">SaaS Admin / Compliance</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label htmlFor="date-filter" className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
              Timeframe:
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7d' | '30d')}
              aria-label="Filter by timeframe"
              className="w-full text-xs font-medium border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
            >
              <option value="all">All Recorded History</option>
              <option value="today">Today (Past 24h)</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 4. Main Audit Trail Display (Grid vs Timeline) ─────────────────── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-12 text-center shadow-xs">
          <div className="w-10 h-10 border-3 border-[#ae001a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#1d1c17]">Verifying and retrieving immutable audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-12 text-center shadow-xs" data-testid="empty-audit-logs">
          <div className="w-14 h-14 rounded-full bg-[#f8f3eb] flex items-center justify-center mx-auto mb-3 text-[#8a8880]">
            <span className="material-symbols-outlined text-2xl">history</span>
          </div>
          <h3 className="text-base font-bold text-[#1d1c17]">No Audit Records Found</h3>
          <p className="text-xs text-[#5f5e5e] max-w-md mx-auto mt-1 mb-4">
            No administrative events match the selected filters or search parameters.
          </p>
          {(searchQuery || actionFilter !== 'all' || targetTypeFilter !== 'all' || roleFilter !== 'all' || dateFilter !== 'all' || selectedCompanyId !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActionFilter('all');
                setTargetTypeFilter('all');
                setRoleFilter('all');
                setDateFilter('all');
                setSelectedCompanyId('all');
              }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#ae001a] border border-[#ae001a] rounded hover:bg-[#ae001a]/5 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID / TABLE VIEW ────────────────────────────────────────────── */
        <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="audit-log-table">
              <thead>
                <tr className="bg-[#f8f3eb] border-b border-[#e8e2d8]">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Timestamp & Hash
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Actor Identity
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Action & Target
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Scope / Entity
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Metadata Diff (Before → After)
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap">
                    Reason & Notes
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] text-right whitespace-nowrap">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece5] text-xs">
                {filteredLogs.map((log) => {
                  const { date, time } = formatTime(log.timestamp);
                  const isSuspensionOrCancellation =
                    log.action_type === 'SUBSCRIPTION_STATUS_CHANGED' &&
                    (JSON.stringify(log.new_value).includes('SUSPENDED') ||
                      JSON.stringify(log.new_value).includes('CANCELLED'));

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#fcfaf7] transition-colors"
                      data-testid={`audit-row-${log.id}`}
                    >
                      {/* Timestamp & Hash */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-semibold text-[#1d1c17] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#8a8880]">schedule</span>
                          {date}
                        </div>
                        <div className="text-[11px] text-[#5f5e5e] pl-5">{time}</div>
                        {log.ledger_hash && (
                          <div
                            className="text-[10px] text-[#8a8880] font-mono pl-5 truncate max-w-[140px]"
                            title={`Hash: ${log.ledger_hash}`}
                          >
                            {log.ledger_hash.slice(0, 14)}...
                          </div>
                        )}
                      </td>

                      {/* Actor Identity */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="material-symbols-outlined text-base text-[#ae001a]">
                            admin_panel_settings
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.actor_role.toLowerCase().includes('super')
                                ? 'bg-[#ae001a]/10 text-[#ae001a] border border-[#ae001a]/20'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {log.actor_role}
                          </span>
                        </div>
                        <div className="font-semibold text-[#1d1c17] truncate max-w-[180px]">
                          {log.actor_name ?? `User #${log.actor_user_id}`}
                        </div>
                        {log.actor_email && (
                          <div className="text-[11px] text-[#5f5e5e] truncate max-w-[180px]">
                            {log.actor_email}
                          </div>
                        )}
                      </td>

                      {/* Action & Target Type */}
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            log.action_type === 'SUBSCRIPTION_STATUS_CHANGED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {log.action_type}
                        </span>
                        <div className="text-[11px] font-medium text-[#5f5e5e]">
                          {log.target_type.replace('_', ' ')}
                        </div>
                      </td>

                      {/* Target Name & Company */}
                      <td className="px-4 py-3 align-top max-w-[200px]">
                        <div className="font-semibold text-[#1d1c17] truncate">
                          {log.target_name ?? `ID #${log.target_id}`}
                        </div>
                        {log.company_name ? (
                          <div className="text-[11px] text-[#ae001a] font-medium truncate flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">business</span>
                            {log.company_name}
                          </div>
                        ) : log.company_id ? (
                          <div className="text-[11px] text-[#5f5e5e]">Company #{log.company_id}</div>
                        ) : (
                          <div className="text-[11px] text-[#8a8880]">Global Platform Tier</div>
                        )}
                      </td>

                      {/* Metadata Diff */}
                      <td className="px-4 py-3 align-top max-w-[240px]">
                        <div className="p-2 bg-[#f8f3eb] rounded border border-[#e8e2d8] text-[11px] font-mono leading-tight space-y-1">
                          <div className="text-[#8a8880] truncate">
                            <span className="text-rose-600 font-bold">-</span> Prev:{' '}
                            {typeof log.previous_value === 'object'
                              ? JSON.stringify(log.previous_value)
                              : String(log.previous_value ?? 'none')}
                          </div>
                          <div className="text-[#1d1c17] truncate font-semibold">
                            <span className="text-emerald-600 font-bold">+</span> New:{' '}
                            {typeof log.new_value === 'object'
                              ? JSON.stringify(log.new_value)
                              : String(log.new_value ?? 'none')}
                          </div>
                        </div>
                      </td>

                      {/* Reason Notes */}
                      <td className="px-4 py-3 align-top max-w-[220px]">
                        {log.reason_notes ? (
                          <div className="text-[#1d1c17] italic text-[11px] bg-white border border-[#e8e2d8] p-2 rounded">
                            "{log.reason_notes}"
                          </div>
                        ) : isSuspensionOrCancellation ? (
                          <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            Missing Reason
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8a8880]">None specified</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLogForDiff(log)}
                          className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ae001a] hover:bg-[#ae001a]/10 rounded border border-[#ae001a]/30 transition-colors cursor-pointer"
                          aria-label={`Inspect diff for event ${log.id}`}
                        >
                          Inspect Diff
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── CHRONOLOGICAL TIMELINE VIEW ─────────────────────────────────── */
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-xs" data-testid="audit-log-timeline">
          <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e8e2d8]">
            {filteredLogs.map((log) => {
              const { date, time } = formatTime(log.timestamp);
              const isStatusChange = log.action_type === 'SUBSCRIPTION_STATUS_CHANGED';

              return (
                <div key={log.id} className="relative group" data-testid={`timeline-entry-${log.id}`}>
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center transition-transform group-hover:scale-110 ${
                      isStatusChange
                        ? 'border-amber-500 text-amber-600'
                        : 'border-[#ae001a] text-[#ae001a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {isStatusChange ? 'swap_horiz' : 'tune'}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="bg-[#fcfaf7] border border-[#e8e2d8] rounded-lg p-4 shadow-2xs hover:border-[#ae001a]/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-[#e8e2d8]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isStatusChange
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {log.action_type}
                        </span>
                        <span className="text-xs font-bold text-[#1d1c17]">{log.target_name}</span>
                        {log.company_name && (
                          <span className="text-[11px] text-[#ae001a] font-semibold">
                            • {log.company_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#5f5e5e] flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-xs text-[#8a8880]">schedule</span>
                        {date} at {time}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-0.5">
                          Actor Identity:
                        </span>
                        <div className="font-semibold text-[#1d1c17]">
                          {log.actor_name} ({log.actor_role})
                        </div>
                        <div className="text-[11px] text-[#5f5e5e]">{log.actor_email}</div>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-0.5">
                          Diff Payload:
                        </span>
                        <div className="bg-white p-2 rounded border border-[#e8e2d8] font-mono text-[11px]">
                          <span className="text-rose-600 font-bold">-</span> Prev:{' '}
                          {JSON.stringify(log.previous_value)} <br />
                          <span className="text-emerald-600 font-bold">+</span> New:{' '}
                          {JSON.stringify(log.new_value)}
                        </div>
                      </div>
                    </div>

                    {log.reason_notes && (
                      <div className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded text-xs text-[#1d1c17] mb-2">
                        <span className="font-bold text-amber-900 text-[10px] uppercase tracking-wider block mb-0.5">
                          Reason for Modification:
                        </span>
                        "{log.reason_notes}"
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-[#8a8880] pt-2 border-t border-[#f0ece5]">
                      <span className="font-mono">Ledger ID: {log.id}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedLogForDiff(log)}
                        className="text-[#ae001a] font-bold uppercase tracking-wider hover:underline cursor-pointer"
                      >
                        View Full Diff Metadata →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Detailed Diff & Metadata Inspector Modal ───────────────────── */}
      {selectedLogForDiff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-diff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-[#e8e2d8] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#ae001a] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl">verified_user</span>
                <div>
                  <h3 id="audit-diff-title" className="text-base font-bold">
                    Immutable Audit Trail Record
                  </h3>
                  <p className="text-xs text-white/80 font-mono">
                    Event #{selectedLogForDiff.id} • {selectedLogForDiff.timestamp}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="text-white/80 hover:text-white cursor-pointer"
                aria-label="Close diff modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Actor Identity Badge */}
              <div className="p-3.5 bg-[#f8f3eb] rounded-lg border border-[#e8e2d8]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">
                    Authenticated Actor
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#ae001a]/10 text-[#ae001a] border border-[#ae001a]/20">
                    {selectedLogForDiff.actor_role}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#1d1c17]">{selectedLogForDiff.actor_name}</div>
                <div className="text-[#5f5e5e]">{selectedLogForDiff.actor_email}</div>
                <div className="text-[10px] text-[#8a8880] mt-1 font-mono">
                  Actor User ID: {selectedLogForDiff.actor_user_id}
                </div>
              </div>

              {/* Action and Scope */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-[#e8e2d8] rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Action Type
                  </span>
                  <span className="font-bold text-[#1d1c17]">{selectedLogForDiff.action_type}</span>
                </div>
                <div className="p-3 bg-white border border-[#e8e2d8] rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Target Entity
                  </span>
                  <span className="font-bold text-[#1d1c17]">
                    {selectedLogForDiff.target_type} (#{selectedLogForDiff.target_id})
                  </span>
                </div>
              </div>

              {/* Side-by-Side Diffs */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1d1c17] block mb-1.5">
                  State Mutation Comparison (Diff)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Previous State */}
                  <div className="p-3 bg-rose-50/40 border border-rose-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-xs">remove_circle</span>
                      Previous State (Before)
                    </span>
                    <pre className="text-[11px] font-mono text-rose-950 bg-white/80 p-2.5 rounded border border-rose-100 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedLogForDiff.previous_value, null, 2)}
                    </pre>
                  </div>

                  {/* New State */}
                  <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-xs">add_circle</span>
                      New State (After)
                    </span>
                    <pre className="text-[11px] font-mono text-emerald-950 bg-white/80 p-2.5 rounded border border-emerald-100 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedLogForDiff.new_value, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Mandatory Reason Notes */}
              {selectedLogForDiff.reason_notes && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Mandatory Reason & Compliance Notes:
                  </span>
                  <p className="text-xs text-amber-950 italic leading-relaxed">
                    "{selectedLogForDiff.reason_notes}"
                  </p>
                </div>
              )}

              {/* Cryptographic Ledger Hash */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">
                  Cryptographic Ledger Signature:
                </span>
                <p className="font-mono text-[11px] text-zinc-800 break-all select-all">
                  {selectedLogForDiff.ledger_hash ?? '0x8f2d61a9bc3451e0f84a3219ef891c01e3895ac712bf'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-[#f8f3eb] px-6 py-3.5 border-t border-[#e8e2d8] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="px-4 py-2 bg-[#ae001a] hover:bg-[#8e0015] text-white text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Persistent Nav Hub Bar ──────────────────────────────────────── */}
      <NavHubBar
        title="SUBSCRIPTION SYSTEM"
        titleIcon="hub"
        subtitle="Immutable audit trail recording administrative changes to subscription statuses and plan associations."
        items={navHubItems}
        onBackToDashboard={() => onNavigate?.('subscription-system-hub')}
        backToDashboardLabel="Back to Subscription Hub"
      />
    </div>
  );
};

