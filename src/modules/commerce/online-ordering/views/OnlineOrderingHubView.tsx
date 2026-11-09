import React, { useEffect, useState } from 'react';
import {
  StandardDashboardHub,
  type DashboardKPIItem,
  type DashboardModuleItem,
} from '@/shared/components/StandardDashboardHub';
import { apiRequest, unwrapList, type MaybeEnvelopedList } from '@/shared/api/http';

interface OnlineStoreApiItem {
  id: string;
  is_active?: boolean;
  status?: string;
  currency?: string;
}

interface OnlineOrderingHubViewProps {
  onNavigate?: (view: string) => void;
}

export const OnlineOrderingHubView: React.FC<OnlineOrderingHubViewProps> = ({
  onNavigate,
}) => {
  const [storesCount, setStoresCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [maintenanceCount, setMaintenanceCount] = useState<number>(0);
  const [currenciesCount, setCurrenciesCount] = useState<number>(0);
  const [menusCount, setMenusCount] = useState<number>(0);
  const [publishedMenusCount, setPublishedMenusCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        // Each KPI group is independent: one failing request must not blank the other.
        const [storesJson, menusJson] = await Promise.all([
          apiRequest<MaybeEnvelopedList<OnlineStoreApiItem>>('/online-stores?limit=100', { method: 'GET' }, '').catch(() => null),
          apiRequest<MaybeEnvelopedList<Record<string, unknown>>>('/online-menus?limit=100', { method: 'GET' }, '').catch(() => null),
        ]);

        if (!isMounted) return;

        if (storesJson) {
          const list = unwrapList(storesJson);
          setStoresCount(list.length);

          const published = list.filter(
            (s) => Boolean(s.is_active) && (s.status?.toLowerCase() === 'active' || s.status?.toLowerCase() === 'published')
          ).length;
          setPublishedCount(published);

          const maintenance = list.filter(
            (s) => !s.is_active || s.status?.toLowerCase() === 'maintenance'
          ).length;
          setMaintenanceCount(maintenance);

          const distinctCurrencies = new Set(
            list.map((s) => s.currency?.trim().toUpperCase()).filter(Boolean)
          );
          setCurrenciesCount(distinctCurrencies.size || 1);
        }

        if (menusJson) {
          const listMenus = unwrapList(menusJson);
          setMenusCount(listMenus.length);
          const activeMenus = listMenus.filter((m) =>
            m.isActive !== undefined ? Boolean(m.isActive) : Boolean(m.is_active)
          ).length;
          setPublishedMenusCount(activeMenus);
        }
      } catch (err) {
        console.warn('Error loading online ordering hub metrics:', err);
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
      title: 'Online Stores',
      value: storesCount,
      subtitle: 'Provisioned storefronts',
      icon: 'storefront',
      variant: 'red',
    },
    {
      title: 'Published Stores',
      value: publishedCount,
      subtitle: maintenanceCount > 0 ? `${maintenanceCount} in maintenance` : 'Live storefront channels',
      icon: 'check_circle',
      variant: 'emerald',
    },
    {
      title: 'Supported Currencies',
      value: currenciesCount || 1,
      subtitle: 'Active checkout currencies',
      icon: 'payments',
      variant: 'blue',
    },
    {
      title: 'Delivery Logistics',
      value: 'Operational',
      isOperationalStatus: true,
      statusLabel: 'READY',
      subtitle: 'Dispatch & coverage zones',
      icon: 'local_shipping',
      variant: 'amber',
    },
  ];

  const modules: DashboardModuleItem[] = [
    {
      id: 'online-stores',
      title: 'Online Stores Workspace',
      subtitle: 'WEB PORTALS & BRANDING',
      description: 'Manage multi-storefront digital channels, subdomains, color themes, currencies, and operational statuses.',
      icon: 'storefront',
      badge: `${publishedCount} Published / ${storesCount} Total`,
      badgeVariant: 'emerald',
      actionText: 'Manage Stores',
    },
    {
      id: 'online-payments',
      title: 'Digital Payments Gateway',
      subtitle: 'CHECKOUT & CARD PROCESSORS',
      description: 'Configure online payment gateways, Stripe, card acquiring providers, and digital checkout tender rules.',
      icon: 'payments',
      badge: 'In Development',
      badgeVariant: 'amber',
      actionText: 'Preview Workspace',
    },
    {
      id: 'online-menus',
      title: 'Online Menus Management',
      subtitle: 'DIGITAL CATALOGS & AVAILABILITY',
      description: 'Create and publish specialized digital menus, meal schedules, seasonal offerings, and channel-specific menus.',
      icon: 'restaurant_menu',
      badge: menusCount > 0 ? `${publishedMenusCount} Published / ${menusCount} Total` : 'Active Menus',
      badgeVariant: 'purple',
      actionText: 'Manage Menus',
    },
    {
      id: 'online-menu-categories',
      title: 'Menu Categories Taxonomy',
      subtitle: 'TAXONOMY & STOREFRONT NAVIGATION',
      description: 'Structure digital menu sections, item families, display sorting order, and customer-facing browse categories.',
      icon: 'category',
      badge: 'Categories Live',
      badgeVariant: 'emerald',
      actionText: 'Manage Categories',
    },
    {
      id: 'online-menu-items',
      title: 'Online Menu Items Catalog',
      subtitle: 'DISHES, PRICING & MODIFIERS',
      description: 'Synchronize saleable catalog dishes with online storefronts, including digital photos, tags, and modifier sets.',
      icon: 'lunch_dining',
      badge: 'Dishes Published',
      badgeVariant: 'blue',
      actionText: 'Manage Menu Items',
    },
    {
      id: 'online-orders',
      title: 'Online Orders Dispatch',
      subtitle: 'INCOMING ORDERS & FULFILLMENT',
      description: 'Track live incoming web and delivery orders, customer details, acceptance workflows, and fulfillment dispatch.',
      icon: 'shopping_bag',
      badge: 'Live Dispatch Active',
      badgeVariant: 'amber',
      actionText: 'Dispatch Orders',
    },
    {
      id: 'online-order-items',
      title: 'Itemized Order Details',
      subtitle: 'ITEMIZED CARTS & MODIFIERS',
      description: 'Detailed breakdown of customer shopping carts, special cooking instructions, modifier choices, and price lines.',
      icon: 'receipt_long',
      badge: 'In Development',
      badgeVariant: 'amber',
      actionText: 'Preview Workspace',
    },
    {
      id: 'online-delivery-info',
      title: 'Delivery Logistics & Coverage',
      subtitle: 'ZONES, COURIERS & COVERAGE',
      description: 'Configure delivery radiuses, polygon coverage zones, distance-based courier fees, minimum orders, and dispatch times.',
      icon: 'local_shipping',
      badge: 'In Development',
      badgeVariant: 'amber',
      actionText: 'Preview Workspace',
    },
  ];

  return (
    <StandardDashboardHub
      breadcrumb="Commerce / Online Ordering Suite"
      headerIcon="storefront"
      title="Online Ordering Command Hub"
      description="Centralized operational hub for digital storefronts, multi-tenant web portals, menu catalogs, digital payments, live dispatch orders, and delivery logistics."
      primaryAction={{
        label: 'LAUNCH STORE WORKSPACE',
        icon: 'storefront',
        onClick: () => onNavigate?.('online-stores'),
      }}
      secondaryAction={{
        label: 'DELIVERY SETUP',
        icon: 'local_shipping',
        onClick: () => onNavigate?.('online-delivery-info'),
      }}
      kpis={kpis}
      loadingKpis={loading}
      modules={modules}
      onModuleClick={(id) => onNavigate?.(id)}
    />
  );
};

export default OnlineOrderingHubView;
