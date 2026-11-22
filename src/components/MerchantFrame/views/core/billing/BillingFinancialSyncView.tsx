import React, { useState } from 'react';
import { BillingFinancialSyncGrid } from './BillingFinancialSyncGrid';
import { BillingFinancialSyncHeader } from './BillingFinancialSyncHeader';

/**
 * Billing & Transactions → Financial Ledger Sync (`billing-financial-sync`).
 * MerchantFrame mounts the Billing & Transactions NavHubBar underneath (module-nav-hubs).
 * The header swaps in the metrics returned by POST BATCH TO LEDGER and bumps the grid's refreshKey.
 */
export const BillingFinancialSyncView: React.FC = () => {
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans pb-24">
      <BillingFinancialSyncHeader onBatchPosted={() => setGridRefreshKey((key) => key + 1)} />
      <BillingFinancialSyncGrid refreshKey={gridRefreshKey} />
    </div>
  );
};

export default BillingFinancialSyncView;
