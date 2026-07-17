import type { NavigateFunction } from 'react-router-dom';
import { navigateToDashboardFeature } from './merchant-directory-navigation';

export const COMPANY_PROFILE_QUICK_LAUNCH_TARGETS = {
  systemGlobalConfigs: {
    activeTab: 'company-configurations',
    activeCategory: 'platformsaas',
  },
  masterSuppliersHub: {
    activeTab: 'suppliers',
    activeCategory: 'financehr',
  },
  globalCustomerIndex: {
    activeTab: 'customers',
    activeCategory: 'core',
  },
} as const;

export function navigateFromCompanyProfile(
  navigate: NavigateFunction,
  target: (typeof COMPANY_PROFILE_QUICK_LAUNCH_TARGETS)[keyof typeof COMPANY_PROFILE_QUICK_LAUNCH_TARGETS],
): void {
  navigateToDashboardFeature(navigate, target);
}
