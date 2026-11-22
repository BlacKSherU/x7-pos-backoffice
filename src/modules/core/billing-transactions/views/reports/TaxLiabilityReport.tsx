import React, { useCallback, useEffect, useState } from 'react';
import { fetchTaxLiabilityReport } from '../../api/billing-reports-api';
import {
  describeDateRange,
  formatDateTime,
  formatMoney,
  formatRate,
  periodRange,
} from '../../lib/billing-reports';
import type {
  ReceiptTaxScope,
  TaxLiabilityFilters,
  TaxLiabilityReport as TaxLiabilityReportData,
} from '../../types/billing-reports';
import {
  REPORT_FIELD_CLASS,
  ReportErrorBanner,
  ReportExportActions,
  ReportFieldLabel,
  ReportFilterButtons,
  ReportKpiCard,
  ReportPeriodFields,
} from './ReportControls';
import { ReportPrintPreview } from './ReportPrintPreview';
import { exportBillingReport, type ReportExportFormat } from './report-export';

interface TaxFilterDraft {
  from: string;
  to: string;
  rate: string;
  scope: ReceiptTaxScope | '';
  name: string;
  currency: string;
}

function defaultDraft(): TaxFilterDraft {
  return { ...periodRange('this-month'), rate: '', scope: '', name: '', currency: '' };
}

function toFilters(draft: TaxFilterDraft): TaxLiabilityFilters {
  const rate = draft.rate.trim() === '' ? null : Number(draft.rate);
  return {
    from: draft.from || undefined,
    to: draft.to || undefined,
    rate: rate !== null && Number.isFinite(rate) ? rate : null,
    scope: draft.scope,
    name: draft.name.trim() || undefined,
    currency: draft.currency.trim().toUpperCase() || undefined,
  };
}

const SCOPE_LABEL: Record<ReceiptTaxScope, string> = {
  RECEIPT: 'Receipt',
  ITEM: 'Line item',
};

