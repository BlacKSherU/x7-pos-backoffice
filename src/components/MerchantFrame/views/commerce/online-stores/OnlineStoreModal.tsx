import React, { useState } from 'react';
import { AppModal, ModalFormFooter, ModalFormError } from '../../../shared/AppModal';

export interface OnlineStoreFormData {
  id?: number;
  subdomain: string;
  theme: string;
  currency: string;
  timezone: string;
  is_active: boolean;
}

interface OnlineStoreModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: OnlineStoreFormData | null;
  onClose: () => void;
  onSubmit: (data: OnlineStoreFormData) => Promise<void>;
}

const COMMON_THEMES = [
  { id: 'default', name: 'Default Classic', desc: 'Standard clean storefront design with bold typography' },
  { id: 'modern', name: 'Modern Bistro', desc: 'Sleek rounded cards with prominent hero images' },
  { id: 'minimalist', name: 'Minimalist Clean', desc: 'High-contrast typography with spacious layouts' },
  { id: 'dark-luxe', name: 'Dark Luxe Lounge', desc: 'Deep zinc palette for upscale nightlife and premium dining' },
  { id: 'sunset-dining', name: 'Sunset Warmth', desc: 'Warm terracotta tones crafted for bakeries and cafes' },
];

const COMMON_CURRENCIES = [
  { code: 'USD', label: 'USD - United States Dollar ($)' },
  { code: 'EUR', label: 'EUR - Euro (€)' },
  { code: 'CAD', label: 'CAD - Canadian Dollar ($)' },
  { code: 'GBP', label: 'GBP - British Pound (£)' },
  { code: 'CLP', label: 'CLP - Chilean Peso ($)' },
  { code: 'MXN', label: 'MXN - Mexican Peso ($)' },
  { code: 'BRL', label: 'BRL - Brazilian Real (R$)' },
  { code: 'AUD', label: 'AUD - Australian Dollar ($)' },
];

const COMMON_TIMEZONES = [
  { zone: 'America/New_York', label: 'Eastern Time (US) - America/New_York' },
  { zone: 'America/Chicago', label: 'Central Time (US) - America/Chicago' },
  { zone: 'America/Denver', label: 'Mountain Time (US) - America/Denver' },
  { zone: 'America/Los_Angeles', label: 'Pacific Time (US) - America/Los_Angeles' },
  { zone: 'America/Santiago', label: 'Chile Time - America/Santiago' },
  { zone: 'America/Mexico_City', label: 'Mexico Central - America/Mexico_City' },
  { zone: 'America/Sao_Paulo', label: 'Brazil - America/Sao_Paulo' },
  { zone: 'Europe/London', label: 'GMT/BST (UK) - Europe/London' },
  { zone: 'Europe/Madrid', label: 'CET (Spain) - Europe/Madrid' },
  { zone: 'UTC', label: 'Coordinated Universal Time - UTC' },
];

export const OnlineStoreModal: React.FC<OnlineStoreModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <OnlineStoreModalContent
      key={`${mode}-${initialData?.id ?? 'new'}`}
      mode={mode}
      initialData={initialData}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};

interface OnlineStoreModalContentProps {
  mode: 'create' | 'edit';
  initialData?: OnlineStoreFormData | null;
  onClose: () => void;
  onSubmit: (data: OnlineStoreFormData) => Promise<void>;
}

