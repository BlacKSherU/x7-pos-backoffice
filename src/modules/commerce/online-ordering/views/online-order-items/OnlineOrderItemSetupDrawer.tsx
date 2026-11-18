import React, { useState, useMemo } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { type OnlineOrderItemData } from './OnlineOrderItemDetailsDrawer';

export interface OnlineOrderOption {
  id: number;
  customerName?: string;
  storeName?: string;
  fulfillmentStatus?: string;
}

export interface InventoryProductOption {
  id: number;
  name: string;
  sku?: string;
  basePrice: number;
}

export interface InventoryVariantOption {
  id: number;
  productId: number;
  name: string;
  sku?: string;
  price: number;
}

export interface OnlineOrderItemFormData {
  id?: number;
  onlineOrderId: number;
  productId: number;
  variantId?: number | null;
  quantity: number;
  modifiers?: Record<string, unknown> | null;
  notes?: string | null;
  kitchenLineStatus?: string | null;
  status?: 'active' | 'deleted';
}

export interface OnlineOrderItemSetupDrawerProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: OnlineOrderItemData | null;
  orders: OnlineOrderOption[];
  products: InventoryProductOption[];
  variants: InventoryVariantOption[];
  onClose: () => void;
  onSubmit: (formData: OnlineOrderItemFormData) => Promise<void>;
}

