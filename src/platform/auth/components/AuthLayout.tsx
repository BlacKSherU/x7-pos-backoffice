import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const KITCHEN_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida/ADBb0ujizQP-A-ahodLmw-gT35EfaxqLiLphUbWB5JU8Jy7TIKMRzFscDUjpp9iSj1tMyXgu_3_JuK2mkb59WgrWWGff0e7rUfRlUyFRtY73-bvMaphtJzP5JOcNXxENszbT1WkdEpA9NlNNn2AqFVIVmU_xP-ZqfsHBm7jrmty7jWCqUUQQi_wN5zEd_ZbaM4QbmzjBf6SMqErBOMYuS_84u-lDzzeCqdV_5QJHwyNM7ayeJALdIPxYQUOhKuLNrCSzGJraH0hYAloYi2k';

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL ?? 'https://support.x7pos.com';

interface AuthLayoutProps {
  children: ReactNode;
  showPromo?: boolean;
}

export function AuthLayout({ children, showPromo = false }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-poppins">
      <header className="bg-background flex items-center justify-between w-full px-8 py-4 border-b border-border">
        <div className="flex-1 hidden md:block" />
        <div className="flex items-center justify-center gap-3 grow">
          <img
            alt="X7 Point of Sale"
            className="h-10 w-auto max-w-[140px] object-contain"
            src="/logo-header.svg"
          />
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          <span className="text-sm text-text/60">Need help?</span>
          <a
            className="text-sm font-bold text-primary-container transition-all hover:opacity-80"
            href={SUPPORT_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Support
          </a>
        </div>
      </header>

      <main className="grow flex items-center justify-center px-4 py-8 relative overflow-hidden w-full">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-border/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 p-6 hidden lg:block opacity-10">
          <img
            alt="Restaurant Detail"
            className="h-[500px] object-cover"
            src={KITCHEN_IMAGE_URL}
          />
        </div>

        <div className="w-full max-w-md z-10 shrink-0">
          {children}

          {showPromo && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="surface-paper p-4 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-text rounded flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white">
                    speed
                  </span>
                </div>
                <div className="text-body-sm">
                  <p className="font-bold text-text">Optimized Speed</p>
                  <p className="text-text/60">V3.4 engine ready.</p>
                </div>
              </div>
              <div className="surface-paper p-4 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-text rounded flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white">
                    verified_user
                  </span>
                </div>
                <div className="text-body-sm">
                  <p className="font-bold text-text">Secure Access</p>
                  <p className="text-text/60">End-to-end encryption.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-6 bg-transparent">
        <p className="text-xs text-text/60">
          © 2026 X7 Point of Sale. All rights reserved.
        </p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <Link
            className="text-xs text-text/60 hover:text-text transition-colors underline"
            to="#"
          >
            Privacy Policy
          </Link>
          <Link
            className="text-xs text-text/60 hover:text-text transition-colors underline"
            to="#"
          >
            Terms of Service
          </Link>
          <a
            className="text-xs text-text/60 hover:text-text transition-colors underline"
            href={SUPPORT_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Help Center
          </a>
        </div>
      </footer>
    </div>
  );
}
