import React from 'react';
import { BillingFinancialSyncGrid } from './BillingFinancialSyncGrid';

/**
 * Billing & Transactions → Financial Ledger Sync (`billing-financial-sync`).
 * MerchantFrame mounts the Billing & Transactions NavHubBar underneath (module-nav-hubs).
 */
export const BillingFinancialSyncView: React.FC = () => (
  <div className="flex flex-col gap-6 animate-fade-in text-left font-sans pb-24">
    <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
          account_balance
        </span>
        <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
          Billing ↔ Ledger Sync
        </h2>
      </div>
      <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
        Audit how each receipt and its tax records were posted to journal entries, debit/credit lines and ledger accounts.
      </p>
    </div>

    <BillingFinancialSyncGrid />
  </div>
);

export default BillingFinancialSyncView;