const OnlineStoreModalContent: React.FC<OnlineStoreModalContentProps> = ({
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [subdomain, setSubdomain] = useState<string>(initialData?.subdomain || '');
  const [theme, setTheme] = useState<string>(initialData?.theme || 'default');
  const [currency, setCurrency] = useState<string>(initialData?.currency || 'USD');
  const [timezone, setTimezone] = useState<string>(initialData?.timezone || 'America/New_York');
  const [isActive, setIsActive] = useState<boolean>(initialData?.is_active ?? true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Normalization logic: lowercase, alphanumeric and hyphens
  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = raw
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSubdomain(normalized);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanSubdomain = subdomain.trim().replace(/^-+|-+$/g, '');
    if (!cleanSubdomain) {
      setErrorMessage('Subdomain is required and must contain alphanumeric characters.');
      return;
    }

    if (cleanSubdomain.length > 100) {
      setErrorMessage('Subdomain cannot exceed 100 characters.');
      return;
    }

    const dnsRegex = /^[a-z0-9]([a-z0-9-]{0,98}[a-z0-9])?$/;
    if (!dnsRegex.test(cleanSubdomain)) {
      setErrorMessage('Subdomain must be DNS-compliant (alphanumeric, no leading/trailing hyphens).');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        id: initialData?.id,
        subdomain: cleanSubdomain,
        theme: theme.trim() || 'default',
        currency: currency.trim() || 'USD',
        timezone: timezone.trim() || 'America/New_York',
        is_active: isActive,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save online store. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      title={mode === 'create' ? 'Provision Online Storefront' : 'Edit Storefront Settings'}
      subtitle={
        mode === 'create'
          ? 'Online Ordering Tenant'
          : `Storefront #${initialData?.id ?? ''}`
      }
      titleId="online-store-modal-title"
      size="lg"
      onClose={onClose}
      closeDisabled={isSubmitting}
      closeAriaLabel="Close storefront dialog"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-left font-sans">
        {errorMessage && <ModalFormError message={errorMessage} />}

        {/* Subdomain Input with Live URL Preview */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
            Store Subdomain <span className="text-[#ae001a]">*</span>
          </label>
          <p className="text-[11px] text-[#5f5e5e]">
            Unique web identifier for tenant routing. Must be lowercase and DNS compliant.
          </p>
          <div className="flex items-center rounded border border-[#e8e2d8] bg-white overflow-hidden focus-within:border-[#ae001a] focus-within:ring-1 focus-within:ring-[#ae001a] transition-all">
            <span className="px-3 text-xs font-semibold text-zinc-500 bg-zinc-50 border-r border-[#e8e2d8] select-none py-2.5">
              https://
            </span>
            <input
              type="text"
              required
              maxLength={100}
              value={subdomain}
              onChange={handleSubdomainChange}
              placeholder="store-name"
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 text-sm font-bold text-[#1d1c17] bg-white placeholder-zinc-400 outline-none"
            />
            <span className="px-3 text-xs font-bold text-zinc-600 bg-zinc-50 border-l border-[#e8e2d8] select-none py-2.5">
              .x7pos.com
            </span>
          </div>

          {/* Live Context URL Preview Box */}
          <div className="mt-2 p-2.5 rounded bg-[#fef9f1] border border-[#e8e2d8] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-sm text-[#ae001a]">language</span>
              <span className="font-mono text-zinc-600 text-[11px] truncate">
                Public URL: <strong className="text-[#1d1c17]">https://{subdomain || 'your-store'}.x7pos.com</strong>
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
              Tenant Route
            </span>
          </div>
        </div>

        {/* Visual Theme Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
            Storefront Theme
          </label>
          <p className="text-[11px] text-[#5f5e5e]">
            Visual styling template applied to the customer ordering interface.
          </p>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 rounded border border-[#e8e2d8] bg-white text-sm font-medium text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none"
          >
            {COMMON_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.desc}
              </option>
            ))}
          </select>
        </div>

        {/* Regional Settings: Currency & Timezone Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Currency Code */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
              Currency Code (ISO 4217)
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded border border-[#e8e2d8] bg-white text-sm font-bold text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-500 font-medium">Defaults to USD if unselected</p>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
              Regional Timezone (IANA)
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded border border-[#e8e2d8] bg-white text-xs font-semibold text-[#1d1c17] focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a] outline-none"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.zone} value={tz.zone}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-500 font-medium">Defaults to America/New_York</p>
          </div>
        </div>

        {/* Public Availability Toggle (is_active) */}
        <div className="pt-2 border-t border-[#e8e2d8]">
          <div className="flex items-center justify-between p-3.5 rounded bg-zinc-50 border border-[#e8e2d8]">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1d1c17]">
                Public Storefront Availability
              </span>
              <p className="text-[11px] text-[#5f5e5e]">
                {isActive
                  ? 'Published: Channel is open and receiving live customer orders'
                  : 'Maintenance: Channel is closed for public view and testing'}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              disabled={isSubmitting}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                isActive ? 'bg-[#10b981]' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Standard Modal Form Footer */}
        <ModalFormFooter
          onCancel={onClose}
          cancelLabel="Cancel"
          submitLabel={
            isSubmitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Provision Storefront'
                : 'Save Changes'
          }
          isSubmitting={isSubmitting}
        />
      </form>
    </AppModal>
  );
};
