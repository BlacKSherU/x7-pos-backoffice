// Pantalla billing-partner-sync (Billing & Transactions → Business Partners Billing Link).
// El header (Historia 21) muestra las métricas B2B y enlaza recibos con socios; el grid
// (Historia 22) agrupa los recibos por cliente / proveedor. Ambos comparten el alcance
// (sucursal o compañía) y se refrescan entre sí cuando cambia un enlace.

import React, { useCallback, useState } from 'react';
import type { PartnerSyncScope } from '@/modules/core/billing-transactions/types/partner-sync';
import { BillingPartnerSyncHeader } from './BillingPartnerSyncHeader';
import { BillingPartnerSyncGrid } from './BillingPartnerSyncGrid';

export interface BillingPartnerSyncViewProps {
  onNavigate?: (view: string) => void;
}

export const BillingPartnerSyncView: React.FC<BillingPartnerSyncViewProps> = () => {
  const [scope, setScope] = useState<{ scope: PartnerSyncScope; merchantId?: number }>({ scope: 'merchant' });
  const [headerRefreshKey, setHeaderRefreshKey] = useState(0);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  const changeScope = useCallback((next: PartnerSyncScope, merchantId?: number) => {
    setScope({ scope: next, merchantId: next === 'company' ? merchantId : undefined });
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-24">
      <BillingPartnerSyncHeader
        scope={scope.scope}
        merchantId={scope.merchantId}
        refreshKey={headerRefreshKey}
        onLinked={() => setGridRefreshKey((k) => k + 1)}
      />
      <BillingPartnerSyncGrid
        scope={scope.scope}
        merchantId={scope.merchantId}
        onScopeChange={changeScope}
        refreshKey={gridRefreshKey}
        onChanged={() => setHeaderRefreshKey((k) => k + 1)}
      />
    </div>
  );
};

export default BillingPartnerSyncView;
