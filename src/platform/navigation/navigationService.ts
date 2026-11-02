import { apiRequest } from '@/shared/api/http';
import {
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

export const navigationService = {
  /**
   * Loads the dynamic navigation tree directly from backend API (GET /api/me/navigation).
   * Generates dynamic ModuleNavHub instances and registers them in module-nav-hubs.
   */
  async loadDynamicNavigation(surface: string = 'merchant_web'): Promise<NavCategory[]> {
    try {
      const res = await apiRequest<NavigationTreeResponse>(
        `/me/navigation?surface=${encodeURIComponent(surface)}`,
        { method: 'GET' },
        'Failed to load dynamic navigation',
      );

      if (!res || !Array.isArray(res.categories)) {
        return [];
      }

      const dynamicHubs: ModuleNavHub[] = [];

      const categories: NavCategory[] = res.categories.map((cat) => {
        const apps: NavApplication[] = cat.applications.map((app) => {
          const appCode = app.code || String(app.id);

          // Map features/screens (kind !== 'hub')
          const features: NavFeature[] = (app.items || [])
            .filter((item) => item.kind !== 'hub')
            .map((item) => ({
              id: item.code,
              name: item.label,
              applicationId: appCode,
              planId: res.planId ?? 1,
              isSaaS: surface === 'saas_web',
              icon: item.icon,
              route: item.route || undefined,
              kind: item.kind,
              status: item.status,
              description: item.description || undefined,
              sortOrder: item.sortOrder,
            }));

          // Find or derive primary hub item
          const hubItem = (app.items || []).find((item) => item.kind === 'hub');
          const hubId = hubItem ? hubItem.code : `${appCode}-hub`;
          const hubLabel = `${app.name.toUpperCase()} COMMAND HUB`;

          // Build dynamic ModuleNavHub for this application
          const hubNavItems: ModuleNavItem[] = (app.items || [])
            .filter((item) => item.kind !== 'hub')
            .map((item) => ({
              featureId: item.code,
              label: item.label,
              icon: item.icon,
              description: item.description || item.label,
              live: item.status === 'live',
            }));

          dynamicHubs.push({
            appId: appCode,
            hubId,
            hubLabel,
            title: `${app.name} Command Hub`,
            category: cat.name,
            icon: app.icon || cat.icon || 'space_dashboard',
            description: `Operational command hub and navigation shortcuts for ${app.name}.`,
            items: hubNavItems,
          });

          return {
            id: appCode,
            name: app.name,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            categorySortOrder: cat.sortOrder,
            icon: app.icon || cat.icon,
            sortOrder: app.sortOrder,
            items: app.items,
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
      return [];
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
