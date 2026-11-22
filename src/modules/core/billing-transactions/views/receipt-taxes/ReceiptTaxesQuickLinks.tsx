import React from 'react';
import { QuickLaunchPanel, type QuickLaunchAction } from '@/shared/components/QuickLaunchPanel';

/** Billing & Transactions Command Hub (featureId of the epic panel). */
export const BILLING_TRANSACTIONS_HUB_ID = 'billing-transactions-hub';

interface ReceiptTaxesQuickLinksProps {
  onNavigate?: (view: string) => void;
}

const BILLING_ANCHORS: Array<{ featureId: string; label: string; icon: string }> = [
  { featureId: 'receipt-orders', label: 'RECEIPTS', icon: 'receipt_long' },
  { featureId: 'receipt-items', label: 'RECEIPT ITEMS', icon: 'list' },
  { featureId: 'receipt-taxes', label: 'RECEIPTS TAXES', icon: 'percent' },
];

/**
 * Quick Launch of the Receipt Taxes view: sibling screens of Billing & Transactions
 * (RECEIPTS TAXES is the current one) plus the return to the epic Command Hub.
 * Navigation goes through `onNavigate` (MerchantFrame tab switch), never a page reload.
 */
export const ReceiptTaxesQuickLinks: React.FC<ReceiptTaxesQuickLinksProps> = ({ onNavigate }) => {
  const actions: QuickLaunchAction[] = [
    ...BILLING_ANCHORS.map((anchor) => ({
      id: anchor.featureId,
      label: anchor.label,
      icon: anchor.icon,
      active: anchor.featureId === 'receipt-taxes',
      onClick: () => onNavigate?.(anchor.featureId),
    })),
    {
      id: BILLING_TRANSACTIONS_HUB_ID,
      label: 'BILLING HUB',
      icon: 'space_dashboard',
      onClick: () => onNavigate?.(BILLING_TRANSACTIONS_HUB_ID),
    },
  ];

  return (
    <nav aria-label="Billing and transactions shortcuts">
      <QuickLaunchPanel
        title="Billing & Transactions Shortcuts"
        description="Pivot across receipts, their line items and the taxes they carry, or go back to the Billing & Transactions Command Hub."
        actions={actions}
      />
    </nav>
  );
};

export default ReceiptTaxesQuickLinks;
