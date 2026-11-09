import React, { useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  CompanySubscriptionDetail,
  SubscriptionPayment,
  ProvisionedApplication,
  SubscriptionLifecycleStatus,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import type { CompanyRegistryItem } from '@/modules/platform-saas/companies/types/company-registry';
import { NavHubBar } from '@/shared/components/NavHubBar';

const HEADER_CLASS =
  'px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]';
const SELECT_CLASS =
  'text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] px-3 py-2 focus:outline-none focus:border-[#ae001a]';

export interface CompanySubscriptionViewProps {
  companyId?: number;
  onNavigate?: (view: string, plan?: any, companyId?: number) => void;
}

export function normalizeLifecycleStatus(
  status: SubscriptionLifecycleStatus | string | undefined,
): 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'INACTIVE' {
  if (!status) return 'INACTIVE';
  const upper = status.toUpperCase();
  if (upper === 'ACTIVE') return 'ACTIVE';
  if (upper === 'SUSPENDED') return 'SUSPENDED';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
  return 'INACTIVE';
}

export function statusBadge(status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'INACTIVE'): {
  label: string;
  className: string;
  icon: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
        icon: 'check_circle',
      };
    case 'SUSPENDED':
      return {
        label: 'Suspended',
        className: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
        icon: 'pause_circle',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
        icon: 'cancel',
      };
    default:
      return {
        label: 'Inactive',
        className: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20',
        icon: 'do_not_disturb_on',
      };
  }
}

