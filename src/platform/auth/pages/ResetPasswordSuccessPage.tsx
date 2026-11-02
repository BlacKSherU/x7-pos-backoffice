import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/platform/auth/components/AuthLayout';
import {
  RESET_SUCCESS_HEADING,
  RESET_SUCCESS_REDIRECT_DELAY_MS,
  RESET_SUCCESS_SUBTITLE,
  SECURE_AUTH_BUILD_SIGNATURE,
  consumePasswordResetSuccess,
} from '@/platform/auth/lib/reset-password-success';
import { useHistoryBackLock } from '@/shared/lib/use-history-back-lock';

const SUCCESS_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida/ADBb0ujD2aA-kgKZ2dwP6FqqsPKxtIH5cfLRHElVQ8zw-cdfXBqjXjEbt7FvfnZMDl8AOWtNV6n7wTQe_YxkAHKGcM5WCW3d2waWr01ce_ZvVC53wq7ZTiuFa5r90YdZXJsvguzHyF1bAmbul9aCDBsvnb-VlTvgdLTqXoBw_S39UNN9fvUYc3VkVZMWyrFeYWWv0-R01nKl-W986DXMzNTAnvsYPeYfpumJSWlW15xAZICJEhC2HvZHccQUtFM-lnMtN64wbMuIuQhhig';

export function ResetPasswordSuccessPage() {
  const navigate = useNavigate();
  const [isAuthorized] = useState(() => consumePasswordResetSuccess());

  useHistoryBackLock(isAuthorized);

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/login', { replace: true });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true });
    }, RESET_SUCCESS_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthorized, navigate]);

  if (!isAuthorized) {
    return null;
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
            <h1 className="text-h2 text-text font-semibold mb-2">
              {RESET_SUCCESS_HEADING}
            </h1>
            <p className="text-body-md text-text/60">{RESET_SUCCESS_SUBTITLE}</p>
          </div>
        </div>

        <div className="p-6 md:p-8 text-center flex flex-col items-center">
          <div className="w-full h-24 mb-8 overflow-hidden rounded bg-[#f9f7f4] border border-border">
            <img
              alt="Minimal architectural workspace detail"
              className="w-full h-full object-cover grayscale opacity-20"
              src={SUCCESS_IMAGE_URL}
            />
          </div>

          <Link
            className="w-full bg-primary-container text-white py-4 text-body-md font-bold rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            data-testid="reset-success-back-to-login"
            replace
            to="/login"
          >
            Back to Login
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </Link>

          <p className="sr-only" role="status">
            Redirecting to login in {RESET_SUCCESS_REDIRECT_DELAY_MS / 1000}{' '}
            seconds.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end items-center opacity-40">
        <span
          className="font-mono text-[10px] text-primary-container/60"
          data-testid="secure-auth-signature"
        >
          {SECURE_AUTH_BUILD_SIGNATURE}
        </span>
      </div>
    </AuthLayout>
  );
}
