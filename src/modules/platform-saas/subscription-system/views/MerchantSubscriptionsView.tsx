import React, { useEffect, useMemo, useState } from 'react';
import { saasService } from '@/modules/platform-saas/central-backoffice/api/saas-service';
import type {
  MerchantSubscription,
  SubscriptionPlan,
  UpdateMerchantSubscriptionDto,
} from '@/modules/platform-saas/subscription-system/types/subscription';
import {
  AppModal,
  FormField,
  ModalFormError,
  ModalFormFooter,
} from '@/shared/components/AppModal';

const ALL = 'all';
const HEADER_CLASS =
  'px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]';
const SELECT_CLASS =
  'text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] px-3 py-2 focus:outline-none focus:border-[#ae001a]';

interface SubscriptionForm {
  planId: string;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  renewalDate: string;
  paymentMethod: string;
}

const toForm = (s: MerchantSubscription): SubscriptionForm => ({
  planId: String(s.plan.id),
  status: s.status,
  startDate: s.startDate ? s.startDate.split('T')[0] : '',
  endDate: s.endDate ? s.endDate.split('T')[0] : '',
  renewalDate: s.renewalDate ? s.renewalDate.split('T')[0] : '',
  paymentMethod: s.paymentMethod || '',
});

export function toUpdateMerchantDto(
  original: MerchantSubscription,
  form: SubscriptionForm,
): UpdateMerchantSubscriptionDto {
  const before = toForm(original);
  const dto: UpdateMerchantSubscriptionDto = {};
  if (form.planId !== before.planId) dto.planId = Number(form.planId);
  if (form.status !== before.status) dto.status = form.status;
  if (form.startDate !== before.startDate) dto.startDate = form.startDate;
  if (form.endDate !== before.endDate) dto.endDate = form.endDate || null;
  if (form.renewalDate !== before.renewalDate) dto.renewalDate = form.renewalDate || null;
  if (form.paymentMethod.trim() !== before.paymentMethod) {
    dto.paymentMethod = form.paymentMethod.trim();
  }
  return dto;
}

function statusBadge(s: MerchantSubscription): { label: string; className: string } {
  if (s.isExpired) return { label: 'Expired', className: 'bg-[#ae001a]/10 text-[#ae001a]' };
  return s.status === 'active'
    ? { label: 'Active', className: 'bg-green-500/10 text-green-600' }
    : { label: 'Inactive', className: 'bg-[#5f5e5e]/20 text-[#5f5e5e]' };
}

interface MerchantSubscriptionsViewProps {
  onNavigate?: (view: string) => void;
}

