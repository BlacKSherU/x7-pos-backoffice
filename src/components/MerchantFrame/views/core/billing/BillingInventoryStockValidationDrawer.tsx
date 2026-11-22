import React, { useState } from 'react';
import { SideDrawer } from '@/shared/components/SideDrawer';
import { validateStockAvailability } from '@/modules/core/billing-transactions/api/inventory-sync-api';
import { AVAILABILITY_STATUS_META } from '@/modules/core/billing-transactions/lib/inventory-sync-status';
import type { BillingInventorySelection } from '@/modules/core/billing-transactions/lib/billing-inventory-context';
import type {
  StockAvailabilityResult,
  StockAvailabilityStatus,
  ValidateStockRequest,
} from '@/modules/core/billing-transactions/types/inventory-sync';

type ValidationMode = 'receipt' | 'skus';

interface SkuDraft {
  id: number;
  sku: string;
  quantity: string;
}

interface BillingInventoryStockValidationDrawerProps {
  /** Línea seleccionada en el grid: precarga su recibo y su SKU. */
  selection?: BillingInventorySelection | null;
  onClose: () => void;
  /** Tras una validación correcta (el contenedor recarga métricas y grid). */
  onValidated?: (result: StockAvailabilityResult) => void;
}

const MAX_SKU_ROWS = 100;

