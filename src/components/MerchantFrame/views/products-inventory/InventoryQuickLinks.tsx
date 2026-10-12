import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QuickLaunchPanel, type QuickLaunchAction } from '../../shared/QuickLaunchPanel';

export type InventoryQuickLinkAnchorKey =
  | 'categories'
  | 'modifiers'
  | 'products'
  | 'purchase-orders'
  | 'stock-movements'
  | 'variants';

interface InventoryQuickLinksProps {
  current?: InventoryQuickLinkAnchorKey;
  activeTab?: InventoryQuickLinkAnchorKey;
  onNavigate?: (view: string) => void;
}

const INVENTORY_ANCHORS: Array<{
  key: InventoryQuickLinkAnchorKey;
  label: string;
  route: string;
  featureId: string;
  icon: string;
}> = [
  {
    key: 'categories',
    label: 'CATEGORIES',
    route: '/dashboard/categories',
    featureId: 'categories',
    icon: 'category',
  },
  {
    key: 'products',
    label: 'PRODUCTS',
    route: '/dashboard/products',
    featureId: 'products',
    icon: 'inventory_2',
  },
  {
    key: 'variants',
    label: 'VARIANTS',
    route: '/dashboard/variants',
    featureId: 'variants',
    icon: 'style',
  },
  {
    key: 'modifiers',
    label: 'MODIFIERS',
    route: '/dashboard/modifiers',
    featureId: 'modifiers',
    icon: 'tune',
  },
  {
    key: 'stock-movements',
    label: 'STOCK & MOVEMENTS',
    route: '/inventory/stocks',
    featureId: 'stock-movements',
    icon: 'swap_vert',
  },
  {
    key: 'purchase-orders',
    label: 'PURCHASE ORDERS',
    route: '/inventory/purchase-orders',
    featureId: 'purchase-orders',
    icon: 'receipt_long',
  },
];

export const InventoryQuickLinks: React.FC<InventoryQuickLinksProps> = ({
  current,
  activeTab,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const effectiveCurrent = current || activeTab;

  const actions: QuickLaunchAction[] = INVENTORY_ANCHORS.map((anchor) => ({
    id: anchor.featureId,
    label: anchor.label,
    icon: anchor.icon,
    active: anchor.key === effectiveCurrent,
    onClick: () => {
      if (onNavigate) {
        onNavigate(anchor.featureId);
      } else {
        navigate(anchor.route);
      }
    },
  }));

  return (
    <nav aria-label="Products and Inventory workspace shortcuts">
      <QuickLaunchPanel
        title="Products & Inventory Shortcuts"
        description="Quickly navigate between Categories, Custom Modifiers, Product Matrix, Purchase Orders, Stock Levels, and Variants."
        actions={actions}
      />
    </nav>
  );
};

export default InventoryQuickLinks;
