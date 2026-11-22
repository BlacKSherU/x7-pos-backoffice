// Pantalla billing-partner-sync (Billing & Transactions → Business Partners Billing Link).
// El header (Historia 21) muestra las métricas B2B y enlaza recibos con socios.

import React from 'react';
import { BillingPartnerSyncHeader } from './BillingPartnerSyncHeader';

export interface BillingPartnerSyncViewProps {
  onNavigate?: (view: string) => void;
}

export const BillingPartnerSyncView: React.FC<BillingPartnerSyncViewProps> = () => (
  <div className="flex flex-col gap-6 animate-fade-in text-left font-poppins pb-24">
    <BillingPartnerSyncHeader scope="merchant" />
  </div>
);

export default BillingPartnerSyncView;
