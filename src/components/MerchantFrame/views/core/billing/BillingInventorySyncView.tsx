import React, { useCallback, useEffect, useState } from 'react';
import { BillingInventorySyncGrid } from './BillingInventorySyncGrid';
import { BillingInventorySyncHeader } from './BillingInventorySyncHeader';
import {
  initialBillingInventoryContext,
  saveBillingInventoryContext,
  type BillingInventoryFilters,
  type BillingInventorySelection,
} from '@/modules/core/billing-transactions/lib/billing-inventory-context';
import { primaryStockItemId } from '@/modules/core/billing-transactions/lib/inventory-sync-status';
import type { InventorySyncRow } from '@/modules/core/billing-transactions/types/inventory-sync';

const selectionFromRow = (row: InventorySyncRow): BillingInventorySelection => ({
  receiptItemId: row.receiptItemId,
  receiptId: row.receiptId,
  invoiceNumber: row.invoiceNumber,
  sku: row.sku,
  orderId: row.orderId,
  stockItemId: primaryStockItemId(row),
});

/**
 * Pantalla `billing-inventory-sync` (Billing & Transactions): contenedor del header de métricas
 * y el grid ReceiptItem → deducciones de stock. Es dueña del contexto de facturación (filtros +
 * línea seleccionada), que persiste en sessionStorage para restaurarlo al volver a la pantalla.
 */
export const BillingInventorySyncView: React.FC = () => {
  const [initial] = useState(() => initialBillingInventoryContext());
  const [filters, setFilters] = useState<BillingInventoryFilters>(initial.filters);
  const [selection, setSelection] = useState<BillingInventorySelection | null>(initial.selection);
  // Sube tras cada validación de stock para que el grid vuelva a pedir sus filas.
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  useEffect(() => {
    saveBillingInventoryContext({ filters, selection });
  }, [filters, selection]);

  const handleSelectRow = useCallback((row: InventorySyncRow) => {
    setSelection((prev) => (prev?.receiptItemId === row.receiptItemId ? null : selectionFromRow(row)));
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans font-poppins pb-24">
      <BillingInventorySyncHeader
        selection={selection}
        onValidated={() => setGridRefreshKey((key) => key + 1)}
      />

      <BillingInventorySyncGrid
        filters={filters}
        onFiltersChange={setFilters}
        selectedReceiptItemId={selection?.receiptItemId ?? null}
        onSelectRow={handleSelectRow}
        refreshKey={gridRefreshKey}
      />
    </div>
  );
};

export default BillingInventorySyncView;
