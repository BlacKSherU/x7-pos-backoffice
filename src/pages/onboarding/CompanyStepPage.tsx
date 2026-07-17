import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBusinessProfile,
  saveBusinessProfile,
} from '../../api/onboarding';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { useToast } from '../../hooks/use-toast';
import { useOnboarding } from '../../hooks/use-onboarding';
import { ApiError } from '../../lib/api-error';
import {
  formatEinInput,
  hasBusinessProfileErrors,
  validateBusinessProfile,
  type BusinessProfileFieldErrors,
} from '../../lib/business-profile-validation';
import { onboardingFieldClass } from '../../lib/onboarding-form';
import { useOnboardingGuard } from '../../lib/use-onboarding-guard';
import { PRIMARY_INDUSTRY_OPTIONS } from '../../types/onboarding';

export function CompanyStepPage() {
  useOnboardingGuard(2);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { sessionId, advanceStep, persistDraft, exitOnboarding } =
    useOnboarding();

  const [loading, setLoading] = useState(Boolean(sessionId));
  const [submitting, setSubmitting] = useState(false);
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [primaryIndustry, setPrimaryIndustry] = useState<string>(
    PRIMARY_INDUSTRY_OPTIONS[0],
  );
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<BusinessProfileFieldErrors>(
    {},
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    void getBusinessProfile(sessionId)
      .then((data) => {
        if (cancelled) return;
        if (data.legalBusinessName) setLegalBusinessName(data.legalBusinessName);
        if (data.taxId) setTaxId(data.taxId);
        if (data.primaryIndustry) setPrimaryIndustry(data.primaryIndustry);
        if (data.registeredAddress)
          setRegisteredAddress(data.registeredAddress);
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);
        if (data.zipCode) setZipCode(data.zipCode);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load saved business details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, showToast]);

  function getValues() {
    return {
      legalBusinessName,
      taxId,
      primaryIndustry,
      registeredAddress,
      city,
      state: state.toUpperCase(),
      zipCode,
    };
  }

  function validate(): BusinessProfileFieldErrors {
    const errors = validateBusinessProfile(getValues());
    setFieldErrors(errors);
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({
      legalBusinessName: true,
      taxId: true,
      primaryIndustry: true,
      registeredAddress: true,
      city: true,
      state: true,
      zipCode: true,
    });

    const errors = validate();
    if (hasBusinessProfileErrors(errors)) return;

    if (!sessionId) {
      showToast('Session expired. Please start again.');
      navigate('/register', { replace: true });
      return;
    }

    setSubmitting(true);
    try {
      await saveBusinessProfile({ sessionId, ...getValues() });
      advanceStep(3);
      navigate('/register/merchant');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to save business profile.';
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors((prev) => ({
          ...prev,
          taxId: message.includes('tax ID') || message.includes('EIN')
            ? message
            : prev.taxId,
        }));
      }
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBack() {
    await persistDraft({
      step: 2,
      businessProfile: getValues(),
    });
    navigate('/register');
  }

  if (loading) {
    return (
      <OnboardingLayout
        currentStep={2}
        onSaveExit={() => void exitOnboarding()}
        subtitle="Step 2 of 4: Business Profile"
      >
        <div className="surface-paper login-shadow rounded-lg h-96 animate-pulse bg-stone-100" />
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={2}
      onSaveExit={() => void exitOnboarding()}
      subtitle="Step 2 of 4: Business Profile"
    >
      <form
        className="surface-paper login-shadow rounded-lg overflow-hidden"
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="p-8 border-b border-border">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-1 h-8 bg-primary rounded-full shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-text uppercase tracking-wide">
                Legal Business Information
              </h1>
              <p className="text-body-sm text-text/60 mt-1">
                Provide your verified details for tax reporting and regulatory
                compliance.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label
                className="text-label-caps text-stone-500 block mb-1"
                htmlFor="legalBusinessName"
              >
                Legal Business Name
              </label>
              <input
                aria-invalid={!!(touched.legalBusinessName && fieldErrors.legalBusinessName)}
                className={onboardingFieldClass(
                  !!(touched.legalBusinessName && fieldErrors.legalBusinessName),
                )}
                id="legalBusinessName"
                onBlur={() => {
                  setTouched((p) => ({ ...p, legalBusinessName: true }));
                  validate();
                }}
                onChange={(e) => setLegalBusinessName(e.target.value)}
                placeholder="As registered with the IRS"
                type="text"
                value={legalBusinessName}
              />
              {touched.legalBusinessName && fieldErrors.legalBusinessName && (
                <p className="text-body-sm text-error mt-1" role="alert">
                  {fieldErrors.legalBusinessName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="taxId"
                >
                  Tax ID / EIN
                </label>
                <div className="relative">
                  <input
                    aria-invalid={!!(touched.taxId && fieldErrors.taxId)}
                    className={onboardingFieldClass(
                      !!(touched.taxId && fieldErrors.taxId),
                    )}
                    id="taxId"
                    onBlur={() => {
                      setTouched((p) => ({ ...p, taxId: true }));
                      validate();
                    }}
                    onChange={(e) => setTaxId(formatEinInput(e.target.value))}
                    placeholder="00-0000000"
                    type="text"
                    value={taxId}
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                    info
                  </span>
                </div>
                {touched.taxId && fieldErrors.taxId && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.taxId}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="primaryIndustry"
                >
                  Primary Industry
                </label>
                <select
                  className={onboardingFieldClass(false)}
                  id="primaryIndustry"
                  onChange={(e) => setPrimaryIndustry(e.target.value)}
                  value={primaryIndustry}
                >
                  {PRIMARY_INDUSTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                className="text-label-caps text-stone-500 block mb-1"
                htmlFor="registeredAddress"
              >
                Registered Address
              </label>
              <input
                aria-invalid={!!(touched.registeredAddress && fieldErrors.registeredAddress)}
                className={onboardingFieldClass(
                  !!(touched.registeredAddress && fieldErrors.registeredAddress),
                )}
                id="registeredAddress"
                onBlur={() => {
                  setTouched((p) => ({ ...p, registeredAddress: true }));
                  validate();
                }}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                placeholder="Street Address"
                type="text"
                value={registeredAddress}
              />
              {touched.registeredAddress && fieldErrors.registeredAddress && (
                <p className="text-body-sm text-error mt-1" role="alert">
                  {fieldErrors.registeredAddress}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="city"
                >
                  City
                </label>
                <input
                  aria-invalid={!!(touched.city && fieldErrors.city)}
                  className={onboardingFieldClass(
                    !!(touched.city && fieldErrors.city),
                  )}
                  id="city"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, city: true }));
                    validate();
                  }}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  type="text"
                  value={city}
                />
                {touched.city && fieldErrors.city && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.city}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="state"
                >
                  State
                </label>
                <input
                  aria-invalid={!!(touched.state && fieldErrors.state)}
                  className={onboardingFieldClass(
                    !!(touched.state && fieldErrors.state),
                  )}
                  id="state"
                  maxLength={2}
                  onBlur={() => {
                    setTouched((p) => ({ ...p, state: true }));
                    setState((s) => s.toUpperCase());
                    validate();
                  }}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="NY"
                  type="text"
                  value={state}
                />
                {touched.state && fieldErrors.state && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.state}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="zipCode"
                >
                  Zip Code
                </label>
                <input
                  aria-invalid={!!(touched.zipCode && fieldErrors.zipCode)}
                  className={onboardingFieldClass(
                    !!(touched.zipCode && fieldErrors.zipCode),
                  )}
                  id="zipCode"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, zipCode: true }));
                    validate();
                  }}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="10001"
                  type="text"
                  value={zipCode}
                />
                {touched.zipCode && fieldErrors.zipCode && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.zipCode}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-stone-50 rounded-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-stone-500 shrink-0">
              shield
            </span>
            <p className="text-body-sm text-text/70">
              Your data is encrypted and stored according to industry-standard
              and PCI-DSS level compliance protocols. X7 does not share your
              private tax information with third-party advertisers.
            </p>
          </div>
        </div>

        <div className="p-6 flex items-center justify-between bg-stone-50/50">
          <button
            className="text-label-caps text-text hover:text-primary transition-colors flex items-center gap-1"
            onClick={() => void handleBack()}
            type="button"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
            Back
          </button>
          <button
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Saving...' : 'Next: Billing Setup'}
            {!submitting && (
              <span className="material-symbols-outlined">chevron_right</span>
            )}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="surface-paper rounded-lg p-5 flex items-start gap-4">
          <span className="material-symbols-outlined text-primary text-2xl">
            description
          </span>
          <div>
            <h3 className="text-label-caps text-text mb-1">Helpful Tip</h3>
            <p className="text-body-sm text-text/60">
              Have your SS-4 or most recent tax return ready for EIN
              verification.
            </p>
          </div>
        </div>
        <div className="surface-paper rounded-lg p-5 flex items-start gap-4">
          <span className="material-symbols-outlined text-primary text-2xl">
            support_agent
          </span>
          <div>
            <h3 className="text-label-caps text-text mb-1">Need Help?</h3>
            <p className="text-body-sm text-text/60">
              Live chat with an onboarding specialist is available until 8 PM
              EST.
            </p>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