const formatQty = (value: number | null): string => {
  if (value === null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

export const AvailabilityStatusBadge: React.FC<{ status: StockAvailabilityStatus }> = ({ status }) => {
  const meta = AVAILABILITY_STATUS_META[status];
  return (
    <span
      data-testid={`availability-status-${status}`}
      title={meta.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap font-poppins ${meta.badgeClass}`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
};

/**
 * Drawer de "VALIDATE STOCK AVAILABILITY": comprobación previa a facturar del stock que consumiría
 * un recibo (por número de factura) o una lista de SKU y cantidades en la ubicación de ventas.
 */
export const BillingInventoryStockValidationDrawer: React.FC<BillingInventoryStockValidationDrawerProps> = ({
  selection = null,
  onClose,
  onValidated,
}) => {
  const [mode, setMode] = useState<ValidationMode>(selection ? 'receipt' : 'skus');
  const [invoiceNumber, setInvoiceNumber] = useState(selection?.invoiceNumber ?? '');
  const [rows, setRows] = useState<SkuDraft[]>(() => [
    { id: 1, sku: selection?.sku ?? '', quantity: '1' },
  ]);
  const [nextRowId, setNextRowId] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockAvailabilityResult | null>(null);

  const buildRequest = (): ValidateStockRequest | string => {
    if (mode === 'receipt') {
      const invoice = invoiceNumber.trim();
      // El recibo seleccionado se valida por id (no depende de que tenga número de factura).
      if (selection && invoice === (selection.invoiceNumber ?? '').trim()) {
        return { receiptId: selection.receiptId };
      }
      if (!invoice) return 'Enter the invoice number of the receipt to validate.';
      return { invoiceNumber: invoice };
    }
    const items = rows
      .filter((row) => row.sku.trim() !== '')
      .map((row) => ({ sku: row.sku.trim(), quantity: Number(row.quantity) }));
    if (items.length === 0) return 'Add at least one SKU to validate.';
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      return 'Every quantity must be greater than zero.';
    }
    return { items };
  };

  const runValidation = async () => {
    const request = buildRequest();
    if (typeof request === 'string') {
      setError(request);
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      const validated = await validateStockAvailability(request);
      setResult(validated);
      onValidated?.(validated);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Failed to validate the stock availability.');
    } finally {
      setIsRunning(false);
    }
  };

  const updateRow = (id: number, patch: Partial<SkuDraft>) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextRowId, sku: '', quantity: '1' }]);
    setNextRowId((id) => id + 1);
  };

  const inputClass =
    'h-[36px] px-3 text-xs rounded-lg border border-[#d5cfc4] bg-[#fcfcfb] text-[#1d1c17] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 font-poppins';
  const tabClass = (active: boolean) =>
    `flex-1 h-[34px] rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
      active ? 'bg-white text-[#ae001a] shadow-sm' : 'text-[#5f5e5e] hover:text-[#1d1c17]'
    }`;

  return (
    <SideDrawer
      title="Validate Stock Availability"
      subtitle="PRE-BILLING INVENTORY CHECK"
      onClose={onClose}
      closeDisabled={isRunning}
      maxWidth={720}
    >
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-left font-poppins">
        <div role="tablist" aria-label="Validation source" className="flex gap-1 p-1 rounded-lg bg-[#f2ede5]">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'receipt'}
            onClick={() => setMode('receipt')}
            className={tabClass(mode === 'receipt')}
          >
            Receipt
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'skus'}
            onClick={() => setMode('skus')}
            className={tabClass(mode === 'skus')}
          >
            SKU List
          </button>
        </div>

        {mode === 'receipt' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">Invoice number</span>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-000012"
              className={inputClass}
            />
            <span className="text-[11px] text-[#76736a]">
              {selection
                ? `Prefilled with the selected line (receipt #${selection.receiptId}).`
                : 'Select a line in the grid to prefill its receipt.'}
            </span>
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e]">Items to sell</span>
            {rows.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.sku}
                  onChange={(e) => updateRow(row.id, { sku: e.target.value })}
                  placeholder="SKU"
                  aria-label={`SKU ${index + 1}`}
                  className={`${inputClass} flex-1 font-mono`}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                  aria-label={`Quantity ${index + 1}`}
                  className={`${inputClass} w-[90px] text-right`}
                />
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  disabled={rows.length === 1}
                  aria-label={`Remove SKU ${index + 1}`}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-lg border border-[#e8e2d8] text-[#5f5e5e] hover:text-[#ae001a] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= MAX_SKU_ROWS}
              className="self-start flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-[#d5cfc4] text-[11px] font-bold uppercase tracking-wider text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
              Add SKU
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => void runValidation()}
          disabled={isRunning}
          className="h-[40px] rounded-lg bg-[#ae001a] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#8e0015] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[18px] ${isRunning ? 'animate-spin' : ''}`} aria-hidden="true">
            {isRunning ? 'progress_activity' : 'fact_check'}
          </span>
          {isRunning ? 'Validating...' : 'Run Validation'}
        </button>

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {result && (
          <section aria-label="Stock availability result" className="flex flex-col gap-3">
            <div
              data-testid="stock-validation-summary"
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                result.allAvailable ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-[#fff1f2] border-[#f5c2c7] text-[#8e0015]'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                {result.allAvailable ? 'verified' : 'report'}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">
                  {result.allAvailable ? 'Stock available for every line' : 'Stock check failed'}
                </span>
                <span className="text-[11px]">
                  {result.location ? `Location: ${result.location.name}` : 'No stock location configured'}
                  {result.invoiceNumber ? ` · Invoice ${result.invoiceNumber}` : ''}
                  {` · ${result.summary.lines} line(s): ${result.summary.available} available, ${result.summary.lowStockAfterSale} low after sale, ${result.summary.insufficientStock} insufficient, ${result.summary.notTracked} not tracked`}
                  {result.summary.alreadyDeducted > 0 ? `, ${result.summary.alreadyDeducted} already deducted` : ''}
                </span>
              </div>
            </div>

            {result.items.length === 0 ? (
              <p className="text-xs text-[#76736a]">The receipt has no active lines.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {result.items.map((line, index) => (
                  <li
                    key={line.receiptItemId ?? `sku-${index}`}
                    data-testid={`stock-validation-line-${index}`}
                    className="border border-[#e8e2d8] rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1d1c17] truncate">{line.itemName}</div>
                        <div className="text-[10px] text-[#76736a] font-mono">
                          {line.sku ?? 'No SKU'} · qty {formatQty(line.quantity)}
                        </div>
                      </div>
                      <AvailabilityStatusBadge status={line.status} />
                    </div>
                    <p className="text-[11px] text-[#5f5e5e] mt-1.5">{line.reason}</p>
                    {line.components.length > 0 && (
                      <table className="w-full text-[11px] mt-2">
                        <thead>
                          <tr className="text-[9.5px] uppercase tracking-wider text-[#76736a]">
                            <th scope="col" className="py-1 pr-2 text-left">Component</th>
                            <th scope="col" className="py-1 pr-2 text-right">Needed</th>
                            <th scope="col" className="py-1 pr-2 text-right">On hand</th>
                            <th scope="col" className="py-1 pr-2 text-right">After sale</th>
                            <th scope="col" className="py-1 text-right">Minimum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.components.map((c) => (
                            <tr
                              key={c.key}
                              className={
                                c.status === 'INSUFFICIENT_STOCK'
                                  ? 'text-[#ae001a] font-semibold'
                                  : c.status === 'LOW_STOCK_AFTER_SALE'
                                    ? 'text-amber-800'
                                    : 'text-[#1d1c17]'
                              }
                            >
                              <td className="py-1 pr-2">{c.name}</td>
                              <td className="py-1 pr-2 text-right font-mono">
                                {formatQty(c.requiredQty)}
                                {c.totalDemand !== c.requiredQty && (
                                  <span className="text-[#76736a]"> ({formatQty(c.totalDemand)} total)</span>
                                )}
                              </td>
                              <td className="py-1 pr-2 text-right font-mono">{formatQty(c.availableQty)}</td>
                              <td className="py-1 pr-2 text-right font-mono">{formatQty(c.remainingAfterSale)}</td>
                              <td className="py-1 text-right font-mono">{formatQty(c.minimumQty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </SideDrawer>
  );
};

export default BillingInventoryStockValidationDrawer;
