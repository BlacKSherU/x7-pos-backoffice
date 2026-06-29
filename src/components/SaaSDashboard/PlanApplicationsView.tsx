import React, { useState, useEffect } from 'react';
import { saasService } from '../../services/saasService';
import type { PlanApplication, SubscriptionPlan } from '../../types/subscription';

interface PlanApplicationsViewProps {
  plan: SubscriptionPlan;
  onNavigate?: (view: string) => void;
}

export const PlanApplicationsView: React.FC<PlanApplicationsViewProps> = ({
  plan,
  onNavigate,
}) => {
  const [planApplications, setPlanApplications] = useState<PlanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    saasService
      .getPlanApplications(plan.id)
      .then(setPlanApplications)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load plan applications';
        if (msg === 'SESSION_EXPIRED') {
          setToast({
            message: 'Session expired. Please refresh the page to sign in again.',
            type: 'error',
          });
        } else {
          setToast({ message: msg, type: 'error' });
        }
      })
      .finally(() => setLoading(false));
  }, [plan.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="flex flex-col gap-6">
      {/* Dark Title Card */}
      <div className="bg-[#222222] px-6 py-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          APPLICATIONS BOUND TO PLAN: {plan.name}
        </span>
      </div>

      {/* Empty State */}
      {!loading && planApplications.length === 0 && (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center py-24 gap-6"
        >
          <span className="material-symbols-outlined text-[#5f5e5e] text-[72px]">
            app_registration
          </span>
          <div className="text-center">
            <h3 className="text-xl font-bold text-[#1d1c17]">No Applications Linked</h3>
            <p className="text-sm text-[#5f5e5e] mt-2 max-w-md text-center">
              This subscription plan currently has no applications linked.
              Click &apos;Associate Application&apos; to bundle your first software module.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="text-[#ae001a] text-sm font-semibold hover:underline"
          >
            ← Back to Subscription Plans
          </button>
        </div>
      )}

      {/* Table */}
      {(loading || planApplications.length > 0) && (
        <div className="bg-white border border-[#e8e2d8] overflow-hidden">
          <div className="px-4 py-3 bg-[#222222] flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white">
              BOUND APPLICATIONS
            </span>
            <span className="text-white/50 text-xs">
              {loading ? '...' : `${planApplications.length} entries`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Linked Application &amp; ID
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Software Category
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Usage Restrictions
                  </th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Association Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {loading
                  ? [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-40" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-24" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-48" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="h-4 bg-[#ece8e0] rounded animate-pulse w-14 mx-auto" />
                        </td>
                      </tr>
                    ))
                  : planApplications.map((pa) => (
                      <tr
                        key={pa.id}
                        className="hover:bg-[#f8f3eb] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#1d1c17]">{pa.application.name}</p>
                          <code className="font-mono text-[11px] text-[#5f5e5e] bg-[#f2ede5] px-1.5 py-0.5 rounded">
                            {pa.application.id}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          {pa.application.category !== pa.application.name ? (
                            <span className="bg-[#f2ede5] border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              {pa.application.category}
                            </span>
                          ) : (
                            <span className="bg-[#f2ede5] border border-[#e8e2d8] text-[#1d1c17] text-[10px] font-bold uppercase px-2 py-0.5 rounded" aria-label={pa.application.category}>
                              {pa.application.category.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-[#5f5e5e]">{pa.limits}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {pa.status === 'active' ? (
                            <span className="bg-green-500/10 text-green-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              active
                            </span>
                          ) : (
                            <span className="bg-[#5f5e5e]/20 text-[#5f5e5e] text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center border-t border-[#e8e2d8] pt-5 mt-2 mb-8">
        <button
          type="button"
          onClick={() => onNavigate?.('subscription')}
          className="text-[11px] font-bold uppercase tracking-widest text-[#ae001a] hover:underline flex items-center gap-1"
        >
          ← Back to Subscription Plans
        </button>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mt-3 md:mt-0">
          © 2026 X7 Point of Sale. All rights reserved.
        </p>
      </footer>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanApplicationsView;