export const OnlineOrderItemSetupDrawer: React.FC<OnlineOrderItemSetupDrawerProps> = ({
  isOpen,
  mode,
  initialData,
  orders,
  products,
  variants,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <OnlineOrderItemSetupDrawerContent
      key={`${mode}-${initialData?.id ?? 'new'}`}
      mode={mode}
      initialData={initialData}
      orders={orders}
      products={products}
      variants={variants}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};

interface ContentProps {
  mode: 'create' | 'edit';
  initialData?: OnlineOrderItemData | null;
  orders: OnlineOrderOption[];
  products: InventoryProductOption[];
  variants: InventoryVariantOption[];
  onClose: () => void;
  onSubmit: (formData: OnlineOrderItemFormData) => Promise<void>;
}

interface ModifierTagItem {
  key: string;
  value: string;
}

const OnlineOrderItemSetupDrawerContent: React.FC<ContentProps> = ({
  mode,
  initialData,
  orders,
  products,
  variants,
  onClose,
  onSubmit,
}) => {
  // Search state for orders
  const [orderSearch, setOrderSearch] = useState<string>('');

  const [selectedOrderId, setSelectedOrderId] = useState<number | ''>(() => {
    return initialData?.onlineOrderId ?? (orders[0]?.id ?? '');
  });

  const [selectedProductId, setSelectedProductId] = useState<number | ''>(() => {
    return initialData?.productId ?? (products[0]?.id ?? '');
  });

  const [selectedVariantId, setSelectedVariantId] = useState<number | ''>(() => {
    return initialData?.variantId ?? '';
  });

  const [quantity, setQuantity] = useState<number>(() => {
    return initialData?.quantity ?? 1;
  });

  const [notes, setNotes] = useState<string>(() => {
    return initialData?.notes ?? '';
  });

  // Logical Lifecycle Status
  const [status, setStatus] = useState<'active' | 'deleted'>(() => {
    return initialData?.status ?? 'active';
  });

  // Kitchen Line Status
  const [kitchenLineStatus, setKitchenLineStatus] = useState<string>(() => {
    return (initialData?.kitchenLineStatus || 'PENDING').toUpperCase();
  });

  // Modifiers Editor: Visual Tags vs Raw JSON
  const [modifierEditorMode, setModifierEditorMode] = useState<'visual' | 'json'>('visual');
  const [modifierTags, setModifierTags] = useState<ModifierTagItem[]>(() => {
    if (initialData?.modifiers && typeof initialData.modifiers === 'object' && !Array.isArray(initialData.modifiers)) {
      return Object.entries(initialData.modifiers).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
    }
    return [];
  });

  const [rawModifiersJson, setRawModifiersJson] = useState<string>(() => {
    if (initialData?.modifiers && Object.keys(initialData.modifiers).length > 0) {
      try {
        return JSON.stringify(initialData.modifiers, null, 2);
      } catch {
        return '';
      }
    }
    return '';
  });

  // New tag draft inputs
  const [newTagKey, setNewTagKey] = useState<string>('');
  const [newTagValue, setNewTagValue] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered orders list based on search
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const term = orderSearch.toLowerCase().trim();
    return orders.filter(
      (o) =>
        `#onl-${o.id}`.toLowerCase().includes(term) ||
        String(o.id).includes(term) ||
        (o.customerName && o.customerName.toLowerCase().includes(term)) ||
        (o.storeName && o.storeName.toLowerCase().includes(term)) ||
        (o.fulfillmentStatus && o.fulfillmentStatus.toLowerCase().includes(term))
    );
  }, [orders, orderSearch]);

  // Available variants for selected product
  const availableVariants = useMemo(() => {
    if (!selectedProductId) return [];
    return variants.filter((v) => v.productId === Number(selectedProductId));
  }, [variants, selectedProductId]);

  // Selected product object
  const currentProduct = useMemo(() => {
    return products.find((p) => p.id === Number(selectedProductId));
  }, [products, selectedProductId]);

  // Selected variant object
  const currentVariant = useMemo(() => {
    return variants.find((v) => v.id === Number(selectedVariantId));
  }, [variants, selectedVariantId]);

  // Calculated unit price & total
  const unitPrice = currentVariant?.price ?? currentProduct?.basePrice ?? 0;
  const lineSubtotal = unitPrice * (quantity > 0 ? quantity : 1);

  // Sync visual tags to JSON string
  const syncTagsToJson = (tags: ModifierTagItem[]) => {
    if (tags.length === 0) {
      setRawModifiersJson('');
      return;
    }
    const obj: Record<string, unknown> = {};
    for (const tag of tags) {
      if (!tag.key.trim()) continue;
      const trimmedVal = tag.value.trim();
      if (trimmedVal.toLowerCase() === 'true') {
        obj[tag.key.trim()] = true;
      } else if (trimmedVal.toLowerCase() === 'false') {
        obj[tag.key.trim()] = false;
      } else if (!isNaN(Number(trimmedVal)) && trimmedVal !== '') {
        obj[tag.key.trim()] = Number(trimmedVal);
      } else {
        obj[tag.key.trim()] = trimmedVal;
      }
    }
    setRawModifiersJson(JSON.stringify(obj, null, 2));
  };

  // Add a modifier tag
  const handleAddModifierTag = () => {
    if (!newTagKey.trim()) return;
    const updated = [...modifierTags, { key: newTagKey.trim(), value: newTagValue.trim() || 'true' }];
    setModifierTags(updated);
    syncTagsToJson(updated);
    setNewTagKey('');
    setNewTagValue('');
  };

  // Remove a modifier tag
  const handleRemoveModifierTag = (indexToRemove: number) => {
    const updated = modifierTags.filter((_, idx) => idx !== indexToRemove);
    setModifierTags(updated);
    syncTagsToJson(updated);
  };

  // When switching from JSON mode to visual mode, re-parse tags
  const handleSwitchToVisual = () => {
    if (rawModifiersJson.trim()) {
      try {
        const parsed = JSON.parse(rawModifiersJson);
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          const newTags: ModifierTagItem[] = Object.entries(parsed).map(([k, v]) => ({
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          }));
          setModifierTags(newTags);
          setFormError(null);
        }
      } catch {
        setFormError('Cannot switch to tag editor: Modifiers textarea contains invalid JSON.');
        return;
      }
    } else {
      setModifierTags([]);
    }
    setModifierEditorMode('visual');
  };

  // Insert sample modifiers
  const handleInsertSample = () => {
    const sampleTags = [
      { key: 'extraSauce', value: 'true' },
      { key: 'size', value: 'large' },
      { key: 'dressing', value: 'ranch' },
    ];
    setModifierTags(sampleTags);
    syncTagsToJson(sampleTags);
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedOrderId || Number(selectedOrderId) <= 0) {
      setFormError('Please select a valid target Online Order.');
      return;
    }

    if (!selectedProductId || Number(selectedProductId) <= 0) {
      setFormError('Please select a product from the catalog.');
      return;
    }

    // Positive integer validation: quantity >= 1
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFormError('Quantity must be an integer greater than or equal to 1.');
      return;
    }

    // JSONB object validation
    let parsedModifiers: Record<string, unknown> | null = null;
    if (rawModifiersJson.trim()) {
      try {
        const parsed = JSON.parse(rawModifiersJson);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          setFormError('Modifiers JSON must be a valid key-value object (e.g., {"extraSauce": true}).');
          return;
        }
        parsedModifiers = parsed as Record<string, unknown>;
      } catch {
        setFormError('Modifiers field contains invalid JSON syntax. Please verify quotes and brackets.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: initialData?.id,
        onlineOrderId: Number(selectedOrderId),
        productId: Number(selectedProductId),
        variantId: selectedVariantId ? Number(selectedVariantId) : null,
        quantity,
        notes: notes.trim() ? notes.trim() : null,
        modifiers: parsedModifiers,
        kitchenLineStatus,
        status,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving line item.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      title={mode === 'create' ? 'Add Online Order Item Line' : `Edit Item Line #ORI-${initialData?.id}`}
      subtitle="ONLINE ORDER ITEM CONFIGURATION DRAWER"
      onClose={onClose}
      closeDisabled={isSubmitting}
      maxWidth={680}
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-[#faf8f5] text-left font-sans">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Searchable Target Online Order Selector */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
                Online Order Selection <span className="text-[#ae001a]">*</span>
              </label>
              {initialData?.orderItemId && (
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                  POS Bound: #POS-ITEM-{initialData.orderItemId}
                </span>
              )}
            </div>

            {mode === 'create' && (
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#76736a]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter orders by #ONL, customer name, store..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-[#fcfcfb] rounded-md border border-[#d5cfc4] text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                />
              </div>
            )}

            <select
              value={selectedOrderId}
              disabled={mode === 'edit'}
              onChange={(e) => setSelectedOrderId(Number(e.target.value))}
              className="w-full h-10 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs font-medium text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
            >
              <option value="" disabled>
                {filteredOrders.length === 0 ? 'No matching online orders' : 'Select target Online Order...'}
              </option>
              {filteredOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #ONL-{o.id} {o.customerName ? `— ${o.customerName}` : ''} ({o.fulfillmentStatus || 'ACTIVE'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Product & Variant Selection */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5">
                Product Selection <span className="text-[#ae001a]">*</span>
              </label>
              <select
                value={selectedProductId}
                disabled={Boolean(initialData?.orderItemId)}
                onChange={(e) => {
                  setSelectedProductId(Number(e.target.value));
                  setSelectedVariantId('');
                }}
                className="w-full h-10 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs font-medium text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
              >
                <option value="" disabled>Select a catalog product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `[${p.sku}]` : ''} — ${Number(p.basePrice).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Variant Selection */}
            {availableVariants.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5">
                  Variant Selection (Optional)
                </label>
                <select
                  value={selectedVariantId}
                  disabled={Boolean(initialData?.orderItemId)}
                  onChange={(e) => setSelectedVariantId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs font-medium text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                >
                  <option value="">No Variant (Base Product)</option>
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.sku ? `[${v.sku}]` : ''} — ${Number(v.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity Input with Integrity Enforcement (>= 1) */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f2ede5]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17] mb-1.5">
                  Quantity Input (Integer $\ge 1$) <span className="text-[#ae001a]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  disabled={Boolean(initialData?.orderItemId)}
                  value={quantity}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setQuantity(isNaN(parsed) ? 1 : Math.max(1, parsed));
                  }}
                  className="w-full h-10 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs font-mono font-bold text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5f5e5e] mb-1.5">
                  Calculated Line Total
                </label>
                <div className="h-10 px-3 bg-[#f2ede5] rounded-lg border border-[#e8e2d8] flex items-center font-mono font-bold text-sm text-[#ae001a]">
                  ${lineSubtotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Modifiers JSON Inspector & Visual Tree / Tag Editor */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
                  Modifiers JSON Inspector & Tag Editor
                </label>
                <p className="text-[11px] text-[#5f5e5e]">
                  Structured JSONB payload for customized toppings, sizing, and dressing options.
                </p>
              </div>

              {/* Mode Switcher & Insert Sample */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSample}
                  className="text-[11px] font-semibold text-[#ae001a] hover:underline cursor-pointer"
                  title="Insert sample modifier payload"
                >
                  Sample
                </button>
                <div className="flex items-center bg-[#f2ede5] p-0.5 rounded-md border border-[#e8e2d8]">
                  <button
                    type="button"
                    onClick={handleSwitchToVisual}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                      modifierEditorMode === 'visual'
                        ? 'bg-white text-[#1d1c17] shadow-2xs'
                        : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                    }`}
                  >
                    Tags
                  </button>
                  <button
                    type="button"
                    onClick={() => setModifierEditorMode('json')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                      modifierEditorMode === 'json'
                        ? 'bg-white text-[#1d1c17] shadow-2xs'
                        : 'text-[#5f5e5e] hover:text-[#1d1c17]'
                    }`}
                  >
                    JSON Tree
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Tag Mode */}
            {modifierEditorMode === 'visual' ? (
              <div className="space-y-3">
                {/* Active Modifier Tags Chips */}
                {modifierTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-[#faf8f5] rounded-lg border border-[#e8e2d8]">
                    {modifierTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-white border border-[#d5cfc4] text-[#1d1c17] text-xs font-semibold px-2.5 py-1 rounded-md shadow-2xs"
                      >
                        <span className="text-[#ae001a] font-bold">{tag.key}:</span>
                        <span>{tag.value}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveModifierTag(idx)}
                          className="text-[#8c857b] hover:text-[#ae001a] transition-colors ml-1 font-bold text-xs cursor-pointer"
                          title="Remove modifier"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-[#8c857b] bg-[#faf8f5] rounded-lg border border-dashed border-[#d5cfc4] italic">
                    No custom modifier tags currently added. Use the input below to add one.
                  </div>
                )}

                {/* Add New Tag Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Modifier key (e.g. extraSauce)"
                    value={newTagKey}
                    onChange={(e) => setNewTagKey(e.target.value)}
                    className="flex-1 min-w-[140px] h-9 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. true, ranch, large)"
                    value={newTagValue}
                    onChange={(e) => setNewTagValue(e.target.value)}
                    className="flex-1 min-w-[140px] h-9 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a]"
                  />
                  <button
                    type="button"
                    onClick={handleAddModifierTag}
                    className="h-9 px-3.5 bg-[#222222] hover:bg-[#333333] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add Tag</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Raw JSON Tree Inspector */
              <div>
                <textarea
                  rows={5}
                  value={rawModifiersJson}
                  onChange={(e) => setRawModifiersJson(e.target.value)}
                  placeholder='{\n  "extraSauce": true,\n  "size": "large",\n  "dressing": "ranch"\n}'
                  className="w-full p-3 font-mono text-xs bg-[#1d1c17] text-emerald-400 rounded-lg border border-[#d5cfc4] focus:outline-none focus:ring-1 focus:ring-[#ae001a]/40 placeholder:text-slate-500"
                />
              </div>
            )}
          </div>

          {/* 4. Item Preparation Notes */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
              Item Preparation Notes (Special Instructions)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., No onions, extra crispy fries, dressing packed separately."
              className="w-full p-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 placeholder:text-[#8c857b]"
            />
          </div>

          {/* 5. Kitchen Line Status Dropdown */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
              Kitchen Line Status Dropdown (Manual Prep Override)
            </label>
            <select
              value={kitchenLineStatus}
              onChange={(e) => setKitchenLineStatus(e.target.value)}
              className="w-full h-10 px-3 bg-[#fcfcfb] rounded-lg border border-[#d5cfc4] text-xs font-bold text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 cursor-pointer"
            >
              <option value="PENDING">PENDING — Info Blue (Pending Prep)</option>
              <option value="IN_PREPARATION">IN_PREPARATION — Warning Amber (Cooking)</option>
              <option value="READY">READY — Success Green (Line Ready)</option>
              <option value="SERVED">SERVED — Purple (Served)</option>
            </select>
          </div>

          {/* 6. Logical Status Selector & Kitchen Void Notice */}
          <div className="bg-white p-4 rounded-xl border border-[#e8e2d8] shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
              Logical Status Selector (Lifecycle / Void Control)
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'deleted')}
              className={`w-full h-10 px-3 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                status === 'deleted'
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              <option value="active">ACTIVE — Visible in Active Kitchen & POS Queue</option>
              <option value="deleted">DELETED — Voided / Cancelled (Clears from KDS Screen)</option>
            </select>
            <p className="text-[11px] text-[#5f5e5e] italic">
              {status === 'deleted'
                ? '⚠️ Setting status = "DELETED" marks this order line as voided without purging historical records. It automatically notifies the KDS screen to clear the line item.'
                : 'Active lines appear on live kitchen display monitors and order packing screens.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white p-4 border-t border-[#e8e2d8] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 border border-[#e8e2d8] rounded font-semibold text-xs text-[#1d1c17] hover:bg-[#f8f5ee] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 px-6 bg-[#ae001a] hover:bg-[#d2272f] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {mode === 'create' ? 'add' : 'check'}
            </span>
            <span>{isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Line Item' : 'Update Line Item'}</span>
          </button>
        </div>
      </form>
    </SideDrawer>
  );
};
