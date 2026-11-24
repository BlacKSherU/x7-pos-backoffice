import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PayrollAdjustment,
  PayrollAdjustmentsGridProps,
} from './types';
import {
  filterPayrollAdjustments,
  formatAdjustmentAmount,
  isPayrollAdjustmentSoftDeleted,
  recalculatePayrollEntryFromAdjustmentDeletion,
} from './payroll-entries-helpers';
import { apiRequest } from '@/shared/api/http';

export type * from './types';

type MaybeEnvelopedList<T> = { data?: T[]; items?: T[] } | T[];

const unwrapList = <T,>(res: MaybeEnvelopedList<T>): T[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

export const PayrollAdjustmentsGrid: React.FC<PayrollAdjustmentsGridProps> = ({
  payrollRunId,
  payrollEntryId,
  adjustments: propAdjustments,
  payrollEntries = [],
  searchQuery = '',
  selectedType = 'ALL',
  selectedTypeFilter,
  onSelectAdjustment,
  onEditAdjustment,
  onDeleteAdjustment,
  onAdjustmentsChange,
  onPayrollEntryRecalculated,
  onRefresh,
  isLoading: propIsLoading,
  includeDeleted: initialIncludeDeleted = false,
  currency = 'USD',
  className = '',
}) => {
  const [internalAdjustments, setInternalAdjustments] = useState<PayrollAdjustment[]>(
    propAdjustments ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(initialIncludeDeleted);

  // Inspector State
  const [inspectorAdjustment, setInspectorAdjustment] = useState<PayrollAdjustment | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Deleting item state tracking
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // Sync internal adjustments when propAdjustments changes
  useEffect(() => {
    if (propAdjustments !== undefined) {
      setInternalAdjustments(propAdjustments);
    }
  }, [propAdjustments]);

  // Data Hydration from API when runId or entryId is provided and no props were injected
  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (payrollEntryId !== undefined) queryParams.set('payroll_entry_id', String(payrollEntryId));
      queryParams.set('limit', '100');

      const response = await apiRequest<MaybeEnvelopedList<PayrollAdjustment>>(
        `/payroll-adjustments?${queryParams.toString()}`,
        { method: 'GET' },
        'Failed to retrieve payroll adjustments.',
      );
      const list = unwrapList(response);
      const normalized = list.map((adj) => ({
        ...adj,
        adjustment_type: (adj.adjustment_type || 'bonus').toUpperCase(),
        amount: Math.abs(Number(adj.amount)),
      }));
      setInternalAdjustments(normalized);
      onAdjustmentsChange?.(normalized);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load payroll adjustments. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [payrollEntryId, onAdjustmentsChange]);

  useEffect(() => {
    if ((payrollRunId !== undefined || payrollEntryId !== undefined) && propAdjustments === undefined) {
      void fetchAdjustments();
    }
  }, [payrollRunId, payrollEntryId, propAdjustments, fetchAdjustments]);

  const activeLoading = propIsLoading ?? loading;

  // Filter adjustments based on soft-delete status, search query, and adjustment type
  const visibleAdjustments = useMemo(() => {
    let dataset = internalAdjustments;

    if (!includeDeleted) {
      dataset = dataset.filter((adj) => !isPayrollAdjustmentSoftDeleted(adj));
    }

    if (payrollEntryId !== undefined) {
      dataset = dataset.filter((adj) => String(adj.payroll_entry_id) === String(payrollEntryId));
    }

    const effectiveFilterType = selectedTypeFilter ?? selectedType;
    return filterPayrollAdjustments(dataset, searchQuery, effectiveFilterType);
  }, [includeDeleted, internalAdjustments, payrollEntryId, searchQuery, selectedType, selectedTypeFilter]);

  // Row Inspection Click
  const handleRowClick = (adj: PayrollAdjustment) => {
    setInspectorAdjustment(adj);
    setIsInspectorOpen(true);
    onSelectAdjustment?.(adj);
  };

  const handleCloseInspector = () => {
    setIsInspectorOpen(false);
    setInspectorAdjustment(null);
  };

  // ── Soft Delete Pipeline & PayrollEntry Recalculation ──────────────────────
  const handleDeleteClick = async (adj: PayrollAdjustment, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const isAlreadyDeleted = isPayrollAdjustmentSoftDeleted(adj);
    const actionLabel = isAlreadyDeleted ? 'restore' : 'soft-delete';

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} adjustment #${adj.id} (${adj.adjustment_type}: ${
        adj.description || adj.name || 'manual adjustment'
      })? Associated payroll entry totals will be automatically recalculated.`,
    );
    if (!confirmed) return;

    setDeletingId(adj.id);
    const now = new Date().toISOString();
    const newDeletedAt = isAlreadyDeleted ? null : now;

    try {
      if (onDeleteAdjustment) {
        await onDeleteAdjustment(adj);
      } else if (payrollRunId !== undefined) {
        // Optional REST call when live backend is available
        await apiRequest(
          `/payroll-adjustments/${adj.id}`,
          { method: isAlreadyDeleted ? 'PATCH' : 'DELETE' },
          `Failed to ${actionLabel} adjustment.`,
        );
      }

      // Update state for adjustments
      const updatedList = internalAdjustments.map((item) =>
        item.id === adj.id ? { ...item, deleted_at: newDeletedAt } : item,
      );
      setInternalAdjustments(updatedList);
      onAdjustmentsChange?.(updatedList);

      // Trigger automatic recalculation of associated PayrollEntry
      if (adj.payroll_entry_id !== undefined && payrollEntries.length > 0) {
        const associatedEntry = payrollEntries.find(
          (entry) => String(entry.id) === String(adj.payroll_entry_id),
        );

        if (associatedEntry) {
          const recalculatedEntry = recalculatePayrollEntryFromAdjustmentDeletion(
            associatedEntry,
            adj,
            !isAlreadyDeleted, // soft deleting vs restoring
          );
          onPayrollEntryRecalculated?.(recalculatedEntry, adj);
        }
      }

      // If inspector is open for this item, update or close it
      if (inspectorAdjustment?.id === adj.id) {
        setInspectorAdjustment((prev) => (prev ? { ...prev, deleted_at: newDeletedAt } : null));
      }
    } catch (err) {
      console.error('Failed to update adjustment delete state:', err);
      alert(
        err instanceof Error
          ? err.message
          : `Failed to ${actionLabel} adjustment. Please try again.`,
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className={`w-full bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden font-['Poppins',sans-serif] text-[#1d1c17] select-none ${className}`}
      data-testid="payroll-adjustments-grid"
    >
      {/* ── Table Toolbar / Options Bar ──────────────────────────────────── */}
      <div className="p-4 border-b border-[#e8e2d8] bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ae001a] text-lg" aria-hidden="true">
            tune
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
            Adjustment Records
          </span>
          <span
            className="px-2 py-0.5 rounded-full bg-red-50 text-[#ae001a] text-[10px] font-bold font-mono ml-1"
            data-testid="adjustments-count-badge"
          >
            {visibleAdjustments.length} {visibleAdjustments.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Show Soft-Deleted */}
          <label className="flex items-center gap-1.5 text-xs text-[#5f5e5e] cursor-pointer hover:text-[#1d1c17]">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              data-testid="toggle-include-deleted-adjustments"
              className="accent-[#ae001a] rounded cursor-pointer w-3.5 h-3.5"
            />
            <span className="text-[11px] font-medium">Show Soft-Deleted</span>
          </label>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={onRefresh ?? fetchAdjustments}
            disabled={activeLoading}
            data-testid="adjustments-refresh-btn"
            title="Refresh adjustment line items"
            className="p-1 text-[#5f5e5e] hover:text-[#ae001a] hover:bg-white rounded transition-colors disabled:opacity-40 cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-lg ${activeLoading ? 'animate-spin' : ''}`}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Adjustments Table View ───────────────────────────────────────── */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#fef9f1] border-b border-[#e8e2d8] text-[10px] font-black uppercase tracking-wider text-[#5f5e5e]">
              <th scope="col" className="py-3 px-4 font-bold">
                ADJUSTMENT ID
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                ENTRY ID
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                COLLABORATOR
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                TYPE
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                DESCRIPTION / REASON
              </th>
              <th scope="col" className="py-3 px-4 font-bold text-right">
                AMOUNT
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                DATE
              </th>
              <th scope="col" className="py-3 px-4 font-bold text-center">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e2d8]">
            {/* Loading Skeleton */}
            {activeLoading && visibleAdjustments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl animate-spin text-[#ae001a]">
                      progress_activity
                    </span>
                    <span className="text-xs font-medium">Loading payroll adjustments...</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty State */}
            {!activeLoading && visibleAdjustments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#8a8880]">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-3xl text-zinc-300">
                      do_not_disturb_on
                    </span>
                    <span className="text-sm font-bold text-[#1d1c17]">
                      No payroll adjustments found
                    </span>
                    <span className="text-[11px] max-w-sm">
                      No bonus compensations or deductions recorded matching the current filter.
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {/* Adjustment Rows */}
            {visibleAdjustments.map((adj) => {
              const isDeleted = isPayrollAdjustmentSoftDeleted(adj);
              const amountInfo = formatAdjustmentAmount(adj.amount, adj.adjustment_type, currency);
              const collaboratorDisplayName =
                adj.collaborator_name ||
                adj.collaborator?.name ||
                (adj.collaborator?.first_name
                  ? `${adj.collaborator.first_name} ${adj.collaborator.last_name || ''}`
                  : `Collaborator #${adj.collaborator_id || '—'}`);

              const isBonus = String(adj.adjustment_type || '').toUpperCase() === 'BONUS';
              const isDeleting = deletingId === adj.id;

              return (
                <tr
                  key={adj.id}
                  onClick={() => handleRowClick(adj)}
                  data-testid={`adjustment-row-${adj.id}`}
                  data-adjustment-type={adj.adjustment_type}
                  className={`group cursor-pointer transition-colors duration-150 ${
                    isDeleted
                      ? 'bg-zinc-50/70 opacity-60 text-zinc-400 line-through'
                      : 'hover:bg-zinc-50/80'
                  }`}
                >
                  {/* Adjustment ID */}
                  <td className="py-3 px-4 font-mono font-bold text-[11px] text-[#1d1c17] whitespace-nowrap">
                    #{adj.id}
                  </td>

                  {/* Payroll Entry ID */}
                  <td className="py-3 px-4 font-mono text-[11px] text-[#5f5e5e] whitespace-nowrap">
                    {adj.payroll_entry_id ? `#${adj.payroll_entry_id}` : '—'}
                  </td>

                  {/* Collaborator */}
                  <td className="py-3 px-4 font-bold text-[#1d1c17] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-[#5f5e5e] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {collaboratorDisplayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[180px]">{collaboratorDisplayName}</span>
                    </div>
                  </td>

                  {/* Type Pill Badge (BONUS in green vs DEDUCTION in amber/red) */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {isBonus ? (
                      <span
                        data-testid={`badge-bonus-${adj.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide uppercase"
                      >
                        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                          trending_up
                        </span>
                        <span>BONUS</span>
                      </span>
                    ) : (
                      <span
                        data-testid={`badge-deduction-${adj.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 tracking-wide uppercase"
                      >
                        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                          trending_down
                        </span>
                        <span>DEDUCTION</span>
                      </span>
                    )}
                  </td>

                  {/* Description / Reason */}
                  <td className="py-3 px-4 text-[#5f5e5e] max-w-[240px] truncate">
                    <span>{adj.description || adj.reason || adj.name || '—'}</span>
                  </td>

                  {/* Amount (Positive Green for BONUS, Negative Amber/Red for DEDUCTION) */}
                  <td className="py-3 px-4 text-right font-black font-mono whitespace-nowrap">
                    <span
                      data-testid={`adjustment-amount-${adj.id}`}
                      className={`text-xs ${
                        isBonus
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {amountInfo.formatted}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 text-[#5f5e5e] text-[11px] whitespace-nowrap">
                    {adj.effective_date
                      ? new Date(adj.effective_date).toLocaleDateString()
                      : adj.created_at
                      ? new Date(adj.created_at).toLocaleDateString()
                      : '—'}
                  </td>

                  {/* Actions: View, Edit, Soft Delete */}
                  <td
                    className="py-3 px-4 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1">
                      {/* View / Inspect */}
                      <button
                        type="button"
                        onClick={() => handleRowClick(adj)}
                        data-testid={`action-inspect-${adj.id}`}
                        title="Inspect adjustment details"
                        className="p-1 text-zinc-400 hover:text-[#ae001a] rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onEditAdjustment?.(adj)}
                        data-testid={`action-edit-${adj.id}`}
                        title="Edit adjustment"
                        className="p-1 text-zinc-400 hover:text-[#ae001a] rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>

                      {/* Soft Delete */}
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteClick(adj, e)}
                        data-testid={`action-delete-${adj.id}`}
                        title={isDeleted ? 'Restore adjustment' : 'Soft-delete adjustment'}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          isDeleted
                            ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            : 'text-zinc-400 hover:text-red-700 hover:bg-red-50'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-base ${
                            isDeleting ? 'animate-spin' : ''
                          }`}
                        >
                          {isDeleted ? 'restore' : 'delete'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Slide-over Detail Inspector Drawer ───────────────────────────── */}
      {isInspectorOpen && inspectorAdjustment && (
        <aside
          role="dialog"
          aria-label="Payroll Adjustment Details"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-[#e8e2d8] flex flex-col justify-between font-['Poppins',sans-serif] animate-in slide-in-from-right duration-200"
          data-testid="adjustment-inspector-drawer"
        >
          <div className="p-6 overflow-y-auto no-scrollbar space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#e8e2d8]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">
                  Adjustment Inspector
                </span>
                <h2 className="text-base font-black text-[#1d1c17] leading-tight">
                  #{inspectorAdjustment.id}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseInspector}
                data-testid="close-adjustment-inspector-btn"
                className="p-1 text-zinc-400 hover:text-[#ae001a] rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Inspector Details List */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                  Collaborator
                </span>
                <span className="text-sm font-bold text-[#1d1c17]">
                  {inspectorAdjustment.collaborator_name ||
                    inspectorAdjustment.collaborator?.name ||
                    `#${inspectorAdjustment.collaborator_id || '—'}`}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                  Associated Payroll Entry
                </span>
                <span className="text-xs font-mono font-bold text-[#1d1c17]">
                  {inspectorAdjustment.payroll_entry_id
                    ? `#${inspectorAdjustment.payroll_entry_id}`
                    : 'Unassigned'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                  Adjustment Type
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      String(inspectorAdjustment.adjustment_type).toUpperCase() === 'BONUS'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {inspectorAdjustment.adjustment_type}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                  Amount
                </span>
                <span
                  className={`text-xl font-black font-mono ${
                    String(inspectorAdjustment.adjustment_type).toUpperCase() === 'BONUS'
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {
                    formatAdjustmentAmount(
                      inspectorAdjustment.amount,
                      inspectorAdjustment.adjustment_type,
                      currency,
                    ).formatted
                  }
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                  Reason / Description
                </span>
                <p className="text-xs text-[#1d1c17] mt-0.5 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                  {inspectorAdjustment.description ||
                    inspectorAdjustment.reason ||
                    'No description provided.'}
                </p>
              </div>

              {inspectorAdjustment.category && (
                <div>
                  <span className="text-[11px] text-[#5f5e5e] font-semibold block uppercase">
                    Category
                  </span>
                  <span className="text-xs font-medium text-[#1d1c17]">
                    {inspectorAdjustment.category}
                  </span>
                </div>
              )}

              {isPayrollAdjustmentSoftDeleted(inspectorAdjustment) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Soft-Deleted Record</span>
                  </div>
                  <p className="text-[11px] mt-0.5">
                    This adjustment is currently excluded from net compensation calculations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Inspector Footer Actions */}
          <div className="p-4 border-t border-[#e8e2d8] bg-zinc-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => onEditAdjustment?.(inspectorAdjustment)}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteClick(inspectorAdjustment, e)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer text-white ${
                isPayrollAdjustmentSoftDeleted(inspectorAdjustment)
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#ae001a] hover:bg-[#8e0015]'
              }`}
            >
              {isPayrollAdjustmentSoftDeleted(inspectorAdjustment) ? 'Restore' : 'Soft Delete'}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
