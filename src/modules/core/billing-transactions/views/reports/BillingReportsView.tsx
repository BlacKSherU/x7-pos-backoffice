import React, { useState } from 'react';
import type { BillingReportKind } from '../../types/billing-reports';
import { TaxLiabilityReport } from './TaxLiabilityReport';
import { DiscountAuditReport } from './DiscountAuditReport';

interface BillingReportsViewProps {
  onNavigate?: (featureId: string) => void;
  initialReport?: BillingReportKind;
}

const TABS: Array<{ id: BillingReportKind; label: string; icon: string; description: string }> = [
  {
    id: 'tax-liability',
    label: 'Tax Liability',
    icon: 'account_balance',
    description: 'Taxes collected grouped by rate and scope, for statutory filing.',
  },
  {
    id: 'discount-audit',
    label: 'Discount & Void Audit',
    icon: 'fact_check',
    description: 'Discounted and voided receipts with the user who processed them.',
  },
];

const RELATED_SCREENS: Array<{ featureId: string; label: string; icon: string }> = [
  { featureId: 'receipt-orders', label: 'Receipts', icon: 'receipt_long' },
  { featureId: 'receipt-taxes', label: 'Receipt Taxes', icon: 'percent' },
];

/**
 * Billing Reports (Historia 8): pestañas Tax Liability y Discount & Void Audit, con filtros por
 * fecha, exportación CSV/Excel y vista imprimible (Print / PDF). La NavHubBar del hub de
 * Billing & Transactions la monta MerchantFrame (module-nav-hubs: `billing-reports`).
 */
export const BillingReportsView: React.FC<BillingReportsViewProps> = ({
  onNavigate,
  initialReport = 'tax-liability',
}) => {
  const [active, setActive] = useState<BillingReportKind>(initialReport);
  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left font-sans font-poppins pb-24">
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl font-normal select-none" aria-hidden="true">
              summarize
            </span>
            <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-sans">
              Billing Reports
            </h2>
          </div>
          <p className="text-[#5f5e5e] text-body-sm font-sans mt-1">
            Generate statutory tax liability summaries and audit cashier discounts and voided receipts. Filter by date
            range, export to CSV or Excel, or print a PDF-ready layout.
          </p>
        </div>
        {onNavigate && (
          <nav className="flex items-center gap-2 shrink-0" aria-label="Related screens">
            {RELATED_SCREENS.map((screen) => (
              <button
                key={screen.featureId}
                type="button"
                onClick={() => onNavigate(screen.featureId)}
                className="h-8 px-3 rounded-lg border border-[#d5cfc4] bg-white text-xs font-bold text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {screen.icon}
                </span>
                {screen.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center h-[40px] bg-[#f2ede5] p-0.5 rounded-lg border border-[#e8e2d8] self-start"
          role="tablist"
          aria-label="Billing reports"
        >
          {TABS.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                id={`billing-report-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`billing-report-panel-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={`h-full px-4 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  selected ? 'bg-white text-[#1d1c17] shadow-xs border border-[#e8e2d8]' : 'text-[#5f5e5e] hover:text-[#ae001a]'
                }`}
              >
                <span className={`material-symbols-outlined text-[17px] ${selected ? 'text-[#ae001a]' : ''}`} aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#76736a]">{activeTab.description}</p>
      </div>

      <div
        role="tabpanel"
        id={`billing-report-panel-${active}`}
        aria-labelledby={`billing-report-tab-${active}`}
      >
        {active === 'tax-liability' ? <TaxLiabilityReport /> : <DiscountAuditReport />}
      </div>
    </div>
  );
};

export default BillingReportsView;
