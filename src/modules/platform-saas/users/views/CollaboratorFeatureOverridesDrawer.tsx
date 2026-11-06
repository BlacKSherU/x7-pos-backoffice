import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[9999] flex justify-end items-stretch backdrop-blur-xs font-sans"
      role="presentation"
    >
      <div
        className="bg-white border-l border-[#e8e2d8] shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in-right flex flex-col h-full text-left"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Permissions & Overrides — ${user.username || user.email}`}
      >
        {/* Drawer Header (matches kdsOrders slide-over right drawer) */}
        <div className="p-4 bg-[#222222] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[#ae001a] text-xl shrink-0">
              admin_panel_settings
            </span>
            <div className="min-w-0">
              <div
                className="font-bold text-sm tracking-wider uppercase text-white !text-white font-sans truncate"
                style={{ color: '#ffffff' }}
              >
                Permissions &amp; Overrides — {user.username || user.email}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans uppercase tracking-wider mt-0.5">
                Operational Shift:{' '}
                {data?.shiftRole
                  ? data.shiftRole.toUpperCase()
                  : 'NO SHIFT ROLE ASSIGNED'}{' '}
                • Company Plan #{data?.planId ?? '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 disabled:opacity-50 shrink-0"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Top Status & Context Strip */}
          <div className="bg-[#fcfbf9] border border-[#e8e2d8] p-3.5 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-[#ae001a] text-white flex items-center justify-center font-bold text-sm shrink-0">
                <span className="material-symbols-outlined text-[18px]">
                  shield_person
                </span>
              </span>
              <div>
                <span className="font-bold text-[#1d1c17] text-sm block">
                  {user.username || '—'}{' '}
                  <span className="text-[#5f5e5e] font-normal text-xs">
                    ({user.email})
                  </span>
                </span>
                <span className="block text-[11px] text-[#5f5e5e] mt-0.5">
                  Security Role:{' '}
                  <span className="font-mono font-semibold text-[#1d1c17] uppercase">
                    {user.role}
                  </span>{' '}
                  • Base Shift:{' '}
                  <span className="font-mono font-bold text-[#ae001a]">
                    {data?.shiftRole ? data.shiftRole.toUpperCase() : 'NONE'}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check</span>
                Effective Active: {overrideCounts.effectiveCount}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Overrides: {overrideCounts.allowedCount + overrideCounts.deniedCount}
              </span>
            </div>
          </div>

          {/* KDS-style Concise Callout */}
          <div className="bg-[#fef9f1] border-l-4 border-[#ae001a] px-3.5 py-2.5 rounded-r-lg">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#ae001a] text-lg shrink-0">
                verified_user
              </span>
              <p className="text-xs text-[#1d1c17]">
                <strong className="text-[#ae001a]">Strict Ceiling Rule:</strong>{' '}
                Overrides grant or restrict access for this collaborator, but can{' '}
                <u>never</u> exceed the company&apos;s active subscription plan.
              </p>
            </div>
          </div>

          {/* Sticky Search & Actions Bar */}
          <div className="sticky top-0 z-10 bg-white py-2 border-b border-[#e8e2d8] flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#5f5e5e] text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search features, codes or applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#fef9f1] border border-[#e8e2d8] rounded-lg text-xs text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a]"
              />
            </div>

            <button
              type="button"
              onClick={handleResetAllToInherit}
              className="px-3 py-2 text-xs font-bold text-[#1d1c17] hover:text-[#ae001a] border border-[#e8e2d8] rounded-lg bg-[#fcfbf9] hover:bg-[#ede7dc] transition-colors cursor-pointer flex items-center gap-1"
              title="Reset all feature overrides to Inherit from ShiftRole"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              Reset All to Inherit
            </button>
          </div>

          {/* Error notification if any */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Features Grouped by Category & Application */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-secondary">
                <span className="material-symbols-outlined text-4xl animate-spin text-[#ae001a]">
                  progress_activity
                </span>
                <p className="text-xs font-bold tracking-wider uppercase">
                  Loading Plan Features &amp; Permissions...
                </p>
              </div>
            ) : groupedFeatures.length === 0 ? (
              <div className="py-10 text-center text-[#5f5e5e] border border-dashed border-[#e8e2d8] rounded-lg bg-[#fcfbf9]">
                <span className="material-symbols-outlined text-3xl mb-1 text-[#5f5e5e]/50">
                  search_off
                </span>
                <p className="font-bold text-sm text-[#1d1c17]">No features found</p>
                <p className="text-xs text-[#5f5e5e] mt-1">
                  No features match &ldquo;{searchQuery}&rdquo; or are included in the company&apos;s active plan.
                </p>
              </div>
            ) : (
              groupedFeatures.map((cat) => (
                <div
                  key={cat.categoryName}
                  className="border border-[#e8e2d8] rounded-lg p-3.5 bg-white space-y-3 shadow-2xs"
                >
                  {/* Category Header (matches kdsOrders Timestamp / Breakdown block style) */}
                  <div className="flex items-center justify-between border-b border-[#e8e2d8] pb-2">
                    <span className="text-xs font-bold text-[#1d1c17] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#ae001a]">
                        category
                      </span>
                      {cat.categoryName}
                    </span>
                    <span className="text-[11px] font-mono text-[#5f5e5e]">
                      {cat.applications.length} {cat.applications.length === 1 ? 'App' : 'Apps'}
                    </span>
                  </div>

                  {/* Applications within Category */}
                  <div className="space-y-3">
                    {cat.applications.map((app) => (
                      <div key={app.applicationName} className="space-y-2">
                        <p className="font-bold text-[11px] text-[#5f5e5e] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ae001a]" />
                          {app.applicationName}
                        </p>

                        <div className="divide-y divide-[#f0ede6] border border-[#ebe5da] rounded-lg bg-[#fcfbf9]">
                          {app.features.map((feat) => {
                            const currentOverride =
                              localOverrides[feat.featureId] ?? feat.override;
                            let isEffective = feat.basePermission;
                            if (currentOverride === 'allow') isEffective = true;
                            if (currentOverride === 'deny') isEffective = false;

                            return (
                              <div
                                key={feat.featureId}
                                className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white transition-colors"
                              >
                                {/* Feature details */}
                                <div className="min-w-[200px] flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-xs text-[#1d1c17]">
                                      {feat.name}
                                    </p>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#e8e2d8] text-[#5f5e5e]">
                                      #{feat.featureId}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-[#5f5e5e] font-mono">
                                      {feat.code}
                                    </span>
                                    <span className="text-zinc-300">•</span>
                                    {feat.basePermission ? (
                                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                                        Shift Base: ALLOW
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-zinc-100 text-[#5f5e5e] border-zinc-200">
                                        Shift Base: RESTRICTED
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-2.5 shrink-0">
                                  {/* Tri-state Segmented Switch */}
                                  <div className="inline-flex rounded-lg border border-[#e8e2d8] bg-white p-0.5 text-xs font-semibold">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetOverride(feat.featureId, 'inherit')
                                      }
                                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                        currentOverride === 'inherit'
                                          ? 'bg-[#1d1c17] text-white font-bold shadow-2xs'
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
                                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                        currentOverride === 'allow'
                                          ? 'bg-emerald-600 text-white font-bold shadow-2xs'
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
                                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                        currentOverride === 'deny'
                                          ? 'bg-[#ae001a] text-white font-bold shadow-2xs'
                                          : 'text-red-700 hover:bg-red-50'
                                      }`}
                                      title="Explicitly DENY this feature for this user"
                                    >
                                      Deny
                                    </button>
                                  </div>

                                  {/* Effective Status Indicator */}
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                                      isEffective
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                                    }`}
                                    title={
                                      isEffective
                                        ? 'Effective Status: User CAN access this feature'
                                        : 'Effective Status: User CANNOT access this feature'
                                    }
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
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
        </div>

        {/* Drawer Footer Buttons (matches kdsOrders slide-over right drawer) */}
        <div className="flex items-center justify-end gap-3 p-4 bg-[#fcfbf9] border-t border-[#e8e2d8] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-[#e8e2d8] text-[#5f5e5e] text-xs font-bold uppercase rounded hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || loading}
            className="px-6 py-2 bg-[#ae001a] hover:bg-[#c4001d] text-white text-xs font-bold uppercase rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[15px] animate-spin">
                  progress_activity
                </span>
                <span>Saving Overrides...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[15px]">save</span>
                <span>Save Overrides</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

