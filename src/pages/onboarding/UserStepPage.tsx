import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminIdentity, provisionAccount } from '../../api/onboarding';
import {
  OnboardingLayout,
  PRIVACY_URL,
  TERMS_URL,
} from '../../components/onboarding/OnboardingLayout';
import { useToast } from '../../hooks/use-toast';
import { useOnboarding } from '../../hooks/use-onboarding';
import { ApiError } from '../../lib/api-error';
import {
  hasAdminIdentityErrors,
  validateAdminIdentity,
  type AdminIdentityFieldErrors,
} from '../../lib/admin-identity-validation';
import { saveAuthSession } from '../../lib/auth-storage';
import { onboardingFieldClass } from '../../lib/onboarding-form';
import { clearOnboardingSession } from '../../lib/onboarding-storage';
import {
  evaluatePasswordCriteria,
  isPasswordValid,
} from '../../lib/reset-password';
import { useOnboardingGuard } from '../../lib/use-onboarding-guard';

const PASSWORD_REQUIREMENTS = [
  { key: 'minLength' as const, label: 'Minimum 8 characters' },
  { key: 'uppercase' as const, label: 'One uppercase letter' },
  { key: 'numberOrSpecial' as const, label: 'One special character or number' },
];

export function UserStepPage() {
  useOnboardingGuard(4);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { sessionId, persistDraft, exitOnboarding } = useOnboarding();

  const [loading, setLoading] = useState(Boolean(sessionId));
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AdminIdentityFieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    void getAdminIdentity(sessionId)
      .then((data) => {
        if (cancelled) return;
        if (data.firstName) setFirstName(data.firstName);
        if (data.lastName) setLastName(data.lastName);
        if (data.jobTitle) setJobTitle(data.jobTitle);
        if (data.workEmail) setWorkEmail(data.workEmail);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load saved admin details.');
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
      firstName,
      lastName,
      jobTitle,
      workEmail,
      password,
      confirmPassword,
      termsAccepted,
    };
  }

  function validate(
    overrides: Partial<ReturnType<typeof getValues>> = {},
  ): AdminIdentityFieldErrors {
    const errors = validateAdminIdentity({ ...getValues(), ...overrides });
    setFieldErrors(errors);
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);
    setTouched({
      firstName: true,
      lastName: true,
      jobTitle: true,
      workEmail: true,
      password: true,
      confirmPassword: true,
      termsAccepted: true,
    });

    const errors = validate();
    if (hasAdminIdentityErrors(errors)) return;

    if (!sessionId) {
      showToast('Session expired. Please start again.');
      navigate('/register', { replace: true });
      return;
    }

    setSubmitting(true);
    try {
      const response = await provisionAccount({
        sessionId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim(),
        workEmail: workEmail.trim(),
        password,
        termsAccepted,
      });

      clearOnboardingSession();

      if (
        response.access_token &&
        response.refresh_token &&
        response.user
      ) {
        saveAuthSession(
          response.access_token,
          response.refresh_token,
          response.user,
          true,
        );
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to complete account setup.';
      setApiError(message);
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors((prev) => ({
          ...prev,
          workEmail: 'This email may already be registered.',
        }));
      }
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBack() {
    await persistDraft({
      step: 4,
      adminIdentity: {
        firstName,
        lastName,
        jobTitle,
        workEmail,
      },
    });
    navigate('/register/merchant');
  }

  if (loading) {
    return (
      <OnboardingLayout
        currentStep={4}
        onSaveExit={() => void exitOnboarding()}
        subtitle="Step 4 of 4: User Setup"
        wide
      >
        <div className="surface-paper login-shadow rounded-lg h-96 animate-pulse bg-stone-100" />
      </OnboardingLayout>
    );
  }

  const passwordCriteria = evaluatePasswordCriteria(password);
  const passwordMeetsRequirements = isPasswordValid(passwordCriteria);
  const canSubmit =
    termsAccepted && passwordMeetsRequirements && !submitting;

  return (
    <OnboardingLayout
      currentStep={4}
      onSaveExit={() => void exitOnboarding()}
      subtitle="Step 4 of 4: User Setup"
      wide
    >
      <div className="surface-paper login-shadow rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 bg-stone-900 text-white p-8 flex flex-col justify-center">
            <div className="aspect-video bg-stone-800 rounded mb-6 flex items-center justify-center text-stone-500 text-body-sm">
              Admin Setup
            </div>
            <p className="text-label-caps text-primary mb-2">Final Step</p>
            <h2 className="text-2xl font-bold mb-3">
              Secure Your Professional Account
            </h2>
            <p className="text-body-sm text-stone-300">
              As the primary administrator, you will have complete oversight of
              your restaurant&apos;s operations, financial reporting, and user
              permissions.
            </p>
          </div>

          <form
            className="lg:col-span-7 p-8"
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
          >
            <h1 className="text-2xl font-bold text-text mb-1">Admin Identity</h1>
            <p className="text-body-sm text-text/60 mb-6">
              Please provide your professional details to finalize the X7 setup.
            </p>

            {apiError && (
              <div
                className="mb-6 p-4 border border-error/30 bg-red-50 rounded-lg text-body-sm text-error"
                role="alert"
              >
                {apiError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-label-caps text-stone-500 block mb-1" htmlFor="firstName">
                    First Name
                  </label>
                  <input
                    aria-invalid={!!(touched.firstName && fieldErrors.firstName)}
                    className={onboardingFieldClass(
                      !!(touched.firstName && fieldErrors.firstName),
                    )}
                    id="firstName"
                    onBlur={() => {
                      setTouched((p) => ({ ...p, firstName: true }));
                      validate();
                    }}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Julian"
                    type="text"
                    value={firstName}
                  />
                  {touched.firstName && fieldErrors.firstName && (
                    <p className="text-body-sm text-error mt-1" role="alert">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-label-caps text-stone-500 block mb-1" htmlFor="lastName">
                    Last Name
                  </label>
                  <input
                    aria-invalid={!!(touched.lastName && fieldErrors.lastName)}
                    className={onboardingFieldClass(
                      !!(touched.lastName && fieldErrors.lastName),
                    )}
                    id="lastName"
                    onBlur={() => {
                      setTouched((p) => ({ ...p, lastName: true }));
                      validate();
                    }}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Chen"
                    type="text"
                    value={lastName}
                  />
                  {touched.lastName && fieldErrors.lastName && (
                    <p className="text-body-sm text-error mt-1" role="alert">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-label-caps text-stone-500 block mb-1" htmlFor="jobTitle">
                  Job Title
                </label>
                <input
                  aria-invalid={!!(touched.jobTitle && fieldErrors.jobTitle)}
                  className={onboardingFieldClass(
                    !!(touched.jobTitle && fieldErrors.jobTitle),
                  )}
                  id="jobTitle"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, jobTitle: true }));
                    validate();
                  }}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Operations Director"
                  type="text"
                  value={jobTitle}
                />
                {touched.jobTitle && fieldErrors.jobTitle && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.jobTitle}
                  </p>
                )}
              </div>

              <div>
                <label className="text-label-caps text-stone-500 block mb-1" htmlFor="workEmail">
                  Work Email Address
                </label>
                <input
                  aria-invalid={!!(touched.workEmail && fieldErrors.workEmail)}
                  className={onboardingFieldClass(
                    !!(touched.workEmail && fieldErrors.workEmail),
                  )}
                  id="workEmail"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, workEmail: true }));
                    validate();
                  }}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="admin@restaurant.com"
                  type="email"
                  value={workEmail}
                />
                {touched.workEmail && fieldErrors.workEmail && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.workEmail}
                  </p>
                )}
              </div>

              <div>
                <label className="text-label-caps text-stone-500 block mb-1" htmlFor="password">
                  Password
                </label>
                <input
                  aria-invalid={!!(touched.password && fieldErrors.password)}
                  autoComplete="new-password"
                  className={onboardingFieldClass(
                    !!(touched.password && fieldErrors.password),
                  )}
                  id="password"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, password: true }));
                    validate();
                  }}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  type="password"
                  value={password}
                />
                {touched.password && fieldErrors.password && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="text-label-caps text-stone-500 block mb-1"
                  htmlFor="confirmPassword"
                >
                  Confirm Password
                </label>
                <input
                  aria-invalid={
                    !!(touched.confirmPassword && fieldErrors.confirmPassword)
                  }
                  autoComplete="new-password"
                  className={onboardingFieldClass(
                    !!(touched.confirmPassword && fieldErrors.confirmPassword),
                  )}
                  id="confirmPassword"
                  onBlur={() => {
                    setTouched((p) => ({ ...p, confirmPassword: true }));
                    validate();
                  }}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  type="password"
                  value={confirmPassword}
                />
                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <p className="text-body-sm text-error mt-1" role="alert">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <ul className="text-body-sm space-y-1 pt-1">
                {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
                  const met = passwordCriteria[key];
                  const hasInput = password.length > 0;
                  return (
                    <li
                      className={`flex items-center gap-2 ${hasInput ? (met ? 'text-text/60' : 'text-amber-700') : 'text-text/60'}`}
                      key={key}
                    >
                      <span
                        className={`material-symbols-outlined text-sm ${hasInput ? (met ? 'text-primary' : 'text-amber-600') : 'text-stone-400'}`}
                      >
                        {hasInput && met ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ul>

              <label className="flex items-start gap-3 cursor-pointer mt-4">
                <input
                  checked={termsAccepted}
                  className="mt-1 w-4 h-4 accent-primary"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTermsAccepted(checked);
                    setTouched((p) => ({ ...p, termsAccepted: true }));
                    validate({ termsAccepted: checked });
                  }}
                  type="checkbox"
                />
                <span className="text-body-sm text-text/80">
                  I confirm that I am the authorized account administrator and I
                  agree to the{' '}
                  <a
                    className="text-primary font-semibold hover:underline"
                    href={TERMS_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    className="text-primary font-semibold hover:underline"
                    href={PRIVACY_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Privacy Policy
                  </a>{' '}
                  of X7 Point of Sale.
                </span>
              </label>
              {touched.termsAccepted && !termsAccepted && fieldErrors.termsAccepted && (
                <p className="text-body-sm text-error" role="alert">
                  {fieldErrors.termsAccepted}
                </p>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                className="px-6 py-3 border border-text rounded-lg font-semibold text-text hover:bg-stone-50 transition-all duration-200 active:opacity-80"
                onClick={() => void handleBack()}
                type="button"
              >
                Back
              </button>
              <button
                className="px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-all duration-200 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canSubmit}
                type="submit"
              >
                {submitting ? 'Processing...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          { icon: 'security', title: 'Secure Access', subtitle: 'End-to-end encryption' },
          { icon: 'cloud_done', title: 'Cloud Sync', subtitle: 'Real-time data backup' },
          { icon: 'support_agent', title: '24/7 Priority', subtitle: 'Admin dedicated line' },
        ].map(({ icon, title, subtitle }) => (
          <div
            key={title}
            className="surface-paper rounded-lg p-5 flex items-center gap-4"
          >
            <span className="material-symbols-outlined text-primary text-3xl">
              {icon}
            </span>
            <div>
              <h3 className="text-label-caps text-text">{title}</h3>
              <p className="text-body-sm text-text/60">{subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </OnboardingLayout>
  );
}
