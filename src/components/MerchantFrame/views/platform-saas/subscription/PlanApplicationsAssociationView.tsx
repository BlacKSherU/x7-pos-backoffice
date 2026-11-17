import React, { useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  Application,
  SubscriptionPlan,
  PlanApplication,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import { getEffectiveUserRole, getStoredUser } from '@/platform/auth/lib/auth-storage';
import { NavHubBar } from '@/shared/components/NavHubBar';

export interface PlanApplicationsAssociationViewProps {
  planId?: number | string;
  plan?: SubscriptionPlan;
  userRole?: string | null;
  onNavigate?: (view: string, plan?: SubscriptionPlan) => void;
}

export const PlanApplicationsAssociationView: React.FC<PlanApplicationsAssociationViewProps> = ({
  planId: initialPlanId,
  plan: initialPlan,
  userRole,
  onNavigate,
}) => {
  // ── RBAC Validation (Restricted Strictly to Superadmin) ──────────────────
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

  const isSuperAdmin =
    checkIsSuperAdmin(userRole) ||
    checkIsSuperAdmin(rawStoredRole) ||
    checkIsSuperAdmin(effectiveRole);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    initialPlanId ? Number(initialPlanId) : initialPlan?.id ?? null,
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [linkedAppIds, setLinkedAppIds] = useState<Set<number>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isAssociatingId, setIsAssociatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters and Display Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'matrix'>('grid');

  // Multi-plan mapping for matrix mode
  const [allPlanAssociations, setAllPlanAssociations] = useState<Record<number, Set<number>>>({});

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Permission Boundary Redirect
  useEffect(() => {
    if (!isSuperAdmin) {
      const redirectTimer = setTimeout(() => {
        onNavigate?.('subscription-system-hub');
      }, 3000);
      return () => clearTimeout(redirectTimer);
    }
  }, [isSuperAdmin, onNavigate]);

  // Fetch initial plans and applications
  useEffect(() => {
    if (!isSuperAdmin) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      saasService.getSubscriptionPlans().catch(() => []),
      saasService.getApplications().catch(() => []),
    ])
      .then(([plansData, appsData]) => {
        if (!isMounted) return;
        setPlans(plansData);
        setApplications(appsData);

        const currentPlanId =
          (initialPlanId ? Number(initialPlanId) : null) ??
          initialPlan?.id ??
          (plansData.length > 0 ? plansData[0].id : null);

        setSelectedPlanId(currentPlanId);

        if (currentPlanId) {
          loadPlanApplications(currentPlanId);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load plans and applications catalog.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, initialPlanId, initialPlan?.id]);

  // Sync prop changes
  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(Number(initialPlanId));
      loadPlanApplications(Number(initialPlanId));
    } else if (initialPlan?.id) {
      setSelectedPlanId(initialPlan.id);
      loadPlanApplications(initialPlan.id);
    }
  }, [initialPlanId, initialPlan]);

  // Load associated applications for a plan
  const loadPlanApplications = async (targetPlanId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      let linkedIds = new Set<number>();
      try {
        const apps = await saasService.getSubscriptionPlanApplications(targetPlanId);
        linkedIds = new Set(apps.map((a) => a.id));
      } catch {
        // Fallback to getPlanApplications
        const planApps = await saasService.getPlanApplications(targetPlanId);
        linkedIds = new Set(planApps.map((pa: PlanApplication) => pa.application.id));
      }

      setLinkedAppIds(linkedIds);
      setAllPlanAssociations((prev) => ({ ...prev, [targetPlanId]: linkedIds }));
    } catch (err) {
      console.error('Error fetching plan applications:', err);
      setError('Unable to load current plan associations.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    loadPlanApplications(planId);
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((app) => {
      if (app.category) set.add(app.category);
    });
    return Array.from(set).sort();
  }, [applications]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      const isLinked = linkedAppIds.has(app.id);

      if (statusFilter === 'linked' && !isLinked) return false;
      if (statusFilter === 'unlinked' && isLinked) return false;
      if (selectedCategory !== 'all' && app.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      if (q) {
        const matchName = app.name.toLowerCase().includes(q);
        const matchCategory = app.category?.toLowerCase().includes(q);
        const matchDesc = app.description?.toLowerCase().includes(q);
        const matchCode = app.code?.toLowerCase().includes(q);
        return matchName || matchCategory || matchDesc || matchCode;
      }
      return true;
    });
  }, [applications, linkedAppIds, searchQuery, selectedCategory, statusFilter]);

  // Link Application Handler
  const handleLinkApplication = async (appId: number, targetPlanId = selectedPlanId) => {
    if (!targetPlanId) return;
    setIsAssociatingId(appId);
    try {
      await saasService.associatePlanApplication(targetPlanId, appId);

      setLinkedAppIds((prev) => {
        const next = new Set(prev);
        next.add(appId);
        return next;
      });

      setAllPlanAssociations((prev) => {
        const current = new Set(prev[targetPlanId] || []);
        current.add(appId);
        return { ...prev, [targetPlanId]: current };
      });

      const appName = applications.find((a) => a.id === appId)?.name || 'Application';
      setToast({
        message: `Successfully associated "${appName}" to ${selectedPlan?.name || 'plan'}.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to link application:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to associate application to plan.',
        type: 'error',
      });
    } finally {
      setIsAssociatingId(null);
    }
  };

  // Unlink Application Handler
  const handleUnlinkApplication = async (appId: number, targetPlanId = selectedPlanId) => {
    if (!targetPlanId) return;
    setIsAssociatingId(appId);
    try {
      await saasService.disassociatePlanApplication(targetPlanId, appId);

      setLinkedAppIds((prev) => {
        const next = new Set(prev);
        next.delete(appId);
        return next;
      });

      setAllPlanAssociations((prev) => {
        const current = new Set(prev[targetPlanId] || []);
        current.delete(appId);
        return { ...prev, [targetPlanId]: current };
      });

      const appName = applications.find((a) => a.id === appId)?.name || 'Application';
      setToast({
        message: `Disassociated "${appName}" from ${selectedPlan?.name || 'plan'}.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to unlink application:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to disassociate application from plan.',
        type: 'error',
      });
    } finally {
      setIsAssociatingId(null);
    }
  };

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
      active: true,
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
      onClick: () => onNavigate?.('subscription-audit-logs'),
    },
  ];

  // ── Unauthorized Permission Boundary ──────────────────────────────────────
  if (!isSuperAdmin) {
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
            SUPERADMIN PRIVILEGE REQUIRED
          </p>
          <p className="text-sm text-[#5f5e5e] mb-6 leading-relaxed">
            Plan-to-applications association is strictly restricted to Super Administrators.
            Your current account role (<strong>{userRole || rawStoredRole || effectiveRole || 'guest'}</strong>) does not have
            sufficient privileges to access or modify pricing tier application mappings.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              className="px-6 py-2.5 bg-[#ae001a] hover:bg-[#930015] text-white text-xs font-bold uppercase tracking-widest rounded transition-colors shadow-sm"
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
      {/* Toast Alert */}
      {toast && (
        <div
          data-testid="association-toast"
          className={`fixed top-20 right-8 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            toast.type === 'success' ? 'bg-emerald-700' : 'bg-red-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Primary Header & Breadcrumbs */}
      <div className="bg-[#222222] border-b border-white/10 text-white px-8 py-7 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
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
              <span className="text-white">Plan Applications Association</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-3">
              <span className="material-symbols-outlined text-[#ae001a] text-3xl">widgets</span>
              PLAN-TO-APPLICATIONS ASSOCIATION
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-2xl">
              Dynamically link and unlink SaaS applications to subscription tiers to control
              modular ecosystem provisioning across customer companies.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className="px-3 py-1 bg-white/10 text-emerald-400 rounded text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 border border-white/10">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              Superadmin Mode
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              className="px-4 py-2 border border-white/20 hover:border-white/40 text-xs font-bold uppercase tracking-widest rounded text-white/90 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 hover:text-primary duration-200"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Command Hub
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">report</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => selectedPlanId && loadPlanApplications(selectedPlanId)}
              className="underline font-bold hover:text-red-950 uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        )}

        {/* Master Tier Selector Bar */}
        <div className="mb-8 bg-white border border-[#e8e2d8] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e8e2d8]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                Select Target Subscription Tier
              </span>
              <h2 className="text-base font-bold text-[#1d1c17] mt-0.5">
                Pricing Tier & Plan Context
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#5f5e5e]">Display Mode:</span>
              <div className="inline-flex rounded-lg border border-[#e8e2d8] bg-[#f8f5ef] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#ae001a] shadow-xs'
                      : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  Tier Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'matrix'
                      ? 'bg-white text-[#ae001a] shadow-xs'
                      : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">view_module</span>
                  Full Matrix
                </button>
              </div>
            </div>
          </div>

          {/* Plan Pill Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {plans.map((p) => {
              const isSelected = p.id === selectedPlanId;
              const countLinked = isSelected
                ? linkedAppIds.size
                : (allPlanAssociations[p.id]?.size ?? 0);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPlan(p.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#fef9f1] border-[#ae001a] shadow-sm ring-1 ring-[#ae001a]'
                      : 'bg-white border-[#e8e2d8] hover:border-[#ae001a]/50 hover:bg-[#faf7f2]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-[#ae001a] text-white rounded-bl-lg">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isSelected ? 'text-[#ae001a]' : 'text-[#1d1c17]'
                      }`}
                    >
                      {p.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        p.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#5f5e5e] mb-2 font-mono">
                    {p.price !== null ? `$${Number(p.price).toFixed(2)}` : 'Custom'}{' '}
                    <span className="text-[10px] text-[#8a8886]">
                      / {p.billingCycle || 'month'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#5f5e5e] border-t border-[#e8e2d8]/60 pt-2">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-[#ae001a]">
                        link
                      </span>
                      {countLinked} / {applications.length} apps
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#ae001a]">
                      {isSelected ? 'ACTIVE TIER' : 'SELECT'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode: Matrix Mode */}
        {viewMode === 'matrix' ? (
          <div className="bg-white border border-[#e8e2d8] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-[#222222] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#ae001a]">
                  MASTER MATRIX VIEW
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Relational Plan vs Application Matrix
                </h3>
              </div>
              <span className="text-xs text-white/60">
                Click checkboxes to toggle plan modular provisioning in real-time.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8f5ef] border-b border-[#e8e2d8]">
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Application / Software Module
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Category
                    </th>
                    {plans.map((p) => (
                      <th
                        key={p.id}
                        className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-widest text-[#1d1c17] border-l border-[#e8e2d8]"
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8]">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#faf7f2] transition-colors">
                      <td className="py-3.5 px-6 font-medium text-[#1d1c17]">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[#5f5e5e] text-lg">
                            apps
                          </span>
                          <div>
                            <div className="font-bold text-[#1d1c17]">{app.name}</div>
                            <div className="text-[10px] text-[#5f5e5e] line-clamp-1">
                              {app.description || 'System software module'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#5f5e5e]">
                        <span className="px-2 py-0.5 bg-[#f0eae1] text-[#5f5e5e] rounded text-[10px] font-bold uppercase tracking-wider">
                          {app.category || 'General'}
                        </span>
                      </td>
                      {plans.map((p) => {
                        const isLinked =
                          p.id === selectedPlanId
                            ? linkedAppIds.has(app.id)
                            : (allPlanAssociations[p.id]?.has(app.id) ?? false);
                        const isProcessing = isAssociatingId === app.id && selectedPlanId === p.id;

                        return (
                          <td
                            key={p.id}
                            className="py-3.5 px-4 text-center border-l border-[#e8e2d8]"
                          >
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => {
                                setSelectedPlanId(p.id);
                                if (isLinked) {
                                  handleUnlinkApplication(app.id, p.id);
                                } else {
                                  handleLinkApplication(app.id, p.id);
                                }
                              }}
                              title={
                                isLinked
                                  ? `Unlink ${app.name} from ${p.name}`
                                  : `Link ${app.name} to ${p.name}`
                              }
                              className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all cursor-pointer ${
                                isLinked
                                  ? 'bg-emerald-600 text-white hover:bg-red-700 shadow-xs'
                                  : 'bg-[#f0eae1] text-[#8a8886] hover:bg-[#ae001a] hover:text-white'
                              } hover:text-primary duration-200`}
                            >
                              {isProcessing ? (
                                <span className="material-symbols-outlined text-sm animate-spin">
                                  progress_activity
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-base">
                                  {isLinked ? 'link' : 'link_off'}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* View Mode: Grid Mode */
          <div>
            {/* Search and Filters Bar */}
            <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a8886] text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter applications by name, category, or code…"
                  className="w-full pl-10 pr-4 py-2 text-xs border border-[#e8e2d8] rounded-lg bg-[#f8f5ef] focus:outline-none focus:border-[#ae001a] text-[#1d1c17]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#e8e2d8] rounded-lg bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Category: {c}
                    </option>
                  ))}
                </select>

                {/* Association Status Filter */}
                <div className="inline-flex rounded-lg border border-[#e8e2d8] bg-[#f8f5ef] p-0.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md cursor-pointer transition-all ${
                      statusFilter === 'all'
                        ? 'bg-white text-[#ae001a] shadow-xs'
                        : 'text-[#5f5e5e]'
                    }`}
                  >
                    All ({applications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('linked')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md cursor-pointer transition-all ${
                      statusFilter === 'linked'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-[#5f5e5e]'
                    }`}
                  >
                    Linked ({linkedAppIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('unlinked')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md cursor-pointer transition-all ${
                      statusFilter === 'unlinked'
                        ? 'bg-white text-[#5f5e5e] shadow-xs'
                        : 'text-[#5f5e5e]'
                    }`}
                  >
                    Unlinked ({Math.max(0, applications.length - linkedAppIds.size)})
                  </button>
                </div>
              </div>
            </div>

            {/* Applications Association Grid */}
            {isLoading ? (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-4xl text-[#ae001a] animate-spin">
                  progress_activity
                </span>
                <p className="text-xs uppercase font-bold tracking-widest text-[#5f5e5e] mt-3">
                  Loading Plan Applications Catalog…
                </p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div
                data-testid="empty-association-state"
                className="bg-white border border-[#e8e2d8] rounded-xl p-12 text-center shadow-sm"
              >
                <div className="w-14 h-14 mx-auto mb-3 bg-[#f8f5ef] rounded-full flex items-center justify-center text-[#8a8886]">
                  <span className="material-symbols-outlined text-3xl">apps</span>
                </div>
                <h3 className="text-base font-bold text-[#1d1c17] uppercase tracking-wide mb-1">
                  No Applications Match Filter
                </h3>
                <p className="text-xs text-[#5f5e5e] max-w-md mx-auto mb-4">
                  Adjust your search keyword or category filter to inspect and associate system
                  software modules to the selected tier.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 border border-[#e8e2d8] text-xs font-bold uppercase tracking-wider rounded text-[#1d1c17] hover:bg-[#f8f5ef]"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredApplications.map((app) => {
                  const isLinked = linkedAppIds.has(app.id);
                  const isProcessing = isAssociatingId === app.id;

                  return (
                    <div
                      key={app.id}
                      data-testid={`app-card-${app.id}`}
                      className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-200 ${
                        isLinked
                          ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                          : 'border-[#e8e2d8] hover:border-[#ae001a]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[#f8f5ef] border border-[#e8e2d8] flex items-center justify-center text-[#ae001a] shrink-0">
                            <span className="material-symbols-outlined text-xl">apps</span>
                          </div>
                          <span
                            className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isLinked
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-[#f8f5ef] text-[#8a8886] border border-[#e8e2d8]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isLinked ? 'check_circle' : 'remove_circle_outline'}
                            </span>
                            {isLinked ? 'Linked to Tier' : 'Not Linked'}
                          </span>
                        </div>

                        <div className="mb-2">
                          <h4 className="text-sm font-bold text-[#1d1c17]">{app.name}</h4>
                          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-[#8a8886] bg-[#f8f5ef] px-2 py-0.5 rounded mt-0.5">
                            {app.category || 'General Module'}
                          </span>
                        </div>

                        <p className="text-xs text-[#5f5e5e] line-clamp-2 leading-relaxed mb-4">
                          {app.description || 'System software module and modular capabilities.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#e8e2d8] flex items-center justify-between">
                        <span className="text-[10px] text-[#8a8886] font-mono">
                          ID: #{app.id} {app.code ? `• ${app.code}` : ''}
                        </span>

                        {isLinked ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUnlinkApplication(app.id)}
                            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-900 transition-colors duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:text-primary"
                          >
                            {isProcessing ? (
                              <span className="material-symbols-outlined text-sm animate-spin">
                                progress_activity
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">link_off</span>
                            )}
                            Unlink App
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleLinkApplication(app.id)}
                            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#ae001a] hover:bg-[#930015] text-white transition-colors duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:text-primary"
                          >
                            {isProcessing ? (
                              <span className="material-symbols-outlined text-sm animate-spin">
                                progress_activity
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">link</span>
                            )}
                            Link Application
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Bottom NavHubBar */}
      <NavHubBar
        title="SUBSCRIPTION SYSTEM"
        titleIcon="hub"
        subtitle="Configure subscription plans, modular applications, and active customer deployments."
        items={navHubItems}
        onBackToDashboard={() => onNavigate?.('subscription-system-hub')}
        backToDashboardLabel="Back to Subscription Hub"
      />
    </div>
  );
};

