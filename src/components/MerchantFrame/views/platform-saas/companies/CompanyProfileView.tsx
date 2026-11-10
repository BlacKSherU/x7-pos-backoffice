// Historia 6 — Company Profile de una company concreta (/platform-saas/companies/:id/profile).
// Formulario con validación en tiempo real; guarda con PATCH solo los campos modificados.
// El perfil de la company propia (/dashboard/company-profile) es otra vista:
// src/modules/platform-saas/companies/views/CompanyProfileView.tsx.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSaasCompanyProfile,
  updateSaasCompanyProfile,
} from '@/modules/platform-saas/companies/api/saas-companies';
import { rememberCompanyContext } from '@/modules/platform-saas/companies/lib/company-context';
import { companyNav } from '@/modules/platform-saas/companies/lib/saas-nav';
import { platformSaasPaths } from '@/modules/platform-saas/companies/lib/platform-saas-routes';
import { companyTrail, withCurrent } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import {
  COMPANY_STATUS_OPTIONS,
  SUPPORTED_CURRENCIES,
  buildCompanyProfilePatch,
  hasProfileErrors,
  profileToForm,
  validateCompanyProfileField,
  validateCompanyProfileForm,
  type SaasCompanyProfileErrors,
  type SaasCompanyProfileForm,
} from '@/modules/platform-saas/companies/lib/saas-company-profile-validation';
import type { SaasCompanyProfile } from '@/modules/platform-saas/companies/types/saas-company';
import { getEffectiveUserRole } from '@/platform/auth/lib/auth-storage';
import {
  SaasAlert,
  SaasFormFooter,
  SaasFormSection,
  SaasNavBar,
  SaasErrorState,
  SaasField,
  SaasLoadingState,
  SaasPageHeader,
  SaasStatCards,
} from '@/components/MerchantFrame/views/platform-saas/SaasViewKit';
import { SAAS, SAAS_INPUT_CLASS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

type FieldName = keyof SaasCompanyProfileForm;

export interface CompanyProfileViewProps {
  companyId: number;
}

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({ companyId }) => {
  const navigate = useNavigate();
  const readOnly = getEffectiveUserRole() === 'portal_user';
  const [profile, setProfile] = useState<SaasCompanyProfile | null>(null);
  const [initial, setInitial] = useState<SaasCompanyProfileForm | null>(null);
  const [form, setForm] = useState<SaasCompanyProfileForm | null>(null);
  const [errors, setErrors] = useState<SaasCompanyProfileErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getSaasCompanyProfile(companyId);
      const values = profileToForm(data);
      setProfile(data);
      setInitial(values);
      setForm(values);
      setErrors({});
      rememberCompanyContext(companyId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load company profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const patch = useMemo(
    () => (initial && form ? buildCompanyProfilePatch(initial, form) : {}),
    [initial, form],
  );
  const isDirty = Object.keys(patch).length > 0;

  const update = (field: FieldName, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSuccess(null);
    setSubmitError(null);
    // Validación en tiempo real del campo que se edita.
    setErrors((prev) => {
      const next = { ...prev };
      const error = validateCompanyProfileField(field, value);
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
    const allErrors = validateCompanyProfileForm(form);
    setErrors(allErrors);
    if (hasProfileErrors(allErrors)) {
      setSubmitError('Please fix the highlighted fields before saving.');
      return;
    }
    if (!isDirty) {
      setSuccess('No changes to save.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateSaasCompanyProfile(companyId, patch);
      const values = profileToForm(updated);
      setProfile(updated);
      setInitial(values);
      setForm(values);
      setSuccess('Company profile updated successfully.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update company profile. Please try again.');
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

  const trail = withCurrent(companyTrail(companyId, profile?.commercialName), 'Company Profile');

  const input = (field: FieldName, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`company-${field}`}
      name={field}
      value={form?.[field] ?? ''}
      onChange={(event) => update(field, event.target.value)}
      disabled={readOnly || isSaving}
      aria-invalid={errors[field] ? true : undefined}
      aria-describedby={errors[field] ? `company-${field}-error` : undefined}
      className={`${SAAS_INPUT_CLASS} ${errors[field] ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
      {...props}
    />
  );

  const currencyOptions = useMemo(() => {
    const current = form?.baseCurrency;
    const known = SUPPORTED_CURRENCIES.some((option) => option.code === current);
    return current && !known ? [{ code: current, label: `${current} — unsupported` }, ...SUPPORTED_CURRENCIES] : SUPPORTED_CURRENCIES;
  }, [form?.baseCurrency]);

  return (
    <div className={SAAS.page}>
      <SaasPageHeader
        breadcrumbs={trail}
        icon="business"
        title="COMPANY PROFILE"
        description={
          profile
            ? `Legal, fiscal and administrative records of ${profile.commercialName}.`
            : 'Legal, fiscal and administrative records of the company.'
        }
        actions={[
          {
            label: 'Back to Company Hub',
            icon: 'arrow_back',
            variant: 'secondary',
            onClick: () => navigate(platformSaasPaths.companyHub(companyId)),
          },
        ]}
      />

      {isLoading && !form ? (
        <SaasLoadingState label="Loading company profile..." />
      ) : loadError && !form ? (
        <SaasErrorState message={loadError} onRetry={() => void load()} />
      ) : form && profile ? (
        <>
          <SaasStatCards
            stats={[
              {
                id: 'merchant-branches',
                label: 'Active Merchant Branches',
                value: profile.metrics?.activeMerchantBranches ?? 0,
                hint: 'Branches operating today',
                icon: 'storefront',
              },
              {
                id: 'corporate-customers',
                label: 'Corporate Customers',
                value: profile.metrics?.globalCorporateCustomers ?? 0,
                hint: 'Customers of the company',
                icon: 'groups',
              },
              {
                id: 'master-suppliers',
                label: 'Master Suppliers',
                value: profile.metrics?.authorizedMasterSuppliers ?? 0,
                hint: 'Authorized suppliers',
                icon: 'local_shipping',
              },
            ]}
          />

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
            <SaasAlert tone="info">Your role has read-only access: the profile cannot be edited.</SaasAlert>
          )}

          <form noValidate onSubmit={(event) => void handleSubmit(event)} aria-label="Company profile form" className={`${SAAS.surface} overflow-hidden`}>
            <SaasFormSection title="Legal & Fiscal Identity" icon="gavel">
              <SaasField id="company-legalName" label="Legal Name" required error={errors.legalName}>
                {input('legalName', { maxLength: 150, autoComplete: 'organization' })}
              </SaasField>
              <SaasField id="company-commercialName" label="Commercial Name" required error={errors.commercialName}>
                {input('commercialName', { maxLength: 100 })}
              </SaasField>
              <SaasField
                id="company-taxId"
                label="Tax ID"
                required
                error={errors.taxId}
                hint="e.g. EIN 12-3456789, RUT 12.345.678-K or VAT DE123456789"
              >
                {input('taxId', { maxLength: 50 })}
              </SaasField>
              <SaasField id="company-baseCurrency" label="Base Currency" required error={errors.baseCurrency}>
                <select
                  id="company-baseCurrency"
                  value={form.baseCurrency}
                  onChange={(event) => update('baseCurrency', event.target.value)}
                  disabled={readOnly || isSaving}
                  aria-invalid={errors.baseCurrency ? true : undefined}
                  className={`${SAAS_INPUT_CLASS} ${errors.baseCurrency ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
                >
                  {!form.baseCurrency && <option value="">Select a currency</option>}
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SaasField>
              <SaasField id="company-status" label="Account Status" required error={errors.status}>
                <select
                  id="company-status"
                  value={form.status}
                  onChange={(event) => update('status', event.target.value)}
                  disabled={readOnly || isSaving}
                  className={`${SAAS_INPUT_CLASS} ${errors.status ? 'border-[#ba1a1a]' : 'border-[#e8e2d8]'}`}
                >
                  {COMPANY_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SaasField>
            </SaasFormSection>

            <SaasFormSection title="Contact Channels" icon="contact_mail">
              <SaasField id="company-email" label="Business Email" required error={errors.email}>
                {input('email', { type: 'email', autoComplete: 'email' })}
              </SaasField>
              <SaasField id="company-phone" label="Phone" error={errors.phone}>
                {input('phone', { type: 'tel', autoComplete: 'tel' })}
              </SaasField>
            </SaasFormSection>

            <SaasFormSection title="Billing Address" icon="location_on">
              <div className="md:col-span-2">
                <SaasField id="company-address" label="Address" required error={errors.address}>
                  {input('address', { maxLength: 200, autoComplete: 'street-address' })}
                </SaasField>
              </div>
              <SaasField id="company-city" label="City" required error={errors.city}>
                {input('city', { maxLength: 50 })}
              </SaasField>
              <SaasField id="company-state" label="State / Region" error={errors.state}>
                {input('state', { maxLength: 50 })}
              </SaasField>
              <SaasField id="company-country" label="Country" required error={errors.country}>
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
      <SaasNavBar backLabel="Back to Company Hub" backTo={platformSaasPaths.companyHub(companyId)} items={companyNav(companyId, 'company-profile')} />
    </div>
  );
};


export default CompanyProfileView;
