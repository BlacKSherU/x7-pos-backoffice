import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PayrollEntry } from './types';
import { formatCurrency, parseMonetaryValue } from './payroll-entries-helpers';
import { apiRequest } from '@/shared/api/http';

export interface ManualPayrollEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (newEntry: PayrollEntry) => void;
  payrollRunId?: string | number;
  currency?: string;
}

export const ManualPayrollEntryModal: React.FC<ManualPayrollEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  payrollRunId = 1,
  currency = 'USD',
}) => {
  const [collaborators, setCollaborators] = useState<
    Array<{ id: number; first_name?: string; last_name?: string; name?: string }>
  >([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('');
  const [collaboratorName, setCollaboratorName] = useState('');
  const [basePay, setBasePay] = useState<string>('');
  const [overtimePay, setOvertimePay] = useState<string>('');
  const [doubleOvertimePay, setDoubleOvertimePay] = useState<string>('');
  const [tipsAmount, setTipsAmount] = useState<string>('');
  const [bonuses, setBonuses] = useState<string>('');
  const [deductions, setDeductions] = useState<string>('');
  const [taxTotal, setTaxTotal] = useState<string>('');

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

  // Load collaborators when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setCollaboratorName('');
    setSelectedCollaboratorId('');
    setBasePay('');
    setOvertimePay('');
    setDoubleOvertimePay('');
    setTipsAmount('');
    setBonuses('');
    setDeductions('');
    setTaxTotal('');
    setErrorMessage(null);
    setIsSubmitting(false);

    const loadCollaborators = async () => {
      try {
        const promise = apiRequest<{ data?: Array<{ id: number; first_name?: string; last_name?: string; name?: string }> }>(
          '/collaborators?limit=100',
          { method: 'GET' },
          'Failed to load collaborators',
        );
        if (promise && typeof promise.then === 'function') {
          const res = await promise;
          const list = Array.isArray(res) ? res : res?.data ?? [];
          setCollaborators(list);
        }
      } catch {
        // Ignored in offline/test
      }
    };
    void loadCollaborators();
  }, [isOpen]);

  // Real-time calculation of gross and net totals
  const { grossTotal, netTotal } = useMemo(() => {
    const base = parseMonetaryValue(basePay);
    const ot = parseMonetaryValue(overtimePay);
    const dot = parseMonetaryValue(doubleOvertimePay);
    const tips = parseMonetaryValue(tipsAmount);
    const bonus = parseMonetaryValue(bonuses);
    const ded = parseMonetaryValue(deductions);
    const tax = parseMonetaryValue(taxTotal);

    const gross = Number((base + ot + dot + tips + bonus - ded).toFixed(2));
    const net = Number((gross - tax).toFixed(2));

    return { grossTotal: gross, netTotal: net };
  }, [basePay, overtimePay, doubleOvertimePay, tipsAmount, bonuses, deductions, taxTotal]);

  if (!isOpen) return null;

  const handleSelectCollaborator = (collabIdStr: string) => {
    setSelectedCollaboratorId(collabIdStr);
    const found = collaborators.find((c) => String(c.id) === collabIdStr);
    if (found) {
      const name = found.name || `${found.first_name ?? ''} ${found.last_name ?? ''}`.trim();
      setCollaboratorName(name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = collaboratorName.trim();
    if (!trimmedName && !selectedCollaboratorId) {
      setErrorMessage('Please enter the collaborator name.');
      return;
    }

    const parsedBase = parseMonetaryValue(basePay);
    if (parsedBase <= 0) {
      setErrorMessage('Please enter a valid base pay amount greater than 0.');
      return;
    }

    setIsSubmitting(true);

    // Resolve collaborator ID (from dropdown, or matched from name, or fallback to 1)
    let finalCollabId = Number(selectedCollaboratorId);
    if (!finalCollabId || finalCollabId <= 0) {
      const matched = collaborators.find(
        (c) =>
          (c.name && c.name.toLowerCase() === trimmedName.toLowerCase()) ||
          `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      finalCollabId = matched ? Number(matched.id) : 1;
    }

    const backendPayload = {
      payroll_run_id: Number(payrollRunId) || 1,
      collaborator_id: finalCollabId,
      base_pay: parsedBase,
      overtime_pay: parseMonetaryValue(overtimePay),
      double_overtime_pay: parseMonetaryValue(doubleOvertimePay),
      tips_amount: parseMonetaryValue(tipsAmount),
      bonuses: parseMonetaryValue(bonuses),
      deductions: parseMonetaryValue(deductions),
      tax_total: parseMonetaryValue(taxTotal),
      gross_total: grossTotal,
      net_total: netTotal,
    };

    try {
      const res = await apiRequest<{ data?: PayrollEntry } | PayrollEntry>(
        '/payroll-entries',
        {
          method: 'POST',
          body: JSON.stringify(backendPayload),
        },
        'Failed to persist payroll entry to server.',
      );

      const responseEntry = ((res && 'data' in res && res.data ? res.data : res) || {}) as PayrollEntry;
      const matchedCollab = collaborators.find((c) => String(c.id) === String(finalCollabId));
      const displayName =
        trimmedName ||
        (matchedCollab
          ? matchedCollab.name || `${matchedCollab.first_name ?? ''} ${matchedCollab.last_name ?? ''}`.trim()
          : `Collaborator #${finalCollabId}`);

      const createdEntry: PayrollEntry = {
        ...backendPayload,
        ...responseEntry,
        id: responseEntry.id ?? `PE-${Date.now()}`,
        collaborator_name: displayName,
        collaborator: {
          id: finalCollabId,
          name: displayName,
        },
        status: responseEntry.status || 'computed',
        created_at: responseEntry.created_at || new Date().toISOString(),
        deleted_at: null,
      };

      onSave?.(createdEntry);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while creating the entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-payroll-entry-title"
      data-testid="manual-payroll-entry-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-['Poppins',sans-serif] animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[680px] bg-white border border-[#e8e2d8] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e2d8] bg-[#fbfaf8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#ae001a] border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl font-bold" aria-hidden="true">
                payments
              </span>
            </div>
            <div>
              <h2
                id="manual-payroll-entry-title"
                className="text-base sm:text-lg font-black text-[#1d1c17] tracking-tight uppercase leading-tight"
              >
                MANUAL PAYROLL ENTRY
              </h2>
              <p className="text-xs text-[#5f5e5e] font-normal mt-0.5">
                Register a new collaborator compensation item for Payroll Run #{payrollRunId}
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

          {/* Collaborator Selection */}
          <div>
            <label
              htmlFor="manual-collaborator-name"
              className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
            >
              Collaborator Full Name <span className="text-[#ae001a]">*</span>
            </label>
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                <select
                  id="select-collaborator-dropdown"
                  value={selectedCollaboratorId}
                  onChange={(e) => handleSelectCollaborator(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
                >
                  <option value="">-- Select from registered collaborators --</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()} (#{c.id})
                    </option>
                  ))}
                </select>
                <input
                  id="manual-collaborator-name"
                  type="text"
                  required
                  placeholder="Or enter collaborator name"
                  value={collaboratorName}
                  onChange={(e) => setCollaboratorName(e.target.value)}
                  data-testid="input-collaborator-name"
                  className="w-full px-3.5 py-2 bg-white border border-[#d0cac0] rounded-lg text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
                />
              </div>
            ) : (
              <input
                id="manual-collaborator-name"
                type="text"
                required
                placeholder="e.g. Carlos Mendoza"
                value={collaboratorName}
                onChange={(e) => setCollaboratorName(e.target.value)}
                data-testid="input-collaborator-name"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            )}
          </div>

          {/* Compensation Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Base Pay */}
            <div>
              <label
                htmlFor="manual-base-pay"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Base Pay ($) <span className="text-[#ae001a]">*</span>
              </label>
              <input
                id="manual-base-pay"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={basePay}
                onChange={(e) => setBasePay(e.target.value)}
                data-testid="input-base-pay"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Overtime Pay */}
            <div>
              <label
                htmlFor="manual-overtime-pay"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Overtime Pay ($)
              </label>
              <input
                id="manual-overtime-pay"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={overtimePay}
                onChange={(e) => setOvertimePay(e.target.value)}
                data-testid="input-overtime-pay"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Double Overtime Pay */}
            <div>
              <label
                htmlFor="manual-double-overtime-pay"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Double Overtime ($)
              </label>
              <input
                id="manual-double-overtime-pay"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={doubleOvertimePay}
                onChange={(e) => setDoubleOvertimePay(e.target.value)}
                data-testid="input-double-overtime-pay"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Tips Amount */}
            <div>
              <label
                htmlFor="manual-tips-amount"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Tips Earned ($)
              </label>
              <input
                id="manual-tips-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={tipsAmount}
                onChange={(e) => setTipsAmount(e.target.value)}
                data-testid="input-tips-amount"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Bonuses */}
            <div>
              <label
                htmlFor="manual-bonuses"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Bonuses ($)
              </label>
              <input
                id="manual-bonuses"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={bonuses}
                onChange={(e) => setBonuses(e.target.value)}
                data-testid="input-bonuses"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Deductions */}
            <div>
              <label
                htmlFor="manual-deductions"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Deductions ($)
              </label>
              <input
                id="manual-deductions"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                data-testid="input-deductions"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>

            {/* Tax Total */}
            <div className="sm:col-span-2">
              <label
                htmlFor="manual-tax-total"
                className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5"
              >
                Statutory Taxes & Withholdings ($)
              </label>
              <input
                id="manual-tax-total"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={taxTotal}
                onChange={(e) => setTaxTotal(e.target.value)}
                data-testid="input-tax-total"
                className="w-full px-3.5 py-2.5 bg-white border border-[#d0cac0] rounded-lg text-sm text-[#1d1c17] font-mono focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] transition-colors"
              />
            </div>
          </div>

          {/* ── Real-Time Calculated Verification Strip ─────────────── */}
          <div
            data-testid="calculation-preview-strip"
            className="p-4 bg-zinc-900 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">
                Calculated Gross Total
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-zinc-100" data-testid="preview-gross-total">
                {formatCurrency(grossTotal, currency)}
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-zinc-700" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">
                Total Taxes
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-red-400" data-testid="preview-tax-total">
                -{formatCurrency(parseMonetaryValue(taxTotal), currency)}
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-zinc-700" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
                Final Net Pay
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-300" data-testid="preview-net-total">
                {formatCurrency(netTotal, currency)}
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
              data-testid="submit-payroll-entry-btn"
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
                  <span>Save Entry</span>
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
