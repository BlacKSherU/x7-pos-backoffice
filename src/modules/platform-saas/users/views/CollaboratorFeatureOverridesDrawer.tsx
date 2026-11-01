import React, { useEffect, useMemo, useState } from 'react';
import { AppModal } from '@/shared/components/AppModal';
import {
  getUserFeatureOverrides,
  updateUserFeatureOverrides,
} from '@/modules/platform-saas/users/api/users';
import type {
  PlatformUser,
  MerchantUser,
  UserFeatureItem,
  UserFeatureOverridesResponse,
  UpdateFeatureOverrideItem,
} from '@/modules/platform-saas/users/types/user';

interface CollaboratorFeatureOverridesDrawerProps {
  user: PlatformUser | MerchantUser;
  onClose: () => void;
  onSuccess: (updated: UserFeatureOverridesResponse) => void;
}

export const CollaboratorFeatureOverridesDrawer: React.FC<
  CollaboratorFeatureOverridesDrawerProps
> = ({ user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<UserFeatureOverridesResponse | null>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<number, 'inherit' | 'allow' | 'deny'>
  >({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const fetchOverrides = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getUserFeatureOverrides(user.id);
        if (isMounted) {
          setData(response);
          const initialOverrides: Record<number, 'inherit' | 'allow' | 'deny'> = {};
          response.features.forEach((f) => {
            initialOverrides[f.featureId] = f.override;
          });
          setLocalOverrides(initialOverrides);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load user feature overrides',
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchOverrides();
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  const handleSetOverride = (
    featureId: number,
    effect: 'inherit' | 'allow' | 'deny',
  ) => {
    setLocalOverrides((prev) => ({
      ...prev,
      [featureId]: effect,
    }));
  };

  const handleResetAllToInherit = () => {
    if (!data) return;
    const reset: Record<number, 'inherit' | 'allow' | 'deny'> = {};
    data.features.forEach((f) => {
      reset[f.featureId] = 'inherit';
    });
    setLocalOverrides(reset);
  };

  const handleSave = async () => {
    if (!data) return;
    setSubmitting(true);
    setError('');

    const payload: UpdateFeatureOverrideItem[] = Object.entries(localOverrides).map(
      ([fId, effect]) => ({
        featureId: parseInt(fId, 10),
        effect,
      }),
    );

    try {
      const updated = await updateUserFeatureOverrides(user.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save feature overrides. Ensure overrides do not exceed your company plan.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Group features by category and application
  const groupedFeatures = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();

    const filtered = data.features.filter((f) => {
      if (!query) return true;
      return (
        f.name.toLowerCase().includes(query) ||
        f.code.toLowerCase().includes(query) ||
        f.applicationName.toLowerCase().includes(query) ||
        f.categoryName.toLowerCase().includes(query)
      );
    });

    // Grouping: Category -> Application -> Features
    const categoryMap = new Map<
      string,
      {
        categoryId: number;
        categoryName: string;
        applications: Map<
          string,
          {
            applicationId: number;
            applicationName: string;
            features: UserFeatureItem[];
          }
        >;
      }
    >();

    filtered.forEach((f) => {
      if (!categoryMap.has(f.categoryName)) {
        categoryMap.set(f.categoryName, {
          categoryId: f.categoryId,
          categoryName: f.categoryName,
          applications: new Map(),
        });
      }
      const catEntry = categoryMap.get(f.categoryName)!;
      if (!catEntry.applications.has(f.applicationName)) {
        catEntry.applications.set(f.applicationName, {
          applicationId: f.applicationId,
          applicationName: f.applicationName,
          features: [],
        });
      }
      catEntry.applications.get(f.applicationName)!.features.push(f);
    });

    return Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      applications: Array.from(cat.applications.values()),
    }));
  }, [data, searchQuery]);

  // Count active overrides
  const overrideCounts = useMemo(() => {
    let allowedCount = 0;
    let deniedCount = 0;
    let effectiveCount = 0;

    if (!data) return { allowedCount, deniedCount, effectiveCount };

    data.features.forEach((f) => {
      const ov = localOverrides[f.featureId] ?? f.override;
      if (ov === 'allow') allowedCount++;
      if (ov === 'deny') deniedCount++;

      let eff = f.basePermission;
      if (ov === 'allow') eff = true;
      if (ov === 'deny') eff = false;
      if (eff) effectiveCount++;
    });

    return { allowedCount, deniedCount, effectiveCount };
  }, [data, localOverrides]);

  return (
    <AppModal
      title={`Permissions & Overrides — ${user.username || user.email}`}
      subtitle={`Operational Shift: ${
        data?.shiftRole ? data.shiftRole.toUpperCase() : 'NO SHIFT ROLE ASSIGNED'
      } • Company Plan #${data?.planId ?? '—'}`}
      onClose={onClose}
      size="4xl"
      closeDisabled={submitting}
    >
      <div className="flex flex-col flex-1 overflow-hidden p-6 gap-5 bg-white text-left font-sans">
        {/* Top Summary Banner */}
        <div className="bg-[#f8f3eb] border border-[#e8e2d8] rounded p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[#ae001a] text-white flex items-center justify-center font-bold text-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                shield_person
              </span>
            </span>
            <div>
              <p className="font-bold text-sm text-[#1d1c17]">
                User: {user.username || '—'} ({user.email})
              </p>
              <p className="text-xs text-[#5f5e5e]">
                Security Role:{' '}
                <span className="font-mono font-semibold uppercase">
                  {user.role}
                </span>{' '}
                • Base Shift:{' '}
                <span className="font-mono font-semibold text-[#ae001a]">
                  {data?.shiftRole ? data.shiftRole.toUpperCase() : 'None'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check</span>
              Effective Active: {overrideCounts.effectiveCount}
            </span>
            <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">tune</span>
              Custom Overrides:{' '}
              {overrideCounts.allowedCount + overrideCounts.deniedCount}
            </span>
          </div>
        </div>

        {/* Ceiling Rule Alert Notice */}
        <div className="bg-blue-50/70 border border-blue-200 rounded p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <span className="material-symbols-outlined text-blue-700 text-[18px] shrink-0 mt-0.5">
            info
          </span>
          <p>
            <strong>Strict Ceiling Rule Enforced:</strong> Individual overrides
            can grant or restrict privileges for this collaborator, but can{' '}
            <u>never</u> exceed the company's active subscription plan. Features
            outside your contracted plan are excluded from authorization.
          </p>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#5f5e5e] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search features, codes or applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#e8e2d8] rounded bg-white text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a]"
            />
          </div>

          <button
            type="button"
            onClick={handleResetAllToInherit}
            className="px-3 py-2 text-xs font-bold text-[#5f5e5e] hover:text-[#ae001a] border border-[#e8e2d8] rounded bg-white hover:bg-[#f8f3eb] transition-colors cursor-pointer flex items-center gap-1"
            title="Reset all feature overrides to Inherit from ShiftRole"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reset All to Inherit
          </button>
        </div>

        {/* Error notification if any */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-secondary">
              <span className="material-symbols-outlined text-4xl animate-spin text-[#ae001a]">
                progress_activity
              </span>
              <p className="text-xs font-bold tracking-wider uppercase">
                Loading Plan Features & Permissions...
              </p>
            </div>
          ) : groupedFeatures.length === 0 ? (
            <div className="py-12 text-center text-[#5f5e5e] border border-dashed border-[#e8e2d8] rounded">
              <span className="material-symbols-outlined text-4xl mb-1 text-[#5f5e5e]/50">
                search_off
              </span>
              <p className="font-bold text-sm">No features found</p>
              <p className="text-xs text-[#5f5e5e] mt-1">
                No features match "{searchQuery}" or are included in the company's active plan.
              </p>
            </div>
          ) : (
            groupedFeatures.map((cat) => (
              <div
                key={cat.categoryName}
                className="border border-[#e8e2d8] rounded overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-[#222222] text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px] text-[#ae001a]">
                      category
                    </span>
                    <span>{cat.categoryName}</span>
                  </div>
                  <span className="text-[11px] font-mono text-white/60">
                    {cat.applications.length} Applications
                  </span>
                </div>

                {/* Applications within Category */}
                <div className="divide-y divide-[#e8e2d8]">
                  {cat.applications.map((app) => (
                    <div key={app.applicationName} className="p-4 bg-white">
                      <p className="font-bold text-xs text-[#1d1c17] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ae001a]" />
                        {app.applicationName}
                      </p>

                      <div className="space-y-2.5">
                        {app.features.map((feat) => {
                          const currentOverride =
                            localOverrides[feat.featureId] ?? feat.override;
                          let isEffective = feat.basePermission;
                          if (currentOverride === 'allow') isEffective = true;
                          if (currentOverride === 'deny') isEffective = false;

                          return (
                            <div
                              key={feat.featureId}
                              className="p-3 bg-[#f8f3eb]/60 border border-[#e8e2d8] rounded hover:border-[#ae001a]/40 transition-colors flex flex-wrap items-center justify-between gap-3"
                            >
                              {/* Feature details */}
                              <div className="min-w-[200px] flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-[#1d1c17]">
                                    {feat.name}
                                  </p>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#e8e2d8] text-[#5f5e5e]">
                                    #{feat.featureId}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-[11px] text-[#5f5e5e] font-mono">
                                    {feat.code}
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  {feat.basePermission ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      Shift Base: ALLOW
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                                      Shift Base: RESTRICTED
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-3 shrink-0">
                                {/* Tri-state Segmented Switch */}
                                <div className="inline-flex rounded border border-[#e8e2d8] bg-white p-0.5 text-xs font-semibold">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetOverride(feat.featureId, 'inherit')
                                    }
                                    className={`px-3 py-1 rounded transition-all cursor-pointer ${
                                      currentOverride === 'inherit'
                                        ? 'bg-[#222222] text-white font-bold shadow-sm'
                                        : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                                    }`}
                                    title="Inherit default from collaborator ShiftRole"
                                  >
                                    Inherit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetOverride(feat.featureId, 'allow')
                                    }
                                    className={`px-3 py-1 rounded transition-all cursor-pointer ${
                                      currentOverride === 'allow'
                                        ? 'bg-emerald-600 text-white font-bold shadow-sm'
                                        : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title="Explicitly ALLOW this feature for this user"
                                  >
                                    Allow
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetOverride(feat.featureId, 'deny')
                                    }
                                    className={`px-3 py-1 rounded transition-all cursor-pointer ${
                                      currentOverride === 'deny'
                                        ? 'bg-[#ae001a] text-white font-bold shadow-sm'
                                        : 'text-red-700 hover:bg-red-50'
                                    }`}
                                    title="Explicitly DENY this feature for this user"
                                  >
                                    Deny
                                  </button>
                                </div>

                                {/* Effective Status Indicator */}
                                <div
                                  className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                                    isEffective
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-stone-200 text-stone-500'
                                  }`}
                                  title={
                                    isEffective
                                      ? 'Effective Status: User CAN access this feature'
                                      : 'Effective Status: User CANNOT access this feature'
                                  }
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    {isEffective ? 'check_circle' : 'block'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#e8e2d8] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-[#e8e2d8] rounded text-xs font-bold text-[#5f5e5e] hover:bg-[#f8f3eb] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || loading}
            className="px-5 py-2 bg-[#ae001a] hover:bg-[#930015] text-white rounded text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span>Saving Overrides...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Save Overrides</span>
              </>
            )}
          </button>
        </div>
      </div>
    </AppModal>
  );
};

