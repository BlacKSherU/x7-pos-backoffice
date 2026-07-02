import type { NavigateFunction } from 'react-router-dom';

export const BRANCH_CONTEXT_STORAGE_KEY = 'x7:branch-context';

export type DashboardNavigationTarget = {
  activeTab: string;
  activeCategory: string;
  merchantId?: number;
};

export function persistBranchContext(merchantId: number): void {
  sessionStorage.setItem(BRANCH_CONTEXT_STORAGE_KEY, String(merchantId));
}

export function navigateToDashboardFeature(
  navigate: NavigateFunction,
  target: DashboardNavigationTarget,
): void {
  if (target.merchantId != null) {
    persistBranchContext(target.merchantId);
  }

  if (target.activeTab === 'company-profile') {
    navigate('/dashboard/company-profile');
    return;
  }

  if (target.activeTab === 'company-configurations') {
    navigate('/dashboard/company-configurations');
    return;
  }

  navigate('/dashboard', {
    state: {
      activeTab: target.activeTab,
      activeCategory: target.activeCategory,
      ...(target.merchantId != null ? { merchantId: target.merchantId } : {}),
    },
  });
}

export const MERCHANT_QUICK_LAUNCH_TARGETS = {
  companyGlobalSettings: {
    activeTab: 'company-profile',
    activeCategory: 'platformsaas',
  },
  multiStoreDashboard: {
    activeTab: 'dashboard',
    activeCategory: 'core',
  },
  assignStaffRoles: {
    activeTab: 'collaborators',
    activeCategory: 'financehr',
  },
} as const;

export const MERCHANT_BRANCH_ACTION_TARGETS = {
  manageBranchStaff: {
    activeTab: 'collaborators',
    activeCategory: 'financehr',
  },
  manageStoreLocations: {
    activeTab: 'stock-movements',
    activeCategory: 'inventory',
  },
} as const;
