import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMerchantProfile,
  saveMerchantProfile,
} from '../../api/onboarding';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { useToast } from '../../hooks/use-toast';
import { useOnboarding } from '../../hooks/use-onboarding';
import { ApiError } from '../../lib/api-error';
import {
  hasMerchantProfileErrors,
  validateMerchantProfile,
  type MerchantProfileFieldErrors,
} from '../../lib/merchant-profile-validation';
import { onboardingFieldClass } from '../../lib/onboarding-form';
import { useOnboardingGuard } from '../../lib/use-onboarding-guard';

const PARTNER_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"%3E%3Crect fill="%23e8e2d8" width="120" height="60"/%3E%3C/svg%3E';

export function MerchantStepPage() {
  useOnboardingGuard(3);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { sessionId, advanceStep, persistDraft, exitOnboarding } =
    useOnboarding();

  const [loading, setLoading] = useState(Boolean(sessionId));
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [fieldErrors, setFieldErrors] = useState<MerchantProfileFieldErrors>(
    {},
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    void getMerchantProfile(sessionId)
      .then((data) => {
        if (cancelled) return;
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.address) setAddress(data.address);
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);
        if (data.country) setCountry(data.country);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load saved merchant details.');
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
      name,
      email,
      phone: phone.trim(),
      address,
      city,
      state,
      country,
    };
  }

  function getPayload() {
    const values = getValues();
    return {
      ...values,
      phone: values.phone || undefined,
    };
  }

  function applyApiFieldError(message: string): void {
    const lower = message.toLowerCase();
    if (lower.includes('phone')) {
      setFieldErrors((prev) => ({ ...prev, phone: message }));
      return;
    }
    if (lower.includes('email')) {
      setFieldErrors((prev) => ({ ...prev, email: message }));
    }
  }

  function validate(): MerchantProfileFieldErrors {
    const errors = validateMerchantProfile(getValues());
    setFieldErrors(errors);
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);
    setTouched({
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
    });

    const errors = validate();
    if (hasMerchantProfileErrors(errors)) return;

    if (!sessionId) {
      showToast('Session expired. Please start again.');
      navigate('/register', { replace: true });
      return;
    }

    setSubmitting(true);
    try {
      await saveMerchantProfile({ sessionId, ...getPayload() });
      advanceStep(4);
      navigate('/register/user');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to save merchant profile.';
      setApiError(message);
      if (err instanceof ApiError) {
        applyApiFieldError(message);
      }
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBack() {
    await persistDraft({ step: 3, merchantProfile: getValues() });
    navigate('/register/company');
  }

  if (loading) {
    return (
      <OnboardingLayout
        currentStep={3}
        onSaveExit={() => void exitOnboarding()}
        subtitle="Step 3 of 4: Merchant Profile"
        wide
      >
        <div className="surface-paper login-shadow rounded-lg h-96 animate-pulse bg-stone-100" />
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={3}
      onSaveExit={() => void exitOnboarding()}
      subtitle="Step 3 of 4: Merchant Profile"
      wide
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          className="lg:col-span-7 surface-paper login-shadow rounded-lg p-8"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <h1 className="text-xl font-bold text-text mb-1">
            Merchant Configuration
          </h1>
          <p className="text-body-sm text-text/60 mb-8">
            Provide the core operational details for your establishment to
            calibrate the X7 engine.
          </p>

          {apiError && (
            <div
              className="mb-6 p-4 border border-error/30 bg-red-50 rounded-lg text-body-sm text-error"
              role="alert"
            >
              {apiError}
            </div>
          )}

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-label-caps text-stone-500 block mb-1" htmlFor="name">
                  Name
                </label>
                <input
                  aria-invalid={!!(touched.name && fieldErrors.name)}
                  className={onboardingFieldClass(!!(touched.name && fieldErrors.name))}
                  id="name"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, name: true }));
                    validate();
                  }}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Legal store name"
                  type="text"
                  value={name}
                />
                {touched.name && fieldErrors.name && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-label-caps text-stone-500 block mb-1" htmlFor="email">
                  Email
                </label>
                <input
                  aria-invalid={!!(touched.email && fieldErrors.email)}
                  className={onboardingFieldClass(!!(touched.email && fieldErrors.email))}
                  id="email"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, email: true }));
                    validate();
                  }}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@store.com"
                  type="email"
                  value={email}
                />
                {touched.email && fieldErrors.email && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-label-caps text-stone-500 block mb-1" htmlFor="phone">
                Phone (Optional)
              </label>
              <input
                aria-invalid={!!(touched.phone && fieldErrors.phone)}
                className={onboardingFieldClass(!!(touched.phone && fieldErrors.phone))}
                id="phone"
                onBlur={() => {
                  setTouched((p) => ({ ...p, phone: true }));
                  validate();
                }}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                type="tel"
                value={phone}
              />
              {touched.phone && fieldErrors.phone && (
                <p className="text-body-sm text-error mt-1" role="alert">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            <div>
              <label className="text-label-caps text-stone-500 block mb-1" htmlFor="address">
                Address
              </label>
              <input
                aria-invalid={!!(touched.address && fieldErrors.address)}
                className={onboardingFieldClass(!!(touched.address && fieldErrors.address))}
                id="address"
                onBlur={() => {
                  setTouched((p) => ({ ...p, address: true }));
                  validate();
                }}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
                type="text"
                value={address}
              />
              {touched.address && fieldErrors.address && (
                <p className="text-body-sm text-error mt-1" role="alert">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(['city', 'state', 'country'] as const).map((field) => (
                <div key={field}>
                  <label
                    className="text-label-caps text-stone-500 block mb-1"
                    htmlFor={field}
                  >
                    {field === 'state' ? 'State/Prov' : field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    aria-invalid={!!(touched[field] && fieldErrors[field])}
                    className={onboardingFieldClass(
                      !!(touched[field] && fieldErrors[field]),
                    )}
                    id={field}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, [field]: true }));
                      validate();
                    }}
                    onChange={(e) => {
                      if (field === 'city') setCity(e.target.value);
                      else if (field === 'state') setState(e.target.value);
                      else setCountry(e.target.value);
                    }}
                    placeholder={
                      field === 'city'
                        ? 'City'
                        : field === 'state'
                          ? 'State/Prov'
                          : 'Country'
                    }
                    type="text"
                    value={field === 'city' ? city : field === 'state' ? state : country}
                  />
                  {touched[field] && fieldErrors[field] && (
                    <p className="text-body-sm text-error mt-1" role="alert">
                      {fieldErrors[field]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              className="text-label-caps text-text hover:text-primary transition-colors flex items-center gap-1"
              onClick={() => void handleBack()}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
              Previous
            </button>
            <button
              className="px-8 py-3 bg-primary text-white rounded-lg font-semibold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Processing...' : 'Next: User Setup'}
            </button>
          </div>
        </form>

        <aside className="lg:col-span-5 space-y-4">
          <div className="rounded-lg overflow-hidden bg-linear-to-br from-stone-800 to-stone-900 text-white p-6">
            <div className="aspect-video bg-stone-700 rounded mb-4 flex items-center justify-center text-stone-400 text-body-sm">
              Restaurant Management
            </div>
            <h3 className="font-bold text-lg mb-2">Culinary Workshop Precision</h3>
            <p className="text-body-sm text-stone-300">
              Your X7 POS system is being tuned to your specific kitchen rhythm.
            </p>
          </div>

          <div className="surface-paper rounded-lg p-5 border-l-4 border-primary">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">info</span>
              <div>
                <h3 className="text-label-caps text-text mb-1">Why This Matters?</h3>
                <p className="text-body-sm text-text/60">
                  Correct store identification and location info ensure your
                  digital presence and automated reporting sync perfectly with
                  your physical operations.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {['Partner 1', 'Partner 2'].map((partner) => (
              <div
                key={partner}
                className="surface-paper rounded-lg p-4 flex items-center justify-center grayscale opacity-90 contrast-125 hover:grayscale-0 transition-all duration-300"
              >
                <img
                  alt={partner}
                  className="h-10 object-contain"
                  src={PARTNER_PLACEHOLDER}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </OnboardingLayout>
  );
}
