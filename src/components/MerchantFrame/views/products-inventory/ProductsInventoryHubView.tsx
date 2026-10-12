import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../../../../lib/auth-storage';
import { CatalogQuickLinks } from './CatalogQuickLinks';
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
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0);
  const [categoriesCount, setCategoriesCount] = useState<number>(0);
  const [variantsCount, setVariantsCount] = useState<number>(0);
  const [modifiersCount, setModifiersCount] = useState<number>(0);
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

        const [prodRes, catRes, varRes, modRes] = await Promise.allSettled([
          fetch(`${API_BASE}/products?limit=100`, { headers }),
          fetch(`${API_BASE}/category?limit=100`, { headers }),
          fetch(`${API_BASE}/variants?limit=100`, { headers }),
          fetch(`${API_BASE}/modifiers?limit=100`, { headers }),
        ]);

        if (!isMounted) return;

        if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
          const json = await prodRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setProductsCount(list.length);
          const uncat = list.filter((p: { category?: unknown; categoryId?: unknown }) => !p.category && !p.categoryId).length;
          setUncategorizedCount(uncat);
        }

        if (catRes.status === 'fulfilled' && catRes.value.ok) {
          const json = await catRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setCategoriesCount(list.length);
        }

        if (varRes.status === 'fulfilled' && varRes.value.ok) {
          const json = await varRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setVariantsCount(list.length);
        }

        if (modRes.status === 'fulfilled' && modRes.value.ok) {
          const json = await modRes.value.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setModifiersCount(list.length);
        }
      } catch (err) {
        console.warn('Error loading products dashboard metrics:', err);
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
      value: productsCount,
      subtitle: uncategorizedCount > 0 ? `${uncategorizedCount} need category` : 'Active saleable items',
      icon: 'inventory_2',
      variant: 'red',
      onClick: () => onNavigate?.('products'),
    },
    {
      title: 'Active Categories',
      value: categoriesCount,
      subtitle: 'Menu taxonomy tree',
      icon: 'category',
      variant: 'blue',
      onClick: () => onNavigate?.('categories'),
    },
    {
      title: 'Product Variants',
      value: variantsCount,
      subtitle: 'Portion & sizing matrix',
      icon: 'style',
      variant: 'emerald',
      onClick: () => onNavigate?.('variants'),
    },
    {
      title: 'Custom Modifiers',
      value: modifiersCount,
      subtitle: 'Add-on & choice groups',
      icon: 'tune',
      variant: 'amber',
      onClick: () => onNavigate?.('modifiers'),
    },
  ];

  const modules: DashboardModuleItem[] = [
    {
      id: 'categories',
      title: 'Category Management',
      subtitle: 'Taxonomy & Families',
      description: 'Organize menu and store catalog into structured departments, groups, and categories.',
      icon: 'category',
      badge: `${categoriesCount || 'Live'} Categories`,
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
      badge: `${variantsCount || 'Matrix'} Variations`,
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
  ];

  return (
    <StandardDashboardHub
      breadcrumb="Inventory / Products"
      headerIcon="space_dashboard"
      title="Products Command Hub"
      description="Centralized operational hub for catalog taxonomy, dish customization modifiers, product matrix, and item variations."
      kpis={kpis}
      loadingKpis={loading}
      modules={modules}
      onModuleClick={(id) => onNavigate?.(id)}
    >
      <CatalogQuickLinks current="products" onNavigate={onNavigate} />
    </StandardDashboardHub>
  );
};

export const ProductsHubView = ProductsInventoryHubView;
export default ProductsInventoryHubView;
