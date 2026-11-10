import { apiRequest } from '@/shared/api/http';
import {
  MODULE_NAV_HUBS,
  registerDynamicNavHubs,
  type ModuleNavHub,
  type ModuleNavItem,
} from '@/platform/navigation/module-nav-hubs';

export interface NavigationItemResponse {
  id: number;
  code: string;
  featureId: number | null;
  label: string;
  icon: string;
  description: string | null;
  route: string | null;
  kind: 'hub' | 'screen';
  status: 'live' | 'in_development';
  sortOrder: number;
}

export interface NavigationApplicationResponse {
  id: number;
  code: string | null;
  name: string;
  icon: string | null;
  sortOrder: number;
  items: NavigationItemResponse[];
}

export interface NavigationCategoryResponse {
  id: number;
  code: string;
  name: string;
  icon: string;
  sortOrder: number;
  applications: NavigationApplicationResponse[];
}

export interface NavigationTreeResponse {
  surface: string;
  planId: number | null;
  role: string;
  shiftRole: string | null;
  categories: NavigationCategoryResponse[];
}

export interface NavFeature {
  id: string;
  name: string;
  applicationId: string;
  planId: number;
  isSaaS: boolean;
  icon?: string;
  route?: string;
  kind?: 'hub' | 'screen';
  status?: 'live' | 'in_development';
  description?: string;
  sortOrder?: number;
}

export interface NavApplication {
  id: string;
  name: string;
  categoryName: string;
  categoryIcon: string;
  categorySortOrder: number;
  icon?: string;
  sortOrder?: number;
  items?: NavigationItemResponse[];
  features: NavFeature[];
}

export interface NavCategory {
  id: string; // Unique lowercase key (e.g., 'saas', 'core', 'finance')
  name: string;
  icon: string;
  sortOrder: number;
  applications: NavApplication[];
}

export const REPRESENTATIVE_NAV_ICONS: Record<string, string> = {
  // Platform SaaS & Merchant Portal
  'saas-dashboard': 'space_dashboard',
  dashboard: 'space_dashboard',
  reports: 'bar_chart',
  'companies-registry': 'domain',
  'company-profile': 'domain',
  'company-configurations': 'tune',
  'merchants-provisioning': 'add_business',
  'global-merchants-directory': 'store',
  'merchant-directory': 'storefront',
  'users-auth-profiles': 'badge',
  'user-management': 'manage_accounts',

  // Food Costing
  'actual-cost-variance': 'trending_down',
  recipes: 'menu_book',
  'recipe-ingredients': 'egg',
  'theoretical-cost': 'calculate',

  // Products
  categories: 'category',
  products: 'inventory_2',
  modifiers: 'tune',
  variants: 'style',

  // Raw Materials
  'raw-material-categories': 'shelves',
  'raw-materials': 'inventory',
  'purchase-orders': 'shopping_cart_checkout',
  'stock-inventory': 'warehouse',
  'stock-movements': 'swap_vert',
  locations: 'place',

  // KDS (Kitchen Display System)
  'kitchen-stations': 'countertops',
  'kitchen-display-devices': 'tablet_android',
  'kitchen-orders': 'receipt_long',
  'kitchen-order-items': 'restaurant_menu',
  'kitchen-event-log': 'history',
  'kitchen-performance': 'speed',

  // Table Turnover
  'table-turnover': 'table_bar',

  // Loyalty System
  'loyalty-customers': 'loyalty',
  'loyalty-coupons': 'confirmation_number',
  'loyalty-point-transactions': 'toll',
  'loyalty-programs': 'card_membership',
  'loyalty-rewards': 'redeem',
  'loyalty-rewards-redemptions': 'savings',
  'loyalty-tiers': 'workspace_premium',

  // Marketing System
  'marketing-automation': 'smart_toy',
  'marketing-automation-action': 'play_arrow',
  'marketing-campaign': 'campaign',
  'marketing-campaign-audience': 'groups',
  'marketing-coupon': 'confirmation_number',
  'marketing-coupon-redemption': 'redeem',
  'marketing-message-log': 'forum',
  'marketing-segment': 'pie_chart',
  'marketing-segment-rule': 'rule',
};

export function resolveNavIcon(code: string, rawIcon?: string | null): string {
  if (rawIcon && rawIcon !== 'circle' && rawIcon !== 'radio_button_unchecked' && rawIcon.trim() !== '') {
    return rawIcon;
  }
  return REPRESENTATIVE_NAV_ICONS[code] || 'widgets';
}

