import React from 'react';
import { Link } from 'react-router-dom';

export const GlobalFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex flex-col md:flex-row justify-between items-center w-full mt-xl pt-lg border-t border-border-subtle mb-10 select-none font-sans">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
        <span>© {currentYear} X7 Point of Sale. All rights reserved.</span>
        <span className="material-symbols-outlined text-xs leading-none">chevron_right</span>
      </div>
      <div className="flex gap-6 text-xs font-semibold text-text-muted mt-4 md:mt-0">
        <Link
          to="/legal/privacy-policy"
          className="hover:text-primary transition-colors underline duration-200"
        >
          Privacy Policy
        </Link>
        <Link
          to="/legal/terms-of-service"
          className="hover:text-primary transition-colors underline duration-200"
        >
          Terms of Service
        </Link>
        <Link
          to="/support/help-center"
          className="hover:text-primary transition-colors underline duration-200"
        >
          Help Center
        </Link>
      </div>
    </footer>
  );
};

export default GlobalFooter;
