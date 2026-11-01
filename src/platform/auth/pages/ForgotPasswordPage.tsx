import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '@/platform/auth/api/auth';
import { AuthLayout } from '@/platform/auth/components/AuthLayout';
import { validateEmail } from '@/shared/lib/email-validation';
import {
  ensureMinimumLoadingDuration,
  getResendCooldownSeconds,
  FORGOT_PASSWORD_SEND_FEEDBACK_MESSAGE,
  submitForgotPasswordRequest,
} from '@/platform/auth/lib/forgot-password';

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL ?? 'https://support.x7pos.com';

const SEND_FEEDBACK_VISIBLE_MS = 2_000;

function emailFieldClass(hasError: boolean): string {
  const base =
    'w-full pl-10 pr-4 py-3 bg-white border text-body-md focus:outline-none transition-colors rounded-lg';
  return hasError
    ? `${base} border-error focus:border-error`
    : `${base} border-border focus:border-text`;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [sendFeedback, setSendFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCooldownActive = cooldownSeconds > 0;
  const isSubmitDisabled = loading || isCooldownActive;
  const submitLabel = loading
    ? linkSent
      ? 'Resend Reset Link'
      : 'Send Reset Link'
    : isCooldownActive
      ? `Resend in ${cooldownSeconds}s`
      : linkSent
        ? 'Resend Reset Link'
        : 'Send Reset Link';

  useEffect(() => {
    const updateCooldown = () => {
      setCooldownSeconds(getResendCooldownSeconds(lastSentAt));
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);
    return () => clearInterval(intervalId);
  }, [lastSentAt]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  function showSendFeedback() {
    setSendFeedback(true);
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setSendFeedback(false);
    }, SEND_FEEDBACK_VISIBLE_MS);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || isCooldownActive) {
      return;
    }

    setTouched(true);
    setError(null);
    if (!linkSent) {
      setSuccess(null);
    }
    setEmailError(null);

    const startedAt = Date.now();
    setLoading(true);

    try {
      const result = await submitForgotPasswordRequest(
        email,
        requestPasswordReset,
      );

      switch (result.status) {
        case 'validation_error':
          setEmailError(result.emailError);
          break;
        case 'success':
          setSuccess(result.message);
          setLinkSent(true);
          setLastSentAt(Date.now());
          showSendFeedback();
          break;
        case 'rate_limited':
          setSuccess(null);
          setError(result.message);
          break;
        case 'error':
          setSuccess(null);
          setError(result.message);
          break;
      }
    } finally {
      await ensureMinimumLoadingDuration(startedAt);
      setLoading(false);
    }
  }

  function handleEmailBlur() {
    setTouched(true);
    const validationError = validateEmail(email);
    setEmailError(validationError ?? null);
  }

  const showEmailError = touched && Boolean(emailError);

  return (
    <AuthLayout>
      <div className="surface-paper login-shadow rounded-lg overflow-hidden w-full">
        <div className="p-8 text-center border-b border-border bg-[#f9f7f4]">
          <div className="flex flex-col items-center py-4">
            <img
              alt="X7 Point of Sale"
              className="mx-auto w-full max-w-[180px] h-auto object-contain mb-6"
              src="/logo-card.svg"
            />
            <h2 className="text-h2 text-text font-semibold mb-1">
              Forgot Password
            </h2>
            <p className="text-body-md text-text/60">
              Enter your email to receive a reset link
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <form className="space-y-6" noValidate onSubmit={handleSubmit}>
            {error && (
              <div
                className="rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-body-sm text-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-body-sm text-green-800"
                role="status"
              >
                {success}
              </div>
            )}

            <div className="flex flex-col space-y-1">
              <label className="text-label-caps text-text" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary/60 text-lg">
                  mail
                </span>
                <input
                  aria-describedby={showEmailError ? 'email-error' : undefined}
                  aria-invalid={showEmailError}
                  autoComplete="email"
                  className={emailFieldClass(showEmailError)}
                  id="email"
                  name="email"
                  onBlur={handleEmailBlur}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) {
                      setEmailError(null);
                    }
                  }}
                  placeholder="name@restaurant.com"
                  type="email"
                  value={email}
                />
              </div>
              {showEmailError && (
                <p
                  className="text-body-sm text-error mt-1"
                  id="email-error"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                aria-busy={loading}
                className="w-full bg-primary-container text-white py-4 text-body-md font-bold rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="forgot-password-submit"
                disabled={isSubmitDisabled}
                type="submit"
              >
                {loading && (
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-base animate-spin"
                  >
                    progress_activity
                  </span>
                )}
                <span>{submitLabel}</span>
                {!loading && !linkSent && (
                  <span className="material-symbols-outlined text-base">
                    arrow_forward
                  </span>
                )}
              </button>

              {sendFeedback && (
                <p
                  className="text-body-sm text-green-700 text-center flex items-center justify-center gap-1"
                  data-testid="forgot-password-send-feedback"
                  role="status"
                >
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-base"
                  >
                    check_circle
                  </span>
                  {FORGOT_PASSWORD_SEND_FEEDBACK_MESSAGE}
                </p>
              )}

            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-[#f9f7f4] flex flex-col items-center space-y-4">
            <Link
              className="text-body-sm text-primary-container font-semibold flex items-center space-x-1 hover:opacity-80 transition-opacity"
              to="/login"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
              <span>Back to Login</span>
            </Link>
            <div className="pt-2">
              <p className="text-body-sm text-secondary/60 text-center">
                Need immediate assistance?
                <br />
                <a
                  className="text-text font-medium hover:underline"
                  href={SUPPORT_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Contact X7 Enterprise Support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
