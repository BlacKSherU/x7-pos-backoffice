import React from 'react';
import { QuickLaunchPanel, type QuickLaunchAction } from '@/shared/components/QuickLaunchPanel';

/** Sibling screens of the Billing & Transactions epic, in navigation order. */
const BILLING_SIBLING_ANCHORS = [
  { featureId: 'receipt-orders', label: 'RECEIPTS', icon: 'receipt_long' },
  { featureId: 'receipt-items', label: 'RECEIPT ITEMS', icon: 'list' },
  { featureId: 'receipt-taxes', label: 'RECEIPTS TAXES', icon: 'percent' },
] as const;

interface ReceiptItemsQuickLaunchProps {
  /** featureId of the current screen (rendered as the non-clickable active anchor). */
  current?: string;
  onNavigate?: (featureId: string) => void;
}

/**
 * Quick Launch of the Receipt Items workspace (Historia 15): shortcuts to RECEIPTS and
 * RECEIPTS TAXES with RECEIPT ITEMS as the active anchor (#ae001a + underline, from
 * QuickLaunchPanel). Navigation goes through `onNavigate` (MerchantFrame's
 * navigateToFeature): SPA state change, no full page reload.
 */
export const ReceiptItemsQuickLaunch: React.FC<ReceiptItemsQuickLaunchProps> = ({
  current = 'receipt-items',
  onNavigate,
}) => {
  const actions: QuickLaunchAction[] = BILLING_SIBLING_ANCHORS.map((anchor) => ({
    id: anchor.featureId,
    label: anchor.label,
    icon: anchor.icon,
    active: anchor.featureId === current,
    onClick: () => onNavigate?.(anchor.featureId),
  }));

  return (
    <nav aria-label="Billing and transactions shortcuts">
      <QuickLaunchPanel
        title="Billing Workspace Shortcuts"
        description="Switch between Receipts, Receipt Items and Receipts Taxes without leaving the Billing & Transactions context."
        actions={actions}
      />
    </nav>
  );
};

export default ReceiptItemsQuickLaunch;
