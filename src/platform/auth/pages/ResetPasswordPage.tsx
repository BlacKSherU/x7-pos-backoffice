import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '@/platform/auth/api/auth';
import { AuthLayout } from '@/platform/auth/components/AuthLayout';
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  evaluatePasswordCriteria,
  isPasswordValid,
  submitResetPasswordRequest,
} from '@/platform/auth/lib/reset-password';
import {
  RESET_PASSWORD_SUCCESS_PATH,
  markPasswordResetSuccess,
} from '@/platform/auth/lib/reset-password-success';

const INVALID_TOKEN_REDIRECT_DELAY_MS = 3000;

type RequirementKey = 'minLength' | 'uppercase' | 'numberOrSpecial';

const REQUIREMENTS: Array<{ key: RequirementKey; label: string }> = [
  { key: 'minLength', label: 'Minimum 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'numberOrSpecial', label: 'One special character or number' },
];

function requirementIconClass(met: boolean, hasInput: boolean): string {
  if (!hasInput) {
    return 'text-primary-container';
  }
  return met ? 'text-primary-container' : 'text-amber-600';
}

function requirementTextClass(met: boolean, hasInput: boolean): string {
  if (!hasInput) {
    return 'text-text/60';
  }
  return met ? 'text-text/60' : 'text-amber-700';
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [tokenRejected, setTokenRejected] = useState(false);

  const invalidToken = !token.trim() || tokenRejected;
  const criteria = evaluatePasswordCriteria(newPassword);
  const passwordMeetsRequirements = isPasswordValid(criteria);
  const hasPasswordInput = newPassword.length > 0;
  const formDisabled = loading || invalidToken;

  useEffect(() => {
    if (!invalidToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate('/forgot-password', { replace: true });
    }, INVALID_TOKEN_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [invalidToken, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmPasswordError(null);

    if (invalidToken) {
      return;
    }

    setLoading(true);

    const result = await submitResetPasswordRequest(
      token,
      newPassword,
      confirmPassword,
      resetPassword,
    );

    switch (result.status) {
      case 'missing_token':
      case 'invalid_token':
        setTokenRejected(true);
        setError(
          result.status === 'invalid_token'
            ? result.message
            : INVALID_RESET_TOKEN_MESSAGE,
        );
        setNewPassword('');
        setConfirmPassword('');
        break;
      case 'validation_error':
        if (result.message === PASSWORD_MISMATCH_MESSAGE) {
          setConfirmPasswordError(result.message);
        } else {
          setError(result.message);
        }
        break;
      case 'success':
        setNewPassword('');
        setConfirmPassword('');
        markPasswordResetSuccess();
        navigate(RESET_PASSWORD_SUCCESS_PATH, { replace: true });
        break;
      case 'error':
        setError(result.message);
        break;
    }

    setLoading(false);
  }

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
            <h1 className="text-h2 text-text font-semibold mb-1">
              Create New Password
            </h1>
            <p className="text-body-md text-text/60">
              Ensure your account remains secure with a strong, unique password.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {invalidToken ? (
            <div className="space-y-6" role="alert">
              <div className="rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-body-sm text-error">
                {INVALID_RESET_TOKEN_MESSAGE}
              </div>
              <p className="text-body-sm text-text/60 text-center">
                Redirecting to request a new link…
              </p>
              <Link
                className="text-body-sm text-primary-container font-semibold flex items-center justify-center gap-1 hover:opacity-80"
                to="/forgot-password"
              >
                Request a new link now
              </Link>
            </div>
          ) : (
            <form className="space-y-6" noValidate onSubmit={handleSubmit}>
              {error && (
                <div
                  className="rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-body-sm text-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <fieldset
                className="space-y-6 border-0 p-0 m-0"
                disabled={formDisabled}
              >
                <div className="space-y-1">
                  <label
                    className="text-label-caps text-text block"
                    htmlFor="new-password"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text/40 text-lg">
                      key
                    </span>
                    <input
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-lg text-body-md text-text focus:ring-1 focus:ring-text focus:border-text outline-none bg-white transition-all"
                      id="new-password"
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      placeholder="Min. 8 characters"
                      required
                      type="password"
                      value={newPassword}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-label-caps text-text block"
                    htmlFor="confirm-password"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text/40 text-lg">
                      verified_user
                    </span>
                    <input
                      aria-describedby={
                        confirmPasswordError ? 'confirm-password-error' : undefined
                      }
                      aria-invalid={Boolean(confirmPasswordError)}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-lg text-body-md text-text focus:ring-1 focus:ring-text focus:border-text outline-none bg-white transition-all"
                      id="confirm-password"
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmPasswordError) {
                          setConfirmPasswordError(null);
                        }
                      }}
                      placeholder="Repeat your password"
                      required
                      type="password"
                      value={confirmPassword}
                    />
                  </div>
                  {confirmPasswordError && (
                    <p
                      className="text-body-sm text-error mt-1"
                      id="confirm-password-error"
                      role="alert"
                    >
                      {confirmPasswordError}
                    </p>
                  )}
                </div>

                <button
                  className="w-full bg-primary-container text-white py-4 text-body-md font-bold rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="reset-password-submit"
                  disabled={loading || !passwordMeetsRequirements}
                  type="submit"
                >
                  {loading ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-base animate-spin"
                      >
                        progress_activity
                      </span>
                      Processing...
                    </>
                  ) : (
                    <>
                      Update Password
                      <span className="material-symbols-outlined text-base">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}

          {!invalidToken && (
            <div className="px-0 pt-6 mt-6 border-t border-border">
              <div className="flex gap-4 items-start">
                <span className="material-symbols-outlined text-primary-container text-[20px]">
                  info
                </span>
                <ul className="text-body-sm space-y-1">
                  {REQUIREMENTS.map(({ key, label }) => {
                    const met = criteria[key];
                    return (
                      <li
                        className={`flex items-center gap-2 ${requirementTextClass(met, hasPasswordInput)}`}
                        key={key}
                      >
                        <span
                          className={`material-symbols-outlined text-[14px] ${requirementIconClass(met, hasPasswordInput)}`}
                        >
                          {hasPasswordInput && !met ? 'error' : 'check_circle'}
                        </span>
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-text/40">
          <span className="material-symbols-outlined text-sm">security</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">
            Secure Session: 256-bit AES
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}
