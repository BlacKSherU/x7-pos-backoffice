import React, { useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { getProviderBadgeStyle } from './onlinePaymentHelpers';

export interface OnlinePaymentData {
  id: number;
  onlineOrderId: number;
  paymentProvider: string;
  transactionId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  processedAt: string | null;
  logicalStatus: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
  onlineOrder?: {
    id: number;
    status: string;
  };
}

interface OnlinePaymentDetailsDrawerProps {
  isOpen: boolean;
  payment: OnlinePaymentData | null;
  orderLabel?: string;
  onClose: () => void;
  onUpdateStatus: (paymentId: number, nextStatus: 'pending' | 'paid' | 'failed' | 'refunded') => Promise<void>;
  onSyncGateway: (paymentId: number) => Promise<void>;
  onRefundPayment: (paymentId: number, refundAmount?: number, reason?: string) => Promise<void>;
  onEditPayment: (payment: OnlinePaymentData) => void;
  onDeletePayment: (payment: OnlinePaymentData) => Promise<void>;
  onRestorePayment: (payment: OnlinePaymentData) => Promise<void>;
  onNavigateToOrder?: (orderId: number) => void;
}

export const OnlinePaymentDetailsDrawer: React.FC<OnlinePaymentDetailsDrawerProps> = ({
  isOpen,
  payment,
  orderLabel,
  onClose,
  onUpdateStatus,
  onSyncGateway,
  onRefundPayment,
  onEditPayment,
  onDeletePayment,
  onRestorePayment,
  onNavigateToOrder,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [copiedTxn, setCopiedTxn] = useState(false);

  if (!isOpen || !payment) return null;

  const statusKey = (payment.status || 'pending').toLowerCase() as 'pending' | 'paid' | 'failed' | 'refunded';
  const providerMeta = getProviderBadgeStyle(payment.paymentProvider);
  const isDeleted = payment.logicalStatus === 'deleted';

  const handleCopyTransactionId = () => {
    if (!payment.transactionId) return;
    navigator.clipboard.writeText(payment.transactionId);
    setCopiedTxn(true);
    setTimeout(() => setCopiedTxn(false), 2000);
  };

  const handleQuickStatus = async (next: 'pending' | 'paid' | 'failed' | 'refunded') => {
    if (isUpdating || isDeleted) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(payment.id, next);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSyncGateway = async () => {
    if (isSyncing || isDeleted) return;
    setIsSyncing(true);
    try {
      await onSyncGateway(payment.id);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDispatchRefund = async () => {
    if (isRefunding || isDeleted || statusKey !== 'paid') return;
    setRefundError(null);
    const totalAmount = Number(payment.amount || 0);
    const targetRefund =
      refundMode === 'full' ? totalAmount : Number(partialAmount);

    if (isNaN(targetRefund) || targetRefund <= 0 || targetRefund > totalAmount) {
      setRefundError(`Enter a valid refund amount between $0.01 and $${totalAmount.toFixed(2)}.`);
      return;
    }

    setIsRefunding(true);
    try {
      await onRefundPayment(payment.id, targetRefund, refundReason.trim() || undefined);
      setRefundReason('');
      setPartialAmount('');
      setRefundMode('full');
    } catch (err: unknown) {
      setRefundError(err instanceof Error ? err.message : 'Failed to process refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <SideDrawer
      onClose={onClose}
      title={`#PAY-${payment.id} — Payment Audit Details`}
      subtitle="Gateway transaction token, settlement status, and relational web order binding"
      maxWidth={540}
    >
      <div className="flex flex-col gap-5 p-1 font-sans">
        {/* Top Banner: Order Link & Logical Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f8f5ee] border border-[#e8e2d8] rounded-xl p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] font-poppins">
              Bound Web Order
            </span>
            <button
              type="button"
              onClick={() => onNavigateToOrder?.(payment.onlineOrderId)}
              className="inline-flex items-center gap-1.5 font-poppins font-bold text-sm text-[#ae001a] hover:underline cursor-pointer w-fit"
            >
              <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
              <span>#ONL-{payment.onlineOrderId}</span>
              {orderLabel && <span className="text-xs text-[#5f5e5e] font-normal">({orderLabel})</span>}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isDeleted ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-red-100 text-red-800 border border-red-200 font-poppins">
                DELETED
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 font-poppins">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Charged Amount Card */}
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#76736a] font-poppins">
              Charged Amount
            </div>
            <div className="text-2xl font-extrabold text-[#1d1c17] font-poppins mt-0.5">
              ${Number(payment.amount || 0).toFixed(2)}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {statusKey === 'paid' && (
              <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs font-bold px-3 py-1 rounded-full font-poppins inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                Settlement Complete
              </span>
            )}
            {statusKey === 'pending' && (
              <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-xs font-bold px-3 py-1 rounded-full font-poppins inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
                Processing
              </span>
            )}
            {statusKey === 'failed' && (
              <span className="bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 text-xs font-bold px-3 py-1 rounded-full font-poppins inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                Gateway Declined
              </span>
            )}
            {statusKey === 'refunded' && (
              <span className="bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30 text-xs font-bold px-3 py-1 rounded-full font-poppins inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                Payment Refunded
              </span>
            )}
          </div>
        </div>

        {/* Gateway Provider & External Transaction Reference */}
        <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
              Gateway & Transaction Reference
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border font-poppins ${providerMeta.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{providerMeta.icon}</span>
              <span>{providerMeta.label}</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#fcfcfb] border border-[#d5cfc4] rounded-lg px-3 py-2">
            <code className="font-mono text-xs text-[#1d1c17] break-all">
              {payment.transactionId}
            </code>
            <button
              type="button"
              onClick={handleCopyTransactionId}
              className="text-[#5f5e5e] hover:text-[#ae001a] transition-colors duration-200 cursor-pointer shrink-0 flex items-center gap-1 text-[11px] font-semibold"
              title="Copy transaction ID"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copiedTxn ? 'check' : 'content_copy'}
              </span>
              <span>{copiedTxn ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {!isDeleted && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void handleSyncGateway()}
              className="w-full py-2 px-3 rounded-lg bg-[#f8f5ee] hover:bg-[#ece8e0] border border-[#d5cfc4] text-xs font-bold text-[#1d1c17] hover:text-[#ae001a] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 font-poppins"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin text-[#ae001a]' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Verifying with Gateway...' : 'Sync & Re-check Gateway Status'}</span>
            </button>
          )}
        </div>

        {/* Quick Settlement Transition Controls */}
        {!isDeleted && (
          <div className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-xs space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
              Settlement Status Override
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isUpdating || statusKey === 'pending'}
                onClick={() => void handleQuickStatus('pending')}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer font-poppins ${
                  statusKey === 'pending'
                    ? 'bg-[#f59e0b] text-white border-[#f59e0b]'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 disabled:opacity-50'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                disabled={isUpdating || statusKey === 'paid'}
                onClick={() => void handleQuickStatus('paid')}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer font-poppins ${
                  statusKey === 'paid'
                    ? 'bg-[#10b981] text-white border-[#10b981]'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 disabled:opacity-50'
                }`}
              >
                Mark Paid
              </button>
              <button
                type="button"
                disabled={isUpdating || statusKey === 'failed'}
                onClick={() => void handleQuickStatus('failed')}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer font-poppins ${
                  statusKey === 'failed'
                    ? 'bg-[#ef4444] text-white border-[#ef4444]'
                    : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 disabled:opacity-50'
                }`}
              >
                Declined
              </button>
              <button
                type="button"
                disabled={isUpdating || statusKey === 'refunded'}
                onClick={() => void handleQuickStatus('refunded')}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer font-poppins ${
                  statusKey === 'refunded'
                    ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                    : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 disabled:opacity-50'
                }`}
              >
                Refunded
              </button>
            </div>
            <p className="text-[10px] text-[#8c857b]">
              Shifting status to Paid or Refunded automatically records the processing timestamp and syncs parent order payment status.
            </p>
          </div>
        )}

        {/* Refund Dispatch Controller (Full / Partial Refunds for Settled Payments) */}
        {!isDeleted && statusKey === 'paid' && (
          <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-800 font-poppins">
                <span className="material-symbols-outlined text-[16px]">undo</span>
                <span>Refund Dispatch Controller</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Max: ${Number(payment.amount || 0).toFixed(2)}
              </span>
            </div>

            {refundError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-[11px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-red-600">error</span>
                <span>{refundError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundMode('full')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer font-poppins ${
                  refundMode === 'full'
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-[#fcfcfb] text-[#5f5e5e] border-[#d5cfc4] hover:border-purple-400'
                }`}
              >
                Full Refund (${Number(payment.amount || 0).toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => setRefundMode('partial')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer font-poppins ${
                  refundMode === 'partial'
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-[#fcfcfb] text-[#5f5e5e] border-[#d5cfc4] hover:border-purple-400'
                }`}
              >
                Partial Refund
              </button>
            </div>

            {refundMode === 'partial' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
                  Partial Refund Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(payment.amount || 0).toFixed(2)}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder={`0.01 - ${Number(payment.amount || 0).toFixed(2)}`}
                  className="w-full h-[36px] px-3 text-xs font-mono font-bold rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-purple-600 text-[#1d1c17]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] font-poppins">
                Refund Reason (Optional)
              </label>
              <input
                type="text"
                maxLength={250}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Customer cancelled item, duplicate charge..."
                className="w-full h-[34px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] focus:outline-none focus:border-purple-600 text-[#1d1c17]"
              />
            </div>

            <button
              type="button"
              disabled={isRefunding}
              onClick={() => void handleDispatchRefund()}
              className="w-full py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs font-poppins"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isRefunding ? 'sync' : 'undo'}
              </span>
              <span>
                {isRefunding
                  ? 'Dispatching Refund...'
                  : refundMode === 'full'
                  ? `Execute Full Refund ($${Number(payment.amount || 0).toFixed(2)})`
                  : 'Execute Partial Refund'}
              </span>
            </button>
          </div>
        )}

        {/* Audit Timestamps */}
        <div className="bg-[#f8f5ee] border border-[#e8e2d8] rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5f5e5e] font-semibold">Processed At:</span>
            <span className="font-mono text-[#1d1c17]">
              {payment.processedAt ? new Date(payment.processedAt).toLocaleString() : 'Not settled yet'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5f5e5e] font-semibold">Created At:</span>
            <span className="font-mono text-[#1d1c17]">
              {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5f5e5e] font-semibold">Last Updated:</span>
            <span className="font-mono text-[#1d1c17]">
              {payment.updatedAt ? new Date(payment.updatedAt).toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e8e2d8]">
          {isDeleted ? (
            <button
              type="button"
              onClick={() => void onRestorePayment(payment)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer font-poppins"
            >
              <span className="material-symbols-outlined text-[16px]">restore_from_trash</span>
              <span>Restore Payment</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onDeletePayment(payment)}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer font-poppins"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Void Payment</span>
            </button>
          )}

          {!isDeleted && (
            <button
              type="button"
              onClick={() => onEditPayment(payment)}
              className="px-4 py-2 bg-[#ae001a] hover:bg-[#d2272f] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer font-poppins"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Payment</span>
            </button>
          )}
        </div>
      </div>
    </SideDrawer>
  );
};