const SHORT_HUB_TITLES: Record<string, string> = {
  'subscription-system': 'Subscription System',
  'billing-transactions': 'Billing & Transactions',
  'table-turnover': 'Table Turnover',
  'kitchen-display-system': 'Kitchen Display System',
  'products-inventory': 'Products & Inventory',
  'accounts-payable': 'Accounts Payable',
  'delivery-management': 'Delivery Management',
  'business-partners': 'Business Partners',
  'financial-engine': 'Financial Engine',
  'online-ordering': 'Online Ordering',
  'qr-code-system': 'QR Code Ordering',
  'marketing-system': 'Marketing System',
  'loyalty-system': 'Loyalty Program',
  'food-costing': 'Food Costing',
  'configuration': 'Configuration',
  'cash-drawers': 'Cash Drawers',
  'dining-system': 'Dining System',
  'reservations': 'Reservations',
  'payrolls': 'Payrolls',
  'shifts': 'Staff Shifts',
  'tips': 'Tips & Gratuities',
  'hr': 'HR & Staff',
  'pos': 'Point of Sale',
  'central-backoffice': 'Platform SaaS Dashboard',
  'client-backoffice': 'Merchant Dashboard',
  'companies': 'Company Administration',
  'saas-companies': 'Global Companies',
  'merchants': 'Merchants & Branches',
  'saas-merchants': 'Global Merchants',
  'users': 'Users Directory',
  'saas-users': 'Global Users',
};

export function resolveShortHubTitle(code: string, rawName: string): string {
  const baseName =
    SHORT_HUB_TITLES[code] ||
    rawName.replace(/\s+(Command\s+Hub|Hub)$/i, '').replace(/\s*\/\s*/g, ' & ');
  return `${baseName} Command Hub`;
}

