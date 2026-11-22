import React from 'react';
import { QuickLaunchPanel, type QuickLaunchAction } from '@/shared/components/QuickLaunchPanel';

/** Pantallas hermanas del hub Billing & Transactions (ids de nav_item / module-nav-hubs). */
const BILLING_SIBLING_VIEWS = [
  { id: 'receipt-orders', label: 'RECEIPTS', icon: 'receipt_long' },
  { id: 'receipt-items', label: 'RECEIPT ITEMS', icon: 'list' },
  { id: 'receipt-taxes', label: 'RECEIPTS TAXES', icon: 'percent' },
] as const;

interface ReceiptsQuickLaunchProps {
  onNavigate?: (view: string) => void;
  /** Abre el panel de alta de recibo. */
  onNewReceipt: () => void;
  /** Lista los recibos dados de baja (baja lógica) para auditarlos o reactivarlos. */
  onShowDeactivated: () => void;
}

/**
 * Quick Launch de Receipts: atajos a las operaciones frecuentes (emitir un recibo, revisar
 * los dados de baja) y a las pantallas hermanas del hub; RECEIPTS es la vista activa.
 */
export const ReceiptsQuickLaunch: React.FC<ReceiptsQuickLaunchProps> = ({
  onNavigate,
  onNewReceipt,
  onShowDeactivated,
}) => {
  const actions: QuickLaunchAction[] = [
    { id: 'receipts-new', label: 'NEW RECEIPT', icon: 'add_circle', variant: 'danger', onClick: onNewReceipt },
    { id: 'receipts-deactivated', label: 'DEACTIVATED RECEIPTS', icon: 'restore', onClick: onShowDeactivated },
    ...BILLING_SIBLING_VIEWS.map((view) => ({
      id: view.id,
      label: view.label,
      icon: view.icon,
      active: view.id === 'receipt-orders',
      onClick: () => onNavigate?.(view.id),
    })),
  ];

  return (
    <nav aria-label="Receipts quick launch">
      <QuickLaunchPanel
        title="Receipts Quick Launch"
        description="Issue a receipt, audit deactivated receipts, or jump to receipt items and receipt taxes without leaving the Billing & Transactions workspace."
        actions={actions}
      />
    </nav>
  );
};

export default ReceiptsQuickLaunch;
