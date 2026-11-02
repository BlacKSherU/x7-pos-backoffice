import React from 'react';
import { QuickLaunchPanel, type QuickLaunchAction } from '../../shared/QuickLaunchPanel';

export type BusinessPartnersAnchorKey = 'customers' | 'suppliers';

interface BusinessPartnersQuickLinksProps {
  active: BusinessPartnersAnchorKey;
  onNavigate?: (view: string) => void;
}

const BUSINESS_PARTNERS_ANCHORS: Array<{
  key: BusinessPartnersAnchorKey;
  label: string;
  featureId: string;
  icon: string;
}> = [
  { key: 'customers', label: 'CUSTOMERS', featureId: 'customers', icon: 'person' },
  { key: 'suppliers', label: 'SUPPLIERS', featureId: 'suppliers', icon: 'local_shipping' },
];

export const BusinessPartnersQuickLinks: React.FC<BusinessPartnersQuickLinksProps> = ({
  active,
  onNavigate,
}) => {
  const actions: QuickLaunchAction[] = BUSINESS_PARTNERS_ANCHORS.map((anchor) => ({
    id: anchor.featureId,
    label: anchor.label,
    icon: anchor.icon,
    active: anchor.key === active,
    onClick: () => onNavigate?.(anchor.featureId),
  }));

  return (
    <nav aria-label="Business partners workspace shortcuts">
      <QuickLaunchPanel
        title="Business Partners Command Hub"
        description="Pivot across customer profiles, client identity data, and supplier directories."
        actions={actions}
      />
    </nav>
  );
};

export default BusinessPartnersQuickLinks;
