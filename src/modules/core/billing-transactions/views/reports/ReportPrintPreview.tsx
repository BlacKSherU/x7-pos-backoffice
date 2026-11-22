import React from 'react';
import { createPortal } from 'react-dom';

export interface ReportPrintMeta {
  label: string;
  value: string;
}

interface ReportPrintPreviewProps {
  title: string;
  subtitle?: string;
  meta: ReportPrintMeta[];
  isLoading?: boolean;
  notice?: string | null;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Vista previa imprimible (Print / PDF): se monta en <body> y, al imprimir, oculta el resto de la
 * aplicación para que solo salga el reporte. "Save as PDF" del diálogo del navegador genera el PDF.
 */
const PRINT_CSS = `
@media print {
  body > *:not(.billing-report-print-root) { display: none !important; }
  .billing-report-print-root {
    position: static !important;
    inset: auto !important;
    background: #ffffff !important;
    overflow: visible !important;
    padding: 0 !important;
  }
  .billing-report-print-root .no-print { display: none !important; }
  .billing-report-print-paper {
    box-shadow: none !important;
    border: none !important;
    margin: 0 !important;
    max-width: none !important;
    padding: 0 !important;
  }
  .billing-report-print-paper table { page-break-inside: auto; }
  .billing-report-print-paper tr { page-break-inside: avoid; }
  @page { size: landscape; margin: 12mm; }
}
`;

export const ReportPrintPreview: React.FC<ReportPrintPreviewProps> = ({
  title,
  subtitle,
  meta,
  isLoading = false,
  notice,
  onClose,
  children,
}) =>
  createPortal(
    <div
      className="billing-report-print-root fixed inset-0 z-[9999] bg-black/60 overflow-auto p-4 sm:p-8 font-sans font-poppins"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} print preview`}
    >
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-6xl mx-auto mb-3 flex items-center justify-between gap-3 bg-[#222222] text-white rounded-xl px-4 py-2.5 shadow-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[#ae001a] text-[20px]" aria-hidden="true">
            print
          </span>
          <span className="text-xs font-bold uppercase tracking-wider truncate">Print / PDF preview</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={isLoading}
            className="h-8 px-3 rounded-lg bg-[#ae001a] hover:bg-[#900015] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">picture_as_pdf</span>
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-lg border border-zinc-600 text-zinc-200 hover:text-white hover:border-zinc-400 text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      <div className="billing-report-print-paper max-w-6xl mx-auto bg-white border border-[#e8e2d8] rounded-xl shadow-2xl p-8 text-[#1d1c17]">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#ae001a] pb-4 mb-4">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-wider text-[#ae001a]">{title}</h1>
            {subtitle && <p className="text-xs text-[#5f5e5e] mt-1">{subtitle}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[11px] shrink-0">
            {meta.map((item) => (
              <React.Fragment key={item.label}>
                <dt className="font-bold text-[#5f5e5e] uppercase tracking-wide">{item.label}</dt>
                <dd className="text-right">{item.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </header>

        {notice && (
          <p className="mb-3 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            {notice}
          </p>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-[#5f5e5e]" role="status">
            Preparing printable report…
          </div>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body,
  );

export default ReportPrintPreview;
