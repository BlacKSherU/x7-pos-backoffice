import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, unwrapList, type MaybeEnvelopedList } from '@/shared/api/http';
import type {
  PayrollEntriesGridProps,
  PayrollEntry,
} from './types';
import {
  formatCurrency,
  getPayrollCollaboratorName,
  getPayrollEntryIdentifier,
  isPayrollEntrySoftDeleted,
  parseMonetaryValue,
  verifyPayrollEntryCalculations,
} from './payroll-entries-helpers';

export const PayrollEntriesGrid: React.FC<PayrollEntriesGridProps> = ({
  payrollRunId,
  entries: propEntries,
  searchQuery = '',
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  onEntriesChange,
  onRefresh,
  isLoading: propIsLoading,
  includeDeleted: initialIncludeDeleted = false,
  currency = 'USD',
  className = '',
}) => {
  const [internalEntries, setInternalEntries] = useState<PayrollEntry[]>(propEntries ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(initialIncludeDeleted);

  // Inspector State
  const [inspectorEntry, setInspectorEntry] = useState<PayrollEntry | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Soft-delete action state
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // Synchronize internal entries with external prop when provided
  useEffect(() => {
    if (propEntries !== undefined) {
      setInternalEntries(propEntries);
    }
  }, [propEntries]);

  // Data Hydration: GET /payroll-entries?payroll_run_id={id}
  const fetchEntries = useCallback(async (runId: string | number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<MaybeEnvelopedList<PayrollEntry>>(
        `/payroll-entries?payroll_run_id=${encodeURIComponent(runId)}&limit=100`,
        { method: 'GET' },
        'Failed to retrieve payroll entries for this pay run.',
      );
      const list = unwrapList(response);
      setInternalEntries(list);
      onEntriesChange?.(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load employee payroll entries. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [onEntriesChange]);

  useEffect(() => {
    // Only hydrate from API if run ID is provided and no explicit entries were injected
    if (payrollRunId !== undefined && propEntries === undefined) {
      void fetchEntries(payrollRunId);
    }
  }, [payrollRunId, propEntries, fetchEntries]);

  const activeLoading = propIsLoading ?? loading;

  // Filter out soft-deleted records by default (deleted_at !== null)
  const visibleEntries = useMemo(() => {
    let dataset = internalEntries;

    if (!includeDeleted) {
      dataset = dataset.filter((entry) => !isPayrollEntrySoftDeleted(entry));
    }

    const term = searchQuery.trim().toLowerCase();
    if (term) {
      dataset = dataset.filter((entry) => {
        const name = getPayrollCollaboratorName(entry).toLowerCase();
        const id = getPayrollEntryIdentifier(entry).toLowerCase();
        const colId = entry.collaborator_id ? String(entry.collaborator_id).toLowerCase() : '';
        return name.includes(term) || id.includes(term) || colId.includes(term);
      });
    }

    return dataset;
  }, [includeDeleted, internalEntries, searchQuery]);

  // Row Inspection Handler
  const handleRowClick = (entry: PayrollEntry) => {
    setInspectorEntry(entry);
    setIsInspectorOpen(true);
    onSelectEntry?.(entry);
  };

  const handleCloseInspector = () => {
    setIsInspectorOpen(false);
    setInspectorEntry(null);
  };

  // Logical Soft Delete Handler (deleted_at !== null)
  const handleSoftDelete = async (
    e: React.MouseEvent,
    entry: PayrollEntry,
  ) => {
    e.stopPropagation(); // Avoid triggering row inspector click

    const confirmDelete = window.confirm(
      `Are you sure you want to soft-delete payroll entry #${entry.id} for ${
        getPayrollCollaboratorName(entry) || 'employee'
      }? Historical payroll audit trail will be preserved.`,
    );
    if (!confirmDelete) return;

    setDeletingId(entry.id);
    const timestamp = new Date().toISOString();

    try {
      if (onDeleteEntry) {
        await onDeleteEntry(entry);
      } else if (payrollRunId !== undefined) {
        // Attempt standard REST soft-delete
        await apiRequest(
          `/payroll-entries/${entry.id}`,
          {
            method: 'DELETE',
          },
          'Failed to soft-delete payroll entry.',
        );
      }

      // Mark as soft deleted in state
      const updated = internalEntries.map((item) =>
        item.id === entry.id ? { ...item, deleted_at: timestamp } : item,
      );
      setInternalEntries(updated);
      onEntriesChange?.(updated);

      // If inspector is open for this entry, close it
      if (inspectorEntry?.id === entry.id) {
        setIsInspectorOpen(false);
        setInspectorEntry(null);
      }
    } catch (err) {
      console.error('Failed to soft-delete entry:', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to soft delete the payroll record. Please try again.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className={`relative w-full max-w-full font-['Poppins',sans-serif] text-[#1d1c17] ${className}`}
      data-testid="payroll-entries-grid"
    >
      {/* ── Table Top Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#e8e2d8] border-b-0 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-red-50 text-[#ae001a] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              table_chart
            </span>
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-[#1d1c17]">
              Payroll Line Items
            </h2>
            <p className="text-[11px] text-[#5f5e5e]">
              Detailed gross, tax withholdings, and net calculations per employee
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle Soft-Deleted Records */}
          <label className="flex items-center gap-2 text-xs font-semibold text-[#5f5e5e] cursor-pointer hover:text-[#ae001a] transition-colors select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              data-testid="toggle-include-deleted"
              className="accent-[#ae001a] rounded cursor-pointer"
            />
            <span>Show Soft-Deleted</span>
          </label>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => {
              if (onRefresh) {
                onRefresh();
              } else if (payrollRunId !== undefined) {
                void fetchEntries(payrollRunId);
              }
            }}
            data-testid="refresh-payroll-grid-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-200 border border-[#e8e2d8] hover:border-[#ae001a] rounded-lg text-xs font-bold text-[#1d1c17] transition-all duration-200 cursor-pointer"
            title="Refresh grid records"
          >
            <span
              className={`material-symbols-outlined text-sm ${activeLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            >
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border-x border-[#e8e2d8] border-rose-200 flex items-center justify-between text-xs text-rose-800 font-medium"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600 text-base" aria-hidden="true">
              error
            </span>
            <span>{error}</span>
          </div>
          {payrollRunId !== undefined && (
            <button
              type="button"
              onClick={() => void fetchEntries(payrollRunId)}
              className="underline uppercase font-bold text-rose-900 hover:text-rose-950"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Structured Data Grid ─────────────────────────────────────────── */}
      <div className="overflow-x-auto w-full border border-[#e8e2d8] rounded-b-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#fcfaf7] border-b border-[#e8e2d8] select-none">
            <tr>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] whitespace-nowrap">
                Employee
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Base Pay
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Overtime
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Tips
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Bonuses
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Deductions
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Gross Total
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-right whitespace-nowrap">
                Tax
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#ae001a] text-right whitespace-nowrap">
                Net Total
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-center whitespace-nowrap">
                Audit
              </th>
              <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] text-center whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#f2efe9]" data-testid="payroll-entries-tbody">
            {activeLoading ? (
              // Skeleton loading rows
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`loading-row-${idx}`} className="animate-pulse bg-white">
                  {Array.from({ length: 11 }).map((_, c) => (
                    <td key={`c-${c}`} className="px-4 py-4">
                      <div className="h-3.5 bg-zinc-200 rounded w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleEntries.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-[#5f5e5e]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span
                      className="material-symbols-outlined text-4xl text-zinc-400"
                      aria-hidden="true"
                    >
                      inbox
                    </span>
                    <p className="text-sm font-bold text-[#1d1c17]">No payroll entries found</p>
                    <p className="text-xs text-[#8a8880] max-w-md">
                      {searchQuery
                        ? 'No active records match the current search query. Try clearing your search filters.'
                        : 'There are no active employee compensation records for this payroll run.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Rows
              visibleEntries.map((entry) => {
                const verification = verifyPayrollEntryCalculations(entry);
                const softDeleted = isPayrollEntrySoftDeleted(entry);
                const collaboratorName = getPayrollCollaboratorName(entry) || 'Unnamed Employee';
                const entryId = getPayrollEntryIdentifier(entry);

                const otPay = parseMonetaryValue(entry.overtime_pay);
                const dotPay = parseMonetaryValue(entry.double_overtime_pay);
                const totalOvertime = otPay + dotPay;

                const tipsValue = parseMonetaryValue(entry.tips_amount ?? entry.tips);
                const bonusesValue = parseMonetaryValue(entry.bonuses);
                const deductionsValue = parseMonetaryValue(entry.deductions);
                const baseValue = parseMonetaryValue(entry.base_pay);
                const grossValue = parseMonetaryValue(entry.gross_total);
                const taxValue = parseMonetaryValue(entry.tax_total);
                const netValue = parseMonetaryValue(entry.net_total);

                return (
                  <tr
                    key={entry.id}
                    data-testid={`payroll-entry-row-${entry.id}`}
                    onClick={() => handleRowClick(entry)}
                    className={`group transition-colors duration-150 cursor-pointer ${
                      softDeleted
                        ? 'bg-zinc-50 opacity-60 hover:opacity-100'
                        : 'hover:bg-[#fcfaf7]'
                    } ${inspectorEntry?.id === entry.id ? 'bg-[#f7f2eb]' : ''}`}
                  >
                    {/* Employee Collaborator */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1d1c17] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          <span
                            className="material-symbols-outlined text-sm font-normal"
                            aria-hidden="true"
                          >
                            person
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#1d1c17] truncate max-w-[150px] sm:max-w-[200px]">
                            {collaboratorName}
                          </div>
                          <div className="text-[10px] text-[#5f5e5e] font-mono flex items-center gap-1.5">
                            <span>ID: #{entryId}</span>
                            {entry.collaborator_id && (
                              <span className="text-[#8a8880]">
                                • Collab #{entry.collaborator_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Base Pay */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-zinc-900 whitespace-nowrap"
                      data-testid={`base-pay-${entry.id}`}
                    >
                      {formatCurrency(baseValue, currency)}
                    </td>

                    {/* Overtime (1.5x + 2.0x) */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-zinc-900 whitespace-nowrap"
                      data-testid={`overtime-pay-${entry.id}`}
                      title={`Regular OT: ${formatCurrency(otPay, currency)}, Double OT: ${formatCurrency(
                        dotPay,
                        currency,
                      )}`}
                    >
                      {formatCurrency(totalOvertime, currency)}
                    </td>

                    {/* Tips */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-zinc-900 whitespace-nowrap"
                      data-testid={`tips-${entry.id}`}
                    >
                      {formatCurrency(tipsValue, currency)}
                    </td>

                    {/* Bonuses */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-zinc-900 whitespace-nowrap"
                      data-testid={`bonuses-${entry.id}`}
                    >
                      {formatCurrency(bonusesValue, currency)}
                    </td>

                    {/* Deductions */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-rose-700 whitespace-nowrap"
                      data-testid={`deductions-${entry.id}`}
                    >
                      {deductionsValue > 0
                        ? `-${formatCurrency(deductionsValue, currency)}`
                        : formatCurrency(0, currency)}
                    </td>

                    {/* Gross Total */}
                    <td
                      className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900 whitespace-nowrap"
                      data-testid={`gross-total-${entry.id}`}
                    >
                      {formatCurrency(grossValue, currency)}
                    </td>

                    {/* Tax */}
                    <td
                      className="px-4 py-3.5 text-right font-mono text-rose-800 whitespace-nowrap"
                      data-testid={`tax-total-${entry.id}`}
                    >
                      {taxValue > 0
                        ? `-${formatCurrency(taxValue, currency)}`
                        : formatCurrency(0, currency)}
                    </td>

                    {/* Net Total */}
                    <td
                      className="px-4 py-3.5 text-right font-mono font-black text-emerald-700 whitespace-nowrap text-sm"
                      data-testid={`net-total-${entry.id}`}
                    >
                      {formatCurrency(netValue, currency)}
                    </td>

                    {/* Mathematical Calculation Verification */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {softDeleted ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-700 font-mono"
                          data-testid={`soft-deleted-badge-${entry.id}`}
                        >
                          DELETED
                        </span>
                      ) : verification.isValid ? (
                        <span
                          data-testid={`verification-badge-${entry.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                          title="Verified: Gross & Net balance matches formula."
                        >
                          <span
                            className="material-symbols-outlined text-[13px] text-emerald-600 font-bold"
                            aria-hidden="true"
                          >
                            check_circle
                          </span>
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span
                          data-testid={`discrepancy-badge-${entry.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
                          title={verification.discrepancyReason}
                        >
                          <span
                            className="material-symbols-outlined text-[13px] text-rose-600 font-bold"
                            aria-hidden="true"
                          >
                            warning
                          </span>
                          <span>Audit</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* View / Inspect Row */}
                        <button
                          type="button"
                          onClick={() => handleRowClick(entry)}
                          data-testid={`inspect-entry-btn-${entry.id}`}
                          aria-label={`Inspect payroll entry ${entry.id}`}
                          className="p-1 rounded text-zinc-600 hover:text-[#ae001a] hover:bg-zinc-100 transition-colors cursor-pointer"
                          title="Inspect detailed compensation line items"
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            visibility
                          </span>
                        </button>

                        {/* Edit Action */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEntry?.(entry);
                          }}
                          data-testid={`edit-entry-btn-${entry.id}`}
                          aria-label={`Edit payroll entry ${entry.id}`}
                          className="p-1 rounded text-zinc-600 hover:text-[#ae001a] hover:bg-zinc-100 transition-colors cursor-pointer"
                          title="Edit employee payroll calculations"
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            edit
                          </span>
                        </button>

                        {/* Soft Delete Action */}
                        {!softDeleted && (
                          <button
                            type="button"
                            onClick={(e) => handleSoftDelete(e, entry)}
                            data-testid={`delete-entry-btn-${entry.id}`}
                            aria-label={`Soft-delete payroll entry ${entry.id}`}
                            disabled={deletingId === entry.id}
                            className="p-1 rounded text-zinc-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="Soft-delete payroll entry"
                          >
                            <span
                              className="material-symbols-outlined text-base"
                              aria-hidden="true"
                            >
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Slide-Out Row Detail Inspector ─────────────────────────────────── */}
      {isInspectorOpen && inspectorEntry && (
        <aside
          role="dialog"
          aria-label="Payroll Entry Line Item Inspector"
          data-testid="payroll-entry-inspector"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#e8e2d8] shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="p-5 border-b border-[#e8e2d8] flex items-center justify-between bg-[#fcfaf7]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#ae001a] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  person
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-[#1d1c17] uppercase tracking-wider">
                  {getPayrollCollaboratorName(inspectorEntry) || 'Employee Payroll Detail'}
                </h3>
                <p className="text-[11px] text-[#5f5e5e] font-mono">
                  Entry #{inspectorEntry.id} • Run #{inspectorEntry.payroll_run_id ?? payrollRunId ?? 'N/A'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseInspector}
              data-testid="close-inspector-btn"
              aria-label="Close detail inspector"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-[#1d1c17] hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          {/* Inspector Content */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Mathematical Verification Alert Box */}
            {(() => {
              const v = verifyPayrollEntryCalculations(inspectorEntry);
              return (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    v.isValid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                  data-testid="inspector-verification-card"
                >
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                    <span
                      className="material-symbols-outlined text-base"
                      aria-hidden="true"
                    >
                      {v.isValid ? 'verified' : 'warning'}
                    </span>
                    <span>
                      {v.isValid ? 'Calculation Audit Verified' : 'Calculation Discrepancy Found'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {v.isValid
                      ? 'Formula gross_total === base + ot + tips + bonuses - deductions and net_total === gross - tax validated.'
                      : v.discrepancyReason}
                  </p>
                </div>
              );
            })()}

            {/* Compensation Breakdown Grid */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#5f5e5e] block border-b border-[#e8e2d8] pb-1">
                Line Item Compensation Breakdown
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Base Pay
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.base_pay, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Overtime Pay
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.overtime_pay, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Double Overtime Pay
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.double_overtime_pay ?? 0, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Tips Amount
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.tips_amount ?? inspectorEntry.tips ?? 0, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Bonuses
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.bonuses ?? 0, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Deductions
                  </span>
                  <span className="font-mono font-bold text-sm text-rose-700">
                    -{formatCurrency(inspectorEntry.deductions ?? 0, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Gross Total
                  </span>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {formatCurrency(inspectorEntry.gross_total ?? 0, currency)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className="text-[10px] text-[#5f5e5e] font-semibold block uppercase">
                    Tax Withholdings
                  </span>
                  <span className="font-mono font-bold text-sm text-rose-800">
                    -{formatCurrency(inspectorEntry.tax_total ?? 0, currency)}
                  </span>
                </div>
              </div>

              {/* Net Total Summary Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                    Net Take-Home Total
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-800">
                    {formatCurrency(inspectorEntry.net_total, currency)}
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-2xl text-emerald-700"
                  aria-hidden="true"
                >
                  payments
                </span>
              </div>
            </div>

            {/* Timestamps & Audit Trail */}
            <div className="space-y-1.5 pt-2 border-t border-[#e8e2d8] text-[11px] text-[#5f5e5e] font-mono">
              <div>Created: {inspectorEntry.created_at ?? 'N/A'}</div>
              {inspectorEntry.deleted_at && (
                <div className="text-rose-700 font-bold">
                  Soft-deleted at: {inspectorEntry.deleted_at}
                </div>
              )}
            </div>
          </div>

          {/* Inspector Footer Actions */}
          <div className="p-4 border-t border-[#e8e2d8] flex items-center justify-between gap-3 bg-[#fcfaf7]">
            <button
              type="button"
              onClick={() => {
                onEditEntry?.(inspectorEntry);
                setIsInspectorOpen(false);
              }}
              data-testid="inspector-edit-btn"
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-lg border border-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                edit
              </span>
              <span>Edit Record</span>
            </button>

            {!isPayrollEntrySoftDeleted(inspectorEntry) && (
              <button
                type="button"
                onClick={(e) => handleSoftDelete(e, inspectorEntry)}
                data-testid="inspector-delete-btn"
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs uppercase tracking-wider rounded-lg border border-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  delete
                </span>
                <span>Soft Delete</span>
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

