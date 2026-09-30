import React from 'react';
import { NavHubBar } from '../../../shared/NavHubBar';

export type InventorySubModule =
  | 'categories'
  | 'modifiers'
  | 'products'
  | 'purchase-orders'
  | 'stock-movements'
  | 'variants';

interface InventoryNavHubBarProps {
  activeModuleId: InventorySubModule;
  onNavigate?: (view: string) => void;
}

export const InventoryNavHubBar: React.FC<InventoryNavHubBarProps> = ({
  activeModuleId,
  onNavigate,
}) => {
  return (
    <nav aria-label="Products and Inventory sub-module navigation">
      <NavHubBar
        title="PRODUCTS &amp; INVENTORY COMMAND HUB"
        titleIcon="inventory_2"
        subtitle="Catalog Matrix, Purchase Orders &amp; Stock Levels"
        activeModuleId={activeModuleId}
        onBackToDashboard={() => onNavigate?.('inventory-dashboard')}
        backToDashboardLabel="INVENTORY COMMAND HUB"
        items={[
          {
            id: 'categories',
            label: 'CATEGORIES',
            icon: 'category',
            active: activeModuleId === 'categories',
            onClick: () => onNavigate?.('categories'),
          },
          {
            id: 'products',
            label: 'PRODUCTS',
            icon: 'inventory_2',
            active: activeModuleId === 'products',
            onClick: () => onNavigate?.('products'),
          },
          {
            id: 'variants',
            label: 'VARIANTS',
            icon: 'style',
            active: activeModuleId === 'variants',
            onClick: () => onNavigate?.('variants'),
          },
          {
            id: 'modifiers',
            label: 'MODIFIERS',
            icon: 'tune',
            active: activeModuleId === 'modifiers',
            onClick: () => onNavigate?.('modifiers'),
          },
          {
            id: 'stock-movements',
            label: 'STOCK & MOVEMENTS',
            icon: 'swap_vert',
            active: activeModuleId === 'stock-movements',
            onClick: () => onNavigate?.('stock-movements'),
          },
          {
            id: 'purchase-orders',
            label: 'PURCHASE ORDERS',
            icon: 'receipt_long',
            active: activeModuleId === 'purchase-orders',
            onClick: () => onNavigate?.('purchase-orders'),
          },
        ]}
      />
    </nav>
  );
};

export default InventoryNavHubBar;
