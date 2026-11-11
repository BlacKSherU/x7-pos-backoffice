import React, { useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  CompanySubscriptionDetail,
  ProvisionedApplication,
  SubscriptionPlan,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';
import { getEffectiveUserRole, getStoredUser } from '@/platform/auth/lib/auth-storage';
import { NavHubBar } from '@/shared/components/NavHubBar';

export interface SubscriptionApplicationsInquiryViewProps {
  companyId?: number;
  userRole?: string | null;
  onNavigate?: (view: string, plan?: SubscriptionPlan, companyId?: number) => void;
}

export const SubscriptionApplicationsInquiryView: React.FC<
  SubscriptionApplicationsInquiryViewProps
> = ({ companyId: initialCompanyId, userRole, onNavigate }) => {
  // ── RBAC Validation (Restricted to saasadmin, company_owner, superadmin) ──
  const storedUser = getStoredUser();
  const rawStoredRole = storedUser?.role;
  const effectiveRole = getEffectiveUserRole();

  const checkIsAuthorizedAdmin = (r?: string | null) => {
    if (!r) return false;
    const lower = r.toLowerCase().trim();
    return (
      lower === 'saasadmin' ||
      lower === 'saas_admin' ||
      lower === 'saas admin' ||
      lower === 'company_owner' ||
      lower === 'company owner' ||
      lower === 'saas owner' ||
      lower === 'portal_admin' ||
      lower === 'merchant_admin' ||
      lower === 'super_admin' ||
      lower === 'superadmin' ||
      lower === 'super admin' ||
      lower === 'super admin (all access)' ||
      lower.includes('saas') ||
      lower.includes('owner') ||
      lower.includes('super')
    );
  };

  const isAuthorized =
    checkIsAuthorizedAdmin(userRole) ||
    checkIsAuthorizedAdmin(rawStoredRole) ||
    checkIsAuthorizedAdmin(effectiveRole);

  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    initialCompanyId ?? null,
  );
  const [subscription, setSubscription] = useState<CompanySubscriptionDetail | null>(null);
  const [applications, setApplications] = useState<ProvisionedApplication[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // RBAC Permission Boundary Redirect (AC 1)
  useEffect(() => {
    if (!isAuthorized) {
      const redirectTimer = setTimeout(() => {
        onNavigate?.('subscription-system-hub');
      }, 4000);
      return () => clearTimeout(redirectTimer);
    }
  }, [isAuthorized, onNavigate]);

  // Initial load: fetch companies list
  useEffect(() => {
    if (!isAuthorized) return;
    let isMounted = true;
    setIsLoading(true);

    saasService
      .listCompanies()
      .then((list) => {
        if (!isMounted) return;
        setCompanies(list);
        setSelectedCompanyId((prev) => prev ?? (list.length > 0 ? list[0].id : null));
      })
      .catch(() => {
        saasService
          .listCompanySubscriptions()
          .then((subs) => {
            if (!isMounted) return;
            const mapped: CompanyRegistryItem[] = subs.map((s) => ({
              id: s.company.id,
              name: s.company.name,
              status: 'active',
              country: 'DOM',
              merchantsCount: 1,
            }));
            setCompanies(mapped);
            setSelectedCompanyId((prev) => prev ?? (mapped.length > 0 ? mapped[0].id : null));
          })
          .catch((err) => {
            if (!isMounted) return;
            setError(err instanceof Error ? err.message : 'Failed to load tenant companies');
          });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthorized]);

  // Sync prop changes
  useEffect(() => {
    if (initialCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId]);

  // Load tenant subscription & provisioned applications
  const loadTenantApplications = async (targetCompanyId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      let subDetail: CompanySubscriptionDetail | null = null;
      try {
        subDetail = await saasService.getCompanySubscription(targetCompanyId);
        setSubscription(subDetail);
      } catch {
        subDetail = null;
        setSubscription(null);
      }

      const apps = await saasService.getCompanySubscriptionApplications(
        targetCompanyId,
        subDetail?.plan?.id,
      );
      setApplications(apps);
    } catch (err) {
      console.error('Failed to load subscription applications:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve provisioned software applications for tenant.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized || !selectedCompanyId) return;
    loadTenantApplications(selectedCompanyId);
  }, [isAuthorized, selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  // Dynamic categories extracted from application entries
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort();
  }, [applications]);

  // Filtered applications list
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const isAppActive = Boolean(
        app.isProvisioned ||
          app.status?.toLowerCase() === 'active' ||
          app.status?.toLowerCase() === 'provisioned',
      );

      // Status filter
      if (statusFilter === 'active' && !isAppActive) return false;
      if (statusFilter === 'inactive' && isAppActive) return false;

      // Category filter
      if (selectedCategory !== 'all' && app.category !== selectedCategory) {
        return false;
      }

      // Keyword search (name, code, category, description)
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = app.name.toLowerCase().includes(q);
        const matchCode = app.code.toLowerCase().includes(q);
        const matchCat = app.category?.toLowerCase().includes(q);
        const matchDesc = app.description?.toLowerCase().includes(q);
        return matchName || matchCode || matchCat || matchDesc;
      }
      return true;
    });
  }, [applications, searchQuery, selectedCategory, statusFilter]);

  const activeAppsCount = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.isProvisioned ||
          a.status?.toLowerCase() === 'active' ||
          a.status?.toLowerCase() === 'provisioned',
      ).length,
    [applications],
  );

  const inactiveAppsCount = applications.length - activeAppsCount;

  // Format provisioning date
  const formatProvisioningDate = (app: ProvisionedApplication) => {
    const rawDate =
      app.provisionedAt ||
      app.provisioned_at ||
      subscription?.startDate;
    if (!rawDate) return 'Standard Tier Entitlement';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(rawDate);
    }
  };

  // NavHub shortcuts
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
      id: 'company-subscriptions',
      label: 'COMPANY SUBS',
      icon: 'business',
      onClick: () => onNavigate?.('company-subscriptions'),
    },
    {
      id: 'subscription-applications-inquiry',
      label: 'COMPANY APPS',
      icon: 'developer_board',
      active: true,
      onClick: () => onNavigate?.('subscription-applications-inquiry'),
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
  ];

  // ── Unauthorized Permission Boundary ──────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div
        data-testid="permission-boundary-card"
        className="min-h-[70vh] flex items-center justify-center p-6 bg-[#f8f5ef] font-['Poppins']"
      >
        <div className="w-full max-w-lg bg-white border border-[#e8e2d8] rounded-xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 text-[#ae001a] rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-bold uppercase tracking-wide text-[#1d1c17] mb-2">
            Access Restricted
          </h2>
          <p className="text-xs uppercase tracking-widest text-[#ae001a] font-bold mb-4">
            SAASADMIN OR COMPANY OWNER PRIVILEGE REQUIRED
          </p>
          <p className="text-sm text-[#5f5e5e] mb-6 leading-relaxed">
            Subscription applications inquiry is strictly restricted to SaaS Administrators and
            authorized company owners. Your current account role (
            <strong>{userRole || rawStoredRole || effectiveRole || 'guest'}</strong>) does not have
            sufficient privileges to inspect tenant provisioning records.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              className="px-6 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-xs font-bold uppercase tracking-widest rounded transition-colors shadow-sm cursor-pointer"
            >
              Return to Subscription Hub
            </button>
          </div>
          <p className="text-[11px] text-[#8a8886] mt-4">
            Redirecting automatically to Subscription Command Hub…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] pb-32 font-['Poppins'] text-[#1d1c17]">
      {/* Primary Header & Breadcrumbs */}
      <div className="bg-[#222222] border-b border-white/10 text-white px-8 py-7 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 flex-wrap">
              <span>Platform SaaS</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <button
                type="button"
                onClick={() => onNavigate?.('subscription-system-hub')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Subscription Hub
              </button>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <button
                type="button"
                onClick={() => onNavigate?.('company-subscriptions')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Company Subscriptions
              </button>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="text-white">Applications Inquiry</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-3">
              <span className="material-symbols-outlined text-[#ae001a] text-3xl">
                developer_board
              </span>
              SUBSCRIPTION APPLICATIONS INQUIRY
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-2xl">
              Inspect all software modules and entitlement provisions unlocked for a specific tenant
              subscription to verify service delivery and troubleshoot tenant access.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <span className="px-3 py-1 bg-white/10 text-emerald-400 rounded text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 border border-white/10">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              SaaS Admin Mode
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.('company-subscriptions')}
              className="px-4 py-2 border border-white/20 hover:border-white/40 text-xs font-bold uppercase tracking-widest rounded text-white/90 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 hover:text-primary duration-200"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Company Subscriptions
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">report</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => selectedCompanyId && loadTenantApplications(selectedCompanyId)}
              className="underline font-bold hover:text-red-950 uppercase tracking-wider cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Master Tenant Company Selector Bar */}
        <div className="mb-8 bg-white border border-[#e8e2d8] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e8e2d8]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Select Target Tenant Company
              </span>
              <h2 className="text-base font-extrabold text-[#1d1c17] mt-0.5">
                {selectedCompany?.name || 'Loading Company…'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="target-company-select"
                className="text-xs font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap"
              >
                Tenant:
              </label>
              <select
                id="target-company-select"
                value={selectedCompanyId ?? ''}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                className="text-sm font-semibold border border-[#e8e2d8] rounded px-3 py-2 bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a] min-w-[240px]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (ID #{c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Tenant Info Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-1">
            <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-3.5 rounded-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#ae001a]/10 text-[#ae001a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">domain</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block">
                  Tenant Identity
                </span>
                <span className="text-xs font-extrabold text-[#1d1c17] truncate block">
                  {selectedCompany?.name || '—'}
                </span>
              </div>
            </div>

            <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-3.5 rounded-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">workspace_premium</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block">
                  Subscription Tier
                </span>
                <span className="text-xs font-extrabold text-emerald-800 truncate block">
                  {subscription?.plan?.name || 'Active Plan Tier'}
                </span>
              </div>
            </div>

            <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-3.5 rounded-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">apps</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block">
                  Active Provisioned Modules
                </span>
                <span className="text-xs font-extrabold text-blue-900 block">
                  {activeAppsCount} of {applications.length} Apps Active
                </span>
              </div>
            </div>

            <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-3.5 rounded-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">event_available</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] block">
                  Subscription Cycle
                </span>
                <span className="text-xs font-extrabold text-amber-900 block truncate">
                  {subscription?.billingCycle || 'Monthly'}
                  {subscription?.renewalDate ? ` • Renews ${subscription.renewalDate}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Structured Data Grid Card */}
        <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
          {/* Card Title & Filter Bar */}
          <div className="bg-[#222222] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-xl">developer_board</span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                  PROVISIONED SOFTWARE APPLICATIONS MATRIX
                </h3>
                <span className="text-[11px] text-white/60">
                  Showing {filteredApplications.length} of {applications.length} applications
                </span>
              </div>
            </div>

            {/* Quick Action Button to Return to Overview */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onNavigate?.('company-subscriptions', undefined, selectedCompanyId ?? undefined)
                }
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest rounded transition-colors flex items-center gap-1.5 cursor-pointer hover:text-primary duration-200"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                View Company Summary
              </button>
            </div>
          </div>

          {/* Interactive Filters Strip */}
          <div className="p-4 bg-[#fcfaf7] border-b border-[#e8e2d8] flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by application name, module code, or category…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a] rounded"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-category"
                className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] whitespace-nowrap"
              >
                Category:
              </label>
              <select
                id="filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs font-semibold border border-[#e8e2d8] bg-white text-[#1d1c17] px-3 py-2 rounded focus:outline-none focus:border-[#ae001a]"
              >
                <option value="all">All Categories ({applications.length})</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-white p-1 border border-[#e8e2d8] rounded">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#222222] text-white shadow-xs'
                    : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                }`}
              >
                All ({applications.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-[#5f5e5e] hover:text-emerald-700'
                }`}
              >
                Active ({activeAppsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-[#5f5e5e] hover:text-zinc-800'
                }`}
              >
                Inactive ({inactiveAppsCount})
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 border-3 border-[#ae001a] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5f5e5e]">
                Querying Provisioned Applications…
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredApplications.length === 0 && (
            <div className="py-16 px-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-[#e8e2d8]/40 text-[#5f5e5e] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">filter_alt_off</span>
              </div>
              <h4 className="text-sm font-bold text-[#1d1c17] uppercase tracking-wide">
                No Applications Match Your Criteria
              </h4>
              <p className="text-xs text-[#5f5e5e] mt-1 max-w-md mx-auto">
                No active or provisioned applications matched your keyword search or category
                parameters for this company subscription.
              </p>
              {(searchQuery || selectedCategory !== 'all' || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setStatusFilter('all');
                  }}
                  className="mt-4 px-4 py-1.5 border border-[#ae001a] text-[#ae001a] hover:bg-[#ae001a] hover:text-white text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {/* Structured Data Grid Table */}
          {!isLoading && filteredApplications.length > 0 && (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-left"
                data-testid="subscription-applications-table"
              >
                <thead>
                  <tr className="bg-[#ece8e0] border-b border-[#e8e2d8] text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    <th className="px-6 py-3.5">Software Application</th>
                    <th className="px-6 py-3.5">Module Code</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Entitlement Status</th>
                    <th className="px-6 py-3.5">Provisioning Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8] text-xs">
                  {filteredApplications.map((app) => {
                    const isAppActive = Boolean(
                      app.isProvisioned ||
                        app.status?.toLowerCase() === 'active' ||
                        app.status?.toLowerCase() === 'provisioned',
                    );

                    return (
                      <tr
                        key={app.id}
                        data-testid={`app-row-${app.id}`}
                        className={`transition-colors duration-150 hover:bg-[#fcfaf7] ${
                          isAppActive ? '' : 'bg-[#fafafa]/80'
                        }`}
                      >
                        {/* Application Identity */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-xs ${
                                isAppActive
                                  ? 'bg-white border-emerald-200 text-[#ae001a]'
                                  : 'bg-zinc-100 border-zinc-200 text-zinc-400'
                              }`}
                            >
                              <span className="material-symbols-outlined text-xl">
                                {app.icon || 'apps'}
                              </span>
                            </div>
                            <div>
                              <div className="font-bold text-[#1d1c17] uppercase tracking-tight text-sm">
                                {app.name}
                              </div>
                              {app.description && (
                                <p className="text-[11px] text-[#5f5e5e] max-w-sm line-clamp-1 mt-0.5">
                                  {app.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Module Code */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-[#f4eee4] border border-[#e8e2d8] text-[#1d1c17] font-semibold">
                            {app.code}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-[#5f5e5e] border border-zinc-200">
                            {app.category || 'Platform Module'}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4">
                          {isAppActive ? (
                            <span
                              data-testid="status-badge-active"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                check_circle
                              </span>
                              ACTIVE
                            </span>
                          ) : (
                            <span
                              data-testid="status-badge-inactive"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-300"
                            >
                              <span className="material-symbols-outlined text-[13px]">cancel</span>
                              INACTIVE
                            </span>
                          )}
                        </td>

                        {/* Provisioning Date */}
                        <td className="px-6 py-4 font-mono text-[11px] text-[#5f5e5e]">
                          {formatProvisioningDate(app)}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate?.(
                                'plan-features-mapping',
                                subscription?.plan
                                  ? ({
                                      ...subscription.plan,
                                      code: subscription.plan.name
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, '-'),
                                      status: 'active',
                                    } as SubscriptionPlan)
                                  : undefined,
                                selectedCompanyId ?? undefined,
                              )
                            }
                            className="text-[11px] font-bold uppercase tracking-wider text-[#ae001a] hover:text-[#930015] hover:underline cursor-pointer inline-flex items-center gap-1 hover:text-primary transition-colors duration-200"
                            title="Inspect Granular Features for this Application"
                          >
                            <span>Inspect Features</span>
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          {!isLoading && (
            <div className="px-6 py-3.5 bg-[#fcfaf7] border-t border-[#e8e2d8] flex items-center justify-between text-[11px] text-[#5f5e5e] font-semibold flex-wrap gap-2">
              <span>
                Tenant ID: #{selectedCompanyId} • {selectedCompany?.name}
              </span>
              <span>
                {activeAppsCount} active module{activeAppsCount === 1 ? '' : 's'} provisioned under{' '}
                <strong>{subscription?.plan?.name || 'Active Plan'}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Persistent Bottom Hub Navigation */}
      <NavHubBar items={navHubItems} />
    </div>
  );
};
