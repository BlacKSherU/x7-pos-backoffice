import React from 'react';
import { ModuleCommandHubView } from '@/platform/navigation/ModuleCommandHubView';
import { navHubById, type ModuleNavHub } from '@/platform/navigation/module-nav-hubs';

export interface GenericModuleNavHubProps {
  hub?: ModuleNavHub | null;
  appCode?: string;
  onNavigate: (featureId: string) => void;
}

/**
 * Generic Module Command Hub engine.
 * Renders module navigation cards, KPIs, and workspace links dynamically derived
 * from the backend navigation catalog or registered ModuleNavHub instances.
 */
export const GenericModuleNavHub: React.FC<GenericModuleNavHubProps> = ({
  hub,
  appCode,
  onNavigate,
}) => {
  const resolvedHub =
    hub ??
    (appCode ? navHubById(`${appCode}-hub`) ?? navHubById(appCode) : null);

  if (!resolvedHub) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#e8e2d8] rounded-lg shadow-sm">
        <span className="material-symbols-outlined text-5xl text-[#666666] mb-3">
          dashboard_customize
        </span>
        <h3 className="text-lg font-bold text-[#222222] uppercase tracking-wide">
          Module Hub Not Found
        </h3>
        <p className="text-sm text-[#666666] mt-1 max-w-md">
          The requested module workspace hub could not be resolved from your active subscription plan.
        </p>
      </div>
    );
  }

  return <ModuleCommandHubView hub={resolvedHub} onNavigate={onNavigate} />;
};

export default GenericModuleNavHub;
