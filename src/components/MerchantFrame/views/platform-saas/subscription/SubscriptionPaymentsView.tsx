import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  SubscriptionPayment,
  SubscriptionPlan,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';
import { NavHubBar } from '@/shared/components/NavHubBar';

export interface SubscriptionPaymentsViewProps {
  companyId?: number;
  onNavigate?: (featureId: string, plan?: SubscriptionPlan, companyId?: number) => void;
}

const SELECT_CLASS =
  'px-3 py-2 text-xs font-semibold border border-[#e8e2d8] rounded bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a] cursor-pointer';
const HEADER_CLASS =
  'px-6 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-[#5f5e5e]';

export const SubscriptionPaymentsView: React.FC<SubscriptionPaymentsViewProps> = ({
  companyId: initialCompanyId,
  onNavigate,
}) => {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | 'all'>(
    initialCompanyId ? Number(initialCompanyId) : 'all',
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Modals
  const [statusChangeTarget, setStatusChangeTarget] = useState<SubscriptionPayment | null>(null);
  const [newStatus, setNewStatus] = useState<SubscriptionPayment['status']>('paid');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const [receiptTarget, setReceiptTarget] = useState<SubscriptionPayment | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load companies
  useEffect(() => {
    saasService
      .listCompanies()
      .then((data) => setCompanies(data))
      .catch(() => {});
  }, []);

  // Fetch payments
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await saasService.listSubscriptionPayments();
      setPayments(data);
    } catch {
      setError('Failed to load subscription payments. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalCollected = payments
      .filter((p) => p.status === 'paid' || p.status === 'settled' || p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingTotal = payments
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingCount = payments.filter((p) => p.status === 'pending').length;

    const failedRefundedCount = payments.filter(
      (p) => p.status === 'failed' || p.status === 'refunded',
    ).length;

    const totalCount = payments.length;
    const successCount = payments.filter((p) => p.status === 'paid' || p.status === 'settled').length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

    return {
      totalCollected,
      pendingTotal,
      pendingCount,
      failedRefundedCount,
      totalCount,
      successRate,
    };
  }, [payments]);

  // Filtered and Sorted Payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        // Company Filter
        if (selectedCompanyId !== 'all' && p.companyId !== Number(selectedCompanyId)) {
          return false;
        }

        // Status Filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'paid') {
            if (p.status !== 'paid' && p.status !== 'settled' && p.status !== 'completed') {
              return false;
            }
          } else if (p.status !== statusFilter) {
            return false;
          }
        }

        // Method Filter
        if (methodFilter !== 'all' && !p.paymentMethod.toLowerCase().includes(methodFilter.toLowerCase())) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchInvoice = p.invoiceNumber?.toLowerCase().includes(q);
          const matchTxn = p.externalTransactionId.toLowerCase().includes(q);
          const matchCompany = p.companyName?.toLowerCase().includes(q);
          const matchPlan = p.planName?.toLowerCase().includes(q);
          const matchNotes = p.notes?.toLowerCase().includes(q);
          if (!matchInvoice && !matchTxn && !matchCompany && !matchPlan && !matchNotes) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
        }
        if (sortBy === 'amount-desc') {
          return Number(b.amount) - Number(a.amount);
        }
        if (sortBy === 'amount-asc') {
          return Number(a.amount) - Number(b.amount);
        }
        return 0;
      });
  }, [payments, selectedCompanyId, statusFilter, methodFilter, searchQuery, sortBy]);

  // Status Badge formatting
  const renderStatusBadge = (status: SubscriptionPayment['status']) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Paid
          </span>
        );
      case 'settled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Settled
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-50 text-zinc-700 border border-zinc-200">
            {status}
          </span>
        );
    }
  };

  // Status Change Handler
  const handleOpenStatusModal = (p: SubscriptionPayment) => {
    setStatusChangeTarget(p);
    setNewStatus(p.status);
    setStatusNotes(p.notes || '');
  };

  const handleConfirmStatusChange = async () => {
    if (!statusChangeTarget) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await saasService.updateSubscriptionPaymentStatus(
        statusChangeTarget.id,
        newStatus,
        statusNotes,
      );
      setPayments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setToast({
        message: `Payment ${updated.invoiceNumber || updated.id} updated to ${newStatus.toUpperCase()}`,
        type: 'success',
      });
      setStatusChangeTarget(null);
    } catch {
      setToast({
        message: 'Failed to update payment status. Please try again.',
        type: 'error',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Transaction ID',
      'Company ID',
      'Company Name',
      'Plan Name',
      'Payment Date',
      'Billing Period',
      'Payment Method',
      'Amount',
      'Currency',
      'Status',
      'Notes',
    ];

    const rows = filteredPayments.map((p) => [
      p.invoiceNumber || '',
      p.externalTransactionId,
      p.companyId,
      `"${p.companyName || ''}"`,
      `"${p.planName || ''}"`,
      p.paymentDate,
      `"${p.billingPeriod || ''}"`,
      `"${p.paymentMethod}"`,
      p.amount,
      p.currency,
      p.status,
      `"${p.notes || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `subscription_payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Payments exported to CSV successfully.', type: 'success' });
  };

  const navHubItems = useMemo(
    () => [
      {
        id: 'sub-plans-core',
        label: 'SUBSCRIPTION PLANS',
        icon: 'workspace_premium',
        onClick: () => onNavigate?.('sub-plans-core'),
      },
      {
        id: 'apps-config',
        label: 'APPLICATIONS',
        icon: 'apps',
        onClick: () => onNavigate?.('apps-config'),
      },
      {
        id: 'features-control',
        label: 'FEATURES',
        icon: 'toggle_on',
        onClick: () => onNavigate?.('features-control'),
      },
      {
        id: 'plan-apps-rules',
        label: 'PLAN APPS',
        icon: 'widgets',
        onClick: () => onNavigate?.('plan-apps-rules'),
      },
      {
        id: 'plan-features-mapping',
        label: 'PLAN FEATURES',
        icon: 'checklist',
        onClick: () => onNavigate?.('plan-features-mapping'),
      },
      {
        id: 'company-subscriptions',
        label: 'COMPANY SUBS',
        icon: 'business',
        onClick: () => onNavigate?.('company-subscriptions'),
      },
      {
        id: 'merchant-subs-link',
        label: 'MERCHANT SUBS',
        icon: 'storefront',
        onClick: () => onNavigate?.('merchant-subs-link'),
      },
      {
        id: 'sub-apps-mapping',
        label: 'ACTIVE APPS',
        icon: 'developer_board',
        onClick: () => onNavigate?.('sub-apps-mapping'),
      },
      {
        id: 'subscription-audit-logs',
        label: 'AUDIT LOGS',
        icon: 'history',
        onClick: () => onNavigate?.('subscription-audit-logs'),
      },
      {
        id: 'sub-payments-billing',
        label: 'PAYMENTS',
        icon: 'payments',
        active: true,
        onClick: () => onNavigate?.('sub-payments-billing'),
      },
    ],
    [onNavigate],
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] bg-[#f8f6f0] text-[#1d1c17] pb-24">
      {/* Toast Alert */}
      {toast && (
        <div
          data-testid="toast-notification"
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="p-6 md:p-8 space-y-6 flex-1 max-w-[1600px] w-full mx-auto">
        {/* Header Block */}
        <div className="bg-[#222222] text-white p-6 rounded-xl border border-white/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#d51f2c] rounded-lg flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-white text-2xl">payments</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                  PLATFORM SAAS · BILLING & INVOICES
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-[#ae001a] text-white">
                  LIVE BILLING
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mt-0.5">
                Subscription Payments Inquiry
              </h1>
              <p className="text-white/60 text-xs mt-1">
                Audit subscription billing transactions, invoices, payment methods, and update transaction statuses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={loadPayments}
              className="px-3.5 py-2 bg-white/10 text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Refresh ledger transactions"
            >
              <span className="material-symbols-outlined text-base">sync</span>
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#d51f2c] text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-[#ae001a] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Export filtered records to CSV"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Export CSV</span>
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('subscription-system-hub')}
                className="px-3.5 py-2 bg-white/5 text-white/80 rounded text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
              >
                <span className="material-symbols-outlined text-base">grid_view</span>
                <span>Command Hub</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards-grid">
          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
                Total Revenue Settled
              </span>
              <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">paid</span>
              </div>
            </div>
            <div className="text-2xl font-black text-[#1d1c17] tracking-tight">
              ${metrics.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-xs font-bold text-[#5f5e5e] ml-1">USD</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>{metrics.successRate}% settlement rate</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
                Pending Reconciliation
              </span>
              <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">pending_actions</span>
              </div>
            </div>
            <div className="text-2xl font-black text-[#1d1c17] tracking-tight">
              ${metrics.pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-xs font-bold text-[#5f5e5e] ml-1">USD</span>
            </div>
            <div className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
              <span>{metrics.pendingCount} transactions awaiting wire/audit</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
                Failed / Refunded
              </span>
              <div className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">report_problem</span>
              </div>
            </div>
            <div className="text-2xl font-black text-[#1d1c17] tracking-tight">
              {metrics.failedRefundedCount}
              <span className="text-xs font-bold text-[#5f5e5e] ml-1">transactions</span>
            </div>
            <div className="text-[11px] text-[#5f5e5e] font-semibold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              <span>Requires attention or retry</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#e8e2d8] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider">
                Total Invoices Recorded
              </span>
              <div className="w-8 h-8 rounded-md bg-[#222222] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
              </div>
            </div>
            <div className="text-2xl font-black text-[#1d1c17] tracking-tight">
              {metrics.totalCount}
              <span className="text-xs font-bold text-[#5f5e5e] ml-1">invoices</span>
            </div>
            <div className="text-[11px] text-[#5f5e5e] font-semibold mt-1">
              Across all registered tenant companies
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Search by invoice number, transaction ID, company, plan, or notes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-[#e8e2d8] rounded bg-[#fcfaf7] text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] hover:text-[#1d1c17]"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Company Filter */}
              <select
                aria-label="Filter by company"
                value={selectedCompanyId}
                onChange={(e) =>
                  setSelectedCompanyId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className={SELECT_CLASS}
              >
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                aria-label="Filter by payment status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid & Settled</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>

              {/* Payment Method Filter */}
              <select
                aria-label="Filter by payment method"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="all">All Methods</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Bank Wire">Bank Wire Transfer</option>
                <option value="ACH">ACH Direct Debit</option>
                <option value="PayPal">PayPal</option>
              </select>

              {/* Sort Order */}
              <select
                aria-label="Sort payments"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc',
                  )
                }
                className={SELECT_CLASS}
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
              </select>
            </div>
          </div>

          {/* Active Results Summary */}
          <div className="flex items-center justify-between text-xs text-[#5f5e5e] pt-1 border-t border-[#f4efe8]">
            <div>
              Showing <strong className="text-[#1d1c17]">{filteredPayments.length}</strong> of{' '}
              <strong className="text-[#1d1c17]">{payments.length}</strong> transactions
            </div>
            {(selectedCompanyId !== 'all' || statusFilter !== 'all' || methodFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCompanyId('all');
                  setStatusFilter('all');
                  setMethodFilter('all');
                  setSearchQuery('');
                }}
                className="text-[#ae001a] font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span>Reset filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table Section */}
        <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
          <div className="bg-[#222222] px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-white text-lg">receipt</span>
              <span className="text-xs font-black uppercase tracking-widest text-white">
                PAYMENTS & BILLING TRANSACTION LEDGER
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/50">
              AUDITED FINANCIAL RECORDS
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center text-[#5f5e5e] space-y-3">
              <div className="w-8 h-8 border-3 border-[#ae001a] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-bold uppercase tracking-wider">Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-700 bg-rose-50 space-y-3">
              <span className="material-symbols-outlined text-3xl">error</span>
              <p className="text-sm font-bold">{error}</p>
              <button
                onClick={loadPayments}
                className="px-4 py-2 bg-rose-700 text-white rounded text-xs font-bold uppercase tracking-wider"
              >
                Retry
              </button>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-16 text-center text-[#5f5e5e] space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#5f5e5e]/40">receipt_long</span>
              <p className="text-sm font-bold text-[#1d1c17]">No payment records found</p>
              <p className="text-xs text-[#5f5e5e]">
                No transactions match the selected filters or search parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="subscription-payments-table">
                <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                  <tr>
                    <th className={HEADER_CLASS}>Invoice & Reference</th>
                    <th className={HEADER_CLASS}>Company & Plan</th>
                    <th className={HEADER_CLASS}>Date & Period</th>
                    <th className={HEADER_CLASS}>Payment Method</th>
                    <th className={HEADER_CLASS}>Amount</th>
                    <th className={HEADER_CLASS}>Status</th>
                    <th className={`${HEADER_CLASS} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8]">
                  {filteredPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-[#fcfaf7] transition-colors group text-xs"
                      data-testid={`payment-row-${p.id}`}
                    >
                      {/* Invoice & Reference */}
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-[#1d1c17] text-[13px]">
                          {p.invoiceNumber || 'INV-PENDING'}
                        </div>
                        <div className="text-[10px] font-mono text-[#5f5e5e] truncate max-w-[160px]" title={p.externalTransactionId}>
                          {p.externalTransactionId}
                        </div>
                      </td>

                      {/* Company & Plan */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#1d1c17]">
                          {p.companyName || `Company #${p.companyId}`}
                        </div>
                        <div className="text-[11px] text-[#ae001a] font-semibold">
                          {p.planName || 'Platform Subscription'}
                        </div>
                      </td>

                      {/* Date & Period */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1d1c17]">
                          {p.paymentDate}
                        </div>
                        {p.billingPeriod && (
                          <div className="text-[10px] text-[#5f5e5e]">
                            {p.billingPeriod}
                          </div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1d1c17] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#5f5e5e]">
                            {p.paymentMethod.toLowerCase().includes('card')
                              ? 'credit_card'
                              : p.paymentMethod.toLowerCase().includes('wire')
                              ? 'account_balance'
                              : p.paymentMethod.toLowerCase().includes('ach')
                              ? 'savings'
                              : 'payments'}
                          </span>
                          <span>{p.paymentMethod}</span>
                        </div>
                        {p.notes && (
                          <div className="text-[10px] text-[#5f5e5e] italic truncate max-w-[200px]" title={p.notes}>
                            {p.notes}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <div className="font-black text-[#1d1c17] text-sm">
                          ${Number(p.amount).toFixed(2)}
                          <span className="text-[10px] font-normal text-[#5f5e5e] ml-1">
                            {p.currency}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {renderStatusBadge(p.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setReceiptTarget(p)}
                            className="px-2.5 py-1.5 bg-[#f4efe8] hover:bg-[#e8e2d8] text-[#1d1c17] rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                            title="View itemized receipt"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={() => handleOpenStatusModal(p)}
                            className="px-2.5 py-1.5 bg-[#222222] hover:bg-[#ae001a] text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                            title="Update payment status"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Status</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: STATUS CHANGE MODAL */}
      {statusChangeTarget && (
        <div
          data-testid="status-change-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-[#e8e2d8] max-w-md w-full overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="bg-[#222222] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#ae001a] flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg">sync_saved_locally</span>
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    Update Payment Status
                  </h3>
                  <p className="text-[10px] text-white/60 font-mono">
                    {statusChangeTarget.invoiceNumber || statusChangeTarget.externalTransactionId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStatusChangeTarget(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-[#fcfaf7] p-3 rounded-lg border border-[#e8e2d8] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5f5e5e]">Company:</span>
                  <span className="font-bold text-[#1d1c17]">{statusChangeTarget.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5f5e5e]">Amount:</span>
                  <span className="font-extrabold text-[#1d1c17]">
                    ${Number(statusChangeTarget.amount).toFixed(2)} {statusChangeTarget.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#5f5e5e]">Current Status:</span>
                  <span>{renderStatusBadge(statusChangeTarget.status)}</span>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#5f5e5e] mb-1.5">
                  Target Status *
                </label>
                <select
                  data-testid="status-select"
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as SubscriptionPayment['status'])
                  }
                  className="w-full px-3 py-2 text-sm font-semibold border border-[#e8e2d8] rounded bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                >
                  <option value="paid">Paid (Mark fully settled)</option>
                  <option value="settled">Settled (Bank/wire clearance confirmed)</option>
                  <option value="pending">Pending (Awaiting payment/wire reconciliation)</option>
                  <option value="failed">Failed (Declined / insufficient funds)</option>
                  <option value="refunded">Refunded (Credit reversal issued)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#5f5e5e] mb-1.5">
                  Administrative Note / Audit Reason
                </label>
                <textarea
                  data-testid="status-notes-input"
                  rows={3}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Wire transfer matched by accounting team on Nov 23..."
                  className="w-full p-3 text-xs border border-[#e8e2d8] rounded bg-[#fcfaf7] text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a] focus:bg-white resize-none"
                />
              </div>

              <div className="text-[10px] text-[#5f5e5e] bg-amber-50 border border-amber-200 p-2.5 rounded flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-sm">info</span>
                <span>
                  This action is recorded in the <strong>Subscription Audit Log Ledger</strong> with cryptographic hashing.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#f8f6f0] border-t border-[#e8e2d8] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStatusChangeTarget(null)}
                className="px-4 py-2 bg-white border border-[#e8e2d8] text-[#1d1c17] text-xs font-bold uppercase tracking-wider rounded hover:bg-[#ece8e0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-status-button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmStatusChange}
                className="px-5 py-2 bg-[#d51f2c] hover:bg-[#ae001a] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check</span>
                    <span>Confirm Status Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE / RECEIPT DETAIL MODAL */}
      {receiptTarget && (
        <div
          data-testid="receipt-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-[#e8e2d8] max-w-lg w-full overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-[#222222] px-6 py-5 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#d51f2c]">
                    OFFICIAL TAX INVOICE
                  </span>
                  {renderStatusBadge(receiptTarget.status)}
                </div>
                <h3 className="text-lg font-black tracking-tight mt-1">
                  {receiptTarget.invoiceNumber || 'INV-RECEIPT'}
                </h3>
                <p className="text-xs text-white/60 font-mono mt-0.5">
                  Txn ID: {receiptTarget.externalTransactionId}
                </p>
              </div>
              <button
                onClick={() => setReceiptTarget(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-6 text-xs">
              {/* Billed To / Date Grid */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#e8e2d8]">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5f5e5e]">
                    Billed To
                  </span>
                  <div className="font-black text-[#1d1c17] text-sm mt-0.5">
                    {receiptTarget.companyName || `Company #${receiptTarget.companyId}`}
                  </div>
                  <div className="text-[11px] text-[#5f5e5e]">
                    Tenant Account ID: {receiptTarget.companyId}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5f5e5e]">
                    Invoice Date
                  </span>
                  <div className="font-bold text-[#1d1c17] mt-0.5">
                    {receiptTarget.paymentDate}
                  </div>
                  <div className="text-[10px] text-[#5f5e5e]">
                    Period: {receiptTarget.billingPeriod || 'Current Billing Cycle'}
                  </div>
                </div>
              </div>

              {/* Itemized Breakdown Table */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#5f5e5e]">
                  Subscription Plan Details
                </span>
                <table className="w-full border-collapse">
                  <thead className="bg-[#f8f6f0] border-b border-[#e8e2d8] text-[10px] text-[#5f5e5e] uppercase">
                    <tr>
                      <th className="py-2 text-left font-bold">Item Description</th>
                      <th className="py-2 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4efe8]">
                    <tr>
                      <td className="py-2.5">
                        <div className="font-bold text-[#1d1c17]">
                          {receiptTarget.planName || 'Platform Subscription Plan'}
                        </div>
                        <div className="text-[10px] text-[#5f5e5e]">
                          Monthly recurring commercial seat licensing & infrastructure
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-black text-[#1d1c17]">
                        ${Number(receiptTarget.amount).toFixed(2)} {receiptTarget.currency}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[#5f5e5e]">Subtotal</td>
                      <td className="py-2 text-right font-medium text-[#1d1c17]">
                        ${Number(receiptTarget.amount).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[#5f5e5e]">Sales Tax / VAT (0% B2B)</td>
                      <td className="py-2 text-right font-medium text-[#1d1c17]">$0.00</td>
                    </tr>
                    <tr className="border-t border-[#1d1c17]">
                      <td className="py-3 font-black text-sm text-[#1d1c17] uppercase">
                        Total Amount Paid
                      </td>
                      <td className="py-3 text-right font-black text-base text-[#ae001a]">
                        ${Number(receiptTarget.amount).toFixed(2)} {receiptTarget.currency}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Method Details */}
              <div className="bg-[#fcfaf7] p-3.5 rounded-lg border border-[#e8e2d8] space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#5f5e5e]">Payment Method:</span>
                  <span className="font-bold text-[#1d1c17]">{receiptTarget.paymentMethod}</span>
                </div>
                {receiptTarget.notes && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[11px] text-[#5f5e5e] shrink-0">Transaction Notes:</span>
                    <span className="text-[11px] text-[#1d1c17] text-right italic">
                      {receiptTarget.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#f8f6f0] border-t border-[#e8e2d8] flex justify-between items-center">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-3.5 py-2 bg-white border border-[#e8e2d8] text-[#1d1c17] rounded text-xs font-bold uppercase tracking-wider hover:bg-[#ece8e0] cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Print</span>
              </button>
              <button
                data-testid="close-receipt-modal-button"
                onClick={() => setReceiptTarget(null)}
                className="px-5 py-2 bg-[#222222] text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-[#ae001a] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NavHubBar persistent footer */}
      <NavHubBar
        title="SUBSCRIPTION SYSTEM"
        titleIcon="payments"
        subtitle="Audit subscription billing transactions, invoices, payment methods, and update transaction statuses."
        items={navHubItems}
        onBackToDashboard={() => onNavigate?.('subscription-system-hub')}
        backToDashboardLabel="Back to Subscription Hub"
      />
    </div>
  );
};
