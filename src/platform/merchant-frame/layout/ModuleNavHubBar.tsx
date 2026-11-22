// Persistent module bar: standard NavHubBar populated by module-nav-hubs.ts.
// Mounted by MerchantFrame once for the active featureId, covering the view, error
// states, and "In Development" stubs for options without a dedicated view yet.

import React from 'react';
import { NavHubBar } from '@/shared/components/NavHubBar';
import type { ModuleNavHub } from '@/platform/navigation/module-nav-hubs';

interface ModuleNavHubBarProps {
  hub: ModuleNavHub;
  currentFeatureId: string;
  onNavigate: (featureId: string) => void;
}

export const ModuleNavHubBar: React.FC<ModuleNavHubBarProps> = ({
  hub,
  currentFeatureId,
  onNavigate,
}) => {
  if (!hub || !hub.title) return null;

  const hubItems = hub.items || [];
  // Hubs de otras aplicaciones que enlaza la opción activa (p. ej. inventario desde facturación).
  const crossLinks =
    hubItems.find((item) => item.featureId === currentFeatureId)?.crossLinks ?? [];

  return (
    <nav aria-label={`${hub.title.replace(/ Command Hub$/, '')} module navigation`}>
      <NavHubBar
        title={hub.title}
        titleIcon="space_dashboard"
        onBackToDashboard={() => onNavigate(hub.hubId)}
        backToDashboardLabel={hub.hubLabel}
        items={[
          ...hubItems.map((item) => ({
            id: item.featureId,
            label: item.label,
            icon: item.icon,
            active: item.featureId === currentFeatureId,
            onClick: () => onNavigate(item.featureId),
          })),
          ...crossLinks.map((link) => ({
            id: link.featureId,
            label: link.label,
            icon: link.icon,
            keepLabel: true,
            onClick: () => onNavigate(link.featureId),
          })),
        ]}
      />
    </nav>
  );
};

export default ModuleNavHubBar;
