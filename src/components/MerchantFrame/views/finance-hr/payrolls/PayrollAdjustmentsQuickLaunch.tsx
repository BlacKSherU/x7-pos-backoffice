import React, { useRef, useState } from 'react';
import type {
  PayrollAdjustment,
  PayrollAdjustmentsQuickLaunchProps,
} from './types';
import {
  downloadAdjustmentsReportCsv,
  resyncPayrollEntriesWithAdjustments,
} from './payroll-entries-helpers';

export type * from './types';

export const PayrollAdjustmentsQuickLaunch: React.FC<
  PayrollAdjustmentsQuickLaunchProps
> = ({
  adjustments = [],
  payrollEntries = [],
  selectedRowIds = [],
  selectedAdjustments,
  onApplyBulkBonus,
  onImportDeductionsCsv,
  onReSyncWithEntries,
  onAdjustmentReport,
  onEntriesChange,
  isLoading = false,
  reportFilename,
  className = '',
  isPersistent = true,
  children,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine effective selected adjustment IDs
  const effectiveSelectedIds: (string | number)[] =
    selectedAdjustments !== undefined
      ? selectedAdjustments.map((a) => a.id)
      : selectedRowIds;

  const hasSelection = effectiveSelectedIds.length > 0;
  const targetCount = hasSelection ? effectiveSelectedIds.length : adjustments.length;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // ── [ APPLY BULK BONUS ] Action ──────────────────────────────────────────
  const handleBulkBonus = () => {
    onApplyBulkBonus?.();
    showFeedback('Opened bulk bonus batch application workspace.');
  };

  // ── [ IMPORT DEDUCTIONS CSV ] Action ────────────────────────────────────
  const handleImportTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      onImportDeductionsCsv?.();
      showFeedback('Deduction CSV import dialog initiated.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportDeductionsCsv?.(file);
      showFeedback(`Importing deductions from ${file.name}...`);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  // ── [ RE-SYNC WITH ENTRIES ] Action ──────────────────────────────────────
  const handleReSync = () => {
    setIsProcessing(true);
    try {
      const recalculated = resyncPayrollEntriesWithAdjustments(
        payrollEntries,
        adjustments,
      );

      onReSyncWithEntries?.(recalculated);
      onEntriesChange?.(recalculated);

      showFeedback(
        `Re-synced ${recalculated.length} payroll entries with current adjustments.`,
      );
    } catch (err) {
      console.error('Failed to re-sync adjustments with entries:', err);
      showFeedback('Failed to re-sync adjustments with payroll entries.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── [ ADJUSTMENT REPORT ] Action ────────────────────────────────────────
  const handleReport = () => {
    setIsProcessing(true);
    try {
      const targetAdjustments: PayrollAdjustment[] =
        hasSelection && selectedAdjustments !== undefined
          ? selectedAdjustments
          : hasSelection
          ? adjustments.filter((a) => effectiveSelectedIds.includes(a.id))
          : adjustments;

      const filename =
        reportFilename ||
        `payroll_adjustments_report_${new Date().toISOString().slice(0, 10)}.csv`;

      const csvContent = downloadAdjustmentsReportCsv(targetAdjustments, filename);
      onAdjustmentReport?.(csvContent);

      showFeedback(
        `Generated adjustments report with ${targetAdjustments.length} records.`,
      );
    } catch (err) {
      console.error('Failed to generate adjustments report:', err);
      showFeedback('Failed to generate adjustment report.');
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isLoading || isProcessing;

  // Persistent positioning directly above footer (NavHub footer height ~46px)
  const positionClass = isPersistent
    ? 'sticky bottom-12 sm:bottom-[46px] z-30'
    : 'relative';

  return (
    <aside
      aria-label="Payroll Adjustments Quick Launch Bar"
      data-testid="payroll-adjustments-quick-launch"
      className={`${positionClass} w-full font-['Poppins',sans-serif] ${className}`}
    >
      {/* Hidden file input for deductions CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        data-testid="deductions-file-input"
        className="hidden"
        aria-hidden="true"
      />

      <div className="bg-[#1d1c17] text-white border-t-2 border-[#ae001a] sm:border sm:border-zinc-800 p-3.5 sm:px-5 sm:py-3 rounded-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3.5 transition-all duration-200">
        {/* Left Info: Scope & Identity */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-lg text-[#ae001a]"
              aria-hidden="true"
            >
              tune
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              Adjustment Operations
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700 hidden sm:block" aria-hidden="true" />

          {/* Operational Scope Indicator */}
          <div className="flex items-center gap-2">
            <span
              data-testid="adjustments-quick-launch-scope-badge"
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                hasSelection
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {hasSelection
                ? `${effectiveSelectedIds.length} Selected`
                : `${adjustments.length} Adjustments`}
            </span>

            {feedbackMessage && (
              <span
                data-testid="adjustments-feedback-msg"
                role="status"
                aria-live="polite"
                className="text-[11px] font-semibold text-emerald-400 animate-in fade-in duration-200 truncate max-w-xs"
              >
                {feedbackMessage}
              </span>
            )}
          </div>
        </div>

        {/* Right Actions: 4 Primary Operational Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end w-full md:w-auto">
          {/* Action 1: [ APPLY BULK BONUS ] */}
          <button
            type="button"
            onClick={handleBulkBonus}
            disabled={busy}
            data-testid="quick-action-bulk-bonus"
            title="Execute batch bonus compensation across collaborators"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              auto_awesome
            </span>
            <span>APPLY BULK BONUS</span>
          </button>

          {/* Action 2: [ IMPORT DEDUCTIONS CSV ] */}
          <button
            type="button"
            onClick={handleImportTrigger}
            disabled={busy}
            data-testid="quick-action-import-deductions"
            title="Upload CSV spreadsheet to batch import employee deductions"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              upload_file
            </span>
            <span>IMPORT DEDUCTIONS CSV</span>
          </button>

          {/* Action 3: [ RE-SYNC WITH ENTRIES ] */}
          <button
            type="button"
            onClick={handleReSync}
            disabled={busy}
            data-testid="quick-action-resync-entries"
            title="Force recalculation of PayrollEntry.bonuses and deductions"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200 ${
                busy ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            >
              sync
            </span>
            <span>RE-SYNC WITH ENTRIES</span>
          </button>

          {/* Action 4: [ ADJUSTMENT REPORT ] */}
          <button
            type="button"
            onClick={handleReport}
            disabled={busy || targetCount === 0}
            data-testid="quick-action-adjustment-report"
            title="Export CSV audit report containing active payroll adjustments"
            className="group px-3.5 py-2 bg-zinc-800 hover:bg-[#ae001a] disabled:hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg border border-zinc-700 hover:border-[#ae001a] transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md"
          >
            <span
              className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-white transition-colors duration-200"
              aria-hidden="true"
            >
              assessment
            </span>
            <span>ADJUSTMENT REPORT</span>
          </button>

          {children}
        </div>
      </div>
    </aside>
  );
};
