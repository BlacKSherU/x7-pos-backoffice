import React from 'react';
import {
  REPORT_PERIOD_OPTIONS,
  periodRange,
  type ReportPeriodPreset,
} from '../../lib/billing-reports';
import type { ReportExportFormat } from './report-export';

// Piezas comunes de las dos pestañas de reportes: tarjetas KPI, periodo y acciones de exportación.

type KpiTone = 'red' | 'blue' | 'emerald' | 'amber' | 'purple' | 'zinc';

const TONES: Record<KpiTone, { box: string; badge: string }> = {
  red: { box: 'bg-red-50 text-[#ae001a] border-red-200', badge: 'bg-red-100 text-[#ae001a] border-red-200' },
  blue: { box: 'bg-blue-50 text-blue-700 border-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  emerald: {
    box: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  amber: { box: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  purple: {
    box: 'bg-purple-50 text-purple-700 border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  zinc: { box: 'bg-zinc-50 text-zinc-700 border-zinc-200', badge: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
};

export const ReportKpiCard: React.FC<{
  icon: string;
  label: string;
  value: React.ReactNode;
  badge?: string;
  tone?: KpiTone;
}> = ({ icon, label, value, badge, tone = 'zinc' }) => (
  <div className="bg-white border border-[#e8e2d8] p-2.5 rounded-xl shadow-xs flex items-center justify-between min-w-0 cursor-default font-sans font-poppins">
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${TONES[tone].box}`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider truncate">{label}</div>
        <div className="text-base sm:text-lg font-extrabold text-[#1d1c17] leading-tight truncate">{value}</div>
      </div>
    </div>
    {badge && (
      <span
        className={`hidden xl:inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border shrink-0 ${TONES[tone].badge}`}
      >
        {badge}
      </span>
    )}
  </div>
);

const FIELD =
  'h-[34px] px-2.5 text-xs rounded-lg border border-[#d5cfc4] focus:outline-none focus:border-[#ae001a] focus:ring-1 focus:ring-[#ae001a]/20 bg-[#fcfcfb] text-[#1d1c17] font-sans font-poppins';

export const REPORT_FIELD_CLASS = FIELD;

export const ReportFieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="text-[9.5px] font-bold text-[#5f5e5e] uppercase tracking-wider">
    {children}
  </label>
);

/** Periodo predefinido + fechas Desde/Hasta (rango sobre la fecha del recibo). */
export const ReportPeriodFields: React.FC<{
  idPrefix: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}> = ({ idPrefix, from, to, onChange }) => {
  const [preset, setPreset] = React.useState<ReportPeriodPreset>('custom');

  return (
    <>
      <div className="flex flex-col gap-1">
        <ReportFieldLabel htmlFor={`${idPrefix}-period`}>Period</ReportFieldLabel>
        <select
          id={`${idPrefix}-period`}
          value={preset}
          onChange={(e) => {
            const next = e.target.value as ReportPeriodPreset;
            setPreset(next);
            if (next !== 'custom') onChange(periodRange(next));
          }}
          className={`${FIELD} cursor-pointer`}
        >
          {REPORT_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <ReportFieldLabel htmlFor={`${idPrefix}-from`}>From</ReportFieldLabel>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => {
            setPreset('custom');
            onChange({ from: e.target.value, to });
          }}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <ReportFieldLabel htmlFor={`${idPrefix}-to`}>To</ReportFieldLabel>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => {
            setPreset('custom');
            onChange({ from, to: e.target.value });
          }}
          className={FIELD}
        />
      </div>
    </>
  );
};

/** Botones Apply / Reset del formulario de filtros. */
export const ReportFilterButtons: React.FC<{ onReset: () => void; isLoading: boolean }> = ({ onReset, isLoading }) => (
  <div className="flex items-end gap-2">
    <button
      type="submit"
      disabled={isLoading}
      className="h-[34px] px-3.5 rounded-lg bg-[#ae001a] hover:bg-[#900015] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">filter_alt</span>
      Apply filters
    </button>
    <button
      type="button"
      onClick={onReset}
      className="h-[34px] px-3 rounded-lg border border-[#d5cfc4] text-[#5f5e5e] hover:text-[#ae001a] hover:border-[#ae001a] text-xs font-bold cursor-pointer bg-white"
    >
      Reset
    </button>
  </div>
);

/** Exportar CSV / Excel e imprimir (vista previa PDF). */
export const ReportExportActions: React.FC<{
  busy: ReportExportFormat | null;
  disabled?: boolean;
  onExport: (format: ReportExportFormat) => void;
  onPrint: () => void;
}> = ({ busy, disabled = false, onExport, onPrint }) => {
  const base =
    'h-[34px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export report">
      <button
        type="button"
        onClick={() => onExport('csv')}
        disabled={disabled || busy !== null}
        className={`${base} border-[#d5cfc4] bg-white text-[#1d1c17] hover:border-[#ae001a] hover:text-[#ae001a]`}
      >
        <span className={`material-symbols-outlined text-[16px] ${busy === 'csv' ? 'animate-spin' : ''}`} aria-hidden="true">
          {busy === 'csv' ? 'progress_activity' : 'csv'}
        </span>
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => onExport('xls')}
        disabled={disabled || busy !== null}
        className={`${base} border-[#d5cfc4] bg-white text-[#1d1c17] hover:border-emerald-600 hover:text-emerald-700`}
      >
        <span className={`material-symbols-outlined text-[16px] ${busy === 'xls' ? 'animate-spin' : ''}`} aria-hidden="true">
          {busy === 'xls' ? 'progress_activity' : 'table_view'}
        </span>
        Export Excel
      </button>
      <button
        type="button"
        onClick={onPrint}
        disabled={disabled}
        className={`${base} border-[#222222] bg-[#222222] text-white hover:bg-black`}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">print</span>
        Print / PDF
      </button>
    </div>
  );
};

export const ReportErrorBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
  <div
    role="alert"
    className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold"
  >
    <span className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
      {message}
    </span>
    {onDismiss && (
      <button type="button" onClick={onDismiss} className="text-red-700 hover:text-red-900 font-bold cursor-pointer" aria-label="Dismiss error">
        ✕
      </button>
    )}
  </div>
);
