// Header BUSINESS PARTNERS BILLING LINK (Historia 21): métricas B2B de facturación por socio
// y la acción LINK CUSTOMER PROFILE para asignar un recibo a un cliente o proveedor.

import React, { useCallback, useEffect, useState } from 'react';
import { Toast, type ToastState } from '@/shared/components/Toast';
import { fetchPartnerSyncMetrics } from '@/modules/core/billing-transactions/api/partner-sync-api';
import {
  clampPercent,
  formatMoney,
  formatPercent,
  receiptLabel,
} from '@/modules/core/billing-transactions/lib/partner-sync';
import type {
  PartnerSyncMetrics,
  PartnerSyncReceipt,
  PartnerSyncScope,
} from '@/modules/core/billing-transactions/types/partner-sync';
import { LinkPartnerDrawer } from './LinkPartnerDrawer';

export interface BillingPartnerSyncHeaderProps {
  /** Alcance de las métricas: sucursal en sesión o toda la compañía. */
  scope?: PartnerSyncScope;
  /** Sucursal elegida dentro de la compañía (solo con scope=company). */
  merchantId?: number;
  /** Cambia cuando otra parte de la vista modificó enlaces: vuelve a pedir las métricas. */
  refreshKey?: number;
  /** Avisa a la vista que un recibo quedó enlazado (para refrescar el grid). */
  onLinked?: (receipt: PartnerSyncReceipt) => void;
}

interface KpiCardProps {
  testId: string;
  icon: string;
  label: string;
  value: string;
  tag: string;
  tone: 'blue' | 'purple' | 'amber' | 'rose';
  children?: React.ReactNode;
}

const TONES: Record<KpiCardProps['tone'], { box: string; tag: string }> = {
  blue: {
    box: 'bg-blue-50 text-blue-700 border-blue-200',
    tag: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  purple: {
    box: 'bg-purple-50 text-purple-700 border-purple-200',
    tag: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  amber: {
    box: 'bg-amber-50 text-amber-700 border-amber-200',
    tag: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  rose: {
    box: 'bg-rose-50 text-rose-700 border-rose-200',
    tag: 'bg-rose-100 text-rose-800 border-rose-200',
  },
};

const KpiCard: React.FC<KpiCardProps> = ({ testId, icon, label, value, tag, tone, children }) => (
  <div
    data-testid={testId}
    className="bg-white border border-[#e8e2d8] p-3 rounded-xl shadow-xs flex flex-col gap-2 min-w-0 font-poppins"
  >
    <div className="flex items-start justify-between gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${TONES[tone].box}`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider leading-tight">{label}</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#1d1c17] leading-tight truncate">{value}</div>
        </div>
      </div>
      <span
        className={`hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border shrink-0 ${TONES[tone].tag}`}
      >
        {tag}
      </span>
    </div>
    {children && <div className="text-[11px] text-[#5f5e5e] leading-snug min-w-0">{children}</div>}
  </div>
);

export const BillingPartnerSyncHeader: React.FC<BillingPartnerSyncHeaderProps> = ({
  scope = 'merchant',
  merchantId,
  refreshKey = 0,
  onLinked,
}) => {
  const [metrics, setMetrics] = useState<PartnerSyncMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPartnerSyncMetrics({ scope, merchantId: scope === 'company' ? merchantId : undefined })
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error && err.message ? err.message : 'Failed to load partner billing metrics.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, merchantId, refreshKey, reloadTick]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  const handleLinked = (receipt: PartnerSyncReceipt) => {
    setDrawerOpen(false);
    setToast({
      type: 'success',
      message: `Receipt ${receiptLabel(receipt)} linked to ${receipt.partner?.name ?? 'the business partner'}.`,
    });
    reload();
    onLinked?.(receipt);
  };

  const currency = metrics?.currency ?? 'USD';
  const show = (value: string) => (loading && !metrics ? '...' : value);
  const utilization = metrics?.corporate_credit_utilization ?? 0;

  return (
    <section aria-label="Business partners billing link" className="flex flex-col gap-3 font-poppins">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Tarjeta de título + acción principal */}
      <div className="bg-white border border-[#e8e2d8] rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
              partner_exchange
            </span>
            <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase">
              BUSINESS PARTNERS BILLING LINK
            </h2>
            <span
              data-testid="partner-sync-scope"
              className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#f2ede5] text-[#5f5e5e] border border-[#e8e2d8]"
            >
              {scope === 'company' ? 'Company-wide' : 'Branch'}
            </span>
          </div>
          <p className="text-[#5f5e5e] text-body-sm mt-1">
            Monitor B2B invoicing by business partner: corporate accounts, linked customer invoices, credit
            utilization and outstanding balances, and link receipts to customer or supplier profiles.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Refresh metrics"
            aria-label="Refresh metrics"
            className="h-[38px] w-[38px] rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-[#5f5e5e] hover:text-[#ae001a] transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`} aria-hidden="true">
              sync
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-[38px] px-4 rounded-lg bg-[#ae001a] hover:bg-[#d2272f] text-white text-xs font-bold tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add_link
            </span>
            LINK CUSTOMER PROFILE
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs text-[#ba1a1a]"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              error
            </span>
            {error}
          </span>
          <button type="button" onClick={reload} className="font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* KPIs de facturación B2B */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 w-full min-w-0">
        <KpiCard
          testId="kpi-b2b-invoices"
          icon="badge"
          label="Total B2B Invoices"
          value={show(String(metrics?.total_b2b_invoices ?? 0))}
          tag="B2B"
          tone="blue"
        >
          {metrics && (
            <>
              <span className="font-semibold text-[#1d1c17]">{formatMoney(metrics.b2b_invoiced_amount, currency)}</span>{' '}
              invoiced · {metrics.explicitly_linked_invoices} linked to a profile
            </>
          )}
        </KpiCard>

        <KpiCard
          testId="kpi-linked-customers"
          icon="groups"
          label="Linked Customers"
          value={show(String(metrics?.linked_customers ?? 0))}
          tag="Partners"
          tone="purple"
        >
          {metrics && (
            <>
              {metrics.linked_suppliers} suppliers ·{' '}
              <span className="font-semibold text-[#1d1c17]">{metrics.active_corporate_accounts}</span> active
              corporate accounts
            </>
          )}
        </KpiCard>

        <KpiCard
          testId="kpi-credit-utilization"
          icon="credit_score"
          label="Corporate Credit Utilization"
          value={show(formatPercent(utilization))}
          tag="Credit"
          tone="amber"
        >
          {metrics && (
            <div className="flex flex-col gap-1">
              <div
                className="h-1.5 w-full rounded-full bg-[#f2ede5] overflow-hidden"
                role="progressbar"
                aria-label="Corporate credit utilization"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampPercent(utilization)}
              >
                <div className="h-full bg-amber-500" style={{ width: `${clampPercent(utilization)}%` }} />
              </div>
              <span>
                {formatMoney(metrics.outstanding_balance, currency)} on credit of{' '}
                {formatMoney(metrics.billed_amount, currency)} billed
              </span>
            </div>
          )}
        </KpiCard>

        <KpiCard
          testId="kpi-outstanding"
          icon="account_balance_wallet"
          label="Outstanding Balances"
          value={show(formatMoney(metrics?.outstanding_balance ?? 0, currency))}
          tag="Due"
          tone="rose"
        >
          {metrics && <>{metrics.open_credit_orders} open credit orders</>}
        </KpiCard>
      </div>

      {drawerOpen && <LinkPartnerDrawer onClose={() => setDrawerOpen(false)} onLinked={handleLinked} />}
    </section>
  );
};

export default BillingPartnerSyncHeader;
