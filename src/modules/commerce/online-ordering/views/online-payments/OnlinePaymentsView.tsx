import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getAccessToken, clearAuthSession } from '@/platform/auth/lib/auth-storage';
import { API_BASE } from '@/shared/api/http';
import {
  OnlinePaymentDetailsDrawer,
  type OnlinePaymentData,
} from './OnlinePaymentDetailsDrawer';
import { getProviderBadgeStyle } from './onlinePaymentHelpers';
import {
  OnlinePaymentSetupDrawer,
  type OnlinePaymentFormData,
  type OnlinePaymentOrderOption,
} from './OnlinePaymentSetupDrawer';
import {
  TableOptionsMenu,
  TablePaginationFooter,
  TableEmptyState,
  NoColumnsEmptyState,
  type TableDensity,
} from '@/shared/components/TableOptionsMenu';

interface OnlinePaymentsViewProps {
  onNavigate?: (view: string) => void;
}

type PaymentStatusFilter = 'all' | 'paid' | 'pending' | 'failed' | 'refunded';

export const OnlinePaymentsView: React.FC<OnlinePaymentsViewProps> = ({ onNavigate }) => {
  const [payments, setPayments] = useState<OnlinePaymentData[]>([]);
  const [orders, setOrders] = useState<OnlinePaymentOrderOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshingSilently, setIsRefreshingSilently] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderFilter, setSelectedOrderFilter] = useState<string>('all');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [selectedStatusPills, setSelectedStatusPills] = useState<string[]>([]);
  const [showActiveStatus, setShowActiveStatus] = useState<boolean>(true);
  const [showDeletedStatus, setShowDeletedStatus] = useState<boolean>(false);

  // Auto-refresh
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);

  // Table options & pagination
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    paymentOrder: true,
    providerTxn: true,
    amount: true,
    status: true,
    processedAt: true,
    logicalStatus: true,
    actions: true,
  });
  const [rowDensity, setRowDensity] = useState<TableDensity>('comfortable');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Drawers
  const [selectedPayment, setSelectedPayment] = useState<OnlinePaymentData | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState<boolean>(false);
  const [setupMode, setSetupMode] = useState<'create' | 'edit'>('create');
  const [paymentToEdit, setPaymentToEdit] = useState<OnlinePaymentData | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch auxiliary online orders for selector & customer labels
  const fetchOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/online-orders?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json?.data || json || [];
        if (Array.isArray(list)) {
          setOrders(
            list.map((o: { id: number; customer?: { name?: string }; store?: { subdomain?: string }; totalAmount?: number | string }) => ({
              id: o.id,
              customerName: o.customer?.name,
              storeName: o.store?.subdomain,
              totalAmount: o.totalAmount !== undefined ? Number(o.totalAmount) : undefined,
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to fetch online orders for payments view:', err);
    }
  }, []);

  // Fetch online payments (logicalStatus=all for instant filtering & accurate KPIs)
  const fetchPayments = useCallback(
    async (silent = false) => {
      const token = getAccessToken();
      if (!token) {
        clearAuthSession();
        return;
      }

      if (silent) {
        setIsRefreshingSilently(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: '100',
          page: '1',
          logicalStatus: 'all',
        });

        const res = await fetch(`${API_BASE}/online-payments?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.status === 401) {
          clearAuthSession();
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const json = await res.json();
        const dataList: OnlinePaymentData[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

        setPayments(dataList);

        if (selectedPayment) {
          const fresh = dataList.find((p) => p.id === selectedPayment.id);
          if (fresh) setSelectedPayment(fresh);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading online payments';
        if (!silent) setError(msg);
      } finally {
        if (silent) {
          setIsRefreshingSilently(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [selectedPayment]
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    void fetchPayments(false);
  }, [fetchPayments]);

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      void fetchPayments(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchPayments]);

  // Unique providers observed + standard providers
  const availableProviders = useMemo(() => {
    const set = new Set<string>(['stripe', 'paypal', 'square', 'clover_pay']);
    payments.forEach((p) => {
      if (p.paymentProvider) set.add(p.paymentProvider.toLowerCase());
    });
    return Array.from(set);
  }, [payments]);

  const handleToggleStatusPill = (key: string) => {
    if (key === 'ALL') {
      setSelectedStatusPills([]);
      setCurrentPage(1);
      return;
    }
    setSelectedStatusPills((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedOrderFilter !== 'all' ||
    selectedProviderFilter !== 'all' ||
    statusFilter !== 'all' ||
    selectedStatusPills.length > 0 ||
    !showActiveStatus ||
    showDeletedStatus
  );

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSelectedOrderFilter('all');
    setSelectedProviderFilter('all');
    setStatusFilter('all');
    setSelectedStatusPills([]);
    setShowActiveStatus(true);
    setShowDeletedStatus(false);
    setCurrentPage(1);
  };

  // Filtered list
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const isDeleted = p.logicalStatus === 'deleted';
      if (isDeleted && !showDeletedStatus) return false;
      if (!isDeleted && !showActiveStatus) return false;

      if (selectedOrderFilter !== 'all' && String(p.onlineOrderId) !== selectedOrderFilter) {
        return false;
      }

      if (
        selectedProviderFilter !== 'all' &&
        (p.paymentProvider || '').toLowerCase() !== selectedProviderFilter.toLowerCase()
      ) {
        return false;
      }

      const st = (p.status || 'pending').toLowerCase();
      if (statusFilter !== 'all' && st !== statusFilter) {
        return false;
      }

      if (selectedStatusPills.length > 0 && !selectedStatusPills.includes(st)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const payId = `#pay-${p.id}`.toLowerCase();
        const ordId = `#onl-${p.onlineOrderId}`.toLowerCase();
        const txn = (p.transactionId || '').toLowerCase();
        const prov = (p.paymentProvider || '').toLowerCase();
        const cust = (orders.find((o) => o.id === p.onlineOrderId)?.customerName || '').toLowerCase();

        const matches =
          payId.includes(q) ||
          ordId.includes(q) ||
          txn.includes(q) ||
          prov.includes(q) ||
          cust.includes(q) ||
          String(p.id).includes(q) ||
          String(p.onlineOrderId).includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    payments,
    showActiveStatus,
    showDeletedStatus,
    selectedOrderFilter,
    selectedProviderFilter,
    statusFilter,
    selectedStatusPills,
    searchQuery,
    orders,
  ]);

  // Active KPI tallies
  const activePayments = useMemo(
    () => payments.filter((p) => p.logicalStatus !== 'deleted'),
    [payments]
  );
  const kpiTotal = activePayments.length;
  const kpiPaid = activePayments.filter((p) => p.status === 'paid').length;
  const kpiPending = activePayments.filter((p) => p.status === 'pending').length;
  const kpiFailed = activePayments.filter((p) => p.status === 'failed').length;
  const kpiRefunded = activePayments.filter((p) => p.status === 'refunded').length;
  const kpiVoided = payments.filter((p) => p.logicalStatus === 'deleted').length;
  const kpiNetVolume = activePayments
    .filter((p) => p.status === 'paid')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const kpiPendingVolume = activePayments
    .filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const kpiFailedVolume = activePayments
    .filter((p) => p.status === 'failed')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const kpiRefundedVolume = activePayments
    .filter((p) => p.status === 'refunded')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // Handlers
  const handleOpenDetails = (payment: OnlinePaymentData) => {
    setSelectedPayment(payment);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenCreate = () => {
    setPaymentToEdit(null);
    setSetupMode('create');
    setIsSetupDrawerOpen(true);
  };

  const handleOpenEdit = (payment: OnlinePaymentData) => {
    setPaymentToEdit(payment);
    setSetupMode('edit');
    setIsSetupDrawerOpen(true);
  };

  const handleUpdateStatus = async (
    paymentId: number,
    nextStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  ) => {
    const token = getAccessToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/online-payments/${paymentId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to update payment status');
    }

    showToast(`Payment #PAY-${paymentId} marked as ${nextStatus.toUpperCase()}`);
    void fetchPayments(true);
  };

  const handleSyncGateway = async (paymentId: number) => {
    const token = getAccessToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/online-payments/${paymentId}/sync-gateway`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to sync gateway status');
    }

    const json = await res.json().catch(() => null);
    showToast(json?.message || `Gateway status verified for #PAY-${paymentId}`);
    void fetchPayments(true);
  };

  const handleRefundPayment = async (
    paymentId: number,
    refundAmount?: number,
    reason?: string
  ) => {
    const token = getAccessToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/online-payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(refundAmount !== undefined ? { refundAmount } : {}),
        ...(reason ? { reason } : {}),
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to process refund');
    }

    const json = await res.json().catch(() => null);
    showToast(json?.message || `Refund processed for #PAY-${paymentId}`);
    void fetchPayments(true);
  };

  const handleSetupSubmit = async (formData: OnlinePaymentFormData) => {
    const token = getAccessToken();
    if (!token) return;

    const isEdit = setupMode === 'edit' && formData.id;
    const url = isEdit
      ? `${API_BASE}/online-payments/${formData.id}`
      : `${API_BASE}/online-payments`;
    const method = isEdit ? 'PATCH' : 'POST';

    const payload: Record<string, unknown> = {
      onlineOrderId: formData.onlineOrderId,
      paymentProvider: formData.paymentProvider,
      transactionId: formData.transactionId,
      amount: formData.amount,
      status: formData.status,
    };
    if (formData.processedAt !== undefined) {
      payload.processedAt = formData.processedAt;
    }
    if (formData.logicalStatus !== undefined) {
      payload.logicalStatus = formData.logicalStatus;
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.message ||
          (res.status === 409
            ? 'Duplicate transaction ID for this payment provider (409 Conflict)'
            : `Failed to ${isEdit ? 'update' : 'record'} online payment`)
      );
    }

    showToast(`Online payment ${isEdit ? 'updated' : 'recorded'} successfully`);
    void fetchPayments(false);
  };

  const handleDeletePayment = async (payment: OnlinePaymentData) => {
    if (
      !confirm(
        `Are you sure you want to void payment #PAY-${payment.id}? Historical audit metadata will be preserved.`
      )
    ) {
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/online-payments/${payment.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to void payment');
      }

      showToast(`Payment #PAY-${payment.id} marked as DELETED`);
      setIsDetailDrawerOpen(false);
      void fetchPayments(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error voiding payment');
    }
  };

  const handleRestorePayment = async (payment: OnlinePaymentData) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/online-payments/${payment.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logicalStatus: 'active' }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to restore payment');
      }

      showToast(`Payment #PAY-${payment.id} restored to ACTIVE`);
      setIsDetailDrawerOpen(false);
      void fetchPayments(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error restoring payment');
    }
  };

  // CSV & Summary
  const handleExportCsv = () => {
    if (filteredPayments.length === 0) {
      showToast('No payments to export');
      return;
    }

    const headers = [
      'Payment ID',
      'Online Order ID',
      'Provider',
      'Transaction ID',
      'Amount',
      'Settlement Status',
      'Processed At',
      'Logical Status',
      'Created At',
    ];

    const rows = filteredPayments.map((p) => [
      `#PAY-${p.id}`,
      `#ONL-${p.onlineOrderId}`,
      p.paymentProvider,
      `"${(p.transactionId || '').replace(/"/g, '""')}"`,
      Number(p.amount || 0).toFixed(2),
      p.status.toUpperCase(),
      p.processedAt || '',
      p.logicalStatus.toUpperCase(),
      p.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `online_payments_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported online payments to CSV');
  };

  const handleCopySummary = () => {
    if (filteredPayments.length === 0) return;
    const text = filteredPayments
      .map(
        (p) =>
          `#PAY-${p.id} | #ONL-${p.onlineOrderId} | ${p.paymentProvider.toUpperCase()} (${p.transactionId}) | $${Number(p.amount || 0).toFixed(2)} | ${p.status.toUpperCase()}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    showToast('Payment audit summary copied to clipboard');
  };

  const densityPadding =
    rowDensity === 'compact'
      ? 'py-2 px-2'
      : rowDensity === 'spacious'
      ? 'py-4 px-3.5'
      : 'py-2.5 px-2.5';

  const activeColumnsCount =
    (visibleColumns.paymentOrder ? 1 : 0) +
    (visibleColumns.providerTxn ? 1 : 0) +
    (visibleColumns.amount ? 1 : 0) +
    (visibleColumns.status ? 1 : 0) +
    (visibleColumns.processedAt ? 1 : 0) +
    (visibleColumns.logicalStatus ? 1 : 0) +
    (visibleColumns.actions ? 1 : 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-6 z-50 bg-[#1d1c17] text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-fade-in font-sans">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Card Workspace */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl font-normal select-none">
            payments
          </span>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
            ONLINE PAYMENTS AUDIT WORKSPACE
          </h2>
        </div>
        <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
          Track digital payment attempts bound to web orders, audit gateway provider tokens, monitor settlement statuses, and reconcile processed transactions.
        </p>
      </div>

      {/* 2. Operational KPI Summary Banner (5 Columns - Single Line) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full min-w-0">
        {/* KPI 1: Total Online Revenue (PAID) */}
        <div className="bg-white border border-[#e8e2d8] hover:border-[#ae001a] transition-colors duration-200 p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#10b981] flex items-center justify-center border border-emerald-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-poppins">
                Total Online Revenue
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-poppins leading-tight truncate">
                {isLoading ? '...' : `$${kpiNetVolume.toFixed(2)}`}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 font-poppins">
            PAID ({kpiPaid})
          </span>
        </div>

        {/* KPI 2: Pending Settlements */}
        <div className="bg-white border border-[#e8e2d8] hover:border-[#ae001a] transition-colors duration-200 p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#f59e0b] flex items-center justify-center border border-amber-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-poppins">
                Pending Settlements
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-poppins leading-tight truncate">
                {isLoading ? '...' : `$${kpiPendingVolume.toFixed(2)}`}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shrink-0 font-poppins">
            PENDING ({kpiPending})
          </span>
        </div>

        {/* KPI 3: Failed Gateway Volume */}
        <div className="bg-white border border-[#e8e2d8] hover:border-[#ae001a] transition-colors duration-200 p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#ef4444] flex items-center justify-center border border-red-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-poppins">
                Failed Gateway Volume
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-poppins leading-tight truncate">
                {isLoading ? '...' : `$${kpiFailedVolume.toFixed(2)}`}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-red-100 text-red-800 border border-red-200 shrink-0 font-poppins">
            FAILED ({kpiFailed})
          </span>
        </div>

        {/* KPI 4: Refunded Amount */}
        <div className="bg-white border border-[#e8e2d8] hover:border-[#ae001a] transition-colors duration-200 p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#8b5cf6] flex items-center justify-center border border-purple-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">undo</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-poppins">
                Refunded Amount
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-poppins leading-tight truncate">
                {isLoading ? '...' : `$${kpiRefundedVolume.toFixed(2)}`}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 shrink-0 font-poppins">
            REF ({kpiRefunded})
          </span>
        </div>

        {/* KPI 5: Total Transactions */}
        <div className="bg-white border border-[#e8e2d8] hover:border-[#ae001a] transition-colors duration-200 p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
              <span className="material-symbols-outlined text-[18px]">credit_card</span>
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate font-poppins">
                Total Transactions
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] font-poppins leading-tight">
                {isLoading ? '...' : kpiTotal}
              </div>
            </div>
          </div>
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200 shrink-0 font-poppins">
            TOTAL
          </span>
        </div>
      </div>

      {/* 3. Canonical Unified Filter Toolbar */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
        {/* Row 1: Search & Auto Refresh */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#76736a] select-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search by #PAY, #ONL, transaction_id, provider, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-[36px] w-full pl-9 pr-8 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17] placeholder:text-[#8c857b] transition-all font-sans font-poppins"
              aria-label="Search online payments"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center h-[36px] px-2.5 rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] gap-1.5 text-xs text-[#5f5e5e] shrink-0 font-sans">
            <button
              type="button"
              onClick={() => void fetchPayments(true)}
              disabled={isLoading || isRefreshingSilently}
              className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
              title="Sync now"
            >
              <span className={`material-symbols-outlined text-sm ${isRefreshingSilently ? 'animate-spin text-[#ae001a]' : ''}`}>
                sync
              </span>
            </button>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-[11px] font-semibold text-[#1d1c17] focus:outline-none cursor-pointer h-full font-sans"
            >
              <option value={0}>Auto: Off</option>
              <option value={5}>Auto: 5s</option>
              <option value={10}>Auto: 10s</option>
              <option value={30}>Auto: 30s</option>
              <option value={60}>Auto: 60s</option>
            </select>
          </div>
        </div>

        {/* Row 2: Dedicated Selectors & Logical Status Checkboxes */}
        <div className="pt-3 border-t border-[#f0ede6] flex flex-wrap items-center gap-2.5 w-full">
          {/* Online Order Filter */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              shopping_bag
            </span>
            <select
              value={selectedOrderFilter}
              onChange={(e) => {
                setSelectedOrderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by online order"
            >
              <option value="all">All Orders ({orders.length})</option>
              {orders.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  #ONL-{o.id} {o.customerName ? `(${o.customerName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Gateway Provider Filter */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              account_balance
            </span>
            <select
              value={selectedProviderFilter}
              onChange={(e) => {
                setSelectedProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by payment provider"
            >
              <option value="all">All Providers</option>
              {availableProviders.map((prov) => (
                <option key={prov} value={prov}>
                  {getProviderBadgeStyle(prov).label}
                </option>
              ))}
            </select>
          </div>

          {/* Settlement Status Dropdown */}
          <div className="flex items-center h-[34px] px-2.5 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] hover:border-[#b8b0a2] focus-within:border-[#ae001a] transition-all shrink-0">
            <span className="material-symbols-outlined text-[16px] text-[#76736a] mr-1.5 select-none shrink-0">
              verified_user
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as PaymentStatusFilter);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[#1d1c17] outline-none cursor-pointer pr-1 font-sans font-poppins"
              aria-label="Filter by settlement status"
            >
              <option value="all">All Settlement States</option>
              <option value="paid">PAID (Settled)</option>
              <option value="pending">PENDING (Processing)</option>
              <option value="failed">FAILED (Declined)</option>
              <option value="refunded">REFUNDED (Returned)</option>
            </select>
          </div>

          {/* Logical Status Checkboxes (ACTIVE / DELETED) */}
          <div className="flex items-center gap-3 h-[34px] px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] font-poppins">
              Logical:
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1c17] cursor-pointer select-none font-poppins hover:text-[#ae001a] transition-colors duration-200">
              <input
                type="checkbox"
                checked={showActiveStatus}
                onChange={(e) => {
                  setShowActiveStatus(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-[#d5cfc4] text-[#ae001a] focus:ring-[#ae001a] accent-[#ae001a] cursor-pointer"
              />
              <span>ACTIVE</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1c17] cursor-pointer select-none font-poppins hover:text-[#ae001a] transition-colors duration-200">
              <input
                type="checkbox"
                checked={showDeletedStatus}
                onChange={(e) => {
                  setShowDeletedStatus(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-[#d5cfc4] text-[#ae001a] focus:ring-[#ae001a] accent-[#ae001a] cursor-pointer"
              />
              <span>DELETED</span>
            </label>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="h-[34px] px-2.5 rounded-lg text-xs font-semibold text-[#ae001a] hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1 cursor-pointer font-sans shrink-0 font-poppins"
              title="Reset all filters"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Row 3: Status Multi-Filter Pills Strip & Actions */}
        <div className="pt-3 border-t border-[#f0ede6] w-full flex items-center justify-between min-w-0">
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] shrink-0 mr-1 font-sans font-poppins">
              STATUS:
            </span>

            <button
              type="button"
              onClick={() => handleToggleStatusPill('ALL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStatusPills.length === 0
                  ? 'bg-[#1d1c17] text-white border-[#1d1c17] shadow-xs'
                  : 'bg-white text-[#5f5e5e] border-[#d5cfc4] hover:bg-[#fcfcfb] hover:text-[#ae001a]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">done_all</span>
              <span>All</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${selectedStatusPills.length === 0 ? 'bg-white/20 text-white' : 'bg-[#e8e2d8] text-[#5f5e5e]'}`}>
                {kpiTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleStatusPill('paid')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStatusPills.includes('paid')
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              <span>Paid</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${selectedStatusPills.includes('paid') ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {kpiPaid}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleStatusPill('pending')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStatusPills.includes('pending')
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
              <span>Pending</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${selectedStatusPills.includes('pending') ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {kpiPending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleStatusPill('failed')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStatusPills.includes('failed')
                  ? 'bg-red-700 text-white border-red-700 shadow-xs'
                  : 'bg-white text-red-800 border-red-200 hover:bg-red-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">cancel</span>
              <span>Failed</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${selectedStatusPills.includes('failed') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'}`}>
                {kpiFailed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleStatusPill('refunded')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border font-poppins ${
                selectedStatusPills.includes('refunded')
                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                  : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">undo</span>
              <span>Refunded</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${selectedStatusPills.includes('refunded') ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'}`}>
                {kpiRefunded}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pl-2 shrink-0 font-sans">
            <button
              type="button"
              onClick={() => {
                setShowDeletedStatus((prev) => !prev);
                setCurrentPage(1);
              }}
              className={`h-[30px] px-2.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 font-sans font-poppins whitespace-nowrap border ${
                kpiVoided > 0 || showDeletedStatus
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200'
              }`}
              title="Toggle archived / voided payments"
            >
              <span className={`material-symbols-outlined text-[15px] ${kpiVoided > 0 || showDeletedStatus ? 'text-red-600' : 'text-zinc-400'}`}>
                archive
              </span>
              <span>Voided</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${kpiVoided > 0 || showDeletedStatus ? 'bg-red-200 text-red-900' : 'bg-zinc-100 text-zinc-600'}`}>
                {kpiVoided}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="h-[30px] px-3 bg-[#ae001a] hover:bg-[#d2272f] text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 font-sans font-poppins whitespace-nowrap"
              title="Record new online payment"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>New Payment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-lg">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Online Payment Transactions Directory Table */}
      <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
        <div className="bg-[#222222] px-6 py-4 flex items-center justify-between border-b border-[#333333]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#ae001a] text-xl select-none">
              payments
            </span>
            <span className="text-label-caps font-bold text-white uppercase tracking-wider font-sans">
              ONLINE PAYMENT TRANSACTIONS DIRECTORY
            </span>
            <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
              {filteredPayments.length === payments.length
                ? `${payments.length} transaction${payments.length === 1 ? '' : 's'}`
                : `${filteredPayments.length} / ${payments.length} transactions`}
            </span>
          </div>

          <TableOptionsMenu
            onExportCSV={handleExportCsv}
            onPrint={window.print}
            onCopySummary={handleCopySummary}
            onReload={() => void fetchPayments(true)}
            columns={[
              { key: 'paymentOrder', label: 'Payment & Order' },
              { key: 'providerTxn', label: 'Provider & Transaction' },
              { key: 'amount', label: 'Charged Amount' },
              { key: 'status', label: 'Settlement Status' },
              { key: 'processedAt', label: 'Processing Timestamp' },
              { key: 'logicalStatus', label: 'Logical Status' },
              { key: 'actions', label: 'Actions' },
            ]}
            visibleColumns={visibleColumns}
            onToggleColumn={(key) =>
              setVisibleColumns((prev) => ({
                ...prev,
                [key]: !prev[key],
              }))
            }
            rowDensity={rowDensity}
            onChangeDensity={setRowDensity}
            totalItems={filteredPayments.length}
            pageSize={pageSize}
            onChangePageSize={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        </div>

        {activeColumnsCount === 0 ? (
          <NoColumnsEmptyState
            onReset={() =>
              setVisibleColumns({
                paymentOrder: true,
                providerTxn: true,
                amount: true,
                status: true,
                processedAt: true,
                logicalStatus: true,
                actions: true,
              })
            }
          />
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse font-sans text-xs">
                <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                  <tr>
                    {visibleColumns.paymentOrder && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Payment & Order
                      </th>
                    )}
                    {visibleColumns.providerTxn && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Provider & Transaction Ref
                      </th>
                    )}
                    {visibleColumns.amount && (
                      <th className={`text-right text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Charged Amount
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Settlement Status
                      </th>
                    )}
                    {visibleColumns.processedAt && (
                      <th className={`text-left text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Processed At
                      </th>
                    )}
                    {visibleColumns.logicalStatus && (
                      <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Logical Status
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className={`text-center text-label-caps font-semibold text-[#5f5e5e] font-sans text-xs ${densityPadding} whitespace-nowrap`}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2d8] text-xs text-[#1d1c17]">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={activeColumnsCount}
                        className="px-6 py-12 text-center text-secondary font-sans bg-white"
                      >
                        <span className="material-symbols-outlined animate-spin text-[#ae001a] text-4xl block mb-2 mx-auto select-none">
                          sync
                        </span>
                        <p className="text-secondary text-body-md mt-2 font-sans">
                          Loading online payment transactions...
                        </p>
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <TableEmptyState
                      colSpan={activeColumnsCount}
                      icon="payments"
                      title="No online payments found"
                      description={
                        searchQuery
                          ? `No transactions matching "${searchQuery}". Clear your search query or reset filters.`
                          : 'There are currently no online payment transactions matching the selected parameters.'
                      }
                    />
                  ) : (
                    paginatedPayments.map((payment) => {
                      const statusKey = (payment.status || 'pending').toLowerCase();
                      const providerMeta = getProviderBadgeStyle(payment.paymentProvider);
                      const isDeleted = payment.logicalStatus === 'deleted';
                      const customerName = orders.find((o) => o.id === payment.onlineOrderId)?.customerName;

                      return (
                        <tr
                          key={payment.id}
                          onClick={() => handleOpenDetails(payment)}
                          className="hover:bg-[#f8f3eb] transition-colors cursor-pointer group bg-white"
                        >
                          {/* Payment & Order Badge */}
                          {visibleColumns.paymentOrder && (
                            <td className={`${densityPadding} whitespace-nowrap`}>
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-poppins font-bold text-xs bg-[#222222] text-white px-2 py-0.5 rounded group-hover:bg-[#ae001a] transition-colors duration-200">
                                  #PAY-{payment.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrderFilter(String(payment.onlineOrderId));
                                  }}
                                  className="font-poppins font-bold text-[11px] text-[#ae001a] hover:underline flex items-center gap-1 cursor-pointer transition-colors duration-200"
                                  title="Filter by this online order"
                                >
                                  <span className="material-symbols-outlined text-[12px]">shopping_bag</span>
                                  <span>#ONL-{payment.onlineOrderId}</span>
                                  {customerName && (
                                    <span className="text-[#5f5e5e] font-poppins font-normal truncate max-w-[100px]">
                                      ({customerName})
                                    </span>
                                  )}
                                </button>
                              </div>
                            </td>
                          )}

                          {/* Provider & Transaction Reference */}
                          {visibleColumns.providerTxn && (
                            <td className={densityPadding}>
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border font-poppins ${providerMeta.cls}`}>
                                  <span className="material-symbols-outlined text-[12px]">{providerMeta.icon}</span>
                                  <span>{providerMeta.label}</span>
                                </span>
                                <span className="font-poppins text-[11px] font-medium text-[#1d1c17] bg-[#f8f5ee] border border-[#e8e2d8] px-1.5 py-0.2 rounded max-w-[220px] truncate inline-flex items-center gap-1 group-hover:border-[#ae001a]/40 transition-colors duration-200">
                                  <span className="material-symbols-outlined text-[11px] text-[#76736a]">pin</span>
                                  <span className="truncate">{payment.transactionId}</span>
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Charged Amount */}
                          {visibleColumns.amount && (
                            <td className={`${densityPadding} text-right whitespace-nowrap`}>
                              <span className="font-poppins font-extrabold text-sm text-[#1d1c17] group-hover:text-[#ae001a] transition-colors duration-200">
                                ${Number(payment.amount || 0).toFixed(2)}
                              </span>
                            </td>
                          )}

                          {/* Payment Settlement Status Pill */}
                          {visibleColumns.status && (
                            <td className={`${densityPadding} text-center whitespace-nowrap`}>
                              {statusKey === 'paid' && (
                                <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-poppins inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                  <span>Settlement Complete</span>
                                </span>
                              )}
                              {statusKey === 'pending' && (
                                <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-poppins inline-flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                                  <span>Processing</span>
                                </span>
                              )}
                              {statusKey === 'failed' && (
                                <span className="bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-poppins inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                                  <span>Gateway Declined</span>
                                </span>
                              )}
                              {statusKey === 'refunded' && (
                                <span className="bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-poppins inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                                  <span>Payment Refunded</span>
                                </span>
                              )}
                            </td>
                          )}

                          {/* Processing Timestamp */}
                          {visibleColumns.processedAt && (
                            <td className={`${densityPadding} font-mono text-[11px] text-[#5f5e5e] whitespace-nowrap`}>
                              {payment.processedAt ? (
                                <>
                                  <div>{new Date(payment.processedAt).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-[#8c857b]">
                                    {new Date(payment.processedAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[#8c857b] italic font-sans">Pending</span>
                              )}
                            </td>
                          )}

                          {/* Logical Status */}
                          {visibleColumns.logicalStatus && (
                            <td className={`${densityPadding} text-center whitespace-nowrap`}>
                              {isDeleted ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200 font-poppins">
                                  DELETED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 font-poppins">
                                  ACTIVE
                                </span>
                              )}
                            </td>
                          )}

                          {/* Actions */}
                          {visibleColumns.actions && (
                            <td
                              className={`${densityPadding} text-center whitespace-nowrap`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetails(payment)}
                                  className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#1d1c17] hover:bg-[#f2ede5] transition-colors cursor-pointer"
                                  title="Inspect payment audit details"
                                >
                                  <span className="material-symbols-outlined text-[17px]">visibility</span>
                                </button>

                                {!isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(payment)}
                                    className="w-7 h-7 rounded flex items-center justify-center text-[#8c857b] hover:text-[#ae001a] hover:bg-[#f2ede5] transition-colors cursor-pointer"
                                    title="Edit payment transaction"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">edit</span>
                                  </button>
                                )}

                                {isDeleted ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleRestorePayment(payment)}
                                    className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title="Restore payment record"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">restore_from_trash</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeletePayment(payment)}
                                    className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Void payment record"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">delete</span>
                                  </button>
                                )}

                                {!isDeleted && statusKey === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateStatus(payment.id, 'paid')}
                                    className="w-7 h-7 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                                    title="Settle payment as PAID"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredPayments.length > 0 && (
              <TablePaginationFooter
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredPayments.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                startItem={(currentPage - 1) * pageSize + 1}
                endItem={Math.min(currentPage * pageSize, filteredPayments.length)}
              />
            )}
          </>
        )}
      </div>

      {/* Details Audit Drawer */}
      <OnlinePaymentDetailsDrawer
        isOpen={isDetailDrawerOpen}
        payment={selectedPayment}
        orderLabel={
          selectedPayment
            ? orders.find((o) => o.id === selectedPayment.onlineOrderId)?.customerName
            : undefined
        }
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedPayment(null);
        }}
        onUpdateStatus={handleUpdateStatus}
        onSyncGateway={handleSyncGateway}
        onRefundPayment={handleRefundPayment}
        onEditPayment={(payment) => {
          setIsDetailDrawerOpen(false);
          handleOpenEdit(payment);
        }}
        onDeletePayment={handleDeletePayment}
        onRestorePayment={handleRestorePayment}
        onNavigateToOrder={(orderId) => {
          setIsDetailDrawerOpen(false);
          onNavigate?.('online-orders');
          setSelectedOrderFilter(String(orderId));
        }}
      />

      {/* Setup / Add / Edit Drawer */}
      <OnlinePaymentSetupDrawer
        isOpen={isSetupDrawerOpen}
        mode={setupMode}
        initialData={paymentToEdit}
        orders={orders}
        onClose={() => {
          setIsSetupDrawerOpen(false);
          setPaymentToEdit(null);
        }}
        onSubmit={handleSetupSubmit}
      />
    </div>
  );
};
