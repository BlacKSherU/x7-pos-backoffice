import React, { useState, useMemo } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { type OnlinePaymentData } from './OnlinePaymentDetailsDrawer';

export interface OnlinePaymentOrderOption {
  id: number;
  customerName?: string;
  storeName?: string;
  totalAmount?: number;
}

export interface OnlinePaymentFormData {
  id?: number;
  onlineOrderId: number;
  paymentProvider: string;
  transactionId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  processedAt?: string | null;
  logicalStatus?: 'active' | 'deleted';
}

interface OnlinePaymentSetupDrawerProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData: OnlinePaymentData | null;
  orders: OnlinePaymentOrderOption[];
  onClose: () => void;
  onSubmit: (formData: OnlinePaymentFormData) => Promise<void>;
}

const KNOWN_PROVIDERS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'square', label: 'Square' },
  { value: 'clover_pay', label: 'Clover Pay' },
];

const toLocalDateTimeInput = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const OnlinePaymentSetupForm: React.FC<{
  mode: 'create' | 'edit';
  initialData: OnlinePaymentData | null;
  orders: OnlinePaymentOrderOption[];
  onClose: () => void;
  onSubmit: (formData: OnlinePaymentFormData) => Promise<void>;
}> = ({ mode, initialData, orders, onClose, onSubmit }) => {
  const [orderSearch, setOrderSearch] = useState('');
  const [onlineOrderId, setOnlineOrderId] = useState<number>(() =>
    initialData ? initialData.onlineOrderId : orders[0]?.id || 0
  );
  const [paymentProvider, setPaymentProvider] = useState<string>(() =>
    initialData ? initialData.paymentProvider : 'stripe'
  );
  const [transactionId, setTransactionId] = useState<string>(() =>
    initialData ? initialData.transactionId : ''
  );
  const [amount, setAmount] = useState<string>(() =>
    initialData ? Number(initialData.amount || 0).toFixed(2) : '0.00'
  );
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'refunded'>(() =>
    initialData ? initialData.status : 'paid'
  );
  const [processedAt, setProcessedAt] = useState<string>(() =>
    initialData ? toLocalDateTimeInput(initialData.processedAt) : ''
  );
  const [logicalStatus, setLogicalStatus] = useState<'active' | 'deleted'>(() =>
    initialData ? initialData.logicalStatus : 'active'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const idStr = `#onl-${o.id}`.toLowerCase();
      const cust = (o.customerName || '').toLowerCase();
      const store = (o.storeName || '').toLowerCase();
      return idStr.includes(q) || String(o.id).includes(q) || cust.includes(q) || store.includes(q);
    });
  }, [orders, orderSearch]);

  const handleGenerateToken = () => {
    const rand = Math.random().toString(36).slice(2, 10);
    const prefix = paymentProvider.toLowerCase().slice(0, 3) || 'txn';
    setTransactionId(`${prefix}_${Date.now()}_${rand}`);
  };

  const handleOrderSelect = (nextOrderId: number) => {
    setOnlineOrderId(nextOrderId);
    if (mode === 'create') {
      const matched = orders.find((o) => o.id === nextOrderId);
      if (matched && matched.totalAmount !== undefined) {
        setAmount(Number(matched.totalAmount).toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!onlineOrderId || onlineOrderId <= 0) {
      setError('Please select a valid target Online Order.');
      return;
    }

    const cleanProvider = paymentProvider.trim();
    if (!cleanProvider || cleanProvider.length > 50) {
      setError('Payment provider is required (max 50 characters).');
      return;
    }

    const cleanTxn = transactionId.trim();
    if (!cleanTxn || cleanTxn.length > 100) {
      setError('External transaction ID is required (max 100 characters).');
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Amount must be a valid non-negative number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: OnlinePaymentFormData = {
        id: initialData?.id,
        onlineOrderId,
        paymentProvider: cleanProvider,
        transactionId: cleanTxn,
        amount: Number(parsedAmount.toFixed(2)),
        status,
        processedAt: processedAt ? new Date(processedAt).toISOString() : undefined,
        ...(mode === 'edit' ? { logicalStatus } : {}),
      };
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save online payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 p-1 font-sans">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 1. Target Online Order Selection */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
          Target Online Order <span className="text-[#ae001a]">*</span>
        </label>
        <input
          type="text"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="Search order by #ONL ID, customer or store..."
          className="w-full h-[34px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-[#ae001a] text-[#1d1c17]"
        />
        <select
          value={onlineOrderId}
          onChange={(e) => handleOrderSelect(Number(e.target.value))}
          required
          className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-white focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-poppins"
        >
          <option value={0}>-- Select an Online Order --</option>
          {filteredOrders.map((o) => (
            <option key={o.id} value={o.id}>
              #ONL-{o.id} {o.customerName ? `— ${o.customerName}` : ''} {o.totalAmount !== undefined ? `($${Number(o.totalAmount).toFixed(2)})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Gateway Provider & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Payment Provider <span className="text-[#ae001a]">*</span>
          </label>
          <select
            value={KNOWN_PROVIDERS.some((p) => p.value === paymentProvider) ? paymentProvider : 'custom'}
            onChange={(e) => {
              if (e.target.value !== 'custom') setPaymentProvider(e.target.value);
            }}
            className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-white focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-poppins"
          >
            {KNOWN_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} ({p.value})
              </option>
            ))}
            <option value="custom">Custom Provider</option>
          </select>
          <input
            type="text"
            value={paymentProvider}
            onChange={(e) => setPaymentProvider(e.target.value)}
            maxLength={50}
            required
            placeholder="e.g. stripe, paypal, square, clover_pay"
            className="w-full h-[34px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Charged Amount ($) <span className="text-[#ae001a]">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="9999999999.99"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full h-[38px] px-3 text-sm font-bold rounded-lg border border-[#d5cfc4] bg-white focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-mono"
          />
          <p className="text-[10px] text-[#8c857b]">
            Stored with 2 decimal precision (12, 2).
          </p>
        </div>
      </div>

      {/* 3. External Transaction ID */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            External Transaction ID <span className="text-[#ae001a]">*</span>
          </label>
          <button
            type="button"
            onClick={handleGenerateToken}
            className="text-[11px] font-bold text-[#ae001a] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">autorenew</span>
            <span>Generate Token</span>
          </button>
        </div>
        <input
          type="text"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          maxLength={100}
          required
          placeholder="e.g. txn_1234567890"
          className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-mono"
        />
        <p className="text-[10px] text-[#8c857b]">
          Must be unique per provider (max 100 characters). Duplicates trigger a 409 Conflict error.
        </p>
      </div>

      {/* 4. Settlement Status & Processed Timestamp */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Settlement Status <span className="text-[#ae001a]">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'paid' | 'failed' | 'refunded')}
            className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-white focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-poppins"
          >
            <option value="paid">PAID (Settlement Complete)</option>
            <option value="pending">PENDING (Processing)</option>
            <option value="failed">FAILED (Gateway Declined)</option>
            <option value="refunded">REFUNDED (Payment Refunded)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Processed Timestamp
          </label>
          <input
            type="datetime-local"
            value={processedAt}
            onChange={(e) => setProcessedAt(e.target.value)}
            className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-mono"
          />
          <p className="text-[10px] text-[#8c857b]">
            Auto-stamped if left blank when status is Paid or Refunded.
          </p>
        </div>
      </div>

      {/* 5. Logical Status (Edit Mode) */}
      {mode === 'edit' && (
        <div className="space-y-1.5 pt-2 border-t border-[#f0ede6]">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
            Logical Record Status
          </label>
          <select
            value={logicalStatus}
            onChange={(e) => setLogicalStatus(e.target.value as 'active' | 'deleted')}
            className="w-full h-[38px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-white focus:outline-none focus:border-[#ae001a] text-[#1d1c17] font-poppins"
          >
            <option value="active">ACTIVE (Visible in Audit Trail)</option>
            <option value="deleted">DELETED (Archived / Voided)</option>
          </select>
        </div>
      )}

      {/* Submit Footer */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e8e2d8]">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-bold text-[#5f5e5e] hover:bg-[#f2ede5] transition-colors cursor-pointer font-poppins"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-[#ae001a] hover:bg-[#d2272f] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs font-poppins"
        >
          <span className="material-symbols-outlined text-[16px]">
            {isSubmitting ? 'sync' : 'save'}
          </span>
          <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Payment' : 'Record Payment'}</span>
        </button>
      </div>
    </form>
  );
};

export const OnlinePaymentSetupDrawer: React.FC<OnlinePaymentSetupDrawerProps> = ({
  isOpen,
  mode,
  initialData,
  orders,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <SideDrawer
      onClose={onClose}
      title={mode === 'edit' && initialData ? `Edit Payment #PAY-${initialData.id}` : 'Record Online Payment'}
      subtitle="Bind gateway transaction token and settlement state to an online order"
      maxWidth={540}
    >
      <OnlinePaymentSetupForm
        key={`${mode}-${initialData?.id || 'new'}`}
        mode={mode}
        initialData={initialData}
        orders={orders}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </SideDrawer>
  );
};

