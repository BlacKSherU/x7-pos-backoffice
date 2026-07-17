import type { ReactNode } from 'react';
import { OnboardingStepper } from './OnboardingStepper';
import type { OnboardingStep } from '../../types/onboarding';

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL ?? 'https://support.x7pos.com';
const PRIVACY_URL =
  import.meta.env.VITE_PRIVACY_URL ?? 'https://x7pos.com/privacy';
const TERMS_URL =
  import.meta.env.VITE_TERMS_URL ?? 'https://x7pos.com/terms';

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: OnboardingStep;
  subtitle?: string;
  onSaveExit: () => void;
  wide?: boolean;
}

export function OnboardingLayout({
  children,
  currentStep,
  subtitle,
  onSaveExit,
  wide = false,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-poppins bg-background">
      <header className="flex items-center justify-between w-full px-6 md:px-10 py-4 border-b border-border bg-white/50">
        <div className="flex items-center gap-3">
          <img
            alt="X7 Point of Sale"
            className="h-9 w-auto max-w-[120px] object-contain"
            src="/logo-header.svg"
          />
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <span className="text-label-caps text-primary border-b-2 border-primary pb-0.5 hidden sm:inline">
            Onboarding
          </span>
          <button
            className="text-label-caps text-text hover:text-primary transition-colors"
            onClick={onSaveExit}
            type="button"
          >
            Save &amp; Exit
          </button>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-body-sm text-text/60">Need help?</span>
            <a
              className="text-body-sm font-bold text-primary-container hover:opacity-80 transition-all"
              href={SUPPORT_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Support
            </a>
          </div>
        </div>
      </header>

      <main className="grow w-full px-4 md:px-8 py-8">
        <div className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}>
          <OnboardingStepper currentStep={currentStep} subtitle={subtitle} />
          {children}
        </div>
      </main>

      <footer className="flex flex-col md:flex-row justify-between items-center w-full px-6 md:px-10 py-6 border-t border-border/50">
        <p className="text-xs text-text/60">
          © {new Date().getFullYear()} X7 Point of Sale. All rights reserved.
        </p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a
            className="text-xs text-text/60 hover:text-text transition-colors underline"
            href={PRIVACY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Privacy Policy
          </a>
          <a
            className="text-xs text-text/60 hover:text-text transition-colors underline"
            href={TERMS_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Terms of Service
          </a>
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

export { PRIVACY_URL, TERMS_URL, SUPPORT_URL };
