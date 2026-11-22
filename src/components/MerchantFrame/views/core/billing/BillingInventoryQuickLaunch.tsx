import React from 'react';
import { QuickLaunchPanel, type QuickLaunchAction } from '@/shared/components/QuickLaunchPanel';
import {
  INVENTORY_QUICK_LAUNCH_ORDER,
  INVENTORY_QUICK_LAUNCH_TARGETS,
  buildInventoryTargetPath,
  describeBillingContext,
  saveBillingInventoryContext,
  type BillingInventoryContextInput,
  type InventoryQuickLaunchTarget,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

interface BillingInventoryQuickLaunchProps {
  /** Filtros y línea de recibo activos: viajan con la navegación y se restauran al volver. */
  context: BillingInventoryContextInput;
  /** Cambio de pestaña de MerchantFrame (fallback sin URL). */
  onNavigate?: (view: string) => void;
  /** Navegación por URL: lleva el contexto en la query y deja el Atrás del navegador funcionando. */
  navigateToPath?: (path: string) => void;
}

/**
 * Quick Launch inferior de "Inventory & Billing Stock Sync": salta a las vistas de inventario
 * (stock, conciliación y kardex) sin perder el contexto de facturación.
 */
export const BillingInventoryQuickLaunch: React.FC<BillingInventoryQuickLaunchProps> = ({
  context,
  onNavigate,
  navigateToPath,
}) => {
  const go = (target: InventoryQuickLaunchTarget) => {
    const definition = INVENTORY_QUICK_LAUNCH_TARGETS[target];
    saveBillingInventoryContext(context, target);
    if (navigateToPath) {
      navigateToPath(buildInventoryTargetPath(target, context));
    } else {
      onNavigate?.(definition.tab);
    }
  };

  const actions: QuickLaunchAction[] = INVENTORY_QUICK_LAUNCH_ORDER.map((target) => {
    const definition = INVENTORY_QUICK_LAUNCH_TARGETS[target];
    return {
      id: definition.tab,
      label: definition.label,
      icon: definition.icon,
      onClick: () => go(target),
    };
  });

  const contextLabel = describeBillingContext(context);
  const description = contextLabel
    ? `Investigate stock for ${contextLabel}. Your billing filters and selected receipt line are kept for the way back.`
    : 'Jump from billing receipts to stock levels, reconciliation and warehouse movements. Your billing filters are kept for the way back.';

  return (
    <nav aria-label="Billing inventory quick launch" data-testid="billing-inventory-quick-launch">
      <QuickLaunchPanel title="Inventory Quick Launch" description={description} actions={actions} />
    </nav>
  );
};

export default BillingInventoryQuickLaunch;
