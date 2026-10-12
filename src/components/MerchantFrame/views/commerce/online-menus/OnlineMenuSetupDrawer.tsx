import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface OnlineStoreOption {
  id: number;
  subdomain: string;
  is_active: boolean;
  status: string;
}

export interface OnlineMenuFormData {
  id?: number;
  storeId: number;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface OnlineMenuSetupDrawerProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: OnlineMenuFormData | null;
  stores?: OnlineStoreOption[];
  onClose: () => void;
  onSubmit: (data: OnlineMenuFormData) => Promise<void>;
}

export const OnlineMenuSetupDrawer: React.FC<OnlineMenuSetupDrawerProps> = ({
  isOpen,
  mode,
  initialData,
  stores = [],
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <OnlineMenuSetupDrawerContent
      key={`${mode}-${initialData?.id ?? 'new'}`}
      mode={mode}
      initialData={initialData}
      stores={stores}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};

interface ContentProps {
  mode: 'create' | 'edit';
  initialData?: OnlineMenuFormData | null;
  stores: OnlineStoreOption[];
  onClose: () => void;
  onSubmit: (data: OnlineMenuFormData) => Promise<void>;
}

const OnlineMenuSetupDrawerContent: React.FC<ContentProps> = ({
  mode,
  initialData,
  stores,
  onClose,
  onSubmit,
}) => {
  const [storeId, setStoreId] = useState<number>(() => {
    if (initialData?.storeId) return initialData.storeId;
    const firstActive = stores.find((s) => s.is_active && s.status === 'active') || stores[0];
    return firstActive?.id || 0;
  });
  const [name, setName] = useState<string>(initialData?.name || '');
  const [description, setDescription] = useState<string>(initialData?.description || '');
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick name suggestions for restaurant catalogs
  const SUGGESTED_NAMES = [
    'Main Dining Menu',
    'Lunch Special',
    'Dinner & Tasting Menu',
    'Happy Hour & Cocktails',
    'Weekend Brunch',
    'Dessert & Coffee',
  ];

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Menu title is required.');
      return;
    }

    if (trimmedName.length > 100) {
      setFormError('Menu title cannot exceed 100 characters.');
      return;
    }

    if (!storeId || storeId <= 0) {
      setFormError('Please select a valid Online Store channel.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        id: initialData?.id,
        storeId,
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        isActive,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save online menu.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStore = stores.find((s) => s.id === storeId);

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden font-sans">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Side Drawer Container (Pinned flush to right edge) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-drawer-title"
        className="fixed top-0 right-0 bottom-0 z-10 w-full max-w-lg bg-[#fcfbfa] shadow-2xl flex flex-col border-l border-[#e8e2d8] text-left overflow-hidden animate-slide-in"
      >
        {/* Drawer Header (Exact #1c1b16 theme) */}
        <div className="bg-[#1c1b16] px-6 py-5 flex items-center justify-between shrink-0 border-b border-[#32312b]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#ae001a] flex items-center justify-center text-white shadow-xs shrink-0">
              <span className="material-symbols-outlined text-2xl select-none" style={{ color: '#ffffff' }}>
                restaurant_menu
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="menu-drawer-title"
                  style={{ color: '#ffffff' }}
                  className="text-base font-black text-white !text-white uppercase tracking-wider leading-tight font-poppins"
                >
                  {mode === 'create' ? 'Create Digital Menu' : 'Configure Digital Menu'}
                </h2>
                <span
                  style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap"
                >
                  {mode === 'create' ? 'NEW CATALOG' : `#MNU-${initialData?.id ?? ''}`}
                </span>
              </div>
              <p style={{ color: '#a1a1aa' }} className="text-xs text-zinc-400 mt-0.5 truncate font-poppins">
                {mode === 'create'
                  ? 'Bind a digital catalog to an online storefront channel'
                  : `Editing catalog details for ${selectedStore?.subdomain || 'Store'}.x7pos.com`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined text-xl select-none">close</span>
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-[#ae001a] text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">error</span>
              <div>
                <p className="font-bold">Validation Error</p>
                <p className="mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Section 1: Store Channel Switcher (Store Catalog Switcher) */}
          <div className="p-4 bg-white rounded-xl border border-[#e8e2d8] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1d1c17] flex items-center gap-1.5 font-poppins">
                <span className="material-symbols-outlined text-base text-blue-600">storefront</span>
                Store Channel *
              </label>
              <span className="text-[10px] font-mono text-[#5f5e5e] bg-zinc-100 px-2 py-0.5 rounded">
                {mode === 'create' ? 'Channel Assignment' : 'Channel Switcher'}
              </span>
            </div>

            <div>
              <select
                value={storeId}
                onChange={(e) => setStoreId(Number(e.target.value))}
                disabled={isSubmitting || stores.length === 0}
                className="w-full px-3.5 py-2.5 bg-[#fcfcfb] border border-[#d5cfc4] rounded-lg text-xs text-[#1d1c17] font-medium focus:border-[#ae001a] focus:outline-none transition-colors font-poppins"
                required
              >
                <option value={0} disabled>
                  {stores.length === 0 ? 'No online stores available' : 'Select target storefront channel...'}
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subdomain}.x7pos.com (Store #{s.id}) — {s.is_active ? 'Active' : 'Maintenance'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#5f5e5e] mt-2 flex items-center gap-1.5 font-poppins">
                <span className="material-symbols-outlined text-sm text-[#8c857b]">info</span>
                {mode === 'create'
                  ? 'This catalog will be bound directly to the selected storefront domain.'
                  : 'Reassign this catalog to a different online storefront channel at any time.'}
              </p>
            </div>
          </div>

          {/* Section 2: Menu Title & Copy */}
          <div className="p-4 bg-white rounded-xl border border-[#e8e2d8] shadow-2xs space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1d1c17] flex items-center gap-1.5 font-poppins">
                  <span className="material-symbols-outlined text-base text-[#ae001a]">badge</span>
                  Menu Title *
                </label>
                <span className="text-[11px] text-[#8c857b] font-mono">{name.length}/100</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                placeholder="e.g. Main Dining Menu, Lunch Express, Happy Hour..."
                className="w-full px-3.5 py-2.5 bg-[#fcfcfb] border border-[#d5cfc4] rounded-lg text-xs text-[#1d1c17] font-medium placeholder-[#8c857b] focus:border-[#ae001a] focus:outline-none transition-colors font-poppins"
              />

              {/* Quick suggestions */}
              {mode === 'create' && !name && (
                <div className="mt-2.5">
                  <span className="text-[10px] font-bold text-[#8c857b] uppercase tracking-wider block mb-1.5 font-poppins">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_NAMES.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setName(sug)}
                        className="px-2.5 py-1 text-[11px] rounded bg-zinc-100 hover:bg-zinc-200 text-[#1d1c17] border border-[#d5cfc4] transition-colors cursor-pointer font-poppins"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1d1c17] flex items-center gap-1.5 font-poppins">
                  <span className="material-symbols-outlined text-base text-[#5f5e5e]">description</span>
                  Description (optional)
                </label>
                <span className="text-[10px] text-[#8c857b] italic font-poppins">Optional</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe serving hours, dietary highlights, or specialty offerings (e.g. Available daily from 12:00 to 16:00)..."
                className="w-full px-3.5 py-2.5 bg-[#fcfcfb] border border-[#d5cfc4] rounded-lg text-xs text-[#1d1c17] placeholder-[#8c857b] focus:border-[#ae001a] focus:outline-none transition-colors resize-none font-poppins leading-relaxed"
              />
              <p className="text-[11px] text-[#8c857b] mt-1 font-poppins">
                Displayed to customers in storefront navigation headers and catalog views.
              </p>
            </div>
          </div>

          {/* Section 3: Publication Status (is_active) */}
          <div className="p-4 bg-white rounded-xl border border-[#e8e2d8] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1d1c17] flex items-center gap-2 font-poppins">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: isActive ? '#10b981' : '#64748b' }}
                  />
                  Publication Availability
                </span>
                <p className="text-[11px] text-[#5f5e5e] mt-0.5 font-poppins">
                  Controls live catalog visibility on the public online ordering storefront.
                </p>
              </div>

              {/* Status Pill & Toggle Switch */}
              <div className="flex items-center gap-3">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wide uppercase shadow-2xs"
                  style={{ backgroundColor: isActive ? '#10b981' : '#64748b' }}
                >
                  {isActive ? 'Published' : 'Draft / Inactive'}
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isActive ? 'bg-[#10b981]' : 'bg-[#64748b]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#fcfcfb] border border-[#e8e2d8] text-[11px] text-[#5f5e5e] flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-emerald-600 mt-0.5">verified</span>
              <div>
                <strong className="text-[#1d1c17]">High-Performance Storefront: </strong>
                Optimized for instant catalog rendering on public storefronts with multi-menu support per store.
              </div>
            </div>
          </div>
        </form>

        {/* Drawer Fixed Footer (Exact OnlineStoresView standard) */}
        <div className="bg-white px-6 py-4 border-t border-[#e8e2d8] flex items-center justify-between shrink-0 shadow-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg border border-[#e8e2d8] text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer font-poppins"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !storeId}
            className="px-6 py-2.5 rounded-lg bg-[#ae001a] hover:bg-[#d2272f] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs shrink-0 disabled:opacity-50 font-poppins"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">
                  {mode === 'create' ? 'add_circle' : 'save'}
                </span>
                <span>{mode === 'create' ? 'Create Digital Menu' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
