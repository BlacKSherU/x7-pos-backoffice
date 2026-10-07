import React from 'react';
import { NavHubBar } from '../../../shared/NavHubBar';

export type ProductsSubModule =
  | 'categories'
  | 'modifiers'
  | 'products'
  | 'variants';

export type InventorySubModule = ProductsSubModule;

interface ProductsNavHubBarProps {
  activeModuleId: ProductsSubModule;
  onNavigate?: (view: string) => void;
}

export const ProductsNavHubBar: React.FC<ProductsNavHubBarProps> = ({
  activeModuleId,
  onNavigate,
}) => {
  return (
    <nav aria-label="Products catalog sub-module navigation">
      <NavHubBar
        title="PRODUCTS COMMAND HUB"
        titleIcon="inventory_2"
        subtitle="Catalog Matrix, Categories, Modifiers &amp; Variants"
        activeModuleId={activeModuleId}
        onBackToDashboard={() => onNavigate?.('inventory-dashboard')}
        backToDashboardLabel="PRODUCTS COMMAND HUB"
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
        ]}
      />
    </nav>
  );
};

export const InventoryNavHubBar = ProductsNavHubBar;
export default ProductsNavHubBar;
