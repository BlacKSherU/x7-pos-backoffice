import React, { useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';

export interface OnlineOrderItemData {
  id: number;
  onlineOrderId: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  modifiers: Record<string, unknown> | null;
  notes: string | null;
  status: 'active' | 'deleted';
  orderItemId: number | null;
  kitchenLineStatus: 'PENDING' | 'IN_PREPARATION' | 'READY' | 'SERVED' | null;
  createdAt: string;
  updatedAt: string;
  onlineOrder?: {
    id: number;
    status: string;
  };
  product?: {
    id: number;
    name: string;
    sku?: string;
    basePrice: number;
  };
  variant?: {
    id: number;
    name: string;
    price: number;
    sku?: string;
  } | null;
}

export interface OnlineOrderItemDetailsDrawerProps {
  isOpen: boolean;
  item: OnlineOrderItemData | null;
  onClose: () => void;
  onUpdateKitchenStatus?: (itemId: number, newStatus: string) => Promise<void>;
  onEditItem?: (item: OnlineOrderItemData) => void;
  onDeleteItem?: (item: OnlineOrderItemData) => void;
  onRestoreItem?: (item: OnlineOrderItemData) => void;
  onNavigateToOrder?: (orderId: number) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const OnlineOrderItemDetailsDrawer: React.FC<OnlineOrderItemDetailsDrawerProps> = ({
  isOpen,
  item,
  onClose,
  onUpdateKitchenStatus,
  onEditItem,
  onDeleteItem,
  onRestoreItem,
  onNavigateToOrder,
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const currentKitchenStatus = (item.kitchenLineStatus || 'PENDING').toUpperCase();
  const lineSubtotal = (item.quantity || 1) * (item.unitPrice || 0);

  const handleStatusChange = async (targetStatus: string) => {
    if (!onUpdateKitchenStatus) return;
    setStatusError(null);
    setIsUpdatingStatus(true);
    try {
      await onUpdateKitchenStatus(item.id, targetStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update kitchen line status.';
      setStatusError(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Format modifiers dictionary into key-value entries
  const modifierEntries: Array<{ key: string; value: string }> = [];
  if (item.modifiers && typeof item.modifiers === 'object' && !Array.isArray(item.modifiers)) {
    for (const [key, val] of Object.entries(item.modifiers)) {
      const formattedVal =
        typeof val === 'boolean'
          ? val ? 'Yes' : 'No'
          : typeof val === 'object' && val !== null
          ? JSON.stringify(val)
          : String(val);
      // Capitalize camelCase or snake_case key
      const readableKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      modifierEntries.push({ key: readableKey, value: formattedVal });
    }
  }

  return (
    <SideDrawer
      title={`Line Item #ORI-${item.id}`}
      subtitle={`ONLINE ORDER #ONL-${item.onlineOrderId}`}
      onClose={onClose}
      maxWidth={640}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#faf8f5] text-left">
        {statusError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{statusError}</span>
          </div>
        )}

        {/* 1. Header Badges & Core Relational Mapping */}
        <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-[#222222] text-white px-2.5 py-1 rounded">
                #ORI-{item.id}
              </span>
              <button
                type="button"
                onClick={() => onNavigateToOrder?.(item.onlineOrderId)}
                className="font-mono text-xs font-bold text-[#ae001a] bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="View Online Order"
              >
                <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
                <span>#ONL-{item.onlineOrderId}</span>
              </button>
            </div>

            {/* Lifecycle Status */}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                item.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {item.status.toUpperCase()}
            </span>
          </div>

          {/* POS Relational Binding */}
          <div className="pt-2 border-t border-[#f2ede5] flex items-center justify-between text-xs">
            <span className="text-[#5f5e5e] font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#ae001a]">point_of_sale</span>
              <span>POS Core Order Item:</span>
            </span>
            {item.orderItemId ? (
              <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">link</span>
                <span>#POS-ITEM-{item.orderItemId}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                <span className="material-symbols-outlined text-[13px] text-slate-400">link_off</span>
                <span>Unmapped (Web-Only Line)</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Product, Variant & Quantity Breakdown */}
        <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
          <div className="bg-[#f8f5ee] px-4 py-3 border-b border-[#e8e2d8] flex items-center justify-between">
            <div className="text-xs font-bold text-[#1d1c17] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ae001a] text-base">lunch_dining</span>
              <span>Item Specifications</span>
            </div>
            <span className="font-mono text-xs font-bold text-[#ae001a]">
              Subtotal: {formatCurrency(lineSubtotal)}
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-[#1d1c17]">
                  {item.product?.name || `Product #${item.productId}`}
                </h4>
                {item.product?.sku && (
                  <div className="text-[11px] font-mono text-[#5f5e5e] mt-0.5">
                    SKU: {item.product.sku}
                  </div>
                )}
                {item.variant && (
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded mt-2">
                    <span className="material-symbols-outlined text-[13px]">tune</span>
                    <span>Variant: {item.variant.name}</span>
                    {item.variant.sku && <span className="font-mono text-[10px]">({item.variant.sku})</span>}
                  </div>
                )}
              </div>

              <div className="text-right shrink-0">
                <div className="inline-flex items-center justify-center bg-[#222222] text-white font-mono font-bold text-sm px-3 py-1 rounded">
                  Qty: {item.quantity}
                </div>
                <div className="text-[11px] font-mono text-[#5f5e5e] mt-1">
                  {formatCurrency(item.unitPrice)} each
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Custom Modifiers (JSONB) */}
        <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
          <div className="bg-[#f8f5ee] px-4 py-3 border-b border-[#e8e2d8] flex items-center justify-between">
            <div className="text-xs font-bold text-[#1d1c17] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ae001a] text-base">format_list_bulleted</span>
              <span>Modifiers & Customizations</span>
            </div>
            {modifierEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[11px] text-[#ae001a] hover:underline font-medium cursor-pointer"
              >
                {showRawJson ? 'View Tags' : 'View JSON'}
              </button>
            )}
          </div>

          <div className="p-4">
            {modifierEntries.length > 0 ? (
              showRawJson ? (
                <pre className="bg-[#1d1c17] text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(item.modifiers, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {modifierEntries.map((mod, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-[#f4efe6] border border-[#d5cfc4] text-[#1d1c17] text-xs font-semibold px-2.5 py-1 rounded-md shadow-2xs"
                    >
                      <span className="text-[#ae001a] font-bold">{mod.key}:</span>
                      <span>{mod.value}</span>
                    </span>
                  ))}
                </div>
              )
            ) : (
              <div className="text-xs text-[#8c857b] italic flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>No custom modifiers specified for this line item.</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Special Preparation Notes */}
        {item.notes ? (
          <div className="bg-amber-100/90 border-2 border-amber-500 rounded-xl p-4 shadow-xs flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-lg">speaker_notes</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-800">priority_high</span>
                <span>PREPARATION NOTES / CUSTOM INSTRUCTIONS</span>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-1.5 italic whitespace-pre-wrap bg-white/80 p-2.5 rounded-lg border border-amber-300 shadow-2xs">
                "{item.notes}"
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-3 rounded-xl border border-[#e8e2d8] text-xs text-[#8c857b] flex items-center gap-2 italic">
            <span className="material-symbols-outlined text-sm text-[#8c857b]">speaker_notes_off</span>
            <span>No special cooking or prep instructions attached.</span>
          </div>
        )}

        {/* 5. Kitchen Preparation Status Mirroring Engine */}
        <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#1d1c17] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ae001a] text-base">skillet</span>
              <span>Kitchen Preparation Status</span>
            </div>
            <span className="text-[10px] text-[#8c857b] font-mono">Live KDS Mirror</span>
          </div>

          {/* Current Status Banner */}
          <div className="p-3.5 rounded-lg border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  currentKitchenStatus === 'READY'
                    ? 'bg-emerald-500 shadow-xs ring-4 ring-emerald-100'
                    : currentKitchenStatus === 'IN_PREPARATION'
                    ? 'bg-amber-500 animate-pulse ring-4 ring-amber-100'
                    : currentKitchenStatus === 'SERVED'
                    ? 'bg-purple-500 ring-4 ring-purple-100'
                    : 'bg-blue-500 ring-4 ring-blue-100'
                }`}
              />
              <span className="text-xs font-bold text-[#1d1c17]">Current Line Stage:</span>
            </div>

            {/* Pill styling matching user story specs */}
            {currentKitchenStatus === 'PENDING' && (
              <span className="bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-bold px-3 py-1 rounded font-poppins">
                Pending Prep
              </span>
            )}
            {currentKitchenStatus === 'IN_PREPARATION' && (
              <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-xs font-bold px-3 py-1 rounded animate-pulse font-poppins">
                Cooking
              </span>
            )}
            {currentKitchenStatus === 'READY' && (
              <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs font-bold px-3 py-1 rounded font-poppins">
                Line Ready
              </span>
            )}
            {currentKitchenStatus === 'SERVED' && (
              <span className="bg-purple-100 text-purple-800 border border-purple-300 text-xs font-bold px-3 py-1 rounded font-poppins">
                Served
              </span>
            )}
          </div>

          {/* Manual Prep Stage Transitions */}
          {onUpdateKitchenStatus && (
            <div className="pt-2 border-t border-[#f2ede5]">
              <div className="text-[11px] font-bold text-[#5f5e5e] uppercase tracking-wider mb-2">
                Override Prep Stage (Expeditor Controls):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={isUpdatingStatus || currentKitchenStatus === 'PENDING'}
                  onClick={() => handleStatusChange('pending')}
                  className="px-2.5 py-2 text-xs font-bold rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Pending
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus || currentKitchenStatus === 'IN_PREPARATION'}
                  onClick={() => handleStatusChange('in_preparation')}
                  className="px-2.5 py-2 text-xs font-bold rounded border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Cooking
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus || currentKitchenStatus === 'READY'}
                  onClick={() => handleStatusChange('ready')}
                  className="px-2.5 py-2 text-xs font-bold rounded border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Ready
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus || currentKitchenStatus === 'SERVED'}
                  onClick={() => handleStatusChange('served')}
                  className="px-2.5 py-2 text-xs font-bold rounded border border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Served
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 6. Timestamps & Audit */}
        <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs text-xs space-y-2 font-mono">
          <div className="flex justify-between items-center text-[#5f5e5e]">
            <span>Created At:</span>
            <span className="font-bold text-[#1d1c17]">{formatDateTime(item.createdAt)}</span>
          </div>
          <div className="flex justify-between items-center text-[#5f5e5e]">
            <span>Last Updated:</span>
            <span className="font-bold text-[#1d1c17]">{formatDateTime(item.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white p-4 border-t border-[#e8e2d8] flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 border border-[#e8e2d8] rounded font-semibold text-xs text-[#1d1c17] hover:bg-[#f8f5ee] transition-colors cursor-pointer"
        >
          Close
        </button>

        <div className="flex items-center gap-2">
          {onRestoreItem && item.status === 'deleted' && (
            <button
              type="button"
              onClick={() => onRestoreItem(item)}
              className="h-10 px-3.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">restore_from_trash</span>
              <span>Restore Line</span>
            </button>
          )}

          {onDeleteItem && item.status === 'active' && (
            <button
              type="button"
              onClick={() => onDeleteItem(item)}
              className="h-10 px-3.5 border border-red-200 text-red-700 hover:bg-red-50 rounded text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Void line item and sync deletion to KDS screen"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              <span>Void Line</span>
            </button>
          )}

          {onEditItem && (
            <button
              type="button"
              onClick={() => onEditItem(item)}
              className="h-10 px-4 bg-[#ae001a] hover:bg-[#d2272f] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Configure Line</span>
            </button>
          )}
        </div>
      </div>
    </SideDrawer>
  );
};