export const MerchantSubscriptionsView: React.FC<MerchantSubscriptionsViewProps> = ({ onNavigate }) => {
  const [subscriptions, setSubscriptions] = useState<MerchantSubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [planFilter, setPlanFilter] = useState(ALL);
  const [editing, setEditing] = useState<MerchantSubscription | null>(null);
  const [form, setForm] = useState<SubscriptionForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSubscriptions = () => {
    setIsLoading(true);
    setFetchError(false);
    Promise.all([saasService.listMerchantSubscriptions(), saasService.getSubscriptionPlans()])
      .then(([list, planList]) => {
        setSubscriptions(list);
        setPlans(planList);
      })
      .catch((err) => {
        setFetchError(true);
        const message = err instanceof Error ? err.message : 'Failed to load merchant subscriptions';
        setToast({
          message:
            message === 'SESSION_EXPIRED'
              ? 'Session expired. Please refresh the page to sign in again.'
              : message,
          type: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadSubscriptions();
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return subscriptions.filter(
      (s) =>
        (!term || s.merchant.name.toLowerCase().includes(term)) &&
        (statusFilter === ALL ||
          (statusFilter === 'expired' ? s.isExpired : s.status === statusFilter && !s.isExpired)) &&
        (planFilter === ALL || String(s.plan.id) === planFilter),
    );
  }, [subscriptions, searchQuery, statusFilter, planFilter]);

  const expiredCount = subscriptions.filter((s) => s.isExpired).length;

  const openEdit = (subscription: MerchantSubscription) => {
    setEditing(subscription);
    setForm(toForm(subscription));
    setFormError(null);
  };

  const closeEdit = () => {
    if (isSubmitting) return;
    setEditing(null);
    setForm(null);
    setFormError(null);
  };

  const updateField = <K extends keyof SubscriptionForm>(field: K, value: SubscriptionForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !form) return;
    if (!form.startDate) return setFormError('Start date is required');
    if (form.endDate && form.endDate < form.startDate) {
      return setFormError('End date cannot be before the start date');
    }
    if (!form.paymentMethod.trim()) return setFormError('Payment method is required');

    const dto = toUpdateMerchantDto(editing, form);
    if (Object.keys(dto).length === 0) {
      closeEdit();
      return;
    }

    setIsSubmitting(true);
    try {
      await saasService.updateMerchantSubscription(editing.id, dto);
      setToast({ message: 'Merchant subscription updated successfully', type: 'success' });
      setIsSubmitting(false);
      setEditing(null);
      setForm(null);
      loadSubscriptions();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update merchant subscription');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Secondary Header */}
      <div className="bg-white border border-[#e8e2d8] p-6 shadow-xs rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb Context */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-primary tracking-wider uppercase mb-1">
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
              <span className="text-[#1d1c17]">Merchant Subscriptions</span>
            </nav>
            <h1 className="text-2xl font-black text-[#1d1c17] tracking-tight uppercase">
              MERCHANT SUBSCRIPTIONS
            </h1>
            <p className="text-body-sm text-[#5f5e5e] mt-1 max-w-3xl">
              Inquire and manage individual merchant store subscriptions, assigned plans, and store licenses.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate?.('subscription-system-hub')}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded border border-zinc-300 transition-all flex items-center gap-2 cursor-pointer hover:text-primary transition-colors duration-200"
              title="Return to Subscription Hub"
            >
              <span className="material-symbols-outlined text-base">hub</span>
              <span>Subscription Hub</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#222222] px-6 py-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          MERCHANT SUBSCRIPTIONS DIRECTORY
        </span>
        <span className="text-white/50 text-xs">
          {isLoading
            ? '...'
            : `${subscriptions.length} subscriptions${expiredCount ? ` · ${expiredCount} expired` : ''}`}
        </span>
      </div>

      <div className="bg-white border border-[#e8e2d8] overflow-hidden">
        {!isLoading && !fetchError && (
          <div className="px-4 py-3 border-b border-[#e8e2d8] bg-[#f8f3eb] flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by merchant…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#e8e2d8] bg-white text-[#1d1c17] placeholder:text-[#5f5e5e] focus:outline-none focus:border-[#ae001a]"
              />
            </div>
            <select
              aria-label="Plan filter"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value={ALL}>All Plans</option>
              {plans.map((plan) => (
                <option key={plan.id} value={String(plan.id)}>
                  {plan.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value={ALL}>All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              {expiredCount > 0 && <option value="expired">Expired</option>}
            </select>
          </div>
        )}

        {isLoading && (
          <div className="p-8 text-center text-sm text-[#5f5e5e]">
            Loading merchant subscriptions…
          </div>
        )}

        {fetchError && !isLoading && (
          <div className="p-8 text-center text-sm text-[#ae001a]">
            Failed to load merchant subscriptions. Please try refreshing the page.
          </div>
        )}

        {!isLoading && !fetchError && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-[#5f5e5e]">
            {subscriptions.length === 0
              ? 'No merchant subscriptions found in the system.'
              : 'No subscriptions match your search filters.'}
          </div>
        )}

        {!isLoading && !fetchError && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f8f3eb] border-b border-[#e8e2d8]">
                  <th className={HEADER_CLASS}>Merchant</th>
                  <th className={HEADER_CLASS}>Plan</th>
                  <th className={HEADER_CLASS}>Start Date</th>
                  <th className={HEADER_CLASS}>End Date</th>
                  <th className={HEADER_CLASS}>Renewal Date</th>
                  <th className={HEADER_CLASS}>Payment Method</th>
                  <th className={HEADER_CLASS}>Status</th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {filtered.map((s) => {
                  const badge = statusBadge(s);
                  return (
                    <tr key={s.id} className="hover:bg-[#fcfaf6] transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-[#1d1c17]">
                        {s.merchant.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#1d1c17]">{s.plan.name}</td>
                      <td className="px-6 py-4 text-sm text-[#1d1c17]">{s.startDate ? s.startDate.split('T')[0] : '—'}</td>
                      <td className="px-6 py-4 text-sm text-[#1d1c17]">
                        {s.endDate ? s.endDate.split('T')[0] : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#1d1c17]">
                        {s.renewalDate ? s.renewalDate.split('T')[0] : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#1d1c17]">{s.paymentMethod}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          aria-label={`Edit subscription of ${s.merchant.name}`}
                          onClick={() => openEdit(s)}
                          className="p-1 text-[#1d1c17] hover:text-[#ae001a] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && form && (
        <AppModal
          title={`EDIT SUBSCRIPTION — ${editing.merchant.name.toUpperCase()}`}
          onClose={closeEdit}
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {formError && <ModalFormError message={formError} />}
              <div>
                <label
                  htmlFor="subscription-plan"
                  className="block text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1"
                >
                  Plan
                </label>
                <select
                  id="subscription-plan"
                  value={form.planId}
                  onChange={(e) => updateField('planId', e.target.value)}
                  className={SELECT_CLASS}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="subscription-status"
                  className="block text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1"
                >
                  Status
                </label>
                <select
                  id="subscription-status"
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value as 'active' | 'inactive')}
                  className={SELECT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <FormField
                id="subscription-start"
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(value) => updateField('startDate', value)}
                required
              />
              <FormField
                id="subscription-end"
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={(value) => updateField('endDate', value)}
              />
              <FormField
                id="subscription-renewal"
                label="Renewal Date"
                type="date"
                value={form.renewalDate}
                onChange={(value) => updateField('renewalDate', value)}
              />
              <FormField
                id="subscription-payment"
                label="Payment Method"
                value={form.paymentMethod}
                onChange={(value) => updateField('paymentMethod', value)}
                required
              />
            </div>
            <ModalFormFooter
              onCancel={closeEdit}
              submitLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
              isSubmitting={isSubmitting}
            />
          </form>
        </AppModal>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[110] px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-[#ae001a]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

