import React, { useState, useEffect, useCallback } from 'react';
import type {
  PayrollAdjustment,
  PayrollAdjustmentFilterType,
  PayrollEntry,
} from './types';
import { PayrollAdjustmentsHeader } from './PayrollAdjustmentsHeader';
import { PayrollAdjustmentsGrid } from './PayrollAdjustmentsGrid';
import { PayrollAdjustmentsQuickLaunch } from './PayrollAdjustmentsQuickLaunch';
import { PayrollNavHub } from './PayrollNavHub';
import { NewPayrollAdjustmentModal } from './NewPayrollAdjustmentModal';
import { apiRequest } from '@/shared/api/http';

export interface PayrollAdjustmentsViewProps {
  onNavigate?: (view: string) => void;
  payrollRunId?: string | number;
}

export const PayrollAdjustmentsView: React.FC<PayrollAdjustmentsViewProps> = ({
  onNavigate,
  payrollRunId = 1,
}) => {
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<PayrollAdjustmentFilterType>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Hydrate adjustments from backend API
  const hydrateAdjustments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ data?: PayrollAdjustment[] } | PayrollAdjustment[]>(
        `/api/v1/payroll-adjustments?payrollRunId=${encodeURIComponent(payrollRunId)}`,
        { method: 'GET' },
        'Failed to fetch payroll adjustments',
      );
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list)) {
        setAdjustments(list);
      }
    } catch {
      // Backend error or route not reachable
    } finally {
      setIsLoading(false);
    }
  }, [payrollRunId]);

  useEffect(() => {
    void hydrateAdjustments();
  }, [hydrateAdjustments]);

  const handleNewAdjustment = () => {
    setIsNewModalOpen(true);
  };

  const handleSaveAdjustment = (newAdj: PayrollAdjustment) => {
    setAdjustments((prev) => [newAdj, ...prev]);
    setStatusNotice(
      `Successfully created ${newAdj.adjustment_type.toLowerCase()} of $${Number(newAdj.amount).toFixed(2)} for ${newAdj.collaborator_name}.`,
    );
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleApplyBulkBonus = (amount = 100, description?: string) => {
    setStatusNotice(`Applying bulk bonus of $${amount.toFixed(2)}${description ? ` (${description})` : ''}...`);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleImportDeductions = (file?: File) => {
    setStatusNotice(`Importing deductions${file ? ` from ${file.name}` : ''}...`);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleReSync = (recalculatedEntries?: PayrollEntry[]) => {
    setStatusNotice(
      recalculatedEntries
        ? `Re-synced ${recalculatedEntries.length} payroll entries with current adjustments.`
        : 'Re-syncing adjustments with payroll entries...',
    );
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleAdjustmentReport = () => {
    setStatusNotice('Exporting adjustment report...');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  return (
    <div
      className="w-full space-y-6 font-['Poppins',sans-serif] pb-24"
      data-testid="payroll-adjustments-view"
    >
      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-semibold rounded-lg flex items-center gap-2 animate-in fade-in"
        >
          <span className="material-symbols-outlined text-base">info</span>
          <span>{statusNotice}</span>
        </div>
      )}

      {/* ── Specialized Workspace Header with Bonuses vs Deductions KPIs ─ */}
      <PayrollAdjustmentsHeader
        adjustments={adjustments}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedFilter}
        onTypeFilterChange={setSelectedFilter}
        onNewAdjustmentClick={handleNewAdjustment}
        onNavigate={onNavigate}
        isLoading={isLoading}
      />

      {/* ── Structured Adjustments Data Grid ───────────────────────────── */}
      <PayrollAdjustmentsGrid
        adjustments={adjustments}
        searchQuery={searchQuery}
        selectedType={selectedFilter}
        onAdjustmentsChange={setAdjustments}
        payrollRunId={payrollRunId}
        isLoading={isLoading}
        onRefresh={hydrateAdjustments}
      />

      {/* ── Bottom-Anchored Quick Launch Action Bar ─────────────────────── */}
      <PayrollAdjustmentsQuickLaunch
        adjustments={adjustments}
        onApplyBulkBonus={() => handleApplyBulkBonus(100)}
        onImportDeductionsCsv={handleImportDeductions}
        onReSyncWithEntries={handleReSync}
        onAdjustmentReport={handleAdjustmentReport}
        isPersistent={false}
      />

      {/* ── Persistent Lower Navigation Bar (NavHub) ───────────────────── */}
      <PayrollNavHub
        activeTab="payroll-adjustments"
        currentRoute="/finance-hr/payrolls/adjustments"
        onNavigate={(tabId, path) => onNavigate?.(tabId || path)}
        isPersistent={true}
      />

      {/* ── New Payroll Adjustment Modal ─────────────────────────────────── */}
      <NewPayrollAdjustmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleSaveAdjustment}
        payrollRunId={payrollRunId}
      />
    </div>
  );
};
