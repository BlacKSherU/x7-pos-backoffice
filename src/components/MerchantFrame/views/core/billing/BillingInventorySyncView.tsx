import React, { useEffect, useState } from 'react';
import { BillingInventoryQuickLaunch } from './BillingInventoryQuickLaunch';
import {
  initialBillingInventoryContext,
  saveBillingInventoryContext,
  type BillingInventoryFilters,
  type BillingInventorySelection,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';

interface BillingInventorySyncViewProps {
  onNavigate?: (view: string) => void;
  navigateToPath?: (path: string) => void;
}

/**
 * Pantalla `billing-inventory-sync` (Billing & Transactions): contenedor del header de métricas,
 * el grid ReceiptItem → deducciones de stock y el Quick Launch hacia inventario. Es dueña del
 * contexto de facturación (filtros + línea seleccionada), que persiste para restaurarlo al volver
 * de las vistas de inventario.
 */
export const BillingInventorySyncView: React.FC<BillingInventorySyncViewProps> = ({
  onNavigate,
  navigateToPath,
}) => {
  const [initial] = useState(() => initialBillingInventoryContext());
  const [filters] = useState<BillingInventoryFilters>(initial.filters);
  const [selection] = useState<BillingInventorySelection | null>(initial.selection);

  useEffect(() => {
    saveBillingInventoryContext({ filters, selection });
  }, [filters, selection]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans font-poppins pb-24">
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
            inventory_2
          </span>
          <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-poppins">
            INVENTORY &amp; BILLING STOCK SYNC
          </h2>
        </div>
        <p className="text-[#5f5e5e] text-body-sm mt-1 font-poppins">
          Cross-check receipt line items against warehouse stock deductions and jump to inventory without losing your billing context.
        </p>
      </div>

      <BillingInventoryQuickLaunch
        context={{ filters, selection }}
        onNavigate={onNavigate}
        navigateToPath={navigateToPath}
      />
    </div>
  );
};

export default BillingInventorySyncView;