const ScopeBadge: React.FC<{ scope: ReceiptTaxScope }> = ({ scope }) => (
  <span
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
      scope === 'RECEIPT'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : 'bg-purple-50 text-purple-800 border-purple-200'
    }`}
  >
    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
      {scope === 'RECEIPT' ? 'receipt_long' : 'list'}
    </span>
    {SCOPE_LABEL[scope]}
  </span>
);

/** Tabla del reporte: grupos (tasa × scope × nombre) y, por moneda, subtotales por scope y TOTAL. */
const TaxLiabilityTable: React.FC<{ report: TaxLiabilityReportData; printable?: boolean }> = ({
  report,
  printable = false,
}) => {
  const cell = printable ? 'px-2 py-1.5 text-[10.5px]' : 'px-4 py-2.5 text-xs';
  const head = printable
    ? 'px-2 py-1.5 text-[9.5px] bg-[#f2ede5] text-[#1d1c17]'
    : 'px-4 py-2.5 text-[10px] bg-[#f7f4ef] text-[#5f5e5e]';

  return (
    <table className="w-full border-collapse font-sans font-poppins" aria-label="Tax liability by rate and scope">
      <thead>
        <tr className="text-left uppercase tracking-wider font-bold">
          <th scope="col" className={head}>Tax name / type</th>
          <th scope="col" className={head}>Scope</th>
          <th scope="col" className={`${head} text-right`}>Rate</th>
          <th scope="col" className={`${head} text-right`}>Taxable subtotal</th>
          <th scope="col" className={`${head} text-right`}>Tax collected</th>
          <th scope="col" className={`${head} text-right`}>Tax lines</th>
          <th scope="col" className={`${head} text-right`}>Receipts</th>
        </tr>
      </thead>
      <tbody>
        {report.groups.map((group) => (
          <tr
            key={`${group.currency}|${group.scope}|${group.rate}|${group.name}`}
            className="border-t border-[#f0ede6] text-[#1d1c17]"
          >
            <td className={`${cell} font-semibold`}>
              {group.name}
              {group.lines_without_base > 0 && (
                <span
                  className="ml-1.5 text-[9.5px] font-bold text-amber-700"
                  title="Item-level tax lines whose line item no longer exists add tax but no taxable base."
                >
                  ({group.lines_without_base} without base)
                </span>
              )}
            </td>
            <td className={cell}>
              {printable ? SCOPE_LABEL[group.scope] : <ScopeBadge scope={group.scope} />}
            </td>
            <td className={`${cell} text-right tabular-nums`}>{formatRate(group.rate)}</td>
            <td className={`${cell} text-right tabular-nums`}>{formatMoney(group.taxable_subtotal, group.currency)}</td>
            <td className={`${cell} text-right tabular-nums font-bold`}>
              {formatMoney(group.tax_collected, group.currency)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>{group.tax_lines}</td>
            <td className={`${cell} text-right tabular-nums`}>{group.receipts}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-[#1d1c17]">
        {report.totals_by_currency.map((totals) => (
          <React.Fragment key={totals.currency}>
            {totals.by_scope.map((scope) => (
              <tr key={scope.scope} className="text-[#5f5e5e] bg-[#fcfcfb]" data-testid={`subtotal-${totals.currency}-${scope.scope}`}>
                <th scope="row" colSpan={3} className={`${cell} text-left font-semibold uppercase tracking-wide`}>
                  Subtotal {SCOPE_LABEL[scope.scope].toLowerCase()} scope · {totals.currency}
                </th>
                <td className={`${cell} text-right tabular-nums`}>{formatMoney(scope.taxable_subtotal, totals.currency)}</td>
                <td className={`${cell} text-right tabular-nums font-semibold`}>
                  {formatMoney(scope.tax_collected, totals.currency)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>{scope.tax_lines}</td>
                <td className={cell} />
              </tr>
            ))}
            <tr className="bg-[#1d1c17] text-white font-bold" data-testid={`total-${totals.currency}`}>
              <th scope="row" colSpan={3} className={`${cell} text-left uppercase tracking-wider`}>
                Total {totals.currency}
              </th>
              <td className={`${cell} text-right tabular-nums`}>{formatMoney(totals.taxable_subtotal, totals.currency)}</td>
              <td className={`${cell} text-right tabular-nums`}>{formatMoney(totals.tax_collected, totals.currency)}</td>
              <td className={`${cell} text-right tabular-nums`}>{totals.tax_lines}</td>
              <td className={`${cell} text-right tabular-nums`}>{totals.receipts}</td>
            </tr>
          </React.Fragment>
        ))}
      </tfoot>
    </table>
  );
};

export const TaxLiabilityReport: React.FC = () => {
  const [draft, setDraft] = useState<TaxFilterDraft>(defaultDraft);
  const [applied, setApplied] = useState<TaxLiabilityFilters>(() => toFilters(defaultDraft()));
  const [report, setReport] = useState<TaxLiabilityReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const load = useCallback(async (filters: TaxLiabilityFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await fetchTaxLiabilityReport(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the tax liability report.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const handleExport = async (format: ReportExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const fileName = await exportBillingReport('tax-liability', applied, format);
      setNotice(`Downloaded ${fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the report.');
    } finally {
      setExporting(null);
    }
  };

  const single = report && report.totals_by_currency.length === 1 ? report.totals_by_currency[0] : null;
  const mixedCurrencies = (report?.currencies.length ?? 0) > 1;
  const kpiValue = (render: (t: NonNullable<typeof single>) => string) =>
    isLoading ? '...' : single ? render(single) : mixedCurrencies ? 'Mixed' : '0.00';

  return (
    <section aria-label="Tax liability report" className="flex flex-col gap-4">
      {/* KPIs del periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full min-w-0">
        <ReportKpiCard
          icon="account_balance"
          label="Tax collected"
          tone="red"
          badge="LIABILITY"
          value={kpiValue((t) => formatMoney(t.tax_collected, t.currency))}
        />
        <ReportKpiCard
          icon="calculate"
          label="Taxable subtotal"
          tone="blue"
          badge="BASE"
          value={kpiValue((t) => formatMoney(t.taxable_subtotal, t.currency))}
        />
        <ReportKpiCard
          icon="percent"
          label="Tax groups"
          tone="purple"
          badge="RATE × SCOPE"
          value={isLoading ? '...' : (report?.totals.groups ?? 0)}
        />
        <ReportKpiCard
          icon="receipt_long"
          label="Receipts taxed"
          tone="emerald"
          badge={`${report?.totals.tax_lines ?? 0} LINES`}
          value={isLoading ? '...' : (report?.totals.receipts ?? 0)}
        />
      </div>

      {/* Filtros */}
      <form
        className="bg-white border border-[#e8e2d8] rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-3"
        aria-label="Tax liability filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(toFilters(draft));
        }}
      >
        <ReportPeriodFields
          idPrefix="tax"
          from={draft.from}
          to={draft.to}
          onChange={(range) => setDraft((d) => ({ ...d, ...range }))}
        />
        <div className="flex flex-col gap-1">
          <ReportFieldLabel htmlFor="tax-rate">Rate (%)</ReportFieldLabel>
          <input
            id="tax-rate"
            type="number"
            min={0}
            max={999.99}
            step="0.01"
            placeholder="Any"
            value={draft.rate}
            onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
            className={`${REPORT_FIELD_CLASS} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <ReportFieldLabel htmlFor="tax-scope">Scope</ReportFieldLabel>
          <select
            id="tax-scope"
            value={draft.scope}
            onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value as ReceiptTaxScope | '' }))}
            className={`${REPORT_FIELD_CLASS} cursor-pointer`}
          >
            <option value="">All scopes</option>
            <option value="RECEIPT">Receipt</option>
            <option value="ITEM">Line item</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <ReportFieldLabel htmlFor="tax-name">Tax name / type</ReportFieldLabel>
          <input
            id="tax-name"
            type="text"
            placeholder="e.g. VAT"
            maxLength={150}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className={`${REPORT_FIELD_CLASS} w-40`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <ReportFieldLabel htmlFor="tax-currency">Currency</ReportFieldLabel>
          <input
            id="tax-currency"
            type="text"
            placeholder="All"
            maxLength={10}
            value={draft.currency}
            onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
            className={`${REPORT_FIELD_CLASS} w-20 uppercase`}
          />
        </div>
        <ReportFilterButtons
          isLoading={isLoading}
          onReset={() => {
            const next = defaultDraft();
            setDraft(next);
            setApplied(toFilters(next));
          }}
        />
      </form>

      {error && <ReportErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && !error && (
        <p role="status" className="text-[11px] font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#e8e2d8] shadow-xs overflow-hidden">
        <div className="bg-[#222222] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#333333]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-[#ae001a] text-xl select-none" aria-hidden="true">
              account_balance
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Tax liability by rate & scope</span>
            <span className="text-[10px] font-mono font-bold bg-[#333333] text-zinc-300 px-2 py-0.5 rounded border border-[#444444]">
              {describeDateRange(applied)}
            </span>
          </div>
          <ReportExportActions
            busy={exporting}
            disabled={isLoading || !report}
            onExport={(format) => void handleExport(format)}
            onPrint={() => setIsPrintOpen(true)}
          />
        </div>

        {mixedCurrencies && (
          <p className="px-5 py-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border-b border-amber-200">
            Receipts in {report?.currencies.join(', ')}: totals are shown per currency. Filter by currency for a single
            filing.
          </p>
        )}

        {isLoading ? (
          <div className="py-14 text-center text-xs text-[#5f5e5e]" role="status">
            Loading tax liability…
          </div>
        ) : report && report.groups.length > 0 ? (
          <div className="overflow-x-auto">
            <TaxLiabilityTable report={report} />
          </div>
        ) : (
          <div className="py-14 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[36px] text-[#d5cfc4]" aria-hidden="true">
              receipt_long
            </span>
            <p className="text-sm font-bold text-[#1d1c17]">No taxes collected for these filters</p>
            <p className="text-xs text-[#5f5e5e]">Only active tax lines of active receipts are included.</p>
          </div>
        )}

        <p className="px-5 py-2.5 text-[10.5px] text-[#76736a] border-t border-[#f0ede6] bg-[#fcfcfb]">
          Taxable subtotal: receipt subtotal for receipt-level taxes and line subtotal for item-level taxes, counted
          once per receipt or line in each group. Totals are the exact sum of the groups.
        </p>
      </div>

      {isPrintOpen && report && (
        <ReportPrintPreview
          title="Tax Liability Report"
          subtitle="Taxes collected grouped by rate and scope — statutory filing summary."
          meta={[
            { label: 'Period', value: describeDateRange(applied) },
            { label: 'Rate', value: applied.rate !== null && applied.rate !== undefined ? formatRate(applied.rate) : 'All' },
            { label: 'Scope', value: applied.scope ? SCOPE_LABEL[applied.scope] : 'All' },
            { label: 'Tax name', value: applied.name || 'All' },
            { label: 'Currency', value: applied.currency || report.currencies.join(', ') || '—' },
            { label: 'Generated', value: formatDateTime(report.generated_at) },
          ]}
          onClose={() => setIsPrintOpen(false)}
        >
          {report.groups.length > 0 ? (
            <TaxLiabilityTable report={report} printable />
          ) : (
            <p className="text-sm text-[#5f5e5e]">No taxes collected for these filters.</p>
          )}
          <p className="mt-4 text-[10px] text-[#76736a]">
            Taxable subtotal: receipt subtotal for receipt-level taxes and line subtotal for item-level taxes, counted
            once per receipt or line in each group.
          </p>
        </ReportPrintPreview>
      )}
    </section>
  );
};

export default TaxLiabilityReport;
