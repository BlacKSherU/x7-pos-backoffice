import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { PayrollAdjustment, PayrollAdjustmentType, PayrollEntry } from './types';
import { formatCurrency, parseMonetaryValue } from './payroll-entries-helpers';
import { apiRequest } from '@/shared/api/http';

export interface NewPayrollAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (newAdjustment: PayrollAdjustment) => void;
  payrollRunId?: string | number;
  payrollEntries?: PayrollEntry[];
  currency?: string;
}

const COMMON_CATEGORIES = [
  'Performance Bonus',
  'Sales Commission',
  'Staff Advance',
  'Uniform / Equipment Fee',
  'Discretionary Bonus',
  'Attendance Incentive',
  'Meal Deduction',
  'Other Adjustment',
];

const EMPTY_ENTRIES: PayrollEntry[] = [];

export const NewPayrollAdjustmentModal: React.FC<NewPayrollAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  payrollRunId = 1,
  payrollEntries = EMPTY_ENTRIES,
  currency = 'USD',
}) => {
  const [adjustmentType, setAdjustmentType] = useState<PayrollAdjustmentType>('BONUS');
  const [collaboratorName, setCollaboratorName] = useState('');
  const [payrollEntryId, setPayrollEntryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [availableEntries, setAvailableEntries] = useState<PayrollEntry[]>(payrollEntries);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form and sync/fetch entries when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setAdjustmentType('BONUS');
    setCollaboratorName('');
    setPayrollEntryId('');
    setAmount('');
    setDescription('');
    setCategory(COMMON_CATEGORIES[0]);
    setErrorMessage(null);
    setIsSubmitting(false);

    if (payrollEntries.length > 0) {
      setAvailableEntries(payrollEntries);
      setPayrollEntryId(String(payrollEntries[0].id));
      setCollaboratorName(payrollEntries[0].collaborator_name || `Collaborator #${payrollEntries[0].collaborator_id}`);
    } else {
      const loadEntries = async () => {
        try {
          const promise = apiRequest<{ data?: PayrollEntry[] } | PayrollEntry[]>(
            `/payroll-entries?payroll_run_id=${encodeURIComponent(payrollRunId)}&limit=100`,
            { method: 'GET' },
            'Failed to load entries',
          );
          if (promise && typeof promise.then === 'function') {
            const res = await promise;
            const list = Array.isArray(res) ? res : res?.data ?? [];
            setAvailableEntries(list);
            if (list.length > 0) {
              setPayrollEntryId(String(list[0].id));
              setCollaboratorName(list[0].collaborator_name || `Collaborator #${list[0].collaborator_id}`);
            }
          }
        } catch {
          // ignore
        }
      };
      void loadEntries();
    }
  }, [isOpen, payrollEntries, payrollRunId]);

  const numericAmount = useMemo(() => parseMonetaryValue(amount), [amount]);

  if (!isOpen) return null;

  const handleEntrySelect = (entryId: string) => {
    setPayrollEntryId(entryId);
    const matched = availableEntries.find((e) => String(e.id) === entryId);
    if (matched?.collaborator_name) {
      setCollaboratorName(matched.collaborator_name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = collaboratorName.trim();
    if (!trimmedName && !payrollEntryId) {
      setErrorMessage('Please specify the collaborator name or select a payroll entry.');
      return;
    }

    if (numericAmount <= 0) {
      setErrorMessage('Please enter an adjustment amount greater than 0.');
      return;
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setErrorMessage('Please enter a description or reason for this adjustment.');
      return;
    }

    const finalEntryId = Number(payrollEntryId) || (availableEntries.length > 0 ? Number(availableEntries[0].id) : 1);
    const backendAdjustmentType = adjustmentType === 'BONUS' ? 'bonus' : 'deduction';
    const backendAmount = adjustmentType === 'BONUS' ? numericAmount : -numericAmount;

    setIsSubmitting(true);

    const payload = {
      payroll_entry_id: finalEntryId,
      adjustment_type: backendAdjustmentType,
      amount: backendAmount,
      description: trimmedDesc,
    };

    try {
      const res = await apiRequest<{ data?: PayrollAdjustment } | PayrollAdjustment>(
        '/payroll-adjustments',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        'Failed to persist adjustment to server.',
      );

      const responseAdj = ((res && 'data' in res && res.data ? res.data : res) || {}) as PayrollAdjustment;
      const matchedEntry = availableEntries.find((e) => String(e.id) === String(finalEntryId));
      const displayName =
        trimmedName ||
        matchedEntry?.collaborator_name ||
        (matchedEntry?.collaborator_id ? `Collaborator #${matchedEntry.collaborator_id}` : `Entry #${finalEntryId}`);

      const createdAdjustment: PayrollAdjustment = {
        ...responseAdj,
        id: responseAdj.id ?? `ADJ-${Date.now()}`,
        payroll_entry_id: finalEntryId,
        adjustment_type: adjustmentType,
        amount: numericAmount,
        description: trimmedDesc,
        category,
        collaborator_name: displayName,
        created_at: responseAdj.created_at || new Date().toISOString(),
        deleted_at: null,
      };

      onSave?.(createdAdjustment);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while creating adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-payroll-adjustment-title"
      data-testid="new-payroll-adjustment-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-['Poppins',sans-serif] animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[580px] bg-white border border-[#e8e2d8] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e2d8] bg-[#fbfaf8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#ae001a] border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl font-bold" aria-hidden="true">
                tune
              </span>
            </div>
            <div>
              <h2
                id="new-payroll-adjustment-title"
                className="text-base sm:text-lg font-black text-[#1d1c17] tracking-tight uppercase leading-tight"
              >
                NEW PAYROLL ADJUSTMENT
              </h2>
              <p className="text-xs text-[#5f5e5e] font-normal mt-0.5">
                Apply a discretionary bonus or manual deduction to Payroll Run #{payrollRunId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            data-testid="close-modal-btn"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#ae001a] hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* ── Modal Form Body ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-[#ae001a] text-xs font-semibold rounded-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Adjustment Type Segmented Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-2">
              Adjustment Type <span className="text-[#ae001a]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Adjustment Type">
              {/* BONUS Option */}
              <button
                type="button"
                role="radio"
                aria-checked={adjustmentType === 'BONUS'}
                data-testid="type-option-bonus"
                onClick={() => setAdjustmentType('BONUS')}
                className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  adjustmentType === 'BONUS'
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-xs'
                    : 'border-[#e8e2d8] bg-white text-zinc-500 hover:border-zinc-300'
                }`}
              >
                <span className="material-symbols-outlined text-lg text-emerald-600">trending_up</span>
                <span>BONUS (Addition)</span>
              </button>

              {/* DEDUCTION Option */}
              <button
                type="button"
                role="radio"
                aria-checked={adjustmentType === 'DEDUCTION'}
                data-testid="type-option-deduction"
                onClick={() => setAdjustmentType('DEDUCTION')}
                className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  adjustmentType === 'DEDUCTION'
                    ? 'border-[#ae001a] bg-red-50/80 text-[#ae001a] shadow-xs'
                    : 'border-[#e8e2d8] bg-white text-zinc-500 hover:border-zinc-300'
                }`}
              >
                <span className="material-symbols-outlined text-lg text-[#ae001a]">trending_down</span>
                <span>DEDUCTION (Subtr.)</span>
              </button>
            </div>
          </div>

          {/* Association with existing Entry */}
          {availableEntries.length > 0 && (
            <div>
              <label
                htmlFor="select-payroll-entry"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Attach to Payroll Entry <span className="text-[#ae001a]">*</span>
              </label>
              <select
                id="select-payroll-entry"
                value={payrollEntryId}
                onChange={(e) => handleEntrySelect(e.target.value)}
                data-testid="select-payroll-entry"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              >
                <option value="">-- Select an active payroll entry --</option>
                {availableEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    #{entry.id} - {entry.collaborator_name ?? `Collaborator #${entry.collaborator_id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Collaborator Name */}
          <div>
            <label
              htmlFor="adj-collaborator-name"
              className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
            >
              Collaborator Full Name <span className="text-[#ae001a]">*</span>
            </label>
            <input
              id="adj-collaborator-name"
              type="text"
              required
              placeholder="e.g. Maria Gomez"
              value={collaboratorName}
              onChange={(e) => setCollaboratorName(e.target.value)}
              data-testid="input-adj-collaborator-name"
              className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
            />
          </div>

          {/* Amount and Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label
                htmlFor="adj-amount"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Adjustment Amount ($) <span className="text-[#ae001a]">*</span>
              </label>
              <input
                id="adj-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-adj-amount"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Category / Reason Tag */}
            <div>
              <label
                htmlFor="adj-category"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Category
              </label>
              <select
                id="adj-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="select-adj-category"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="adj-description"
              className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
            >
              Description / Audit Reason <span className="text-[#ae001a]">*</span>
            </label>
            <input
              id="adj-description"
              type="text"
              required
              placeholder="e.g. Sales quota achievement or Uniform deposit deduction"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-adj-description"
              className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
            />
          </div>

          {/* ── Live Net Payroll Impact Preview Strip ───────────────── */}
          <div
            data-testid="adjustment-preview-strip"
            className="p-4 bg-zinc-900 rounded-xl text-white flex items-center justify-between gap-3 shadow-inner"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">
                Adjustment Impact
              </span>
              <span className="text-xs text-zinc-300">
                {adjustmentType === 'BONUS' ? 'Adds directly to Net Pay' : 'Deducts directly from Net Pay'}
              </span>
            </div>
            <div className="text-right">
              <span
                data-testid="preview-net-impact"
                className={`text-base sm:text-lg font-black font-mono flex items-center gap-1 ${
                  adjustmentType === 'BONUS' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {adjustmentType === 'BONUS' ? 'add_circle' : 'remove_circle'}
                </span>
                <span>
                  {adjustmentType === 'BONUS' ? '+' : '-'}
                  {formatCurrency(numericAmount, currency)}
                </span>
              </span>
            </div>
          </div>

          {/* ── Form Actions ────────────────────────────────────────── */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#e8e2d8]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-adjustment-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ae001a] hover:bg-[#8e0015] active:bg-[#720011] disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Save Adjustment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

