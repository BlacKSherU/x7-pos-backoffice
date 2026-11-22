// Utilidades de los reportes de facturación: formato, periodos, nombres de archivo y exportación
// (CSV tal cual lo genera el back-end y .xls simple a partir de ese CSV, sin dependencias).

import type { BillingReportKind, BillingReportDateFilters } from '../types/billing-reports';

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  const amount = Number(value ?? 0);
  const text = (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${text} ${currency}` : text;
}

export function formatRate(rate: number | null | undefined): string {
  return `${Number(rate ?? 0).toFixed(2)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Fecha local en formato YYYY-MM-DD (lo que esperan los filtros y `<input type="date">`). */
export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type ReportPeriodPreset = 'this-month' | 'last-month' | 'quarter-to-date' | 'year-to-date' | 'custom';

export const REPORT_PERIOD_OPTIONS: Array<{ value: ReportPeriodPreset; label: string }> = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'quarter-to-date', label: 'Quarter to date' },
  { value: 'year-to-date', label: 'Year to date' },
  { value: 'custom', label: 'Custom range' },
];

/** Rango de fechas de un periodo predefinido, relativo a `today`. */
export function periodRange(
  preset: Exclude<ReportPeriodPreset, 'custom'>,
  today: Date = new Date(),
): { from: string; to: string } {
  const year = today.getFullYear();
  const month = today.getMonth();
  switch (preset) {
    case 'last-month':
      return {
        from: toDateInput(new Date(year, month - 1, 1)),
        to: toDateInput(new Date(year, month, 0)),
      };
    case 'quarter-to-date':
      return {
        from: toDateInput(new Date(year, Math.floor(month / 3) * 3, 1)),
        to: toDateInput(today),
      };
    case 'year-to-date':
      return { from: toDateInput(new Date(year, 0, 1)), to: toDateInput(today) };
    case 'this-month':
    default:
      return { from: toDateInput(new Date(year, month, 1)), to: toDateInput(today) };
  }
}

export function describeDateRange(filters: BillingReportDateFilters): string {
  if (filters.from && filters.to) return `${filters.from} → ${filters.to}`;
  if (filters.from) return `From ${filters.from}`;
  if (filters.to) return `Up to ${filters.to}`;
  return 'All dates';
}

/** Nombre de archivo: `tax-liability_2026-01-01_2026-01-31.csv`. */
export function reportFileName(
  kind: BillingReportKind,
  filters: BillingReportDateFilters,
  extension: 'csv' | 'xls',
): string {
  const parts = [kind, filters.from, filters.to].filter((p): p is string => Boolean(p));
  return `${parts.join('_').replace(/[^a-zA-Z0-9._-]+/g, '-')}.${extension}`;
}

/** Parser CSV RFC 4180 (comillas, comillas dobles, saltos de línea dentro de comillas, CRLF). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DECIMAL_CELL = /^-?\d+\.\d{2}$/;
const INTEGER_CELL = /^-?\d+$/;
const TOTAL_ROW = /^(TOTAL|SUBTOTAL)\b/;

/**
 * Libro .xls simple (tabla HTML con los espacios de nombres de Office) a partir del CSV del back-end.
 * Excel lo abre sin librerías; los importes quedan como número con 2 decimales y el resto como texto.
 */
export function csvToExcelHtml(csvText: string, sheetName: string): string {
  const rows = parseCsv(csvText).filter((r) => r.some((cell) => cell !== ''));
  const safeSheet = escapeHtml(sheetName.slice(0, 31) || 'Report');

  const body = rows
    .map((cells, index) => {
      const isHeader = index === 0;
      const isTotal = cells.slice(0, 2).some((c) => TOTAL_ROW.test(c));
      const tds = cells
        .map((cell) => {
          const tag = isHeader ? 'th' : 'td';
          const weight = isHeader || isTotal ? 'font-weight:bold;' : '';
          if (!isHeader && DECIMAL_CELL.test(cell)) {
            return `<${tag} style="${weight}mso-number-format:'0.00'">${cell}</${tag}>`;
          }
          if (!isHeader && INTEGER_CELL.test(cell)) {
            return `<${tag} style="${weight}mso-number-format:'0'">${cell}</${tag}>`;
          }
          return `<${tag} style="${weight}mso-number-format:'\\@'">${escapeHtml(cell)}</${tag}>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8" />',
    `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${safeSheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`,
    '</head><body>',
    `<table border="1">${body}</table>`,
    '</body></html>',
  ].join('');
}

/** Guarda un texto como archivo en el navegador (Blob + enlace temporal). */
export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const CSV_MIME = 'text/csv;charset=utf-8';
export const XLS_MIME = 'application/vnd.ms-excel;charset=utf-8';
