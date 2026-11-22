import { fetchBillingReportCsv } from '../../api/billing-reports-api';
import {
  CSV_MIME,
  XLS_MIME,
  csvToExcelHtml,
  downloadTextFile,
  reportFileName,
} from '../../lib/billing-reports';
import type {
  BillingReportKind,
  DiscountAuditFilters,
  TaxLiabilityFilters,
} from '../../types/billing-reports';

export type ReportExportFormat = 'csv' | 'xls';

const SHEET_NAMES: Record<BillingReportKind, string> = {
  'tax-liability': 'Tax Liability',
  'discount-audit': 'Discount & Void Audit',
};

/**
 * Exporta el reporte con los filtros aplicados. Ambos formatos parten del CSV del back-end (todas
 * las filas y las filas TOTAL): `csv` lo guarda tal cual (con BOM para Excel) y `xls` lo convierte
 * en un libro .xls simple.
 */
export async function exportBillingReport(
  kind: BillingReportKind,
  filters: TaxLiabilityFilters | DiscountAuditFilters,
  format: ReportExportFormat,
): Promise<string> {
  const csv = (await fetchBillingReportCsv(kind, filters)).replace(/^\uFEFF/, '');
  const fileName = reportFileName(kind, filters, format);
  if (format === 'csv') {
    // `Response.text()` quita el BOM: se vuelve a poner para que Excel lea UTF-8.
    downloadTextFile(`\uFEFF${csv}`, fileName, CSV_MIME);
  } else {
    downloadTextFile(csvToExcelHtml(csv, SHEET_NAMES[kind]), fileName, XLS_MIME);
  }
  return fileName;
}
