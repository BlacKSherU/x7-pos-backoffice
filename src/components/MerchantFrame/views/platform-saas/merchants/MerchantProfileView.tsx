// Historia 3 — Merchant Profile (/platform-saas/companies/:companyId/merchants/:merchantId/profile).
// Formulario de la sucursal con validación en tiempo real; guarda con PATCH solo lo modificado.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSaasMerchant, updateSaasMerchant } from '@/modules/platform-saas/merchants/api/saas-merchants';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { merchantNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { merchantTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import {
  MERCHANT_STATUS_OPTIONS,
  buildMerchantPatch,
  hasMerchantErrors,
  listTimezones,
  merchantToForm,
  validateMerchantProfileField,
  validateMerchantProfileForm,
  type SaasMerchantProfileErrors,
  type SaasMerchantProfileForm,
} from '@/modules/platform-saas/merchants/lib/saas-merchant-profile-validation';
import type { SaasMerchantProfile } from '@/modules/platform-saas/merchants/types/saas-merchant';
import { getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';
import { ApiError } from '@/shared/lib/api-error';
import {
  SaasAlert,
  SaasFormFooter,
  SaasFormSection,
  SaasNavBar,
  SaasErrorState,
  SaasField,
  SaasLoadingState,
  SaasPageHeader,
  SaasStatusBadge,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS, SAAS_INPUT_CLASS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

type FieldName = keyof SaasMerchantProfileForm;

export interface MerchantProfileViewProps {
  companyId: number;
  merchantId: number;
}

export const MerchantProfileView: React.FC<MerchantProfileViewProps> = ({ companyId, merchantId }) => {
  const navigate = useNavigate();
  const readOnly = getEffectiveUserRole() === 'portal_user';
  const [merchant, setMerchant] = useState<SaasMerchantProfile | null>(null);
  const [initial, setInitial] = useState<SaasMerchantProfileForm | null>(null);
  const [form, setForm] = useState<SaasMerchantProfileForm | null>(null);
  const [errors, setErrors] = useState<SaasMerchantProfileErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getSaasMerchant(merchantId);
      if (Number(data.companyId) !== companyId) {
        setLoadError(`Merchant #${merchantId} does not belong to company #${companyId}.`);
        return;
      }
      const values = merchantToForm(data);
      setMerchant(data);
      setInitial(values);
      setForm(values);
      setErrors({});
      rememberCompanyContext(companyId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load merchant profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const patch = useMemo(() => (initial && form ? buildMerchantPatch(initial, form) : {}), [initial, form]);
  const isDirty = Object.keys(patch).length > 0;

  const timezones = useMemo(() => {
    const zones = listTimezones();
    const current = form?.timezone?.trim();
    return current && !zones.includes(current) ? [current, ...zones] : zones;
  }, [form?.timezone]);

  const update = (field: FieldName, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSuccess(null);
    setSubmitError(null);
    setErrors((prev) => {
      const next = { ...prev };
      const error = validateMerchantProfileField(field, value);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !initial || readOnly) return;
    setSubmitError(null);
    setSuccess(null);
    const allErrors = validateMerchantProfileForm(form);
    setErrors(allErrors);
    if (hasMerchantErrors(allErrors)) {
      setSubmitError('Please fix the highlighted fields before saving.');
      return;
    }
    if (!isDirty) {
      setSuccess('No changes to save.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateSaasMerchant(merchantId, patch);
      const values = merchantToForm(updated);
      setMerchant(updated);
      setInitial(values);
      setForm(values);
      setSuccess('Merchant profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update merchant profile. Please try again.';
      // Nombre repetido dentro de la company: el backend responde 409.
      if (err instanceof ApiError && err.status === 409) {
        setErrors((prev) => ({ ...prev, name: message }));
      }
      setSubmitError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    if (!initial) return;
    setForm(initial);
    setErrors({});
    setSubmitError(null);
  };

  const input = (field: FieldName, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`merchant-${field}`}
      name={field}
      value={form?.[field] ?? ''}
      onChange={(event) => update(field, event.target.value)}
      disabled={readOnly || isSaving}
      aria-invalid={errors[field] ? true : undefined}
      aria-describedby={errors[field] ? `merchant-${field}-error` : undefined}
      className={`${SAAS_INPUT_CLASS} ${errors[field] ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
      {...props}
    />
  );

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={withCurrent(
          merchantTrail(companyId, merchant?.companyName, merchantId, merchant?.name),
          'Merchant Profile',
        )}
        icon="storefront"
        title="MERCHANT PROFILE"
        description={
          merchant
            ? `Branch details, physical address, timezone and operational status of ${merchant.name}.`
            : 'Branch details, physical address, timezone and operational status.'
        }
        actions={[
          {
            label: 'Back to Merchant Hub',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: () => navigate(platformSaasPaths.merchantHub(companyId, merchantId)),
          },
        ]}
      />

      {isLoading && !form ? (
        <SaasLoadingState label="Loading merchant profile..." />
      ) : loadError && !form ? (
        <SaasErrorState message={loadError} onRetry={() => void load()} />
      ) : form && merchant ? (
        <>
          <div className={`${SAAS.surface} ${SAAS.cardPadding} flex flex-wrap items-center gap-x-6 gap-y-2 text-sm`}>
            <span className="text-[#5f5e5e]">
              Branch code <strong className="font-mono text-[#1d1c17]">{merchant.branchCode}</strong>
            </span>
            <span className="text-[#5f5e5e] min-w-0 break-words">
              Company <strong className="text-[#1d1c17]">{merchant.companyName}</strong>
            </span>
            <SaasStatusBadge status={merchant.status} />
          </div>

          {success && (
            <SaasAlert tone="success" role="status">
              {success}
            </SaasAlert>
          )}
          {submitError && (
            <SaasAlert tone="error" role="alert">
              {submitError}
            </SaasAlert>
          )}
          {readOnly && (
            <SaasAlert tone="info">Your role has read-only access: the branch cannot be edited.</SaasAlert>
          )}

          <form
            noValidate
            aria-label="Merchant profile form"
            onSubmit={(event) => void handleSubmit(event)}
            className={`${SAAS.surface} overflow-hidden`}
          >
            <SaasFormSection title="Branch Identity" icon="storefront">
              <SaasField id="merchant-name" label="Branch Name" required error={errors.name}>
                {input('name', { maxLength: 100 })}
              </SaasField>
              <SaasField id="merchant-status" label="Operational Status" required error={errors.status}>
                <select
                  id="merchant-status"
                  value={form.status}
                  onChange={(event) => update('status', event.target.value)}
                  disabled={readOnly || isSaving}
                  className={`${SAAS_INPUT_CLASS} ${errors.status ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
                >
                  {MERCHANT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SaasField>
              <SaasField id="merchant-timezone" label="Timezone" required error={errors.timezone}>
                <select
                  id="merchant-timezone"
                  value={form.timezone}
                  onChange={(event) => update('timezone', event.target.value)}
                  disabled={readOnly || isSaving}
                  aria-invalid={errors.timezone ? true : undefined}
                  className={`${SAAS_INPUT_CLASS} ${errors.timezone ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
                >
                  {!form.timezone && <option value="">Select a timezone</option>}
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </SaasField>
            </SaasFormSection>

            <SaasFormSection title="Contact Numbers" icon="call">
              <SaasField id="merchant-phone" label="Phone" error={errors.phone}>
                {input('phone', { type: 'tel', autoComplete: 'tel' })}
              </SaasField>
              <SaasField id="merchant-email" label="Email" error={errors.email}>
                {input('email', { type: 'email', autoComplete: 'email' })}
              </SaasField>
            </SaasFormSection>

            <SaasFormSection title="Physical Address" icon="location_on">
              <div className="md:col-span-2">
                <SaasField id="merchant-address" label="Address" required error={errors.address}>
                  {input('address', { maxLength: 200, autoComplete: 'street-address' })}
                </SaasField>
              </div>
              <SaasField id="merchant-city" label="City" required error={errors.city}>
                {input('city', { maxLength: 50 })}
              </SaasField>
              <SaasField id="merchant-state" label="State / Region" error={errors.state}>
                {input('state', { maxLength: 50 })}
              </SaasField>
              <SaasField id="merchant-country" label="Country" required error={errors.country}>
                {input('country', { maxLength: 50, autoComplete: 'country-name' })}
              </SaasField>
            </SaasFormSection>

            {!readOnly && (
              <SaasFormFooter>
                <button
                  type="button"
                  onClick={reset}
                  disabled={!isDirty || isSaving}
                  className={SAAS.buttonSecondary}
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={SAAS.buttonPrimary}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </SaasFormFooter>
            )}
          </form>
        </>
      ) : null}
      <SaasNavBar backLabel="Back to Merchant Hub" backTo={platformSaasPaths.merchantHub(companyId, merchantId)} items={merchantNav(companyId, merchantId, 'merchant-profile')} />
    </div>
  );
};


export default MerchantProfileView;
