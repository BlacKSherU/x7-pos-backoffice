import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInventorySyncMetrics } from '@/modules/core/billing-transactions/api/inventory-sync-api';
import { DEDUCTION_STATUS_META } from '@/modules/core/billing-transactions/lib/inventory-sync-status';
import type { BillingInventorySelection } from '@/modules/core/billing-transactions/lib/billing-inventory-context';
import {
  INVENTORY_DEDUCTION_STATUSES,
  type InventorySyncMetrics,
  type StockAvailabilityResult,
} from '@/modules/core/billing-transactions/types/inventory-sync';
import { BillingInventoryStockValidationDrawer } from './BillingInventoryStockValidationDrawer';

/** Cada cuánto se refrescan las métricas mientras la pestaña está visible. */
export const METRICS_REFRESH_MS = 30_000;

interface BillingInventorySyncHeaderProps {
  /** Línea seleccionada en el grid: el drawer de validación precarga su recibo. */
  selection?: BillingInventorySelection | null;
  /** Cambiarlo recarga las métricas al momento. */
  refreshKey?: number;
  /** Tras validar stock (el contenedor recarga el grid). */
  onValidated?: (result: StockAvailabilityResult) => void;
  refreshIntervalMs?: number;
}

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDay = (day: string): string => {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
};