export function paymentStatusBadge(status: string): { label: string; className: string } {
  const norm = status.toLowerCase();
  if (norm === 'paid' || norm === 'completed' || norm === 'settled') {
    return { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
  }
  if (norm === 'pending') {
    return { label: 'Pending', className: 'bg-amber-500/10 text-amber-800 border-amber-500/20' };
  }
  if (norm === 'failed') {
    return { label: 'Failed', className: 'bg-rose-500/10 text-rose-700 border-rose-500/20' };
  }
  if (norm === 'refunded') {
    return { label: 'Refunded', className: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
  }
  return { label: status, className: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' };
}

export const CompanySubscriptionView: React.FC<CompanySubscriptionViewProps> = ({
  companyId: initialCompanyId,
  onNavigate,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    initialCompanyId ?? null,
  );
  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [subscription, setSubscription] = useState<CompanySubscriptionDetail | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [applications, setApplications] = useState<ProvisionedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Payment filters
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  // Status Change Confirmation Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | null>(null);
  const [cancelOption, setCancelOption] = useState<'immediate' | 'period_end'>('period_end');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initial load: fetch companies list
  useEffect(() => {
    let isMounted = true;
    saasService
      .listCompanies()
      .then((list) => {
        if (!isMounted) return;
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) {
          setSelectedCompanyId(list[0].id);
        }
      })
      .catch(() => {
        // Fallback: load from subscriptions list
        saasService
          .listCompanySubscriptions()
          .then((subs) => {
            if (!isMounted) return;
            const mapped = subs.map((s) => ({
              id: s.company.id,
              name: s.company.name,
              status: 'active' as const,
              country: 'DOM',
              timezone: 'America/Santo_Domingo',
              currency: 'DOP',
              adminEmail: 'admin@example.com',
              merchantsCount: 1,
              usersCount: 1,
              createdAt: s.startDate,
            }));
            setCompanies(mapped);
            if (!selectedCompanyId && mapped.length > 0) {
              setSelectedCompanyId(mapped[0].id);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            setError(err instanceof Error ? err.message : 'Failed to load companies');
          });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync selectedCompanyId when prop changes
  useEffect(() => {
    if (initialCompanyId && initialCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId]);

  // Load details for currently selected company
  const loadCompanyDetails = async (cId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [subData, paymentsData, appsData] = await Promise.all([
        saasService.getCompanySubscription(cId),
        saasService.getCompanyPayments(cId).catch(() => []),
        saasService.getCompanySubscriptionApplications(cId).catch(() => []),
      ]);
      setSubscription(subData);
      setPayments(paymentsData);
      setApplications(appsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompanyDetails(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    const term = paymentSearch.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesSearch =
        !term ||
        p.externalTransactionId.toLowerCase().includes(term) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(term)) ||
        p.paymentMethod.toLowerCase().includes(term);

      const matchesStatus =
        paymentStatusFilter === 'all' ||
        p.status.toLowerCase() === paymentStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [payments, paymentSearch, paymentStatusFilter]);

  // Request status modification
  const handleInitiateStatusChange = (newStatus: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') => {
    if (!subscription) return;
    const current = normalizeLifecycleStatus(subscription.status);
    if (current === newStatus) return;

    setTargetStatus(newStatus);
    setCancelOption('period_end');
    setSuspensionReason('');
    setStatusModalOpen(true);
  };

  // Confirm status modification
  const handleConfirmStatusChange = async () => {
    if (!selectedCompanyId || !targetStatus) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await saasService.updateCompanySubscriptionStatus(
        selectedCompanyId,
        targetStatus,
        {
          immediate: cancelOption === 'immediate',
          reason: suspensionReason.trim() || undefined,
        },
      );
      setSubscription(updated);
      setStatusModalOpen(false);
      setToast({
        message: `Subscription successfully updated to ${targetStatus}${
          targetStatus === 'SUSPENDED'
            ? ' (Tenant user access blocked immediately)'
            : targetStatus === 'CANCELLED'
            ? cancelOption === 'immediate'
              ? ' (Terminated immediately)'
              : ' (Terminated at period end)'
            : ' (Active)'
        }`,
        type: 'success',
      });
      // Refresh details
      loadCompanyDetails(selectedCompanyId);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update subscription status',
        type: 'error',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const currentLifecycle = normalizeLifecycleStatus(subscription?.status);
  const badgeInfo = statusBadge(currentLifecycle);

  // Persistent Hub Bar items
  const navHubItems = [
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
      active: true,
      onClick: () => onNavigate?.('company-subscriptions'),
    },
    {
      id: 'merchant-subs-link',
      label: 'MERCHANT SUBS',
      icon: 'storefront',
      onClick: () => onNavigate?.('merchant-subs-link'),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-20 font-['Poppins',sans-serif]">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 border transition-all animate-in fade-in slide-in-from-top-2 ${
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

      {/* Secondary Header */}
      <div className="bg-white border border-[#e8e2d8] p-6 shadow-xs rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb Context */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs font-bold text-[#ae001a] tracking-wider uppercase mb-1"
            >
              <span className="material-symbols-outlined text-lg">workspace_premium</span>
              <span>Platform SaaS</span>
              <span className="text-[#8a8880]">/</span>
              <button
                type="button"
                onClick={() => onNavigate?.('subscription-system-hub')}
                className="hover:underline cursor-pointer"
              >
                Subscription System Hub
              </button>
              <span className="text-[#8a8880]">/</span>
              <button
                type="button"
                onClick={() => onNavigate?.('company-subscriptions')}
                className="hover:underline cursor-pointer"
              >
                Company Subscriptions
              </button>
              {subscription && (
                <>
                  <span className="text-[#8a8880]">/</span>
                  <span className="text-[#1d1c17] truncate max-w-xs">{subscription.company.name}</span>
                </>
              )}
            </nav>
            <h1 className="text-2xl font-black text-[#1d1c17] tracking-tight uppercase">
              COMPANY SUBSCRIPTION MANAGEMENT
            </h1>
            <p className="text-sm text-[#5f5e5e] mt-1 max-w-3xl">
              Inspect tenant subscription lifecycle, modify operational states (Active, Suspended,
              Cancelled), track payment ledgers, and audit provisioned software modules.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Company Selector Dropdown */}
            {companies.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="company-selector" className="text-xs font-bold uppercase tracking-wider text-[#5f5e5e]">
                  Company:
                </label>
                <select
                  id="company-selector"
                  aria-label="Select Company"
                  value={selectedCompanyId ?? ''}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                  className="px-3 py-2 text-sm font-semibold border border-[#e8e2d8] rounded bg-white text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate?.('company-subscriptions')}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded border border-zinc-300 transition-all flex items-center gap-2 cursor-pointer hover:text-[#ae001a]"
              title="Return to Company Subscriptions List"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to List</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded border border-zinc-300 transition-all flex items-center gap-2 cursor-pointer hover:text-[#ae001a]"
              title="Return to Subscription Hub"
            >
              <span className="material-symbols-outlined text-base">hub</span>
              <span>Hub</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-12 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-[#ae001a] border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-semibold text-[#5f5e5e]">Loading subscription parameters and ledgers…</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-white border border-rose-200 rounded-xl p-8 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-rose-600">error</span>
          <p className="text-sm font-bold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={() => selectedCompanyId && loadCompanyDetails(selectedCompanyId)}
            className="px-4 py-2 bg-[#222222] text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-[#ae001a] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}

      {!isLoading && !error && subscription && (
        <>
          {/* Section 1: Active Subscription Parameters & Lifecycle Control */}
          <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
            <div className="bg-[#222222] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-xl">verified_user</span>
                <span className="text-xs font-bold uppercase tracking-widest text-white">
                  SUBSCRIPTION LIFECYCLE & STATE MACHINE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Current Status:</span>
                <span
                  data-testid="subscription-status-badge"
                  className={`px-3 py-1 text-xs font-bold uppercase rounded-full border flex items-center gap-1.5 ${badgeInfo.className}`}
                >
                  <span className="material-symbols-outlined text-sm">{badgeInfo.icon}</span>
                  <span>{badgeInfo.label}</span>
                </span>
              </div>
            </div>

            <div className="p-6">
              {/* Lifecycle Warning Banner if Suspended */}
              {currentLifecycle === 'SUSPENDED' && (
                <div
                  role="alert"
                  className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-amber-900 text-sm flex items-start gap-3"
                >
                  <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">
                    warning
                  </span>
                  <div>
                    <h2 className="font-bold">Tenant Access Blocked</h2>
                    <p className="text-xs text-amber-800 mt-0.5">
                      This subscription is currently SUSPENDED. Tenant users belonging to{' '}
                      <strong>{subscription.company.name}</strong> are immediately denied access to
                      all SaaS modules via middleware authorization checks.
                    </p>
                  </div>
                </div>
              )}

              {/* Lifecycle Warning Banner if Cancelled */}
              {currentLifecycle === 'CANCELLED' && (
                <div
                  role="alert"
                  className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-900 text-sm flex items-start gap-3"
                >
                  <span className="material-symbols-outlined text-rose-600 text-xl shrink-0 mt-0.5">
                    cancel
                  </span>
                  <div>
                    <h2 className="font-bold">Subscription Cancelled</h2>
                    <p className="text-xs text-rose-800 mt-0.5">
                      This subscription has been terminated. The billing cycle is finalized and renewals
                      are suspended.
                    </p>
                  </div>
                </div>
              )}

              {/* Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-4 rounded-lg">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Company Tenant
                  </span>
                  <div className="text-base font-extrabold text-[#1d1c17] truncate">
                    {subscription.company.name}
                  </div>
                  <span className="text-xs text-[#5f5e5e] mt-1 block">
                    ID: #{subscription.company.id}
                  </span>
                </div>

                <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-4 rounded-lg">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Subscribed Plan & Price
                  </span>
                  <div className="text-base font-extrabold text-[#ae001a] truncate">
                    {subscription.plan.name}
                  </div>
                  <span className="text-xs text-[#1d1c17] font-semibold mt-1 block">
                    ${Number(subscription.price ?? subscription.plan.price ?? 0).toFixed(2)}{' '}
                    <span className="text-[#5f5e5e] font-normal">
                      / {subscription.billingCycle ?? 'MONTHLY'}
                    </span>
                  </span>
                </div>

                <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-4 rounded-lg">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Coverage Dates
                  </span>
                  <div className="text-xs text-[#1d1c17] font-semibold">
                    Start: <span className="font-mono text-[#5f5e5e]">{subscription.startDate}</span>
                  </div>
                  <div className="text-xs text-[#1d1c17] font-semibold mt-1">
                    End: <span className="font-mono text-[#5f5e5e]">{subscription.endDate ?? 'No End'}</span>
                  </div>
                  <div className="text-xs text-[#1d1c17] font-semibold mt-1">
                    Renewal: <span className="font-mono text-[#5f5e5e]">{subscription.renewalDate ?? 'N/A'}</span>
                  </div>
                </div>

                <div className="bg-[#fcfaf7] border border-[#e8e2d8] p-4 rounded-lg">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] block mb-1">
                    Payment Method
                  </span>
                  <div className="text-sm font-bold text-[#1d1c17] flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-base text-[#ae001a]">
                      credit_card
                    </span>
                    <span>{subscription.paymentMethod || 'Credit Card (Auto-Debit)'}</span>
                  </div>
                  <span className="text-xs text-[#5f5e5e] mt-1 block">
                    Auto-renewal enabled
                  </span>
                </div>
              </div>

              {/* State Transitions Control */}
              <div className="border-t border-[#e8e2d8] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#1d1c17]">
                    Lifecycle State Modifier
                  </h3>
                  <p className="text-xs text-[#5f5e5e] mt-0.5">
                    Transition state to govern tenant access rights and billing enforcement.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleInitiateStatusChange('ACTIVE')}
                    disabled={currentLifecycle === 'ACTIVE'}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentLifecycle === 'ACTIVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs cursor-default'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInitiateStatusChange('SUSPENDED')}
                    disabled={currentLifecycle === 'SUSPENDED'}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentLifecycle === 'SUSPENDED'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs cursor-default'
                        : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">pause_circle</span>
                    <span>Suspend Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInitiateStatusChange('CANCELLED')}
                    disabled={currentLifecycle === 'CANCELLED'}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentLifecycle === 'CANCELLED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs cursor-default'
                        : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">cancel</span>
                    <span>Cancel Subscription</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Payment History Ledger */}
          <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
            <div className="bg-[#222222] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-xl">payments</span>
                <span className="text-xs font-bold uppercase tracking-widest text-white">
                  PAYMENT HISTORY LEDGER
                </span>
              </div>
              <span className="text-white/60 text-xs font-mono">
                {filteredPayments.length} of {payments.length} transactions
              </span>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-[#e8e2d8] bg-[#f8f3eb] flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search invoice or transaction ID…"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a]"
                />
              </div>

              <select
                aria-label="Payment status filter"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid / Settled</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Ledger Table */}
            {filteredPayments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm font-semibold text-[#5f5e5e]">
                {payments.length === 0
                  ? 'No payment transactions recorded for this company subscription.'
                  : 'No payments match your search criteria.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" data-testid="payment-ledger-table">
                  <thead className="bg-[#ece8e0] border-b border-[#e8e2d8]">
                    <tr>
                      <th className={HEADER_CLASS}>Invoice / Transaction ID</th>
                      <th className={HEADER_CLASS}>Payment Date</th>
                      <th className={HEADER_CLASS}>Amount</th>
                      <th className={HEADER_CLASS}>Payment Method</th>
                      <th className={HEADER_CLASS}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8e2d8]">
                    {filteredPayments.map((p) => {
                      const pBadge = paymentStatusBadge(p.status);
                      return (
                        <tr key={p.id} className="hover:bg-[#fcfaf7] transition-colors">
                          <td className="px-6 py-4 text-sm font-mono font-bold text-[#1d1c17]">
                            {p.invoiceNumber || p.externalTransactionId}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-[#5f5e5e]">
                            {p.paymentDate}
                          </td>
                          <td className="px-6 py-4 text-sm font-extrabold text-[#1d1c17]">
                            ${Number(p.amount).toFixed(2)}{' '}
                            <span className="text-xs text-[#5f5e5e] font-normal">{p.currency}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#5f5e5e]">
                            {p.paymentMethod}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${pBadge.className}`}
                            >
                              {pBadge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Subscription Applications View (Provisioned Apps Inspector) */}
          <div className="bg-white border border-[#e8e2d8] rounded-xl shadow-xs overflow-hidden">
            <div className="bg-[#222222] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-xl">apps</span>
                <span className="text-xs font-bold uppercase tracking-widest text-white">
                  PROVISIONED APPLICATIONS ({subscription.plan.name} TIER)
                </span>
              </div>
              <span className="text-white/60 text-xs">
                {applications.filter((a) => a.isProvisioned).length} modules unlocked
              </span>
            </div>

            <div className="p-6">
              {applications.length === 0 ? (
                <div className="py-8 text-center text-sm font-semibold text-[#5f5e5e]">
                  No modular applications discovered for this plan tier.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="applications-grid">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className={`p-4 rounded-lg border transition-all ${
                        app.isProvisioned
                          ? 'bg-[#fcfaf7] border-emerald-300 shadow-xs'
                          : 'bg-zinc-50 border-zinc-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-white border border-[#e8e2d8] flex items-center justify-center text-[#ae001a] shadow-xs">
                            <span className="material-symbols-outlined text-xl">
                              {app.icon || 'widgets'}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#1d1c17] uppercase tracking-tight">
                              {app.name}
                            </h4>
                            <span className="text-[11px] font-mono text-[#5f5e5e] block">
                              {app.code}
                            </span>
                          </div>
                        </div>

                        {app.isProvisioned ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                            Provisioned
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-zinc-200 text-zinc-600">
                            Locked
                          </span>
                        )}
                      </div>

                      {app.description && (
                        <p className="text-xs text-[#5f5e5e] mt-3 line-clamp-2">
                          {app.description}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-[#e8e2d8]/60 flex items-center justify-between text-[11px]">
                        <span className="text-[#5f5e5e]">Access Tier:</span>
                        <span className="font-semibold text-[#1d1c17]">
                          {app.isProvisioned ? subscription.plan.name : 'Upgrade Required'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal for Subscription State Changes */}
      {statusModalOpen && targetStatus && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-[#e8e2d8] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#222222] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-xl ${
                    targetStatus === 'SUSPENDED'
                      ? 'text-amber-400'
                      : targetStatus === 'CANCELLED'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {targetStatus === 'SUSPENDED'
                    ? 'warning'
                    : targetStatus === 'CANCELLED'
                    ? 'cancel'
                    : 'check_circle'}
                </span>
                <h3 id="status-modal-title" className="text-xs font-bold uppercase tracking-widest text-white">
                  Confirm Subscription State Transition: {targetStatus}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={isUpdatingStatus}
                className="text-white/70 hover:text-white cursor-pointer"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {targetStatus === 'SUSPENDED' && (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                      Tenant Access Will Be Immediately Terminated
                    </p>
                    <p className="text-xs text-amber-800">
                      Changing status to <strong>SUSPENDED</strong> immediately blocks all tenant
                      users belonging to <strong>{subscription?.company.name}</strong> from accessing
                      X7 SaaS applications via backend API token verification middleware.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="suspension-reason"
                      className="block text-xs font-bold uppercase tracking-wider text-[#5f5e5e] mb-1"
                    >
                      Reason for Suspension (Optional):
                    </label>
                    <textarea
                      id="suspension-reason"
                      rows={2}
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      placeholder="e.g. Delinquent account, billing failure, administrative hold…"
                      className="w-full p-2.5 text-sm border border-[#e8e2d8] rounded focus:outline-none focus:border-[#ae001a]"
                    />
                  </div>
                </>
              )}

              {targetStatus === 'CANCELLED' && (
                <>
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-sm">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-rose-600 text-lg">cancel</span>
                      Subscription Cancellation & Access Termination
                    </p>
                    <p className="text-xs text-rose-800">
                      You are about to cancel the subscription for{' '}
                      <strong>{subscription?.company.name}</strong>. Choose whether the cancellation
                      takes effect immediately or at the end of the current billing cycle.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5f5e5e] mb-1">
                      Termination Scope:
                    </label>
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#e8e2d8] hover:bg-[#fcfaf7] cursor-pointer">
                      <input
                        type="radio"
                        name="cancelOption"
                        value="period_end"
                        checked={cancelOption === 'period_end'}
                        onChange={() => setCancelOption('period_end')}
                        className="mt-0.5 text-[#ae001a] focus:ring-[#ae001a]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#1d1c17]">
                          Terminate at end of billing cycle (Recommended)
                        </div>
                        <div className="text-[11px] text-[#5f5e5e]">
                          Grandfather access until renewal date (
                          {subscription?.renewalDate ?? 'end of period'}). Prevents unexpected lockouts.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#e8e2d8] hover:bg-[#fcfaf7] cursor-pointer">
                      <input
                        type="radio"
                        name="cancelOption"
                        value="immediate"
                        checked={cancelOption === 'immediate'}
                        onChange={() => setCancelOption('immediate')}
                        className="mt-0.5 text-[#ae001a] focus:ring-[#ae001a]"
                      />
                      <div>
                        <div className="text-xs font-bold text-rose-700">
                          Immediate Termination (Admin Override)
                        </div>
                        <div className="text-[11px] text-[#5f5e5e]">
                          Immediately revokes all tenant sessions and application access rights.
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {targetStatus === 'ACTIVE' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">
                      check_circle
                    </span>
                    Reactivate Subscription
                  </p>
                  <p className="text-xs text-emerald-800">
                    Reactivating will immediately restore full platform and application access for{' '}
                    <strong>{subscription?.company.name}</strong> under the{' '}
                    <strong>{subscription?.plan.name}</strong> plan tier.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-[#f8f3eb] px-6 py-4 border-t border-[#e8e2d8] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#5f5e5e] hover:text-[#1d1c17] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider text-white rounded transition-all cursor-pointer ${
                  targetStatus === 'SUSPENDED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : targetStatus === 'CANCELLED'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isUpdatingStatus ? 'Applying Change…' : `Confirm ${targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom NavHubBar */}
      <NavHubBar
        title="SUBSCRIPTION SYSTEM"
        titleIcon="hub"
        subtitle="Manage plans, provisioned apps, tenant subscriptions, and payments."
        items={navHubItems}
        onBackToDashboard={() => onNavigate?.('subscription-system-hub')}
        backToDashboardLabel="Back to Subscription Hub"
      />
    </div>
  );
};

