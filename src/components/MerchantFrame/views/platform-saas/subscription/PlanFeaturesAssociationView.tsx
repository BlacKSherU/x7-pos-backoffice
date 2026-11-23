import React, { useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  PlatformFeature,
  SubscriptionPlan,
  PlanFeature,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import { getEffectiveUserRole, getStoredUser } from '@/platform/auth/lib/auth-storage';
import { NavHubBar } from '@/shared/components/NavHubBar';

export interface PlanFeaturesAssociationViewProps {
  planId?: number | string;
  plan?: SubscriptionPlan;
  userRole?: string | null;
  onNavigate?: (view: string, plan?: SubscriptionPlan) => void;
}

export const PlanFeaturesAssociationView: React.FC<PlanFeaturesAssociationViewProps> = ({
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
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [linkedFeatureIds, setLinkedFeatureIds] = useState<Set<number>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isAssociatingId, setIsAssociatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters and Display Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
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

  // Fetch initial plans and features
  useEffect(() => {
    if (!isSuperAdmin) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      saasService.getSubscriptionPlans().catch(() => []),
      saasService.getFeatures().catch(() => []),
    ])
      .then(([plansData, featuresData]) => {
        if (!isMounted) return;
        setPlans(plansData);
        setFeatures(featuresData);

        const currentPlanId =
          (initialPlanId ? Number(initialPlanId) : null) ??
          initialPlan?.id ??
          (plansData.length > 0 ? plansData[0].id : null);

        setSelectedPlanId(currentPlanId);

        if (currentPlanId) {
          loadPlanFeatures(currentPlanId);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load plans and features catalog.');
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
      loadPlanFeatures(Number(initialPlanId));
    } else if (initialPlan?.id) {
      setSelectedPlanId(initialPlan.id);
      loadPlanFeatures(initialPlan.id);
    }
  }, [initialPlanId, initialPlan]);

  // Load associated features for a plan
  const loadPlanFeatures = async (targetPlanId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      let linkedIds = new Set<number>();
      try {
        const featList = await saasService.getSubscriptionPlanFeatures(targetPlanId);
        linkedIds = new Set(featList.map((f) => f.id));
      } catch {
        // Fallback to getPlanFeatures
        const planFeats = await saasService.getPlanFeatures(targetPlanId);
        linkedIds = new Set(planFeats.map((pf: PlanFeature) => pf.feature.id));
      }

      setLinkedFeatureIds(linkedIds);
      setAllPlanAssociations((prev) => ({ ...prev, [targetPlanId]: linkedIds }));
    } catch (err) {
      console.error('Error fetching plan features:', err);
      setError('Unable to load current plan features association.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    loadPlanFeatures(planId);
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  // Available measurement units
  const units = useMemo(() => {
    const set = new Set<string>();
    features.forEach((feat) => {
      if (feat.Unit) set.add(feat.Unit);
    });
    return Array.from(set).sort();
  }, [features]);

  // Filtered features
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return features.filter((feat) => {
      const isLinked = linkedFeatureIds.has(feat.id);

      if (statusFilter === 'linked' && !isLinked) return false;
      if (statusFilter === 'unlinked' && isLinked) return false;
      if (selectedUnit !== 'all' && feat.Unit?.toLowerCase() !== selectedUnit.toLowerCase()) {
        return false;
      }

      if (q) {
        const matchName = feat.name.toLowerCase().includes(q);
        const matchUnit = feat.Unit?.toLowerCase().includes(q);
        const matchDesc = feat.description?.toLowerCase().includes(q);
        return matchName || matchUnit || matchDesc;
      }
      return true;
    });
  }, [features, linkedFeatureIds, searchQuery, selectedUnit, statusFilter]);

  // Bind Feature Handler
  const handleBindFeature = async (featureId: number, targetPlanId = selectedPlanId) => {
    if (!targetPlanId) return;
    setIsAssociatingId(featureId);
    try {
      await saasService.associatePlanFeature(targetPlanId, featureId);

      setLinkedFeatureIds((prev) => {
        const next = new Set(prev);
        next.add(featureId);
        return next;
      });

      setAllPlanAssociations((prev) => {
        const current = new Set(prev[targetPlanId] || []);
        current.add(featureId);
        return { ...prev, [targetPlanId]: current };
      });

      const featureName = features.find((f) => f.id === featureId)?.name || 'Feature';
      setToast({
        message: `Successfully bound "${featureName}" to ${selectedPlan?.name || 'plan'}.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to bind feature:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to associate feature to plan.',
        type: 'error',
      });
    } finally {
      setIsAssociatingId(null);
    }
  };

  // Unbind Feature Handler
  const handleUnbindFeature = async (featureId: number, targetPlanId = selectedPlanId) => {
    if (!targetPlanId) return;
    setIsAssociatingId(featureId);
    try {
      await saasService.disassociatePlanFeature(targetPlanId, featureId);

      setLinkedFeatureIds((prev) => {
        const next = new Set(prev);
        next.delete(featureId);
        return next;
      });

      setAllPlanAssociations((prev) => {
        const current = new Set(prev[targetPlanId] || []);
        current.delete(featureId);
        return { ...prev, [targetPlanId]: current };
      });

      const featureName = features.find((f) => f.id === featureId)?.name || 'Feature';
      setToast({
        message: `Unbound "${featureName}" from ${selectedPlan?.name || 'plan'}.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to unbind feature:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to disassociate feature from plan.',
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
      onClick: () => onNavigate?.('plan-apps-rules'),
    },
    {
      id: 'plan-features-mapping',
      label: 'PLAN FEATURES',
      icon: 'checklist',
      active: true,
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
            Plan-to-features association is strictly restricted to Super Administrators.
            Your current account role (<strong>{userRole || rawStoredRole || effectiveRole || 'guest'}</strong>) does not have
            sufficient privileges to configure software feature gating across subscription tiers.
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
              <span className="text-white">Plan Features Association</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-3">
              <span className="material-symbols-outlined text-[#ae001a] text-3xl">rule_settings</span>
              PLAN-TO-FEATURES ASSOCIATION
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-2xl">
              Configure granular software features and operational flags linked to pricing tiers
              to enforce feature-level gating across tenant backoffices.
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
              onClick={() => selectedPlanId && loadPlanFeatures(selectedPlanId)}
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
                Pricing Tier & Feature Gate Context
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
                ? linkedFeatureIds.size
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
                        rule_settings
                      </span>
                      {countLinked} / {features.length} features
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
                  Relational Plan vs Feature Gate Matrix
                </h3>
              </div>
              <span className="text-xs text-white/60">
                Click switches to gate/ungate software capabilities across plans in real-time.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8f5ef] border-b border-[#e8e2d8]">
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Granular Software Feature
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                      Unit
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
                  {features.map((feat) => (
                    <tr key={feat.id} className="hover:bg-[#faf7f2] transition-colors">
                      <td className="py-3.5 px-6 font-medium text-[#1d1c17]">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[#5f5e5e] text-lg">
                            extension
                          </span>
                          <div>
                            <div className="font-bold text-[#1d1c17]">{feat.name}</div>
                            <div className="text-[10px] text-[#5f5e5e] line-clamp-1">
                              {feat.description || 'Platform feature capability'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#5f5e5e]">
                        <span className="px-2 py-0.5 bg-[#f0eae1] text-[#5f5e5e] rounded text-[10px] font-bold uppercase tracking-wider font-mono">
                          {feat.Unit || 'unit'}
                        </span>
                      </td>
                      {plans.map((p) => {
                        const isLinked =
                          p.id === selectedPlanId
                            ? linkedFeatureIds.has(feat.id)
                            : (allPlanAssociations[p.id]?.has(feat.id) ?? false);
                        const isProcessing = isAssociatingId === feat.id && selectedPlanId === p.id;

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
                                  handleUnbindFeature(feat.id, p.id);
                                } else {
                                  handleBindFeature(feat.id, p.id);
                                }
                              }}
                              title={
                                isLinked
                                  ? `Unbind ${feat.name} from ${p.name}`
                                  : `Bind ${feat.name} to ${p.name}`
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
                                  {isLinked ? 'check_circle' : 'add'}
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
                  placeholder="Filter features by name, unit, or description…"
                  className="w-full pl-10 pr-4 py-2 text-xs border border-[#e8e2d8] rounded-lg bg-[#f8f5ef] focus:outline-none focus:border-[#ae001a] text-[#1d1c17]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Unit Filter */}
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="px-3 py-2 text-xs border border-[#e8e2d8] rounded-lg bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                >
                  <option value="all">All Units</option>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      Unit: {u}
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
                    All ({features.length})
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
                    Linked ({linkedFeatureIds.size})
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
                    Unlinked ({Math.max(0, features.length - linkedFeatureIds.size)})
                  </button>
                </div>
              </div>
            </div>

            {/* Features Association Grid */}
            {isLoading ? (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-4xl text-[#ae001a] animate-spin">
                  progress_activity
                </span>
                <p className="text-xs uppercase font-bold tracking-widest text-[#5f5e5e] mt-3">
                  Loading Plan Features Catalog…
                </p>
              </div>
            ) : filteredFeatures.length === 0 ? (
              <div
                data-testid="empty-association-state"
                className="bg-white border border-[#e8e2d8] rounded-xl p-12 text-center shadow-sm"
              >
                <div className="w-14 h-14 mx-auto mb-3 bg-[#f8f5ef] rounded-full flex items-center justify-center text-[#8a8886]">
                  <span className="material-symbols-outlined text-3xl">rule_settings</span>
                </div>
                <h3 className="text-base font-bold text-[#1d1c17] uppercase tracking-wide mb-1">
                  No Features Match Filter
                </h3>
                <p className="text-xs text-[#5f5e5e] max-w-md mx-auto mb-4">
                  Adjust your search keyword or unit filter to inspect and associate software
                  features to the selected pricing tier.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedUnit('all');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 border border-[#e8e2d8] text-xs font-bold uppercase tracking-wider rounded text-[#1d1c17] hover:bg-[#f8f5ef]"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFeatures.map((feat) => {
                  const isLinked = linkedFeatureIds.has(feat.id);
                  const isProcessing = isAssociatingId === feat.id;

                  return (
                    <div
                      key={feat.id}
                      data-testid={`feature-card-${feat.id}`}
                      className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-200 ${
                        isLinked
                          ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                          : 'border-[#e8e2d8] hover:border-[#ae001a]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[#f8f5ef] border border-[#e8e2d8] flex items-center justify-center text-[#ae001a] shrink-0">
                            <span className="material-symbols-outlined text-xl">extension</span>
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
                            {isLinked ? 'Feature Gated' : 'Not Gated'}
                          </span>
                        </div>

                        <div className="mb-2">
                          <h4 className="text-sm font-bold text-[#1d1c17]">{feat.name}</h4>
                          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-[#5f5e5e] bg-[#f8f5ef] px-2 py-0.5 rounded mt-0.5 font-mono">
                            Unit: {feat.Unit || 'unit'}
                          </span>
                        </div>

                        <p className="text-xs text-[#5f5e5e] line-clamp-2 leading-relaxed mb-4">
                          {feat.description || 'Platform feature capability and access boundary.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#e8e2d8] flex items-center justify-between">
                        <span className="text-[10px] text-[#8a8886] font-mono">
                          ID: #{feat.id}
                        </span>

                        {isLinked ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUnbindFeature(feat.id)}
                            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-900 transition-colors duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:text-primary"
                          >
                            {isProcessing ? (
                              <span className="material-symbols-outlined text-sm animate-spin">
                                progress_activity
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">link_off</span>
                            )}
                            Unbind Feature
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleBindFeature(feat.id)}
                            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#ae001a] hover:bg-[#930015] text-white transition-colors duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:text-primary"
                          >
                            {isProcessing ? (
                              <span className="material-symbols-outlined text-sm animate-spin">
                                progress_activity
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">extension</span>
                            )}
                            Bind Feature
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

