import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../../../../lib/auth-storage';
import { InventoryQuickLinks } from './InventoryQuickLinks';
import {
  StandardDashboardHub,
  type DashboardKPIItem,
  type DashboardModuleItem,
} from '../../../shared/StandardDashboardHub';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

interface ProductsInventoryHubViewProps {
  onNavigate?: (view: string) => void;
}

export const ProductsInventoryHubView: React.FC<ProductsInventoryHubViewProps> = ({
  onNavigate,
}) => {
  const [productsCount, setProductsCount] = useState<number>(0);
  const [categoriesCount, setCategoriesCount] = useState<number>(0);
  const [modifiersCount, setModifiersCount] = useState<number>(0);
  const [purchaseOrdersCount, setPurchaseOrdersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const token = getAccessToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [prodRes, catRes, modRes, poRes] = await Promise.allSettled([
          fetch(`${API_BASE}/products`, { headers }),
          fetch(`${API_BASE}/categories`, { headers }),
          fetch(`${API_BASE}/modifiers`, { headers }),
          fetch(`${API_BASE}/purchase-orders`, { headers }),
        ]);

        if (!isMounted) return;

        if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
          const json = await prodRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setProductsCount(list.length);
        }

        if (catRes.status === 'fulfilled' && catRes.value.ok) {
          const json = await catRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setCategoriesCount(list.length);
        }

        if (modRes.status === 'fulfilled' && modRes.value.ok) {
          const json = await modRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setModifiersCount(list.length);
        }

        if (poRes.status === 'fulfilled' && poRes.value.ok) {
          const json = await poRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setPurchaseOrdersCount(list.length);
        }
      } catch (err) {
        console.warn('Error loading inventory dashboard metrics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  const kpis: DashboardKPIItem[] = [
    {
      title: 'Catalog Products',
      value: productsCount || 0,
      subtitle: 'Active saleable items',
      icon: 'inventory_2',
      variant: 'red',
    },
    {
      title: 'Active Categories',
      value: categoriesCount || 0,
      subtitle: 'Product taxonomy tree',
      icon: 'category',
      variant: 'blue',
    },
    {
      title: 'Custom Modifiers',
      value: modifiersCount || 0,
      subtitle: 'Add-ons & choice groups',
      icon: 'tune',
      variant: 'amber',
    },
    {
      title: 'System Status',
      value: 'OPERATIONAL',
      subtitle: 'Real-time catalog sync',
      icon: 'check_circle',
      variant: 'emerald',
      isOperationalStatus: true,
      statusLabel: 'OPERATIONAL',
    },
  ];

  const modules: DashboardModuleItem[] = [
    {
      id: 'categories',
      title: 'Category Management',
      subtitle: 'Taxonomy & Families',
      description: 'Organize menu and store catalog into structured departments, groups, and categories.',
      icon: 'category',
      badge: `${categoriesCount || 'Active'} Categories`,
      badgeVariant: 'emerald',
      actionText: 'Manage Categories',
    },
    {
      id: 'products',
      title: 'Product Management',
      subtitle: 'Catalog & Retail Matrix',
      description: 'Manage saleable dishes and retail goods, pricing rules, tax rates, and kitchen display routing.',
      icon: 'inventory_2',
      badge: `${productsCount || 'Live'} Products`,
      badgeVariant: 'red',
      actionText: 'Manage Products',
    },
    {
      id: 'variants',
      title: 'Variants Management',
      subtitle: 'Portions, Sizes & Pricing',
      description: 'Define product variations such as sizing, colors, portions, and custom SKUs.',
      icon: 'style',
      badge: 'Variant Matrix',
      badgeVariant: 'zinc',
      actionText: 'Manage Variants',
    },
    {
      id: 'modifiers',
      title: 'Modifiers Management',
      subtitle: 'Options & Customizations',
      description: 'Configure ingredient add-ons, removals, portion choices, and upcharge pricing rules.',
      icon: 'tune',
      badge: `${modifiersCount || 'Configured'} Groups`,
      badgeVariant: 'amber',
      actionText: 'Manage Modifiers',
    },
    {
      id: 'stock-movements',
      title: 'Stock & Stock Movements Management',
      subtitle: 'Live Inventory Balances & Audit Trail',
      description: 'Track real-time inventory balances, stock movements, manual adjustments, waste, and audits.',
      icon: 'swap_vert',
      badge: 'Audit Trail Active',
      badgeVariant: 'purple',
      actionText: 'Manage Stock & Movements',
    },
    {
      id: 'purchase-orders',
      title: 'Purchase Orders Management',
      subtitle: 'Procurement & Inbound Shipments',
      description: 'Create purchase orders, receive supplier shipments, verify bills, and replenish warehouse stock.',
      icon: 'receipt_long',
      badge: `${purchaseOrdersCount || 'Active'} Orders`,
      badgeVariant: 'blue',
      actionText: 'Manage Purchase Orders',
    },
  ];

  return (
    <StandardDashboardHub
      breadcrumb="Inventory / Products & Inventory Ecosystem"
      headerIcon="space_dashboard"
      title="Products & Inventory Command Hub"
      description="Centralized operational hub for catalog taxonomy, dish customization modifiers, product matrix, supplier purchase orders, and stock movements."
      kpis={kpis}
      loadingKpis={loading}
      modules={modules}
      onModuleClick={(id) => onNavigate?.(id)}
    >
      <InventoryQuickLinks onNavigate={onNavigate} />
    </StandardDashboardHub>
  );
};

export default ProductsInventoryHubView;
