import React, { useState } from 'react';
import type { PayrollEntriesQuickLaunchProps, PayrollEntry } from './types';
import {
  downloadPayrollSummaryCsv,
  recalculatePayrollEntries,
} from './payroll-entries-helpers';

export const PayrollEntriesQuickLaunch: React.FC<PayrollEntriesQuickLaunchProps> = ({
  entries = [],
  selectedRowIds = [],
  selectedEntries,
  onRecalculateNetPay,
  onBulkAdjustments,
  onExportPayrollSummary,
  onAuditTaxes,
  onEntriesChange,
  isLoading = false,
  exportFilename,
  className = '',
  isPersistent = true,
  children,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Determine effective selected IDs from props
  const effectiveSelectedIds: (string | number)[] =
    selectedEntries !== undefined
      ? selectedEntries.map((e) => e.id)
      : selectedRowIds;

  const hasSelection = effectiveSelectedIds.length > 0;
  const targetCount = hasSelection ? effectiveSelectedIds.length : entries.length;

  // ── [ RE-CALCULATE NET PAY ] Action ────────────────────────────────────────
  const handleRecalculate = () => {
    setIsProcessing(true);
    try {
      const recalculated = recalculatePayrollEntries(
        entries,
        hasSelection ? effectiveSelectedIds : undefined,
      );

      onRecalculateNetPay?.(recalculated);
      onEntriesChange?.(recalculated);

      setFeedbackMessage(
        `Recalculated gross & net pay formulas for ${targetCount} ${
          targetCount === 1 ? 'record' : 'records'
        }.`,
      );
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Failed to recalculate payroll entries:', err);
      setFeedbackMessage('Failed to recalculate net pay formulas.');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── [ EXPORT PAYROLL SUMMARY ] Action ──────────────────────────────────────
  const handleExport = () => {
    setIsProcessing(true);
    try {
      const targetEntries: PayrollEntry[] =
        hasSelection && selectedEntries !== undefined
          ? selectedEntries
          : hasSelection
          ? entries.filter(
              (e) =>
                effectiveSelectedIds.includes(e.id) ||
                (e.entry_id !== undefined && effectiveSelectedIds.includes(e.entry_id)),
            )
          : entries;

      const filename =
        exportFilename ||
        `payroll_summary_${new Date().toISOString().slice(0, 10)}.csv`;

      const csvContent = downloadPayrollSummaryCsv(targetEntries, filename);
      onExportPayrollSummary?.(csvContent);

      setFeedbackMessage(
        `Exported ${targetEntries.length} payroll line items to ${filename}.`,
      );
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export payroll summary:', err);
      setFeedbackMessage('Failed to generate payroll summary export.');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isLoading || isProcessing;

  // Persistence: Positioned directly above the fixed NavHub footer (which resides at bottom-0, height ~46px)
  const positionClass = isPersistent
    ? 'sticky bottom-12 sm:bottom-[46px] z-30'
    : 'relative';

  return (
    <aside
      aria-label="Payroll Entries Quick Launch Bar"
      data-testid="payroll-entries-quick-launch"
      className={`${positionClass} w-full font-['Poppins',sans-serif] ${className}`}
    >
      <div className="bg-[#1d1c17] text-white border-t-2 border-[#ae001a] sm:border sm:border-zinc-800 p-3.5 sm:px-5 sm:py-3 rounded-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3.5 transition-all duration-200">
        {/* Left Info: Target Scope & Quick Launch Identity */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-lg text-[#ae001a]"
              aria-hidden="true"
            >
              bolt
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              Payroll Actions
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700 hidden sm:block" aria-hidden="true" />

          {/* Operational Scope Indicator */}
          <div className="flex items-center gap-2">
            <span
              data-testid="quick-launch-scope-badge"
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                hasSelection
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {hasSelection
                ? `${effectiveSelectedIds.length} Selected`
                : `${entries.length} Line Items`}
            </span>

            {feedbackMessage && (
              <span
                data-testid="quick-launch-feedback-msg"
                role="status"
                aria-live="polite"
                className="text-[11px] font-semibold text-emerald-400 animate-in fade-in duration-200 truncate max-w-xs"
              >
                {feedbackMessage}
              </span>
            )}
          </div>
        </div>

        {/* Right Actions: 4 Primary Operational Shortcuts */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end w-full md:w-auto">
          {/* Action 1: [ RE-CALCULATE NET PAY ] */}
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={busy || entries.length === 0}
            data-testid="quick-action-recalculate"
            title="Recalculate gross and net compensation formulas for line items"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200 ${
                busy ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            >
              calculate
            </span>
            <span>RE-CALCULATE NET PAY</span>
          </button>

          {/* Action 2: [ BULK ADJUSTMENTS ] */}
          <button
            type="button"
            onClick={onBulkAdjustments}
            disabled={busy}
            data-testid="quick-action-bulk-adjustments"
            title="Open bulk adjustments drawer for selected or all records"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              tune
            </span>
            <span>BULK ADJUSTMENTS</span>
          </button>

          {/* Action 3: [ EXPORT PAYROLL SUMMARY ] */}
          <button
            type="button"
            onClick={handleExport}
            disabled={busy || entries.length === 0}
            data-testid="quick-action-export-summary"
            title="Export payroll dataset summary to CSV/Excel format"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              download
            </span>
            <span>EXPORT PAYROLL SUMMARY</span>
          </button>

          {/* Action 4: [ AUDIT TAXES ] */}
          <button
            type="button"
            onClick={onAuditTaxes}
            disabled={busy}
            data-testid="quick-action-audit-taxes"
            title="Run statutory tax withholdings audit"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              verified_user
            </span>
            <span>AUDIT TAXES</span>
          </button>

          {/* Custom actions slot */}
          {children}
        </div>
      </div>
    </aside>
  );
};