export function toTitleCaseLabel(text: string): string {
  if (!text) return '';
  if (text === text.toUpperCase() && text.length > 2) {
    return text
      .toLowerCase()
      .split(' ')
      .map((w) => {
        if (['pos', 'kds', 'qr', 'vat', 'sla', 'id', 'emv', 'sms', 'gps', 'eta'].includes(w)) {
          return w.toUpperCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }
  return text;
}

const FALLBACK_APP_NAMES: Record<string, string> = {
  'subscription-system': 'Subscription System',
  'saas-companies': 'Companies',
  companies: 'Companies',
  'saas-merchants': 'Merchants',
  merchants: 'Merchants',
  'saas-users': 'Users',
  users: 'Users',
  hr: 'HR',
  'dining-system': 'Dining System',
  reservations: 'Reservations',
  'accounts-payable': 'Accounts Payable',
  payrolls: 'Payrolls',
  pos: 'POS',
  'cash-drawers': 'Cash Drawers',
  'delivery-management': 'Delivery Management',
  shifts: 'Shifts',
  tips: 'Tips',
  configuration: 'Configuration',
  'billing-transactions': 'Billing & Transactions',
  'financial-engine': 'Financial Engine',
  'business-partners': 'Business Partners',
  'qr-code': 'QR Code System',
  'online-ordering': 'Online Ordering',
  'kitchen-display-system': 'Kitchen Display System',
  'food-costing': 'Food Costing',
  'loyalty-system': 'Loyalty System',
  'marketing-system': 'Marketing System',
  'table-turnover': 'Table Turnover',
};

const FALLBACK_CATEGORY_META: Record<
  string,
  { id: string; name: string; icon: string; sortOrder: number }
> = {
  'Platform SaaS': { id: 'platform-saas', name: 'Platform SaaS', icon: 'grid_view', sortOrder: 1 },
  'Merchant Portal': { id: 'merchant-portal', name: 'Merchant Portal', icon: 'storefront', sortOrder: 1 },
  CORE: { id: 'core', name: 'CORE', icon: 'settings_applications', sortOrder: 2 },
  'Finance & HR': { id: 'finance-hr', name: 'Finance & HR', icon: 'payments', sortOrder: 3 },
  'Inventory & Supplies': { id: 'inventory', name: 'Inventory', icon: 'inventory_2', sortOrder: 4 },
  'Restaurant Operations': { id: 'restaurant-operations', name: 'Restaurant Operations', icon: 'restaurant', sortOrder: 5 },
  Commerce: { id: 'commerce', name: 'Commerce', icon: 'storefront', sortOrder: 6 },
  Growth: { id: 'growth', name: 'Growth', icon: 'trending_up', sortOrder: 7 },
};

function buildFallbackNavigation(surface: string): NavCategory[] {
  const isSaaS = surface === 'saas_web';
  const byCat = new Map<string, NavCategory>();

  for (const hub of MODULE_NAV_HUBS) {
    const isHubSaaS = hub.category === 'Platform SaaS';
    if (isSaaS !== isHubSaaS) continue;

    const meta = FALLBACK_CATEGORY_META[hub.category] ?? {
      id: hub.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: hub.category,
      icon: hub.icon,
      sortOrder: 99,
    };

    let cat = byCat.get(meta.id);
    if (!cat) {
      cat = {
        id: meta.id,
        name: meta.name,
        icon: meta.icon,
        sortOrder: meta.sortOrder,
        applications: [],
      };
      byCat.set(meta.id, cat);
    }

    cat.applications.push({
      id: hub.appId,
      name: FALLBACK_APP_NAMES[hub.appId] || hub.title.replace(/\s+Command\s+Hub$/i, ''),
      categoryName: cat.name,
      categoryIcon: cat.icon,
      categorySortOrder: cat.sortOrder,
      icon: hub.icon,
      sortOrder: cat.applications.length + 1,
      features: hub.items.map((item, idx) => ({
        id: item.featureId,
        name: item.label,
        applicationId: hub.appId,
        planId: 1,
        isSaaS,
        icon: item.icon,
        kind: 'screen',
        status: item.live ? 'live' : 'in_development',
        description: item.description,
        sortOrder: idx + 1,
      })),
    });
  }

  return Array.from(byCat.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const navigationService = {
  /**
   * Loads the dynamic navigation tree directly from backend API (GET /api/me/navigation).
   * Generates dynamic ModuleNavHub instances and registers them in module-nav-hubs.
   */
  async loadDynamicNavigation(
    surface: string = 'merchant_web',
    previewUserId?: number,
  ): Promise<NavCategory[]> {
    try {
      const userParam =
        previewUserId && Number.isInteger(previewUserId) && previewUserId > 0
          ? `&userId=${encodeURIComponent(String(previewUserId))}`
          : '';
      const res = await apiRequest<NavigationTreeResponse>(
        `/me/navigation?surface=${encodeURIComponent(surface)}${userParam}`,
        { method: 'GET' },
        'Failed to load dynamic navigation',
      );

      if (!res || !Array.isArray(res.categories)) {
        return buildFallbackNavigation(surface);
      }

      const dynamicHubs: ModuleNavHub[] = [];

      const categories: NavCategory[] = res.categories.map((cat) => {
        const apps: NavApplication[] = cat.applications.map((app) => {
          const appCode = app.code || String(app.id);

          // Map features/screens (kind !== 'hub')
          // Subscription System sub-modules are exclusively accessed from its Command Hub or persistent bar
          const isSubscriptionSystem = appCode === 'subscription-system';
          const features: NavFeature[] = isSubscriptionSystem
            ? []
            : (app.items || [])
            .filter((item) => item.kind !== 'hub')
            .map((item) => {
              const resolvedIcon = resolveNavIcon(item.code, item.icon);
              return {
                id: item.code,
                name: toTitleCaseLabel(item.label),
                applicationId: appCode,
                planId: res.planId ?? 1,
                isSaaS: surface === 'saas_web',
                icon: resolvedIcon,
                route: item.route || undefined,
                kind: item.kind,
                status: item.status,
                description: item.description || undefined,
                sortOrder: item.sortOrder,
              };
            });

          // Find or derive primary hub item
          const hubItem = (app.items || []).find((item) => item.kind === 'hub');
          const hubId = hubItem ? hubItem.code : `${appCode}-hub`;
          const hubLabel = `${app.name.toUpperCase()} COMMAND HUB`;

          // Build dynamic ModuleNavHub for this application
          const hubNavItems: ModuleNavItem[] = (app.items || [])
            .filter((item) => item.kind !== 'hub')
            .map((item) => {
              const resolvedIcon = resolveNavIcon(item.code, item.icon);
              return {
                featureId: item.code,
                label: toTitleCaseLabel(item.label),
                icon: resolvedIcon,
                description: item.description || item.label,
                live: item.status === 'live',
              };
            });

          dynamicHubs.push({
            appId: appCode,
            hubId,
            hubLabel,
            title: resolveShortHubTitle(appCode, app.name),
            category: cat.name,
            icon: app.icon || cat.icon || 'space_dashboard',
            description: `Operational command hub and navigation shortcuts for ${app.name}.`,
            items: hubNavItems,
          });

          return {
            id: appCode,
            name: toTitleCaseLabel(app.name),
            categoryName: cat.name,
            categoryIcon: cat.icon,
            categorySortOrder: cat.sortOrder,
            icon: app.icon || cat.icon,
            sortOrder: app.sortOrder,
            items: (app.items || []).map((item) => ({
              ...item,
              label: toTitleCaseLabel(item.label),
              icon: resolveNavIcon(item.code, item.icon),
            })),
            features,
          };
        });

        return {
          id: cat.code,
          name: cat.name,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          applications: apps,
        };
      });

      // Register dynamically calculated hubs in runtime registry
      registerDynamicNavHubs(dynamicHubs);

      return categories;
    } catch (error) {
      console.warn('Dynamic navigation loading failed:', error);
      throw error;
    }
  },

  /**
   * @deprecated Legacy flat file loader. Automatically redirects to loadDynamicNavigation.
   */
  async loadAndParseNavigation(..._args: unknown[]): Promise<NavCategory[]> {
    void _args;
    return this.loadDynamicNavigation('merchant_web');
  },
};
