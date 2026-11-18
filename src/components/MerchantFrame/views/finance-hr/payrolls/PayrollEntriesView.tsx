import React, { useState, useEffect, useCallback } from 'react';
import type { PayrollEntry } from './types';
import { PayrollEntriesHeader } from './PayrollEntriesHeader';
import { PayrollEntriesGrid } from './PayrollEntriesGrid';
import { PayrollEntriesQuickLaunch } from './PayrollEntriesQuickLaunch';
import { apiRequest } from '@/shared/api/http';

export interface PayrollEntriesViewProps {
  onNavigate?: (view: string) => void;
  payrollRunId?: string | number;
}

export const PayrollEntriesView: React.FC<PayrollEntriesViewProps> = ({
  onNavigate,
  payrollRunId = 1,
}) => {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<(string | number)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Hydrate entries from backend API
  const hydrateEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ data?: PayrollEntry[] } | PayrollEntry[]>(
        `/api/v1/payroll-entries?payrollRunId=${encodeURIComponent(payrollRunId)}`,
        { method: 'GET' },
      );
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list)) {
        setEntries(list);
      }
    } catch {
      // Backend error or route not reachable
    } finally {
      setIsLoading(false);
    }
  }, [payrollRunId]);

  useEffect(() => {
    void hydrateEntries();
  }, [hydrateEntries]);

  const handleManualEntryClick = () => {
    setStatusNotice('Manual Payroll Entry modal requested.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleBulkAdjustments = () => {
    setStatusNotice('Bulk Adjustments drawer requested.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleAuditTaxes = () => {
    setStatusNotice('Audit Taxes initiated for payroll entries.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  return (
    <div
      className="w-full space-y-6 font-['Poppins',sans-serif] pb-16"
      data-testid="payroll-entries-view"
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

      {/* ── Specialized Workspace Header with Real-Time KPIs ────────────── */}
      <PayrollEntriesHeader
        entries={entries}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onManualEntryClick={handleManualEntryClick}
        onNavigate={onNavigate}
        isLoading={isLoading}
      />

      {/* ── Structured Data Grid ────────────────────────────────────────── */}
      <PayrollEntriesGrid
        entries={entries}
        searchQuery={searchQuery}
        onEntriesChange={setEntries}
        onSelectEntry={(entry) => {
          setSelectedRowIds((prev) =>
            prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id],
          );
        }}
        isLoading={isLoading}
        onRefresh={hydrateEntries}
      />

      {/* ── Bottom-Anchored Quick Launch Toolbar ────────────────────────── */}
      <PayrollEntriesQuickLaunch
        entries={entries}
        selectedRowIds={selectedRowIds}
        onEntriesChange={setEntries}
        onBulkAdjustments={handleBulkAdjustments}
        onAuditTaxes={handleAuditTaxes}
        isPersistent={false}
      />
    </div>
  );
};
