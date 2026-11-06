import React, { useEffect, useState } from 'react';
import { CatalogQuickLinks } from '@/modules/inventory/products-inventory/views/CatalogQuickLinks';
import {
  StandardDashboardHub,
  type DashboardKPIItem,
  type DashboardModuleItem,
} from '@/shared/components/StandardDashboardHub';
import { apiRequest, unwrapList, type MaybeEnvelopedList } from '@/shared/api/http';

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
        // Each KPI is independent: a failing endpoint leaves its card at zero instead of blanking the hub.
        const optionalList = <T,>(path: string) =>
          apiRequest<MaybeEnvelopedList<T>>(path, { method: 'GET' }, '')
            .then((json) => unwrapList(json))
            .catch(() => null);

        const [products, categories, variants, modifiers] = await Promise.all([
          optionalList<{ category?: unknown; categoryId?: unknown }>('/products?limit=100'),
          optionalList<unknown>('/category?limit=100'),
          optionalList<unknown>('/variants?limit=100'),
          optionalList<unknown>('/modifiers?limit=100'),
        ]);

        if (!isMounted) return;

        if (products) {
          setProductsCount(products.length);
          setUncategorizedCount(products.filter((p) => !p.category && !p.categoryId).length);
        }
        if (categories) setCategoriesCount(categories.length);
        if (variants) setVariantsCount(variants.length);
        if (modifiers) setModifiersCount(modifiers.length);
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
    },
    {
      title: 'Active Categories',
      value: categoriesCount,
      subtitle: 'Menu taxonomy tree',
      icon: 'category',
      variant: 'blue',
    },
    {
      title: 'Product Variants',
      value: variantsCount,
      subtitle: 'Portion & sizing matrix',
      icon: 'style',
      variant: 'emerald',
    },
    {
      title: 'Custom Modifiers',
      value: modifiersCount,
      subtitle: 'Add-on & choice groups',
      icon: 'tune',
      variant: 'amber',
    },
  ];

  const modules: DashboardModuleItem[] = [
    {
      id: 'categories',
      title: 'Product Categories Hierarchy',
      subtitle: 'Taxonomy & Category Families',
      description: 'Organize menu items and retail products into structured departments, parent groups, and sub-categories.',
      icon: 'category',
      badge: `${categoriesCount || 'Live'} Categories`,
      badgeVariant: 'emerald',
      actionText: 'Manage Categories',
    },
    {
      id: 'products',
      title: 'Finished Products Catalog',
      subtitle: 'Saleable Goods & POS Matrix',
      description: 'Manage saleable dishes and retail goods, pricing rules, tax rates, and kitchen display routing.',
      icon: 'inventory_2',
      badge: `${productsCount || 'Live'} Products`,
      badgeVariant: 'blue',
      actionText: 'Manage Products',
    },
    {
      id: 'variants',
      title: 'Product Variants & Sizing',
      subtitle: 'Portions, Sizes & Pricing Matrix',
      description: 'Define product variations such as sizing, portions, combo choices, and SKU-level price overrides.',
      icon: 'style',
      badge: `${variantsCount || 'Matrix'} Variations`,
      badgeVariant: 'zinc',
      actionText: 'Manage Variants',
    },
    {
      id: 'modifiers',
      title: 'Custom Modifiers & Add-ons',
      subtitle: 'Options, Toppings & Choices',
      description: 'Configure ingredient add-ons, removals, portion choices, customer requests, and upcharge pricing rules.',
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