interface KpiCardProps {
  icon: string;
  label: string;
  testId: string;
  value: React.ReactNode;
  tone?: 'default' | 'alert';
  children?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, testId, value, tone = 'default', children }) => (
  <div
    data-testid={testId}
    className={`flex-1 min-w-[220px] rounded-xl border p-4 flex flex-col gap-2 ${
      tone === 'alert' ? 'border-[#f5c2c7] bg-[#fff8f8]' : 'border-[#e8e2d8] bg-[#fcfaf6]'
    }`}
  >
    <div className="flex items-center gap-2">
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          tone === 'alert' ? 'bg-[#ae001a] text-white' : 'bg-[#f2ede5] text-[#ae001a]'
        }`}
      >
        <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">{label}</span>
    </div>
    <div className="text-2xl font-bold text-[#1d1c17] font-poppins" data-testid={`${testId}-value`}>
      {value}
    </div>
    {children}
  </div>
);

/**
 * Header secundario de la pantalla billing-inventory-sync: título, KPIs en vivo (líneas deducidas,
 * estado de los movimientos de stock y alertas de stock bajo disparadas por ventas recientes) y la
 * acción [ VALIDATE STOCK AVAILABILITY ]. Las métricas se refrescan solas cada 30 s, al volver a
 * la pestaña, al cambiar `refreshKey` y después de cada validación.
 */
export const BillingInventorySyncHeader: React.FC<BillingInventorySyncHeaderProps> = ({
  selection = null,
  refreshKey = 0,
  onValidated,
  refreshIntervalMs = METRICS_REFRESH_MS,
}) => {
  const [metrics, setMetrics] = useState<InventorySyncMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    try {
      const next = await fetchInventorySyncMetrics();
      if (current !== requestId.current) return;
      setMetrics(next);
      setError(null);
    } catch (err) {
      if (current !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load the inventory sync metrics.');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, refreshKey, reloadTick]);

  useEffect(() => {
    if (refreshIntervalMs <= 0) return undefined;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setReloadTick((t) => t + 1);
    }, refreshIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setReloadTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshIntervalMs]);

  const handleValidated = (result: StockAvailabilityResult) => {
    setReloadTick((t) => t + 1);
    onValidated?.(result);
  };

  const placeholder = isLoading && !metrics ? '…' : '—';
  const lowStock = metrics?.lowStock;

  return (
    <section
      aria-label="Inventory and billing stock sync"
      className="bg-white border border-[#e8e2d8] rounded-xl p-6 shadow-sm flex flex-col gap-5 font-poppins text-left"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#ae001a] text-2xl select-none" aria-hidden="true">
              inventory_2
            </span>
            <h2 className="text-[#ae001a] font-bold text-heading-lg tracking-wider uppercase font-poppins">
              INVENTORY &amp; BILLING STOCK SYNC
            </h2>
          </div>
          <p className="text-[#5f5e5e] text-body-sm mt-1 font-poppins">
            Real-time stock deductions and low stock alerts triggered by billing. Validate stock before billing and jump
            to inventory without losing your billing context.
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-[#76736a]" aria-live="polite">
            <span
              className={`w-2 h-2 rounded-full ${error ? 'bg-amber-500' : 'bg-emerald-500'} ${isLoading ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            <span data-testid="inventory-sync-metrics-updated">
              {metrics
                ? `Live · ${formatDay(metrics.dateFrom)} – ${formatDay(metrics.dateTo)} · updated ${formatTime(metrics.generatedAt)}`
                : isLoading
                  ? 'Loading live metrics...'
                  : 'Metrics unavailable'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            aria-label="Refresh metrics"
            title="Refresh metrics"
            className="h-[40px] w-[40px] flex items-center justify-center rounded-lg border border-[#d5cfc4] bg-white text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[19px] ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
              refresh
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="h-[40px] px-4 rounded-lg bg-[#ae001a] text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#8e0015] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              fact_check
            </span>
            VALIDATE STOCK AVAILABILITY
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">sync_problem</span>
            {metrics ? `Showing the last known metrics. ${error}` : error}
          </span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="px-3 py-1 rounded border border-amber-400 bg-white font-bold uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <KpiCard
          icon="inventory_2"
          label="Items Deducted"
          testId="kpi-items-deducted"
          value={metrics ? formatNumber(metrics.itemsDeducted) : placeholder}
        >
          <span className="text-[11px] text-[#5f5e5e]">
            {metrics
              ? `${formatNumber(metrics.unitsDeducted)} units sold · ${formatNumber(metrics.linesEvaluated)} receipt lines checked${
                  metrics.scanLimitReached ? ' (latest 2000)' : ''
                }`
              : 'Receipt lines whose stock was deducted'}
          </span>
        </KpiCard>

        <KpiCard
          icon="warehouse"
          label="Stock Movement Status"
          testId="kpi-movement-status"
          tone={metrics && metrics.statusCounts.FAILED + metrics.statusCounts.INSUFFICIENT_STOCK > 0 ? 'alert' : 'default'}
          value={
            metrics
              ? `${formatNumber(metrics.statusCounts.FAILED + metrics.statusCounts.INSUFFICIENT_STOCK)} issues`
              : placeholder
          }
        >
          <ul className="flex flex-wrap gap-1.5" aria-label="Receipt lines per deduction status">
            {INVENTORY_DEDUCTION_STATUSES.map((status) => {
              const meta = DEDUCTION_STATUS_META[status];
              return (
                <li
                  key={status}
                  data-testid={`kpi-status-${status}`}
                  title={meta.description}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}
                >
                  {meta.label}
                  <span className="font-mono">{metrics ? metrics.statusCounts[status] : '–'}</span>
                </li>
              );
            })}
          </ul>
          <span className="text-[11px] text-[#5f5e5e]">
            {metrics?.salesLocation
              ? `Sales deduct from ${metrics.salesLocation.name}`
              : metrics
                ? 'No sales stock location configured'
                : ''}
          </span>
        </KpiCard>

        <KpiCard
          icon="trending_down"
          label="Low Stock Warnings"
          testId="kpi-low-stock"
          tone={lowStock && lowStock.total > 0 ? 'alert' : 'default'}
          value={lowStock ? formatNumber(lowStock.total) : placeholder}
        >
          <span className="text-[11px] text-[#5f5e5e]">
            {lowStock
              ? `${lowStock.outOfStock} out of stock · ${lowStock.low} low · ${lowStock.activeAlerts} active alerts`
              : 'Items under minimum after recent sales'}
          </span>
          {lowStock && lowStock.warnings.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Most critical low stock items">
              {lowStock.warnings.slice(0, 3).map((w) => (
                <li key={w.stockItemId} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-[#1d1c17]" title={w.locationName ?? undefined}>
                    {w.name}
                  </span>
                  <span
                    className={`shrink-0 font-mono font-bold ${w.level === 'OUT_OF_STOCK' ? 'text-[#ae001a]' : 'text-amber-700'}`}
                  >
                    {formatNumber(w.currentQty)}
                    {w.minimumQty != null ? ` / ${formatNumber(w.minimumQty)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </KpiCard>
      </div>

      {isDrawerOpen && (
        <BillingInventoryStockValidationDrawer
          selection={selection}
          onClose={() => setIsDrawerOpen(false)}
          onValidated={handleValidated}
        />
      )}
    </section>
  );
};

export default BillingInventorySyncHeader;
