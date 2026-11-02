import React from 'react';
import { MetricsGrid } from '@/modules/platform-saas/central-backoffice/views/dashboard/MetricsGrid';
import { ARRChart } from '@/modules/platform-saas/central-backoffice/views/dashboard/ARRChart';
import { RecentMerchants } from '@/modules/platform-saas/central-backoffice/views/dashboard/RecentMerchants';
import { PlatformHealth } from '@/modules/platform-saas/central-backoffice/views/dashboard/PlatformHealth';

interface SaasOverviewContentProps {
  refreshTrigger: number;
  onNavigateToView: (view: string) => void;
}

export const SaasOverviewContent: React.FC<SaasOverviewContentProps> = ({
  refreshTrigger,
  onNavigateToView,
}) => {
  return (
    <div className="space-y-6">
      {/* Bento Grid Metrics */}
      <MetricsGrid refreshTrigger={refreshTrigger} />

      {/* Revenue and Recently Joined Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth (ARR) */}
        <ARRChart />

        {/* Recently Joined Merchants */}
        <RecentMerchants
          onNavigateToView={onNavigateToView}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Platform Health Section */}
      <PlatformHealth refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default SaasOverviewContent;
